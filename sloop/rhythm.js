// rhythm: the clock the blocks fly by, and the beats on it.
//
// With music playing it listens for the tempo when a track starts, and
// stops as soon as it has it: the tracker costs some 6,300 units a tick
// while it listens, so the game drops to 25 ticks a second meanwhile. From
// then on the beats are the tracker's predictions (beat.next), which cost
// next to nothing, and the clock is the track's (beat.clock). A track whose
// beat isn't found within LISTEN_MS, no music at all, or the Beat option
// off, and the game plays to its own metronome instead: FREE_BPM, a little
// faster each round. Then the clock is the game's own, counted in ticks. A
// track that wasn't found gets one more try, RETRY_MS later, while the
// metronome plays on.
//
// When the clock changes from one to the other (a tempo found late, the
// music paused), shift() tells blocks.js how far it jumped, so whatever is
// in the air keeps its place and arrives when it would have.
//
// A fast tempo (beats shorter than FAST_MS) is halved: blocks come on every
// other beat, which keeps the game playable on drum and bass.

const LISTEN_MS = 10000;           // how long a try listens before the metronome takes over
const RETRY_MS = 20000;            // ...and how long before the second try
const TRIES = 2;                   // tries a track gets
const NEW_TRACK = 1, SEEK = 2;     // what update() reports
const SURE = 60;                   // the tracker's confidence to take its tempo at
const FREE_BPM = 100;              // the metronome's tempo in the first round
const FREE_STEP = 6;               // ...and how much faster each round after
const FREE_MAX = 136;
const FAST_MS = 380;               // beats shorter than this are taken two at a time

var on = true;                     // the Beat option
var listening = false;
var locked = false;                // the beats come from the track playing now
var listenFrom = 0;                // the game clock when this try began
var tries = 0;
var retryAt = -1;                  // the game clock when to try again; -1 for never
var trackId = -2;
var st = new Int32Array(6);
var moodBuf = new Int32Array(3);
var period = 600;                  // ms a beat, as the blocks see it (two beats when fast)
var bpm = FREE_BPM;
var step = 1;                      // the tracker's beats a block beat: 2 when fast
var energy = 50, flux = 50;        // the last bar's mood, 0 to 100
var news = 0;                      // for main.js to say: 1 tempo found, 2 no beat, 3 new track

// the game's own clock and metronome
var own = 0;                       // ms, counted in ticks
var ownLeft = 0;                   // the part of a ms carried from tick to tick, in thousandths
var anchor = 0;                    // a beat of the metronome falls here, and every period on
var freeBpm = FREE_BPM;
var wasLocked = false;

// The clock the blocks fly by, ms
function now() {
    return locked ? beat.clock() : own;
}

// A new game: the metronome at its first tempo; update() starts listening
// if music plays
function reset() {
    if (listening)
        stop();
    freeBpm = FREE_BPM;
    locked = false;
    setFree();
    trackId = -2;
    retryAt = -1;
    wasLocked = false;
    news = 0;
}

// A new round of the metronome: a little faster
function faster() {
    freeBpm = min(FREE_MAX, freeBpm + FREE_STEP);
    if (!locked)
        setFree();
}

// The metronome's tempo, its beats from now
function setFree() {
    period = 60000 / freeBpm;
    bpm = freeBpm;
    step = 1;
    anchor = own;
}

// Once a tick, first. Returns NEW_TRACK when another track has started,
// SEEK when the music jumped within one, else 0: main.js ends the round or
// clears the air.
function update() {
    // the game's own clock goes on whatever the music does
    ownLeft += 1000000 / rate();
    own += ownLeft / 1000;
    ownLeft %= 1000;

    var change = 0;
    if (!on || !playback.playing()) {
        if (listening)
            stop();
        if (locked)
            unlock();
        trackId = -2;
        retryAt = -1;
        return 0;
    }
    var id = playback.track();
    if (id != trackId) {
        if (trackId != -2)
            change = NEW_TRACK;
        trackId = id;
        if (locked)
            unlock();
        tries = 0;
        listen();
    } else if (beat.jumped() && locked) {
        change = SEEK;
        unlock();
        tries = 0;
        listen();
    }

    if (listening) {
        if (beat.state(st) && st[3] >= SURE && beat.downbeat() >= 0) {
            stop();
            lock();
        } else if (own - listenFrom > LISTEN_MS) {
            stop();
            news = 2;              // no beat: the metronome carries on
            retryAt = tries < TRIES ? own + RETRY_MS : -1;
        }
    } else if (!locked && retryAt >= 0 && own >= retryAt) {
        listen();
    }
    if (locked && (frame() & 7) == 0) {
        beat.mood(moodBuf);
        energy = moodBuf[0];
        flux = moodBuf[1];
    }
    return change;
}

// Listening for the tempo, at 25 ticks a second meanwhile
function listen() {
    beat.listen(true);
    listening = true;
    listenFrom = own;
    tries++;
    retryAt = -1;
    if (rate() != 25)
        setrate(25);
}

// Listening no more, back to 33 ticks a second
function stop() {
    beat.listen(false);
    listening = false;
    if (rate() != 33)
        setrate(33);
}

// The tracker has the tempo: its clock and beats from now on
function lock() {
    var before = own;
    locked = true;
    var p = st[2];
    step = p < FAST_MS ? 2 : 1;
    period = p * step;
    bpm = st[1];
    news = 1;
    blocks.shift(beat.clock() - before);
    wasLocked = true;
}

// Back to the metronome, at the tempo the music had, from where the
// music's clock was
function unlock() {
    var before = beat.clock();
    locked = false;
    period = 60000 / freeBpm;
    bpm = freeBpm;
    step = 1;
    anchor = own;
    blocks.shift(own - before);
}

var place = 0;                     // the place in its bar of the beat next() last gave

// The time of the nth block beat at or after from, and its place in the
// bar (0 the bar's first) in place; -1 with no beat
function next(from, n) {
    if (locked) {
        var b = beat.next(from, n * step);
        if (b < 0)
            return -1;
        place = beat.inbar();
        if (step == 2)
            place = place / 2 * 2;   // on halved beats the bar's first still counts
        return b;
    }
    // the metronome: whole beats from the anchor
    var k = (from - anchor + period - 1) / period + n;
    if (from < anchor)
        k = n;
    place = k % 4;
    return anchor + k * period;
}

// How far from the last beat to the next, 0 to 1
function phase() {
    var t = now();
    var nb = next(t, 0);
    if (nb < 0)
        return 0.0;
    return mid(0.0, 1.0 - (nb - t) / (period * 1.0), 1.0);
}
