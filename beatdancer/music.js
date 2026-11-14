// music: short listening windows, predicted beats and a silent fallback.
// The unwrapped beat count and fractional phase drive both dance and light.
const TRY_MS = 10000, RETRY_MS = 20000, MAX_TRIES = 2;
var enabled = true, freeBpm = 112;
var listening = false, locked = false, playing = false;
var bpm = 112, period = 535, confidence = 0;
var phase = 0.0, count = 0, pulse = 0.0, energy = 0.5;
var own = 0, remainder = 0, listenFrom = 0, retryAt = 0, tries = 0;
var trackId = -2, lastPhase = -1.0;
var state = new Int32Array(6), bands = new Int32Array(3);

// One button can ask for a new attempt, without changing the music.
function retry() {
    beat.listen(false);
    listening = false; locked = false; trackId = -2;
    tries = 0; retryAt = 0; lastPhase = -1.0;
}

// Stop the costly listener once a prediction is available.
function stop() { beat.listen(false); listening = false; }

// Start a bounded attempt. The cart's fixed 25 Hz leaves room for analysis.
function listen() {
    beat.listen(true); listening = true; listenFrom = own; tries++;
}

// Advance from the music clock, not a frame counter, once the tempo locks.
function update() {
    remainder += 1000000 / rate(); own += remainder / 1000; remainder %= 1000;
    playing = playback.playing();
    var active = playing && enabled;
    if (!active) {
        if (listening) stop();
        locked = false; trackId = -2; tries = 0; retryAt = 0;
    } else {
        var id = playback.track();
        if (id != trackId || beat.jumped()) {
            if (listening) stop();
            locked = false; trackId = id; tries = 0; retryAt = own;
            lastPhase = -1.0;
        }
        if (!locked && !listening && tries < MAX_TRIES && own >= retryAt) listen();
        if (listening) {
            if (beat.state(state) && state[3] >= 55 && state[2] >= 200 && state[2] <= 1500) {
                bpm = state[1]; period = state[2]; confidence = state[3];
                locked = true; stop(); lastPhase = -1.0;
            } else if (own - listenFrom >= TRY_MS) {
                stop(); retryAt = own + RETRY_MS;
            }
        }
    }
    if (locked) {
        var now = beat.clock(), nextBeat = beat.next(now, 0);
        if (nextBeat >= 0) {
            var p = mid(0.0, 1.0 - (nextBeat - now) / (period * 1.0), 1.0);
            if (p >= 1.0) p = 0.0;
            if (lastPhase >= 0.0 && p < lastPhase - 0.5) count++;
            phase = p; lastPhase = p;
        } else { locked = false; retryAt = own; }
    }
    if (!locked) {
        bpm = freeBpm; period = 60000 / bpm; confidence = 0;
        phase += 1000.0 / rate() / period;
        if (phase >= 1.0) { phase -= 1.0; count++; }
    }
    // A soft envelope, with no full-screen flash. Quiet tracks still move.
    pulse = max(0.0, 1.0 - phase * 3.0);
    if ((frame() & 7) == 0) {
        if (playing) {
            playback.bands(bands, 3);
            energy += (mid(0.25, (bands[0] + bands[1]) / 160.0, 1.0) - energy) * 0.25;
        } else energy += (0.5 - energy) * 0.25;
    }
}
