// mesh: project a small 3D rig once, then sort solid bodies and limb strips.
// The limbs use camera-facing shaded strips, a cheap cylinder approximation.
const MAX_V = 35, MAX_F = 24;
var nv=35,nf=0;
var wx=new FixArray(MAX_V),wy=new FixArray(MAX_V),wz=new FixArray(MAX_V);
var px=new Int32Array(MAX_V),py=new Int32Array(MAX_V),depth=new FixArray(MAX_V);
var ids=new Int32Array(MAX_F),zsort=new FixArray(MAX_F);
var qa=[0,4,0,2,0,1],qb=[1,6,4,3,2,5],qc=[3,7,5,7,6,7],qd=[2,5,1,6,4,3];
var linksA=[4,6,5,7,10,12,11,13,10],linksB=[6,8,7,9,12,14,13,15,11];
var ca=1.0,sa=0.0,outX=0,outY=0,outZ=0.0;
var bodyShade=16;

// The world and model share the same perspective and camera elevation.
function viewAngle(angle){ca=cos(angle);sa=-sin(angle);}

// Stage-only projection. The model projects all its vertices in one loop.
function project(x,y,z){
    var rx=x*ca-z*sa,rz=x*sa+z*ca,yy=y-1.15;
    outZ=5.5+rz*0.94-yy*0.34;
    var scale=145.0/outZ;
    outX=flr(80.0+rx*scale);outY=flr(61.0-(yy*0.94+rz*0.34)*scale);
}

// Reset primitive counts. All memory is reused.
function begin(){nf=0;}

// Two small real boxes give the robot a solid head and chest.
function box(base,x,y,z,w,h,thick){
    for(var i=0;i<8;i++){
        wx[base+i]=x+((i&1)!=0?w:-w);
        wy[base+i]=y+((i&2)!=0?h:-h);
        wz[base+i]=z+((i&4)!=0?thick:-thick);
    }
}

// Insert at most 22 visible primitives, far to near.
function add(id,z){
    var i=nf;
    while(i>0 && zsort[i-1]<z){zsort[i]=zsort[i-1];ids[i]=ids[i-1];i--;}
    zsort[i]=z;ids[i]=id;nf++;
}

// Transform the rig once, cull box faces and gather the limb depths.
function prepare(){
    for(var i=4;i<nv;i++){
        var x=wx[i],z=wz[i],yy=wy[i]-1.15;
        var rx=x*ca-z*sa,rz=x*sa+z*ca;
        var distance=5.5+rz*0.94-yy*0.34,scale=145.0/distance;
        depth[i]=distance;px[i]=flr(80.0+rx*scale);py[i]=flr(61.0-(yy*0.94+rz*0.34)*scale);
    }
    for(var i=0;i<9;i++)add(i,(depth[linksA[i]]+depth[linksB[i]])*0.5);
    for(var boxId=0;boxId<2;boxId++)for(var f=0;f<6;f++){
        var base=16+boxId*8,a=base+qa[f],b=base+qb[f],c=base+qc[f],d=base+qd[f];
        if((px[b]-px[a])*(py[c]-py[a])-(py[b]-py[a])*(px[c]-px[a])<0)
            add(9+boxId*6+f,(depth[a]+depth[b]+depth[c]+depth[d])*0.25);
    }
    if(ca>0.10)add(21,depth[32]-0.005);
}

// The line's projection has width, highlights and small mechanical joints.
function limb(id){
    var a=linksA[id],b=linksB[id];
    var x0=px[a],y0=py[a],x1=px[b],y1=py[b];
    var shade=id==1 || id==3?29:id==8?26:bodyShade+1;
    if(music.listening){line(x0,y0,x1,y1,shade+1);return;}
    if(abs(x1-x0)<abs(y1-y0)){
        line(x0-1,y0,x1-1,y1,shade);line(x0,y0,x1,y1,shade);
        line(x0+1,y0,x1+1,y1,shade+1);
    }else{
        line(x0,y0-1,x1,y1-1,shade);line(x0,y0,x1,y1,shade);
        line(x0,y0+1,x1,y1+1,shade+1);
    }
    circfill(x1,y1,id>=4?2:1,26);
}

// A neon rig leaves room for the music analyser while it finds the tempo.
// These are the same moving 3D joints. Filled boxes return once it stops.
function listeningRig(){
    for(var i=4;i<=16;i++){
        var v=i==16?32:i;
        project(wx[v],wy[v],wz[v]);px[v]=outX;py[v]=outY;
    }
    for(var i=0;i<9;i++){
        var a=linksA[i],b=linksB[i];
        line(px[a],py[a],px[b],py[b],18);
        circfill(px[b],py[b],2,13);
    }
    line(px[4],py[4],px[5],py[5],18);
    line(px[4],py[4],px[10],py[10],17);
    line(px[5],py[5],px[11],py[11],17);
    circ(px[32],py[32],7,18);circfill(px[32],py[32],4,28);
}

// Render only visible faces. No general polygon scan converter is needed.
function draw(){
    if(music.listening){listeningRig();return;}
    prepare();
    for(var i=0;i<nf;i++){
        var id=ids[i];
        if(id<9){limb(id);continue;}
        if(id==21){
            line(px[33]-1,py[33],px[34]+1,py[34],1);
            line(px[33]-1,py[33]-1,px[34]+1,py[34]-1,1);
            rectfill(px[33],py[33]-1,px[33]+1,py[33],10);
            rectfill(px[34],py[34]-1,px[34]+1,py[34],10);continue;
        }
        var boxId=(id-9)/6,f=(id-9)%6,base=16+boxId*8;
        var a=base+qa[f],b=base+qb[f],c=base+qc[f],d=base+qd[f];
        var shade=(boxId==0?28:bodyShade)+(f==0 || f==3?2:f>=4?1:0);
        trifill(px[a],py[a],px[b],py[b],px[c],py[c],shade);
        trifill(px[a],py[a],px[c],py[c],px[d],py[d],shade);
    }
}
