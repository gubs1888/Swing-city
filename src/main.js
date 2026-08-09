import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import './style.css';
import './realism.css';
import './sound.css';

const app = document.querySelector('#app');
const speedEl = document.querySelector('#speed');
const statusEl = document.querySelector('#status');
const startScreen = document.querySelector('#startScreen');
const startBtn = document.querySelector('#startBtn');
const leftWebBtn = document.querySelector('#leftWeb');
const rightWebBtn = document.querySelector('#rightWeb');
const speedFrame = document.querySelector('.speedFrame');
const soundToggle = document.querySelector('#soundToggle');

// Procedural Web Audio keeps traversal responsive without external assets.
let audioContext=null,masterGain=null,windGain=null,windFilter=null;
let soundMuted=false,lastImpactSound=0;
function initAudio(){
  if(audioContext){if(audioContext.state==='suspended')audioContext.resume();return;}
  audioContext=new (window.AudioContext||window.webkitAudioContext)();
  masterGain=audioContext.createGain();masterGain.gain.value=.48;masterGain.connect(audioContext.destination);
  const frames=audioContext.sampleRate*2;
  const buffer=audioContext.createBuffer(1,frames,audioContext.sampleRate);
  const data=buffer.getChannelData(0);
  let smooth=0;
  for(let i=0;i<frames;i++){smooth=smooth*.88+(Math.random()*2-1)*.12;data[i]=smooth;}
  const wind=audioContext.createBufferSource();wind.buffer=buffer;wind.loop=true;
  windFilter=audioContext.createBiquadFilter();windFilter.type='bandpass';windFilter.frequency.value=700;windFilter.Q.value=.65;
  windGain=audioContext.createGain();windGain.gain.value=0;
  wind.connect(windFilter).connect(windGain).connect(masterGain);wind.start();
}
function tone(from,to,duration=.12,volume=.13,type='sine'){
  if(!audioContext||soundMuted)return;
  const now=audioContext.currentTime;
  const osc=audioContext.createOscillator(),gain=audioContext.createGain();
  osc.type=type;osc.frequency.setValueAtTime(from,now);osc.frequency.exponentialRampToValueAtTime(Math.max(25,to),now+duration);
  gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(volume,now+.012);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
  osc.connect(gain).connect(masterGain);osc.start(now);osc.stop(now+duration+.02);
}
function noiseBurst(duration=.1,volume=.1,frequency=500){
  if(!audioContext||soundMuted)return;
  const frames=Math.ceil(audioContext.sampleRate*duration);
  const buffer=audioContext.createBuffer(1,frames,audioContext.sampleRate),data=buffer.getChannelData(0);
  for(let i=0;i<frames;i++)data[i]=(Math.random()*2-1)*(1-i/frames);
  const source=audioContext.createBufferSource(),filter=audioContext.createBiquadFilter(),gain=audioContext.createGain();
  source.buffer=buffer;filter.type='bandpass';filter.frequency.value=frequency;filter.Q.value=.8;gain.gain.value=volume;
  source.connect(filter).connect(gain).connect(masterGain);source.start();
}
function playWebShot(which){tone(which==='left'?740:860,165,.16,.11,'sawtooth');noiseBurst(.1,.08,1500);}
function playWebRelease(which){tone(which==='left'?260:310,120,.08,.055,'triangle');}
function playJump(){tone(150,390,.13,.11,'triangle');noiseBurst(.07,.04,650);}
function playLanding(impact){
  const strength=THREE.MathUtils.clamp((impact-4)/24,.15,1);
  tone(90,42,.16,.16*strength,'sine');noiseBurst(.13,.13*strength,170);
}
function playWallImpact(impact){
  const now=performance.now();if(now-lastImpactSound<180)return;lastImpactSound=now;
  const strength=THREE.MathUtils.clamp(impact/30,.18,.75);
  tone(120,58,.1,.1*strength,'square');noiseBurst(.08,.08*strength,260);
}
function toggleSound(){
  initAudio();soundMuted=!soundMuted;
  masterGain.gain.setTargetAtTime(soundMuted?0:.48,audioContext.currentTime,.025);
  soundToggle.textContent=soundMuted?'SOUND OFF':'SOUND ON';
  soundToggle.setAttribute('aria-pressed',String(soundMuted));
  soundToggle.setAttribute('aria-label',soundMuted?'Unmute sound':'Mute sound');
}
function updateAudio(speed,swinging,dt){
  if(!audioContext||!windGain)return;
  const target=soundMuted?0:THREE.MathUtils.clamp((speed-5)/70,0,.34)*(swinging?1.14:1);
  windGain.gain.setTargetAtTime(target,audioContext.currentTime,Math.max(.035,dt*3));
  windFilter.frequency.setTargetAtTime(420+Math.min(speed,75)*18,audioContext.currentTime,.08);
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x70b9e3);
scene.fog = new THREE.FogExp2(0xbcd8df, 0.0009);
const crowdScene=new THREE.Scene();
crowdScene.fog=scene.fog;

const camera = new THREE.PerspectiveCamera(82, innerWidth / innerHeight, 0.1, 2400);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
app.appendChild(renderer.domElement);

const composer=new EffectComposer(renderer);
composer.setPixelRatio(Math.min(devicePixelRatio,1.1));
composer.addPass(new RenderPass(scene,camera));
const ssaoPass=new SSAOPass(scene,camera,innerWidth,innerHeight,16);
ssaoPass.kernelRadius=8;
ssaoPass.minDistance=.0015;
ssaoPass.maxDistance=.085;
composer.addPass(ssaoPass);
const crowdPass=new RenderPass(crowdScene,camera);
crowdPass.clear=false;
composer.addPass(crowdPass);
composer.addPass(new OutputPass());

// Procedural day/night sky with cloud cover, stars, and a moon disc.
const skyMaterial=new THREE.ShaderMaterial({
    side:THREE.BackSide,depthWrite:false,
    uniforms:{nightMix:{value:0}},
    vertexShader:`varying vec3 vP; void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`
      varying vec3 vP;
      uniform float nightMix;
      float cloud(vec3 p){
        return sin(p.x*7.4+sin(p.z*5.1))*sin(p.z*8.2-p.x*2.7)*.5+.5;
      }
      float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
      void main(){
        vec3 d=normalize(vP);
        float horizon=smoothstep(-.12,.55,d.y);
        vec3 low=vec3(.63,.80,.89), high=vec3(.24,.62,.86);
        float c=smoothstep(.34,.76,cloud(d*2.8)+cloud(d.zxy*5.3)*.28);
        vec3 dayCol=mix(low,high,horizon);
        dayCol=mix(dayCol,vec3(.98,.98,.95),c*.72*smoothstep(-.05,.75,d.y));
        vec3 nightCol=mix(vec3(.025,.045,.085),vec3(.004,.009,.025),horizon);
        float stars=step(.9965,hash(floor(d*420.0)))*smoothstep(.05,.35,d.y)*(1.0-c*.6);
        float moon=smoothstep(.9984,.9995,dot(d,normalize(vec3(-.42,.72,.28))));
        nightCol+=stars*vec3(.7,.82,1.0)+moon*vec3(1.0,.94,.73)*1.8;
        vec3 col=mix(dayCol,nightCol,nightMix);
        gl_FragColor=vec4(col,1.);
      }`,
  });
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(1350,32,18),
  skyMaterial
);
scene.add(sky);

const ambientLight=new THREE.HemisphereLight(0xf5fbff, 0x594f42, 2.55);
scene.add(ambientLight);
const sun = new THREE.DirectionalLight(0xfff2d0, 2.15);
sun.position.set(-150, 240, 110);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -150; sun.shadow.camera.right = 150;
sun.shadow.camera.top = 150; sun.shadow.camera.bottom = -150;
sun.shadow.camera.near = 1; sun.shadow.camera.far = 450;
sun.shadow.bias = -.00012;
sun.shadow.normalBias = .045;
scene.add(sun);
scene.add(sun.target);

const world = new THREE.Group();
scene.add(world);
const colliders = [];
const buildingMeshes = [];
const swingAnchors = [];
const doorInstances = [];
const windowInstances = [];
const balconyInstances = [];
const railingInstances = [];
const corniceInstances = [];
const rooftopUnitInstances = [];
const warmWindowLightInstances=[];
const coolWindowLightInstances=[];
const buildingLightMaterials=[];
const nightBuildingMaterials=[];

const ROAD = 15;
const BLOCK = 45;
const CELL = ROAD + BLOCK;
const HALF_CITY = 12;
const BUILDING_HEIGHT_SCALE = .34;
const UP = new THREE.Vector3(0, 1, 0);
const COLLIDER_GRID_SIZE=60;
const colliderGrid=new Map();
const swingAnchorGrid=new Map();

function colliderGridKey(x,z){return `${x},${z}`;}
function buildColliderGrid(){
  colliderGrid.clear();
  for(const collider of colliders){
    const minGX=Math.floor(collider.minX/COLLIDER_GRID_SIZE),maxGX=Math.floor(collider.maxX/COLLIDER_GRID_SIZE);
    const minGZ=Math.floor(collider.minZ/COLLIDER_GRID_SIZE),maxGZ=Math.floor(collider.maxZ/COLLIDER_GRID_SIZE);
    for(let gx=minGX;gx<=maxGX;gx++)for(let gz=minGZ;gz<=maxGZ;gz++){
      const key=colliderGridKey(gx,gz);
      if(!colliderGrid.has(key))colliderGrid.set(key,[]);
      colliderGrid.get(key).push(collider);
    }
  }
}

function nearbyColliders(start,end,padding=3){
  const minGX=Math.floor((Math.min(start.x,end.x)-padding)/COLLIDER_GRID_SIZE);
  const maxGX=Math.floor((Math.max(start.x,end.x)+padding)/COLLIDER_GRID_SIZE);
  const minGZ=Math.floor((Math.min(start.z,end.z)-padding)/COLLIDER_GRID_SIZE);
  const maxGZ=Math.floor((Math.max(start.z,end.z)+padding)/COLLIDER_GRID_SIZE);
  const nearby=new Set();
  for(let gx=minGX;gx<=maxGX;gx++)for(let gz=minGZ;gz<=maxGZ;gz++){
    for(const collider of colliderGrid.get(colliderGridKey(gx,gz))??[])nearby.add(collider);
  }
  return nearby;
}

function buildSwingAnchorGrid(){
  swingAnchorGrid.clear();
  for(const anchor of swingAnchors){
    const key=colliderGridKey(Math.floor(anchor.x/COLLIDER_GRID_SIZE),Math.floor(anchor.z/COLLIDER_GRID_SIZE));
    if(!swingAnchorGrid.has(key))swingAnchorGrid.set(key,[]);
    swingAnchorGrid.get(key).push(anchor);
  }
}

function nearbySwingAnchors(position,range){
  const minGX=Math.floor((position.x-range)/COLLIDER_GRID_SIZE);
  const maxGX=Math.floor((position.x+range)/COLLIDER_GRID_SIZE);
  const minGZ=Math.floor((position.z-range)/COLLIDER_GRID_SIZE);
  const maxGZ=Math.floor((position.z+range)/COLLIDER_GRID_SIZE);
  const nearby=[];
  for(let gx=minGX;gx<=maxGX;gx++)for(let gz=minGZ;gz<=maxGZ;gz++){
    nearby.push(...(swingAnchorGrid.get(colliderGridKey(gx,gz))??[]));
  }
  return nearby;
}

const mats = {
  ground: new THREE.MeshStandardMaterial({ color: 0x7b7a70, roughness: 1 }),
  road: new THREE.MeshStandardMaterial({ color: 0x282b2c, roughness: .9 }),
  sidewalk: new THREE.MeshStandardMaterial({ color: 0xb2aa96, roughness: .94 }),
  stripe: new THREE.MeshBasicMaterial({ color: 0xd7d2ae }),
  roof: new THREE.MeshStandardMaterial({ color: 0x777262, roughness: .82 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x59646a, emissive: 0x11181b, roughness: .28, metalness: .24 }),
  darkGlass: new THREE.MeshStandardMaterial({ color: 0x252a2b, emissive: 0x090c0d, roughness: .25, metalness: .3 }),
  copper: new THREE.MeshStandardMaterial({ color: 0x57a77f, roughness: .54, metalness: .48 }),
};

const textureLoader=new THREE.TextureLoader();
function loadFacadeTexture(path,color=true){
  const texture=textureLoader.load(path);
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.anisotropy=Math.min(16,renderer.capabilities.getMaxAnisotropy());
  if(color)texture.colorSpace=THREE.SRGBColorSpace;
  return texture;
}
const facadePatterns=[
  loadFacadeTexture('/assets/textures/limestone-facade.webp'),
  loadFacadeTexture('/assets/textures/limestone-facade.webp'),
  loadFacadeTexture('/assets/textures/dark-office-facade.webp'),
];
const facadeHeights=[
  loadFacadeTexture('/assets/textures/limestone-facade-height.webp',false),
  loadFacadeTexture('/assets/textures/limestone-facade-height.webp',false),
  loadFacadeTexture('/assets/textures/dark-office-facade-height.webp',false),
];
const facadeRoughness=[
  loadFacadeTexture('/assets/textures/limestone-facade-roughness.webp',false),
  loadFacadeTexture('/assets/textures/limestone-facade-roughness.webp',false),
  loadFacadeTexture('/assets/textures/dark-office-facade-roughness.webp',false),
];

function cloneFacadeMap(source,w,h,tone){
  const map=source.clone();
  map.wrapS=map.wrapT=THREE.RepeatWrapping;
  map.repeat.set(Math.max(1,w/17),Math.max(1.5,h/44));
  map.offset.set((tone%17)/17,((tone>>4)%13)/13);
  map.needsUpdate=true;
  return map;
}

function buildingMaterial(tone,glassy,w,h,style){
  const map=cloneFacadeMap(facadePatterns[style],w,h,tone);
  const bumpMap=cloneFacadeMap(facadeHeights[style],w,h,tone);
  const roughnessMap=cloneFacadeMap(facadeRoughness[style],w,h,tone);
  const material=new THREE.MeshStandardMaterial({
    color:style===2?0xffffff:new THREE.Color(tone).lerp(new THREE.Color(0xffffff),.88),
    map,bumpMap,bumpScale:style===2?.075:.13,roughnessMap,
    roughness:style===2?.7:1,metalness:style===2?.18:.02,
    emissive:style===2?0x17202a:0x2c1d0d,emissiveMap:map,emissiveIntensity:0,
  });
  nightBuildingMaterials.push({material,intensity:style===2?.24:.15});
  return material;
}

const ground = new THREE.Mesh(new THREE.PlaneGeometry(1700, 1700), mats.ground);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
world.add(ground);

function seeded(x, z, salt = 0) {
  const s = Math.sin(x * 127.1 + z * 311.7 + salt * 74.7) * 43758.5453123;
  return s - Math.floor(s);
}

function instancePart(list,x,y,z,sx,sy,sz){
  list.push({position:new THREE.Vector3(x,y,z),scale:new THREE.Vector3(sx,sy,sz)});
}

function addFacadeFeatures(cx,cz,w,d,h){
  const doorSide=seeded(cx,cz,21)>.5?1:-1;
  instancePart(doorInstances,cx,1.7,cz+doorSide*(d/2+.065),Math.min(2.2,w*.16),3.4,.13);
  swingAnchors.push(new THREE.Vector3(cx,3.25,cz+doorSide*(d/2+.18)));

  // Every repeated punched-window group is also a usable web target.
  for(const ratio of [.3,.56,.79]){
    const y=Math.min(h-5,Math.max(7,h*ratio));
    for(const side of [-1,1]){
      swingAnchors.push(new THREE.Vector3(cx,y,cz+side*(d/2+.22)));
      swingAnchors.push(new THREE.Vector3(cx+side*(w/2+.22),y,cz));
    }
  }

  // Two usable balconies per tower, alternating between perpendicular faces.
  for(let i=0;i<2;i++){
    const level=Math.min(h-4,Math.max(7,h*(i===0?.38:.67)));
    const side=seeded(cx,cz,24+i)>.5?1:-1;
    const onZ=(i+Math.floor(seeded(cx,cz,26)*2))%2===0;
    const width=Math.min(4.6,Math.max(3.2,(onZ?w:d)*.18));
    const depth=.95;
    if(onZ){
      const innerZ=cz+side*d/2,centerZ=innerZ+side*depth/2;
      instancePart(balconyInstances,cx,level-.12,centerZ,width,.24,depth);
      instancePart(railingInstances,cx,level+.43,innerZ+side*(depth-.05),width,.9,.08);
      colliders.push({minX:cx-width/2,maxX:cx+width/2,minZ:Math.min(innerZ,innerZ+side*depth),maxZ:Math.max(innerZ,innerZ+side*depth),bottom:level-.24,top:level});
      swingAnchors.push(new THREE.Vector3(cx,level+.85,innerZ+side*depth));
    }else{
      const innerX=cx+side*w/2,centerX=innerX+side*depth/2;
      instancePart(balconyInstances,centerX,level-.12,cz,depth,.24,width);
      instancePart(railingInstances,innerX+side*(depth-.05),level+.43,cz,.08,.9,width);
      colliders.push({minX:Math.min(innerX,innerX+side*depth),maxX:Math.max(innerX,innerX+side*depth),minZ:cz-width/2,maxZ:cz+width/2,bottom:level-.24,top:level});
      swingAnchors.push(new THREE.Vector3(innerX+side*depth,level+.85,cz));
    }
  }
}

function addInstancedParts(items,material,castShadow=false){
  if(!items.length)return;
  const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),material,items.length);
  const dummy=new THREE.Object3D();
  items.forEach((item,index)=>{
    dummy.position.copy(item.position);dummy.scale.copy(item.scale);dummy.updateMatrix();
    mesh.setMatrixAt(index,dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate=true;
  mesh.castShadow=castShadow;mesh.receiveShadow=true;
  world.add(mesh);
}

function addTowerMass(cx,cz,w,d,bottom,height,material){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,height,d),material);
  mesh.position.set(cx,bottom+height/2,cz);
  mesh.castShadow=true;mesh.receiveShadow=true;world.add(mesh);
  buildingMeshes.push(mesh);
  colliders.push({minX:cx-w/2,maxX:cx+w/2,minZ:cz-d/2,maxZ:cz+d/2,bottom,top:bottom+height,mesh});
  // One attachment row per architectural floor, on every facade. Keeping the
  // spacing consistent with the photographic texture makes the web appear to
  // connect directly to real window levels.
  const floorHeight=3.55;
  let floorIndex=0;
  for(let y=bottom+floorHeight*.72;y<bottom+height-.8;y+=floorHeight,floorIndex++){
    swingAnchors.push(new THREE.Vector3(cx,y,cz+d/2+.18),new THREE.Vector3(cx,y,cz-d/2-.18));
    swingAnchors.push(new THREE.Vector3(cx+w/2+.18,y,cz),new THREE.Vector3(cx-w/2-.18,y,cz));
    const lightRoll=seeded(cx+floorIndex*3.1,cz-floorIndex*2.7,45);
    if(lightRoll>.42&&w>4&&d>4){
      const lights=lightRoll>.72?warmWindowLightInstances:coolWindowLightInstances;
      const zSide=seeded(cx,cz+floorIndex,46)>.5?1:-1;
      const xSide=seeded(cx-floorIndex,cz,47)>.5?1:-1;
      const xOffset=(seeded(cx,cz,floorIndex+51)-.5)*Math.max(0,w-3.2)*.7;
      const zOffset=(seeded(cx,cz,floorIndex+71)-.5)*Math.max(0,d-3.2)*.7;
      for(const pane of [-1,1]){
        instancePart(lights,cx+xOffset+pane*.58,y,cz+zSide*(d/2+.035),.82,1.28,.07);
        instancePart(lights,cx+xSide*(w/2+.035),y,cz+zOffset+pane*.58,.07,1.28,.82);
      }
      if(w>9&&d>9){
        for(const pane of [-1,1]){
          instancePart(lights,cx+xOffset+pane*.58,y,cz-zSide*(d/2+.035),.82,1.28,.07);
          instancePart(lights,cx-xSide*(w/2+.035),y,cz+zOffset+pane*.58,.07,1.28,.82);
        }
      }
    }
  }
  return bottom+height;
}

function addCornice(cx,cz,w,d,y){
  const overhang=.42,height=.3;
  instancePart(corniceInstances,cx,y+height/2,cz,w+overhang*2,height,d+overhang*2);
  colliders.push({
    minX:cx-w/2-overhang,maxX:cx+w/2+overhang,
    minZ:cz-d/2-overhang,maxZ:cz+d/2+overhang,
    bottom:y,top:y+height,
  });
}

function addRooftopUnits(cx,cz,w,d,y,seed){
  const count=w>12&&d>12?2:1;
  for(let i=0;i<count;i++){
    const unitW=Math.min(3.8,w*(i? .18:.24));
    const unitD=Math.min(3.3,d*(i? .22:.17));
    const unitH=1.5+seeded(seed,i,34)*1.8;
    const x=cx+(i?-.16:.17)*w;
    const z=cz+(i?.13:-.15)*d;
    instancePart(rooftopUnitInstances,x,y+unitH/2,z,unitW,unitH,unitD);
    colliders.push({minX:x-unitW/2,maxX:x+unitW/2,minZ:z-unitD/2,maxZ:z+unitD/2,bottom:y,top:y+unitH});
    swingAnchors.push(new THREE.Vector3(x,y+unitH+.25,z));
  }
}

function addBuilding(cx, cz, w, d, h, tone, glassy = false) {
  const profile=seeded(cx,cz,12);
  const modern=profile<.22;
  const style=modern?2:(seeded(cx,cz,14)>.5?0:1);
  const mat=buildingMaterial(tone,modern,w,h,style);

  if(modern){
    // The reference mixes a few severe dark office slabs among the older
    // limestone towers.
    addTowerMass(cx,cz,w,d,0,h,mat);
    addFacadeFeatures(cx,cz,w,d,h);
    const roofW=w*.3,roofD=d*.28,roofH=2.2;
    const top=addTowerMass(cx,cz,roofW,roofD,h,roofH,mats.roof);
    addRooftopUnits(cx,cz,roofW,roofD,top,cx+cz);
    return;
  }

  // Classic Manhattan zoning envelope: broad masonry base followed by a
  // sequence of narrower setbacks and an articulated crown.
  const landmark=profile>.88&&h>85;
  const baseH=h*(landmark?.58:.64);
  const middleH=h*(landmark?.2:.2);
  const upperH=h*(landmark?.15:.12);
  let top=addTowerMass(cx,cz,w,d,0,baseH,mat);
  addFacadeFeatures(cx,cz,w,d,baseH);
  addCornice(cx,cz,w,d,top);
  top=addTowerMass(cx,cz,w*.82,d*.82,top,middleH,mat);
  addCornice(cx,cz,w*.82,d*.82,top);
  top=addTowerMass(cx,cz,w*.62,d*.62,top,upperH,mat);
  addCornice(cx,cz,w*.62,d*.62,top);

  if(landmark){
    // Stepped oxidized-copper roof recreates the green Art Deco spires that
    // dominate the right side of the supplied reference.
    const roofHeight=Math.max(8,h*.12);
    for(let step=0;step<5;step++){
      const stepH=roofHeight/5;
      const scale=.5-step*.075;
      top=addTowerMass(cx,cz,w*scale,d*scale,top,stepH,mats.copper);
    }
    const finialH=Math.max(4,h*.035);
    top=addTowerMass(cx,cz,.55,.55,top,finialH,mats.copper);
  }else{
    const capH=Math.max(2.4,h*.04);
    top=addTowerMass(cx,cz,w*.42,d*.42,top,capH,mat);
    if(h>70){
      const plantH=2.1;
      top=addTowerMass(cx,cz,w*.2,d*.18,top,plantH,mats.roof);
    }
    addRooftopUnits(cx,cz,w*.42,d*.42,top,cx-cz);
  }
}

for (let gx=-HALF_CITY; gx<=HALF_CITY; gx++) {
  for (let gz=-HALF_CITY; gz<=HALF_CITY; gz++) {
    const cx = gx * CELL, cz = gz * CELL;
    const slab = new THREE.Mesh(new THREE.BoxGeometry(BLOCK,.42,BLOCK), mats.sidewalk);
    slab.position.set(cx,.21,cz); slab.receiveShadow = true; world.add(slab);

    const downtown = Math.max(0, 1 - Math.hypot(gx,gz)/(HALF_CITY*1.28));
    const skylineOutlier=(gx===0&&gz===0)||(gx===-3&&gz===2)||(gx===4&&gz===-2)||(gx===1&&gz===4)||(gx===-4&&gz===-3);
    const split = !skylineOutlier&&seeded(gx,gz,1) > .62;
    if (!split) {
      const inset=2.7;
      const h=(48 + seeded(gx,gz,2)*125 + downtown*105)*BUILDING_HEIGHT_SCALE*(skylineOutlier?2.35:1);
      const palette=[0xd2c39f,0xe1d5b7,0xb9aa85,0xc8b78f,0x9e8d6d,0x766b58,0x3d3a34];
      const glassy=seeded(gx,gz,7)>.78;
      addBuilding(cx,cz,BLOCK-inset*2,BLOCK-inset*2,h,palette[Math.floor(seeded(gx,gz,5)*palette.length)],glassy);
    } else {
      const gap=3, w=(BLOCK-gap*3)/2;
      for (let ix=-1; ix<=1; ix+=2) for (let iz=-1; iz<=1; iz+=2) {
        const bx=cx+ix*(w+gap)/2, bz=cz+iz*(w+gap)/2;
        const h=(34+seeded(gx*3+ix,gz*3+iz,8)*105+downtown*58)*BUILDING_HEIGHT_SCALE;
        const palette=[0xd8caab,0xc1b18d,0xe4dac1,0xa69574,0x675f50];
        addBuilding(bx,bz,w,w,h,palette[Math.floor(seeded(bx,bz,4)*palette.length)],seeded(bx,bz,3)>.82);
      }
    }
  }
}

addInstancedParts(doorInstances,new THREE.MeshStandardMaterial({color:0x252321,emissive:0x0b0a09,roughness:.3,metalness:.5}),true);
addInstancedParts(windowInstances,new THREE.MeshStandardMaterial({color:0x34393a,roughness:.25,metalness:.3}),false);
addInstancedParts(balconyInstances,new THREE.MeshStandardMaterial({color:0xb9aa89,roughness:.86,metalness:.02}),true);
addInstancedParts(railingInstances,new THREE.MeshStandardMaterial({color:0x403d36,roughness:.38,metalness:.62}),false);
addInstancedParts(corniceInstances,new THREE.MeshStandardMaterial({color:0xd8caa7,roughness:.9,metalness:0}),true);
addInstancedParts(rooftopUnitInstances,new THREE.MeshStandardMaterial({color:0x6e706b,roughness:.74,metalness:.28}),true);
const warmWindowMaterial=new THREE.MeshStandardMaterial({color:0xffd993,emissive:0xffa62b,emissiveIntensity:0,roughness:.18,metalness:.08});
const coolWindowMaterial=new THREE.MeshStandardMaterial({color:0xc7e2ff,emissive:0x74aaff,emissiveIntensity:0,roughness:.16,metalness:.12});
buildingLightMaterials.push(warmWindowMaterial,coolWindowMaterial);
addInstancedParts(warmWindowLightInstances,warmWindowMaterial,false);
addInstancedParts(coolWindowLightInstances,coolWindowMaterial,false);
buildColliderGrid();
buildSwingAnchorGrid();

for (let i=-HALF_CITY-1; i<=HALF_CITY+1; i++) {
  const x=i*CELL+CELL/2;
  const rx=new THREE.Mesh(new THREE.PlaneGeometry(ROAD,1500),mats.road);
  rx.rotation.x=-Math.PI/2; rx.position.set(x,.012,0); world.add(rx);
  const z=i*CELL+CELL/2;
  const rz=new THREE.Mesh(new THREE.PlaneGeometry(1500,ROAD),mats.road);
  rz.rotation.x=-Math.PI/2; rz.position.set(0,.014,z); world.add(rz);
  for (let t=-650;t<650;t+=22) {
    const a=new THREE.Mesh(new THREE.PlaneGeometry(.32,8),mats.stripe);
    a.rotation.x=-Math.PI/2; a.position.set(x,.026,t); world.add(a);
    const b=new THREE.Mesh(new THREE.PlaneGeometry(8,.32),mats.stripe);
    b.rotation.x=-Math.PI/2; b.position.set(t,.027,z); world.add(b);
  }
}

// Manhattan street furniture: zebra crossings and closely spaced curb lights.
const crosswalkParts=[],streetlightPoles=[],streetlightHeads=[];
for(let gx=-10;gx<=10;gx++)for(let gz=-10;gz<=10;gz++){
  const x=gx*CELL+CELL/2,z=gz*CELL+CELL/2;
  if((gx+gz)%2===0){
    for(let stripe=-3;stripe<=3;stripe++){
      instancePart(crosswalkParts,x+stripe*1.45,.045,z-8, .68,.045,6.8);
      instancePart(crosswalkParts,x-8,.046,z+stripe*1.45,6.8,.045,.68);
    }
  }
  if(gx<10&&gz<10){
    for(const corner of [[-1,-1],[1,1]]){
      const lx=gx*CELL+corner[0]*21,lz=gz*CELL+corner[1]*21;
      instancePart(streetlightPoles,lx,2.65,lz,.11,5.3,.11);
      instancePart(streetlightHeads,lx,5.28,lz,.55,.18,.3);
    }
  }
}
addInstancedParts(crosswalkParts,new THREE.MeshStandardMaterial({color:0xe5e0d2,roughness:.9}),false);
addInstancedParts(streetlightPoles,new THREE.MeshStandardMaterial({color:0x202321,roughness:.42,metalness:.72}),true);
const streetlightMaterial=new THREE.MeshStandardMaterial({color:0xf5db9d,emissive:0xffb43b,emissiveIntensity:.18,roughness:.3});
addInstancedParts(streetlightHeads,streetlightMaterial,false);

// Moving traffic uses a few instanced parts, keeping a flooded road network to
// a handful of draw calls. Yellow cabs dominate, with private cars and buses mixed in.
const TRAFFIC_COUNT=1200;
const trafficVehicles=[];
const trafficBodyMesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({roughness:.31,metalness:.58}),TRAFFIC_COUNT);
const trafficCabinMesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({color:0x28363d,roughness:.12,metalness:.7}),TRAFFIC_COUNT);
const headlightMaterial=new THREE.MeshStandardMaterial({color:0xfff1bf,emissive:0xffd36a,emissiveIntensity:.8,roughness:.2});
const trafficLightMesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),headlightMaterial,TRAFFIC_COUNT*2);
const taxiSignMaterial=new THREE.MeshStandardMaterial({color:0xffd43b,emissive:0xe39300,emissiveIntensity:.12,roughness:.45});
const taxiSignMesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),taxiSignMaterial,TRAFFIC_COUNT);
trafficBodyMesh.castShadow=true;trafficBodyMesh.receiveShadow=true;trafficCabinMesh.castShadow=true;
world.add(trafficBodyMesh,trafficCabinMesh,trafficLightMesh,taxiSignMesh);
const trafficPalette=[0xf2c319,0xf2c319,0xf2c319,0xd8d8d3,0x22282c,0x8a1f1d,0x243f64];
for(let i=0;i<TRAFFIC_COUNT;i++){
  const route=i%46;
  const axis=route<23?'z':'x';
  const direction=seeded(i,31,2)>.5?1:-1;
  const roadIndex=route%23-11;
  const roadCenter=roadIndex*CELL+CELL/2;
  const routeSlot=Math.floor(i/46),routeSlots=Math.ceil(TRAFFIC_COUNT/46);
  const bus=i%17===0;
  const taxi=!bus&&i%7<3;
  trafficVehicles.push({
    axis,direction,roadCenter,
    travel:-700+(routeSlot+seeded(i,41,7)*.72)*(1400/routeSlots),
    speed:bus?7.5+seeded(i,5,1)*2.5:10+seeded(i,7,3)*8,
    width:bus?2.35:1.78,length:bus?9.5:4.25,height:.78,
    bus,taxi,
  });
  trafficBodyMesh.setColorAt(i,new THREE.Color(bus?0x2e5d86:taxi?0xf2c319:trafficPalette[i%trafficPalette.length]));
}
trafficBodyMesh.instanceColor.needsUpdate=true;

// Thousands of photographic pedestrians render in one draw call as camera-
// facing instanced planes using the transparent four-person atlas.
const PEDESTRIAN_COUNT=3200;
const pedestrianAtlas=textureLoader.load('/assets/sprites/pedestrians/pedestrian-atlas.png');
pedestrianAtlas.colorSpace=THREE.SRGBColorSpace;
const pedestrianPositions=new Float32Array(PEDESTRIAN_COUNT*3);
const pedestrianVariants=new Float32Array(PEDESTRIAN_COUNT);
const pedestrianScales=new Float32Array(PEDESTRIAN_COUNT);
const pedestrianGeometry=new THREE.InstancedBufferGeometry();
const pedestrianPlane=new THREE.PlaneGeometry(1,1);
pedestrianGeometry.index=pedestrianPlane.index;
pedestrianGeometry.setAttribute('position',pedestrianPlane.attributes.position);
pedestrianGeometry.setAttribute('uv',pedestrianPlane.attributes.uv);
const pedestrianPositionAttribute=new THREE.InstancedBufferAttribute(pedestrianPositions,3);
pedestrianPositionAttribute.setUsage(THREE.DynamicDrawUsage);
pedestrianGeometry.setAttribute('instancePosition',pedestrianPositionAttribute);
pedestrianGeometry.setAttribute('instanceVariant',new THREE.InstancedBufferAttribute(pedestrianVariants,1));
pedestrianGeometry.setAttribute('instanceScale',new THREE.InstancedBufferAttribute(pedestrianScales,1));
pedestrianGeometry.instanceCount=PEDESTRIAN_COUNT;
const pedestrianMaterial=new THREE.ShaderMaterial({
  uniforms:{map:{value:pedestrianAtlas},...THREE.UniformsLib.fog},
  transparent:true,depthWrite:false,fog:true,
  vertexShader:`
    attribute vec3 instancePosition;
    attribute float instanceVariant;
    attribute float instanceScale;
    varying vec2 vUv;
    #include <fog_pars_vertex>
    void main(){
      float column=mod(instanceVariant,2.0);
      float row=1.0-floor(instanceVariant/2.0);
      vUv=uv*.5+vec2(column,row)*.5;
      vec4 mvPosition=modelViewMatrix*vec4(instancePosition,1.0);
      mvPosition.xy+=position.xy*instanceScale;
      gl_Position=projectionMatrix*mvPosition;
      #include <fog_vertex>
    }`,
  fragmentShader:`
    uniform sampler2D map;
    varying vec2 vUv;
    #include <fog_pars_fragment>
    void main(){
      vec4 person=texture2D(map,vUv);
      if(person.a<.2)discard;
      gl_FragColor=person;
      #include <fog_fragment>
    }`,
});
const pedestrianCrowd=new THREE.Mesh(pedestrianGeometry,pedestrianMaterial);
pedestrianCrowd.frustumCulled=false;
crowdScene.add(pedestrianCrowd);
const pedestrians=[];
for(let i=0;i<PEDESTRIAN_COUNT;i++){
  const route=i%46;
  const axis=route<23?'z':'x';
  const direction=seeded(i,71,4)>.5?1:-1;
  const roadIndex=route%23-11;
  const roadCenter=roadIndex*CELL+CELL/2;
  const side=(Math.floor(i/46)%2)*2-1;
  const routeSlot=Math.floor(i/46),routeSlots=Math.ceil(PEDESTRIAN_COUNT/46);
  pedestrianVariants[i]=i%4;
  pedestrianScales[i]=2.25+seeded(i,101,2)*.25;
  pedestrians.push({index:i,axis,direction,roadCenter,side,travel:-700+(routeSlot+seeded(i,83,8)*.8)*(1400/routeSlots),speed:.72+seeded(i,89,2)*.72,phase:seeded(i,97,5)*Math.PI*2});
}

const trafficDummy=new THREE.Object3D();
function updateCityLife(dt){
  const now=performance.now()*.001;
  for(let i=0;i<trafficVehicles.length;i++){
    const v=trafficVehicles[i];
    v.travel+=v.direction*v.speed*dt;
    if(v.travel>720)v.travel=-720;if(v.travel<-720)v.travel=720;
    const lane=v.roadCenter+(v.direction>0?-2.7:2.7);
    const x=v.axis==='x'?v.travel:lane,z=v.axis==='z'?v.travel:lane;
    const yaw=v.axis==='z'?(v.direction>0?0:Math.PI):(v.direction>0?Math.PI/2:-Math.PI/2);
    v.x=x;v.z=z;
    trafficDummy.position.set(x,v.height/2+.08,z);trafficDummy.rotation.set(0,yaw,0);trafficDummy.scale.set(v.width,v.height,v.length);trafficDummy.updateMatrix();trafficBodyMesh.setMatrixAt(i,trafficDummy.matrix);
    const cabinH=v.bus?2.05:.64;
    trafficDummy.position.y=v.height+cabiny(cabinH);trafficDummy.scale.set(v.width*.82,cabinH,v.length*(v.bus?.82:.48));trafficDummy.updateMatrix();trafficCabinMesh.setMatrixAt(i,trafficDummy.matrix);
    for(let side=0;side<2;side++){
      const lateral=(side?1:-1)*v.width*.32;
      const forward=v.direction*v.length*.505;
      const lx=x+(v.axis==='z'?lateral:forward),lz=z+(v.axis==='z'?forward:-lateral);
      trafficDummy.position.set(lx,v.bus?1.25:.62,lz);trafficDummy.rotation.set(0,yaw,0);trafficDummy.scale.set(.22,.16,.08);trafficDummy.updateMatrix();trafficLightMesh.setMatrixAt(i*2+side,trafficDummy.matrix);
    }
    trafficDummy.position.set(x,v.height+(v.bus?1.9:.82),z);trafficDummy.rotation.set(0,yaw,0);trafficDummy.scale.set(v.taxi?.72:0,v.taxi?.22:0,v.taxi?.38:0);trafficDummy.updateMatrix();taxiSignMesh.setMatrixAt(i,trafficDummy.matrix);
  }
  trafficBodyMesh.instanceMatrix.needsUpdate=true;trafficCabinMesh.instanceMatrix.needsUpdate=true;trafficLightMesh.instanceMatrix.needsUpdate=true;taxiSignMesh.instanceMatrix.needsUpdate=true;
  for(const p of pedestrians){
    p.travel+=p.direction*p.speed*dt;
    if(p.travel>710)p.travel=-710;if(p.travel<-710)p.travel=710;
    const curb=p.roadCenter+p.side*(ROAD/2+1.25);
    const offset=p.index*3;
    pedestrianPositions[offset]=p.axis==='x'?p.travel:curb;
    pedestrianPositions[offset+1]=1.18+Math.sin(now*7+p.phase)*.025;
    pedestrianPositions[offset+2]=p.axis==='z'?p.travel:curb;
  }
  pedestrianPositionAttribute.needsUpdate=true;
}

function cabiny(height){return height*.5+.08;}

let nightMode=false;
let nightBlend=0;
const dayBackground=new THREE.Color(0x70b9e3),nightBackground=new THREE.Color(0x030716);
const dayFog=new THREE.Color(0xbcd8df),nightFog=new THREE.Color(0x10182a);
const dayAmbientSky=new THREE.Color(0xf5fbff),nightAmbientSky=new THREE.Color(0x52658d);
const dayAmbientGround=new THREE.Color(0x594f42),nightAmbientGround=new THREE.Color(0x090b12);
const daySun=new THREE.Color(0xfff2d0),nightMoon=new THREE.Color(0x9ebaff);

function toggleNightMode(){
  nightMode=!nightMode;
  document.body.classList.toggle('nightMode',nightMode);
}

function updateDayNight(dt){
  const target=nightMode?1:0;
  nightBlend=THREE.MathUtils.damp(nightBlend,target,2.25,dt);
  skyMaterial.uniforms.nightMix.value=nightBlend;
  scene.background.copy(dayBackground).lerp(nightBackground,nightBlend);
  scene.fog.color.copy(dayFog).lerp(nightFog,nightBlend);
  scene.fog.density=THREE.MathUtils.lerp(.0009,.00122,nightBlend);
  ambientLight.color.copy(dayAmbientSky).lerp(nightAmbientSky,nightBlend);
  ambientLight.groundColor.copy(dayAmbientGround).lerp(nightAmbientGround,nightBlend);
  ambientLight.intensity=THREE.MathUtils.lerp(2.55,.48,nightBlend);
  sun.color.copy(daySun).lerp(nightMoon,nightBlend);
  sun.intensity=THREE.MathUtils.lerp(2.15,.38,nightBlend);
  renderer.toneMappingExposure=THREE.MathUtils.lerp(1.08,.72,nightBlend);
  streetlightMaterial.emissiveIntensity=THREE.MathUtils.lerp(.18,4.8,nightBlend);
  headlightMaterial.emissiveIntensity=THREE.MathUtils.lerp(.8,5.2,nightBlend);
  taxiSignMaterial.emissiveIntensity=THREE.MathUtils.lerp(.12,2.1,nightBlend);
  for(const material of buildingLightMaterials)material.emissiveIntensity=THREE.MathUtils.lerp(0,2.6,nightBlend);
  for(const entry of nightBuildingMaterials)entry.material.emissiveIntensity=entry.intensity*nightBlend;
  for(const material of buildingLightMaterials)material.emissiveIntensity=THREE.MathUtils.lerp(0,2.6,nightBlend);
  for(const material of buildingLightMaterials)material.emissiveIntensity=THREE.MathUtils.lerp(0,2.6,nightBlend);
}

// Articulated red-and-blue web hero, designed to read clearly through the close FPV chase camera.
const hero = new THREE.Group();
const navy = new THREE.MeshStandardMaterial({color:0x12273e,roughness:.55});
const white = new THREE.MeshStandardMaterial({color:0xf2f5f8,roughness:.45});
const red = new THREE.MeshStandardMaterial({color:0xc71f2b,roughness:.48,metalness:.08});
const black = new THREE.MeshStandardMaterial({color:0x0b1014,roughness:.62});
const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.62,1.35,6,10),navy); torso.castShadow=true; hero.add(torso);
const chest = new THREE.Mesh(new THREE.BoxGeometry(.98,.62,.13),red); chest.position.set(0,.36,.58); hero.add(chest);
const head = new THREE.Mesh(new THREE.SphereGeometry(.46,18,14),red); head.position.y=1.38; head.castShadow=true; hero.add(head);
for (const sx of [-1,1]) { const eye=new THREE.Mesh(new THREE.SphereGeometry(.105,10,6),white); eye.scale.set(.55,1.35,.22); eye.position.set(sx*.18,1.46,.42); hero.add(eye); }
function limb(x,y,len,thick=.16,material=navy){ const pivot=new THREE.Group(); pivot.position.set(x,y,0); const mesh=new THREE.Mesh(new THREE.CapsuleGeometry(thick,len,4,7),material); mesh.position.y=-len*.5; mesh.castShadow=true; pivot.add(mesh); hero.add(pivot); return pivot; }
const armL=limb(-.62,.72,1.35,.13,red), armR=limb(.62,.72,1.35,.13,red);
const legL=limb(-.30,-.76,1.55,.16), legR=limb(.30,-.76,1.55,.16);
const backMark=new THREE.Group(); backMark.position.set(0,.25,-.61); backMark.rotation.y=Math.PI;
const markBody=new THREE.Mesh(new THREE.CapsuleGeometry(.09,.34,4,7),white); markBody.rotation.z=Math.PI/2; backMark.add(markBody);
for(const sy of [-1,1]) for(const side of [-1,1]){
  const leg=new THREE.Mesh(new THREE.BoxGeometry(.42,.055,.045),white);
  leg.position.set(side*.25,sy*.18,0); leg.rotation.z=side*sy*.55; backMark.add(leg);
}
hero.add(backMark);
scene.add(hero);

// Collision dimensions match the visible character, including the arms,
// head, and the full length of the legs.
const HERO_RADIUS=.82;
const HERO_FOOT_OFFSET=2.48;
const HERO_HEAD_OFFSET=1.9;

const state={
  pos:new THREE.Vector3(0,88,35), vel:new THREE.Vector3(0,-2,-24),
  heading:Math.PI, grounded:false, started:false,
  rooftop:false,
  wallNormal:new THREE.Vector3(), wallContact:false,
  coyote:0, jumpBuffer:0, boost:100, distance:0,
};
const keys=new Set();
const webs={
  left:{active:false,anchor:new THREE.Vector3(),rope:0,line:null},
  right:{active:false,anchor:new THREE.Vector3(),rope:0,line:null}
};

function makeWebLine(){
  const g=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]);
  const l=new THREE.Line(g,new THREE.LineBasicMaterial({color:0xf4f8ff,transparent:true,opacity:.95}));
  scene.add(l); l.visible=false; return l;
}
webs.left.line=makeWebLine(); webs.right.line=makeWebLine();

const tmp=new THREE.Vector3(), tmp2=new THREE.Vector3(), tmp3=new THREE.Vector3();
function headingForward(out=new THREE.Vector3()){ return out.set(Math.sin(state.heading),0,Math.cos(state.heading)).normalize(); }
function headingRight(out=new THREE.Vector3()){ const f=headingForward(tmp3); return out.set(f.z,0,-f.x).normalize(); }

function attachWeb(which){
  const web=webs[which]; if(web.active) return;
  const f=headingForward(new THREE.Vector3());
  const side=headingRight(new THREE.Vector3()).multiplyScalar(which==='left'?-1:1);
  const velocityLead=state.vel.clone().multiplyScalar(.45);
  const desired=state.pos.clone().addScaledVector(f,60).addScaledVector(side,20).add(velocityLead).add(new THREE.Vector3(0,38,0));
  let best=null,bestScore=Infinity;

  // Prefer authored architectural attachment points. This makes webs visibly
  // connect to window bays, balcony rails, and entrances instead of arbitrary
  // points floating across a facade.
  const toAnchor=new THREE.Vector3();
  for(const anchor of nearbySwingAnchors(state.pos,205)){
    const distance=anchor.distanceTo(state.pos);
    if(distance<9||distance>180||anchor.y<state.pos.y-10)continue;
    toAnchor.copy(anchor).sub(state.pos);
    const ahead=toAnchor.dot(f);
    if(ahead<-12)continue;
    const sideFit=Math.abs(toAnchor.dot(side)-22);
    const heightGain=THREE.MathUtils.clamp(anchor.y-state.pos.y,0,60);
    const score=anchor.distanceTo(desired)+sideFit*.12-Math.max(0,ahead)*.06-heightGain*.14-14;
    if(score<bestScore){bestScore=score;best=anchor;}
  }
  for(const b of colliders){
    const p=new THREE.Vector3(
      THREE.MathUtils.clamp(desired.x,b.minX,b.maxX),
      Math.min(b.top+.5,Math.max(state.pos.y+10,b.top*.88)),
      THREE.MathUtils.clamp(desired.z,b.minZ,b.maxZ)
    );
    const hd=p.distanceTo(state.pos);
    if(hd<12||hd>170||p.y<state.pos.y-8) continue;
    const ahead=p.clone().sub(state.pos).dot(headingForward(new THREE.Vector3()));
    if(ahead<4) continue;
    const score=p.distanceTo(desired)-Math.min(16,ahead*.08);
    if(score<bestScore){bestScore=score;best=p;}
  }
  // At rooftop height the strict forward search can briefly miss every facade.
  // Retry against the whole nearby skyline, then use a high offscreen anchor so a held key never feels dead.
  if(!best){
    for(const b of colliders){
      const p=new THREE.Vector3(
        THREE.MathUtils.clamp(desired.x,b.minX,b.maxX),
        Math.min(b.top+.5,Math.max(12,b.top*.92)),
        THREE.MathUtils.clamp(desired.z,b.minZ,b.maxZ)
      );
      const distance=p.distanceTo(state.pos);
      const ahead=p.clone().sub(state.pos).dot(f);
      if(distance<9||distance>180||ahead<-24) continue;
      const score=p.distanceTo(desired)+Math.max(0,-ahead)*2;
      if(score<bestScore){bestScore=score;best=p;}
    }
  }
  if(!best) best=state.pos.clone().addScaledVector(f,58).addScaledVector(side,24).add(new THREE.Vector3(0,42,0));
  web.anchor.copy(best);
  // Start almost at the current distance so attachment catches smoothly
  // instead of snapping twelve percent of the rope length in one frame.
  web.rope=Math.max(11,state.pos.distanceTo(best)*.97);
  web.active=true; web.line.visible=true;
  playWebShot(which);
  (which==='left'?leftWebBtn:rightWebBtn).classList.add('active');
  state.vel.addScaledVector(headingForward(new THREE.Vector3()),3.8);
  state.vel.y+=.8;
}
function detachWeb(which){
  const w=webs[which];
  (which==='left'?leftWebBtn:rightWebBtn).classList.remove('active');
  if(!w.active)return;
  playWebRelease(which);
  w.active=false; w.line.visible=false; state.vel.multiplyScalar(1.018);
}
function updateWebLine(web,hand){
  if(!web.active)return;
  hand.applyAxisAngle(UP,state.heading).add(state.pos);
  const a=web.line.geometry.attributes.position.array;
  a[0]=hand.x;a[1]=hand.y;a[2]=hand.z;a[3]=web.anchor.x;a[4]=web.anchor.y;a[5]=web.anchor.z;
  web.line.geometry.attributes.position.needsUpdate=true; web.line.geometry.computeBoundingSphere();
}
function webPhysics(web,dt,constraintScale=1){
  if(!web.active)return;
  const radial=tmp.copy(state.pos).sub(web.anchor); const dist=radial.length(); if(dist<.001)return; radial.divideScalar(dist);
  // A damped spring preserves momentum without the visible jitter caused by
  // the old hard velocity cancellation and large positional teleport.
  if(dist>web.rope){
    const stretch=dist-web.rope;
    const outward=Math.max(0,state.vel.dot(radial));
    const tension=Math.min(185,stretch*34*constraintScale+outward*7.5);
    state.vel.addScaledVector(radial,-tension*dt);
    state.pos.addScaledVector(radial,-Math.min(.075,stretch*.035)*constraintScale);
  }
  // Swing assistance acts along the rope tangent, so holding Up adds a clean
  // arc instead of fighting the constraint and producing a stutter.
  if(keys.has('ArrowUp')){
    const tangent=headingForward(tmp2);
    tangent.addScaledVector(radial,-tangent.dot(radial));
    if(tangent.lengthSq()>.001){
      tangent.normalize();
      const assist=state.vel.length()<18?20:15;
      state.vel.addScaledVector(tangent,assist*dt);
    }
  }
}

function applySwingSafetyAssist(dt){
  if(!webs.left.active&&!webs.right.active)return;
  const predicted=state.pos.clone().addScaledVector(state.vel,.34);
  let earliest=null;
  for(const building of nearbyColliders(state.pos,predicted,HERO_RADIUS+3)){
    const bodyBottom=Math.min(state.pos.y,predicted.y)-HERO_FOOT_OFFSET;
    const bodyTop=Math.max(state.pos.y,predicted.y)+HERO_HEAD_OFFSET;
    if(bodyTop<=(building.bottom??0)||bodyBottom>=building.top)continue;
    const hit=sweptWallHit(state.pos,predicted,building);
    if(hit&&(!earliest||hit.time<earliest.time))earliest=hit;
  }
  if(!earliest)return;
  const normal=new THREE.Vector3(earliest.nx,0,earliest.nz);
  const inward=state.vel.dot(normal);
  if(inward<0){
    const urgency=1-earliest.time;
    state.vel.addScaledVector(normal,-inward*(4.5+urgency*7.5)*dt);
    state.vel.y+=THREE.MathUtils.lerp(4,11,urgency)*dt;
  }
}

function sweptWallHit(start,end,b){
  const minX=b.minX-HERO_RADIUS,maxX=b.maxX+HERO_RADIUS;
  const minZ=b.minZ-HERO_RADIUS,maxZ=b.maxZ+HERO_RADIUS;
  const dx=end.x-start.x,dz=end.z-start.z;
  let enter=0,exit=1,nx=0,nz=0;

  for(const axis of ['x','z']){
    const origin=axis==='x'?start.x:start.z;
    const delta=axis==='x'?dx:dz;
    const min=axis==='x'?minX:minZ;
    const max=axis==='x'?maxX:maxZ;
    if(Math.abs(delta)<1e-7){
      if(origin<min||origin>max)return null;
      continue;
    }
    let near=(min-origin)/delta,far=(max-origin)/delta;
    let normal=delta>0?-1:1;
    if(near>far)[near,far]=[far,near];
    if(near>=enter){enter=near;nx=axis==='x'?normal:0;nz=axis==='z'?normal:0;}
    exit=Math.min(exit,far);
    if(enter>exit)return null;
  }
  if(enter<0||enter>1||(nx===0&&nz===0))return null;
  return {time:enter,nx,nz};
}

function collideBuildings(previousPos){
  state.wallContact=false;
  state.rooftop=false;
  const localColliders=nearbyColliders(previousPos,state.pos,HERO_RADIUS+2);

  // Resolve the highest crossed surface first. A fast descent can cross both
  // a rooftop crown and the main roof in one frame, and array order should not
  // decide which one catches the hero.
  let landing=null;
  for(const b of localColliders){
    if(state.pos.x>b.minX-HERO_RADIUS&&state.pos.x<b.maxX+HERO_RADIUS&&state.pos.z>b.minZ-HERO_RADIUS&&state.pos.z<b.maxZ+HERO_RADIUS){
      const standingY=b.top+HERO_FOOT_OFFSET;
      const crossedRoof=previousPos.y>=standingY-.05&&state.pos.y<=standingY;
      const restingOnRoof=Math.abs(state.pos.y-standingY)<=.38;
      if(state.vel.y<=0&&(crossedRoof||restingOnRoof)&&(!landing||b.top>landing.top)) landing=b;
    }
  }
  if(landing){
    state.pos.y=landing.top+HERO_FOOT_OFFSET;
    state.vel.y=0;
    state.grounded=true;
    state.rooftop=true;
    return;
  }

  // Sweep the whole movement segment against expanded building bounds. This
  // catches impacts even when a web correction or a fast frame would move the
  // character from one side of a wall to the other.
  let firstHit=null;
  for(const b of localColliders){
    const bodyBottom=state.pos.y-HERO_FOOT_OFFSET;
    const bodyTop=state.pos.y+HERO_HEAD_OFFSET;
    if(bodyTop<=(b.bottom??0)||bodyBottom>=b.top)continue;
    const hit=sweptWallHit(previousPos,state.pos,b);
    if(hit&&(!firstHit||hit.time<firstHit.time))firstHit=hit;
  }
  if(firstHit){
    const dx=state.pos.x-previousPos.x,dz=state.pos.z-previousPos.z;
    state.pos.x=previousPos.x+dx*firstHit.time+firstHit.nx*.015;
    state.pos.z=previousPos.z+dz*firstHit.time+firstHit.nz*.015;
    state.wallNormal.set(firstHit.nx,0,firstHit.nz);
    state.wallContact=true;
    const inward=state.vel.dot(state.wallNormal);
    if(inward<0){
      const swinging=webs.left.active||webs.right.active;
      state.vel.addScaledVector(state.wallNormal,-inward*(swinging?1.09:1));
      if(swinging){
        state.vel.y=Math.max(state.vel.y,1.8);
        state.vel.addScaledVector(headingForward(new THREE.Vector3()),1.4);
      }
    }
  }
}

function collideTraffic(){
  if(state.pos.y-HERO_FOOT_OFFSET>3.4)return;
  for(const vehicle of trafficVehicles){
    if(vehicle.x===undefined)continue;
    const halfX=(vehicle.axis==='x'?vehicle.length:vehicle.width)/2+HERO_RADIUS;
    const halfZ=(vehicle.axis==='z'?vehicle.length:vehicle.width)/2+HERO_RADIUS;
    const dx=state.pos.x-vehicle.x,dz=state.pos.z-vehicle.z;
    if(Math.abs(dx)>=halfX||Math.abs(dz)>=halfZ)continue;
    const pushX=halfX-Math.abs(dx),pushZ=halfZ-Math.abs(dz);
    if(pushX<pushZ){
      const sign=dx>=0?1:-1;state.pos.x+=sign*pushX;state.wallNormal.set(sign,0,0);
    }else{
      const sign=dz>=0?1:-1;state.pos.z+=sign*pushZ;state.wallNormal.set(0,0,sign);
    }
    state.wallContact=true;
    const inward=state.vel.dot(state.wallNormal);
    if(inward<0)state.vel.addScaledVector(state.wallNormal,-inward);
    const trafficVelocity=vehicle.direction*vehicle.speed;
    if(vehicle.axis==='x')state.vel.x+=trafficVelocity*.12;else state.vel.z+=trafficVelocity*.12;
    return;
  }
}

function reset(){
  state.pos.set(0,88,35);state.vel.set(0,-2,-24);state.heading=Math.PI;state.grounded=false;state.rooftop=false;state.boost=100;state.distance=0;
  detachWeb('left');detachWeb('right');
}
function queueJump(){ state.jumpBuffer=.14; }
function doJump(){
  if(state.grounded||state.coyote>0){ state.vel.y=12.5; state.grounded=false; state.coyote=0; playJump(); }
  else if(state.wallContact){ state.vel.addScaledVector(state.wallNormal,9); state.vel.y=Math.max(state.vel.y,11); playJump(); }
  else if(webs.left.active||webs.right.active){ state.vel.y+=2.2; state.vel.addScaledVector(headingForward(tmp2),2.0); playJump(); }
}

const blocked=['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyZ','KeyX'];
addEventListener('keydown',e=>{
  if(blocked.includes(e.code))e.preventDefault();
  if(e.code==='KeyZ')attachWeb('left');
  if(e.code==='KeyX')attachWeb('right');
  if(!keys.has(e.code)){
    if(e.code==='Space')queueJump();
    if(e.code==='KeyR')reset();
    if(e.code==='KeyN')toggleNightMode();
    if(e.code==='KeyM')toggleSound();
  }
  keys.add(e.code);
});
addEventListener('keyup',e=>{
  keys.delete(e.code);
  if(e.code==='KeyZ')detachWeb('left');
  if(e.code==='KeyX')detachWeb('right');
});

startBtn.addEventListener('click',()=>{initAudio();state.started=true;startScreen.style.display='none';});
soundToggle.addEventListener('click',e=>{e.stopPropagation();toggleSound();});

function bindWebButton(button, which){
  const press=e=>{e.preventDefault();button.setPointerCapture?.(e.pointerId);button.classList.add('active');attachWeb(which);};
  const release=e=>{e.preventDefault();button.classList.remove('active');detachWeb(which);};
  button.addEventListener('pointerdown',press);
  button.addEventListener('pointerup',release);
  button.addEventListener('pointercancel',release);
  button.addEventListener('lostpointercapture',release);
}
bindWebButton(leftWebBtn,'left');
bindWebButton(rightWebBtn,'right');

const clock=new THREE.Clock();
function update(dt){
  if(!state.started)return;
  dt=Math.min(dt,1/30);
  // Keep the high-resolution shadow volume centered on the player as they
  // travel across the large city, while preserving a constant sun direction.
  sun.position.set(state.pos.x-150,state.pos.y+240,state.pos.z+110);
  sun.target.position.copy(state.pos);
  sun.target.updateMatrixWorld();
  // Retry while held: if a tower was out of range on the first frame, the web attaches as soon as one is valid.
  if(keys.has('KeyZ')&&!webs.left.active)attachWeb('left');
  if(keys.has('KeyX')&&!webs.right.active)attachWeb('right');
  state.jumpBuffer=Math.max(0,state.jumpBuffer-dt);
  state.coyote=state.grounded?.12:Math.max(0,state.coyote-dt);

  const swinging=webs.left.active||webs.right.active;
  const horizontalSpeed=Math.hypot(state.vel.x,state.vel.z);

  // Keyboard-only steering. Left/right rotate both the hero's desired travel direction and the automatic camera.
  const steer=(keys.has('ArrowLeft')?1:0)-(keys.has('ArrowRight')?1:0);
  const turnRate=swinging?2.22:(state.grounded?2.5:1.9);
  const speedTurn=THREE.MathUtils.clamp(1.25-horizontalSpeed*.005,.72,1.18);
  state.heading+=steer*turnRate*speedTurn*dt;

  const f=headingForward(tmp2);
  if(keys.has('ArrowUp')){
    const accel=state.grounded?38:(swinging?19:14);
    state.vel.addScaledVector(f,accel*dt);
  }
  if(keys.has('ArrowDown')){
    // Down is primarily a brake; at low speed it becomes reverse.
    if(horizontalSpeed>4){ state.vel.x*=Math.exp(-3.4*dt);state.vel.z*=Math.exp(-3.4*dt); }
    else state.vel.addScaledVector(f,-15*dt);
  }

  // Dive/boost adds an arcade-like speed-building loop while airborne.
  if(keys.has('ShiftLeft')||keys.has('ShiftRight')){
    if(!state.grounded&&state.boost>0){
      state.vel.y-=22*dt; state.vel.addScaledVector(f,13*dt); state.boost=Math.max(0,state.boost-24*dt);
    }
  } else state.boost=Math.min(100,state.boost+15*dt);

  state.vel.y-=(swinging?17.4:21.5)*dt;
  state.vel.multiplyScalar(Math.pow(state.grounded?.985:.9982,dt*60));

  const previousPos=state.pos.clone();
  const wasGrounded=state.grounded;
  const wasWallContact=state.wallContact;
  const impactSpeed=Math.max(0,-state.vel.y);
  const impactHorizontal=horizontalSpeed;
  const constraintScale=webs.left.active&&webs.right.active?.72:1;
  webPhysics(webs.left,dt,constraintScale); webPhysics(webs.right,dt,constraintScale);
  applySwingSafetyAssist(dt);
  state.pos.addScaledVector(state.vel,dt);
  state.grounded=false;
  collideBuildings(previousPos);
  collideTraffic();

  if(state.pos.y<HERO_FOOT_OFFSET){state.pos.y=HERO_FOOT_OFFSET;if(state.vel.y<0)state.vel.y=0;state.grounded=true;state.rooftop=false;}
  if(!wasGrounded&&state.grounded)playLanding(impactSpeed);
  else if(!wasWallContact&&state.wallContact&&impactHorizontal>12)playWallImpact(impactHorizontal);
  if(state.jumpBuffer>0&&(state.grounded||state.coyote>0||state.wallContact||swinging)){doJump();state.jumpBuffer=0;}

  // Wall-running: keep forward momentum and reduce gravity while steering along a facade.
  if(state.wallContact&&!state.grounded&&keys.has('ArrowUp')&&horizontalSpeed>8){
    state.vel.y=Math.max(state.vel.y,-2.2);
    state.vel.addScaledVector(f,5*dt);
  }

  const maxH=state.grounded?24:68;
  const hvec=tmp.set(state.vel.x,0,state.vel.z); if(hvec.length()>maxH){hvec.setLength(maxH);state.vel.x=hvec.x;state.vel.z=hvec.z;}

  state.distance+=horizontalSpeed*dt;
  if(state.pos.y<-35||Math.abs(state.pos.x)>760||Math.abs(state.pos.z)>760)reset();

  hero.position.copy(state.pos);
  const travelYaw=horizontalSpeed>2?Math.atan2(state.vel.x,state.vel.z):state.heading;
  hero.rotation.y=THREE.MathUtils.damp(hero.rotation.y,travelYaw,8,dt);
  hero.rotation.z=THREE.MathUtils.damp(hero.rotation.z,-steer*.22-state.vel.x*.004,6,dt);
  hero.rotation.x=THREE.MathUtils.damp(hero.rotation.x,THREE.MathUtils.clamp(state.vel.y*.012,-.45,.35),5,dt);

  const swingPose=swinging?1:0;
  const runPhase=performance.now()*.012*Math.min(1.3,horizontalSpeed/8);
  if(webs.left.active) armL.rotation.z=THREE.MathUtils.damp(armL.rotation.z,1.9,10,dt); else armL.rotation.z=THREE.MathUtils.damp(armL.rotation.z,Math.sin(runPhase)*.55,8,dt);
  if(webs.right.active)armR.rotation.z=THREE.MathUtils.damp(armR.rotation.z,-1.9,10,dt);else armR.rotation.z=THREE.MathUtils.damp(armR.rotation.z,-Math.sin(runPhase)*.55,8,dt);
  legL.rotation.x=THREE.MathUtils.damp(legL.rotation.x,swingPose?.55:Math.sin(runPhase)*.65,7,dt);
  legR.rotation.x=THREE.MathUtils.damp(legR.rotation.x,swingPose?-.45:-Math.sin(runPhase)*.65,7,dt);

  updateWebLine(webs.left,new THREE.Vector3(-.58,.55,.03));
  updateWebLine(webs.right,new THREE.Vector3(.58,.55,.03));

  const speed=state.vel.length();
  updateAudio(speed,swinging,dt);
  const desiredFov=THREE.MathUtils.clamp(80+speed*.46,80,110);
  camera.fov=THREE.MathUtils.damp(camera.fov,desiredFov,4.2,dt);camera.updateProjectionMatrix();

  // Stable chase camera locked behind the hero. Keeping the view aligned with
  // heading avoids the orbiting/360-degree effect caused by velocity drift.
  const camForward=headingForward(new THREE.Vector3());
  const speedRatio=THREE.MathUtils.clamp((speed-18)/56,0,1);
  const camPos=state.pos.clone().addScaledVector(camForward,-(5.8+Math.min(2.4,speed*.025))).add(new THREE.Vector3(0,2.25+Math.min(.8,Math.max(0,state.vel.y)*.014),0));
  if(speedRatio>.2){
    const shake=.025*speedRatio;
    camPos.x+=Math.sin(performance.now()*.021)*shake;
    camPos.y+=Math.cos(performance.now()*.027)*shake;
  }
  camera.position.lerp(camPos,1-Math.exp(-9.2*dt));
  const look=state.pos.clone().add(new THREE.Vector3(0,.65,0)).addScaledVector(camForward,7.5+speed*.055).add(state.vel.clone().multiplyScalar(.105));
  camera.lookAt(look);
  speedFrame.style.opacity=String(THREE.MathUtils.clamp((speed-35)/45,0,.42));
  speedFrame.style.transform=`scale(${1.12+speedRatio*.16})`;

  speedEl.textContent=`${Math.round(speed*3.6)} km/h`;
  const movementStatus=swinging?'WEB ATTACHED':state.wallContact?'WALL RUN':state.rooftop?'ROOFTOP':state.grounded?'GROUND':'AIR';
  statusEl.textContent=`${nightMode?'NIGHT · ':''}${movementStatus}`;
}
const PHYSICS_DT=1/90;
let physicsAccumulator=0;
function animate(){
  requestAnimationFrame(animate);
  const frameDt=Math.min(clock.getDelta(),.05);
  updateDayNight(frameDt);
  updateCityLife(frameDt);
  if(state.started){
    physicsAccumulator=Math.min(physicsAccumulator+frameDt,PHYSICS_DT*6);
    let steps=0;
    while(physicsAccumulator>=PHYSICS_DT&&steps<6){
      update(PHYSICS_DT);
      physicsAccumulator-=PHYSICS_DT;
      steps++;
    }
  }else physicsAccumulator=0;
  composer.render();
}
animate();
addEventListener('resize',()=>{
  camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);composer.setSize(innerWidth,innerHeight);
});
