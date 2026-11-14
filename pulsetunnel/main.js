// Pulse Tunnel: fly down a tunnel that moves to the music.
//
// A ring of the tunnel passes the ship on every beat of whatever is
// playing. Enemies, gates and pickups are planned a beat at a time as each
// beat comes into view at the far end, and arrive at the rim on that beat.
// The ship goes where the thumb rests on the wheel and fires by itself on
// the eighth notes.
//
// Time: everything runs on gt, game time in ms, which follows the music's
// clock while it plays and the ticks while it does not, and never jumps.
// The beat grid is anchor + k * beatMs in game time, latched from the
// iPod's beat tracker and nudged toward its predictions every beat.
//
// Parts: the clock; the tempo; planning; the ship; the run; the screens.

const ST_TITLE = 0, ST_PLAY = 1, ST_DYING = 2, ST_OVER = 3;

const DEFAULT_BEAT = 500;          // 120 BPM, with no music
const BEAT_TARGET = 500, BEAT_FAST = 370, BEAT_MIN = 300, BEAT_MAX = 860;
const LISTEN_BEATS = 24;           // beats a try listens before it gives up
const RETRY_BEATS = 16;            // four bars on the old tempo before trying again
const LISTEN_TRIES = 3;            // tries a track gets: a quiet intro can hide its beat
const SECTOR_BEATS = 64;           // sixteen bars a sector
const MAX_POWER = 3, MAX_BOMBS = 3;
const STEER_MAX = 0.05;            // turns a tick the ship can move, at 33 a second

var state = ST_TITLE;

// the clock
var gt = 0;                        // game time, ms
var onMusic = false;               // gt follows the music's clock
var mOff = 0;                      // gt - beat.clock(), while it does
var lastClock = 0;
var msRest = 0;
var dtms = 30;                     // this tick's ms
var lastTrack = -2;

// the tempo and the grid
var beatMs = DEFAULT_BEAT;
var bmF = 500.0;                   // beatMs as a fraction, for depths
var bpm = 120;
var bpmText = "120";               // bpm as the HUD shows it, made when it changes
var anchor = 0;                    // game time of beat 0
var curBeat = 0;                   // the last beat passed
var planned = 0;                   // the last beat planned
var barRes = 0;                    // the residue of four that starts a bar
var subMs = 250;                   // the guns' beat
var lastSub = 0;
var listening = false;
var listened = 0;                  // beats listened this try
var locked = false;                // the tempo was taken from the track playing now
var tries = 0;                     // tries at this track's tempo so far
var retryAt = -1;                  // the beat to listen again on, -1 for none
var bs = new Int32Array(6);
var moodBuf = new Int32Array(3);
var energy = 50;

// the ship and the run
var shipA = 0.75;
var alive = false;
var shields = 3, bombs = 2, power = 1;
var points = 0, streak = 0, mult = 1;
var runBeat0 = 0, sector = 1, spawnFrom = 0;
var invulnUntil = 0;
var gatesPassed = 0, hitThisSector = false;
var gateAt = -100, gateCentre = 0.25, pickupNext = 0;
var dyingTicks = 0, overTicks = 0, rank = 0, best = 0;
var shake = 0;
var fxp;                           // the explosions' particles

// what the screen says
var msg = "", msgUntil = 0;
var trackName = "", trackUntil = 0;
var trackText = "";                // trackName cut to fit the screen
var volShown = -1, volUntil = 0;
var late = 0;
var slowed = false;                // the iPod fell behind this run: it stays at 25

// ---- the Arcade's three --------------------------------------------------------

function init() {
    tube.setup();
    fxp = particles.pool(160);
    fxp.drag = 0.06;
    fxp.cull = true;
    best = score.best(BOARD.points) || 0;
    bmF = beatMs * 1.0;
    setSub();
}

function update() {
    clockTick();
    if (opt.changed())
        retempo();
    beats();
    tube.step();
    if (shake > 0)
        shake--;

    if (state == ST_TITLE) {
        titleUpdate();
    } else if (state == ST_PLAY) {
        steer();
        if (btnp(4))
            useBomb();
        foes.step(gt, bmF, shipA, true);
        shots.step(dtms);
    } else if (state == ST_DYING) {
        foes.step(gt, bmF, shipA, false);
        shots.step(dtms);
        if (--dyingTicks <= 0)
            gameOver();
    } else {
        overUpdate();
    }
    particles.step(fxp);
    tube.lean(shipA, gt);
    pace();
}

function draw() {
    cls(tube.BG);
    if (shake > 0)
        camera(rnd(5) - 2, rnd(5) - 2);
    tube.draw(gt, anchor, beatMs, curBeat, barRes);
    if (state != ST_TITLE) {
        laneLine();
        foes.draw();
        shots.draw();
    }
    if (state == ST_PLAY || state == ST_TITLE)
        drawShip();
    particles.draw(fxp);
    camera();
    if (state == ST_TITLE)
        hud.title();
    else if (state == ST_OVER)
        hud.over();
    else
        hud.play();
}

// ---- the clock -----------------------------------------------------------------

function clockTick() {
    var r = rate();
    dtms = 1000 / r;
    msRest += 1000 % r;
    if (msRest >= r) {
        msRest -= r;
        dtms++;
    }

    var track = playback.track();
    if (playback.playing()) {
        var c = beat.clock();
        var newTrack = track != lastTrack;
        if (!onMusic || newTrack || beat.jumped() || c < lastClock || c - lastClock > 400) {
            // the music started, moved or changed: game time holds its
            // place, and the grid is found again
            mOff = gt - c;
            onMusic = true;
            lastClock = c;
            if (newTrack) {
                lastTrack = track;
                newMusic();
            } else {
                realign();
            }
            return;
        }
        var g = c + mOff;
        if (g > gt) {
            dtms = g - gt;
            gt = g;
        } else {
            dtms = 0;
        }
        lastClock = c;
        return;
    }
    onMusic = false;
    gt += dtms;
}

// A new track: its colours, its name, and its tempo to find
function newMusic() {
    tube.fromMusic();
    trackName = playback.title();
    if (playback.artist() != "")
        trackName = trackName + " - " + playback.artist();
    font(FONT.CAPS);
    trackText = textfit(trackName, 150);
    trackUntil = gt + 3500;
    // the grid keeps the last track's tempo until this one's is found
    locked = false;
    tries = 0;
    startListening();
}

// ---- the tempo -----------------------------------------------------------------

// The track's beat times a power of two, nearest the target; the beat
// above where that is quicker than can be flown
function octave(ms) {
    if (ms <= 0)
        return BEAT_TARGET;
    var shifts = [-2, -1, 0, 1], best1 = BEAT_TARGET, err = -1;
    for (var i = 0; i < 4; i++) {
        var m = shifts[i] < 0 ? ms >> -shifts[i] : ms << shifts[i];
        var e = abs(m - BEAT_TARGET);
        if (err < 0 || e < err) {
            err = e;
            best1 = m;
        }
    }
    if (best1 >= BEAT_MIN && best1 < BEAT_FAST)
        best1 *= 2;
    return best1;
}

// The octave the owner asked for on top
function shifted(ms) {
    var k = opt.get(OPT.tempo);
    return k == 0 ? ms * 2 : k == 2 ? ms / 2 : ms;
}

// Floor division, for a time before the anchor
function fdiv(a, b) {
    return a >= 0 ? a / b : -((b - 1 - a) / b);
}

function setSub() {
    subMs = beatMs / 2;
    if (subMs > 300)
        subMs = beatMs / 4;
    if (subMs < 140)
        subMs = beatMs;
    lastSub = fdiv(gt - anchor, subMs);
}

// A new beat length, keeping the beat count where it is: beat curBeat + 1
// falls at 'at'
function setTempo(ms, at) {
    beatMs = ms;
    bmF = ms * 1.0;
    bpm = 60000 / ms;
    bpmText = "" + bpm;
    anchor = at - (curBeat + 1) * beatMs;
    setSub();
}

function startListening() {
    if (!playback.playing())
        return;
    beat.listen(true);
    listening = true;
    listened = 0;
    tries++;
    retryAt = -1;
    // the tracker takes about 6,300 units a tick at 33, half of what a
    // tick has: at 25 there is room for it and the tunnel both, and the
    // game, timed on the music's ms, plays the same
    setrate(25);
}

// Done listening: back to 33, unless the iPod fell behind this run
function stopListening() {
    beat.listen(false);
    listening = false;
    if (!slowed)
        setrate(33);
}

// Take the tempo once it is held
function tryLatch() {
    if (!beat.state(bs) || bs[3] < 50)
        return false;
    var ms = shifted(octave(bs[2]));
    if (ms < 150 || ms > 1800)
        return false;
    stopListening();
    locked = true;
    var c = beat.clock(), next = beat.next(c, 0);
    setTempo(ms, next >= 0 ? next + mOff : gt + ms);
    findBar();
    announce(bpm + " BPM");
    return true;
}

// The Tempo option changed: the same tempo, another octave
function retempo() {
    if (locked && beat.state(bs)) {
        var c = beat.clock(), next = beat.next(c, 0);
        setTempo(shifted(octave(bs[2])), next >= 0 ? next + mOff : gt + beatMs);
    }
}

// The music moved under the game: put the grid back on its beats
function realign() {
    if (listening || !locked || !beat.state(bs))
        return;
    var next = beat.next(beat.clock(), 0);
    if (next >= 0)
        setTempo(beatMs, next + mOff);
}

// Which of our beats starts a bar, from the tracker's downbeat
function findBar() {
    if (beat.downbeat() < 0)
        return;
    var c = beat.clock();
    for (var k = 0; k < 4; k++) {
        var at = beat.next(c, k);
        if (at >= 0 && beat.inbar() == 0) {
            var g = fdiv(at + mOff - anchor + beatMs / 2, beatMs);
            barRes = g & 3;
            return;
        }
    }
}

// Every beat, the grid is nudged a little toward the tracker's beat
function nudge() {
    if (!onMusic || listening || !locked)
        return;
    var c = beat.clock();
    var want = anchor + (curBeat + 1) * beatMs;
    for (var k = 0; k < 2; k++) {
        var at = beat.next(c, k);
        if (at < 0)
            return;
        var diff = at + mOff - want;
        if (abs(diff) < beatMs / 5) {
            anchor += mid(-8, diff / 2, 8);
            return;
        }
    }
}

// ---- the beats -----------------------------------------------------------------

function beats() {
    var b = fdiv(gt - anchor, beatMs);
    if (b - curBeat > 8)
        curBeat = b - 1;
    while (curBeat < b) {
        curBeat++;
        onBeat();
    }
    if (b < curBeat - 1)
        curBeat = b;

    // the guns, on their own beat
    var s = fdiv(gt - anchor, subMs);
    if (s != lastSub) {
        lastSub = s;
        if (state == ST_PLAY)
            shots.fire(shipA, power);
    }

    var want = curBeat + tube.VIEW;
    if (planned < curBeat)
        planned = curBeat;
    while (planned < want) {
        planned++;
        plan(planned);
    }
}

function onBeat() {
    var strong = ((curBeat - barRes) & 3) == 0;
    tube.beatPulse(strong);
    if (onMusic) {
        beat.mood(moodBuf);
        energy = moodBuf[0];
    } else {
        energy = 50;
    }
    if (listening) {
        if (!tryLatch() && ++listened >= LISTEN_BEATS) {
            // no beat yet, perhaps a quiet intro: fly on the old tempo and
            // try again a few bars on
            stopListening();
            if (tries < LISTEN_TRIES) {
                retryAt = curBeat + RETRY_BEATS;
                announce("NO BEAT YET");
            } else {
                announce("NO BEAT FOUND");
            }
        }
    } else if (retryAt >= 0 && curBeat >= retryAt) {
        startListening();
    } else {
        nudge();
        if (strong)
            findBar();
    }
    if (state == ST_PLAY) {
        var sec = 1 + (curBeat - runBeat0) / SECTOR_BEATS;
        if (sec > sector) {
            if (!hitThisSector && sector >= 2)
                ach.earn(ACH.clean);
            sector = sec;
            hitThisSector = false;
            announce("SECTOR " + sector);
            sfx(SFX.sector);
            if (sector >= 4)
                ach.earn(ACH.deep);
            if (sector >= 8)
                ach.earn(ACH.horizon);
        }
    }
}

// ---- planning ------------------------------------------------------------------

// What arrives on beat k, decided as it comes into view
function plan(k) {
    if (state != ST_PLAY || listening || k < spawnFrom)
        return;
    var at = anchor + k * beatMs;
    var inbar = (k - barRes) & 3;
    var bar = (k - barRes) >> 2;
    var sec = min(8, 1 + (k - runBeat0) / SECTOR_BEATS);
    var lv = opt.get(OPT.level);
    var dens = (0.75 + 0.25 * lv) * (0.7 + energy * 0.006);

    // a gate, on a bar's first beat: every four bars, then every two
    var every = sec >= 3 ? 2 : 4;
    if (inbar == 0 && bar % every == every - 1 && k >= spawnFrom + 6) {
        var half = max(0.085, 0.16 - 0.01 * sec - 0.01 * lv);
        gateCentre = gateCentre + (rnd(0.7) - 0.35);
        gateCentre -= flr(gateCentre);
        foes.gate(at, gateCentre, half);
        gateAt = k;
        return;
    }
    if (k == gateAt + 1)
        return;

    // a pickup, now and then
    if (k >= pickupNext && inbar == 2) {
        pickupNext = k + 28 + rnd(12);
        var pk = power < MAX_POWER && rnd(3) > 0 ? foes.POWER : foes.BOMB;
        foes.spawn(pk, at, rnd(1.0));
        return;
    }

    // a crowded tunnel waits for a beat: it is hard enough, and the iPod
    // has only so much time a tick
    if (foes.count >= 22 || rnd() >= (0.42 + 0.07 * sec) * dens)
        return;

    var base = rnd(1.0);
    if (inbar == 0 && sec >= 2 && rnd() < 0.25 + 0.06 * sec) {
        var h = foes.spawn(foes.HEAVY, at, base);
        if (h >= 0 && sec >= 5)
            foes.hp[h] = 4;
        return;
    }
    if (sec >= 2 && rnd() < 0.2 + 0.05 * sec) {
        var n = 1 + rnd(min(3, sec / 2));
        var dir = rnd(2) == 0 ? -1.0 : 1.0;
        for (var i = 0; i < n; i++)
            foes.spiral(at, base + i * 1.0 / n, dir * (0.12 + rnd(0.12)));
        return;
    }
    var form = rnd(4);
    var count = 1 + rnd(min(4, 1 + sec / 2));
    if (form == 0 && inbar == 0 && sec >= 2) {
        // a ring of them, evenly round: find the space between
        count = min(6, count + 2);
        for (var i = 0; i < count; i++)
            foes.spawn(foes.DRONE, at, base + i * 1.0 / count);
    } else if (form == 1 && sec >= 3) {
        // two on the beat, two on the half beat after
        for (var i = 0; i < 2; i++) {
            foes.spawn(foes.DRONE, at, base + i * 0.08);
            foes.spawn(foes.DRONE, at + beatMs / 2, base + 0.25 + i * 0.08);
        }
    } else {
        // a line side by side
        for (var i = 0; i < count; i++)
            foes.spawn(foes.DRONE, at, base + i * 0.07);
    }
}

// ---- the ship ------------------------------------------------------------------

const AUTOPILOT = false;            // for testing: the ship flies itself

function steer() {
    var turn = STEER_MAX * 33.0 / rate();
    if (AUTOPILOT) {
        var target = autoTarget();
        var d0 = foes.adiff(target, shipA) * 0.45;
        shipA += mid(-turn, d0, turn);
        shipA -= flr(shipA);
        if (frame() % 400 == 399)
            useBomb();
        return;
    }
    if (opt.get(OPT.steering) == 0) {
        var p = wheelpos();
        if (p >= 0) {
            var target = 0.25 - p / 96.0;
            var d = foes.adiff(target, shipA) * 0.45;
            shipA += mid(-turn, d, turn);
        }
    } else {
        shipA -= wheel() / 96.0;
        if (btn(0))
            shipA += turn * 0.6;
        if (btn(1))
            shipA -= turn * 0.6;
    }
    shipA -= flr(shipA);
}

// Testing: the gap of the nearest gate, else the lane of the nearest enemy,
// else away from the nearest spark
function autoTarget() {
    var best0 = 99.0, target = shipA;
    for (var i = 0; i < foes.top; i++) {
        var k = foes.kind[i];
        if (k == 0 || foes.done[i] != 0)
            continue;
        var d = foes.dep[i];
        if (k == foes.GATE && d < 2.5)
            return foes.ang[i];
        if (k == foes.SPARK && d < 1.5 && abs(foes.adiff(foes.cur[i], shipA)) < 0.06)
            return shipA + 0.12;
        if ((k <= foes.HEAVY || k == foes.POWER) && d < best0 && d > 0.6) {
            best0 = d;
            target = foes.cur[i];
        }
    }
    return target;
}

function drawShip() {
    if (state == ST_PLAY && gt < invulnUntil && (frame() & 2) != 0)
        return;
    tube.project(shipA, 0.0, 0.76);
    var tx = tube.px, ty = tube.py;
    tube.project(shipA, 0.0, 0.89);
    var nx = tube.px, ny = tube.py;
    tube.project(shipA + 0.03, 0.0, 0.96);
    var lx = tube.px, ly = tube.py;
    tube.project(shipA - 0.03, 0.0, 0.96);
    trifill(tx, ty, lx, ly, nx, ny, 7);
    trifill(tx, ty, tube.px, tube.py, nx, ny, 6);
    line(tx, ty, lx, ly, tube.ACCENT);
    line(tx, ty, tube.px, tube.py, tube.ACCENT);
}

// A faint line down the ship's lane, to judge what is coming at it
function laneLine() {
    if (state != ST_PLAY)
        return;
    tube.project(shipA, 0.4, 0.9);
    var x = tube.px, y = tube.py;
    tube.project(shipA, tube.VIEW, 0.9);
    line(x, y, tube.px, tube.py, tube.LANE);
}

// ---- the run -------------------------------------------------------------------

function startRun() {
    foes.clear();
    shots.clear();
    var lv = opt.get(OPT.level);
    shields = lv == 0 ? 4 : 3;
    bombs = 2;
    power = 1;
    points = 0;
    streak = 0;
    mult = 1;
    sector = 1;
    gatesPassed = 0;
    hitThisSector = false;
    runBeat0 = curBeat;
    planned = curBeat + tube.VIEW;
    spawnFrom = planned + 2;
    pickupNext = spawnFrom + 20;
    gateAt = -100;
    gateCentre = rnd(1.0);
    invulnUntil = 0;
    alive = true;
    state = ST_PLAY;
    slowed = false;
    setrate(listening ? 25 : 33);
    announce("GET READY");
    sfx(SFX.sector);
    if (playback.playing() && !locked && !listening && tries < LISTEN_TRIES)
        startListening();
}

function hurt() {
    if (state != ST_PLAY || gt < invulnUntil)
        return;
    shields--;
    hitThisSector = true;
    streak = 0;
    mult = 1;
    power = max(1, power - 1);
    shake = 8;
    tube.flash(6);
    sfx(SFX.hurt);
    tube.project(shipA, 0.0, 0.9);
    burst(tube.px, tube.py, 18, 7);
    if (shields <= 0) {
        alive = false;
        state = ST_DYING;
        dyingTicks = 50;
        shake = 16;
        burst(tube.px, tube.py, 40, tube.ACCENT);
        burst(tube.px, tube.py, 30, 9);
        sfx(SFX.bigboom);
        return;
    }
    invulnUntil = gt + beatMs * 3;
}

// Points for something shot down
function killed(k) {
    var v = k == foes.HEAVY ? 400 : k == foes.SPIRAL ? 150 : k == foes.SPARK ? 25 : 100;
    if (k != foes.SPARK) {
        streak++;
        mult = min(8, 1 + streak / 10);
    }
    points += v * mult;
}

function gatePassed(i) {
    gatesPassed++;
    points += 250 * mult;
    sfx(SFX.gate);
    announce("+" + 250 * mult);
    if (gatesPassed >= 16)
        ach.earn(ACH.needle);
}

function collect(k) {
    sfx(SFX.pickup);
    if (k == foes.POWER) {
        if (power < MAX_POWER) {
            power++;
            announce(power == 2 ? "TWIN GUNS" : "TRIPLE GUNS");
            return;
        }
    } else if (bombs < MAX_BOMBS) {
        bombs++;
        announce("+1 BOMB");
        return;
    }
    points += 500 * mult;
    announce("+" + 500 * mult);
}

function useBomb() {
    if (bombs <= 0)
        return;
    bombs--;
    tube.flash(12);
    shake = 10;
    sfx(SFX.bomb);
    foes.bombAll();
}

function burst(x, y, n, c) {
    particles.emit(fxp, n, x, y, 0.0, 0.0, 1.6, 16, c);
}

function gameOver() {
    state = ST_OVER;
    overTicks = 0;
    rank = score.submit(BOARD.points, points);
    best = score.best(BOARD.points) || 0;
    shots.clear();
}

// Run at 25 a second when the iPod keeps falling behind. Listening runs at
// 25 anyway, and its late frames don't count.
function pace() {
    var sk = skipped();
    if (!listening)
        late += sk;
    if (frame() % 33 == 0) {
        if (late > 4 && rate() > 25) {
            setrate(25);
            slowed = true;
        }
        late = 0;
    }
}

// ---- the screens ---------------------------------------------------------------

function announce(text) {
    msg = text;
    msgUntil = gt + 1600;
}

// The title: the tunnel runs to the music; the wheel is the volume
function titleUpdate() {
    shipA = 0.75 + sin((gt % 7000) / 7000.0) * 0.05;
    wheelVolume();
    if (btnp(4))
        startRun();
}

function overUpdate() {
    overTicks++;
    wheelVolume();
    if (overTicks > 30 && btnp(4))
        startRun();
}

function wheelVolume() {
    var w = wheel();
    if (w != 0) {
        volShown = playback.adjust(w);
        volUntil = gt + 1500;
    }
}
