const video = document.getElementById("video");
const preview = document.getElementById("preview");
const overlay = document.getElementById("overlay");
const overlayCtx = overlay.getContext("2d");
const statusPill = document.getElementById("statusPill");
const loader = document.getElementById("loader");

preview.srcObject = null;

/* ================= UTILS ================= */
const lerp = (start, end, amount) => start + (end - start) * amount;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const distance2D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function resizeOverlay() {
  overlay.width = window.innerWidth * window.devicePixelRatio;
  overlay.height = window.innerHeight * window.devicePixelRatio;
  overlay.style.width = `${window.innerWidth}px`;
  overlay.style.height = `${window.innerHeight}px`;
  overlayCtx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
}
resizeOverlay();

/* ================= THREE.JS SCENE ================= */
const scene = new THREE.Scene();

const camera3D = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera3D.position.z = 7;

const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.45;
document.body.appendChild(renderer.domElement);

/* ================= LIGHTS ================= */
const ambientLight = new THREE.AmbientLight(0xffffff, 0.78);
scene.add(ambientLight);

const mainLight = new THREE.PointLight(0xff2f7d, 3.2, 80);
mainLight.position.set(4, 5, 6);
scene.add(mainLight);

const rimLight = new THREE.PointLight(0x7d4cff, 1.7, 50);
rimLight.position.set(-5, -2, 4);
scene.add(rimLight);

/* ================= HEART MESH ================= */
function createHeartShape() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.2);
  shape.bezierCurveTo(0, 0.2, -0.35, -0.25, -0.9, 0.08);
  shape.bezierCurveTo(-1.65, 0.55, -1.45, 1.72, 0, 2.55);
  shape.bezierCurveTo(1.45, 1.72, 1.65, 0.55, 0.9, 0.08);
  shape.bezierCurveTo(0.35, -0.25, 0, 0.2, 0, 0.2);
  return shape;
}

const heartGeometry = new THREE.ExtrudeGeometry(createHeartShape(), {
  depth: 0.55,
  bevelEnabled: true,
  bevelThickness: 0.18,
  bevelSize: 0.16,
  bevelSegments: 14,
  curveSegments: 48
});
heartGeometry.center();

const heartMaterial = new THREE.MeshPhysicalMaterial({
  color: 0xff2f7d,
  emissive: 0x8a002d,
  emissiveIntensity: 0.38,
  roughness: 0.16,
  metalness: 0.18,
  clearcoat: 1,
  clearcoatRoughness: 0.08,
  reflectivity: 0.85
});

const heart = new THREE.Mesh(heartGeometry, heartMaterial);
heart.scale.set(1, 1, 1);
scene.add(heart);

/* ================= RINGS ================= */
const ringGroup = new THREE.Group();
scene.add(ringGroup);

for (let i = 0; i < 3; i++) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.2 + i * 0.28, 0.008, 12, 120),
    new THREE.MeshBasicMaterial({
      color: i === 1 ? 0xff6fac : 0xff2f7d,
      transparent: true,
      opacity: 0.24 - i * 0.045
    })
  );
  ring.rotation.x = Math.PI / 2 + i * 0.35;
  ring.rotation.y = i * 0.6;
  ringGroup.add(ring);
}

/* ================= PARTICLES ================= */
const particleCount = 160;
const particleGeometry = new THREE.BufferGeometry();
const particlePositions = new Float32Array(particleCount * 3);
const particleSpeeds = [];

for (let i = 0; i < particleCount; i++) {
  particlePositions[i * 3] = (Math.random() - 0.5) * 10;
  particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 7;
  particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 6;
  particleSpeeds.push(0.002 + Math.random() * 0.012);
}

particleGeometry.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));

const particleMaterial = new THREE.PointsMaterial({
  size: 0.035,
  color: 0xff8fbd,
  transparent: true,
  opacity: 0.85,
  blending: THREE.AdditiveBlending
});

const particles = new THREE.Points(particleGeometry, particleMaterial);
scene.add(particles);

/* ================= BURST PARTICLES ================= */
const burstGroup = new THREE.Group();
scene.add(burstGroup);
let lastPinchTime = 0;

function createBurst() {
  const now = performance.now();
  if (now - lastPinchTime < 900) return;
  lastPinchTime = now;

  for (let i = 0; i < 34; i++) {
    const spriteCanvas = document.createElement("canvas");
    spriteCanvas.width = 64;
    spriteCanvas.height = 64;
    const ctx = spriteCanvas.getContext("2d");
    ctx.font = "44px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("❤", 32, 34);

    const texture = new THREE.CanvasTexture(spriteCanvas);
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending
    });

    const sprite = new THREE.Sprite(material);
    sprite.position.copy(heart.position);
    sprite.scale.set(0.2, 0.2, 0.2);
    sprite.userData.velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 0.16,
      (Math.random() - 0.5) * 0.16,
      (Math.random() - 0.5) * 0.12
    );
    sprite.userData.life = 1;
    burstGroup.add(sprite);
  }
}

/* ================= HAND STATE ================= */
const handState = {
  detected: false,
  targetX: 0,
  targetY: 0,
  targetScale: 1,
  rotationZ: 0,
  rotationX: 0,
  gesture: "Searching hand...",
  pinch: false
};

function countOpenFingers(landmarks) {
  const tips = [8, 12, 16, 20];
  const pips = [6, 10, 14, 18];
  let open = 0;

  for (let i = 0; i < tips.length; i++) {
    if (landmarks[tips[i]].y < landmarks[pips[i]].y) open++;
  }

  const thumbOpen = Math.abs(landmarks[4].x - landmarks[2].x) > 0.08;
  if (thumbOpen) open++;
  return open;
}

function updateHeartFromHand(landmarks) {
  const wrist = landmarks[0];
  const middleBase = landmarks[9];
  const indexTip = landmarks[8];
  const thumbTip = landmarks[4];
  const pinkyBase = landmarks[17];
  const indexBase = landmarks[5];

  const centerX = (wrist.x + middleBase.x + indexTip.x) / 3;
  const centerY = (wrist.y + middleBase.y + indexTip.y) / 3;

  handState.targetX = (0.5 - centerX) * -8;
  handState.targetY = -(centerY - 0.5) * 5;

  const handWidth = distance2D(indexBase, pinkyBase);
  handState.targetScale = clamp(0.65 + handWidth * 6.5, 0.75, 2.35);

  const handAngle = Math.atan2(indexBase.y - pinkyBase.y, indexBase.x - pinkyBase.x);
  handState.rotationZ = -handAngle;
  handState.rotationX = clamp((wrist.y - middleBase.y) * 4, -0.8, 0.8);

  const pinchDistance = distance2D(indexTip, thumbTip);
  handState.pinch = pinchDistance < 0.055;

  const openFingers = countOpenFingers(landmarks);
  if (handState.pinch) {
    handState.gesture = "Pinch Burst";
    createBurst();
  } else if (openFingers >= 4) {
    handState.gesture = "Open Hand Glow";
  } else if (openFingers <= 1) {
    handState.gesture = "Fist Pulse";
  } else {
    handState.gesture = "Hand Sync Active";
  }

  if (openFingers >= 4) {
    heart.material.color.set(0xff4fa3);
    heart.material.emissive.set(0x9a0044);
    heart.material.emissiveIntensity = 0.62;
    mainLight.intensity = 4.6;
  } else if (openFingers <= 1) {
    heart.material.color.set(0xff143f);
    heart.material.emissive.set(0x9d001e);
    heart.material.emissiveIntensity = 0.78;
    mainLight.intensity = 5.2;
  } else {
    heart.material.color.set(0xff2f7d);
    heart.material.emissive.set(0x8a002d);
    heart.material.emissiveIntensity = 0.42;
    mainLight.intensity = 3.5;
  }
}

function drawHandHUD(landmarks) {
  overlayCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  if (!landmarks) return;

  overlayCtx.save();
  overlayCtx.scale(-1, 1);
  overlayCtx.translate(-window.innerWidth, 0);

  const connections = [
    [0, 1], [1, 2], [2, 3], [3, 4],
    [0, 5], [5, 6], [6, 7], [7, 8],
    [5, 9], [9, 10], [10, 11], [11, 12],
    [9, 13], [13, 14], [14, 15], [15, 16],
    [13, 17], [17, 18], [18, 19], [19, 20],
    [0, 17]
  ];

  overlayCtx.lineWidth = 2;
  overlayCtx.strokeStyle = "rgba(255, 79, 163, 0.54)";
  overlayCtx.fillStyle = "rgba(255, 255, 255, 0.82)";

  for (const [a, b] of connections) {
    const p1 = landmarks[a];
    const p2 = landmarks[b];
    overlayCtx.beginPath();
    overlayCtx.moveTo(p1.x * window.innerWidth, p1.y * window.innerHeight);
    overlayCtx.lineTo(p2.x * window.innerWidth, p2.y * window.innerHeight);
    overlayCtx.stroke();
  }

  for (const p of landmarks) {
    overlayCtx.beginPath();
    overlayCtx.arc(p.x * window.innerWidth, p.y * window.innerHeight, 4, 0, Math.PI * 2);
    overlayCtx.fill();
  }

  overlayCtx.restore();
}

/* ================= MEDIAPIPE HANDS ================= */
const hands = new Hands({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.72,
  minTrackingConfidence: 0.72
});

hands.onResults((results) => {
  const landmarks = results.multiHandLandmarks && results.multiHandLandmarks[0];

  if (!landmarks) {
    handState.detected = false;
    statusPill.textContent = "Show your hand";
    drawHandHUD(null);
    return;
  }

  handState.detected = true;
  loader.classList.add("hidden");
  updateHeartFromHand(landmarks);
  drawHandHUD(landmarks);
  statusPill.textContent = handState.gesture;
});

/* ================= CAMERA ================= */
async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: 960,
        height: 720,
        facingMode: "user"
      },
      audio: false
    });

    video.srcObject = stream;
    preview.srcObject = stream;
    await video.play();
    await preview.play();

    const cameraMP = new Camera(video, {
      onFrame: async () => {
        await hands.send({ image: video });
      },
      width: 960,
      height: 720
    });

    await cameraMP.start();
    loader.classList.add("hidden");
    statusPill.textContent = "Show your hand";
  } catch (error) {
    console.error(error);
    statusPill.textContent = "Camera blocked";
    loader.querySelector("p").textContent = "Camera permission blocked. Enable it and refresh.";
  }
}
startCamera();

/* ================= ANIMATION LOOP ================= */
function animate() {
  requestAnimationFrame(animate);
  const time = performance.now() * 0.001;

  if (handState.detected) {
    heart.position.x = lerp(heart.position.x, handState.targetX, 0.14);
    heart.position.y = lerp(heart.position.y, handState.targetY, 0.14);
    heart.rotation.z = lerp(heart.rotation.z, handState.rotationZ, 0.11);
    heart.rotation.x = lerp(heart.rotation.x, handState.rotationX, 0.1);
    heart.rotation.y += 0.012;
  } else {
    heart.position.x = lerp(heart.position.x, 0, 0.04);
    heart.position.y = lerp(heart.position.y, 0, 0.04);
    heart.rotation.y += 0.018;
    heart.rotation.z = Math.sin(time * 0.8) * 0.08;
  }

  const pulsePower = handState.pinch ? 0.24 : 0.085;
  const pulse = 1 + Math.sin(time * 6.5) * pulsePower;
  const finalScale = handState.targetScale * pulse;
  heart.scale.x = lerp(heart.scale.x, finalScale, 0.12);
  heart.scale.y = lerp(heart.scale.y, finalScale, 0.12);
  heart.scale.z = lerp(heart.scale.z, finalScale, 0.12);

  ringGroup.position.copy(heart.position);
  ringGroup.rotation.x += 0.004;
  ringGroup.rotation.y += 0.007;
  ringGroup.scale.setScalar(lerp(ringGroup.scale.x, finalScale * 0.9, 0.08));

  particles.rotation.y += 0.0008;
  const positions = particleGeometry.attributes.position.array;
  for (let i = 0; i < particleCount; i++) {
    positions[i * 3 + 1] += particleSpeeds[i];
    if (positions[i * 3 + 1] > 4) {
      positions[i * 3 + 1] = -4;
      positions[i * 3] = (Math.random() - 0.5) * 10;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 6;
    }
  }
  particleGeometry.attributes.position.needsUpdate = true;

  for (let i = burstGroup.children.length - 1; i >= 0; i--) {
    const sprite = burstGroup.children[i];
    sprite.position.add(sprite.userData.velocity);
    sprite.userData.velocity.y += 0.0015;
    sprite.userData.life -= 0.018;
    sprite.material.opacity = sprite.userData.life;
    sprite.scale.multiplyScalar(1.018);

    if (sprite.userData.life <= 0) {
      sprite.material.map.dispose();
      sprite.material.dispose();
      burstGroup.remove(sprite);
    }
  }

  mainLight.position.set(heart.position.x + 3, heart.position.y + 3, 5);
  renderer.render(scene, camera3D);
}
animate();

/* ================= RESIZE ================= */
window.addEventListener("resize", () => {
  camera3D.aspect = window.innerWidth / window.innerHeight;
  camera3D.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  resizeOverlay();
});
