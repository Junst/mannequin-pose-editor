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

    // Lazy-init detector
    if (!poseLandmarker) {
        statusEl.textContent = 'Loading AI model...';
        try {
            const { PoseLandmarker, FilesetResolver } = await import(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs"
            );
            const resolver = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
            );
            poseLandmarker = await PoseLandmarker.createFromOptions(resolver, {
                baseOptions: {
                    modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
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

    // Load image into an HTMLImageElement
    const img = new Image();
    img.src = URL.createObjectURL(file);
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });

    const result = poseLandmarker.detect(img);
    URL.revokeObjectURL(img.src);

    if (!result.worldLandmarks || result.worldLandmarks.length === 0) {
        statusEl.textContent = 'No pose detected';
        return;
    }

    const pose = landmarksToMannequinPose(result.worldLandmarks[0]);
    applyPoseToMannequin(pose);

    if (selectedPartName) buildSliders(selectedPartName);
    statusEl.textContent = 'Pose applied!';
    event.target.value = '';
}

function landmarksToMannequinPose(wl) {
    // MediaPipe world landmarks: x=person's left, y=down, z=toward camera
    // Convert to: x=person's right, y=up, z=forward (away from camera)
    const p = (i) => ({ x: -wl[i].x, y: -wl[i].y, z: -wl[i].z });
    const sub = (a, b) => ({ x: a.x-b.x, y: a.y-b.y, z: a.z-b.z });
    const mid = (a, b) => ({ x: (a.x+b.x)/2, y: (a.y+b.y)/2, z: (a.z+b.z)/2 });
    const len = (v) => Math.sqrt(v.x*v.x + v.y*v.y + v.z*v.z);
    const norm = (v) => { const l = len(v); return l > 1e-4 ? { x:v.x/l, y:v.y/l, z:v.z/l } : {x:0,y:0,z:0}; };
    const dot = (a, b) => a.x*b.x + a.y*b.y + a.z*b.z;
    const angle = (a, b) => Math.acos(Math.max(-1, Math.min(1, dot(norm(a), norm(b))))) * 180 / Math.PI;
    const R = 180 / Math.PI;

    const lS = p(11), rS = p(12), lE = p(13), rE = p(14), lW = p(15), rW = p(16);
    const lH = p(23), rH = p(24), lK = p(25), rK = p(26), lA = p(27), rA = p(28);
    const nose = p(0), lEar = p(7), rEar = p(8);

    // Bone vectors
    const lUA = sub(lE, lS), rUA = sub(rE, rS);
    const lFA = sub(lW, lE), rFA = sub(rW, rE);
    const lUL = sub(lK, lH), rUL = sub(rK, rH);
    const lLL = sub(lA, lK), rLL = sub(rA, rK);
    const spine = sub(mid(lS, rS), mid(lH, rH));

    // Torso
    const torso_bend = Math.atan2(spine.z, spine.y) * R;
    const torso_tilt = Math.atan2(-spine.x, spine.y) * R;

    // Arms: raise=fwd/back in YZ plane, straddle=sideways in XY plane
    // Down=(0,-1,0), so rest arm → atan2(0,1)=0
    const l_arm_raise    = Math.atan2(lUA.z, -lUA.y) * R;
    const l_arm_straddle = Math.atan2(-lUA.x, -lUA.y) * R;
    const r_arm_raise    = Math.atan2(rUA.z, -rUA.y) * R;
    const r_arm_straddle = Math.atan2(rUA.x, -rUA.y) * R;

    const l_elbow_bend = Math.max(0, 180 - angle(lUA, lFA));
    const r_elbow_bend = Math.max(0, 180 - angle(rUA, rFA));

    // Legs
    const l_leg_raise    = Math.atan2(lUL.z, -lUL.y) * R;
    const l_leg_straddle = Math.atan2(-lUL.x, -lUL.y) * R;
    const r_leg_raise    = Math.atan2(rUL.z, -rUL.y) * R;
    const r_leg_straddle = Math.atan2(rUL.x, -rUL.y) * R;

    const l_knee_bend = Math.max(0, 180 - angle(lUL, lLL));
    const r_knee_bend = Math.max(0, 180 - angle(rUL, rLL));

    // Head
    const hc = mid(lEar, rEar);
    const hd = sub(nose, hc);
    const ear = sub(rEar, lEar);

    return {
        body:    { bend: 0, turn: 0, tilt: 0 },
        torso:   { bend: torso_bend, turn: 0, tilt: torso_tilt },
        head:    { nod: Math.atan2(-hd.y, hd.z)*R, turn: Math.atan2(-ear.z, ear.x)*R, tilt: Math.atan2(ear.y, ear.x)*R },
        l_arm:   { raise: l_arm_raise, straddle: l_arm_straddle, turn: 0 },
        r_arm:   { raise: r_arm_raise, straddle: r_arm_straddle, turn: 0 },
        l_elbow: { bend: l_elbow_bend },
        r_elbow: { bend: r_elbow_bend },
        l_wrist: { bend: 0, tilt: 0, turn: 0 },
        r_wrist: { bend: 0, tilt: 0, turn: 0 },
        l_leg:   { raise: l_leg_raise, straddle: l_leg_straddle, turn: 0 },
        r_leg:   { raise: r_leg_raise, straddle: r_leg_straddle, turn: 0 },
        l_knee:  { bend: l_knee_bend },
        r_knee:  { bend: r_knee_bend },
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
