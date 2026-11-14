// levels: each level's opening field and how hard it presses, all made
// from the level's number, so level n is laid out the same every time.
//
// A level is one of eight shapes cut from the top rows, filled with a few
// colours in clusters: a bubble often takes the colour of its neighbour to
// the left or above, so groups are there to be found. The shapes repeat
// every eight levels with more rows, more colours and a faster ceiling.

const SHAPES = 8;

var g = new Int32Array(2);         // the level's own random numbers

// How many colours level n uses
function colours(n) {
    return n < 2 ? 3 : n < 4 ? 4 : n < 7 ? 5 : n < 12 ? 6 : 7;
}

// Rows filled at the start: 5 at level 1, 9 from level 12
function rows(n) {
    return min(5 + n / 3, 9);
}

// Bars of music between drops of the ceiling: 10 at level 1, 4 from level 18
function bars(n) {
    return max(4, 10 - n / 3);
}

// Shots between drops when there is no beat to go by: 10 at level 1, 5 from level 20
function shots(n) {
    return max(5, 10 - n / 4);
}

// Lays out level n
function build(n) {
    board.clear();
    rng.seed(g, 7919 * n + 101);
    var shape = (n - 1) % SHAPES, k = colours(n), h = rows(n);
    for (var r = 0; r < h; r++) {
        var w = board.width(r);
        var v0 = r / max(1.0, h - 1.0);
        for (var c = 0; c < w; c++) {
            var u = (c + (r & 1) * 0.5) / 11.0;
            if (!inShape(shape, u, v0, r, c))
                continue;
            var roll = rng.rnd(g, 100), v = 0;
            if (c > 0 && roll < 40)
                v = board.at(r, c - 1);
            if (v == 0 && r > 0 && roll < 65)
                v = board.at(r - 1, c);
            if (v == 0)
                v = 1 + rng.rnd(g, k);
            board.put(r, c, v);
        }
    }
    // a shape can leave bits hanging from nothing
    board.loose(true);
}

// Whether a shape takes the cell at u across (0 to 1) and v down (0 to 1)
function inShape(shape, u, v, r, c) {
    if (shape == 0)
        return true;                                    // a block
    if (shape == 1)
        return abs(u - 0.5) <= 0.52 - v * 0.38;         // a wedge, point down
    if (shape == 2)
        return abs(u - 0.5) <= 0.16 + abs(v - 0.45) * 0.75;   // an hourglass
    if (shape == 3)
        return v < 0.3 || c % 4 < 2;                    // a beam with pillars
    if (shape == 4)
        return v < 0.2 || (r / 2 + c) % 3 != 0;         // a lattice
    if (shape == 5)
        return v < 0.3 || abs(u - 0.25) < 0.17 || abs(u - 0.75) < 0.17;   // two lobes
    if (shape == 6)
        return v <= 0.5 + 0.45 * cos(u * 1.5);          // a wave
    return v < 0.25 || u < 0.2 || u > 0.8 || v > 0.75;  // a frame
}
