import * as THREE from 'three';
import { createStage, getStage, Male, Female, Child } from 'mannequin';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

// Body parts with their mannequin.js property names and available axes
const BODY_PARTS = {
    'Body':       { prop: 'body',      axes: ['bend', 'turn', 'tilt'] },
    'Torso':      { prop: 'torso',     axes: ['bend', 'turn', 'tilt'] },
    'Head':       { prop: 'head',      axes: ['nod', 'turn', 'tilt'] },
    'L. Arm':     { prop: 'l_arm',     axes: ['raise', 'straddle', 'turn'] },
    'R. Arm':     { prop: 'r_arm',     axes: ['raise', 'straddle', 'turn'] },
    'L. Elbow':   { prop: 'l_elbow',   axes: ['bend'] },
    'R. Elbow':   { prop: 'r_elbow',   axes: ['bend'] },
    'L. Wrist':   { prop: 'l_wrist',   axes: ['bend', 'tilt', 'turn'] },
    'R. Wrist':   { prop: 'r_wrist',   axes: ['bend', 'tilt', 'turn'] },
    'L. Leg':     { prop: 'l_leg',     axes: ['raise', 'straddle', 'turn'] },
    'R. Leg':     { prop: 'r_leg',     axes: ['raise', 'straddle', 'turn'] },
    'L. Knee':    { prop: 'l_knee',    axes: ['bend'] },
    'R. Knee':    { prop: 'r_knee',    axes: ['bend'] },
    'L. Ankle':   { prop: 'l_ankle',   axes: ['bend', 'turn', 'tilt'] },
    'R. Ankle':   { prop: 'r_ankle',   axes: ['bend', 'turn', 'tilt'] },
    'L. Fingers': { prop: 'l_fingers', axes: ['bend'] },
    'R. Fingers': { prop: 'r_fingers', axes: ['bend'] },
};

let figure = null;
let stage = null;
let selectedPartName = null;
let depthMode = false;
let normalMode = false;
let depthMaterial = null;
let normalMaterial = null;
let savedBackground = null;

// ── Initialization ──────────────────────────────────────────────────────────

function init() {
    createStage();
    stage = getStage();

    // Move the canvas from document.body into our viewport container
    const viewport = document.getElementById('viewport');
    const canvas = stage.renderer.domElement;
    // Override mannequin.js fullscreen fixed positioning
    canvas.style.cssText = '';
    viewport.appendChild(canvas);

    // Update depth uniforms every frame when depth mode is active
    stage.animationLoop = () => {
        if (depthMode) updateDepthUniforms();
    };

    // Create default male figure
    figure = new Male();

    // Build part-selection buttons
    buildPartButtons();

    // Wire up all UI event listeners
    setupEventListeners();

    // Fit renderer to viewport container
    handleResize();
    new ResizeObserver(handleResize).observe(viewport);

    // Select 'Body' by default
    selectPart('Body');
}

function handleResize() {
    const viewport = document.getElementById('viewport');
    const w = viewport.clientWidth;
    const h = viewport.clientHeight;
    if (w === 0 || h === 0) return;

    stage.camera.aspect = w / h;
    stage.camera.updateProjectionMatrix();
    stage.renderer.setSize(w, h);
}

// ── Body Part Buttons ───────────────────────────────────────────────────────

function buildPartButtons() {
    const container = document.getElementById('part-buttons');
    container.innerHTML = '';

    for (const name of Object.keys(BODY_PARTS)) {
        const btn = document.createElement('button');
        btn.className = 'part-btn';
        btn.textContent = name;
        btn.addEventListener('click', () => selectPart(name));
        container.appendChild(btn);
    }
}

function selectPart(name) {
    selectedPartName = name;

    // Highlight active button
    document.querySelectorAll('.part-btn').forEach(btn => {
        btn.classList.toggle('active', btn.textContent === name);
    });

    document.getElementById('selected-name').textContent = name;
    buildSliders(name);
}

// ── Joint Sliders ───────────────────────────────────────────────────────────

function buildSliders(name) {
    const container = document.getElementById('sliders');
    container.innerHTML = '';

    const info = BODY_PARTS[name];
    if (!info) return;

    const part = figure[info.prop];
    if (!part) return;

    for (const axis of info.axes) {
        let currentValue = 0;
        try { currentValue = part[axis] || 0; } catch (_) { /* ignore */ }

        const group = document.createElement('div');
        group.className = 'slider-group';

        const label = document.createElement('label');

        const nameSpan = document.createElement('span');
        nameSpan.textContent = axis;

        const valueSpan = document.createElement('span');
        valueSpan.className = 'axis-value';
        valueSpan.id = `val-${axis}`;
        valueSpan.textContent = Math.round(currentValue) + '\u00B0';

        label.appendChild(nameSpan);
        label.appendChild(valueSpan);

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = -180;
        slider.max = 180;
        slider.step = 1;
        slider.value = currentValue;

        slider.addEventListener('input', () => {
            const val = parseFloat(slider.value);
            try {
                part[axis] = val;
            } catch (_) { /* ignore unsupported axes */ }
            document.getElementById(`val-${axis}`).textContent = Math.round(val) + '\u00B0';
        });

        group.appendChild(label);
        group.appendChild(slider);
        container.appendChild(group);
    }
}

// ── Character Switching ─────────────────────────────────────────────────────

function switchCharacter(type) {
    // Remove old figure from scene
    if (figure && figure.parent) {
        figure.parent.remove(figure);
    }

    // Create new figure (auto-added to scene by mannequin.js)
    switch (type) {
        case 'female': figure = new Female(); break;
        case 'child':  figure = new Child();  break;
        default:       figure = new Male();   break;
    }

    // Refresh sliders for currently selected part
    if (selectedPartName) {
        buildSliders(selectedPartName);
    }
}

// ── Export: OBJ ─────────────────────────────────────────────────────────────

function exportOBJ() {
    try {
        const exporter = new OBJExporter();
        const result = exporter.parse(stage.scene);
        downloadBlob(
            new Blob([result], { type: 'text/plain' }),
            'mannequin-pose.obj'
        );
    } catch (err) {
        console.error('OBJ export error:', err);
        alert('OBJ export failed: ' + err.message);
    }
}

// ── Export: GLTF/GLB ────────────────────────────────────────────────────────

function exportGLTF() {
    const exporter = new GLTFExporter();
    exporter.parse(
        stage.scene,
        (result) => {
            const blob = new Blob([result], { type: 'application/octet-stream' });
            downloadBlob(blob, 'mannequin-pose.glb');
        },
        (err) => {
            console.error('GLTF export error:', err);
            alert('GLTF export failed: ' + err.message);
        },
        { binary: true }
    );
}

// ── Export: PNG Screenshot ──────────────────────────────────────────────────

function captureScreenshot() {
    // Render one frame synchronously so toDataURL captures current state
    stage.renderer.render(stage.scene, stage.camera);
    const dataURL = stage.renderer.domElement.toDataURL('image/png');

    const link = document.createElement('a');
    link.href = dataURL;
    link.download = 'mannequin-pose.png';
    link.click();
}

// ── Pose Save / Load / Reset ────────────────────────────────────────────────

function savePose() {
    const pose = figure.postureString;
    downloadBlob(
        new Blob([pose], { type: 'application/json' }),
        'mannequin-pose.json'
    );
}

function loadPose() {
    document.getElementById('file-input').click();
}

function handleFileLoad(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            figure.postureString = e.target.result;
            // Refresh sliders to show loaded values
            if (selectedPartName) {
                buildSliders(selectedPartName);
            }
        } catch (err) {
            alert('Failed to load pose: ' + err.message);
        }
    };
    reader.readAsText(file);
    event.target.value = ''; // allow re-loading the same file
}

function resetPose() {
    for (const info of Object.values(BODY_PARTS)) {
        const part = figure[info.prop];
        if (!part) continue;
        for (const axis of info.axes) {
            try { part[axis] = 0; } catch (_) { /* ignore */ }
        }
    }

    if (selectedPartName) {
        buildSliders(selectedPartName);
    }
}

// ── Depth Mode ──────────────────────────────────────────────────────────────

function createDepthMaterial() {
    return new THREE.ShaderMaterial({
        uniforms: {
            depthNear: { value: 2.0 },
            depthFar:  { value: 12.0 },
        },
        vertexShader: `
            varying float vViewZ;
            void main() {
                vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
                vViewZ = -mvPos.z;
                gl_Position = projectionMatrix * mvPos;
            }
        `,
        fragmentShader: `
            uniform float depthNear;
            uniform float depthFar;
            varying float vViewZ;
            void main() {
                float d = clamp((vViewZ - depthNear) / (depthFar - depthNear), 0.0, 1.0);
                d = 1.0 - d;   // near = white, far = black
                gl_FragColor = vec4(vec3(d), 1.0);
            }
        `,
    });
}

// Compute tight depth range from the mannequin's bounding box in view space
function computeDepthRange() {
    const box = new THREE.Box3().setFromObject(figure);
    const viewMatrix = stage.camera.matrixWorldInverse;

    // Transform all 8 corners of the bounding box to view space
    const corners = [
        new THREE.Vector3(box.min.x, box.min.y, box.min.z),
        new THREE.Vector3(box.min.x, box.min.y, box.max.z),
        new THREE.Vector3(box.min.x, box.max.y, box.min.z),
        new THREE.Vector3(box.min.x, box.max.y, box.max.z),
        new THREE.Vector3(box.max.x, box.min.y, box.min.z),
        new THREE.Vector3(box.max.x, box.min.y, box.max.z),
        new THREE.Vector3(box.max.x, box.max.y, box.min.z),
        new THREE.Vector3(box.max.x, box.max.y, box.max.z),
    ];

    let minZ = Infinity, maxZ = -Infinity;
    for (const c of corners) {
        const depth = -c.applyMatrix4(viewMatrix).z;   // positive distance from camera
        if (depth < minZ) minZ = depth;
        if (depth > maxZ) maxZ = depth;
    }

    const range = maxZ - minZ || 1;
    return {
        near: Math.max(0.1, minZ - range * 0.05),
        far:  maxZ + range * 0.4,   // padding so farthest body part stays dark-gray, not pure black
    };
}

function updateDepthUniforms() {
    if (!depthMaterial) return;
    const { near, far } = computeDepthRange();
    depthMaterial.uniforms.depthNear.value = near;
    depthMaterial.uniforms.depthFar.value  = far;
}

function toggleDepthMode() {
    depthMode = !depthMode;
    const btn = document.getElementById('btn-depth-toggle');

    // Turn off normal mode if active
    if (depthMode && normalMode) {
        normalMode = false;
        const normalBtn = document.getElementById('btn-normal-toggle');
        normalBtn.classList.remove('active');
        normalBtn.textContent = 'Normal: OFF';
    }

    if (depthMode) {
        if (!depthMaterial) depthMaterial = createDepthMaterial();
        savedBackground = stage.scene.background;
        stage.scene.overrideMaterial = depthMaterial;
        stage.scene.background = new THREE.Color(0x000000);
        if (stage.ground) stage.ground.visible = false;
        updateDepthUniforms();
        btn.classList.add('active');
        btn.textContent = 'Depth: ON';
    } else {
        stage.scene.overrideMaterial = null;
        stage.scene.background = savedBackground;
        if (stage.ground) stage.ground.visible = true;
        btn.classList.remove('active');
        btn.textContent = 'Depth: OFF';
    }
}

function captureDepthMap() {
    if (!depthMaterial) depthMaterial = createDepthMaterial();

    // Temporarily switch to depth rendering
    const prevOverride = stage.scene.overrideMaterial;
    const prevBg = stage.scene.background;

    stage.scene.overrideMaterial = depthMaterial;
    stage.scene.background = new THREE.Color(0x000000);
    const groundWasVisible = stage.ground ? stage.ground.visible : false;
    if (stage.ground) stage.ground.visible = false;
    updateDepthUniforms();

    stage.renderer.render(stage.scene, stage.camera);
    const dataURL = stage.renderer.domElement.toDataURL('image/png');

    // Restore
    stage.scene.overrideMaterial = prevOverride;
    stage.scene.background = prevBg;
    if (stage.ground) stage.ground.visible = groundWasVisible;

    const link = document.createElement('a');
    link.href = dataURL;
    link.download = 'mannequin-depth.png';
    link.click();
}

// ── Normal Map Mode ─────────────────────────────────────────────────────────

function toggleNormalMode() {
    normalMode = !normalMode;
    const btn = document.getElementById('btn-normal-toggle');

    // Turn off depth mode if active
    if (normalMode && depthMode) {
        depthMode = false;
        const depthBtn = document.getElementById('btn-depth-toggle');
        depthBtn.classList.remove('active');
        depthBtn.textContent = 'Depth: OFF';
    }

    if (normalMode) {
        if (!normalMaterial) normalMaterial = new THREE.MeshNormalMaterial();
        savedBackground = stage.scene.background;
        stage.scene.overrideMaterial = normalMaterial;
        stage.scene.background = new THREE.Color(0x000000);
        if (stage.ground) stage.ground.visible = false;
        btn.classList.add('active');
        btn.textContent = 'Normal: ON';
    } else {
        stage.scene.overrideMaterial = null;
        stage.scene.background = savedBackground;
        if (stage.ground) stage.ground.visible = true;
        btn.classList.remove('active');
        btn.textContent = 'Normal: OFF';
    }
}

function captureNormalMap() {
    if (!normalMaterial) normalMaterial = new THREE.MeshNormalMaterial();

    const prevOverride = stage.scene.overrideMaterial;
    const prevBg = stage.scene.background;
    const groundWasVisible = stage.ground ? stage.ground.visible : false;

    stage.scene.overrideMaterial = normalMaterial;
    stage.scene.background = new THREE.Color(0x000000);
    if (stage.ground) stage.ground.visible = false;

    stage.renderer.render(stage.scene, stage.camera);
    const dataURL = stage.renderer.domElement.toDataURL('image/png');

    // Restore
    stage.scene.overrideMaterial = prevOverride;
    stage.scene.background = prevBg;
    if (stage.ground) stage.ground.visible = groundWasVisible;

    const link = document.createElement('a');
    link.href = dataURL;
    link.download = 'mannequin-normal.png';
    link.click();
}

// ── Auto Pose from Image (MediaPipe) ────────────────────────────────────────

let poseLandmarker = null;

async function handlePoseImageUpload() {
    document.getElementById('pose-image-input').click();
}

async function processPoseImage(event) {
    const file = event.target.files[0];
    if (!file) return;

    const statusEl = document.getElementById('pose-detect-status');

    // Lazy-init detector (heavy model for best accuracy)
    if (!poseLandmarker) {
        statusEl.textContent = 'Loading AI model (heavy)...';
        try {
            const { PoseLandmarker, FilesetResolver } = await import(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs"
            );
            const resolver = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
            );
            poseLandmarker = await PoseLandmarker.createFromOptions(resolver, {
                baseOptions: {
                    modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/latest/pose_landmarker_heavy.task",
                    delegate: "GPU",
                },
                runningMode: "IMAGE",
                numPoses: 1,
            });
        } catch (err) {
            console.error("MediaPipe load failed:", err);
            statusEl.textContent = 'Model load failed';
            alert('Failed to load pose detection model.\n' + err.message);
            return;
        }
    }

    statusEl.textContent = 'Detecting pose...';

    const img = new Image();
    img.src = URL.createObjectURL(file);
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });

    const result = poseLandmarker.detect(img);
    URL.revokeObjectURL(img.src);

    if (!result.landmarks || result.landmarks.length === 0) {
        statusEl.textContent = 'No pose detected';
        return;
    }

    // Draw debug skeleton overlay on viewport
    drawPoseDebug(img, result.landmarks[0]);

    // Use 2D normalized landmarks (reliable) + 3D world landmarks (for depth hints)
    const pose = landmarksToMannequinPose(result.landmarks[0], result.worldLandmarks[0]);
    applyPoseToMannequin(pose);

    if (selectedPartName) buildSliders(selectedPartName);
    statusEl.textContent = 'Pose applied! (see skeleton overlay)';
    event.target.value = '';
}

// Skeleton connections for debug drawing
const POSE_CONNECTIONS = [
    [11,13],[13,15],[12,14],[14,16],  // arms
    [11,12],[11,23],[12,24],[23,24],  // torso
    [23,25],[25,27],[24,26],[26,28],  // legs
    [0,7],[0,8],[7,8],               // head
];

function drawPoseDebug(img, landmarks) {
    let debugCanvas = document.getElementById('pose-debug');
    if (!debugCanvas) {
        debugCanvas = document.createElement('canvas');
        debugCanvas.id = 'pose-debug';
        debugCanvas.style.cssText = 'position:absolute;top:10px;right:10px;max-width:200px;max-height:300px;border:2px solid #e94560;border-radius:4px;z-index:100;cursor:pointer;';
        debugCanvas.title = 'Click to dismiss';
        debugCanvas.onclick = () => debugCanvas.remove();
        document.getElementById('viewport').appendChild(debugCanvas);
    }
    debugCanvas.width = img.naturalWidth;
    debugCanvas.height = img.naturalHeight;
    const ctx = debugCanvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const w = img.naturalWidth, h = img.naturalHeight;

    // Draw connections
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = Math.max(2, w * 0.005);
    for (const [a, b] of POSE_CONNECTIONS) {
        const la = landmarks[a], lb = landmarks[b];
        if (la.visibility < 0.3 || lb.visibility < 0.3) continue;
        ctx.beginPath();
        ctx.moveTo(la.x * w, la.y * h);
        ctx.lineTo(lb.x * w, lb.y * h);
        ctx.stroke();
    }

    // Draw joints
    const r = Math.max(3, w * 0.008);
    for (let i = 0; i < 33; i++) {
        const lm = landmarks[i];
        if (lm.visibility < 0.3) continue;
        ctx.fillStyle = lm.visibility > 0.7 ? '#ff0000' : '#ffaa00';
        ctx.beginPath();
        ctx.arc(lm.x * w, lm.y * h, r, 0, Math.PI * 2);
        ctx.fill();
    }
}

function landmarksToMannequinPose(nl, wl) {
    // nl = normalized landmarks (2D image space, reliable)
    //   x = left→right in image (0..1), y = top→bottom (0..1)
    // wl = world landmarks (3D, z is noisy)
    //   x = person's left, y = down, z = toward camera

    const DEG = 180 / Math.PI;
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

    // 2D direction from landmark a to b
    const d2 = (a, b) => [nl[b].x - nl[a].x, nl[b].y - nl[a].y];

    // 3D direction from landmark a to b
    const d3 = (a, b) => [wl[b].x - wl[a].x, wl[b].y - wl[a].y, wl[b].z - wl[a].z];
    const len3 = (d) => Math.sqrt(d[0]**2 + d[1]**2 + d[2]**2);
    const dot3 = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];

    // Bend angle at middle joint (3D, robust since it's relative)
    const bendAt = (a, b, c) => {
        const v1 = d3(b, a), v2 = d3(b, c);
        const l1 = len3(v1), l2 = len3(v2);
        if (l1 < 1e-6 || l2 < 1e-6) return 0;
        const cos = clamp(dot3(v1, v2) / (l1 * l2), -1, 1);
        return clamp(180 - Math.acos(cos) * DEG, 0, 150);
    };

    // === STRADDLE from 2D (most reliable) ===
    // Angle of limb from vertical in the frontal plane (image plane)
    // Person facing camera: person's left = image right
    // Left limb going rightward = away from body = positive straddle
    // Right limb going leftward = away from body = positive straddle
    const [lAx, lAy] = d2(11, 13);  // left shoulder→elbow
    const [rAx, rAy] = d2(12, 14);  // right shoulder→elbow
    const [lLx, lLy] = d2(23, 25);  // left hip→knee
    const [rLx, rLy] = d2(24, 26);  // right hip→knee

    const lArm_straddle = clamp(Math.atan2( lAx, lAy) * DEG, -90, 180);
    const rArm_straddle = clamp(Math.atan2(-rAx, rAy) * DEG, -90, 180);
    const lLeg_straddle = clamp(Math.atan2( lLx, lLy) * DEG, -60, 60);
    const rLeg_straddle = clamp(Math.atan2(-rLx, rLy) * DEG, -60, 60);

    // === RAISE from 3D world landmarks (damped 50% due to z noise) ===
    // Forward = -z in world landmarks (away from camera)
    // Down = +y in world landmarks
    const lA3 = d3(11, 13), rA3 = d3(12, 14);
    const lL3 = d3(23, 25), rL3 = d3(24, 26);

    const lArm_raise = clamp(Math.atan2(-lA3[2], lA3[1]) * DEG * 0.5, -90, 90);
    const rArm_raise = clamp(Math.atan2(-rA3[2], rA3[1]) * DEG * 0.5, -90, 90);
    const lLeg_raise = clamp(Math.atan2(-lL3[2], lL3[1]) * DEG * 0.5, -90, 90);
    const rLeg_raise = clamp(Math.atan2(-rL3[2], rL3[1]) * DEG * 0.5, -90, 90);

    // === TORSO ===
    // Tilt from 2D (spine lean left/right)
    const hipMid  = [(nl[23].x + nl[24].x) / 2, (nl[23].y + nl[24].y) / 2];
    const shoMid  = [(nl[11].x + nl[12].x) / 2, (nl[11].y + nl[12].y) / 2];
    const spDx = shoMid[0] - hipMid[0], spDy = shoMid[1] - hipMid[1];
    const torso_tilt = clamp(Math.atan2(-spDx, -spDy) * DEG, -45, 45);

    // Bend from 3D (forward lean, damped)
    const hipMid3 = [(wl[23].y + wl[24].y) / 2, (wl[23].z + wl[24].z) / 2];
    const shoMid3 = [(wl[11].y + wl[12].y) / 2, (wl[11].z + wl[12].z) / 2];
    const spDy3 = shoMid3[0] - hipMid3[0]; // dy in world (down direction)
    const spDz3 = shoMid3[1] - hipMid3[1]; // dz in world (toward camera)
    const torso_bend = clamp(Math.atan2(-spDz3, -spDy3) * DEG * 0.5, -45, 45);

    // === HEAD ===
    // Tilt from 2D (ear-to-ear angle)
    const [earDx, earDy] = d2(7, 8);
    const head_tilt = clamp(Math.atan2(earDy, earDx) * DEG, -30, 30);

    // Turn from 2D (nose offset from ear midpoint, relative to ear distance)
    const earMidX = (nl[7].x + nl[8].x) / 2;
    const earDist = Math.max(Math.abs(nl[8].x - nl[7].x), 0.01);
    const head_turn = clamp(((nl[0].x - earMidX) / earDist) * 60, -60, 60);

    // Nod: hard to get from 2D, use small damped 3D estimate
    const head_nod = 0;

    console.log('[AutoPose] 2D+3D hybrid:', {
        lArm: { raise: lArm_raise, straddle: lArm_straddle },
        rArm: { raise: rArm_raise, straddle: rArm_straddle },
        lLeg: { raise: lLeg_raise, straddle: lLeg_straddle },
        rLeg: { raise: rLeg_raise, straddle: rLeg_straddle },
        torso: { bend: torso_bend, tilt: torso_tilt },
        head: { turn: head_turn, tilt: head_tilt },
    });

    return {
        body:    { bend: 0, turn: -90, tilt: 0 },
        torso:   { bend: torso_bend, turn: 0, tilt: torso_tilt },
        head:    { nod: head_nod, turn: head_turn, tilt: head_tilt },
        l_arm:   { raise: lArm_raise, straddle: lArm_straddle, turn: 0 },
        r_arm:   { raise: rArm_raise, straddle: rArm_straddle, turn: 0 },
        l_elbow: { bend: bendAt(11, 13, 15) },
        r_elbow: { bend: bendAt(12, 14, 16) },
        l_wrist: { bend: 0, tilt: 0, turn: 0 },
        r_wrist: { bend: 0, tilt: 0, turn: 0 },
        l_leg:   { raise: lLeg_raise, straddle: lLeg_straddle, turn: 0 },
        r_leg:   { raise: rLeg_raise, straddle: rLeg_straddle, turn: 0 },
        l_knee:  { bend: bendAt(23, 25, 27) },
        r_knee:  { bend: bendAt(24, 26, 28) },
        l_ankle: { bend: 0, turn: 0, tilt: 0 },
        r_ankle: { bend: 0, turn: 0, tilt: 0 },
    };
}

function applyPoseToMannequin(pose) {
    for (const [partName, angles] of Object.entries(pose)) {
        const part = figure[partName];
        if (!part) continue;
        for (const [axis, value] of Object.entries(angles)) {
            try { part[axis] = value; } catch (_) {}
        }
    }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

// ── Event Wiring ────────────────────────────────────────────────────────────

function setupEventListeners() {
    // Character type buttons
    document.querySelectorAll('.char-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.char-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            switchCharacter(btn.dataset.type);
        });
    });

    // Export buttons
    document.getElementById('btn-png').addEventListener('click', captureScreenshot);
    document.getElementById('btn-obj').addEventListener('click', exportOBJ);
    document.getElementById('btn-gltf').addEventListener('click', exportGLTF);

    // Depth mode
    document.getElementById('btn-depth-toggle').addEventListener('click', toggleDepthMode);
    document.getElementById('btn-depth-png').addEventListener('click', captureDepthMap);

    // Normal map mode
    document.getElementById('btn-normal-toggle').addEventListener('click', toggleNormalMode);
    document.getElementById('btn-normal-png').addEventListener('click', captureNormalMap);

    // Auto pose from image
    document.getElementById('btn-auto-pose').addEventListener('click', handlePoseImageUpload);
    document.getElementById('pose-image-input').addEventListener('change', processPoseImage);

    // Pose management
    document.getElementById('btn-save').addEventListener('click', savePose);
    document.getElementById('btn-load').addEventListener('click', loadPose);
    document.getElementById('btn-reset').addEventListener('click', resetPose);

    // Hidden file input for Load
    document.getElementById('file-input').addEventListener('change', handleFileLoad);
}

// ── Start ───────────────────────────────────────────────────────────────────

init();
