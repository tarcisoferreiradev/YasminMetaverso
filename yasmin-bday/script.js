/**
 * @file script.js
 * @description Kinematic FPS Engine & State Machine. 
 * Hotfix: Correção de Orientação Espacial (Velas 20) e reposicionamento vetorial de prop (Balão).
 */

import * as THREE from 'three';
import gsap from 'gsap';

// ==========================================
// 1. ENGINE CORE: RENDERER & SCENE
// ==========================================
const canvas = document.getElementById('webgl-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d1017);
scene.fog = new THREE.FogExp2(0x0d1017, 0.022);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100); 
camera.rotation.order = 'YXZ'; 

const audioListener = new THREE.AudioListener();
camera.add(audioListener);

// ==========================================
// 2. ILLUMINATION
// ==========================================
const ambientLight = new THREE.AmbientLight(0xffffff, 0); 
scene.add(ambientLight);

const hemisphereLight = new THREE.HemisphereLight(0xc6dcff, 0x23160f, 0);
scene.add(hemisphereLight);

const pointLight = new THREE.PointLight(0xffeedd, 0, 15); 
pointLight.position.set(0, 4, 0); 
pointLight.castShadow = true; 
pointLight.shadow.bias = -0.001; 
pointLight.shadow.mapSize.set(2048, 2048);
scene.add(pointLight);

const moonLight = new THREE.SpotLight(0x9dc1ff, 0, 18, Math.PI / 7, 0.45, 1.2);
moonLight.position.set(3.4, 4.4, -1.8);
moonLight.target.position.set(0.8, 1.2, -0.4);
moonLight.castShadow = true;
moonLight.shadow.bias = -0.0005;
moonLight.shadow.mapSize.set(2048, 2048);
scene.add(moonLight, moonLight.target);

const rimLight = new THREE.PointLight(0xff8e5c, 0, 10, 2);
rimLight.position.set(-2.8, 2.3, 3.1);
scene.add(rimLight);

function createProceduralTexture(drawFn, width = 1024, height = 1024) {
    const textureCanvas = document.createElement('canvas');
    textureCanvas.width = width;
    textureCanvas.height = height;
    const context = textureCanvas.getContext('2d');
    drawFn(context, width, height);
    const texture = new THREE.CanvasTexture(textureCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

function addSpeckle(context, width, height, count, alpha) {
    for (let index = 0; index < count; index += 1) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const radius = Math.random() * 1.8 + 0.3;
        context.fillStyle = `rgba(255, 255, 255, ${Math.random() * alpha})`;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
    }
}

const floorTexture = createProceduralTexture((context, width, height) => {
    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#4b2f22');
    gradient.addColorStop(0.45, '#7b5842');
    gradient.addColorStop(1, '#241712');
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    context.strokeStyle = 'rgba(25, 15, 10, 0.45)';
    context.lineWidth = 6;
    for (let plank = 0; plank < 18; plank += 1) {
        const y = (height / 18) * plank;
        context.beginPath();
        context.moveTo(0, y + (Math.random() * 10 - 5));
        context.lineTo(width, y + (Math.random() * 10 - 5));
        context.stroke();
    }

    context.strokeStyle = 'rgba(255, 240, 220, 0.07)';
    context.lineWidth = 2;
    for (let grain = 0; grain < 80; grain += 1) {
        const startX = Math.random() * width;
        const startY = Math.random() * height;
        context.beginPath();
        context.moveTo(startX, startY);
        context.bezierCurveTo(startX + 30, startY + Math.random() * 30, startX + 90, startY - Math.random() * 30, startX + 180, startY + Math.random() * 10);
        context.stroke();
    }

    addSpeckle(context, width, height, 1200, 0.06);
});
floorTexture.repeat.set(2.4, 2.4);

const wallTexture = createProceduralTexture((context, width, height) => {
    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#d9c9b7');
    gradient.addColorStop(0.5, '#b79f8b');
    gradient.addColorStop(1, '#8d7966');
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    context.fillStyle = 'rgba(255, 255, 255, 0.08)';
    for (let blotch = 0; blotch < 80; blotch += 1) {
        context.beginPath();
        context.ellipse(Math.random() * width, Math.random() * height, Math.random() * 70 + 20, Math.random() * 50 + 12, Math.random() * Math.PI, 0, Math.PI * 2);
        context.fill();
    }

    context.strokeStyle = 'rgba(70, 45, 28, 0.05)';
    context.lineWidth = 3;
    for (let crack = 0; crack < 45; crack += 1) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        context.beginPath();
        context.moveTo(x, y);
        context.lineTo(x + Math.random() * 80 - 40, y + Math.random() * 120 - 60);
        context.stroke();
    }

    addSpeckle(context, width, height, 900, 0.04);
});
wallTexture.repeat.set(1.5, 1.5);

const ceilingTexture = createProceduralTexture((context, width, height) => {
    const gradient = context.createRadialGradient(width * 0.5, height * 0.45, 40, width * 0.5, height * 0.5, width * 0.7);
    gradient.addColorStop(0, '#f5efe7');
    gradient.addColorStop(1, '#baa79a');
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    context.strokeStyle = 'rgba(120, 95, 80, 0.06)';
    context.lineWidth = 2;
    for (let index = 0; index < 55; index += 1) {
        context.beginPath();
        context.moveTo(Math.random() * width, Math.random() * height);
        context.lineTo(Math.random() * width, Math.random() * height);
        context.stroke();
    }
});
ceilingTexture.repeat.set(1.3, 1.3);

// ==========================================
// 3. ARCHITECTURE (Quarto 8x8)
// ==========================================
const roomSize = { width: 8, height: 5, depth: 8 };

const floor = new THREE.Mesh(new THREE.PlaneGeometry(roomSize.width, roomSize.depth), new THREE.MeshStandardMaterial({ map: floorTexture, color: 0xffffff, roughness: 0.68, metalness: 0.06 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
scene.add(floor);

const gridHelper = new THREE.GridHelper(roomSize.width, 10, 0x444444, 0x222222);
gridHelper.position.y = 0.01; gridHelper.visible = false; scene.add(gridHelper);

const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(roomSize.width, roomSize.depth), new THREE.MeshStandardMaterial({ map: ceilingTexture, color: 0xffffff, roughness: 0.95 }));
ceiling.rotation.x = Math.PI / 2; ceiling.position.y = roomSize.height; scene.add(ceiling);

const frontBackWallMat = new THREE.MeshStandardMaterial({ map: wallTexture, color: 0xe4d6c8, roughness: 0.88, side: THREE.DoubleSide });
const leftRightWallMat = new THREE.MeshStandardMaterial({ map: wallTexture.clone(), color: 0xc9d2d6, roughness: 0.9, side: THREE.DoubleSide });
leftRightWallMat.map.repeat.set(1.2, 1.6);

const wallsGroup = new THREE.Group();
const wallFront = new THREE.Mesh(new THREE.PlaneGeometry(roomSize.width, roomSize.height), frontBackWallMat);
wallFront.position.set(0, roomSize.height/2, -roomSize.depth/2); wallFront.receiveShadow = true; wallsGroup.add(wallFront);
const wallBack = new THREE.Mesh(new THREE.PlaneGeometry(roomSize.width, roomSize.height), frontBackWallMat);
wallBack.position.set(0, roomSize.height/2, roomSize.depth/2); wallBack.receiveShadow = true; wallsGroup.add(wallBack);
const wallLeft = new THREE.Mesh(new THREE.PlaneGeometry(roomSize.depth, roomSize.height), leftRightWallMat);
wallLeft.rotation.y = Math.PI / 2; wallLeft.position.set(-roomSize.width/2, roomSize.height/2, 0); wallLeft.receiveShadow = true; wallsGroup.add(wallLeft);
const wallRight = new THREE.Mesh(new THREE.PlaneGeometry(roomSize.depth, roomSize.height), leftRightWallMat);
wallRight.rotation.y = Math.PI / 2; wallRight.position.set(roomSize.width/2, roomSize.height/2, 0); wallRight.receiveShadow = true; wallsGroup.add(wallRight);
scene.add(wallsGroup);

// ==========================================
// 4. LEVEL DESIGN PROPS
// ==========================================

// 4.1 A CAMA
const bedGroup = new THREE.Group();
const bedFrameMat = new THREE.MeshStandardMaterial({ color: 0x4a3525, roughness: 0.8 });
const bedFrame = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.3, 2.1), bedFrameMat);
bedFrame.position.y = 0.15; bedFrame.castShadow = true; bedFrame.receiveShadow = true;
const headboard = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.0, 0.1), bedFrameMat);
headboard.position.set(0, 0.5, 1.0); headboard.castShadow = true; headboard.receiveShadow = true;
const mattress = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.25, 2.0), new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.9 }));
mattress.position.set(0, 0.425, 0); mattress.castShadow = true; mattress.receiveShadow = true;
const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.15, 0.4), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }));
pillow.position.set(0, 0.575, 0.7); pillow.castShadow = true;
const blanket = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.05, 1.3), new THREE.MeshStandardMaterial({ color: 0x887660, roughness: 0.9 }));
blanket.position.set(0, 0.56, -0.35); blanket.castShadow = true;

bedGroup.add(bedFrame, headboard, mattress, pillow, blanket);
bedGroup.position.set(0, 0, 2.95); 
scene.add(bedGroup);

// 4.2 GUARDA-ROUPA
const wardrobeGroup = new THREE.Group();
const wWidth = 1.2; const wHeight = 3.2; const wDepth = 3.0; 
const wardrobeBody = new THREE.Mesh(new THREE.BoxGeometry(wWidth, wHeight, wDepth), new THREE.MeshStandardMaterial({ color: 0x4a3525, roughness: 0.8 }));
wardrobeBody.position.set(0, wHeight/2, 0); wardrobeBody.castShadow = true; wardrobeBody.receiveShadow = true; wardrobeGroup.add(wardrobeBody);
const doorMat = new THREE.MeshStandardMaterial({ color: 0x543d2a, roughness: 0.7 });
const doorLeft = new THREE.Mesh(new THREE.BoxGeometry(0.05, wHeight - 0.2, wDepth/2 - 0.1), doorMat);
doorLeft.position.set(wWidth/2 + 0.01, wHeight/2, -wDepth/4); wardrobeGroup.add(doorLeft);
const doorRight = new THREE.Mesh(new THREE.BoxGeometry(0.05, wHeight - 0.2, wDepth/2 - 0.1), doorMat);
doorRight.position.set(wWidth/2 + 0.01, wHeight/2, wDepth/4); wardrobeGroup.add(doorRight);
const handleMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.6, roughness: 0.2 });
const handleLeft = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.4, 0.05), handleMat);
handleLeft.position.set(wWidth/2 + 0.05, wHeight/2, -0.2); wardrobeGroup.add(handleLeft);
const handleRight = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.4, 0.05), handleMat);
handleRight.position.set(wWidth/2 + 0.05, wHeight/2, 0.2); wardrobeGroup.add(handleRight);

wardrobeGroup.position.set(-3.25, 0, 2.5);
scene.add(wardrobeGroup);

// 4.3 TV ENGINE
const tvGroup = new THREE.Group();
const desk = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.6, 1), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8 }));
desk.position.y = 0.3; desk.castShadow = true; desk.receiveShadow = true; tvGroup.add(desk);
const tvStand = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.3, 0.2, 16), new THREE.MeshStandardMaterial({ color: 0x050505 }));
tvStand.position.set(0, 0.7, 0); tvGroup.add(tvStand);
const bezelGeo = new THREE.BoxGeometry(2.95, 1.75, 0.1);
const bezelMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.8, metalness: 0.2 });
const tvBezel = new THREE.Mesh(bezelGeo, bezelMat);
tvBezel.position.set(0, 1.6, -0.02); tvBezel.castShadow = true; tvGroup.add(tvBezel);

const videoElement = document.getElementById('tv-video');
let videoTexture = null;
if(videoElement) {
    videoElement.muted = true;
    videoElement.preload = 'auto';
    videoElement.playsInline = true;
    videoElement.load();
    videoTexture = new THREE.VideoTexture(videoElement);
    videoTexture.colorSpace = THREE.SRGBColorSpace;
}

function syncTvMuteLabel() {
    if (!btnTvMute || !videoElement) return;
    btnTvMute.innerText = videoElement.muted ? "[ M ] Desmutar" : "[ M ] Mutar Som";
}

function requestTvPlayback() {
    if (!videoElement) return;
    const playPromise = videoElement.play();
    if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(err => console.warn('Reproducao da TV bloqueada:', err));
    }
}

const tvScreenMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: videoTexture, emissive: 0xffffff, emissiveMap: videoTexture, emissiveIntensity: 0.8, roughness: 0.1, metalness: 0.8 });
const tvScreen = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.6, 0.02), tvScreenMat); 
tvScreen.position.set(0, 1.6, 0.04); tvGroup.add(tvScreen);

if(videoElement) {
    const tvAudio = new THREE.PositionalAudio(audioListener);
    tvAudio.setMediaElementSource(videoElement);
    tvAudio.setRefDistance(2.5); tvAudio.setRolloffFactor(1.5); 
    tvScreen.add(tvAudio);
}

const tvLight = new THREE.PointLight(0x2244ff, 0, 5); 
tvLight.position.set(0, 1.6, 0.5); tvGroup.add(tvLight);
tvGroup.position.set(0, 0, -3.4); 
scene.add(tvGroup);

const screenGlow = new THREE.SpotLight(0x6fa2ff, 0, 11, Math.PI / 5, 0.55, 1.6);
screenGlow.position.set(0, 1.7, -2.65);
screenGlow.target.position.set(0, 1.4, -0.3);
scene.add(screenGlow, screenGlow.target);


// ==========================================
// 5. CANTINHO DA LEITURA
// ==========================================
const textureLoader = new THREE.TextureLoader();
const assetBasePath = './yasmin-bday/imagens';

const shelfGeo = new THREE.BoxGeometry(0.8, 0.1, 2.5); 
const shelfMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.8, metalness: 0.1 });
const shelf = new THREE.Mesh(shelfGeo, shelfMat);
shelf.position.set(-3.6, 0.6, -0.5); 
shelf.castShadow = true; shelf.receiveShadow = true;
scene.add(shelf);

const coverTexture = textureLoader.load(`${assetBasePath}/yasmin1.png`);
coverTexture.colorSpace = THREE.SRGBColorSpace; 
coverTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
const pageMat = new THREE.MeshStandardMaterial({ color: 0xf5ecd5, roughness: 0.9 }); 
const spineMat = new THREE.MeshStandardMaterial({ color: 0x3d2314, roughness: 0.8 }); 
const coverMat = new THREE.MeshStandardMaterial({ map: coverTexture, roughness: 0.4, metalness: 0.1, emissive: 0x4a3219, emissiveIntensity: 0.2 }); 
const bookMaterials = [pageMat, spineMat, coverMat, spineMat, pageMat, pageMat];
const bookMesh = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.11, 0.8), bookMaterials); 
bookMesh.position.set(-3.5, 0.75, -0.5); 
bookMesh.rotation.y = Math.PI / 6; 
bookMesh.castShadow = true; 
scene.add(bookMesh);

const lampGroup = new THREE.Group();
const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.05, 16), new THREE.MeshStandardMaterial({ color: 0x111111 }));
lampBase.castShadow = true; 
const lampStem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 8), new THREE.MeshStandardMaterial({ color: 0x111111 }));
lampStem.position.y = 0.15; lampStem.castShadow = true;
const lampShadeMat = new THREE.MeshStandardMaterial({ color: 0xf5f5dc, side: THREE.DoubleSide, emissive: 0xffaa44, emissiveIntensity: 0 });
const lampShade = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 0.25, 16, 1, true), lampShadeMat);
lampShade.position.y = 0.35; lampShade.castShadow = true; 
lampGroup.add(lampBase, lampStem, lampShade);
lampGroup.position.set(-3.6, 0.65, 0.4); 
scene.add(lampGroup);

const lampLight = new THREE.PointLight(0xffaa44, 0, 7, 1.5); 
lampLight.position.set(-3.6, 1.0, 0.4); 
lampLight.castShadow = true; lampLight.shadow.bias = -0.002; lampLight.shadow.mapSize.set(1024, 1024);
scene.add(lampLight);

// ==========================================
// 6. GALERIA & DECORAÇÃO FESTIVA
// ==========================================

// --- Quadros ---
function createPictureFrame(imagePath, width, height) {
    const frameGroup = new THREE.Group();
    const frameDepth = 0.05;
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.9 });
    const frameMesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, frameDepth), frameMat);
    frameMesh.castShadow = true;
    frameGroup.add(frameMesh);
    const photoTex = textureLoader.load(imagePath);
    photoTex.colorSpace = THREE.SRGBColorSpace;
    photoTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const photoMat = new THREE.MeshStandardMaterial({ map: photoTex, roughness: 0.4, metalness: 0.1 });
    const photoMesh = new THREE.Mesh(new THREE.PlaneGeometry(width - 0.1, height - 0.1), photoMat);
    photoMesh.position.z = (frameDepth / 2) + 0.001; 
    frameGroup.add(photoMesh);
    return frameGroup;
}

const frameMain = createPictureFrame(`${assetBasePath}/yasmin2.jpeg`, 1.8, 1.4);
frameMain.position.set(-3.95, 2.4, -0.5); frameMain.rotation.y = Math.PI / 2; scene.add(frameMain);

const frameBed = createPictureFrame(`${assetBasePath}/yasmin3.jpeg`, 0.9, 1.2);
frameBed.position.set(0, 2.2, 3.95); frameBed.rotation.y = Math.PI; scene.add(frameBed);

const frame4 = createPictureFrame(`${assetBasePath}/yasmin4.jpeg`, 0.9, 1.2);
frame4.position.set(3.95, 2.0, 1.2); frame4.rotation.y = -Math.PI / 2; scene.add(frame4);

const frame5 = createPictureFrame(`${assetBasePath}/yasmin5.jpeg`, 0.9, 1.2);
frame5.position.set(3.95, 2.0, 0); frame5.rotation.y = -Math.PI / 2; scene.add(frame5);

const frame6 = createPictureFrame(`${assetBasePath}/yasmin6.jpeg`, 0.9, 1.2);
frame6.position.set(3.95, 2.0, -1.2); frame6.rotation.y = -Math.PI / 2; scene.add(frame6);


// --- Banners em Canvas ---
function createBannerTexture(text, w, h, isPennant) {
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (isPennant) {
        const colors = ['#ffa6c9', '#ffffff', '#ffd700']; 
        const bg = colors[Math.floor(Math.random() * colors.length)];
        const fg = bg === '#ffffff' ? '#4a3525' : '#111111';
        ctx.fillStyle = bg; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w, 0); ctx.lineTo(w/2, h); ctx.closePath(); ctx.fill();
        ctx.font = `bold ${h*0.4}px Arial, sans-serif`; ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, w/2, h*0.35);
    } else {
        ctx.fillStyle = '#ffa6c9'; ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 10; ctx.strokeRect(15, 15, w-30, h-30);
        ctx.font = `bold ${h*0.4}px Georgia, serif`; ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, w/2, h/2);
    }
    const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; return tex;
}

const yasminGroup = new THREE.Group();
const letters = "YASMIN".split("");
const spacing = 0.5;
letters.forEach((char, i) => {
    const tex = createBannerTexture(char, 256, 384, true);
    const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.1, roughness: 0.8, side: THREE.DoubleSide });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.6), mat);
    plane.position.x = (i - (letters.length-1)/2) * spacing; plane.position.y = Math.sin(i * 0.8) * 0.1; plane.rotation.z = (Math.random() - 0.5) * 0.2; plane.castShadow = true; yasminGroup.add(plane);
});
const stringMat = new THREE.MeshBasicMaterial({ color: 0x555555 });
const stringGeo = new THREE.CylinderGeometry(0.005, 0.005, letters.length * spacing);
const stringMesh = new THREE.Mesh(stringGeo, stringMat); stringMesh.rotation.z = Math.PI / 2; stringMesh.position.y = 0.3; yasminGroup.add(stringMesh);
yasminGroup.position.set(0, 3.6, 3.9); yasminGroup.rotation.y = Math.PI; scene.add(yasminGroup);

const hbTex = createBannerTexture("HAPPY BIRTHDAY", 1024, 256, false);
const hbMat = new THREE.MeshStandardMaterial({ map: hbTex, roughness: 0.8 });
const hbMesh = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 0.75), hbMat);
hbMesh.position.set(0, 3.2, -3.95); scene.add(hbMesh);

// --- Confetes ---
function createConfettiLayer(colorHex, count) {
    const geo = new THREE.PlaneGeometry(0.04, 0.04);
    const mat = new THREE.MeshBasicMaterial({ color: colorHex, side: THREE.DoubleSide });
    const instancedMesh = new THREE.InstancedMesh(geo, mat, count);
    const dummy = new THREE.Object3D();
    for(let i = 0; i < count; i++) {
        dummy.position.set((Math.random() - 0.5) * 7.5, 0.015, (Math.random() - 0.5) * 7.5);
        dummy.rotation.set(Math.PI / 2, 0, Math.random() * Math.PI); dummy.updateMatrix(); instancedMesh.setMatrixAt(i, dummy.matrix);
    }
    return instancedMesh;
}
scene.add(createConfettiLayer(0xffa6c9, 150)); scene.add(createConfettiLayer(0xffd700, 150)); scene.add(createConfettiLayer(0xffffff, 150)); 

// --- Balões ---
const kinematicBalloons = [];
const balloonGeo = new THREE.SphereGeometry(0.3, 32, 32);
function createBalloon(x, y, z, colorHex) {
    const bGroup = new THREE.Group();
    const bMesh = new THREE.Mesh(balloonGeo, new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.1, metalness: 0.2 }));
    bMesh.scale.set(1, 1.2, 1); bMesh.castShadow = true;
    const sGeo = new THREE.CylinderGeometry(0.002, 0.002, y);
    const sMesh = new THREE.Mesh(sGeo, new THREE.MeshBasicMaterial({ color: 0xdddddd }));
    sMesh.position.y = -y / 2; 
    bGroup.add(bMesh, sMesh); bGroup.position.set(x, y, z);
    bGroup.rotation.z = (Math.random() - 0.5) * 0.1; bGroup.rotation.x = (Math.random() - 0.5) * 0.1;
    kinematicBalloons.push({ mesh: bGroup, baseY: y, phaseOffset: Math.random() * Math.PI * 2 });
    scene.add(bGroup);
}
createBalloon(-2.5, 2.2, -2.5, 0xffa6c9); 
createBalloon(-1.8, 1.8, -3.5, 0xffffff); 
createBalloon(2.5, 2.5, -2.8, 0xffd700);
createBalloon(-2.0, 2.1, 1.5, 0xffffff); 
createBalloon(2.8, 2.4, 3.2, 0xffd700);
// Balão rosa transladado mais para a direita (+Z) conforme solicitado
createBalloon(3.2, 1.9, 2.5, 0xffa6c9); 

// --- 6.4 MESA DA FESTA ---
const partyTableGroup = new THREE.Group();
const candleLights = [];

// Tampo 
const pTableTop = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 2.0), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 }));
pTableTop.position.y = 0.8; pTableTop.castShadow = true; pTableTop.receiveShadow = true;
partyTableGroup.add(pTableTop);

// Pernas
const legMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 });
const pLeg1 = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.8, 0.05), legMat); pLeg1.position.set(0, 0.4, -0.9); pLeg1.castShadow = true;
const pLeg2 = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.8, 0.05), legMat); pLeg2.position.set(0, 0.4, 0.9); pLeg2.castShadow = true;
partyTableGroup.add(pLeg1, pLeg2);

// Bolo 
const cakeGroup = new THREE.Group();
const tier1 = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.2, 32), new THREE.MeshStandardMaterial({ color: 0xffa6c9, roughness: 0.8 }));
tier1.position.y = 0.1; tier1.castShadow = true;
const tier2 = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.15, 32), new THREE.MeshStandardMaterial({ color: 0xffd700, roughness: 0.4 }));
tier2.position.y = 0.275; tier2.castShadow = true;
cakeGroup.add(tier1, tier2);

// Velas Numéricas "20" (Corrigidas: '2' na esquerda (-Z), '0' na direita (+Z))
function createNumberCandle(numberStr) {
    const cvs = document.createElement('canvas');
    cvs.width = 128; cvs.height = 128;
    const ctx = cvs.getContext('2d');
    ctx.clearRect(0, 0, 128, 128); 
    
    ctx.font = 'bold 100px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.strokeText(numberStr, 64, 64);
    ctx.fillStyle = '#ffb6c1'; 
    ctx.fillText(numberStr, 64, 64);
    
    const tex = new THREE.CanvasTexture(cvs);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.1, side: THREE.DoubleSide, emissive: '#ffb6c1', emissiveIntensity: 0.3 });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.18), mat);
    
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.015), new THREE.MeshBasicMaterial({ color: 0xffaa00 }));
    flame.position.y = 0.11;
    mesh.add(flame);

    const candleLight = new THREE.PointLight(0xffc36b, 1.1, 1.2, 2);
    candleLight.position.y = 0.12;
    candleLights.push(candleLight);
    mesh.add(candleLight);
    return mesh;
}

const candle2 = createNumberCandle('2');
candle2.position.set(0, 0.45, -0.08); // Fix: Eixo -Z (Esquerda do player ao olhar p/ +X)
candle2.rotation.y = -Math.PI / 2;
const candle0 = createNumberCandle('0');
candle0.position.set(0, 0.45, 0.08);  // Fix: Eixo +Z (Direita do player)
candle0.rotation.y = -Math.PI / 2; 

cakeGroup.add(candle2, candle0);
cakeGroup.position.set(0, 0.825, 0);
partyTableGroup.add(cakeGroup);

// Bandejas Procedurais
function createTray(x, z, isSweet) {
    const trayGroup = new THREE.Group();
    const tray = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.015, 32), new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.6 }));
    tray.position.y = 0.0075; tray.castShadow = true;
    trayGroup.add(tray);
    const itemGeo = isSweet ? new THREE.SphereGeometry(0.02, 16, 16) : new THREE.ConeGeometry(0.025, 0.04, 16);
    const itemMat = new THREE.MeshStandardMaterial({ color: isSweet ? 0x2b170b : 0xd4a373, roughness: 0.9 });
    for(let i=0; i<8; i++) {
        const item = new THREE.Mesh(itemGeo, itemMat);
        const angle = (i / 8) * Math.PI * 2;
        item.position.set(Math.cos(angle)*0.1, 0.0275, Math.sin(angle)*0.1);
        item.castShadow = true;
        trayGroup.add(item);
    }
    const centerItem = new THREE.Mesh(itemGeo, itemMat);
    centerItem.position.set(0, 0.0275, 0); centerItem.castShadow = true;
    trayGroup.add(centerItem);
    trayGroup.position.set(x, 0.825, z);
    return trayGroup;
}
partyTableGroup.add(createTray(-0.25, 0.5, true));   
partyTableGroup.add(createTray(0.25, 0.6, false)); 
partyTableGroup.add(createTray(-0.25, -0.5, true));   
partyTableGroup.add(createTray(0.25, -0.6, false));   

partyTableGroup.position.set(3.2, 0, 0); 
scene.add(partyTableGroup);


// ==========================================
// 7. FPC CONTROLLER & MOUSE LOOK
// ==========================================
const player = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 0.8, 4, 16), new THREE.MeshBasicMaterial({ visible: false }));
player.position.set(0, 0.8, 1.5); 
scene.add(player);

const playerSpeed = 0.06; 
const interactionRadius = 2.2; 

const keys = { w: false, a: false, s: false, d: false };
window.addEventListener('keydown', (e) => { const key = e.key.toLowerCase(); if(keys.hasOwnProperty(key)) keys[key] = true; });
window.addEventListener('keyup', (e) => { const key = e.key.toLowerCase(); if(keys.hasOwnProperty(key)) keys[key] = false; });

const joyZone = document.getElementById('virtual-joystick'); const joyBase = document.getElementById('joy-base'); const joyStick = document.getElementById('joy-stick');
let joyActive = false; const joyVector = new THREE.Vector2(0, 0); 
if (joyZone) {
    joyZone.addEventListener('pointerdown', (e) => { e.stopPropagation(); joyActive = true; joyBase.classList.add('active'); updateJoyVector(e); });
    joyZone.addEventListener('pointermove', (e) => { if (!joyActive) return; e.stopPropagation(); updateJoyVector(e); });
    window.addEventListener('pointerup', () => { if (!joyActive) return; joyActive = false; joyVector.set(0, 0); joyBase.classList.remove('active'); joyStick.style.transform = `translate(0px, 0px)`; });
}
function updateJoyVector(e) {
    const rect = joyBase.getBoundingClientRect(); const centerX = rect.left + rect.width / 2; const centerY = rect.top + rect.height / 2;
    let dx = e.clientX - centerX; let dy = e.clientY - centerY; const maxRadius = rect.width / 2; const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > maxRadius) { dx = (dx / dist) * maxRadius; dy = (dy / dist) * maxRadius; }
    joyStick.style.transform = `translate(${dx}px, ${dy}px)`; joyVector.x = dx / maxRadius; joyVector.y = dy / maxRadius;
}

let isDraggingCam = false; let yaw = 0; let pitch = 0; let lastTouchX = 0; let lastTouchY = 0; const lookSensitivity = 0.003;
window.addEventListener('pointerdown', (e) => {
    if (e.target.closest('#virtual-joystick') || e.target.closest('.isolated-module') || e.target.closest('.action-prompt') || e.target.closest('.tv-ctrl-btn') || e.target.closest('#lamp-switch')) return;
    isDraggingCam = true; lastTouchX = e.clientX; lastTouchY = e.clientY;
});
window.addEventListener('pointermove', (e) => {
    if (!isDraggingCam || activeModule !== null) return;
    const deltaX = e.clientX - lastTouchX; const deltaY = e.clientY - lastTouchY;
    lastTouchX = e.clientX; lastTouchY = e.clientY;
    yaw -= deltaX * lookSensitivity; pitch -= deltaY * lookSensitivity;
    pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, pitch));
});
window.addEventListener('pointerup', () => { isDraggingCam = false; }); window.addEventListener('pointerleave', () => { isDraggingCam = false; }); 

// ==========================================
// 8. GAME STATE & INTERACTION
// ==========================================
const roomDarkness = document.getElementById('room-darkness-overlay');
const lampSwitch = document.getElementById('lamp-switch');
const interactionPrompt = document.getElementById('interaction-prompt');
const moduleBook = document.getElementById('subsystem-book');
const btnCloseBook = document.getElementById('close-book-module');
const cursorReticle = document.getElementById('cursor-reticle');
const tvPrompt = document.getElementById('tv-interaction-prompt');
const btnTvPlay = document.getElementById('btn-tv-play');
const btnTvMute = document.getElementById('btn-tv-mute');

let isRoomLit = false; let activeModule = null; 
let isNearBook = false; let isNearTV = false;
let isLampOn = false;

if (lampSwitch) {
    const triggerRoomLight = (e) => {
        if (e) { e.preventDefault(); e.stopPropagation(); } 
        if (isRoomLit) return;
        isRoomLit = true; 
        requestTvPlayback();
        gsap.to(renderer, { toneMappingExposure: 1.28, duration: 1.6 });
        gsap.to(ambientLight, { intensity: 0.42, duration: 1.5 }); 
        gsap.to(hemisphereLight, { intensity: 0.52, duration: 1.5 });
        gsap.to(pointLight, { intensity: 18, duration: 1.5 });
        gsap.to(moonLight, { intensity: 1.05, duration: 1.7 });
        gsap.to(rimLight, { intensity: 0.38, duration: 1.7 });
        if(roomDarkness) {
            roomDarkness.style.opacity = '0'; 
            setTimeout(() => { roomDarkness.classList.add('lit'); }, 1500);
        }
        gsap.to(lampSwitch, { opacity: 0, duration: 0.5, onComplete: () => { lampSwitch.style.display = 'none'; }});
    };
    lampSwitch.addEventListener('click', triggerRoomLight);
    lampSwitch.addEventListener('pointerdown', triggerRoomLight);
}

syncTvMuteLabel();

function triggerInteraction() {
    if(!isNearBook || activeModule === 'book') return;
    activeModule = 'book'; isDraggingCam = false; interactionPrompt.classList.remove('visible'); cursorReticle.classList.remove('active');
    if(joyZone) joyZone.style.opacity = '0';
    
    const targetPos = new THREE.Vector3(bookMesh.position.x + 1.2, 1.4, bookMesh.position.z);
    gsap.to(camera.position, { x: targetPos.x, y: targetPos.y, z: targetPos.z, duration: 1.5, ease: "power3.inOut" });
    
    const targetEuler = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(targetPos, bookMesh.position, camera.up)), 'YXZ');
    gsap.to(camera.rotation, {
        x: targetEuler.x, y: targetEuler.y, z: targetEuler.z, duration: 1.5, ease: "power3.inOut",
        onComplete: () => { moduleBook.classList.add('active'); initStarParticles(); yaw = camera.rotation.y; pitch = camera.rotation.x; }
    });
}
if(interactionPrompt) interactionPrompt.addEventListener('click', triggerInteraction);

if(btnCloseBook) {
    btnCloseBook.addEventListener('click', () => {
        moduleBook.classList.remove('active');
        gsap.to(camera.position, { x: player.position.x, y: 1.6, z: player.position.z, duration: 1.5, ease: "power3.inOut", onComplete: () => { activeModule = null; if(joyZone) joyZone.style.opacity = '1'; } });
    });
}

if(btnTvPlay && videoElement) btnTvPlay.addEventListener('click', () => { if (videoElement.paused) requestTvPlayback(); else videoElement.pause(); });
if(btnTvMute && videoElement) btnTvMute.addEventListener('click', () => { videoElement.muted = !videoElement.muted; syncTvMuteLabel(); });

window.addEventListener('keydown', (e) => { 
    const k = e.key.toLowerCase();
    if (isRoomLit && activeModule === null) {
        if(k === 'e') triggerInteraction(); 
        if(k === 'l') {
            isLampOn = !isLampOn;
            gsap.to(lampLight, { intensity: isLampOn ? 5.6 : 0, duration: 0.3 });
            gsap.to(lampShadeMat, { emissiveIntensity: isLampOn ? 1.15 : 0, duration: 0.3 });
        }
    }
    if (isNearTV && activeModule === null && videoElement) {
        if (k === 'p') { if (videoElement.paused) requestTvPlayback(); else videoElement.pause(); }
        if (k === 'm') { videoElement.muted = !videoElement.muted; syncTvMuteLabel(); }
    }
});

// ==========================================
// 9. MAIN RENDER LOOP 
// ==========================================
const clock = new THREE.Clock();
const moveDirection = new THREE.Vector3(); const forward = new THREE.Vector3(); const right = new THREE.Vector3();

function animate() {
    requestAnimationFrame(animate);
    const time = clock.getElapsedTime();
    const screenPulse = videoElement && !videoElement.paused ? 0.75 + Math.sin(time * 7.5) * 0.16 : 0.18;

    tvLight.intensity = isRoomLit ? screenPulse : 0;
    screenGlow.intensity = isRoomLit ? screenPulse * 0.72 : 0;
    tvScreenMat.emissiveIntensity = isRoomLit ? 0.92 + Math.sin(time * 6.2) * 0.08 : 0.18;
    rimLight.intensity = isRoomLit ? 0.38 + Math.sin(time * 0.8) * 0.05 : 0.08;
    moonLight.intensity = isRoomLit ? 1.05 : 0.22;
    candleLights.forEach((light, index) => {
        light.intensity = 0.95 + Math.sin(time * 8 + index * 1.4) * 0.2;
    });
    
    bookMesh.position.y = 0.75 + Math.sin(time * 3) * 0.05;

    kinematicBalloons.forEach((bData) => {
        bData.mesh.position.y = bData.baseY + Math.sin(time * 2 + bData.phaseOffset) * 0.05;
    });

    if (isRoomLit && activeModule === null) {
        let moveForward = 0; let moveRight = 0;
        if(keys.w) moveForward += 1; 
        if(keys.s) moveForward -= 1; 
        if(keys.a) moveRight -= 1; 
        if(keys.d) moveRight += 1;
        
        if(joyActive) { moveRight += joyVector.x; moveForward -= joyVector.y; }

        if (moveForward !== 0 || moveRight !== 0) {
            moveDirection.set(moveRight, 0, moveForward).normalize().multiplyScalar(playerSpeed);
            camera.getWorldDirection(forward); forward.y = 0; forward.normalize(); right.crossVectors(forward, camera.up).normalize(); 
            player.position.addScaledVector(right, moveDirection.x); player.position.addScaledVector(forward, moveDirection.z);
        }

        player.position.x = Math.max(-3.0, Math.min(3.0, player.position.x)); 
        player.position.z = Math.max(-3.0, Math.min(3.5, player.position.z));
        
        if (player.position.z > 1.6 && player.position.x > -0.8 && player.position.x < 0.8) {
            player.position.z = 1.6; 
        }

        const tMinX = 2.2; 
        const tMaxZ = 1.4; 
        const tMinZ = -1.4; 
        
        if (player.position.x > tMinX && player.position.z > tMinZ && player.position.z < tMaxZ) {
            const dFront = player.position.x - tMinX;
            const dLeft = player.position.z - tMinZ;
            const dRight = tMaxZ - player.position.z;
            
            const minD = Math.min(dFront, dLeft, dRight);
            if (minD === dFront) player.position.x = tMinX;
            else if (minD === dLeft) player.position.z = tMinZ;
            else player.position.z = tMaxZ;
        }
        
        camera.position.set(player.position.x, 1.6, player.position.z); 
        camera.rotation.set(pitch, yaw, 0, 'YXZ');

        if (player.position.distanceTo(shelf.position) <= interactionRadius) {
            if (!isNearBook) { 
                isNearBook = true; 
                if(interactionPrompt) { interactionPrompt.innerHTML = "PRESSIONE [ E ] PARA LER | [ L ] ABAJUR"; interactionPrompt.classList.add('visible'); }
                if(cursorReticle) cursorReticle.classList.add('active'); 
                gsap.to(coverMat, { emissiveIntensity: 1.5, duration: 0.3 }); 
            }
        } else {
            if (isNearBook) { 
                isNearBook = false; 
                if(interactionPrompt) interactionPrompt.classList.remove('visible'); 
                if(cursorReticle) cursorReticle.classList.remove('active'); 
                gsap.to(coverMat, { emissiveIntensity: 0.2, duration: 0.3 }); 
            }
        }

        if (tvPrompt && player.position.distanceTo(tvGroup.position) <= interactionRadius + 0.5) { 
            if (!isNearTV) { isNearTV = true; tvPrompt.classList.add('visible'); }
        } else {
            if (isNearTV && tvPrompt) { isNearTV = false; tvPrompt.classList.remove('visible'); }
        }
    }
    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });

// ==========================================
// 10. ISOLATED BOOK LOGIC
// ==========================================
const coverWrapper = document.querySelector('.book-cover-wrapper'); const pages = document.querySelectorAll('.page'); const starCanvas = document.getElementById('star-particles'); const photoCh1 = document.getElementById('ch1-photo'); const immersionLayer = document.getElementById('immersion-layer'); const closeImmersionBtn = document.getElementById('close-immersion'); const galaxyMap = document.getElementById('galaxy-map'); const staticStarsLayer = document.getElementById('static-stars-layer'); const interactiveStars = document.querySelectorAll('.interactive-star'); const hudOverlay = document.getElementById('hud-message-overlay'); const hudText = document.getElementById('hud-text');
let currentPage = 0; const totalPages = pages.length; let isAnimatingBook = false; 

if(moduleBook) {
    moduleBook.addEventListener('click', (event) => {
        if (isAnimatingBook || activeModule !== 'book') return; 
        if (event.target.closest('#immersion-layer') || event.target.closest('.interactive-frame') || event.target.closest('.module-close-btn')) return;
        const clickX = event.clientX; const screenW = window.innerWidth; const clickedLeftBook = event.target.closest('.book-cover-wrapper');
        if (currentPage === 0) { if (clickedLeftBook) goToPage(1); } else { if (clickedLeftBook) { goToPage(currentPage - 1); } else if (clickX > screenW / 2) { goToPage(currentPage + 1); } }
    });
}

function goToPage(index) {
    if (index < 0 || index >= totalPages) return; isAnimatingBook = true; currentPage = index;
    if (currentPage > 0) { coverWrapper.style.transformOrigin = "left center"; coverWrapper.style.transform = "rotateY(-140deg) translateZ(10px)"; } else { coverWrapper.style.transformOrigin = "left center"; coverWrapper.style.transform = "rotateY(0deg) translateZ(0)"; }
    setTimeout(() => { pages.forEach((page, i) => { if (i === currentPage && i !== 0) { page.classList.add('active'); const magicTexts = page.querySelectorAll('.magic-text'); let globalWordOffset = 0; magicTexts.forEach(textBlock => { globalWordOffset = revealText(textBlock, globalWordOffset); }); } else { page.classList.remove('active'); } }); isAnimatingBook = false; }, 300); 
}

function revealText(element, startOffset = 0) {
    if (!element || element.dataset.done === "true") return startOffset; const originalText = element.innerText; element.innerHTML = ''; const words = originalText.split(' ');
    words.forEach((word, index) => { const span = document.createElement('span'); span.innerHTML = word + '&nbsp;'; span.style.opacity = '0'; span.style.filter = 'blur(8px)'; span.style.display = 'inline-block'; span.style.transform = 'translateY(5px)'; span.style.transition = `all 0.8s cubic-bezier(0.23, 1, 0.32, 1) ${(startOffset + index) * 0.05}s`; element.appendChild(span); requestAnimationFrame(() => { span.style.opacity = '1'; span.style.filter = 'blur(0px)'; span.style.transform = 'translateY(0px)'; }); });
    element.dataset.done = "true"; return startOffset + words.length; 
}

let isDraggingMap = false; let dragThresholdMet = false; let startXMap = 0, startYMap = 0; let currentTransX = 0, currentTransY = 0; let initialTransX = 0, initialTransY = 0;
function generateGalaxyBackground() { const mapWidth = window.innerWidth * 3; const mapHeight = window.innerHeight * 3; const shadows = []; for(let i = 0; i < 600; i++) { const x = Math.floor(Math.random() * mapWidth); const y = Math.floor(Math.random() * mapHeight); const size = Math.random() < 0.85 ? 1 : 2; const alpha = (Math.random() * 0.5 + 0.1).toFixed(2); shadows.push(`${x}px ${y}px 0 ${size}px rgba(255,255,255,${alpha})`); } if(staticStarsLayer) { staticStarsLayer.style.boxShadow = shadows.join(', '); staticStarsLayer.style.width = '1px'; staticStarsLayer.style.height = '1px'; } }
if (photoCh1) { photoCh1.addEventListener('click', (event) => { event.stopPropagation(); generateGalaxyBackground(); immersionLayer.classList.add('active'); currentTransX = 0; currentTransY = 0; galaxyMap.style.transform = `translate3d(0px, 0px, 0)`; }); }
if (closeImmersionBtn) { closeImmersionBtn.addEventListener('click', (event) => { event.stopPropagation(); immersionLayer.classList.remove('active'); hudOverlay.classList.remove('visible'); }); }
if (galaxyMap) {
    galaxyMap.addEventListener('pointerdown', (e) => { isDraggingMap = true; dragThresholdMet = false; startXMap = e.clientX; startYMap = e.clientY; initialTransX = currentTransX; initialTransY = currentTransY; });
    window.addEventListener('pointermove', (e) => { if (!isDraggingMap || activeModule !== 'book') return; const dx = e.clientX - startXMap; const dy = e.clientY - startYMap; if (Math.abs(dx) > 10 || Math.abs(dy) > 10) dragThresholdMet = true; currentTransX = initialTransX + dx; currentTransY = initialTransY + dy; galaxyMap.style.transform = `translate3d(${currentTransX}px, ${currentTransY}px, 0)`; });
}
window.addEventListener('pointerup', () => { isDraggingMap = false; });
interactiveStars.forEach(star => { star.addEventListener('click', (e) => { e.stopPropagation(); if (dragThresholdMet) return; const msg = star.getAttribute('data-message'); hudText.innerHTML = `"${msg}"`; hudOverlay.classList.add('visible'); }); });
if(hudOverlay) hudOverlay.addEventListener('click', (e) => { e.stopPropagation(); hudOverlay.classList.remove('visible'); });

function initStarParticles() {
    if (!starCanvas) return; const context = starCanvas.getContext('2d'); if (!context) return; const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; const stars = []; let width = 0; let height = 0;
    function resizeCanvas() { width = window.innerWidth; height = window.innerHeight; starCanvas.width = width; starCanvas.height = height; }
    function createStar(randomY = true) { return { x: Math.random() * width, y: randomY ? Math.random() * height : -20, size: Math.random() * 1.8 + 0.4, speedY: Math.random() * 0.35 + 0.12, driftX: (Math.random() - 0.5) * 0.15, alpha: Math.random() * 0.35 + 0.15, twinkle: Math.random() * Math.PI * 2, twinkleSpeed: Math.random() * 0.02 + 0.005 }; }
    function buildStars() { stars.length = 0; const count = reduceMotion ? 30 : (window.innerWidth < 768 ? 45 : 80); for (let i = 0; i < count; i += 1) { stars.push(createStar(true)); } }
    function drawStars() { if(activeModule !== 'book') return; context.clearRect(0, 0, width, height); stars.forEach((star, index) => { star.y += reduceMotion ? star.speedY * 0.45 : star.speedY; star.x += reduceMotion ? star.driftX * 0.5 : star.driftX; star.twinkle += star.twinkleSpeed; if (star.y > height + 15) { stars[index] = createStar(false); return; } if (star.x < -10) star.x = width + 10; if (star.x > width + 10) star.x = -10; const twinkleAlpha = star.alpha + Math.sin(star.twinkle) * 0.08; context.beginPath(); context.fillStyle = `rgba(255, 244, 214, ${Math.max(0.08, twinkleAlpha)})`; context.arc(star.x, star.y, star.size, 0, Math.PI * 2); context.fill(); }); requestAnimationFrame(drawStars); }
    resizeCanvas(); buildStars(); drawStars();
}