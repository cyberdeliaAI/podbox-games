// Scratch-only checks. The production cartridge has no probe namespace.
var lockedTicks=0,listeningTicks=0,freeTicks=0,trackChanges=0,lastTrack=-3;
var lastCount=-1,changes=0,lastStyle=-1,lastOrbit=-1;

// Fail immediately, so a long music run can't hide a broken state.
function fail(text){printh("VIOLATION "+text+" FRAME "+frame());quit();}

// Check both music phase and the live projection after every drawn tick.
function check(){
    prof("probe");
    if(music.phase<0.0 || music.phase>=1.0)fail("phase");
    if(music.period<200 || music.period>1500 || music.bpm<40 || music.bpm>300)fail("tempo");
    if(music.count<lastCount)fail("beat count reversed");
    if(music.count!=lastCount){changes++;lastCount=music.count;}
    if(music.locked && music.listening)fail("listener left running after lock");
    if(music.listening && music.own-music.listenFrom>10050)fail("unbounded listening");
    if(music.energy<0.0 || music.energy>1.0 || music.pulse<0.0 || music.pulse>1.0)fail("light envelope");
    if(orbit<0.0 || orbit>=1.0 || solo<0.0 || solo>4.0)fail("camera or spin");
    if(danceStyle<0 || danceStyle>2 || stage.viewIndex<0 || stage.viewIndex>=32)fail("style or floor view");
    if(mesh.nf<0 || mesh.nf>mesh.MAX_F)fail("primitive capacity");
    if(!music.listening){
        for(var i=4;i<mesh.nv;i++)if(mesh.depth[i]<3.0 || mesh.depth[i]>8.0 || abs(mesh.px[i])>250 || abs(mesh.py[i])>250)fail("projection");
        for(var i=1;i<mesh.nf;i++)if(mesh.zsort[i]>mesh.zsort[i-1])fail("depth order");
    }
    if(music.locked){
        lockedTicks++;
        var nextBeat=beat.next(beat.clock(),0);
        var expected=mid(0.0,1.0-(nextBeat-beat.clock())/(music.period*1.0),1.0);
        if(expected>=1.0)expected=0.0;
        if(abs(expected-music.phase)>0.002)fail("music phase drift");
    }else if(music.listening)listeningTicks++;
    else freeTicks++;
    if(music.trackId!=lastTrack){trackChanges++;lastTrack=music.trackId;}
    if(frame()%100==0)printh("STATE "+frame()+" "+music.locked+" "+music.listening+" "+music.bpm+" "+music.phase+" "+music.count+" "+danceStyle+" "+autoOrbit+" "+solo+" "+orbit);
    if(frame()%1000==0)printh("TOTAL LOCKED "+lockedTicks+" LISTEN "+listeningTicks+" FREE "+freeTicks+" TRACKS "+trackChanges+" BEATS "+changes);
    prof();
}
