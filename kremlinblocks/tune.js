// tune: short tunes of the game's own, a note at a time on channel 1: a
// level up, a new stage, a round run to its end and a full stack. The
// melodies are original, in a minor key with a folk lilt. They are tones,
// so they leave the owner's music playing, and the Sound effects option
// quiets them with the rest.
const LEVEL=0,STAGE=1,WIN=2,OVER=3;   // a level up, a new stage, a round run to its end, a full stack

var TUNES=[
    [440,523,659,880],
    [659,587,523,494,523,587,659,0,880,784,659,659],
    [523,659,784,1047,0,988,1047,1047],
    [440,415,392,370,349,0,330],
];
var STEPS=[3,5,4,6];               // ticks a note
var playing=-1,at=0,wait=0;

// Start tune n, over any playing
function play(n){
    if(!sounds)return;
    playing=n;at=0;wait=0;
}

// A tick of the tune playing: the next note when its turn comes
function tick(){
    if(playing<0)return;
    if(wait>0){wait--;return;}
    var seq=TUNES[playing];
    if(at>=seq.length){playing=-1;return;}
    var hz=seq[at];
    if(hz>0)tone(1,hz,STEPS[playing],24,WAVE.SQUARE);
    wait=STEPS[playing]-1;at++;
}
