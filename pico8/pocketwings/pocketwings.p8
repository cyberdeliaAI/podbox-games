pico-8 cartridge // http://www.pico-8.com
version 42
__lua__
-- pocket wings
-- by cyberdelia

-- a small aircraft over six
-- landscapes, to fly about in.
-- the pico-8 edition of pocket
-- wings 3d for the podbox
-- arcade. no enemies, no hurry:
-- free flight, discovery of
-- thirty landmarks, and sky
-- rings against the clock.

cartdata"cyberdelia_pocketwings8"
-- fill patterns ride along in
-- the colour of each rectfill
poke(0x5f34,1)
-- held buttons don't repeat
poke(0x5f5c,255)

foc=77 -- screen px per world unit at depth 1

names=split"green valley,coral islands,high alps,red canyon,frozen lakes,fire mountains"
mnames=split"the old mill,church tower,lakeside chapel,hilltop needle,forest gate,cape lighthouse,peak stone,observatory,sea arch,old fort,summit dome,lake chapel,rock gate,glacier spire,meadow mill,great arch,needle rock,old mission,wind pump,sun temple,watchtower,lake light,ice chapel,stone pillar,snow mill,crater dome,old lighthouse,lava arch,fire watch,black needle"
gnames=split"slow,cruise,fast"
spds=split".154,.275,.44"
cards=split"e,n,w,s"
fld=split"5,6,4,5,2"
-- sprites: x,y,w,h,height in
-- world units, 12 kinds
spr8=split"0,16,12,15,2.4,13,16,8,15,3.0,22,16,12,15,3.0,35,16,20,15,1.8,56,16,10,15,1.8,67,16,14,15,1.8,0,32,10,20,6.0,11,32,18,20,5.0,30,32,9,20,6.0,40,32,26,20,4.0,67,32,22,20,4.0,90,32,7,20,5.5"
-- 17 dither patterns, none to all
bp=split"0,-32768,-32736,-24544,-24416,-23392,-23391,-23135,-23131,-6747,-6731,-2635,-2571,-523,-521,-9,-1"

-- each landscape: water level,
-- start x,y,z,heading, seed,
-- threshold, far hills' height
-- / screen palette /
-- materials (dark,mid,light) /
-- landmark kinds / scenery
-- (kind, count, materials)
lands={
"7,0,70,31,0,11,0,9/0,1,131,3,4,5,6,7,8,138,10,139,140,12,15,6/1cd4ee3b923bb99eaa44e556/76ab9/312456,05024,13503",
"15,64,10,35,.75,61,.57,4/0,1,131,3,4,5,6,7,8,138,10,139,140,12,15,7/cd74ee3b923bb9e456bb9/8ba96/25512,3101,02503",
"20,15,15,75,.875,71,20.5,15/0,1,131,3,4,5,6,7,8,134,10,139,140,12,13,7/1cd3bb3b9223596556677e77/a69b7/16003,3121,5184",
"5,0,30,60,0,81,0,8/0,1,132,3,4,5,6,7,8,137,10,139,140,12,143,15/1cd3bb224eef3be24949e9ef/9b67a/44534,5253567,3081,0121",
"11,64,64,35,.25,91,.29,5/0,1,131,3,4,5,6,7,8,13,10,139,12,6,140,7/c77967556223596967677d77/68ab7/16003,3101,51242",
"6,5,5,45,.875,101,.34,11/0,1,130,3,132,5,6,7,8,9,10,139,141,13,133,134/1cd3bb33be5602e24489a4aa/a896b/03512,2151,52534,3081",
}
tnames=split"day,dusk,night"
suny=split"44,9,36"
-- the haze: none, a checker, and
-- farthest one tone with the hills
hz=split"0,8,8"
-- the sky's bands, down to the horizon
sb=split"0,.34,.5,.72,.86,1"
dnames=split"auto,fast,fine"
-- a step darker, for each of
-- the 32 colours
dk=split"0,129,130,131,132,133,13,6,136,137,9,139,140,141,141,143,0,129,128,129,128,128,5,9,130,132,139,3,1,130,4,134"
skies=split"141,143,15,0,129,1"
lk=split"30,20,7,98,103,5.5"
vol=split"32,35,23,60,3.5,93,42,19,47.5,3,55,93,26,70,4,111,103,15,37.5,2.5"

function rn(a)
 rs^^=rs<<13
 rs^^=rs>>>17
 rs^^=rs<<5
 return (rs&0x.ffff)*(a or 1)
end

function hx(s,i)
 return tonum("0x"..sub(s,i,i))
end

-- distance on the wrapping world
function dst(x,y,a,b)
 local dx,dy=(x-a+64)%128-64,(y-b+64)%128-64
 return sqrt(dx*dx+dy*dy)
end

function tick()
 prog+=1
 yield()
end

-- seamless fractal noise, 0 to 1,
-- 128 square: a 4x4 lattice
-- doubled five times, smoothed
-- and roughened at each size
function fbm(sd,ro)
 rs=sd
 for i=1,30 do rn() end
 local g,n,a,lo,hi={},4,.5,9,-9
 for i=0,15 do g[i]=rn() end
 local s=rs
 while n<128 do
  local h,m={},n*2
  for y=0,m-1 do
   local r0,r1=(y\2)*n,((y\2+(y&1)*2-1)%n)*n
   for x=0,m-1 do
    local x0=x\2
    local x1=(x0+(x&1)*2-1)%n
    local v=(g[r0+x0]*9+g[r0+x1]*3+g[r1+x0]*3+g[r1+x1])/16
    if m<128 then
     s^^=s<<13
     s^^=s>>>17
     s^^=s<<5
     v+=((s&0x.ffff)-.5)*a
    else
     if (v<lo) lo=v
     if (v>hi) hi=v
    end
    h[y*m+x]=v
   end
   tick()
  end
  g,n=h,m
  a*=ro
 end
 rs=s
 for i=0,16383 do
  g[i]=(g[i]-lo)/(hi-lo)
 end
 return g
end

-- a river winding right round
-- the world: its course and the
-- lie of its banks, by column
function river(a,b,f)
 rc,rk={},{}
 for x=0,127 do
  local u,v=x/128,f*x/128
  local s=(a*cos(u)+b*f*cos(v))*.049
  rc[x]=a*sin(u)+b*sin(v)
  rk[x]=1/sqrt(1+s*s)
 end
end

-- how far x,y is from it
function rd(x,y)
 return abs((y-rc[x])%128-64)*rk[x]
end

-- reshapes the land around cx,cy
function stamp(f,cx,cy,r,fn)
 for y=cy-r,cy+r do
  for x=cx-r,cx+r do
   local i=((y&127)<<7)|(x&127)
   local dx,dy=x-cx,y-cy
   f[i]=fn(f[i],sqrt(dx*dx+dy*dy),i)
  end
  tick()
 end
end

-- the heights of each landscape
-- from noise f and g at x,y
hf={
function(f,g,x,y)
 local h,d=10+f^1.5*40,rd(x,y)
 if (d<24) h=min(h,d<1.75 and 5 or 7.5+((d-1.75)/22)^1.6*35)
 return h
end,
function(f)
 return f<th and w-1.5-(th-f)*20 or w+.5+((f-th)/(1-th))^1.25*47
end,
function(f,g)
 local h=14+f^1.5*60+(1-abs(2*g-1))^2*f*30
 return h<th and w-2 or max(h,w+.5)
end,
function(f,g,x,y)
 local k,d=f*7,rd(x,y)
 local r=mid(0,(k%1-.78)/.22,1)
 local h=12+(k\1+r*r*(3-2*r))/7*55
 if (d<8) h=min(h,d<1.25 and 3.5 or 5.5+((d-1.25)/6.75)^.6*30)
 return h
end,
function(f)
 return f<th and w-2 or w+.5+((f-th)/(1-th))^1.3*29
end,
function(f)
 return f<th and w-1.5-(th-f)*15 or w+.5+(f-th)*17
end
}

-- lakes in bowls of their own,
-- and the volcanoes' cones
pf={}
pf[1]=function(f)
 for i=1,4,3 do
  local r=lk[i+2]
  stamp(f,lk[i],lk[i+1],32,function(h,d)
   return min(h,d<r and w-3+4*(d/r)^2 or w+1+(d-r)*1.3)
  end)
 end
end
pf[6]=function(f)
 vd,vc={},{}
 for i=1,16,5 do
  local r,c,a=vol[i+2],vol[i+4],vol[i+3]-w-3
  stamp(f,vol[i],vol[i+1],r,function(h,d,j)
   if (d>=r) return h
   vd[j]=d/r
   if (d<c+1) vc[j]=d-c
   return max(h,d<c and w+3+a*(1-c/r)^1.35-(c-d)*2.4 or w+3+a*(1-d/r)^1.35)
  end)
 end
end

-- the material of each cell:
-- hr height over the water, sl
-- slope, g and q noise
mf={
function(hr,sl,g,q,x,y,h)
 if (hr<1.25) return 1
 if (sl>3.2) return 7
 if (g>.6 and hr>3 and h<42) return 3
 if (sl<1.1 and hr<15 and q>.42) return fld[((x\3)*7+(y\2)*13+(y\2%2)*3)%5+1]
 return h>35 and 4 or 2
end,
function(hr,sl,g,q)
 if (hr<1.5) return 1
 if (sl>3) return 5
 if (hr>31) return 4
 if (g>.55) return 3
 return (g<.3 and sl<1) and 6 or 2
end,
function(hr,sl,g,q,x,y,h,lit)
 if (h>75 and sl<1.6) return 7
 if (h>64 or h>56 and lit>.75) return 6
 if (sl>2.8) return 5
 if (sl>2 and h>42) return 4
 if (q>.5 and hr>2 and h<50) return 3
 return h<37 and 1 or 2
end,
function(hr,sl,g,q,x,y,h)
 if (hr<2) return 1
 if (sl>2.6) return 2
 if (sl<.6) return q>.75 and 4 or 3
 return 5+(h-10)\5.5%3
end,
function(hr,sl,g,q,x,y,h,lit)
 if (hr<1) return 1
 if (sl>2.6) return 2
 if (g>.56) return 3
 if (sl>1.6) return 4
 if (lit<.6) return 5
 return q>.7 and 7 or 6
end,
function(hr,sl,g,q,x,y)
 local i=(y<<7)|x
 local f,e=vd[i],vc[i]
 if (e) return e<-1 and 6 or q>.6 and 7 or 5
 if f then
  f+=(q-.5)*.5
  if (f<.5) return q>.45 and 4 or 5
  if (f<.85) return q<.62 and 3 or 4
 end
 return (g>.6 and hr>2) and 2 or 1
end
}

-- builds landscape n: heights
-- hm, shades cm, the colour
-- tables, scenery and landmarks.
-- runs as a coroutine
function gen(n)
 prog,hm,cm,ob,mk,vd=0
 local d=split(lands[n],"/",false)
 local p=split(d[1])
 w,th=p[1],p[7]
 lp=p
 local f,g=fbm(p[6],.5),fbm(p[6]+1,.55)
 local hfn,mfn=hf[n],mf[n]
 if (n==1) river(19,7,3)
 if (n==4) river(23,6,4)
 for i=0,16383 do
  f[i]=hfn(f[i],g[i],i&127,i\128)
  if ((i&255)==0) tick()
 end
 if (pf[n]) pf[n](f)
 hm,cm=f,{}
 for i=0,16383 do
  local x,y,h=i&127,i\128,f[i]
  local m,l=0,mid(0,10+(h-w)*4,10)\1
  if h>w then
   local r=i&0x3f80
   local dx,dy=(f[r|((i+1)&127)]-f[r|((i-1)&127)])/2,(f[(i+128)&16383]-f[(i-128)&16383])/2
   local s2=dx*dx+dy*dy
   local lit=(.55*dx+.55*dy+.63)/sqrt(s2+1)
   m=mfn(h-w,sqrt(s2),g[i],g[(((x+50)&127)<<7)|((y+77)&127)],x,y,h,lit)
   l=mid(0,(lit-.35)*26,16)\1
  elseif rn()<.012 then
   l=16
  end
  hm[i]=max(h,w)
  cm[i]=m*17+l
  if ((i&255)==0) tick()
 end
 -- colours: each shade at four
 -- depths of haze
 pl=split(d[2])
 local ms=d[3]
 ct,dc={},{}
 for f=0,3 do
  local t={}
  ct[f]=t
  for m=0,#ms\3-1 do
   local a,b,c=hx(ms,m*3+1),hx(ms,m*3+2),hx(ms,m*3+3)
   for l=0,16 do
    local v=(l+2)\4
    local lo,hi,k=v<2 and a or v<4 and b or c,v<1 and a or v<3 and b or c,8
    if (f<1) dc[m*17+l]=lo
    if (f>0) lo,hi,k=f>2 and 13 or dc[m*17+l],15,hz[f]
    t[m*17+l]=0x1000+lo+hi*16+(bp[k+1]>>>16)
   end
  end
 end
 -- the map, full size, in upper
 -- memory
 for j=0,8191 do
  poke(0x8000+j,dc[cm[j*2]]|dc[cm[j*2+1]]<<4)
 end
 tick()
 -- scenery
 ob={}
 local tk={}
 for r in all(split(d[5],",",false)) do
  local c=tonum(sub(r,2,3))
  for t=1,c*40 do
   local i=rn(16384)\1
   local ok
   for j=4,#r do
    ok=ok or hx(r,j)==cm[i]\17
   end
   if (c<1) break
   if ok and not tk[i] then
    tk[i]=1
    c-=1
    add(ob,{x=(i&127)+.5,y=i\128+.5,z=hm[i],k=hx(r,1)+1,f=(i&1)>0})
   end
  end
 end
 tick()
 -- landmarks: needles on the
 -- heights, lighthouses on the
 -- shore, the rest on level land
 mk={}
 for j=1,5 do
  local k,bi,bv=hx(d[4],j),0,-99
  for t=1,400 do
   local i=rn(16384)\1
   local x,y,h=i&127,i\128,hm[i]-w
   local s=k==11 and h or k==8 and -abs(h-1.5) or rn()
   local ok=h>.4 and s>bv and dst(x,y,p[2],p[3])>24 and (k==11 or abs(hm[(i&0x3f80)|((i+1)&127)]-hm[(i&0x3f80)|((i-1)&127)])<1.5)
   for o in all(mk) do
    ok=ok and dst(x,y,o.x,o.y)>28
   end
   if (ok) bi,bv=i,s
  end
  local o={x=(bi&127)+.5,y=bi\128+.5,z=hm[bi],k=k+1,m=j}
  add(ob,o)
  add(mk,o)
  tick()
 end
 nob,rseed,vd,vc=#ob,rs
 hd1,hmx={},0
 for i=0,16383 do
  hd1[i]=hm[(i&0x3f80)|((i+1)&127)]-hm[i]
  hmx=max(hmx,hm[i])
  if ((i&255)==0) tick()
 end
 -- the hills on the horizon, a
 -- whole turn of them
 fh={}
 for i=0,290 do
  fh[i]=p[8]*(2+sin(i/97)+sin(i/41.57+.3)*.6+sin(i/17.1)*.3)/3.9
 end
 setpal()
end

-- the screen's colours: the
-- landscape's, darker by night,
-- under the hour's sky
function setpal()
 for i=0,15 do
  local c=pl[i+1]
  if (tod>1) c=dk[c%112+1]
  pal(i,c,1)
 end
 if tod>0 then
  pal(12,skies[tod*3-2],1)
  pal(13,skies[tod*3-1],1)
  pal(15,skies[tod*3],1)
 end
end

-- the ground's height, smoothed
function gh(x,y)
 x-=.5
 y-=.5
 local x0,y0,fx,fy=x&127,y&127,x&0x.ffff,y&0x.ffff
 local x1,y1=(x0+1)&127,((y0+1)&127)<<7
 y0<<=7
 local a,c=hm[y0|x0],hm[y1|x0]
 a+=(hm[y0|x1]-a)*fx
 c+=(hm[y1|x1]-c)*fx
 return a+(c-a)*fy
end

-- ---- the picture ----

-- level of detail q: 0 fine,
-- 1 normal, 2 fast. three bands
-- of depth: near, where a cell
-- is many pixels wide, smooth in
-- 2px columns; then every pixel
-- column; deep in the haze one
-- height read for two columns,
-- each still hidden on its own
lvq={
split"13,999,.062,110",
split"10,52,.074,110",
split"7,0,.085,95"
}
function setq(q)
 ql=q
 local l=lvq[q+1]
 zt,fg,kn,km={},{},0,0
 local z,far=1.5,l[4]
 while z<far do
  add(zt,z)
  add(fg,mid(0,(z/far-.5)*6\1+1,3))
  if (z<l[1]) kn+=1
  if (z<l[2]) km+=1
  z+=max(.8,z*l[3])
 end
end

yb={}
vis={}

-- gathers the scenery in view,
-- nearest first
function scan()
 vis={}
 local fx,fy=cos(hd),sin(hd)
 for o in all(ob) do
  local dx,dy=(o.x-cx+64)%128-64,(o.y-cy+64)%128-64
  local d=dx*fx+dy*fy
  if d>1.5 and d<(o.k>6 and 105 or 55) then
   local l=dy*fx-dx*fy
   if abs(l)<d*.9+4 then
    o.d=d
    o.sx=64+l*foc/d
    local j=#vis
    while j>0 and vis[j].d>d do
     vis[j+1]=vis[j]
     j-=1
    end
    vis[j+1]=o
   end
  end
 end
end

function draw3d(bot)
 local fx,fy,hy=cos(hd),sin(hd),hy\1
 fillp()
 rectfill(0,hy,127,127,15)
 for b=0,4 do
  local lo=b<2 and 12 or b<4 and 13 or 15
  rectfill(0,hy*sb[b+1],127,hy*sb[b+2],0x1000+lo+(b%2>0 and 0x.5a5a+16*(lo==12 and 13 or 15) or 16*lo))
 end
 fillp()
 if tod>1 then
  for i=1,30 do
   local y=i*29%47
   if (y<hy-8) pset((i*211+hd*582)%582,y,7)
  end
 end
 circfill(64-((.375-hd+.5)%1-.5)*582,hy-suny[tod+1],4,tod>1 and 7 or 10)
 local y0=hy+(cz-w-8)*.7
 for x=0,127,2 do
  rectfill(x,y0-fh[(x-hd*582)\2%291],x+1,y0,0x10fd.a5a5)
 end
 clip(0,0,128,bot)
 scan()
 local hm,hd1,cm,yb,rf,foc,fg,zt,cx,cy,cz,vis=hm,hd1,cm,yb,rectfill,foc,fg,zt,cx,cy,cz,vis
 local lx,ly=fx+fy*64/foc,fy-fx*64/foc
 for x=0,127 do
  yb[x]=bot
 end
 local oi,no,cw=1,#vis,2
 for k=1,#zt do
  local z=zt[k]
  while oi<=no and vis[oi].d<z do
   vis[oi].c=yb[vis[oi].sx\cw*cw] or bot
   oi+=1
  end
  local s,t=foc/z,ct[fg[k]]
  local b=hy+cz*s
  if k>kn then
   local px,py,dx,dy=cx+lx*z,(cy+ly*z)*128,-fy*z/foc,fx*z*128/foc
   if k<=km then
    -- every pixel column
    for x=0,127 do
     local i=(py&0x3f80)|(px&127)
     local y,u=b-hm[i]*s,yb[x]
     if y<u then
      rf(x,y,x,u-1,t[cm[i]])
      yb[x]=y
     end
     px+=dx
     py+=dy
    end
   else
    -- a height for two columns
    dx*=2
    dy*=2
    for x=0,127,2 do
     local i=(py&0x3f80)|(px&127)
     local y,u=b-hm[i]*s,yb[x]
     if y<u then
      rf(x,y,x,u-1,t[cm[i]])
      yb[x]=y
     end
     u=yb[x+1]
     if y<u then
      rf(x+1,y,x+1,u-1,t[cm[i]])
      yb[x+1]=y
     end
     px+=dx
     py+=dy
    end
   end
  elseif b-hmx*s<bot then
   -- near: heights between the
   -- cells' middles, so slopes are
   -- slopes, not steps. hd1 holds
   -- each cell's rise to the next
   local px,py,dx,dy=cx+lx*z-.5,cy+ly*z-.5,-fy*z*2/foc,fx*z*2/foc
   for x=0,127,2 do
    local ex,ey,i=px&0x.ffff,py&0x.ffff,((py&127)<<7)|(px&127)
    local j=(i+128)&16383
    local p=hm[i]+hd1[i]*ex
    local y,u=b-(p+(hm[j]+hd1[j]*ex-p)*ey)*s,yb[x]
    if y<u then
     rf(x,y,x+1,u-1,t[cm[((((py+.5)&127)<<7)|((px+.5)&127))]])
     yb[x]=y
    end
    px+=dx
    py+=dy
   end
  end
  if k==kn then
   for x=0,126,2 do
    yb[x+1]=yb[x]
   end
   cw=1
  end
 end
 while oi<=no do
  vis[oi].c=yb[vis[oi].sx\cw*cw] or bot
  oi+=1
 end
 fillp()
 -- scenery and rings, far to
 -- near, each cut off where a
 -- nearer hill stood when the
 -- ground was drawn
 for i=no,1,-1 do
  local o=vis[i]
  local s,k=foc/o.d,o.k*5
  local y=hy+(cz-o.z)*s
  clip(0,0,128,o.c)
  if k>60 then
   for r=3*s,3*s+1 do
    circ(o.sx,y,r,o==goal and 10 or 6)
   end
  else
   local h=spr8[k]*s
   local wd=h*spr8[k-2]/spr8[k-1]
   sspr(spr8[k-4],spr8[k-3],spr8[k-2],spr8[k-1],o.sx-wd/2,y-h+1,wd+1,h+1,o.f)
  end
 end
 clip()
 if view==1 then
  -- the aircraft over its shadow
  local s=foc/13
  fillp(0xa5a5.8)
  ovalfill(55,hy+(cz-gnd)*s-2,73,hy+(cz-gnd)*s+2,1)
  fillp()
  sspr(mid(0,flr(bank*2.5+2.5),4)*24,0,24,16,52,hy+(cz-pz)*s-8)
 end
end

-- ---- flying ----

function startpos(z)
 px,py,pz,hd=lp[2],lp[3],lp[4]+(z or 0),lp[5]
 bank,vs,gear,spd,climb,low=0,0,2,.275,0
 gnd=gh(px,py)
 agl=mid(5,pz-gnd,35)
 hy=56
 view=1
 camera3()
end

function fly()
 local f=mid(0,(spd-.154)/.286,1)
 local want=(btn(1) and 1 or 0)-(btn(0) and 1 or 0)
 local r=want==0 and .03 or .055
 bank+=mid(-r,want-bank,r)*(1.1-.3*f)
 hd=(hd-bank*.00495*(1.2-.4*f))%1
 if btnp(4) then
  gear=gear%3+1
  sfx(1)
  say(gnames[gear])
 end
 spd+=(spds[gear]-spd)*.033
 move()
 local up,dn=.3*(.7+.45*f),.385*(.8+.3*f)
 local look=10+spd*36
 local ah=max(gnd,gh(px+cos(hd)*look,py+sin(hd)*look)-2)
 local wv,u,d=0,btn(inv and 3 or 2),btn(inv and 2 or 3)
 if scenic then
  if (u) agl=min(35,agl+.22)
  if (d) agl=max(5,agl-.22)
  wv=mid(-dn,(ah+agl-pz)*.08,up)
 else
  wv=u and up or d and -dn or 0
 end
 vs+=mid(-.018,wv-vs,.018)
 local z0=pz
 pz+=vs
 low=pz<ah+4.5 and not scenic
 if pz<ah+4.5 then
  pz+=(ah+4.5-pz)*.2
  vs=max(vs)
 end
 pz=mid(gnd+1.5,pz,115)
 if (pz>114.9) vs=min(vs)
 climb=pz-z0
end

function move()
 px=(px+cos(hd)*spd)%128
 py=(py+sin(hd)*spd)%128
 gnd=gh(px,py)
end

function camera3()
 hy+=(56+vs*30-hy)*.16
 cx,cy,cz=px,py,pz
 if view==1 then
  cx-=cos(hd)*13
  cy-=sin(hd)*13
  cz=max(pz+3.5,gh(cx,cy)+2)
 end
end

-- ---- words ----

function pr(s,x,y,c)
 print(s,x+1,y+1,1)
 print(s,x,y,c)
end

function cpr(s,y,c)
 pr(s,64-#s*2,y,c)
end

function say(s)
 msg,msgt=s,45
end

function alt()
 return flr(max((scenic and pz-gnd or pz-w)*20))
end

-- ---- the game ----

-- saved numbers: 0 options,
-- 1 landscape, 2 time of day,
-- 3-8 landmarks found, 9 lands
-- flown, 10 minutes flown,
-- 11 badges, 13-18 best ring
-- times

function loadland(n)
 land=n
 dset(1,n)
 scene=0
 engine()
 co=cocreate(gen)
end

function totitle()
 scene,page,goal=1,0
 engine()
 startpos(10)
end

function engine()
 if (scene==2 and not quiet) sfx(0,3) else sfx(-1,3)
end

function takeoff()
 startpos()
 scene,flown,rt,fin=2,0,0
 found=dget(2+land)
 while #ob>nob do
  deli(ob)
 end
 if mode==3 then
  -- eight rings round the
  -- world, clear of the hills
  rs=rseed
  for i=1,8 do
   local a,r=i/8,24+rn(24)
   local x,y=64+cos(a)*r,64+sin(a)*r
   local z=gh(x,y)
   for j=0,.75,.25 do
    z=max(z,gh(x+cos(j)*6,y+sin(j)*6))
   end
   add(ob,{x=x,y=y,z=min(z+5+rn(5),110),k=13,m=i})
  end
 end
 nextgoal()
 sfx(3)
 say(names[land])
 engine()
end

-- what the compass points to:
-- the next ring, or discovery's
-- nearest landmark not yet found
function nextgoal()
 goal=mode==3 and ob[nob+1] or nil
 if mode==2 then
  local best=999
  for o in all(mk) do
   local d=dst(px,py,o.x,o.y)
   if (found&(1<<(o.m-1)))==0 and d<best then
    best,goal=d,o
   end
  end
 end
end

function note(a,b)
 nh,nb,nt=a,b,100
end

function earn(i)
 local b=dget(11)
 if (b&(1<<i))==0 then
  dset(11,b|(1<<i))
  toast,toastt=i,100
  sfx(5)
 end
end

-- a landmark flown over low
-- enough is found
function discover()
 for o in all(mk) do
  local b=1<<(o.m-1)
  if (found&b)==0 and dst(px,py,o.x,o.y)<8 and pz-o.z<45 then
   found|=b
   dset(2+land,found)
   sfx(2)
   note("found",mnames[land*5-5+o.m])
   earn(0)
   if (found==31) earn(1)
   local all=true
   for n=3,8 do
    all=all and dget(n)==31
   end
   if (all) earn(2)
   nextgoal()
  end
 end
end

-- a time in ticks as m:ss.t
function fmt(f)
 local s=f\3
 return s\600 ..":"..sub("0"..s\10%60,-2).."."..s%10
end

-- sky rings: through each in
-- turn, against the clock
function rings()
 if (not goal) return
 rt=min(rt+1,32000)
 if abs(pz-goal.z)<3.3 and dst(px,py,goal.x,goal.y)<3.3 then
  del(ob,goal)
  sfx(6)
  nextgoal()
  if not goal then
   local b=dget(12+land)
   fin=b==0 or rt<b
   if (fin) dset(12+land,rt)
   note(fin and "new best" or "finished",fmt(rt))
   earn(5)
   local all=true
   for n=13,18 do
    all=all and dget(n)>0
   end
   if (all) earn(6)
  end
 end
end

-- time in the air; a minute in
-- a landscape counts it as flown
function tally()
 flown=min(flown+1,9999)
 if (tm%30==0) dset(10,min(dget(10)+1/60,32000))
 if flown==1800 then
  local have=dget(9)|(1<<land)
  dset(9,have)
  if (have==126) earn(3)
 end
 if (pz>114.9) earn(4)
end

-- the pause menu's options
function mi(i,s,f)
 menuitem(i,s,function()
  f()
  saveo()
  return true
 end)
end

function saveo()
 dset(0,(scenic and 1 or 0)|(inv and 2 or 0)|(quiet and 4 or 0)|(det<<3))
 mi(1,"height: "..(scenic and "follow" or "hold"),function()
  scenic=not scenic
  if (pz) agl=mid(5,pz-gnd,35)
 end)
 mi(2,"pitch: "..(inv and "inverted" or "normal"),function()
  inv=not inv
 end)
 mi(3,"engine: "..(quiet and "off" or "on"),function()
  quiet=not quiet
 end)
 mi(4,"detail: "..dnames[det+1],function()
  det=(det+1)%3
 end)
 setq((det+1)%3)
 engine()
end

-- detail on auto follows what
-- the cpu can do: a step down
-- when frames run late, a step
-- up after a quiet spell, each
-- failed try putting the next
-- further off
function autoq()
 if (det>0 or view>2) return
 cpu+=(stat(1)-cpu)*.1
 qt,qn=max(qt-1),max(qn-1)
 if (qt>0) return
 if cpu>.93 and ql<2 then
  setq(ql+1)
  qt,qw=90,min(qw*2,7200)
  qn=qw
 elseif ql>0 and qn<1 and cpu<(ql>1 and .6 or .42) then
  setq(ql-1)
  qt=90
 end
end

function _init()
 local o=dget(0)
 scenic,inv,quiet,det,tod=(o&1)>0,(o&2)>0,(o&4)>0,(o>>3)&3,dget(2)
 mode,sel,page,msgt,nt,toastt,tm,cpu,qt,qn,qw=1,0,0,0,0,0,0,.5,0,0,300
 saveo()
 menuitem(5,"main menu",function()
  if (scene==2) totitle()
 end)
 loadland(mid(1,dget(1),6))
end

function _update()
 tm=(tm+1)%3600
 if scene==0 then
  repeat
   assert(coresume(co,land))
  until costatus(co)=="dead" or stat(1)>.8
  if (costatus(co)=="dead") totitle()
  return
 end
 msgt,nt,toastt=max(msgt-1),max(nt-1),max(toastt-1)
 if scene==1 then
  title()
 else
  fly()
  if btnp(5) then
   view=view%3+1
   sfx(4)
  end
  discover()
  if (mode==3) rings()
  tally()
  if (tm%4==0) poke2(0x3200,1216+flr(4+spd*18+max(vs)*15))
 end
 camera3()
end

function bn(i)
 return btnp(i) and 1 or 0
end

-- the start screen: the aircraft
-- circles by itself behind it
function title()
 bank,spd=.35,.22
 hd=(hd-.0017)%1
 move()
 pz+=max(gnd+15-pz)*.05
 local d,c,go=bn(3)-bn(2),bn(1)-bn(0),btnp(4) or btnp(5)
 if (go) sfx(4)
 if page>0 then
  if (go) page=0
  return
 end
 if d!=0 then
  sel=(sel+d)%8
  sfx(4)
 end
 if (go and sel>2) c=1
 if sel<3 then
  if go then
   mode=sel+1
   takeoff()
  end
 elseif sel==3 then
  if (c!=0) loadland((land+c-1)%6+1)
 elseif sel==4 then
  if c!=0 then
   tod=(tod+c)%3
   dset(2,tod)
   setpal()
  end
 elseif go then
  page=sel-4
 end
end

function _draw()
 if scene==0 then
  cls()
  cpr(names[land],54,7)
  rect(31,66,96,72,6)
  rectfill(33,68,33+min(prog/13,61),70,10)
  return
 end
 if view<3 then
  draw3d(view==2 and scene==2 and 104 or 128)
 else
  drawmap()
 end
 if (scene==1) drawtitle() else hud()
 autoq()
end

-- the map: landmarks found, the
-- rings to come, the aircraft
function drawmap()
 memcpy(0x6000,0x8000,8192)
 for o in all(mk) do
  if ((found&(1<<(o.m-1)))>0) circfill(o.x,o.y,2,7)
  circ(o.x,o.y,2,0)
 end
 for i=nob+1,#ob do
  circ(ob[i].x,ob[i].y,1,7)
 end
 if (goal and (tm&8)>0) circfill(goal.x,goal.y,2,10)
 local x,y=px+cos(hd)*5,py+sin(hd)*5
 line(px,py,x,y,0)
 circfill(px,py,1,8)
 pset(x,y,7)
end

rows=split"free flight,discovery,sky rings,,,landmarks,badges,how to fly"
bnames=split"first find,find a landmark.,explorer,find all five in a landscape.,cartographer,find all thirty landmarks.,world tour,fly a minute over each one.,cloud nine,climb as high as it goes.,ring leader,finish a sky rings course.,sky ace,finish all six courses."
hlp=split("⬅️➡️ bank and turn. let go|and the wings level.|⬆️⬇️ climb and dive.|🅾️ slow, cruise or fast.|❎ behind, cockpit or map.||the ground can't hurt you:|fly low and the aircraft|lifts itself.||discovery: follow the mark|on the compass to each|landmark. fly low over it.|sky rings: fly through all|eight, against the clock.|pause for the options.","|")

function drawtitle()
 if page>0 then
  cls(1)
  cpr(rows[page+5],3,10)
 end
 if page==1 then
  local tot=0
  for n=1,6 do
   local b,c=dget(2+n),0
   for i=0,4 do
    c+=(b>>i)&1
   end
   tot+=c
   print(names[n],8,7+n*8,n==land and 10 or 7)
   print(c.." of 5",96,7+n*8,c==5 and 11 or 7)
  end
  for i=1,5 do
   local got=((dget(2+land)>>(i-1))&1)>0
   local s=got and mnames[land*5-5+i] or "?"
   print(s,64-#s*2,62+i*8,got and 7 or 6)
  end
  cpr(tot.." of 30 found",116,6)
 elseif page==2 then
  for i=0,6 do
   local got=((dget(11)>>i)&1)>0
   print(bnames[i*2+1],8,13+i*15,got and 10 or 6)
   print(bnames[i*2+2],8,20+i*15,got and 7 or 5)
  end
  local m=flr(dget(10))
  cpr("flown "..m\60 .."h "..m%60 .."m",120,6)
 elseif page==3 then
  for i,s in pairs(hlp) do
   print(s,6,5+i*7,7)
  end
 else
  fillp(0xa5a5.8)
  rectfill(14,32,113,115,1)
  fillp()
  pr("\^w\^tpocket wings",16,7,7)
  cpr("pico-8 edition",22,10)
  for i=0,7 do
   local s=rows[i+1]
   if (i==3) s="⬅️ "..names[land].." ➡️"
   if (i==4) s="⬅️ "..tnames[tod+1].." ➡️"
   local y,x=36+i*10,64-#s*2
   if (i==3 or i==4) x-=4
   if (i==sel) rectfill(14,y-2,113,y+6,1)
   pr(s,x,y,i==sel and 10 or 7)
  end
  local b=dget(12+land)
  if (sel==2 and b>0) cpr("best "..fmt(b),119,6)
 end
end

function compass()
 for j=flr((hd-.055)*24)+1,flr((hd+.055)*24) do
  local sx=64-(j/24-hd)*582
  if j%6==0 then
   pr(cards[j\6%4+1],sx-1,2,7)
  else
   pset(sx,4,6)
  end
 end
 pset(64,9,10)
 if goal then
  local d=(atan2((goal.x-px+64)%128-64,(goal.y-py+64)%128-64)-hd+.5)%1-.5
  if d<-.05 then
   pr(">",88,2,10)
  elseif d>.05 then
   pr("<",37,2,10)
  else
   rectfill(63-d*582,8,65-d*582,10,10)
  end
 end
end

-- the instruments over the view
function hud()
 local kt=flr(spd*364).." kt"
 if view==2 then
  -- the cockpit's panel, with a
  -- little horizon that tips
  -- with the bank
  rectfill(0,104,127,127,5)
  line(0,104,127,104,6)
  circfill(64,116,9,12)
  local sl,off=bank*.6,mid(-7,climb*25,7)
  for r=-9,9,2 do
   local hw=sqrt(81-r*r)\1
   local lo,hi=-hw,hw
   if sl>.01 then
    lo=max(lo,(off-r)/sl)
   elseif sl<-.01 then
    hi=min(hi,(off-r)/sl)
   elseif r<=off then
    lo=99
   end
   if (lo<=hi) rectfill(64+lo,116+r,64+hi,116+min(r+1,9),4)
  end
  line(57,116,61,116,10)
  line(67,116,71,116,10)
  pset(64,116,10)
  local v=flr(climb*109)
  print(scenic and "agl" or "alt",4,108,6)
  print(alt(),4,116,7)
  print("vs",30,108,6)
  print(v>0 and "+"..v or v,30,116,v>0 and 11 or v<0 and 9 or 7)
  print("hdg",84,108,6)
  print(flr(90.5-hd*360)%360,84,116,7)
  print("kt",104,108,6)
  print(kt,104,116,7)
 else
  pr((scenic and "agl " or "alt ")..alt(),2,2,7)
  pr(kt,127-#kt*4,2,7)
 end
 if (view<3) compass()
 if mode==2 then
  if goal then
   local d=flr(dst(px,py,goal.x,goal.y)*.2)
   cpr(mnames[land*5-5+goal.m].." "..d\10 .."."..d%10 .." km",12,10)
  else
   cpr("all found here",12,11)
  end
 elseif mode==3 then
  cpr((goal and "ring "..goal.m.."/8  " or fin and "new best  " or "finished  ")..fmt(rt),12,10)
  -- the next ring higher or lower
  if (goal and abs(goal.z-pz)>2.5) pr(goal.z>pz and "⬆️" or "⬇️",60,20,10)
 end
 if (low and (tm&8)>0) cpr("low",view==2 and 92 or 112,10)
 if nt>0 then
  cpr(nh,30,11)
  cpr(nb,39,7)
 elseif msgt>0 then
  cpr(msg,36,7)
 end
 if toastt>0 then
  cpr("badge",54,10)
  cpr(bnames[toast*2+1],63,7)
 end
end
__gfx__
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000080000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000880000000000000000000000000000000000000880000000000000000000000000000000000000880000000000000000000000000000
00000000880000000077860000000000008000000000000000000000000880000000000000000000000088000000000000887700000008800000000000000000
00000000088000007766000000000000008800000000008000000000000880000000000008000000000088000000000000006777000008800000000000000000
00000000088c607776000000000000000088c00000777880000000000008800000000000888777000000800000000000000000677000c8000000000000000000
0000000000cc6776000000000000000000cc66777766600000000000006cc60000000000000666777067c60000000000000000066777cc000000000000000000
00000000007766600000000000000000006766766000000088877777776766777777788800000006676776000000000000000000066776000000000000000000
00000000076766007000000000000007776666000000000088866666666666666666688800000000006666777000000000000077006666700000000000000000
00000007776666670000000000077776600666007000000000000000006666000000000000000007006660666777700000000007766666770000000000000000
00000077600666700000000088866600000666770000000000000007776666777000000000000007766660000066788000000000076600667700000000000000
00007766000770000000000008000000777770000000000000000007777777777000000000000000000767770000008000000000000770006677000000000000
00886600077000000000000000000000700000000000000000000000000000000000000000000000000000000000000000000000000007700067870000000000
00880000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000880000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000080000000000
000bbbbbb000000000000000000000000000000000008800000000000000bb000000000005000000000000000000000000000000000000000000000000000000
00bbbbbbbb00000063000000000000000000000000088880000000000000bb000000000065500000000000000000000000000000000000000000000000000000
0bbbbbbbbbb0000063000000000b0000000000000088888800000000bb00bb000000000665550000000000000000000000000000000000000000000000000000
bbbbbbbbbbb00000b3000000bbbbb3bbb00000008888888888000000bb00bb000000006665555000000000000000000000000000000000000000000000000000
bbbbbbbbbbbb0006b300000000004403300000088888888888800000bb00bb003300066665555500000000000000000000000000000000000000000000000000
bbbbbbb333bb0006b330000000004000030000888888888888880000bbbbbb003300066665555500000000000000000000000000000000000000000000000000
bbbbbb33333b000b6330000000004000000088888888888888888800bbbbbb003300066665555550000000000000000000000000000000000000000000000000
bbbbbb333333000bb3300000000040000008888888888888888888800000bb333300666665555550000000000000000000000000000000000000000000000000
0bbbbb3333330066b3330000000440000000077777777755555550000000bb333300666665555550000000000000000000000000000000000000000000000000
0bbbbb33333300bbb3330000000400000000077777777755555550000000bb000000666665555550000000000000000000000000000000000000000000000000
000bbbb33330006b33330000000400000000077774447755555550000000bb000000666665555555000000000000000000000000000000000000000000000000
00000440000006bb33330000000400000000077774447755555550000000bb000000666665555555000000000000000000000000000000000000000000000000
00000440000006bb33333000000400000000077774447755555550000000bb000006666665555555000000000000000000000000000000000000000000000000
000004400000000044000000000400000000077774447755555550000000bb000006666665555555000000000000000000000000000000000000000000000000
000004400000000044000000000400000000077774447755555550000000bb000006666665555555500000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00008800000000000000000000000000008000000000000000066550000000000000000000000005500000000000060000000000000000000000000000000000
00008800000000000000000000000000888880000000000666666555555000000000000000000055000000000000660000000000000000000000000000000000
00088880000000440000000004000000aaaa00000006666666666555555555500000000000077777706600000000665000000000000000000000000000000000
00888888000000044000000440000000aaaa00000666666666666555555555555000000007777777776660000000665000000000000000000000000000000000
08888888800000000440004400000000077700000666666666666555555555555000000077777777776660000000665000000000000000000000000000000000
06666555500000000044440000000000077700000666666666666555555555555000000777777777776666000006655000000000000000000000000000000000
06666555500000000884488000000000888880000666666666666555555555555000007777777777776666000006655000000000000000000000000000000000
06666555500000000447740000000000888880000666666666000005555555555000007777777777776666000006655000000000000000000000000000000000
06664455500000004777774400000000777700000666666660000000055555555000007777777777776666000006655500000000000000000000000000000000
06664455500000440777770040000000777700000666666600000000005555555000077777777777776666000006655500000000000000000000000000000000
06666555500000000777777004000000777770000666666000000000005555555000077777777777776666000006655500000000000000000000000000000000
06666555500000000777777000000000888880000666666000000000000555555000055555555555555555500006655500000000000000000000000000000000
06666555500000000777777000000000888880006666660000000000000555555000055555555555555555500006655500000000000000000000000000000000
06666555500000000777777000000000777770006666660000000000000055555000055555555555555555500006655500000000000000000000000000000000
06666555500000000777777000000000777770006666650000000000000055555000055555555555555555500066655500000000000000000000000000000000
06666555500000000777777000000000777770006666550000000000000055555500055555555555555555500066655500000000000000000000000000000000
06666555500000000777777000000000888880006665500000000000000055555500055555555555555555500066655500000000000000000000000000000000
06666555500000007777777000000000888880006655500000000000000055555500055555555555555555500066655550000000000000000000000000000000
06666555500000007777777000000000777770006655500000000000000055555500055555555555555555500066655550000000000000000000000000000000
06666555500000007777777700000000777770006555500000000000000055555500055555555555555555500066655550000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
__label__
ssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss
ssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss
ssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss
ssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss
ssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss
ssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss
ssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss
ssssssssssssssss777777ssss7777ssss7777ss77ss77ss777777ss777777ssssssssss77ss77ss777777ss7777ssssss7777ssss7777ssssssssssssssssss
ssssssssssssssss7777771sss77771sss77771s771s771s7777771s7777771sssssssss771s771s7777771s77771sssss77771sss77771sssssssssssssssss
ssssssssssssssss7711771s77s1771s77s1111s771s771s7711111ss177111sssssssss771s771ss177111s771177ss77s1111s77s1111sssssssssssssssss
ssssssssssssssss771s771s771s771s771sssss771s771s771sssssss771sssssssssss771s771sss771sss771s771s771sssss771sssssssssssssssssssss
ssssssssssssssss7777771s771s771s771sssss7777s11s7777ssssss771sssssssssss771s771sss771sss771s771s771sssss777777ssssssssssssssssss
ssssssssssssssss7777771s771s771s771sssss77771sss77771sssss771sssssssssss771s771sss771sss771s771s771sssss7777771sssssssssssssssss
ssssssssssssssss7711111s771s771s771sssss771177ss77111sssss771sssssssssss7777771sss771sss771s771s771s77sss111771sssssssssssssssss
ssssssssssssssss771sssss771s771s771sssss771s771s771sssssss771sssssssssss7777771sss771sss771s771s771s771sssss771sssssssssssssssss
ssssssssssssssss771sssss7777s11ss17777ss771s771s777777ssss771sssssssssss7777771s777777ss771s771s7777771s7777s11sssssssssssssssss
ssssssssssssssss771sssss77771sssss77771s771s771s7777771sss771sssssssssss7777771s7777771s771s771s7777771s77771sssssssssssssssssss
sssssssssssssssss11ssssss1111ssssss1111ss11ss11ss111111ssss11ssssssssssss111111ss111111ss11ss11ss111111ss1111sssssssssssssssssss
ssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss
cscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscs
scscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscsc
cscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscscs
scscscscscscscscscscscscscscscscscscaaacaaacsaacsaacscscaaacscscaaacaascaaacaaacaaacsaacaascscscscscscscscscscscscscscscscscscsc
cscscscscscscscscscscscscscscscscscsa1a1ca11as11asa1cscsa1a1cscsa111a1asca11ca11ca11asa1a1ascscscscscscscscscscscscscscscscscscs
scscscscscscscscscscscscscscscscscscaaa1sa1ca1sca1a1aaacaaa1scscaasca1a1sa1csa1csa1ca1a1a1a1scscscscscscscscscscscscscscscscscsc
cscscscscscscscscscscscscscscscscscsa111ca1sa1csa1a1c111a1a1cscsa11sa1a1ca1sca1sca1sa1a1a1a1cscscscscscscscscscscscscscscscscscs
scscscscscscscscscscscscscscscscscsca1scaaacsaacaas1scscaaa1scscaaacaaa1aaacsa1caaacaas1a1a1scscscscscscscscscscscscscscscscscsc
cscscscscscscscscscscscscscscscscscsc1csc111cs11c11scscsc111cscsc111c111c111cs1sc111c11sc1c1cscscscscscscscscscscscscscscscscscs
cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc
cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc
cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc
cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc
ccccccccccccccc1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1cccccccccccccc
cccccccccccccc1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1ccccccccccccccc
cccccccccccccc1111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111cccccccccccccc
cccccccccccccc1111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111cccccccccccccc
cccccccccccccc1111111111111111111111111111aaa1aaa1aaa1aaa11111aaa1a111aaa11aa1a1a1aaa11111111111111111111111111111cccccccccccccc
cccccccccccccc1111111111111111111111111111a111a1a1a111a1111111a111a1111a11a111a1a11a111111111111111111111111111111cccccccccccccc
cccccccccccccc1111111111111111111111111111aa11aa11aa11aa111111aa11a1111a11a111aaa11a111111111111111111111111111111cccccccccccccc
cccccccccccccc1111111111111111111111111111a111a1a1a111a1111111a111a1111a11a1a1a1a11a111111111111111111111111111111cccccccccccccc
c6c6c6c6c6c6c61111111111111111111111111111a111a1a1aaa1aaa11111a111aaa1aaa1aaa1a1a11a111111111111111111111111111111c6c6c6c6c6c6c6
6c6c6c6c6c6c6c11111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111116c6c6c6c6c6c6c
c6c6c6c6c6c6c61111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111c6c6c6c6c6c6c6
6c6c6c6c6c6c6c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c6c6c6c6c6c6c6c
c6c6c6c6c6c6c6c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c6c6c6c6c6c6c6
6c6c6c6c6c6c6c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c6c6c6c6c6c6c6c
c6c6c6c6c6c6c6c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c177c17771c771c771c7717171777177717171c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c6c6c6c6c6c6c6
6c6c6c6c6c6c6c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c717c17117c117c117c7171717111717171711c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c6c6c6c6c6c6c6c
66666666666666616161616161616161616161616161617171671177717161717171717761776177716161616161616161616161616161616166666666666666
66666666666666161616161616161616161616161616167171171611717116717177717116717611711616161616161616161616161616161666666666666666
66666666666666616161616161616161616161616161617771777177616771776167117771717177716161616161616161616161616161616166666666666666
66666666666666161616161616161616161616161616161111111111161611111616161111111111111616161616161616161616161616161666666666666666
66666666666666616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616166666666666666
66666666666666161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161666666666666666
66666666666666616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616166666666666666
66666666666666161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161666666666666666
66666666666666616161616161616161616161616161616771717171716161777177717761677167716161616161616161616161616161616166666666666666
66666666666666161616161616161616161616161616167611717171711616717117117176761176111616161616161616161616161616161666666666666666
66666666666666616161616161616161616161616161617771776177716161776167117171716177716161616161616161616161616161616166666666666666
66666666666666161616161616161616161616161616161171717611711616717617167171717611711616161616161616161616161616161666666666666666
66666666666666616161616161616161616161616161617761717177716161717177717171777177616161616161616161616161616161616166666666666666
66666666666666161616161616161616161616161616161116111111111616111111111111111111161616161616161616161616161616161666666666666666
66666666666666616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616166666666666666
66666666666666161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161666666666666666
66666666666666616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616166666666666666
66666666666666161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161666666666666666
66666666666666616161616161616777776161616771777177717771776161617171777171617161777171716161677777616161616161616166666666666666
66666666666666161616161616167771177616167611717171117111717616167171717171167116711171711616771177761616161616161666666666666666
66666666666666616161616161617711677161617161776177617761717161617171777171617161776177716161771167716161616161616166666666666666
66666666666666161616161616167776177116167176717671167116717116167771717171167116711611711616771677711616161616161666666666666666
66666666666666616161616161616777771161617771717177717771717161616711717177717771777177716161677777116161616161616166666666666666
66666666666666161616161616161611111616161111111111111111111116161616111111111111111111111616161111161616161616161666666666666666
66666666666666616161616161616161616161616161616161616161616161618161616161616161616161616161616161616161616161616166666666666666
666666666666661616161616161616161616161616161616161618161616161618161616161616161616161616161616161616161r1q1r161666666666666666
666666666666666161616161616161616161616161616161616181817161616181616161616161616161616161616161616161r1r1q1r1q16166666666666666
6666666666666616161616161616161616161616161616161616161616171617161616161616161616161616161616161616161r1r1r1r1q1666666666666666
6666666666666c6161616161616161616161616161616167777761616177617771717161616777776161616161616161616161r1r1q1q1q16166666666666663
6666666666c6c616161616161616161616161616161616777117761616717671717171161677117776161616161616161616161r1r1q1q1q1q66666666j6j636
666c6c666c6c6c6161616161616161616161616161616177116771616171717771777171717711677161616161616161616161r181q1q1q1q1rrrrrrqq6j6j63
c6c6c6c6c6c6c6161616161616161616161616161616167776177116167171717111711618771677711616161616161616161r17151q1q1q1qrrrrrrqqqqj636
6c6c6c6c6c6c6c61616161616161616161616161616161677777116161777171717771616187777711616161616161616161r1r1r1q1q1q1q1qqrrrrqqqqqqrr
c6c6c6c6c6c6c6161616161616161616161616161616161611111616161111111111111616161111161616161616161616161r1r1r1q1q1q1qqqrrrrqqqqqqrr
6j6c6j6c6c6c6c61616161616161616161616161616161616161616161616161616161616161616161616161616161616131r1r1r1q1q1q1q1qqqqqqqqqqqqrr
j6j6j636c6c6c61616161616161616161616161616161616161616161616161616161616161616161616161616161616161r1r1r1q1q1q1q1qqqqqqqqqqqqqrr
6j6j33636c6c6c616161616161616161616161616161616161616161616161616161616161616161616161616161616131r1r1r1q1q1q1q1q1qqqqqqqqqqqqrr
j6j63336c6c6c616161616161616161616161616161616161616161616161616161616161616161616161616161616161r1r1r1r1q1q1q1q1qqqqqqqqqqqqqqq
6j333333636j6c6161616161616161616161616161616171617771776177617771777177717171677161616161616161r1r1r1r1q1q1q1q1q1qqqqqqqqqqqqqq
33333333jj36j616161616161616161616161616161616711671717176717677717171717171717611161616161616131r1r1r1r1r1q1q1q1qqqqqqqqqqqqqqq
33rr3333jj33636161616161616161616161616161616171617771717171717171777177617761777161616161616131r1r1r1r1r1q1q1q1q1qqqqqqqqqqqqqq
33rrrr33jj333616161616161616161616161616161616711671717171717171717171717671761171161616161616131r1r1r1r1r1q1q1q1qqqqqqqqqqqqqqq
33rrrr33jj336j6161616161616161616161616161616177717171717177717171717171717171776161616161613131r1r1r181r1q1q1q1q1qqqqqqqqqqqqqq
33rrrr33jj33331q161616161616161616161616161616111111111111111111111111111111111116161616161313131r1818181r1q1q1q1qqqqqqqqqqqqqqq
33rrrr33jj3333q1q1616161616161616161616161616161616161616161616161616161616161616161616161313131r1r17151r1r1q1q1q1qqqqqqqqqqqqqq
jjrrrr33jj33331q1q1q13161616161616161616161616161616161616161616161616161616161616161616131313131r1r1r1r1r1q1q1q1qqqqqqqqqqqqqqq
jjrrrr333333rrq1q1q131r1616161616161616161616161616161616161616161616161616161616161616131313131r1r1r1r1r1r1q1q1q1qqqqqqqqqqqqqq
jjrrrr333333rr1q131r131r1616161616161616161616161616161616161616161616161616161616161613131313131r1r1r1r1r1q1q1q1qqqqqqqqqqqqqqq
jjrrrr333333rr3131r1r1r1616161616161616161616161616177717771776167717771677161616161613131313131r131r1r1r1r1q1q1q1qqqqqqqqqqqqqq
jjrrrr33rr33rr13131r1r1r131616161616161616161616161671717171717676117111761116161316131313131313131r1r1r1r1q1q1q1qqqqqqqqqqqqqqq
qrrrrr33rr33rrq131r1r1r131r161616161616161616161616177617771717171617761777161j131a131313131313131r1r1r1r1r1r1q1q1qqqqqqqqqqqqqq
rrrrrr33rr33rr1q1q1r1r1r131r1r16161616161616161616167176717171717176711611711j1j131a1313131313131r1r1r1r1r1r1r1q1qqqqqqqqqqqqqqq
33qrrrr3rr33rrq1q1r1r1r131r1r1r1616161616161616161617771717177717771777177j1j1j131a13131313131313131r131r1r1r1q1q1qqqqqqqqqqqqqq
3333rrrrrrrrrr1q1q1r1r1r1r1r1r1r1616161616161616161611111111111111111111111j1j1j131a131313131313131r131r1r13131q1qqqqqqqqqqqqqqq
333333rrrrrrrrq1q1r1r1r1r1r1r1r131616161616161616161616161616161j1j1j13131j1j1j131a1r1313131r1r13141r1r1r1r131q1q1qqqqqqqqqqqqqq
333333rqrqrrrr1q1q1r1r1r1r1q1r1r1316161616161616161616161616161j1j1j1j13131j1j1j131r1r1313131r1r13131r1r1q1r131q1qqqqqqqqqqqqqqq
3333r3r333qrrr3131r1r1r1r1q1r1q131r161616161616161616161616161j1j1j1j13131j1j1313131r1313131r1r13131r1r1r1r1r131q1qqqqqqqqqqqqqq
33333rr3333qrr13131r1r1r1r1q1r1q131r1r1616161616161616161616161j1j1j1j13131j1j131313131313131r1r1313131r1q1q1q1q1qqqqqqqqqqqqqqq
qq33r3r33333qr3131r1r1r1r1q1r1q131r1r1r1616171716771717161617771j771j13177717131717131313131r1r13131r1r1r1q1q1q1q1qqqqqqqqqqqqqq
qq333rrrr3333q13131r1r1r1r1q1r1q1r1r1r1r1r1q717176717171161617117j711j13711171137171131313131r1r1r1r1r1r1q1q1q1q1qqqqqqqrqqqqqqq
qq33r3rrr3333rq131r1r1r1r1q1r1q1r1r1r1r1r1q1777171717171616137117171313177j1713177713131313131r1r1r1r1r1r1q1q1q1q1qqqqqrqqqqqqqq
qqqq3rrrr333331q13131r1r1r1q131q1r1q1r1r1r1q7171717177711614171371711313711j711r117113131313131r1r1r1r1r1q1q1q1q1qrqrrrqrqqqqqqq
qqqqq3rrrrr333313131r1r1r13131r1r1q1r1r1r1q1717177117771s14137117731313171j177717771313131313131r1r1r1r1r1q1q1q1q1qrqrrrqqqqqqqq
qqqqqqrrrrr33r1r1r13131r1r13131r1r1q1r1r1r1q1111111111111s14131311131r13111j1111111113131313131r1r1r1r1r1r1q1q1q1qrqrrrqrqqqqqqq
qqqqqrqrrrr33331r13131r1r13131r1r1q1r13131q1f11111111111313131313131r1q1r1r1313131313131313131r1r1r1r1r1r1q1q1q1q1qrqrrrqqqqqqqq
qqq33qrrrrr33r1r1r13131r1r1r131r1r1313131r1f1313131111111313131313131r1r13131313131313131r13131r1r1r1r1r1r1q1q1q1qrqrrrqrqqqqqqq
qqq33rqrrrr3r3r1r13131r1r131r13131313131r131313131311131313131313131r1q1r1313131313131r1r13131r1r1r1r1r1r1q1q1q1q1qrqrrrqqqqqqqq
qqqq3333rrrr3r1r1q13131r1r131r1313131313131r131313131313131r1q1313131r1q1413131r13131r1r1r13131r1r1r1r1r1r1q1q1q1qqqrrrqrqqqqqqq
qqqq3333rrr3r3rrqr3333r3rr333333rr33333333r333333333333333r3rrq33333333333333333qrqrrrr3r33333rrrrrrrrrrrrqrqqqqqqqqqrrrqqqqqqqq
rrqq3333rrrr3rrrrq33333rrr3r3333rrrq3r33333r3333rr3r3r33333r3qrqr3333333333333333qrqrr3r333333rrrrrrrrrrrrrqqqrqqqqqqqrqrqqqqqqq
rrqq333333r3r3rrqrq333r3rrq33333rrqrr33rr3r333r3r333333333r3rrqrq333333333333333333rrrr3333333rrrrrrrrrrrrqrqrqrqqqqqqqqqqqqqqqr
rrqq3r3333r33r3rrqqqr33rrqrqr333rrrq3r3rrqrr3rrqr333333333333r3qr333333333333333rqr33333333333rrrrrrrrrqqqrqrqrqqqqqqqqqqqqqqqrq
rrqqr33333r3r333qrq333r33333rr3333qr333rr333r3333333rrr3333333rrr333333333333333qrqrr333333333rrrrrqqqqqqqqrqrqrqqqqqqqqqqqrrrqr
rrrqrr33333r3333r333333333333rrr33333333333r3r333333rrrr33333r333333333333333333rqrrr333333333rrqqqqqqqqqqrqrqrqqqqqqqqqqqrrrrrq
rrqrq3r3r3r3rrr3333333rrrr33r3rr333333333333r3rr333333rrr33rr3333333333333333333qrqrr333333333rrqqqqqqqqqqqrqrqrqqqqqqqqqrqrrrqr
qrrqrr3r333r3rrqrq333r3rrr333rrrrrr33333333r3rrr333333rrrrrrr333333333333r3r3333rqrrr33333333rrrqqqqqqqqqqrqrqrqqqqqrqqqqqrrrrrq
qrqrq3r3r3r3rrrrqr3333rrrrqrr3rrrrr333333333r3rr333333rrqrrrr3333333333333r33333qrqr333333r33rrrqqqqqqqqqqqrqrrrqrqrqqqqqrqrrrqr
qrrqrr3r3rrr3rrqrqqq3r3rrrrqrqrrrrr33333333r3rrr33333r33333333333333333333333333rq33333333rrrrrrqqqqqqqqqqrqrrrrrqrqqqqqqqrrrrrq
qrqrq3r3rrrrrrrrqrqq33rrrrqrqrr3r333rqqq3333r3rrrrqrrr333333333333333333333333333333333333rrrrrrqqqqqqqqqqqrqrrrqrqrqqqqqrqrrrqr
qrrqrr3r3rrr3rrqrqqq3r3rrrrqrq3r333r3qqq333r3r3rrqrqrr333333333333333333333333333333333333rrrrrrqqqqqqqqqqrrrrrrrqrqqqqqqqrrrrrq
__sfx__
001000010832000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00020000183301a3301c3201f31000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
0005000024350243502d3502d3402d3302d3202d31000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
000600000c2100d2310e2410f24110231112211121000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
000200003003000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
0006000024050280502b0503005030030300100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
000400002b05030050300200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
