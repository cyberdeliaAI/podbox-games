// Pocket Golf Deluxe: 36 authored holes, four modes and low-score records.
// Simulation is fixed at 33 steps/s. Rendering may fall to 25 without
// changing the physical tick sequence or the path of a struck ball.
const TITLE = 0, PLAY = 1, HOLED = 2, CARD = 3, RESULTS = 4, HELP = 5, LOADING = 6;
const QUICK = 0, CHAMP = 1, TOUR = 2, PRACTICE = 3;
var scene = TITLE, mode = QUICK, hole = 0, strokes = 0, total = 0;
var cards = new Int32Array(36);
var sounds = true, stats = false;
var debt = 0, endWait = 0, selection = 0;
var late = 0, paceTicks = 0, bounceCool = 0;
var message = "", messageUntil = 0;
var menuHeld = false, playHeld = false;
var picked = false, previousBest = 0, newRecord = false;
var loadStep = 0;
var rows = ["CONTINUE", "QUICK PLAY", "CHAMPIONSHIP", "FULL TOUR", "PRACTICE", "RECORDS", "HOW TO PLAY"];
var boards = [BOARD.gardens, BOARD.pirate, BOARD.desert, BOARD.winter];

// Read the catalogue once and keep a simple title screen in memory.
function init() {
    course.catalog = data.read(DATA.catalog);
    records.init();
    menuitem(1, "Save and main menu", toTitle);
    menuitem(2, "Restart hole", restart);
    menuitem(3, "Pick up (12 strokes)", pickUp);
}

// Options can be changed without affecting the ball's physics state.
function readOptions() {
    sounds = opt.get(OPT.sounds) == 1;
    stats = opt.get(OPT.stats) == 1;
    putter.precision = opt.get(OPT.precision) == 1;
    putter.guide = opt.get(OPT.guide) == 1;
    putter.cancel();
}

// Original tone effects never touch the owner's music.
function sound(hz, length) {
    if (sounds) tone(0, hz, length, 48, WAVE.TRIANGLE);
}

// Short messages are made on events, not during drawing.
function announce(text) {
    message = text;
    messageUntil = frame() + rate() * 2;
}

// A new round doesn't overwrite records or completed course unlocks.
function start(which, first) {
    records.pending = null;
    mode = which; hole = first; total = 0;
    fill(cards, 0);
    loadHole(first);
}

// Load one plan and two lazy pictures at most.
function loadHole(i) {
    hole = i;
    strokes = 0; picked = false;
    debt = 0; endWait = 0;
    messageUntil = 0;
    loadStep = 0; scene = LOADING;
    setrate(25); late = 0; paceTicks = 0;
}

// A large background can fit the 25 Hz budget on its own. Saving happens
// on a later tick. No ball simulation or shot input runs while loading.
function loading() {
    if (loadStep == 0) course.prepare(hole);
    else if (loadStep == 1) course.loadPicture();
    else if (loadStep == 2) course.loadOverview();
    else {
        ball.reset(); putter.reset(); view.reset();
        scene = PLAY;
        if (records.pending != null) { records.restore(); records.wrote = true; }
        else records.checkpoint();
        setrate(33);
    }
    loadStep++;
}

// A restart is a deliberate fresh attempt, not an extra stroke.
function restart() {
    if (course.current < 0) return;
    records.pending = null;
    if (cards[hole] > 0) total -= cards[hole];
    cards[hole] = 0;
    loadHole(hole);
}

// Picking up is an explicit capped score, never used by the test pilot.
function pickUp() {
    if (scene != PLAY) return;
    picked = true; strokes = max(strokes, 12);
    complete();
}

// Keep the in-flight state too, so Continue doesn't grant a free retry.
function toTitle() {
    if (scene == PLAY || scene == HOLED || scene == CARD) records.checkpoint();
    putter.cancel();
    records.pending = null;
    scene = TITLE; selection = 0;
    menuHeld = btn(4);
}

// A physical release creates exactly one stroke and one save event.
function takeShot(angle, power) {
    if (scene != PLAY || !ball.fire(angle, power)) return;
    strokes++;
    sound(620, 2);
    records.checkpoint();
}

// Record a hole once. Practice never affects persistent records.
function complete() {
    if (scene != PLAY) return;
    ball.cup = true; ball.moving = false;
    ball.vx = 0.0; ball.vy = 0.0;
    cards[hole] = max(1, strokes);
    strokes = cards[hole];
    total += strokes;
    previousBest = flr(dget(10 + hole));
    newRecord = mode != PRACTICE && (previousBest == 0 || strokes < previousBest);
    if (mode != PRACTICE) {
        if (newRecord) dset(10 + hole, strokes);
        dset(1, flr(dget(1)) + 1);
        if (strokes == 1 && !picked) {
            dset(2, flr(dget(2)) + 1);
            ach.earn(ACH.ace);
        }
    }
    scene = HOLED; endWait = 0;
    sound(strokes == 1 ? 1100 : 880, 6);
    records.checkpoint();
}

// Finish a championship scorecard before allowing the next course.
function finishCourse() {
    var c = hole / 9, sum = 0, par = 0;
    for (var i = c * 9; i < c * 9 + 9; i++) {
        sum += cards[i]; par += course.catalog[i].par;
    }
    if (mode != PRACTICE && mode != QUICK) {
        var best = flr(dget(50 + c));
        previousBest = best;
        newRecord = best == 0 || sum < best;
        if (newRecord) dset(50 + c, sum);
        score.submit(boards[c], sum);
        records.unlocked = max(records.unlocked, min(4, c + 2));
        dset(0, records.unlocked);
        ach.earn(ACH.course);
        if (sum <= par) ach.earn(ACH.par);
    }
    scene = CARD; endWait = 0;
    records.checkpoint();
    sound(990, 8);
}

// Advance modes without mixing practice and championship records.
function next() {
    if (mode == PRACTICE) {
        total -= cards[hole]; cards[hole] = 0; loadHole(hole);
    } else if (mode == QUICK) {
        toTitle();
    } else if ((hole + 1) % 9 == 0) {
        finishCourse();
    } else {
        loadHole(hole + 1);
    }
}

// Explicit menu choices are the only places that create temporary lists.
function choose() {
    if (selection == 0) {
        if (!records.resume()) start(QUICK, 0);
    } else if (selection == 3) {
        start(TOUR, 0);
    } else if (selection == 5) {
        var b = ui.choose("Low score records", ["Sunny Gardens", "Pirate Cove", "Desert Adventure", "Winter Wonderland", "Full Tour", "Career stats"]);
        if (b == 5) ui.message("HOLES PLAYED: " + flr(dget(1)) + "\nHOLES IN ONE: " + flr(dget(2)) + "\nCOURSES OPEN: " + records.unlocked + "/4", "CAREER STATS");
        else if (b >= 0) score.show(b == 4 ? BOARD.tour : boards[b]);
    } else if (selection == 6) {
        scene = HELP;
    } else {
        var list = [];
        for (var i = 0; i < records.unlocked; i++) list.push(course.names[i]);
        var c = ui.choose("Choose course", list);
        if (c < 0) return;
        var first = c * 9;
        var selectedMode = selection == 2 ? CHAMP : selection == 4 ? PRACTICE : QUICK;
        if (selectedMode != CHAMP) {
            var holes = [];
            for (var i = first; i < first + 9; i++) holes.push((i % 9 + 1) + ": " + course.catalog[i].name);
            var chosen = ui.choose("Choose hole", holes);
            if (chosen < 0) return;
            first += chosen;
        }
        start(selectedMode, first);
    }
}

// Charge and physics run separately, so a slow draw never changes a roll.
function tickGame() {
    if (opt.changed()) readOptions();
    if (resumed()) putter.cancel();
    var select = btn(4) && !menuHeld, play = btn(3) && !playHeld;
    menuHeld = btn(4); playHeld = btn(3);
    if (scene == LOADING) {
        loading();
    } else if (scene == TITLE) {
        var move = wheelsteps() + (btnp(1) ? 1 : 0) - (btnp(0) ? 1 : 0);
        selection = (selection + move % 7 + 7) % 7;
        if (select) choose();
    } else if (scene == HELP) {
        if (select || play) toTitle();
    } else if (scene == HOLED) {
        endWait++;
        if (endWait > 20 && select) next();
    } else if (scene == CARD) {
        endWait++;
        if (endWait > 12 && select) {
            if (mode == TOUR && hole < 35) loadHole(hole + 1);
            else {
                if (mode == TOUR) {
                    var best = flr(dget(3));
                    if (best == 0 || total < best) dset(3, total);
                    score.submit(BOARD.tour, total);
                    ach.earn(ACH.tour);
                }
                scene = RESULTS;
                records.checkpoint();
            }
        }
    } else if (scene == RESULTS) {
        if (select || play) toTitle();
    } else {
        putter.update();
        debt += 33;
        while (debt >= rate() && scene == PLAY) {
            debt -= rate();
            geometry.clock++; geometry.update();
            ball.step();
            if (ball.event == 1) {
                strokes++; ball.event = 0;
                announce("WATER / +1 PENALTY"); sound(130, 5);
                records.checkpoint();
            } else if (ball.event == 2) {
                ball.event = 0; complete();
            }
            if (ball.bump != 0 && bounceCool == 0) { sound(330, 1); bounceCool = 4; }
            if (bounceCool > 0) bounceCool--;
        }
        view.update();
        late += skipped();
        if (++paceTicks >= rate()) {
            if (late > 4 && rate() > 25) setrate(25);
            paceTicks = 0; late = 0;
        }
    }
}

// Coalesce event saves after the physical result of this tick is known.
function update() {
    records.wrote = false;
    tickGame();
    records.flush();
}

// Heavy loading/saving events use a cheap frame instead of doubling work.
function draw() {
    if (records.wrote) return;
    if ((scene == PLAY || scene == HOLED) && course.current >= 0) {
        view.draw();
        hud.draw();
        if (scene == HOLED) hud.holeResult();
    } else {
        cls(1); hud.panel();
    }
    view.spent = unitsnow();
}

// Preserve the exact physical phase and never save a partly charged shot.
function ending() {
    if (scene == PLAY || scene == HOLED || scene == CARD) records.checkpoint();
    records.flush();
    putter.cancel();
}
