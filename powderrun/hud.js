// hud: the little there is on screen: the distance down the mountain and
// the speed, when the option shows them; the frame rate when asked for.

function draw() {
    if (showHud) {
        shadow(skier.metres() + " M", 3, 3, 7);
        var s = skier.kmh() + " KM/H";
        shadow(s, 156 - textw(s), 3, 7);
    }
    if (stats) {
        var t = "Q" + quality.level + " " + rate() + "/S";
        shadow(t, 156 - textw(t), 112, 13);
    }
}

function shadow(s, x, y, c) {
    print(s, x + 1, y + 1, 1);
    print(s, x, y, c);
}
