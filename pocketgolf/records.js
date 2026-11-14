// records: versioned in-flight saves plus native integer low-score records.
var unlocked = 1, last = null, failed = false, wrote = false;
var pending = null;
var queuedScene = -1;
var numericKeys = ["hole", "mode", "scene", "strokes", "total", "x", "y", "vx", "vy", "z", "vz", "safeX", "safeY", "cooldown", "delay", "clock", "debt", "aim", "cup", "moving", "gate", "picked", "previousBest", "newRecord"];

// Retain this cart's own progress without accessing another game's saves.
function init() {
    unlocked = mid(1, flr(dget(0)), 4);
    last = store.read("round");
}

// Persist velocity, airborne state and moving-obstacle phase too.
function checkpoint() {
    queuedScene = scene;
}

// Build one snapshot from the physical result, including the final
// water penalty. A menu transition keeps the scene it saved from.
function flush() {
    if (queuedScene < 0) return;
    var scores = new Int32Array(36);
    copy(scores, 0, cards, 0, 36);
    var state = {version:1, hole:hole, mode:mode, scene:queuedScene, strokes:strokes, total:total,
        x:ball.x, y:ball.y, vx:ball.vx, vy:ball.vy, z:ball.z, vz:ball.vz,
        safeX:ball.safeX, safeY:ball.safeY, cup:ball.cup, moving:ball.moving,
        cooldown:ball.cooldown, delay:ball.delay, clock:geometry.clock, gate:geometry.gateOpen,
        debt:debt, aim:putter.aim, scores:scores,
        picked:picked, previousBest:previousBest, newRecord:newRecord};
    wrote = true;
    failed = !store.write("round", state);
    if (!failed) last = state;
    queuedScene = -1;
}

// Reject absent, old or structurally incomplete round data.
function valid(s) {
    // The subset calls both arrays and records "object". Its record text
    // tag lets us reject ordinary array data before accessing fields.
    if (s == null || typeof s != "object" || "" + s != "[object Object]") return false;
    if (s.version != 1) return false;
    for (var i = 0; i < numericKeys.length; i++) if (typeof s[numericKeys[i]] != "number") return false;
    if (s.hole < 0 || s.hole >= 36 || flr(s.hole) != s.hole) return false;
    var bounds = course.catalog[s.hole];
    if (s.mode < 0 || s.mode > 3 || flr(s.mode) != s.mode || s.scene < PLAY || s.scene > RESULTS || flr(s.scene) != s.scene ||
        s.x < 0.0 || s.x >= bounds.w || s.y < 0.0 || s.y >= bounds.h ||
        s.safeX < 0.0 || s.safeX >= bounds.w || s.safeY < 0.0 || s.safeY >= bounds.h ||
        abs(s.vx) > 3.21 || abs(s.vy) > 3.21 || s.z < 0.0 || s.z > 8.0 || abs(s.vz) > 2.0 ||
        s.strokes < 0 || s.total < 0 || s.clock < 0 || s.debt < 0 || s.debt >= 33 ||
        s.cooldown < 0 || s.cooldown > 30 || s.delay < 0 || s.delay > 18 ||
        abs(s.aim) > 1.0 || s.scores == null || typeof s.scores != "object" || "" + s.scores == "[object Object]") return false;
    if (s.scores.length != 36) return false;
    for (var i = 0; i < 36; i++) if (typeof s.scores[i] != "number" || s.scores[i] < 0 || flr(s.scores[i]) != s.scores[i]) return false;
    return true;
}

// Resume without scoring again or converting the save into a free retry.
function resume() {
    var s = last;
    if (!valid(s)) return false;
    mode = s.mode;
    pending = s;
    loadHole(s.hole);
    return true;
}

// Apply after the images have loaded, without submitting records again.
function restore() {
    var s = pending;
    pending = null;
    strokes = s.strokes; total = s.total; scene = s.scene;
    picked = s.picked; previousBest = s.previousBest; newRecord = s.newRecord;
    for (var i = 0; i < 36; i++) cards[i] = max(0, flr(s.scores[i]));
    ball.x = s.x; ball.y = s.y; ball.vx = s.vx; ball.vy = s.vy;
    ball.z = s.z; ball.vz = s.vz; ball.safeX = s.safeX; ball.safeY = s.safeY;
    ball.cup = s.cup; ball.moving = s.moving; ball.event = 0;
    ball.cooldown = s.cooldown; ball.delay = s.delay;
    geometry.clock = s.clock; geometry.gateOpen = s.gate; geometry.update();
    debt = s.debt;
    putter.reset(); putter.aim = s.aim;
    view.reset(); endWait = 0;
}
