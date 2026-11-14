// title: the start screen, how to play, and the way to the top scores.
// update() returns the level to start a game at, 0 for none.

const MENU = 0, HELP = 1;

var page = MENU;
var sel = 0;
var rowsN = 0;
var labels = ["", "", "", ""];
var kinds = new Int32Array(4);     // each row: 1 new game, 2 continue, 3 how to play, 4 top scores
var bob = [2, 5, 3, 7, 1, 6, 4, 8];

// Back to the menu, its rows made afresh
function enter() {
    page = MENU;
    sel = 0;
    rowsN = 0;
    addRow("NEW GAME", 1);
    if (reached > 1)
        addRow("CONTINUE LEVEL " + reached, 2);
    addRow("HOW TO PLAY", 3);
    addRow("TOP SCORES", 4);
}

function addRow(label, kind) {
    labels[rowsN] = label;
    kinds[rowsN] = kind;
    rowsN++;
}

function update() {
    var steps = wheelsteps();
    if (btnp(0))
        steps--;
    if (btnp(1))
        steps++;
    var ok = btnp(4), back = btnp(3);
    if (page == HELP) {
        if (ok || back) {
            page = MENU;
            sfx(SFX.tick);
        }
        return 0;
    }
    if (steps != 0) {
        sel = ((sel + steps) % rowsN + rowsN) % rowsN;
        click();
    }
    if (ok) {
        sfx(SFX.tick);
        var k = kinds[sel];
        if (k == 1)
            return 1;
        if (k == 2)
            return reached;
        if (k == 3)
            page = HELP;
        else
            score.show(BOARD.points);
    }
    return 0;
}

// ---- drawing -------------------------------------------------------------------

function draw() {
    if (page == HELP) {
        drawHelp();
        return;
    }
    palt(0, false);
    blit(IMG.back, 0, 0);
    palt(0, true);

    font(FONT.CAPS, 2);
    shadow("BUBBLE", 80, 8, 12);
    shadow("BEAT", 80, 24, 14);
    font(FONT.CAPS);

    // a row of bubbles that hop on the beat
    var hop = rhythm.locked ? flr((1.0 - rhythm.phase()) * 3.0) : 0;
    for (var i = 0; i < 8; i++) {
        var lift = rhythm.locked && ((i & 1) == (rhythm.place & 1)) ? hop : 0;
        spr((marks ? 9 : 1) + bob[i] - 1, 45 + i * 9, 42 - lift);
    }

    for (var i = 0; i < rowsN; i++) {
        var y = 58 + i * 10;
        if (i == sel) {
            rectfill(board.FX + 4, y - 2, board.FX + 91, y + 6, 1);
            centre(labels[i], y, 10);
            print(">", board.FX + 8, y, 10);
            print("<", board.FX + 84, y, 10);
        } else {
            centre(labels[i], y, 6);
        }
    }

    var s;
    if (!rhythm.on)
        s = "BEAT BONUS OFF";
    else if (!playback.playing())
        s = "PLAY MUSIC FOR THE BEAT";
    else if (rhythm.listening)
        s = (frame() & 8) != 0 ? "LISTENING..." : "";
    else if (rhythm.locked)
        s = rhythm.bpm + " BPM";
    else
        s = "NO BEAT: THE SHOTS DROP IT";
    centre(s, 104, 13);
    centre("SELECT: OK", 112, 5);
    print("V0.1", 3, 3, 5);
}

function drawHelp() {
    rectfill(0, 0, 159, 119, 1);
    centre("HOW TO PLAY", 3, 10);
    var lines = ["TURN THE WHEEL TO AIM, SELECT TO",
                 "SHOOT, PLAY TO SWAP YOUR BUBBLES.",
                 "THREE OR MORE OF A COLOUR POP,",
                 "AND ALL THEY HELD UP FALLS TOO.",
                 "",
                 "SHOOT ON THE BEAT OF YOUR MUSIC:",
                 "THE POP COUNTS DOUBLE, AND TRIPLE",
                 "ON THE FIRST BEAT OF A BAR.",
                 "",
                 "THE CEILING COMES DOWN WITH THE",
                 "BARS, OR EVERY FEW SHOTS WITHOUT",
                 "A BEAT. CLEAR THE FIELD BEFORE A",
                 "BUBBLE HANGS BELOW THE LINE."];
    for (var i = 0; i < 13; i++)
        centre(lines[i], 13 + i * 7, i < 4 ? 7 : 6);
    centre("SELECT: BACK", 111, 13);
}
