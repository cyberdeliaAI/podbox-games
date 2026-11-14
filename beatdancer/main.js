// Beat Dancer 3D: a procedural robot and a disco lit by the owner's beat.
// Music is read only. No sound effects or playback controls are used.
var danceStyle = 0, selectedStyle = 0;
var autoOrbit = true, showStats = false;
var orbit = 0.04, bodyTurn = 0.0, solo = 0.0;
var wasPrev = false, wasNext = false, wasSelect = false, wasPlay = false;
var spent = 0;
var styleNames = ["GROOVE", "ROBOT", "DISCO"];

// Start immediately, with a fresh tracker and a restrained camera angle.
function init() {
    menuitem(1, "Find music beat", music.retry);
    menuitem(2, "Reset camera", resetCamera);
}

// Reset only the view, keeping the music and dance phase intact.
function resetCamera() { orbit = 0.04; }

// Options don't reset a held music lock when changing the camera or style.
function options() {
    music.enabled = opt.get(OPT.music) == 1;
    music.freeBpm = opt.get(OPT.tempo);
    selectedStyle = opt.get(OPT.style);
    autoOrbit = opt.get(OPT.orbit) == 1;
    showStats = opt.get(OPT.stats) == 1;
}

// Buttons use physical edges, so holding a key doesn't cycle styles.
function update() {
    if (opt.changed()) options();
    if (resumed()) music.retry();
    if (btn(0) && !wasPrev) {
        selectedStyle = (danceStyle + 2) % 3 + 1;
        opt.set(OPT.style, selectedStyle);
    }
    if (btn(1) && !wasNext) {
        selectedStyle = (danceStyle + 1) % 3 + 1;
        opt.set(OPT.style, selectedStyle);
    }
    if (btn(3) && !wasPlay) { autoOrbit = !autoOrbit; opt.set(OPT.orbit, autoOrbit); }
    if (btn(4) && !wasSelect) solo = 4.0;
    wasPrev = btn(0); wasNext = btn(1); wasPlay = btn(3); wasSelect = btn(4);
    music.update();
    danceStyle = selectedStyle == 0 ? (music.count / 32) % 3 : selectedStyle - 1;
    orbit += wheel() / 384.0;
    if (autoOrbit) orbit += 0.012 / rate();
    orbit -= flr(orbit);
    if (solo > 0.0) solo = max(0.0, solo - 1000.0 / rate() / music.period);
    bodyTurn = solo > 0.0 ? (4.0 - solo) * 0.25 : 0.0;
    dancer.pose();
}

// Flat-shaded geometry is depth sorted over the perspective dance floor.
function draw() {
    cls(1);
    clip(0,13,159,103);
    stage.viewIndex=flr(orbit*32.0+0.5)%32;
    var angle=stage.viewIndex/32.0;
    mesh.viewAngle(angle);
    stage.draw();
    mesh.viewAngle(angle + bodyTurn);
    mesh.begin();
    dancer.draw();
    mesh.draw();
    clip();
    hud.draw();
    spent = unitsnow();
}

// Release the tracker when leaving this cart.
function ending() { beat.listen(false); }
