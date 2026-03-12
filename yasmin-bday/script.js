/**
 * @file script.js
 * @description Kinematic FPS Engine & State Machine. 
 * Rollback: Remoção do EnvMap em tempo real por custo excessivo de processamento. 
 * Mantido: Cinematic Flythrough, Foil Balloons (Corações) e Azulejaria Procedural.
 */

import * as THREE from 'three';
import gsap from 'gsap';

// ==========================================
// 1. ENGINE CORE: RENDERER & SCENE
// ==========================================
const isMobileDevice = window.matchMedia('(pointer: coarse), (max-width: 900px)').matches;
const textureSize = isMobileDevice ? 512 : 1024;
const textureAnisotropy = isMobileDevice ? 2 : 4;
// Se o dispositivo já tem MSAA ligado (!isMobileDevice), ou se a tela for gigante, podemos limitar a densidade de pixels para poupar até 60% da carga da placa de vídeo sem perder qualidade visual.
const maxPixelRatio = isMobileDevice ? 1 : (window.innerWidth > 1600 ? 1 : 1.25);
const decorativeCastShadow = !isMobileDevice;

const canvas = document.getElementById('webgl-canvas');
const paintCanvasElement = document.getElementById('paint-canvas');
const paintContext = paintCanvasElement ? paintCanvasElement.getContext('2d') : null;
// Usando MSAA nativo da GPU para suavizar as bordas de graça (muito mais barato que aumentar Resolução Raw)
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isMobileDevice, powerPreference: 'high-performance', stencil: false, depth: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio));

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
// Aumentar levemente a percepção de contraste do ACES para algo mais cinematográfico sem custo ("grátis")
renderer.toneMappingExposure = 1.15;

function requestShadowUpdate() {
    if (!renderer.shadowMap.enabled) return;
    renderer.shadowMap.needsUpdate = true;
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x141924);
scene.fog = new THREE.FogExp2(0x141924, 0.016);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100); 
camera.rotation.order = 'YXZ'; 
camera.position.set(0, 1.6, 3.5);
camera.lookAt(0, 1.6, 0);

const audioListener = new THREE.AudioListener();
camera.add(audioListener);

let paintCanvasTexture = null;
if (paintCanvasElement && paintContext) {
    paintContext.fillStyle = '#fffdf8';
    paintContext.fillRect(0, 0, paintCanvasElement.width, paintCanvasElement.height);
    paintCanvasTexture = new THREE.CanvasTexture(paintCanvasElement);
    paintCanvasTexture.colorSpace = THREE.SRGBColorSpace;
}

// ==========================================
// 2. AUDIO SYSTEM & ILLUMINATION
// ==========================================
// Substituindo luz ambiente opaca por HemisphereLight (custo zero, mais realista adicionando "rebatimento" de cor do piso e teto)
const ambientLight = new THREE.HemisphereLight(0xfff5e6, 0x1c1924, 0.03); // começa bem baixo para dar o clima escuro SEM usar CSS pesado
scene.add(ambientLight);

const pointLight = new THREE.PointLight(0xffeedd, 0, 15); 
pointLight.position.set(0, 4, 0); 
pointLight.castShadow = true; 
pointLight.shadow.bias = -0.001;
// Sombra em boa resolução, porém não tão alta para evitar "travamento" ao calcular a sombra na hora de acender a luz
pointLight.shadow.mapSize.width = isMobileDevice ? 1024 : 2048;
pointLight.shadow.mapSize.height = isMobileDevice ? 1024 : 2048;
// Ajuste para deixar a sombra ligeiramente mais suave e natural nas bordas
pointLight.shadow.radius = 1.5;
scene.add(pointLight);

// ==========================================
// 3. TEXTURAS PROCEDURAIS (CANVAS API)
// ==========================================
function createProceduralTexture(drawFn, width = textureSize, height = textureSize) {
    const textureCanvas = document.createElement('canvas');
    textureCanvas.width = width;
    textureCanvas.height = height;
    const context = textureCanvas.getContext('2d');
    drawFn(context, width, height);
    const texture = new THREE.CanvasTexture(textureCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), textureAnisotropy);
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
    const tiles = 4;
    const size = width / tiles;
    const grout = 2; 
    
    context.fillStyle = '#b0b5b9';
    context.fillRect(0, 0, width, height);
    
    for (let x = 0; x < tiles; x++) {
        for (let y = 0; y < tiles; y++) {
            const tx = x * size + grout;
            const ty = y * size + grout;
            const tSize = size - grout * 2;
            
            const grad = context.createLinearGradient(tx, ty, tx + tSize, ty + tSize);
            grad.addColorStop(0, '#ffffff');
            grad.addColorStop(1, '#f2f4f7');
            
            context.fillStyle = grad;
            context.fillRect(tx, ty, tSize, tSize);
            
            context.strokeStyle = 'rgba(30, 59, 112, 0.08)';
            context.lineWidth = 1;
            context.strokeRect(tx + tSize * 0.08, ty + tSize * 0.08, tSize * 0.84, tSize * 0.84);
        }
    }
    addSpeckle(context, width, height, 300, 0.015);
});
floorTexture.repeat.set(6, 6);

const wallTexture = createProceduralTexture((context, width, height) => {
    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#ddd0c1');
    gradient.addColorStop(0.5, '#c7b29e');
    gradient.addColorStop(1, '#a58d77');
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    context.fillStyle = 'rgba(255, 255, 255, 0.035)';
    for (let blotch = 0; blotch < 34; blotch += 1) {
        context.beginPath();
        context.ellipse(Math.random() * width, Math.random() * height, Math.random() * 120 + 40, Math.random() * 90 + 24, Math.random() * Math.PI, 0, Math.PI * 2);
        context.fill();
    }

    context.strokeStyle = 'rgba(95, 70, 50, 0.025)';
    context.lineWidth = 2;
    for (let crack = 0; crack < 18; crack += 1) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        context.beginPath();
        context.moveTo(x, y);
        context.lineTo(x + Math.random() * 80 - 40, y + Math.random() * 120 - 60);
        context.stroke();
    }
    addSpeckle(context, width, height, 500, 0.018);
});
wallTexture.repeat.set(0.9, 0.9);

const ceilingTexture = new THREE.TextureLoader().load('./yasmin-bday/imagens/estrelas.png');
ceilingTexture.colorSpace = THREE.SRGBColorSpace;
ceilingTexture.wrapS = THREE.RepeatWrapping;
ceilingTexture.wrapT = THREE.RepeatWrapping;
ceilingTexture.repeat.set(1, 1);
ceilingTexture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), textureAnisotropy);

// ==========================================
// 4. ARCHITECTURE (Quarto 8x8)
// ==========================================
const roomSize = { width: 8, height: 5, depth: 8 };

const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(roomSize.width, roomSize.depth, 1, 1), 
    new THREE.MeshStandardMaterial({ map: floorTexture, color: 0xffffff, roughness: 0.1, metalness: 0.05 })
);
floor.rotation.x = -Math.PI / 2; 
floor.receiveShadow = true;
scene.add(floor);

const gridHelper = new THREE.GridHelper(roomSize.width, 10, 0x444444, 0x222222);
gridHelper.position.y = 0.01; gridHelper.visible = false; scene.add(gridHelper);

const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(roomSize.width, roomSize.depth), new THREE.MeshStandardMaterial({ map: ceilingTexture, color: 0xffffff, roughness: 0.95 }));
ceiling.rotation.x = Math.PI / 2; ceiling.position.y = roomSize.height; scene.add(ceiling);

const frontBackWallMat = new THREE.MeshStandardMaterial({ map: wallTexture, color: 0xe4d6c8, roughness: 0.88, side: THREE.DoubleSide });
const leftRightWallMat = new THREE.MeshStandardMaterial({ map: wallTexture.clone(), color: 0xc9d2d6, roughness: 0.9, side: THREE.DoubleSide });
leftRightWallMat.map.repeat.set(0.95, 1.05);

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
// 5. PROPS & MÓVEIS 
// ==========================================
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
const blanket = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.05, 1.3), new THREE.MeshStandardMaterial({ color: 0xd78aa6, roughness: 0.88 }));
blanket.position.set(0, 0.56, -0.35); blanket.castShadow = true;
bedGroup.add(bedFrame, headboard, mattress, pillow, blanket);
bedGroup.position.set(0, 0, 2.95); 
scene.add(bedGroup);

const bedsideTableGroup = new THREE.Group();
const bedsideWoodMat = new THREE.MeshStandardMaterial({ color: 0x5b4030, roughness: 0.82 });
const bedsideTop = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.08, 0.62), bedsideWoodMat);
bedsideTop.position.y = 0.62; bedsideTop.castShadow = true; bedsideTop.receiveShadow = true;
bedsideTableGroup.add(bedsideTop);

const bedsideShelf = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.5), new THREE.MeshStandardMaterial({ color: 0x4a3325, roughness: 0.85 }));
bedsideShelf.position.y = 0.28; bedsideShelf.castShadow = true; bedsideShelf.receiveShadow = true;
bedsideTableGroup.add(bedsideShelf);

for (const legX of [-0.24, 0.24]) {
    for (const legZ of [-0.24, 0.24]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.6, 0.06), bedsideWoodMat);
        leg.position.set(legX, 0.3, legZ);
        leg.castShadow = true;
        bedsideTableGroup.add(leg);
    }
}

const radioGroup = new THREE.Group();
const radioBody = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.18, 0.18), new THREE.MeshStandardMaterial({ color: 0x2b2422, roughness: 0.7, metalness: 0.18 }));
radioBody.position.y = 0.12; radioBody.castShadow = true; radioBody.receiveShadow = true;
radioGroup.add(radioBody);

const speakerMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.92 });
const speakerLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.02, 18), speakerMat);
speakerLeft.rotation.x = Math.PI / 2; speakerLeft.position.set(-0.095, 0.12, 0.095);
radioGroup.add(speakerLeft);
const speakerRight = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.02, 18), speakerMat);
speakerRight.rotation.x = Math.PI / 2; speakerRight.position.set(0.095, 0.12, 0.095);
radioGroup.add(speakerRight);

const tunerPanel = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.03, 0.01), new THREE.MeshStandardMaterial({ color: 0xc9ae74, roughness: 0.35, metalness: 0.5 }));
tunerPanel.position.set(0, 0.15, 0.096);
radioGroup.add(tunerPanel);

const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.26, 8), new THREE.MeshStandardMaterial({ color: 0xb7b7b7, roughness: 0.3, metalness: 0.85 }));
antenna.position.set(0.11, 0.27, 0.02); antenna.rotation.z = -0.18;
radioGroup.add(antenna);

const radioButton = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.02, 14), new THREE.MeshStandardMaterial({ color: 0xd7c7a3, roughness: 0.4, metalness: 0.25 }));
radioButton.rotation.x = Math.PI / 2; radioButton.position.set(0.14, 0.08, 0.095);
radioGroup.add(radioButton);

radioGroup.rotation.y = Math.PI;
radioGroup.position.set(0, 0.62, 0);
bedsideTableGroup.add(radioGroup);
bedsideTableGroup.position.set(1.08, 0, 3.42);
scene.add(bedsideTableGroup);

const bookshelfGroup = new THREE.Group();
const bookshelfMat = new THREE.MeshStandardMaterial({ color: 0x5a3f2e, roughness: 0.82 });
const shelfBoardMat = new THREE.MeshStandardMaterial({ color: 0x6a4b36, roughness: 0.78 });
const bookColors = [0xc94f6d, 0x4567b7, 0xe2b34a, 0x7d5fb2, 0x3f8f6b, 0xf2e6d6];

const shelfSideLeft = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.25, 0.62), bookshelfMat);
shelfSideLeft.position.set(-0.32, 1.125, 0);
shelfSideLeft.castShadow = true;
shelfSideLeft.receiveShadow = true;
bookshelfGroup.add(shelfSideLeft);

const shelfSideRight = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.25, 0.62), bookshelfMat);
shelfSideRight.position.set(0.32, 1.125, 0);
shelfSideRight.castShadow = true;
shelfSideRight.receiveShadow = true;
bookshelfGroup.add(shelfSideRight);

const shelfTop = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.08, 0.62), shelfBoardMat);
shelfTop.position.set(0, 2.22, 0);
shelfTop.castShadow = true;
shelfTop.receiveShadow = true;
bookshelfGroup.add(shelfTop);

const shelfBottom = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.08, 0.62), shelfBoardMat);
shelfBottom.position.set(0, 0.04, 0);
shelfBottom.castShadow = true;
shelfBottom.receiveShadow = true;
bookshelfGroup.add(shelfBottom);

[-0.52, 0.12, 0.78, 1.42].forEach((levelY) => {
    const shelfBoard = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.06, 0.58), shelfBoardMat);
    shelfBoard.position.set(0, levelY, 0);
    shelfBoard.castShadow = true;
    shelfBoard.receiveShadow = true;
    bookshelfGroup.add(shelfBoard);
});

[-0.52, 0.12, 0.78, 1.42].forEach((levelY, shelfIndex) => {
    for (let index = 0; index < 7; index += 1) {
        const bookHeight = 0.22 + (index % 3) * 0.08;
        const bookDepth = 0.18 + (index % 2) * 0.02;
        const book = new THREE.Mesh(
            new THREE.BoxGeometry(0.06, bookHeight, bookDepth),
            new THREE.MeshStandardMaterial({ color: bookColors[(shelfIndex + index) % bookColors.length], roughness: 0.76 })
        );
        book.position.set(-0.2 + index * 0.065, levelY + 0.03 + (bookHeight / 2), -0.02 + ((index % 2) * 0.04 - 0.02));
        book.rotation.z = (index % 2 === 0 ? -1 : 1) * 0.04;
        book.castShadow = true;
        bookshelfGroup.add(book);
    }
    const stackedBook = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.05, 0.24),
        new THREE.MeshStandardMaterial({ color: bookColors[(shelfIndex + 2) % bookColors.length], roughness: 0.78 })
    );
    stackedBook.position.set(0.19, levelY + 0.085, 0.08);
    stackedBook.castShadow = true;
    stackedBook.rotation.y = 0.15;
    bookshelfGroup.add(stackedBook);
});

bookshelfGroup.position.set(3.56, 0, 2.85);
bookshelfGroup.rotation.y = -Math.PI / 2;
scene.add(bookshelfGroup);

const radioAudioElement = document.getElementById('radio-audio');
const radioPlaylist = [
    './yasmin-bday/musicas/14 Bis - Todo azul do mar.mp3',
    './yasmin-bday/musicas/Belchior - Coração selvagem.mp3',
    './yasmin-bday/musicas/Billy Joel - Vienna.mp3',
    './yasmin-bday/musicas/Djavan - Encontrar-Te.mp3',
    './yasmin-bday/musicas/Djavan - Pétala.mp3',
    './yasmin-bday/musicas/Djavan - Ventos do Norte.mp3'
].map(path => encodeURI(path));
let currentRadioTrackIndex = 0;

function loadRadioTrack(trackIndex) {
    if (!radioAudioElement || radioPlaylist.length === 0) return;

    currentRadioTrackIndex = (trackIndex + radioPlaylist.length) % radioPlaylist.length;
    const nextTrack = radioPlaylist[currentRadioTrackIndex];
    if (radioAudioElement.getAttribute('src') === nextTrack) return;

    radioAudioElement.src = nextTrack;
    radioAudioElement.load();
}

if (radioAudioElement) {
    radioAudioElement.volume = 0.55;
    radioAudioElement.preload = 'auto';
    radioAudioElement.loop = false;
    loadRadioTrack(0);
    radioAudioElement.addEventListener('ended', () => {
        console.log("Música terminou. Tocando a próxima: ", radioPlaylist[(currentRadioTrackIndex + 1) % radioPlaylist.length]);
        loadRadioTrack(currentRadioTrackIndex + 1);
        const playPromise = radioAudioElement.play();
        if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch((error) => console.warn('Nao foi possivel avancar a playlist do radio:', error));
        }
    });
}

let radioPositionalAudio = null;
if (radioAudioElement) {
    radioPositionalAudio = new THREE.PositionalAudio(audioListener);
    radioPositionalAudio.setMediaElementSource(radioAudioElement);
    radioPositionalAudio.setRefDistance(1.8);
    radioPositionalAudio.setRolloffFactor(1.7);
    radioPositionalAudio.setVolume(0.9);
    radioGroup.add(radioPositionalAudio);
}

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

function toggleRadioPlayback() {
    if (audioListener.context.state === 'suspended') {
        audioListener.context.resume();
    }
    if (!radioAudioElement || radioPlaylist.length === 0) return;

    if (radioAudioElement.paused) {
        if (!radioAudioElement.getAttribute('src')) {
            loadRadioTrack(currentRadioTrackIndex);
        }
        const playPromise = radioAudioElement.play();
        if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch((error) => console.warn('Reproducao do radio bloqueada:', error));
        }
        return;
    }

    radioAudioElement.pause();
 }

function requestTvPlayback() {
    if (audioListener.context.state === 'suspended') {
        audioListener.context.resume();
    }
    if (!videoElement) return;
    const playPromise = videoElement.play();
    if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(err => console.warn('Reproducao da TV bloqueada:', err));
    }
}

const tvScreenMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: videoTexture, roughness: 0.2, metalness: 0.15 });
const tvScreen = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.6, 0.02), tvScreenMat); 
tvScreen.position.set(0, 1.6, 0.04); tvGroup.add(tvScreen);

if(videoElement) {
    const tvAudio = new THREE.PositionalAudio(audioListener);
    tvAudio.setMediaElementSource(videoElement);
    tvAudio.setRefDistance(2.5); tvAudio.setRolloffFactor(1.5); 
    tvScreen.add(tvAudio);
}
tvGroup.position.set(0, 0, -3.4); 
scene.add(tvGroup);

// ==========================================
// 6. CANTINHO DA LEITURA & QUADROS
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
coverTexture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), textureAnisotropy);
const pageMat = new THREE.MeshStandardMaterial({ color: 0xf5ecd5, roughness: 0.9 }); 
const spineMat = new THREE.MeshStandardMaterial({ color: 0x3d2314, roughness: 0.8 }); 
const coverMat = new THREE.MeshStandardMaterial({ map: coverTexture, roughness: 0.4, metalness: 0.1, emissive: 0x4a3219, emissiveIntensity: 0.2 }); 
const bookMaterials = [pageMat, spineMat, coverMat, spineMat, pageMat, pageMat];
const bookMesh = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.11, 0.8), bookMaterials); 
bookMesh.position.set(-3.5, 0.75, -0.5); 
bookMesh.rotation.y = Math.PI / 6; 
bookMesh.castShadow = decorativeCastShadow; 
scene.add(bookMesh);

const letterGroup = new THREE.Group();
const letterPaper = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.02, 0.22),
    new THREE.MeshStandardMaterial({ color: 0xf8f1e4, roughness: 0.92 })
);
letterPaper.castShadow = decorativeCastShadow;
letterPaper.receiveShadow = true;
letterGroup.add(letterPaper);

const letterFold = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.018, 0.24, 3),
    new THREE.MeshStandardMaterial({ color: 0xefe1cd, roughness: 0.88 })
);
letterFold.rotation.z = Math.PI / 2;
letterFold.rotation.x = Math.PI;
letterFold.position.set(0, 0.016, -0.015);
letterGroup.add(letterFold);

const waxSeal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 0.012, 18),
    new THREE.MeshStandardMaterial({ color: 0xa01f3d, roughness: 0.45, metalness: 0.08 })
);
waxSeal.rotation.x = Math.PI / 2;
waxSeal.position.set(0.07, 0.018, 0.02);
letterGroup.add(waxSeal);

letterGroup.position.set(-3.68, 0.67, -1.28);
letterGroup.rotation.set(0.02, -0.3, -0.04);
scene.add(letterGroup);

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
lampLight.castShadow = false; // Removido cast de sombra para poupar 6 render passes na GPU
lampLight.shadow.bias = -0.002;
scene.add(lampLight);

function createPictureFrame(imagePath, width, height) {
    const frameGroup = new THREE.Group();
    const frameDepth = 0.05;
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.9 });
    const frameMesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, frameDepth), frameMat);
    frameMesh.castShadow = true;
    frameGroup.add(frameMesh);
    const photoTex = textureLoader.load(imagePath);
    photoTex.colorSpace = THREE.SRGBColorSpace;
    photoTex.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), textureAnisotropy);
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
const frame9 = createPictureFrame(`${assetBasePath}/yasmin9.jpeg`, 1.05, 1.35);
frame9.position.set(-2.75, 2.18, -3.95); frame9.rotation.y = 0; scene.add(frame9);

function createGiftBox(width, height, depth, boxColor, ribbonColor) {
    const giftGroup = new THREE.Group();
    const box = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, depth),
        new THREE.MeshStandardMaterial({ color: boxColor, roughness: 0.62, metalness: 0.08 })
    );
    box.position.y = height / 2;
    box.castShadow = true;
    box.receiveShadow = true;
    giftGroup.add(box);

    const ribbonMat = new THREE.MeshStandardMaterial({ color: ribbonColor, roughness: 0.38, metalness: 0.18 });
    const ribbonBandX = new THREE.Mesh(new THREE.BoxGeometry(width * 0.18, height + 0.02, depth + 0.02), ribbonMat);
    ribbonBandX.position.y = height / 2;
    giftGroup.add(ribbonBandX);

    const ribbonBandZ = new THREE.Mesh(new THREE.BoxGeometry(width + 0.02, height + 0.02, depth * 0.18), ribbonMat);
    ribbonBandZ.position.y = height / 2;
    giftGroup.add(ribbonBandZ);

    const bowLeft = new THREE.Mesh(new THREE.TorusGeometry(Math.min(width, depth) * 0.16, 0.02, 10, 18), ribbonMat);
    bowLeft.rotation.x = Math.PI / 2;
    bowLeft.rotation.z = 0.55;
    bowLeft.position.set(-width * 0.1, height + 0.03, 0);
    giftGroup.add(bowLeft);

    const bowRight = new THREE.Mesh(new THREE.TorusGeometry(Math.min(width, depth) * 0.16, 0.02, 10, 18), ribbonMat);
    bowRight.rotation.x = Math.PI / 2;
    bowRight.rotation.z = -0.55;
    bowRight.position.set(width * 0.1, height + 0.03, 0);
    giftGroup.add(bowRight);

    return giftGroup;
}

function createTulipBouquet() {
    const flowersGroup = new THREE.Group();
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x4a8a48, roughness: 0.9 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x72b061, roughness: 0.84 });
    const tulipColors = [0xd94c7b, 0xf29bb7, 0xe86d95, 0xffb067, 0xf05a88, 0xc94f6d, 0xf6a6c1];

    function createSingleTulip(colorHex) {
        const tulipGroup = new THREE.Group();
        const bloomMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.46, metalness: 0.08 });
        const stemLength = 0.52;

        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.011, stemLength, 12), stemMat);
        stem.rotation.z = Math.PI / 2;
        stem.position.x = 0.18;
        stem.castShadow = true;
        tulipGroup.add(stem);

        const leafLeft = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 12), leafMat);
        leafLeft.scale.set(0.95, 0.18, 0.34);
        leafLeft.position.set(0.06, 0.035, 0.02);
        leafLeft.rotation.z = 0.55;
        leafLeft.rotation.y = 0.25;
        tulipGroup.add(leafLeft);

        const leafRight = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 12), leafMat);
        leafRight.scale.set(0.88, 0.16, 0.3);
        leafRight.position.set(0.16, -0.03, -0.015);
        leafRight.rotation.z = -0.48;
        leafRight.rotation.y = -0.2;
        tulipGroup.add(leafRight);

        const bloomGroup = new THREE.Group();
        bloomGroup.position.set(-0.1, 0, 0);

        const centerBud = new THREE.Mesh(new THREE.SphereGeometry(0.048, 16, 16), bloomMat);
        centerBud.scale.set(0.78, 1.05, 0.78);
        bloomGroup.add(centerBud);

        [-0.7, 0, 0.7].forEach((offset, petalIndex) => {
            const petal = new THREE.Mesh(new THREE.SphereGeometry(0.04, 14, 14), bloomMat);
            petal.scale.set(0.68, 1.02, 0.46);
            petal.position.set(Math.sin(offset) * 0.03, 0.012, Math.cos(offset) * 0.02);
            petal.rotation.z = offset * 0.24;
            petal.rotation.x = petalIndex === 1 ? -0.08 : 0.1;
            bloomGroup.add(petal);
        });

        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.026, 0.052, 5), bloomMat);
        tip.position.y = 0.045;
        tip.castShadow = true;
        bloomGroup.add(tip);

        bloomGroup.rotation.z = -0.28;
        tulipGroup.add(bloomGroup);

        return tulipGroup;
    }

    [
        [-0.16, 0.0, -0.04, -0.15, -1.08],
        [-0.05, 0.015, 0.02, -0.04, -1.0],
        [0.06, 0.0, 0.035, 0.08, -1.12],
        [0.18, 0.015, -0.015, 0.16, -1.02]
    ].forEach(([x, y, z, yawOffset, layRot], index) => {
        const tulipGroup = createSingleTulip(tulipColors[index % tulipColors.length]);
        tulipGroup.position.set(x, y, z);
        tulipGroup.rotation.z = layRot;
        tulipGroup.rotation.y = yawOffset;
        flowersGroup.add(tulipGroup);
    });

    const petalMat = new THREE.MeshStandardMaterial({ color: 0xf2aac4, roughness: 0.5, metalness: 0.04 });
    const loosePetalOne = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 12), petalMat);
    loosePetalOne.scale.set(0.85, 0.15, 0.55);
    loosePetalOne.position.set(-0.02, -0.01, 0.1);
    loosePetalOne.rotation.set(0.1, 0.3, -0.35);
    flowersGroup.add(loosePetalOne);

    const loosePetalTwo = new THREE.Mesh(new THREE.SphereGeometry(0.028, 12, 12), petalMat);
    loosePetalTwo.scale.set(0.8, 0.14, 0.5);
    loosePetalTwo.position.set(0.14, -0.005, 0.09);
    loosePetalTwo.rotation.set(-0.08, -0.25, 0.22);
    flowersGroup.add(loosePetalTwo);

    flowersGroup.scale.set(1, 1, 1);
    flowersGroup.visible = true;
    return flowersGroup;
}

const presentsCornerGroup = new THREE.Group();
[
    { size: [0.48, 0.28, 0.46], color: 0x5c7cfa, ribbon: 0xffffff, pos: [-0.44, 0, 0.1], rot: -0.1 },
    { size: [0.42, 0.26, 0.42], color: 0xff9f43, ribbon: 0x7a1f1f, pos: [0.42, 0, 0.14], rot: 0.12 },
    { size: [0.34, 0.22, 0.34], color: 0x9b59b6, ribbon: 0xf5e6ff, pos: [-0.08, 0.34, 0.06], rot: -0.18 },
    { size: [0.3, 0.2, 0.3], color: 0x2ecc71, ribbon: 0xffe082, pos: [0.34, 0.28, -0.02], rot: 0.16 },
    { size: [0.24, 0.16, 0.24], color: 0xf6c445, ribbon: 0xc03a6b, pos: [-0.36, 0.28, -0.08], rot: -0.22 }
].forEach((giftData) => {
    const gift = createGiftBox(...giftData.size, giftData.color, giftData.ribbon);
    gift.position.set(...giftData.pos);
    gift.rotation.y = giftData.rot;
    presentsCornerGroup.add(gift);
});

const specialGiftGroup = new THREE.Group();
const specialGiftBase = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.3, 0.62),
    new THREE.MeshStandardMaterial({ color: 0xe94f8a, roughness: 0.62, metalness: 0.08 })
);
specialGiftBase.position.y = 0.15;
specialGiftBase.castShadow = true;
specialGiftBase.receiveShadow = true;
specialGiftGroup.add(specialGiftBase);

const specialRibbonMat = new THREE.MeshStandardMaterial({ color: 0xf8df6a, roughness: 0.34, metalness: 0.18 });
const specialRibbonX = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.32, 0.64), specialRibbonMat);
specialRibbonX.position.y = 0.16;
specialGiftGroup.add(specialRibbonX);
const specialRibbonZ = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.32, 0.11), specialRibbonMat);
specialRibbonZ.position.y = 0.16;
specialGiftGroup.add(specialRibbonZ);

const specialGiftLidPivot = new THREE.Group();
specialGiftLidPivot.position.set(0, 0.3, -0.31);
specialGiftGroup.add(specialGiftLidPivot);

const specialGiftLid = new THREE.Mesh(
    new THREE.BoxGeometry(0.66, 0.08, 0.66),
    new THREE.MeshStandardMaterial({ color: 0xf06ea0, roughness: 0.56, metalness: 0.08 })
);
specialGiftLid.position.set(0, 0.04, 0.31);
specialGiftLid.castShadow = true;
specialGiftLid.receiveShadow = true;
specialGiftLidPivot.add(specialGiftLid);

const specialLidRibbonX = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.1, 0.68), specialRibbonMat);
specialLidRibbonX.position.set(0, 0.045, 0.31);
specialGiftLidPivot.add(specialLidRibbonX);
const specialLidRibbonZ = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.1, 0.11), specialRibbonMat);
specialLidRibbonZ.position.set(0, 0.045, 0.31);
specialGiftLidPivot.add(specialLidRibbonZ);

const specialBowLeft = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.018, 10, 18), specialRibbonMat);
specialBowLeft.rotation.x = Math.PI / 2;
specialBowLeft.rotation.z = 0.6;
specialBowLeft.position.set(-0.07, 0.11, 0.31);
specialGiftLidPivot.add(specialBowLeft);
const specialBowRight = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.018, 10, 18), specialRibbonMat);
specialBowRight.rotation.x = Math.PI / 2;
specialBowRight.rotation.z = -0.6;
specialBowRight.position.set(0.07, 0.11, 0.31);
specialGiftLidPivot.add(specialBowRight);

specialGiftGroup.position.set(0.02, 0, 0.0);
specialGiftGroup.rotation.y = 0.08;
presentsCornerGroup.add(specialGiftGroup);

presentsCornerGroup.position.set(-3.18, 0, -3.18);
presentsCornerGroup.rotation.y = Math.PI / 4;
scene.add(presentsCornerGroup);

const tulipBouquetGroup = createTulipBouquet();
tulipBouquetGroup.position.set(-0.02, 0.62, 0.26);
tulipBouquetGroup.rotation.y = -0.42;
bedGroup.add(tulipBouquetGroup);

const easelGroup = new THREE.Group();
const easelWoodMat = new THREE.MeshStandardMaterial({ color: 0x7c5a3e, roughness: 0.82 });
const easelLegGeo = new THREE.BoxGeometry(0.08, 2.05, 0.08);
const easelLeftLeg = new THREE.Mesh(easelLegGeo, easelWoodMat);
easelLeftLeg.position.set(-0.46, 1.02, 0.02); easelLeftLeg.rotation.z = 0.12; easelLeftLeg.castShadow = true;
const easelRightLeg = new THREE.Mesh(easelLegGeo, easelWoodMat);
easelRightLeg.position.set(0.46, 1.02, 0.02); easelRightLeg.rotation.z = -0.12; easelRightLeg.castShadow = true;
const easelBackLeg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.85, 0.07), easelWoodMat);
easelBackLeg.position.set(0, 0.9, -0.48); easelBackLeg.rotation.x = -0.38; easelBackLeg.castShadow = true;
const easelCrossbar = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.08, 0.08), easelWoodMat);
easelCrossbar.position.set(0, 1.2, 0.03); easelCrossbar.castShadow = true;
const easelShelf = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.08, 0.18), easelWoodMat);
easelShelf.position.set(0, 0.8, 0.11); easelShelf.castShadow = true;

const paintFrame = new THREE.Mesh(new THREE.BoxGeometry(1.18, 1.42, 0.06), new THREE.MeshStandardMaterial({ color: 0x1d1410, roughness: 0.8 }));
paintFrame.position.set(0, 1.58, 0.02); paintFrame.castShadow = true;
const paintSurface = new THREE.Mesh(
    new THREE.PlaneGeometry(1.0, 1.24),
    new THREE.MeshStandardMaterial({ color: 0xffffff, map: paintCanvasTexture, roughness: 0.96, metalness: 0.02 })
);
paintSurface.position.set(0, 1.58, 0.055);

easelGroup.add(easelLeftLeg, easelRightLeg, easelBackLeg, easelCrossbar, easelShelf, paintFrame, paintSurface);
easelGroup.position.set(3.42, 0, -2.72);
easelGroup.rotation.y = -0.9;
scene.add(easelGroup);


// ==========================================
// 7. BANNERS, CONFETES & BALÕES CORAÇÃO (Foil Material)
// ==========================================
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
        ctx.clearRect(0, 0, w, h);
        ctx.shadowColor = 'rgba(0, 0, 0, 0.18)';
        ctx.shadowBlur = 24;
        ctx.fillStyle = '#b14d73';
        ctx.beginPath();
        ctx.moveTo(90, h * 0.28);
        ctx.lineTo(18, h * 0.5);
        ctx.lineTo(90, h * 0.72);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(w - 90, h * 0.28);
        ctx.lineTo(w - 18, h * 0.5);
        ctx.lineTo(w - 90, h * 0.72);
        ctx.closePath();
        ctx.fill();

        ctx.shadowBlur = 0;
        const gradient = ctx.createLinearGradient(0, 0, w, h);
        gradient.addColorStop(0, '#d97aa1');
        gradient.addColorStop(0.5, '#f3a6c0');
        gradient.addColorStop(1, '#cf6e96');
        ctx.fillStyle = gradient;
        ctx.fillRect(78, 34, w - 156, h - 68);

        ctx.strokeStyle = '#f7d36a';
        ctx.lineWidth = 12;
        ctx.strokeRect(88, 44, w - 176, h - 88);

        ctx.strokeStyle = 'rgba(255, 248, 225, 0.75)';
        ctx.lineWidth = 3;
        ctx.strokeRect(110, 64, w - 220, h - 128);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
        ctx.fillRect(96, 50, w - 192, 28);

        ctx.fillStyle = '#fff8ef';
        ctx.font = `italic bold ${h * 0.34}px Georgia, serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, w / 2, h / 2 + 2);

        ctx.font = `bold ${h * 0.08}px Arial, sans-serif`;
        ctx.letterSpacing = '0.18em';
        ctx.fillStyle = 'rgba(255, 243, 222, 0.9)';
        ctx.fillText('COM MUITO CARINHO', w / 2, h * 0.24);

        ctx.beginPath();
        ctx.fillStyle = '#f7d36a';
        ctx.arc(132, h / 2, 8, 0, Math.PI * 2);
        ctx.arc(w - 132, h / 2, 8, 0, Math.PI * 2);
        ctx.fill();
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

const hbTex = createBannerTexture("Feliz Aniversario", 1024, 256, false);
const hbMat = new THREE.MeshStandardMaterial({ map: hbTex, roughness: 0.8 });
const hbMesh = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 0.75), hbMat);
hbMesh.position.set(0, 3.2, -3.95); scene.add(hbMesh);

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

const heartShape = new THREE.Shape();
heartShape.moveTo( 25, 25 );
heartShape.bezierCurveTo( 25, 25, 20, 0, 0, 0 );
heartShape.bezierCurveTo( - 30, 0, - 30, 35, - 30, 35 );
heartShape.bezierCurveTo( - 30, 55, - 10, 77, 25, 95 );
heartShape.bezierCurveTo( 60, 77, 80, 55, 80, 35 );
heartShape.bezierCurveTo( 80, 35, 80, 0, 50, 0 );
heartShape.bezierCurveTo( 35, 0, 25, 25, 25, 25 );

const foilExtrudeSettings = isMobileDevice
    ? { depth: 10, bevelEnabled: true, bevelSegments: 6, steps: 1, bevelSize: 4, bevelThickness: 5 }
    : { depth: 10, bevelEnabled: true, bevelSegments: 16, steps: 2, bevelSize: 4, bevelThickness: 5 };
const heartGeo = new THREE.ExtrudeGeometry( heartShape, foilExtrudeSettings );
heartGeo.center(); heartGeo.rotateZ(Math.PI); heartGeo.scale(0.0055, 0.0055, 0.0055);

const kinematicBalloons = [];
function createHeartBalloon(x, y, z, colorHex) {
    const bGroup = new THREE.Group();
    const bMesh = new THREE.Mesh(heartGeo, new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.15, metalness: 0.85 }));
    bMesh.castShadow = decorativeCastShadow;
    
    const heartTipOffset = 0.28; 
    const stringLength = y - heartTipOffset;
    const sGeo = new THREE.CylinderGeometry(0.002, 0.002, stringLength);
    const sMesh = new THREE.Mesh(sGeo, new THREE.MeshBasicMaterial({ color: 0xdddddd }));
    sMesh.position.y = -(stringLength / 2) - heartTipOffset; 
    
    bGroup.add(bMesh, sMesh); bGroup.position.set(x, y, z);
    bGroup.rotation.y = (Math.random() - 0.5) * 1.5; bGroup.rotation.z = (Math.random() - 0.5) * 0.15; 
    
    kinematicBalloons.push({ mesh: bGroup, baseY: y, phaseOffset: Math.random() * Math.PI * 2 });
    scene.add(bGroup);
}

createHeartBalloon(-2.5, 2.2, -2.5, 0xcc0000); 
createHeartBalloon(-1.8, 1.8, -3.5, 0xff6600); 
createHeartBalloon(2.5, 2.5, -2.8, 0x002080); 
createHeartBalloon(-2.0, 2.1, 1.5, 0xcc0000); 
createHeartBalloon(2.8, 2.4, 3.2, 0xff6600); 
createHeartBalloon(3.2, 1.9, 2.5, 0x002080); 

// ==========================================
// 8. MESA DA FESTA
// ==========================================
const partyTableGroup = new THREE.Group();
const candleLights = [];

const pTableTop = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 2.0), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 }));
pTableTop.position.y = 0.8; pTableTop.castShadow = true; pTableTop.receiveShadow = true;
partyTableGroup.add(pTableTop);

const legMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 });
const pLeg1 = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.8, 0.05), legMat); pLeg1.position.set(0, 0.4, -0.9); pLeg1.castShadow = true;
const pLeg2 = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.8, 0.05), legMat); pLeg2.position.set(0, 0.4, 0.9); pLeg2.castShadow = true;
partyTableGroup.add(pLeg1, pLeg2);

const cakeGroup = new THREE.Group();
const tier1 = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.2, 32), new THREE.MeshStandardMaterial({ color: 0xffa6c9, roughness: 0.8 }));
tier1.position.y = 0.1; tier1.castShadow = true;
const tier2 = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.15, 32), new THREE.MeshStandardMaterial({ color: 0xffd700, roughness: 0.4 }));
tier2.position.y = 0.275; tier2.castShadow = true;
cakeGroup.add(tier1, tier2);

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

    if (!isMobileDevice) {
        const candleLight = new THREE.PointLight(0xffc36b, 1.1, 1.2, 2);
        candleLight.position.y = 0.12;
        candleLights.push(candleLight);
        mesh.add(candleLight);
    }
    return mesh;
}

const candle2 = createNumberCandle('2');
candle2.position.set(0, 0.45, -0.08); 
candle2.rotation.y = -Math.PI / 2;
const candle0 = createNumberCandle('0');
candle0.position.set(0, 0.45, 0.08);  
candle0.rotation.y = -Math.PI / 2; 

cakeGroup.add(candle2, candle0);

const sparklerCount = 350;
const sGeo = new THREE.BufferGeometry();
const sPos = new Float32Array(sparklerCount * 3);
const sVel = [];
for(let i=0; i<sparklerCount; i++) {
    sPos[i*3]=0; sPos[i*3+1]=0; sPos[i*3+2]=0;
    sVel.push({ x:(Math.random()-0.5)*0.03, y:Math.random()*0.07+0.04, z:(Math.random()-0.5)*0.03 });
}
sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
const sparklerParticles = new THREE.Points(sGeo, new THREE.PointsMaterial({ color: 0xffffee, size: 0.015, transparent: true, blending: THREE.AdditiveBlending }));
sparklerParticles.position.set(0, 0.55, 0); sparklerParticles.visible = false;
cakeGroup.add(sparklerParticles);

const cakeLight = new THREE.PointLight(0xffaa44, 0, 5);
cakeLight.position.set(0, 0.6, 0); cakeGroup.add(cakeLight);

cakeGroup.position.set(0, 0.825, 0);
partyTableGroup.add(cakeGroup);

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
// 9. FPC CONTROLLER & MOUSE LOOK
// ==========================================
const player = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 0.8, 4, 16), new THREE.MeshBasicMaterial({ visible: false }));
player.position.set(0, 0.8, 1.5); 
scene.add(player);

const playerSpeed = 0.06; 
const interactionRadius = 2.2; 

const keys = { w: false, a: false, s: false, d: false, arrowup: false, arrowdown: false, arrowleft: false, arrowright: false };

window.addEventListener('keydown', (e) => { 
    const key = e.key.toLowerCase(); 
    // Evitar que o navegador (seja com extensões focadas, 'search-as-you-type' ou scroll nativo) "roube" as teclas de movimento
    if (activeModule === null && !isCinematicIntro && keys.hasOwnProperty(key)) {
        e.preventDefault();
    }
    if (keys.hasOwnProperty(key)) keys[key] = true; 
});
window.addEventListener('keyup', (e) => { 
    const key = e.key.toLowerCase(); 
    if(keys.hasOwnProperty(key)) keys[key] = false; 
});

const joyZone = document.getElementById('virtual-joystick'); const joyBase = document.getElementById('joy-base'); const joyStick = document.getElementById('joy-stick'); const mobileFullscreenToggle = document.getElementById('mobile-fullscreen-toggle');
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
    if (isCinematicIntro || e.target.closest('#virtual-joystick') || e.target.closest('#mobile-fullscreen-toggle') || e.target.closest('.isolated-module') || e.target.closest('.action-prompt') || e.target.closest('.tv-ctrl-btn') || e.target.closest('#lamp-switch') || e.target.closest('.floating-action-btn')) return;
    isDraggingCam = true; lastTouchX = e.clientX; lastTouchY = e.clientY;
});
window.addEventListener('pointermove', (e) => {
    if (!isDraggingCam || activeModule !== null || isCinematicIntro) return;
    const deltaX = e.clientX - lastTouchX; const deltaY = e.clientY - lastTouchY;
    lastTouchX = e.clientX; lastTouchY = e.clientY;
    yaw -= deltaX * lookSensitivity; pitch -= deltaY * lookSensitivity;
    pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, pitch));
});
window.addEventListener('pointerup', () => { isDraggingCam = false; }); window.addEventListener('pointerleave', () => { isDraggingCam = false; }); 

// ==========================================
// 10. GAME STATE, CINEMATICS & INTERACTION
// ==========================================
const roomDarkness = document.getElementById('room-darkness-overlay');
const lampSwitch = document.getElementById('lamp-switch');
const worldInteractionLayer = document.getElementById('world-interaction-layer');
const moduleBook = document.getElementById('subsystem-book');
const btnCloseBook = document.getElementById('close-book-module');
const moduleLetter = document.getElementById('subsystem-letter');
const btnCloseLetter = document.getElementById('close-letter-module');
const modulePaint = document.getElementById('subsystem-paint');
const btnClosePaint = document.getElementById('close-paint-module');
const tvPrompt = document.getElementById('tv-interaction-prompt');
const btnTvPlay = document.getElementById('btn-tv-play');
const btnTvMute = document.getElementById('btn-tv-mute');
const paintBrushSizeInput = document.getElementById('paint-brush-size');
const paintClearButton = document.getElementById('paint-clear');
const paintDownloadButton = document.getElementById('paint-download');
const paintColorButtons = document.querySelectorAll('.paint-color');
const giftSurpriseOverlay = document.getElementById('gift-surprise-overlay');
const giftPetalRain = document.getElementById('gift-petal-rain');
const actionBookButton = document.getElementById('action-book');
const actionLetterButton = document.getElementById('action-letter');
const actionRadioButton = document.getElementById('action-radio');
const actionGiftButton = document.getElementById('action-gift');
const actionPaintButton = document.getElementById('action-paint');
const actionCakeButton = document.getElementById('action-cake');
const actionTvButton = document.getElementById('action-tv');

function getFullscreenElement() { return document.fullscreenElement || document.webkitFullscreenElement || null; }
function updateFullscreenButton() {
    if (!mobileFullscreenToggle) return;
    const fullscreenSupported = Boolean(document.fullscreenEnabled || document.webkitFullscreenEnabled || document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);
    if (!isMobileDevice || !fullscreenSupported) { mobileFullscreenToggle.classList.add('is-hidden'); mobileFullscreenToggle.setAttribute('aria-hidden', 'true'); return; }
    mobileFullscreenToggle.classList.remove('is-hidden'); mobileFullscreenToggle.setAttribute('aria-hidden', 'false'); mobileFullscreenToggle.textContent = getFullscreenElement() ? 'Sair da Tela Cheia' : 'Tela Cheia';
}
async function toggleFullscreenMode(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const rootElement = document.documentElement;
    try {
        if (getFullscreenElement()) { if (document.exitFullscreen) await document.exitFullscreen(); else if (document.webkitExitFullscreen) document.webkitExitFullscreen(); return; }
        if (rootElement.requestFullscreen) await rootElement.requestFullscreen(); else if (rootElement.webkitRequestFullscreen) rootElement.webkitRequestFullscreen();
    } catch (error) { console.warn('Tela cheia indisponivel:', error); } finally { updateFullscreenButton(); }
}

let isRoomLit = false; let activeModule = null; let isCinematicIntro = false;
let isLampOn = false; let isCelebrating = false;
let isGiftOpened = false;
let selectedPaintColor = '#1f4fbf';
let selectedBrushSize = paintBrushSizeInput ? Number(paintBrushSizeInput.value) : 10;
let isPainting = false;

const introPath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 1.6, 3.5),       
    new THREE.Vector3(1.5, 1.6, 2.0),     
    new THREE.Vector3(-1.8, 1.6, 1.0),    
    new THREE.Vector3(1.0, 1.6, -0.5),    
    new THREE.Vector3(0, 1.6, 1.5)        
]);
introPath.curveType = 'centripetal';
const cinematicProxy = { t: 0 };
const cinematicLookTarget = new THREE.Vector3(0, 1.6, 0);

function executeCinematicIntro() {
    isCinematicIntro = true;
    updateFloatingInteractionButtons(); // Oculta todos os botões fisicamente antes de silenciar a atualização de DOM no loop

    if(joyZone) joyZone.style.opacity = '0';
    camera.position.copy(introPath.getPoint(0));
    
    const tl = gsap.timeline({
        onUpdate: () => {
            if (isCinematicIntro) {
                camera.position.copy(introPath.getPoint(cinematicProxy.t));
                camera.lookAt(cinematicLookTarget);
            }
        },
        onComplete: () => {
            isCinematicIntro = false;
            const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
            yaw = euler.y; pitch = euler.x;
            player.position.set(camera.position.x, 0.8, camera.position.z);
            if(joyZone) joyZone.style.opacity = '1';
            
            // Inicia o vídeo só após a cinemática para evitar travamentos de carregamento da textura de vídeo na GPU
            requestTvPlayback();
        }
    });

    tl.to(cinematicProxy, { t: 1.0, duration: 15, ease: "power2.inOut" }, 0);
    tl.to(cinematicLookTarget, { x: 3.95, y: 2.0, z: 0, duration: 3.5, ease: "power1.inOut" }, 0); 
    tl.to(cinematicLookTarget, { x: -3.5, y: 1.0, z: -0.5, duration: 4.0, ease: "power1.inOut" }, 3.5);
    tl.to(cinematicLookTarget, { x: 3.2, y: 0.8, z: 0, duration: 4.0, ease: "power1.inOut" }, 7.5);
    tl.to(cinematicLookTarget, { x: 0, y: 1.6, z: -10, duration: 3.5, ease: "power2.out" }, 11.5);
}

if (lampSwitch) {
    const triggerRoomLight = (e) => {
        if (e) { e.preventDefault(); e.stopPropagation(); } 
        
        // Retoma o contexto de áudio em caso de bloqueio do navegador
        if (audioListener && audioListener.context.state === 'suspended') {
            audioListener.context.resume();
        }

        if (isRoomLit) return;
        isRoomLit = true; 
        
        gsap.to(ambientLight, { intensity: 0.52, duration: 1.5 }); 
        gsap.to(pointLight, { intensity: 7, duration: 1.5 });
        if(roomDarkness) {
            roomDarkness.style.opacity = '0'; 
            setTimeout(() => { roomDarkness.classList.add('lit'); }, 1500);
            setTimeout(() => { roomDarkness.style.display = 'none'; }, 2600);
        }
        requestShadowUpdate();
        gsap.to(lampSwitch, { opacity: 0, duration: 0.5, onComplete: () => { 
            lampSwitch.style.display = 'none'; 
            setTimeout(executeCinematicIntro, 500);
        }});
    };
    lampSwitch.addEventListener('click', triggerRoomLight);
    lampSwitch.addEventListener('pointerdown', triggerRoomLight);
}

syncTvMuteLabel();

function triggerCelebration() {
    if(isCelebrating || isCinematicIntro) return;
    isCelebrating = true; activeModule = 'celebration';
    if(joyZone) joyZone.style.opacity = '0';

    const tl = gsap.timeline();
    tl.to(ambientLight, { intensity: 0.05, duration: 1.5 });
    tl.to(pointLight, { intensity: 0.1, duration: 1.5 }, 0);
    
    const framingPos = new THREE.Vector3(2.0, 1.4, 0);
    tl.to(camera.position, { x: framingPos.x, y: framingPos.y, z: framingPos.z, duration: 2, ease: "power2.inOut" }, 0);
    const targetEuler = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(framingPos, cakeGroup.getWorldPosition(new THREE.Vector3()), camera.up)), 'YXZ');
    tl.to(camera.rotation, { x: targetEuler.x, y: targetEuler.y, z: targetEuler.z, duration: 2, ease: "power2.inOut" }, 0);

    tl.add(() => {
        sparklerParticles.visible = true;
        gsap.to(cakeLight, { intensity: 10, duration: 1 });
        gsap.to(candle2.material, { emissiveIntensity: 5, duration: 1 });
        gsap.to(candle0.material, { emissiveIntensity: 5, duration: 1 });
    }, 1.5);

    tl.add(() => {
        gsap.to(ambientLight, { intensity: 0.52, duration: 2 });
        gsap.to(pointLight, { intensity: 7, duration: 2 });
        gsap.to(cakeLight, { intensity: 0, duration: 2 });
        gsap.to(camera.position, { x: player.position.x, y: 1.6, z: player.position.z, duration: 2, ease: "power2.inOut", onComplete: () => {
            isCelebrating = false; activeModule = null; sparklerParticles.visible = false;
            if(joyZone) joyZone.style.opacity = '1';
        }});
        gsap.to(camera.rotation, { x: pitch, y: yaw, z: 0, duration: 2, ease: "power2.inOut" });
    }, 10);
}

function triggerInteraction() {
    if(activeModule === 'book' || isCinematicIntro) return;
    activeModule = 'book'; isDraggingCam = false;
    if(joyZone) joyZone.style.opacity = '0';
    
    const targetPos = new THREE.Vector3(bookMesh.position.x + 1.2, 1.4, bookMesh.position.z);
    gsap.to(camera.position, { x: targetPos.x, y: targetPos.y, z: targetPos.z, duration: 1.5, ease: "power3.inOut" });
    
    const targetEuler = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(targetPos, bookMesh.position, camera.up)), 'YXZ');
    gsap.to(camera.rotation, {
        x: targetEuler.x, y: targetEuler.y, z: targetEuler.z, duration: 1.5, ease: "power3.inOut",
        onComplete: () => { moduleBook.classList.add('active'); initStarParticles(); yaw = camera.rotation.y; pitch = camera.rotation.x; }
    });
}
function triggerLetterModule() {
    if (activeModule === 'letter' || isCinematicIntro) return;
    activeModule = 'letter';
    isDraggingCam = false;
    if (joyZone) joyZone.style.opacity = '0';

    const letterFocus = letterGroup.getWorldPosition(new THREE.Vector3());
    const targetPos = new THREE.Vector3(letterFocus.x + 0.78, 1.18, letterFocus.z + 0.12);
    gsap.to(camera.position, { x: targetPos.x, y: targetPos.y, z: targetPos.z, duration: 1.15, ease: 'power3.inOut' });

    const targetEuler = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(targetPos, letterFocus, camera.up)), 'YXZ');
    gsap.to(camera.rotation, {
        x: targetEuler.x, y: targetEuler.y, z: targetEuler.z, duration: 1.15, ease: 'power3.inOut',
        onComplete: () => {
            if (moduleLetter) moduleLetter.classList.add('active');
            yaw = camera.rotation.y;
            pitch = camera.rotation.x;
        }
    });
}
function triggerPaintModule() {
    if (activeModule === 'paint' || isCinematicIntro) return;
    activeModule = 'paint';
    isDraggingCam = false;
    if(joyZone) joyZone.style.opacity = '0';

    const targetPos = new THREE.Vector3(easelGroup.position.x - 1.0, 1.45, easelGroup.position.z + 0.18);
    const easelFocus = paintSurface.getWorldPosition(new THREE.Vector3());
    gsap.to(camera.position, { x: targetPos.x, y: targetPos.y, z: targetPos.z, duration: 1.2, ease: 'power3.inOut' });
    const targetEuler = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(targetPos, easelFocus, camera.up)), 'YXZ');
    gsap.to(camera.rotation, {
        x: targetEuler.x, y: targetEuler.y, z: targetEuler.z, duration: 1.2, ease: 'power3.inOut',
        onComplete: () => { if (modulePaint) modulePaint.classList.add('active'); yaw = camera.rotation.y; pitch = camera.rotation.x; }
    });
}
function triggerGiftOpen() {
    if (isGiftOpened || isCinematicIntro) return;
    isGiftOpened = true;
    gsap.to(specialGiftLidPivot.rotation, { x: -2.15, z: -0.18, duration: 1.1, ease: 'power3.out' });
    gsap.to(specialGiftLidPivot.position, { x: -0.2, y: 0.46, z: -0.22, duration: 1.1, ease: 'power3.out' });
    triggerGiftSurprise();
}

[
    [actionBookButton, triggerInteraction],
    [actionLetterButton, triggerLetterModule],
    [actionRadioButton, toggleRadioPlayback],
    [actionGiftButton, triggerGiftOpen],
    [actionPaintButton, triggerPaintModule],
    [actionCakeButton, triggerCelebration],
    [actionTvButton, () => {
        if (!tvPrompt) return;
        tvPrompt.classList.toggle('visible');
    }]
].forEach(([button, handler]) => {
    if (!button) return;
    button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        handler();
    });
    button.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
    });
});

const projectedAnchor = new THREE.Vector3();
function updateFloatingAction(button, object3D, offsetY = 0.6) {
    if (!button || !object3D || !isRoomLit || activeModule !== null || isCinematicIntro) {
        if (button) button.classList.remove('visible');
        return;
    }

    object3D.getWorldPosition(projectedAnchor);
    projectedAnchor.y += offsetY;
    projectedAnchor.project(camera);

    const isBehindCamera = projectedAnchor.z < -1 || projectedAnchor.z > 1;
    const screenX = (projectedAnchor.x * 0.5 + 0.5) * window.innerWidth;
    const screenY = (-projectedAnchor.y * 0.5 + 0.5) * window.innerHeight;
    const outsideViewport = screenX < 30 || screenX > window.innerWidth - 30 || screenY < 40 || screenY > window.innerHeight - 30;

    if (isBehindCamera || outsideViewport) {
        button.classList.remove('visible');
        return;
    }

    button.style.setProperty('--tx', `${screenX}px`);
    button.style.setProperty('--ty', `${screenY}px`);
    button.classList.add('visible');
}

function updateFloatingInteractionButtons() {
    if (worldInteractionLayer) {
        worldInteractionLayer.setAttribute('aria-hidden', (!isRoomLit || activeModule !== null || isCinematicIntro).toString());
    }
    updateFloatingAction(actionBookButton, bookMesh, 0.45);
    updateFloatingAction(actionLetterButton, letterGroup, 0.32);
    updateFloatingAction(actionRadioButton, radioGroup, 0.45);
    updateFloatingAction(actionGiftButton, specialGiftGroup, 0.55);
    updateFloatingAction(actionPaintButton, easelGroup, 1.55);
    updateFloatingAction(actionCakeButton, cakeGroup, 0.95);
    updateFloatingAction(actionTvButton, tvGroup, 2.45);

    if (!tvPrompt || !isRoomLit || activeModule !== null || isCinematicIntro || !tvPrompt.classList.contains('visible')) {
        if (tvPrompt) tvPrompt.classList.remove('visible');
        return;
    }

    tvGroup.getWorldPosition(projectedAnchor);
    projectedAnchor.y += 1.8;
    projectedAnchor.project(camera);
    const screenX = (projectedAnchor.x * 0.5 + 0.5) * window.innerWidth;
    const screenY = (-projectedAnchor.y * 0.5 + 0.5) * window.innerHeight;
    tvPrompt.style.setProperty('--tx', `${screenX}px`);
    tvPrompt.style.setProperty('--ty', `${Math.max(72, screenY)}px`);
}

function triggerGiftSurprise() {
    if (!giftSurpriseOverlay || !giftPetalRain) return;
    giftSurpriseOverlay.classList.remove('active');
    giftPetalRain.innerHTML = '';
    void giftSurpriseOverlay.offsetWidth;
    giftSurpriseOverlay.classList.add('active');

    const petalColors = ['#f3aac1', '#ffd0de', '#f5c1cf', '#ffe7ef', '#eaa0bc'];
    for (let index = 0; index < 26; index += 1) {
        const petal = document.createElement('span');
        petal.className = 'gift-petal';
        petal.style.left = `${Math.random() * 100}%`;
        petal.style.background = petalColors[index % petalColors.length];
        petal.style.animationDelay = `${Math.random() * 0.8}s`;
        petal.style.setProperty('--petal-drift', `${(Math.random() - 0.5) * 180}px`);
        petal.style.setProperty('--petal-duration', `${3.8 + Math.random() * 1.8}s`);
        giftPetalRain.appendChild(petal);
    }

    window.clearTimeout(triggerGiftSurprise.timeoutId);
    triggerGiftSurprise.timeoutId = window.setTimeout(() => {
        giftSurpriseOverlay.classList.remove('active');
        giftPetalRain.innerHTML = '';
    }, 4200);
}

if(btnCloseBook) {
    btnCloseBook.addEventListener('click', () => {
        moduleBook.classList.remove('active');
        gsap.to(camera.position, { x: player.position.x, y: 1.6, z: player.position.z, duration: 1.5, ease: "power3.inOut", onComplete: () => { activeModule = null; if(joyZone) joyZone.style.opacity = '1'; } });
    });
}

if (btnCloseLetter) {
    btnCloseLetter.addEventListener('click', () => {
        if (moduleLetter) moduleLetter.classList.remove('active');
        gsap.to(camera.position, { x: player.position.x, y: 1.6, z: player.position.z, duration: 1.15, ease: 'power3.inOut', onComplete: () => { activeModule = null; if(joyZone) joyZone.style.opacity = '1'; } });
    });
}

if (btnClosePaint) {
    btnClosePaint.addEventListener('click', () => {
        if (modulePaint) modulePaint.classList.remove('active');
        if (paintCanvasTexture) paintCanvasTexture.needsUpdate = true;
        gsap.to(camera.position, { x: player.position.x, y: 1.6, z: player.position.z, duration: 1.3, ease: 'power3.inOut', onComplete: () => { activeModule = null; if(joyZone) joyZone.style.opacity = '1'; } });
    });
}

if (paintBrushSizeInput) {
    updateFloatingAction(actionLetterButton, letterGroup, 0.32);
    paintBrushSizeInput.addEventListener('input', () => {
        selectedBrushSize = Number(paintBrushSizeInput.value);
    });
}

paintColorButtons.forEach((button) => {
    button.addEventListener('click', () => {
        selectedPaintColor = button.dataset.color || selectedPaintColor;
        paintColorButtons.forEach((item) => item.classList.remove('is-active'));
        button.classList.add('is-active');
    });
});

if (paintClearButton && paintCanvasElement && paintContext) {
    paintClearButton.addEventListener('click', () => {
        paintContext.fillStyle = '#fffdf8';
        paintContext.fillRect(0, 0, paintCanvasElement.width, paintCanvasElement.height);
        if (paintCanvasTexture) paintCanvasTexture.needsUpdate = true;
    });
}

if (paintDownloadButton && paintCanvasElement) {
    paintDownloadButton.addEventListener('click', () => {
        const downloadLink = document.createElement('a');
        downloadLink.href = paintCanvasElement.toDataURL('image/png');
        downloadLink.download = 'arte-yasmin.png';
        downloadLink.click();
    });
}

function getPaintCanvasPosition(event) {
    if (!paintCanvasElement) return { x: 0, y: 0 };
    const rect = paintCanvasElement.getBoundingClientRect();
    return {
        x: (event.clientX - rect.left) * (paintCanvasElement.width / rect.width),
        y: (event.clientY - rect.top) * (paintCanvasElement.height / rect.height)
    };
}

function startPainting(event) {
    if (!paintCanvasElement || !paintContext) return;
    isPainting = true;
    const { x, y } = getPaintCanvasPosition(event);
    paintContext.beginPath();
    paintContext.moveTo(x, y);
    event.preventDefault();
}

function continuePainting(event) {
    if (!isPainting || !paintCanvasElement || !paintContext) return;
    const { x, y } = getPaintCanvasPosition(event);
    paintContext.lineCap = 'round';
    paintContext.lineJoin = 'round';
    paintContext.strokeStyle = selectedPaintColor;
    paintContext.lineWidth = selectedBrushSize;
    paintContext.lineTo(x, y);
    paintContext.stroke();
    if (paintCanvasTexture) paintCanvasTexture.needsUpdate = true;
    event.preventDefault();
}

function stopPainting() {
    if (!paintContext) return;
    isPainting = false;
    paintContext.closePath();
}

if (paintCanvasElement) {
    paintCanvasElement.addEventListener('pointerdown', startPainting);
    paintCanvasElement.addEventListener('pointermove', continuePainting);
    paintCanvasElement.addEventListener('pointerup', stopPainting);
    paintCanvasElement.addEventListener('pointerleave', stopPainting);
}

if(btnTvPlay && videoElement) btnTvPlay.addEventListener('click', () => { if (videoElement.paused) requestTvPlayback(); else videoElement.pause(); });
if(btnTvMute && videoElement) btnTvMute.addEventListener('click', () => { videoElement.muted = !videoElement.muted; syncTvMuteLabel(); });
if (mobileFullscreenToggle) mobileFullscreenToggle.addEventListener('click', toggleFullscreenMode);

document.addEventListener('fullscreenchange', updateFullscreenButton);
document.addEventListener('webkitfullscreenchange', updateFullscreenButton);
updateFullscreenButton();

const lastCameraPosition = new THREE.Vector3();
const lastCameraQuaternion = new THREE.Quaternion();
let lastUiSignature = '';
let floatingButtonsNeedUpdate = true;

window.addEventListener('keydown', (e) => { 
    const k = e.key.toLowerCase();
    if (isRoomLit && activeModule === null && !isCinematicIntro) {
        if(k === 'c') triggerCelebration(); 
        if(k === 'l') {
            isLampOn = !isLampOn;
            gsap.to(lampLight, { intensity: isLampOn ? 5.6 : 0, duration: 0.3 });
            gsap.to(lampShadeMat, { emissiveIntensity: isLampOn ? 1.15 : 0, duration: 0.3 });
            floatingButtonsNeedUpdate = true;
            requestShadowUpdate();
        }
    }
    if (isRoomLit && activeModule === null && videoElement) {
        if (k === 'p') { if (videoElement.paused) requestTvPlayback(); else videoElement.pause(); }
        if (k === 'm') { videoElement.muted = !videoElement.muted; syncTvMuteLabel(); }
    }
    if (isRoomLit && activeModule === null && k === 'r') {
        toggleRadioPlayback();
    }
});

// ==========================================
// 11. MAIN RENDER LOOP 
// ==========================================
const clock = new THREE.Clock();
const moveDirection = new THREE.Vector3(); const forward = new THREE.Vector3(); const right = new THREE.Vector3();
const previousPlayerPosition = new THREE.Vector3();

function refreshFloatingButtonsIfNeeded() {
    // Evita recalcular interações DOM se não for necessário ou se estivermos na cinemática/apresentação (menos esforço de CPU/60fps garantido)
    if (isCinematicIntro) return;

    const uiSignature = `${isRoomLit}-${activeModule ?? 'none'}-${tvPrompt?.classList.contains('visible') ? 'tv-open' : 'tv-closed'}`;
    const cameraMoved = lastCameraPosition.distanceToSquared(camera.position) > 0.000001 || 1 - Math.abs(lastCameraQuaternion.dot(camera.quaternion)) > 0.000001;
    if (!floatingButtonsNeedUpdate && !cameraMoved && uiSignature === lastUiSignature) return;

    updateFloatingInteractionButtons();
    lastCameraPosition.copy(camera.position);
    lastCameraQuaternion.copy(camera.quaternion);
    lastUiSignature = uiSignature;
    floatingButtonsNeedUpdate = false;
}

function animate() {
    requestAnimationFrame(animate);
    const time = clock.getElapsedTime();
    if (!isMobileDevice) { candleLights.forEach((light, index) => { light.intensity = 0.95 + Math.sin(time * 8 + index * 1.4) * 0.2; }); }
    
    bookMesh.position.y = 0.75 + Math.sin(time * 3) * 0.05;

    kinematicBalloons.forEach((bData) => { bData.mesh.position.y = bData.baseY + Math.sin(time * 2 + bData.phaseOffset) * 0.05; });

    if(isCelebrating && sparklerParticles.visible) {
        const positions = sparklerParticles.geometry.attributes.position.array;
        for(let i=0; i<sparklerCount; i++) {
            sVel[i].y -= 0.003; 
            positions[i*3] += sVel[i].x; positions[i*3+1] += sVel[i].y; positions[i*3+2] += sVel[i].z;
            if(positions[i*3+1] < -0.2) { positions[i*3] = 0; positions[i*3+1] = 0; positions[i*3+2] = 0; sVel[i].y = Math.random()*0.07+0.04; }
        }
        sparklerParticles.geometry.attributes.position.needsUpdate = true;
        cakeLight.intensity = 10 + Math.sin(time * 40) * 2; 
    }

    if (isRoomLit && activeModule === null && !isCinematicIntro) {
        let moveForward = 0; let moveRight = 0;
        if(keys.w || keys.arrowup) moveForward += 1; 
        if(keys.s || keys.arrowdown) moveForward -= 1; 
        if(keys.a || keys.arrowleft) moveRight -= 1; 
        if(keys.d || keys.arrowright) moveRight += 1;
        if(joyActive) { moveRight += joyVector.x; moveForward -= joyVector.y; }

        previousPlayerPosition.copy(player.position);

        if (moveForward !== 0 || moveRight !== 0) {
            moveDirection.set(moveRight, 0, moveForward).normalize().multiplyScalar(playerSpeed);
            camera.getWorldDirection(forward); forward.y = 0; forward.normalize(); right.crossVectors(forward, camera.up).normalize(); 
            player.position.addScaledVector(right, moveDirection.x); player.position.addScaledVector(forward, moveDirection.z);
            floatingButtonsNeedUpdate = true;
        }

        player.position.x = Math.max(-3.0, Math.min(3.0, player.position.x)); player.position.z = Math.max(-3.0, Math.min(3.5, player.position.z));
        if (player.position.z > 1.6 && player.position.x > -0.8 && player.position.x < 0.8) { player.position.z = 1.6; }

        const wardrobeMinX = wardrobeGroup.position.x - (wWidth / 2) - 0.18;
        const wardrobeMaxX = wardrobeGroup.position.x + (wWidth / 2) + 0.18;
        const wardrobeMinZ = wardrobeGroup.position.z - (wDepth / 2) - 0.12;
        const wardrobeMaxZ = wardrobeGroup.position.z + (wDepth / 2) + 0.12;
        const insideWardrobe = player.position.x >= wardrobeMinX && player.position.x <= wardrobeMaxX && player.position.z >= wardrobeMinZ && player.position.z <= wardrobeMaxZ;
        if (insideWardrobe) {
            player.position.copy(previousPlayerPosition);
        }

        const tMinX = 2.2; const tMaxZ = 1.4; const tMinZ = -1.4; 
        if (player.position.x > tMinX && player.position.z > tMinZ && player.position.z < tMaxZ) {
            const dFront = player.position.x - tMinX; const dLeft = player.position.z - tMinZ; const dRight = tMaxZ - player.position.z;
            const minD = Math.min(dFront, dLeft, dRight);
            if (minD === dFront) player.position.x = tMinX; else if (minD === dLeft) player.position.z = tMinZ; else player.position.z = tMaxZ;
        }
        
        camera.position.set(player.position.x, 1.6, player.position.z); 
        camera.rotation.set(pitch, yaw, 0, 'YXZ');
    }

    refreshFloatingButtonsIfNeeded();
    renderer.render(scene, camera);
}
renderer.compile(scene, camera);
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    const dynamicMaxRatio = isMobileDevice ? 1 : (window.innerWidth > 1600 ? 1 : 1.25);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, dynamicMaxRatio));
    requestShadowUpdate();
});

// ==========================================
// 12. ISOLATED BOOK LOGIC
// ==========================================
const coverWrapper = document.querySelector('.book-cover-wrapper'); const pages = document.querySelectorAll('.page'); const starCanvas = document.getElementById('star-particles'); const photoCh1 = document.getElementById('ch1-photo'); const immersionLayer = document.getElementById('immersion-layer'); const closeImmersionBtn = document.getElementById('close-immersion'); const galaxyMap = document.getElementById('galaxy-map'); const staticStarsLayer = document.getElementById('static-stars-layer'); const interactiveStars = document.querySelectorAll('.interactive-star'); const hudOverlay = document.getElementById('hud-message-overlay'); const hudText = document.getElementById('hud-text'); const quizPages = document.querySelectorAll('.quiz-layout');
let currentPage = 0; const totalPages = pages.length; let isAnimatingBook = false; 

if(moduleBook) {
    moduleBook.addEventListener('click', (event) => {
        if (isAnimatingBook || activeModule !== 'book') return; 
        if (event.target.closest('#immersion-layer') || event.target.closest('.interactive-frame') || event.target.closest('.module-close-btn') || event.target.closest('.quiz-option')) return;
        const clickX = event.clientX; const screenW = window.innerWidth; const clickedLeftBook = event.target.closest('.book-cover-wrapper');
        if (currentPage === 0) { if (clickedLeftBook) goToPage(1); } else { if (clickedLeftBook) { goToPage(currentPage - 1); } else if (clickX > screenW / 2) { goToPage(currentPage + 1); } }
    });
}
quizPages.forEach((quizPage) => {
    const correctAnswer = quizPage.dataset.answer;
    const feedback = quizPage.querySelector('.quiz-feedback');
    const options = quizPage.querySelectorAll('.quiz-option');

    options.forEach((option) => {
        option.addEventListener('click', (event) => {
            event.stopPropagation();

            const selectedChoice = option.dataset.choice;
            const isCorrect = selectedChoice === correctAnswer;

            options.forEach((item) => {
                item.classList.remove('is-selected', 'is-correct', 'is-wrong');
            });

            option.classList.add('is-selected');
            option.classList.add(isCorrect ? 'is-correct' : 'is-wrong');

            if (feedback) {
                feedback.classList.remove('is-correct', 'is-wrong');
                feedback.classList.add(isCorrect ? 'is-correct' : 'is-wrong');
                feedback.textContent = isCorrect ? 'Acertou.' : `Errou. A correta é ${correctAnswer}.`;
            }
        });
    });
});
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
function generateGalaxyBackground() { const mapWidth = window.innerWidth * 3; const mapHeight = window.innerHeight * 3; const shadows = []; for(let i = 0; i < 600; i++) { const x = Math.floor(Math.random() * mapWidth); const y = Math.floor(Math.random() * mapHeight); const size = Math.random() < 0.85 ? 1 : 2; const alpha = (Math.random() * 0.5 + 0.1).toFixed(2); shadows.push(`${x}px ${y}px 0 ${size}px rgba(255,255,255,${alpha})`); } if(staticStarsLayer) { staticStarsLayer.style.boxShadow = shadows.join(', '); staticStarsLayer.style.width = '1px'; staticStarsLayer.style.height = '1px'; } }
if (photoCh1) { photoCh1.addEventListener('click', (event) => { event.stopPropagation(); generateGalaxyBackground(); immersionLayer.classList.add('active'); let currentTransX = 0, currentTransY = 0; galaxyMap.style.transform = `translate3d(0px, 0px, 0)`; }); }
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