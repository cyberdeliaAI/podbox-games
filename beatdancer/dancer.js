// dancer: original procedural choreography for a small articulated robot.
// Three styles share a rig. Every joint follows a continuous musical phase.
var rootX=0.0, rootY=0.0, lean=0.0;
var elbowL=0.0,elbowR=0.0,handL=0.0,handR=0.0;
var liftL=0.0,liftR=0.0,stepL=0.0,stepR=0.0;
var headX=0.0;

// Groove swings, Robot snaps softly and Disco alternates raised hands.
function pose() {
    var t=(music.count%8)+music.phase;
    var beatWave=-sin(t*0.5),doubleWave=-sin(t);
    var amount=0.65+music.energy*0.35;
    rootX=beatWave*0.13*amount;
    rootY=0.04*(1.0-cos(t))*amount;
    lean=beatWave*0.07;
    liftL=max(0.0,beatWave)*0.12;liftR=max(0.0,-beatWave)*0.12;
    stepL=beatWave*0.13;stepR=-stepL;
    elbowL=0.20+doubleWave*0.20;elbowR=0.20-doubleWave*0.20;
    handL=0.05-beatWave*0.28;handR=0.05+beatWave*0.28;
    if(danceStyle==1){
        var snap=mid(-1.0,beatWave*2.5,1.0);
        rootX=snap*0.10;lean=-snap*0.05;
        elbowL=0.22+snap*0.15;elbowR=0.22-snap*0.15;
        handL=0.32+snap*0.22;handR=0.32-snap*0.22;
    }else if(danceStyle==2){
        lean=beatWave*0.10;
        elbowL=0.35+beatWave*0.22;elbowR=0.35-beatWave*0.22;
        handL=0.45+beatWave*0.58;handR=0.45-beatWave*0.58;
        liftL*=1.4;liftR*=1.4;
    }
    if(solo>0.0){handL=1.0;handR=1.0;elbowL=0.5;elbowR=0.5;rootY+=0.10;}
    headX=rootX+lean*0.6;
}

// Fill a 16-joint rig plus a solid head, chest and projected eye points.
function draw() {
    var x=rootX,y=rootY;
    mesh.bodyShade=danceStyle==0?16:danceStyle==1?19:22;
    mesh.wx[4]=x+lean-0.37;mesh.wy[4]=1.78+y;mesh.wz[4]=0.0;
    mesh.wx[5]=x+lean+0.37;mesh.wy[5]=1.78+y;mesh.wz[5]=0.0;
    mesh.wx[6]=x-0.55;mesh.wy[6]=1.25+elbowL+y;mesh.wz[6]=-0.05;
    mesh.wx[7]=x+0.55;mesh.wy[7]=1.25+elbowR+y;mesh.wz[7]=-0.05;
    mesh.wx[8]=x-0.71;mesh.wy[8]=0.93+handL+y;mesh.wz[8]=-0.20;
    mesh.wx[9]=x+0.71;mesh.wy[9]=0.93+handR+y;mesh.wz[9]=-0.20;
    mesh.wx[10]=x-0.18;mesh.wy[10]=0.97+y;mesh.wz[10]=0.0;
    mesh.wx[11]=x+0.18;mesh.wy[11]=0.97+y;mesh.wz[11]=0.0;
    mesh.wx[12]=x-0.23;mesh.wy[12]=0.56+liftL;mesh.wz[12]=stepL;
    mesh.wx[13]=x+0.23;mesh.wy[13]=0.56+liftR;mesh.wz[13]=stepR;
    mesh.wx[14]=x-0.26;mesh.wy[14]=0.12+liftL;mesh.wz[14]=stepL*0.5;
    mesh.wx[15]=x+0.26;mesh.wy[15]=0.12+liftR;mesh.wz[15]=stepR*0.5;
    if(!music.listening){
    mesh.box(16,headX,2.15+y,0.0,0.29,0.25,0.22);
    mesh.box(24,x+lean,1.55+y,0.0,0.34,0.37,0.19);
    }
    for(var i=32;i<(music.listening?33:35);i++){
        mesh.wx[i]=headX+(i==33?-0.11:i==34?0.11:0.0);
        mesh.wy[i]=2.18+y;mesh.wz[i]=-0.23;
    }
}
