// rhythm: the music's beat.
//
// When a track starts it listens for the tempo, and stops as soon as it
// has it: the tracker costs some 6,300 units a tick while it listens.
// From then on it reads the beats the tracker predicts, every tick, which
// costs next to nothing. A track whose beat it can't find (a quiet intro,
// a spoken track) gets three tries a few seconds apart. With no music, no
// beat or the Beat option off, the game plays without one: the ceiling
// then comes down by shots instead of bars.

const WINDOW = 110;                // ms either side of a beat that a shot counts as on it
const SURE = 60;                   // the tracker's confidence to take its tempo at
const LISTEN_S = 12.0;             // seconds a try listens
const RETRY_S = 8.0;               // seconds between tries
const TRIES = 3;                   // tries a track gets

var on = true;                     // the Beat option
var listening = false;
var locked = false;                // the beats come from the track playing now
var tries = 0;
var since = 0.0;                   // when this try began, in t()
var retryAt = -1.0;                // when to try again, in t(); -1 for never
var trackId = -2;
var st = new Int32Array(6);
var moodBuf = new Int32Array(3);
var period = 500;                  // ms a beat
var bpm = 0;
var nextAt = -1;                   // when the coming beat falls, track ms
var place = 0;                     // its place in the bar, 0 the bar's first
var hit = false;                   // a beat went by this tick
var down = false;                  // ...and it began a bar
var energy = 50;                   // the last bar's, 0 to 100
var news = 0;                      // for main.js to say: 1 tempo found, 2 no beat yet, 3 no beat found

// Once a tick, first
function update() {
    hit = false;
    down = false;
    if (!on || !playback.playing()) {
        if (listening)
            stop();
        locked = false;
        trackId = -2;
        return;
    }
    var id = playback.track();
    if (id != trackId) {
        trackId = id;
        locked = false;
        tries = 0;
        listen();
    } else if (beat.jumped()) {
        nextAt = -1;               // a seek: read the beats afresh
    }

    if (listening) {
        if (beat.state(st) && st[3] >= SURE) {
            stop();
            locked = true;
            period = st[2];
            bpm = st[1];
            news = 1;
        } else if (t() - since > LISTEN_S) {
            stop();
            if (tries < TRIES) {
                retryAt = t() + RETRY_S;
                news = 2;
            } else {
                news = 3;
            }
        }
        return;
    }
    if (!locked) {
        if (retryAt >= 0.0 && t() >= retryAt)
            listen();
        return;
    }

    // follow the beats the tracker predicts
    var now = beat.clock();
    var nb = beat.next(now, 0);
    if (nb < 0) {
        locked = false;
        return;
    }
    var pl = beat.inbar();
    if (nextAt >= 0 && nb > nextAt + period / 2) {
        hit = true;
        down = place == 0;
        if (down) {
            beat.mood(moodBuf);
            energy = moodBuf[0];
        }
    }
    nextAt = nb;
    place = pl;
}

function listen() {
    beat.listen(true);
    listening = true;
    tries++;
    since = t();
    retryAt = -1.0;
    nextAt = -1;
}

function stop() {
    beat.listen(false);
    listening = false;
}

// How far from the last beat to the next, 0 to 1; 0 without a beat
function phase() {
    if (!locked || nextAt < 0)
        return 0.0;
    var left = nextAt - beat.clock();
    return mid(0.0, 1.0 - left / (period * 1.0), 1.0);
}

// A shot fired at track time p: 3 on a bar's first beat, 2 on any other,
// 1 off the beat or with no beat at all
function judge(p) {
    if (!locked || p < 0)
        return 1;
    var b = beat.next(p - period / 2, 0);
    if (b < 0 || abs(p - b) > WINDOW)
        return 1;
    return beat.inbar() == 0 ? 3 : 2;
}
