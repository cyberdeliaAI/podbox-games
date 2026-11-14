// hud: a small mission HUD and legible pages for logs and results. All
// text fits the native 160x120 screen with the engine's CAPS font.
var compass = ["E", "N", "W", "S"];

// Centre short ASCII labels.
function centre(s, y, c) {
    print(s, 80 - textw(s) / 2, y, c);
}

// Energy, equipment, current objective and a local scanner map.
function draw() {
    rectfill(0, 0, 159, 10, 32);
    rectfill(0, 101, 159, 119, 32);
    var name = station.current >= 0 ? station.names[station.current] : "LINK CORRIDOR";
    print(name, 3, 3, 7);
    print("S" + (sector + 1), 146, 3, 12);
    print("E " + player.energy, 3, 104, player.energy < 30 ? 8 : 11);
    centre(tools.labels[tools.equipped], 104, 12);
    print("P " + player.charge, 138, 104, 10);
    print(station.card ? "PASS" : "----", 3, 113, station.card ? 10 : 5);
    centre(station.objective(), 113, 6);
    if (tools.scan > 0.0) {
        palt(0, false);
        blit(view.mapImages[sector], 91, 15);
        palt(0, true);
        for (var i = 0; i < tools.marks; i++)
            pset(91 + tools.mx[i], 15 + tools.my[i], tools.ink[i]);
        pset(91 + player.cx() / 8, 15 + player.cy() / 8, 11);
        rect(90, 14, 139, 53, 12);
    }
    if (frame() < messageUntil) {
        rectfill(1, 87, 158, 98, 32);
        centre(message, 91, 12);
    }
    if (stats) {
        rectfill(17, 13, 85, 27, 32);
        print(rate() + "/S " + view.spent + " U", 19, 15, view.spent > (rate() == 25 ? 17500 : 22800) ? 8 : 11);
        print("VIDEO / FLAC", 19, 23, 13);
    }
    if (saves.failed)
        print("SAVE UNAVAILABLE", 3, 79, 8);
}

// A common frame makes terminal and menu pages cheap to draw.
function box(title) {
    rect(3, 3, 156, 116, 18);
    print("ECHO // " + title, 9, 9, 12);
    line(9, 19, 150, 19, 17);
}

// Choose a scene without drawing the 3D world behind static text.
function panel() {
    if (scene == TITLE) {
        title();
    } else if (scene == HELP) {
        help();
    } else if (scene == LOG) {
        box("TERMINAL");
        for (var i = 0; i < logLines.length; i++)
            print(logLines[i], 10, 29 + i * 12, i == 0 ? 7 : 6);
        centre("SELECT: CLOSE", 105, 12);
    } else if (scene == DOWN) {
        box("SUIT OFFLINE");
        centre("SECURITY CONTACT", 34, 8);
        centre("USE PULSE OR ANOTHER ROUTE", 51, 6);
        centre("SELECT: RETRY SECTOR", 80, 7);
        centre("PLAY: MAIN MENU", 99, 13);
    } else {
        results();
    }
}

// Main menu, with persistent Continue and unlocked sector selection.
function title() {
    print("STATION // 2187", 8, 6, 13);
    font(FONT.CAPS, 2);
    centre("OUTPOST ECHO", 20, 7);
    font(FONT.CAPS);
    centre("RESTORE THE SIGNAL", 39, 12);
    for (var i = 0; i < 5; i++) {
        var y = 54 + i * 10;
        if (i == selection)
            rectfill(14, y - 2, 145, y + 7, 17);
        centre(menuRows[i], y, i == selection ? 7 : 6);
    }
    centre("WHEEL: MOVE / SELECT: OK", 109, 13);
}

// Concise manual includes the full one-handed tool contract.
function help() {
    box("FIELD MANUAL");
    print("WHEEL: TURN", 10, 26, 7);
    print("SELECT: WALK / STOP", 10, 36, 7);
    print("HOLD PREV: REVERSE", 10, 46, 7);
    print("NEXT: OPEN / READ / ACTIVATE", 10, 56, 7);
    print("TAP PLAY: USE TOOL", 10, 66, 7);
    print("HOLD PLAY: CHANGE TOOL", 10, 76, 7);
    print("SCAN FOR HIDDEN SERVICE PANELS", 10, 88, 13);
    centre("SELECT: BACK", 105, 12);
}

// Per-sector records and a final story resolution with exploration stats.
function results() {
    var finished = scene == VICTORY;
    box(finished ? "SIGNAL RESTORED" : "SECTOR CLEAR");
    if (finished) {
        centre("THE CREW REACHED SAFETY.", 27, 7);
        centre("YOUR SIGNAL GUIDES THE RESCUE.", 38, 6);
    } else {
        centre(station.plan.name, 28, 7);
        centre("RELAY ONLINE / TRANSIT READY", 39, 11);
    }
    print("TIME " + elapsedMs / 60000 + ":" + (elapsedMs / 1000 % 60 < 10 ? "0" : "") + elapsedMs / 1000 % 60, 12, 53, 6);
    print("ITEMS " + station.collected + " / SECRET " + station.secrets + "/1", 12, 64, 6);
    print("DISABLED " + robots.disabled + " / AVOIDED " + robots.avoided(), 12, 75, 6);
    print("SCORE " + (finished ? runPoints : levelPoints), 12, 86, 10);
    centre(finished ? "SELECT: MAIN MENU" : "SELECT: NEXT SECTOR", 104, 12);
}
