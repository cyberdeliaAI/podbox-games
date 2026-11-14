// hud: honest sync status, tempo and a small beat marker, outside the stage.

// Keep text clear of the robot, tiles and beams.
function draw() {
    rectfill(0,0,159,12,1);print("BEAT DANCER 3D",4,3,7);
    var status=music.locked?"SYNC":music.listening?"LISTEN":"DEMO";
    print(status,160-textw(status)-4,3,music.locked?11:music.listening?10:13);
    rectfill(0,104,159,119,1);
    print(styleNames[danceStyle],4,107,7);
    print(music.bpm+" BPM",74,107,10);
    for(var i=0;i<4;i++)circfill(133+i*7,109,2,(music.count%4)==i?14:5);
    print("WHEEL: VIEW  SELECT: SPIN",4,115,6);
    if(showStats){rectfill(2,25,74,34,1);print(spent+" U / "+rate()+" HZ",4,27,11);}
}
