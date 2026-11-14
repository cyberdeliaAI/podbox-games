// Build a self-contained browser release with the official PodBox player.
// Dependencies and runtime stay outside the SDK and other game folders.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import zlib from 'node:zlib';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const arg = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const sdk = path.resolve(arg('--sdk', process.env.SDK || path.join(root, '../podbox/arcade/sdk')));
const out = path.resolve(arg('--out', path.join(root, 'dist')));
const pinned = {
  url: 'https://raw.githubusercontent.com/anthonyfletcher/podbox/1aad8efd327ecdfbd2ef0223cfb18dffa2213796/ide/index.html',
  sha256: '783888cafbc2f9d48f21a8f8c5223df8702bf55d59459942ad10ddea27d79057'
};
await fs.mkdir(out, { recursive: true });
let runtime;
if (arg('--runtime', null)) {
  runtime = await fs.readFile(path.resolve(arg('--runtime')));
} else {
  const response = await fetch(pinned.url);
  if (!response.ok) throw new Error(`Runtime download failed: ${response.status}`);
  const html = await response.text();
  const encoded = html.match(/"(AGFzbQ[A-Za-z0-9+/=]+)"/);
  if (!encoded) throw new Error('The pinned official IDE has no embedded runtime');
  runtime = Buffer.from(encoded[1], 'base64');
  if (createHash('sha256').update(runtime).digest('hex') !== pinned.sha256)
    throw new Error('Official runtime checksum mismatch');
}
if (runtime.subarray(0, 4).toString('hex') !== '0061736d') throw new Error('Invalid WASM runtime');
await fs.writeFile(path.join(out, 'pocketgolf-runtime.wasm'), runtime);
const requireSdk = createRequire(path.join(sdk, 'package.json'));
const modulePath = arg('--esbuild', null) || requireSdk.resolve('esbuild');
const esbuild = await import(pathToFileURL(path.resolve(modulePath)));
const { webPage } = await import(pathToFileURL(path.join(sdk, 'src/webpage.js')));
const bundle = await esbuild.build({ entryPoints: [path.join(sdk, 'web/play.js')], bundle: true,
  format: 'iife', minify: true, write: false, target: ['es2020'], legalComments: 'eof' });
const licences = (await Promise.all(['fonts/LICENSE-world.txt', 'wasm/LICENSE-libc.txt']
  .map(p => fs.readFile(path.join(sdk, p), 'utf8')))).join('\n' + '='.repeat(78) + '\n\n');
if (/<\/script|<!--/i.test(licences)) throw new Error('Unexpected licence delimiter');
const template = (await fs.readFile(path.join(sdk, 'web/play.html'), 'utf8'))
  .replace('<script id="licences" type="text/plain"></script>',
    () => '<script id="licences" type="text/plain">\n' + licences + '</script>');
const pbg = path.join(out, 'pocketgolf.pbg');
process.stdout.write(execFileSync(process.execPath, [path.join(sdk, 'pbgc.js'), 'build', path.join(root, 'pocketgolf'), '-o', pbg]));
const page = webPage({ template, script: bundle.outputFiles[0].text,
  cart: await fs.readFile(pbg), wasmGz: zlib.gzipSync(runtime, { level: 9 }), fontGz: null,
  meta: JSON.parse(await fs.readFile(path.join(root, 'pocketgolf/cart.json'), 'utf8')),
  wheel: 'always', scale: 'fit' });
const embedded = JSON.parse(page.match(/<script id="cart-data" type="application\/json">([^<]+)<\/script>/)[1]);
if (!Buffer.from(embedded.cart, 'base64').equals(await fs.readFile(pbg)) ||
    !zlib.gunzipSync(Buffer.from(embedded.wasm, 'base64')).equals(runtime))
  throw new Error('Browser release payload mismatch');
await fs.writeFile(path.join(out, 'pocketgolf.html'), page);
const release = { name: 'Pocket Golf Deluxe', version: '1.0', runtime: pinned,
  runtimeUsedSha256: createHash('sha256').update(runtime).digest('hex'),
  cartSha256: createHash('sha256').update(await fs.readFile(pbg)).digest('hex') };
await fs.writeFile(path.join(out, 'pocketgolf-release.json'), JSON.stringify(release, null, 2) + '\n');
console.log(`Browser release: ${path.join(out, 'pocketgolf.html')} (${Math.round(page.length / 1024)} KB)`);
