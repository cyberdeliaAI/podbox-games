// Outpost Echo: five short expeditions through an abandoned station.
// main owns scenes and progression; mission and physics remain independent
// of drawing. All writing is local to this cart's own save identity.
const TITLE = 0, EXPLORE = 1, HELP = 2, LOG = 3, CLEAR = 4, DOWN = 5, VICTORY = 6;
var scene = TITLE, sector = 0, selection = 0;
var holdWalk = false, stats = false, sounds = true;
var sensitivity = 3, difficulty = 1;
var decoder = false;
var message = "", messageUntil = 0;
var titleHeld = false, playHeld = false;
var late = 0, paceTicks = 0;
var elapsedMs = 0, runPoints = 0, levelPoints = 0, beforeLevel = 0;
var endWait = 0;
var logLines = [""];
var menuRows = ["CONTINUE", "NEW EXPEDITION", "SECTOR SELECT", "FIELD MANUAL", "RECORDS"];

// Load immutable data and the player before opening the title screen.
function init() {
    station.load(0);
    player.init();
    robots.load(station.plan.robots);
    view.init();
    saves.init();
    menuitem(1, "Save and main menu", toTitle);
    menuitem(2, "Restart sector", restart);
    scene = TITLE;
}

// Settings are refreshed by the native pause menu and tool selection.
function readOptions() {
    holdWalk = opt.get(OPT.controls) == 1;
    sensitivity = opt.get(OPT.sensitivity);
    stats = opt.get(OPT.stats) == 1;
    sounds = opt.get(OPT.sounds) == 1;
    difficulty = opt.get(OPT.difficulty);
    tools.equipped = opt.get(OPT.tool);
    player.stop();
}

// All sound effects are original short tones and respect the sound option.
function sound(hz, ticks) {
    if (sounds)
        tone(0, hz, ticks, 48, WAVE.TRIANGLE);
}

// Preserve progress before returning to the in-game menu.
function toTitle() {
    if (scene == EXPLORE || scene == LOG)
        saves.checkpoint();
    player.stop();
    scene = TITLE;
    selection = 0;
    titleHeld = btn(4);
}

// Restart keeps completed-sector points, never partial-sector points.
function restart() {
    runPoints = beforeLevel;
    startLevel(sector);
}

// Start a clean expedition while retaining unlocked sectors and records.
function startGame() {
    runPoints = 0;
    decoder = false;
    startLevel(0);
}

// Load fresh mission state. Later unlocked sectors include their decoder.
function startLevel(n, restoring) {
    sector = n;
    if (n >= 2)
        decoder = true;
    station.load(n);
    player.reset();
    robots.load(station.plan.robots);
    station.visit(player.cx(), player.cy());
    elapsedMs = 0;
    beforeLevel = runPoints;
    scene = EXPLORE;
    setrate(25);
    late = 0;
    paceTicks = 0;
    tools.scan = 0.0;
    if (!restoring)
        saves.checkpoint();
    openLog(station.plan.intro);
}

// Show a brief status line without allocating strings while drawing.
function announce(s) {
    message = s;
    messageUntil = frame() + rate() * 3;
}

// Logs suspend movement and mission time until the player closes them.
function openLog(lines) {
    player.stop();
    logLines = lines;
    scene = LOG;
    titleHeld = btn(4);
    playHeld = btn(3);
}

// Complete a sector once and keep its record before changing the scene.
function finishLevel() {
    if (scene != EXPLORE)
        return;
    player.stop();
    levelPoints = 1500 + station.collected * 100 + station.secrets * 500 + max(0, 900 - elapsedMs / 1000) * 2;
    if (robots.damage == 0) {
        levelPoints += 500;
        ach.earn(ACH.quiet);
    }
    runPoints += levelPoints;
    score.submit(BOARD.sectors, levelPoints, "SECTOR " + (sector + 1));
    if (sector == 0)
        ach.earn(ACH.arrival);
    saves.unlocked = max(saves.unlocked, min(5, sector + 2));
    dset(0, saves.unlocked);
    if (levelPoints > dget(10 + sector))
        dset(10 + sector, levelPoints);
    endWait = 0;
    scene = sector == 4 ? VICTORY : CLEAR;
    if (scene == VICTORY) {
        score.submit(BOARD.expedition, runPoints);
        ach.earn(ACH.signal);
        dset(1, 1);
    }
    saves.checkpoint();
    sound(880, 8);
}

// Damage ends this attempt, leaving the last useful checkpoint intact.
function failRun() {
    if (scene != EXPLORE)
        return;
    player.stop();
    scene = DOWN;
    endWait = 0;
    sound(90, 8);
}

// Native dialogs are used only for sector selection and the score table.
function chooseTitle() {
    if (selection == 0) {
        if (!saves.resume())
            startGame();
    } else if (selection == 1) {
        startGame();
    } else if (selection == 2) {
        var names = [];
        for (var i = 0; i < saves.unlocked; i++)
            names.push(station.plans[i].name);
        var picked = ui.choose("Choose sector", names);
        if (picked >= 0) {
            runPoints = 0;
            decoder = picked >= 2;
            startLevel(picked);
        }
    } else if (selection == 3) {
        scene = HELP;
    } else {
        score.show(BOARD.expedition);
    }
}

// Fixed simulation rates use exact milliseconds and scale every speed.
function update() {
    saves.wrote = false;
    if (opt.changed())
        readOptions();
    if (resumed())
        player.stop();
    var select = btn(4) && !titleHeld;
    var play = btn(3) && !playHeld;
    titleHeld = btn(4);
    playHeld = btn(3);
    if (scene == TITLE) {
        var move = wheelsteps() + (btnp(1) ? 1 : 0) - (btnp(0) ? 1 : 0);
        selection = (selection + move % 5 + 5) % 5;
        if (select)
            chooseTitle();
        return;
    }
    if (scene == HELP || scene == LOG) {
        if (select || play) {
            scene = scene == HELP ? TITLE : EXPLORE;
            player.stop();
        }
        return;
    }
    if (scene == CLEAR || scene == DOWN || scene == VICTORY) {
        endWait++;
        if (endWait > 12 && select) {
            if (scene == CLEAR)
                startLevel(sector + 1);
            else if (scene == DOWN)
                restart();
            else
                toTitle();
        }
        if (play)
            toTitle();
        return;
    }
    var k = 25.0 / rate();
    elapsedMs += rate() == 25 ? 40 : 50;
    if (tools.scan > 0.0)
        tools.scan = max(0.0, tools.scan - k);
    doors.update(k);
    player.update(k);
    if (scene != EXPLORE)
        return;
    station.update();
    robots.update(k);
    late += skipped();
    if (++paceTicks >= rate()) {
        if (late > 3 && rate() > 20)
            setrate(20);
        paceTicks = 0;
        late = 0;
    }
}

// Overlay scenes use a cheap static frame, leaving startup work headroom.
function draw() {
    if (scene == EXPLORE) {
        if (!saves.wrote)
            view.draw();
        hud.draw();
    } else {
        cls(32);
        hud.panel();
    }
    view.spent = unitsnow();
}

// A saved suspension should never carry latched walking into the next play.
function ending() {
    if (scene == EXPLORE || scene == LOG)
        saves.checkpoint();
    player.stop();
}
