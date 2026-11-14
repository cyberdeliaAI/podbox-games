// hud: the words and numbers over the tunnel.

function centre(text, y, c) {
    print(text, 80 - textw(text) / 2, y, c);
}

// The track that just started, along the bottom for a few seconds
function trackLine(y) {
    if (gt >= trackUntil || trackText == "")
        return;
    centre(trackText, y, 6);
}

function message() {
    if (gt < msgUntil)
        centre(msg, 44, (frame() & 4) != 0 ? 7 : tube.ACCENT);
}

function volumeLine() {
    if (volShown >= 0 && gt < volUntil)
        centre("VOLUME " + volShown, 102, 7);
}

function play() {
    print("" + points, 2, 2, 7);
    if (mult > 1)
        print("X" + mult, 2, 9, tube.ACCENT);

    // shields, top right
    for (var i = 0; i < shields; i++)
        rectfill(154 - i * 6, 2, 157 - i * 6, 5, 11);

    // bombs, bottom left
    for (var i = 0; i < bombs; i++) {
        circfill(4 + i * 7, 115, 2, 9);
        pset(4 + i * 7, 115, 7);
    }

    // the tempo, bottom right; a blink while it listens for a new one
    var c = listening && (frame() & 8) != 0 ? 5 : 13;
    print(bpmText, 158 - textw(bpmText), 113, c);

    if (state == ST_DYING)
        return;
    message();
    trackLine(112);
}

function title() {
    font(FONT.CAPS, 2);
    centre("PULSE", 26, 7);
    centre("TUNNEL", 40, tube.ACCENT);
    font(FONT.CAPS);

    var status;
    if (!playback.playing())
        status = "NO MUSIC: " + bpm + " BPM";
    else if (listening)
        status = (frame() & 8) != 0 ? "LISTENING..." : "";
    else if (locked)
        status = bpm + " BPM";
    else
        status = "NO BEAT FOUND: " + bpm + " BPM";
    centre(status, 58, 13);

    if ((frame() & 16) != 0)
        centre("PRESS SELECT", 72, 7);
    if (best > 0)
        centre("BEST " + best, 82, 6);
    if (opt.get(OPT.steering) == 0)
        centre("THUMB ON THE WHEEL TO STEER", 92, 13);
    else
        centre("TURN THE WHEEL TO STEER", 92, 13);
    volumeLine();
    trackLine(4);
}

function over() {
    play();
    font(FONT.CAPS, 2);
    centre("GAME OVER", 30, 7);
    font(FONT.CAPS);
    centre("" + points, 50, tube.ACCENT);
    if (rank == 1)
        centre("NEW BEST!", 60, (frame() & 4) != 0 ? 10 : 7);
    else if (rank > 1)
        centre("RANK " + rank, 60, 6);
    else
        centre("BEST " + best, 60, 6);
    centre("SECTOR " + sector + "   GATES " + gatesPassed, 70, 13);
    if (overTicks > 30 && (frame() & 16) != 0)
        centre("PRESS SELECT", 84, 7);
    volumeLine();
}
