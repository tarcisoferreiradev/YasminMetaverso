/**
 * @file script.js
 * @description Kinematic FPS Engine. 
 * Implementação de Matriz Euleriana (Drag-to-Look 360) e PBR Shading High-Key (Branco/Rosa).
 */

import * as THREE from 'three';
import gsap from 'gsap';

// ==========================================
// 1. ENGINE CORE: RENDERER & SCENE
// ==========================================
const canvas = document.getElementById('webgl-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xfff5f7); // Branco neve com subtom rosa
scene.fog = new THREE.FogExp2(0xfff5f7, 0.025);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.rotation.order = 'YXZ'; 

// ==========================================
// 2. HIGH-KEY ILLUMINATION
// ==========================================
const ambientLight = new THREE.AmbientLight(0xffffff, 0); 
scene.add(ambientLight);

// HemisphereLight para preenchimento suave de rebatimento branco/rosa
const hemiLight = new THREE.HemisphereLight(0xffffff, 0xffe4e1, 0); 
scene.add(hemiLight);

const pointLight = new THREE.PointLight(0xfff0f5, 0, 25); 
pointLight.position.set(0, 5.5, 0); 
pointLight.castShadow = true;
// Suavização do Shadow Map para ambientes claros
pointLight.shadow.bias = -0.001; 
scene.add(pointLight);

// ==========================================
// 3. ARCHITECTURE (Paredes, Teto e Chão)
// ==========================================
const roomWidth = 22;
const roomDepth = 18;
const roomHeight = 6;

// Chão Principal (Mármore Sintético Claro)
const floorGeo = new THREE.PlaneGeometry(roomWidth, roomDepth);
const floorMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1, metalness: 0.1 });
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// Grid de piso Rosa Gold suave para referência de profundidade
const gridHelper = new THREE.GridHelper(Math.max(roomWidth, roomDepth), 25, 0xffd1d9, 0xffe4e1);
gridHelper.position.y = 0.01; 
scene.add(gridHelper);

// Teto Branco
const ceilingGeo = new THREE.PlaneGeometry(roomWidth, roomDepth);
const ceilingMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1.0 });
const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat);
ceiling.rotation.x = Math.PI / 2;
ceiling.position.y = roomHeight;
scene.add(ceiling);

// Paredes (Branco e Rosa Pastel)
const wallsGroup = new THREE.Group();
const wallMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }); 
const accentWallMat = new THREE.MeshStandardMaterial({ color: 0xffe4e1, roughness: 0.9 }); // Parede de Destaque Rosa

const wallFront = new THREE.Mesh(new THREE.PlaneGeometry(roomWidth, roomHeight), accentWallMat);
wallFront.position.set(0, roomHeight/2, -roomDepth/2);
wallFront.receiveShadow = true;
wallsGroup.add(wallFront);

const wallBack = new THREE.Mesh(new THREE.PlaneGeometry(roomWidth, roomHeight), wallMat);
wallBack.rotation.y = Math.PI;
wallBack.position.set(0, roomHeight/2, roomDepth/2);
wallBack.receiveShadow = true;
wallsGroup.add(wallBack);

const wallLeft = new THREE.Mesh(new THREE.PlaneGeometry(roomDepth, roomHeight), wallMat);
wallLeft.rotation.y = Math.PI / 2;
wallLeft.position.set(-roomWidth/2, roomHeight/2, 0);
wallLeft.receiveShadow = true;
wallsGroup.add(wallLeft);

const wallRight = new THREE.Mesh(new THREE.PlaneGeometry(roomDepth, roomHeight), wallMat);
wallRight.rotation.y = -Math.PI / 2;
wallRight.position.set(roomWidth/2, roomHeight/2, 0);
wallRight.receiveShadow = true;
wallsGroup.add(wallRight);

// Rodapés Rose Gold
const baseboardMat = new THREE.MeshStandardMaterial({ color: 0xdfaba0, roughness: 0.4, metalness: 0.3 });
const bbFront = new THREE.Mesh(new THREE.BoxGeometry(roomWidth, 0.2, 0.1), baseboardMat);
bbFront.position.set(0, 0.1, -roomDepth/2 + 0.05);
wallsGroup.add(bbFront);
const bbBack = new THREE.Mesh(new THREE.BoxGeometry(roomWidth, 0.2, 0.1), baseboardMat);
bbBack.position.set(0, 0.1, roomDepth/2 - 0.05);
wallsGroup.add(bbBack);
const bbLeft = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, roomDepth), baseboardMat);
bbLeft.position.set(-roomWidth/2 + 0.05, 0.1, 0);
wallsGroup.add(bbLeft);
const bbRight = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, roomDepth), baseboardMat);
bbRight.position.set(roomWidth/2 - 0.05, 0.1, 0);
wallsGroup.add(bbRight);

scene.add(wallsGroup);

// ==========================================
// 4. LEVEL DESIGN (Procedural Props - High Key)
// ==========================================

// Mesa Central Branca com pés Rose Gold
const tableGeo = new THREE.CylinderGeometry(1.5, 1.5, 0.1, 32);
const tableMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
const tableTop = new THREE.Mesh(tableGeo, tableMat);
tableTop.position.set(0, 0.8, 0);
tableTop.castShadow = true; tableTop.receiveShadow = true;

const legGeo = new THREE.CylinderGeometry(0.8, 0.8, 0.8, 32);
const legMat = new THREE.MeshStandardMaterial({ color: 0xdfaba0, metalness: 0.6, roughness: 0.2 });
const tableLeg = new THREE.Mesh(legGeo, legMat);
tableLeg.position.set(0, 0.4, 0);
tableLeg.castShadow = true; tableLeg.receiveShadow = true;

const table = new THREE.Group();
table.add(tableTop);
table.add(tableLeg);
scene.add(table);

// Objeto Interativo: O Livro
const bookGeo = new THREE.BoxGeometry(0.8, 0.15, 1.1);
const bookMat = new THREE.MeshStandardMaterial({ color: 0xc5a059, emissive: 0x4a3219, emissiveIntensity: 0.5 });
const bookMesh = new THREE.Mesh(bookGeo, bookMat);
bookMesh.position.set(0, 0.9, 0);
bookMesh.rotation.y = Math.PI / 8;
bookMesh.castShadow = true;
scene.add(bookMesh);

// A Cama (Estrutura Branca, Roupa de Cama Rosa)
const bedGroup = new THREE.Group();
const bedFrame = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.4, 5.5), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }));
bedFrame.position.y = 0.2; bedFrame.castShadow = true; bedFrame.receiveShadow = true;
bedGroup.add(bedFrame);

const mattress = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.3, 5.2), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1.0 }));
mattress.position.y = 0.55; mattress.castShadow = true; mattress.receiveShadow = true;
bedGroup.add(mattress);

const blanket = new THREE.Mesh(new THREE.BoxGeometry(3.25, 0.35, 3.5), new THREE.MeshStandardMaterial({ color: 0xffb6c1, roughness: 0.9 })); // Rosa Claro
blanket.position.set(0, 0.56, 0.8); blanket.castShadow = true; blanket.receiveShadow = true;
bedGroup.add(blanket);

const pillow = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.15, 1.2), new THREE.MeshStandardMaterial({ color: 0xffe4e1, roughness: 0.8 }));
pillow.position.set(0, 0.775, -1.8); pillow.castShadow = true;
bedGroup.add(pillow);

bedGroup.position.set(-8, 0, -2);
scene.add(bedGroup);

// O Sofá (Rosa com estofado branco)
const sofaGroup = new THREE.Group();
const sofaMat = new THREE.MeshStandardMaterial({ color: 0xffb6c1, roughness: 0.9 });
const cushionMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });

const sofaBase = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.4, 1.4), sofaMat);
sofaBase.position.y = 0.2; sofaBase.castShadow = true; sofaBase.receiveShadow = true;
sofaGroup.add(sofaBase);

const sofaCushion = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.2, 1.2), cushionMat);
sofaCushion.position.set(0, 0.5, 0); sofaCushion.castShadow = true; sofaCushion.receiveShadow = true;
sofaGroup.add(sofaCushion);

const sofaBack = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.8, 0.3), sofaMat);
sofaBack.position.set(0, 0.6, -0.55); sofaBack.castShadow = true;
sofaGroup.add(sofaBack);

const sofaArmL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.6, 1.4), sofaMat);
sofaArmL.position.set(-1.6, 0.5, 0); sofaArmL.castShadow = true;
sofaGroup.add(sofaArmL);

const sofaArmR = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.6, 1.4), sofaMat);
sofaArmR.position.set(1.6, 0.5, 0); sofaArmR.castShadow = true;
sofaGroup.add(sofaArmR);

sofaGroup.position.set(7, 0, 2);
sofaGroup.rotation.y = -Math.PI / 3; 
scene.add(sofaGroup);

// Mesa da TV (Branca com gavetas Rose Gold simuladas)
const tvGroup = new THREE.Group();
const deskMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
const desk = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.6, 1), deskMat);
desk.position.y = 0.3; desk.castShadow = true; desk.receiveShadow = true;
tvGroup.add(desk);

const tvStand = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.3, 0.2, 16), baseboardMat);
tvStand.position.set(0, 0.7, 0);
tvGroup.add(tvStand);

const tvScreen = new THREE.Mesh(
    new THREE.BoxGeometry(2.8, 1.6, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x050515, roughness: 0.1, metalness: 0.8 })
);
tvScreen.position.set(0, 1.6, 0); tvScreen.castShadow = true;
tvGroup.add(tvScreen);

const tvLight = new THREE.PointLight(0x2244ff, 0, 6); 
tvLight.position.set(0, 1.6, 0.5);
tvGroup.add(tvLight);

tvGroup.position.set(0, 0, -8);
scene.add(tvGroup);

// ==========================================
// 5. FPC CONTROLLER (Avatar & Free Look 360)
// ==========================================
const playerGeo = new THREE.CapsuleGeometry(0.4, 0.8, 4, 16);
const playerMat = new THREE.MeshBasicMaterial({ visible: false }); 
const player = new THREE.Mesh(playerGeo, playerMat);
player.position.set(0, 0.8, 7); 
scene.add(player);

const playerSpeed = 0.12;
const interactionRadius = 3.5; 

// 5.1 Keyboard State
const keys = { w: false, a: false, s: false, d: false };
window.addEventListener('keydown', (e) => { const key = e.key.toLowerCase(); if(keys.hasOwnProperty(key)) keys[key] = true; });
window.addEventListener('keyup', (e) => { const key = e.key.toLowerCase(); if(keys.hasOwnProperty(key)) keys[key] = false; });

// 5.2 Virtual Joystick
const joyZone = document.getElementById('virtual-joystick');
const joyBase = document.getElementById('joy-base');
const joyStick = document.getElementById('joy-stick');
let joyActive = false; const joyVector = new THREE.Vector2(0, 0); 

if (joyZone) {
    joyZone.addEventListener('pointerdown', (e) => { e.stopPropagation(); joyActive = true; joyBase.classList.add('active'); updateJoyVector(e); });
    joyZone.addEventListener('pointermove', (e) => { if (!joyActive) return; e.stopPropagation(); updateJoyVector(e); });
    window.addEventListener('pointerup', () => { if (!joyActive) return; joyActive = false; joyVector.set(0, 0); joyBase.classList.remove('active'); joyStick.style.transform = `translate(0px, 0px)`; });
}

function updateJoyVector(e) {
    const rect = joyBase.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2; const centerY = rect.top + rect.height / 2;
    let dx = e.clientX - centerX; let dy = e.clientY - centerY;
    const maxRadius = rect.width / 2; const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > maxRadius) { dx = (dx / dist) * maxRadius; dy = (dy / dist) * maxRadius; }
    joyStick.style.transform = `translate(${dx}px, ${dy}px)`;
    joyVector.x = dx / maxRadius; joyVector.y = dy / maxRadius;
}

// 5.3 Euler Accumulator Engine (Drag-to-Look 360)
let isDraggingCam = false;
let yaw = 0;
let pitch = 0;
let lastTouchX = 0;
let lastTouchY = 0;
const lookSensitivity = 0.003;

window.addEventListener('pointerdown', (e) => {
    // Ignora inputs que acertem UI (botões, joystick)
    if (e.target.closest('#virtual-joystick') || e.target.closest('.isolated-module') || e.target.closest('#interaction-prompt')) return;
    isDraggingCam = true;
    lastTouchX = e.clientX;
    lastTouchY = e.clientY;
});

window.addEventListener('pointermove', (e) => {
    if (!isDraggingCam || activeModule !== null) return;
    
    const deltaX = e.clientX - lastTouchX;
    const deltaY = e.clientY - lastTouchY;
    
    lastTouchX = e.clientX;
    lastTouchY = e.clientY;
    
    yaw -= deltaX * lookSensitivity;
    pitch -= deltaY * lookSensitivity;
    
    // Clamp strictly no Eixo Pitch para prevenir inversão (Gimbal Lock)
    pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, pitch));
});

window.addEventListener('pointerup', () => { isDraggingCam = false; });
// Cancelamento de tracking ao sair do Canvas
window.addEventListener('pointerleave', () => { isDraggingCam = false; }); 


// ==========================================
// 6. GAME STATE & INTERACTION
// ==========================================
const roomDarkness = document.getElementById('room-darkness-overlay');
const lampSwitch = document.getElementById('lamp-switch');
const interactionPrompt = document.getElementById('interaction-prompt');
const moduleBook = document.getElementById('subsystem-book');
const btnCloseBook = document.getElementById('close-book-module');
const cursorReticle = document.getElementById('cursor-reticle');

let isRoomLit = false;
let activeModule = null; 
let isNearBook = false;

lampSwitch.addEventListener('click', () => {
    if (isRoomLit) return;
    // Transição Suave via GSAP para Light Setup High-Key
    gsap.to(ambientLight, { intensity: 0.8, duration: 1.5 });
    gsap.to(hemiLight, { intensity: 0.6, duration: 1.5 });
    gsap.to(pointLight, { intensity: 10, duration: 1.5 });
    gsap.to(tvLight, { intensity: 0.4, duration: 1.5 });
    
    roomDarkness.style.backgroundColor = 'rgba(255, 245, 247, 0.2)'; // Feedback termico rosa
    lampSwitch.blur(); 

    setTimeout(() => {
        roomDarkness.classList.add('lit');
        isRoomLit = true;
    }, 400);
});

function triggerInteraction() {
    if(!isNearBook || activeModule === 'book') return;
    activeModule = 'book'; 
    isDraggingCam = false; // Interrompe câmera
    interactionPrompt.classList.remove('visible'); 
    cursorReticle.classList.remove('active');
    
    if(joyZone) joyZone.style.opacity = '0';
    
    gsap.to(camera.position, {
        x: bookMesh.position.x,
        y: bookMesh.position.y + 0.35, 
        z: bookMesh.position.z + 0.65,
        duration: 1.5,
        ease: "power3.inOut"
    });
    
    // LookAt forçado cinemático interpolando os Euler Angles
    const targetEuler = new THREE.Euler().setFromQuaternion(
        new THREE.Quaternion().setFromRotationMatrix(
            new THREE.Matrix4().lookAt(camera.position, bookMesh.position, camera.up)
        ), 'YXZ'
    );

    gsap.to(camera.rotation, {
        x: targetEuler.x,
        y: targetEuler.y,
        z: targetEuler.z,
        duration: 1.5,
        ease: "power3.inOut",
        onComplete: () => {
            moduleBook.classList.add('active');
            initStarParticles();
            // Resync do Euler state pós-cinemática para não pular quadro ao fechar
            yaw = camera.rotation.y;
            pitch = camera.rotation.x;
        }
    });
}

window.addEventListener('keydown', (e) => { if(e.key.toLowerCase() === 'e') triggerInteraction(); });
interactionPrompt.addEventListener('click', triggerInteraction);

btnCloseBook.addEventListener('click', () => {
    moduleBook.classList.remove('active');
    
    gsap.to(camera.position, {
        x: player.position.x,
        y: 1.6, 
        z: player.position.z,
        duration: 1.5,
        ease: "power3.inOut",
        onComplete: () => {
            activeModule = null; 
            if(joyZone) joyZone.style.opacity = '1'; 
        }
    });
});

// ==========================================
// 7. MAIN RENDER LOOP (Kinematic FPS Matrix)
// ==========================================
const clock = new THREE.Clock();
const moveDirection = new THREE.Vector3();
const forward = new THREE.Vector3();
const right = new THREE.Vector3();

function animate() {
    requestAnimationFrame(animate);
    const time = clock.getElapsedTime();

    // Pulsação sutil do livro
    bookMesh.position.y = 0.9 + Math.sin(time * 3) * 0.05;

    if (isRoomLit && activeModule === null) {
        
        let inputX = 0; let inputZ = 0;

        if(keys.w) inputZ -= 1; // Correção: W projeta Forward puro (Z negativo no ThreeJS)
        if(keys.s) inputZ += 1;
        if(keys.a) inputX -= 1;
        if(keys.d) inputX += 1;

        if(joyActive) {
            inputX += joyVector.x;
            inputZ += joyVector.y; // Ajuste de Vetor D-Pad 
        }

        if (inputX !== 0 || inputZ !== 0) {
            moveDirection.set(inputX, 0, inputZ).normalize().multiplyScalar(playerSpeed);
            
            // Transformação do Vetor de Movimento baseado no Eixo Y da Câmera (Yaw)
            camera.getWorldDirection(forward);
            forward.y = 0; 
            forward.normalize();
            right.crossVectors(camera.up, forward).normalize(); // Inversão vetorial cross product para direção correta A/D

            player.position.addScaledVector(right, moveDirection.x);
            player.position.addScaledVector(forward, moveDirection.z);
        }

        // Bounding Box das paredes
        player.position.x = Math.max(-10, Math.min(10, player.position.x));
        player.position.z = Math.max(-8, Math.min(8, player.position.z));

        // Acoplamento
        camera.position.set(player.position.x, 1.6, player.position.z);
        camera.rotation.set(pitch, yaw, 0, 'YXZ');

        const dist = player.position.distanceTo(table.position); // A mesa é a raiz do target
        if (dist <= interactionRadius) {
            if (!isNearBook) {
                isNearBook = true;
                interactionPrompt.classList.add('visible'); 
                cursorReticle.classList.add('active');
                gsap.to(bookMat, { emissiveIntensity: 2.0, duration: 0.3 }); 
            }
        } else {
            if (isNearBook) {
                isNearBook = false;
                interactionPrompt.classList.remove('visible');
                cursorReticle.classList.remove('active');
                gsap.to(bookMat, { emissiveIntensity: 0.5, duration: 0.3 });
            }
        }
    }

    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ==========================================
// 8. ISOLATED BOOK LOGIC
// ==========================================
const coverWrapper = document.querySelector('.book-cover-wrapper');
const pages = document.querySelectorAll('.page');
const starCanvas = document.getElementById('star-particles');
const photoCh1 = document.getElementById('ch1-photo');
const immersionLayer = document.getElementById('immersion-layer');
const closeImmersionBtn = document.getElementById('close-immersion');
const galaxyMap = document.getElementById('galaxy-map');
const staticStarsLayer = document.getElementById('static-stars-layer');
const interactiveStars = document.querySelectorAll('.interactive-star');
const hudOverlay = document.getElementById('hud-message-overlay');
const hudText = document.getElementById('hud-text');

let currentPage = 0; const totalPages = pages.length; let isAnimatingBook = false; 

moduleBook.addEventListener('click', (event) => {
    if (isAnimatingBook || activeModule !== 'book') return; 
    if (event.target.closest('#immersion-layer') || event.target.closest('.interactive-frame') || event.target.closest('.module-close-btn')) return;
    const clickX = event.clientX; const screenW = window.innerWidth;
    const clickedLeftBook = event.target.closest('.book-cover-wrapper');
    if (currentPage === 0) { if (clickedLeftBook) goToPage(1); } 
    else {
        if (clickedLeftBook) { goToPage(currentPage - 1); } 
        else if (clickX > screenW / 2) { goToPage(currentPage + 1); }
    }
});

function goToPage(index) {
    if (index < 0 || index >= totalPages) return;
    isAnimatingBook = true; currentPage = index;
    if (currentPage > 0) {
        coverWrapper.style.transformOrigin = "left center"; coverWrapper.style.transform = "rotateY(-140deg) translateZ(10px)";
    } else {
        coverWrapper.style.transformOrigin = "left center"; coverWrapper.style.transform = "rotateY(0deg) translateZ(0)";
    }
    setTimeout(() => {
        pages.forEach((page, i) => {
            if (i === currentPage && i !== 0) {
                page.classList.add('active');
                const magicTexts = page.querySelectorAll('.magic-text'); let globalWordOffset = 0; 
                magicTexts.forEach(textBlock => { globalWordOffset = revealText(textBlock, globalWordOffset); });
            } else { page.classList.remove('active'); }
        });
        isAnimatingBook = false; 
    }, 300); 
}

function revealText(element, startOffset = 0) {
    if (!element || element.dataset.done === "true") return startOffset;
    const originalText = element.innerText; element.innerHTML = '';
    const words = originalText.split(' ');
    words.forEach((word, index) => {
        const span = document.createElement('span'); span.innerHTML = word + '&nbsp;';
        span.style.opacity = '0'; span.style.filter = 'blur(8px)'; span.style.display = 'inline-block'; span.style.transform = 'translateY(5px)';
        span.style.transition = `all 0.8s cubic-bezier(0.23, 1, 0.32, 1) ${(startOffset + index) * 0.05}s`;
        element.appendChild(span);
        requestAnimationFrame(() => { span.style.opacity = '1'; span.style.filter = 'blur(0px)'; span.style.transform = 'translateY(0px)'; });
    });
    element.dataset.done = "true"; return startOffset + words.length; 
}

let isDraggingMap = false; let dragThresholdMet = false;
let startXMap = 0, startYMap = 0; let currentTransX = 0, currentTransY = 0; let initialTransX = 0, initialTransY = 0;

function generateGalaxyBackground() {
    const mapWidth = window.innerWidth * 3; const mapHeight = window.innerHeight * 3; const shadows = [];
    for(let i = 0; i < 600; i++) {
        const x = Math.floor(Math.random() * mapWidth); const y = Math.floor(Math.random() * mapHeight);
        const size = Math.random() < 0.85 ? 1 : 2; const alpha = (Math.random() * 0.5 + 0.1).toFixed(2);
        shadows.push(`${x}px ${y}px 0 ${size}px rgba(255,255,255,${alpha})`);
    }
    staticStarsLayer.style.boxShadow = shadows.join(', '); staticStarsLayer.style.width = '1px'; staticStarsLayer.style.height = '1px';
}

if (photoCh1) {
    photoCh1.addEventListener('click', (event) => {
        event.stopPropagation(); generateGalaxyBackground(); immersionLayer.classList.add('active');
        currentTransX = 0; currentTransY = 0; galaxyMap.style.transform = `translate3d(0px, 0px, 0)`;
    });
}
if (closeImmersionBtn) {
    closeImmersionBtn.addEventListener('click', (event) => {
        event.stopPropagation(); immersionLayer.classList.remove('active'); hudOverlay.classList.remove('visible');
    });
}

galaxyMap.addEventListener('pointerdown', (e) => {
    isDraggingMap = true; dragThresholdMet = false; startXMap = e.clientX; startYMap = e.clientY;
    initialTransX = currentTransX; initialTransY = currentTransY;
});
window.addEventListener('pointermove', (e) => {
    if (!isDraggingMap || activeModule !== 'book') return;
    const dx = e.clientX - startXMap; const dy = e.clientY - startYMap;
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) dragThresholdMet = true; 
    currentTransX = initialTransX + dx; currentTransY = initialTransY + dy;
    galaxyMap.style.transform = `translate3d(${currentTransX}px, ${currentTransY}px, 0)`;
});
window.addEventListener('pointerup', () => { isDraggingMap = false; });

interactiveStars.forEach(star => {
    star.addEventListener('click', (e) => {
        e.stopPropagation(); if (dragThresholdMet) return; 
        const msg = star.getAttribute('data-message'); hudText.innerHTML = `"${msg}"`; hudOverlay.classList.add('visible');
    });
});
hudOverlay.addEventListener('click', (e) => { e.stopPropagation(); hudOverlay.classList.remove('visible'); });

function initStarParticles() {
    if (!starCanvas) return; const context = starCanvas.getContext('2d'); if (!context) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; const stars = [];
    let width = 0; let height = 0;
    function resizeCanvas() { width = window.innerWidth; height = window.innerHeight; starCanvas.width = width; starCanvas.height = height; }
    function createStar(randomY = true) { return { x: Math.random() * width, y: randomY ? Math.random() * height : -20, size: Math.random() * 1.8 + 0.4, speedY: Math.random() * 0.35 + 0.12, driftX: (Math.random() - 0.5) * 0.15, alpha: Math.random() * 0.35 + 0.15, twinkle: Math.random() * Math.PI * 2, twinkleSpeed: Math.random() * 0.02 + 0.005 }; }
    function buildStars() {
        stars.length = 0; const count = reduceMotion ? 30 : (window.innerWidth < 768 ? 45 : 80);
        for (let i = 0; i < count; i += 1) { stars.push(createStar(true)); }
    }
    function drawStars() {
        if(activeModule !== 'book') return; 
        context.clearRect(0, 0, width, height);
        stars.forEach((star, index) => {
            star.y += reduceMotion ? star.speedY * 0.45 : star.speedY; star.x += reduceMotion ? star.driftX * 0.5 : star.driftX; star.twinkle += star.twinkleSpeed;
            if (star.y > height + 15) { stars[index] = createStar(false); return; }
            if (star.x < -10) star.x = width + 10; if (star.x > width + 10) star.x = -10;
            const twinkleAlpha = star.alpha + Math.sin(star.twinkle) * 0.08;
            context.beginPath(); context.fillStyle = `rgba(255, 244, 214, ${Math.max(0.08, twinkleAlpha)})`; context.arc(star.x, star.y, star.size, 0, Math.PI * 2); context.fill();
        });
        requestAnimationFrame(drawStars);
    }
    resizeCanvas(); buildStars(); drawStars();
}