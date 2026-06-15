import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

window.VIEWER_BOOTED = true;

const ROOT_URL = new URL('../', window.location.href);
const MODEL_EXTENSIONS = ['.glb', '.obj', '.stl', '.ply'];
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.avif'];
const MODE_LABELS = {
  original: '原始材質',
  clay: '灰模',
  normal: '法線'
};

const viewerSection = document.querySelector('#viewer-section');
const canvas = document.querySelector('#viewer');
const titleEl = document.querySelector('#title');
const subtitleEl = document.querySelector('#subtitle');
const statusEl = document.querySelector('#status');
const statusTextEl = document.querySelector('#status-text');
const progressShell = document.querySelector('#progress-shell');
const progressBar = document.querySelector('#progress-bar');
const emptyState = document.querySelector('#empty-state');
const modelNameEl = document.querySelector('#model-name');
const vertexCountEl = document.querySelector('#vertex-count');
const triangleCountEl = document.querySelector('#triangle-count');
const displayModeEl = document.querySelector('#display-mode');
const rotateButton = document.querySelector('#rotate-button');
const gridButton = document.querySelector('#grid-button');
const wireframeButton = document.querySelector('#wireframe-button');
const resetButton = document.querySelector('#reset-button');
const localButton = document.querySelector('#local-button');
const emptyOpenLocalButton = document.querySelector('#empty-open-local');
const fullscreenButton = document.querySelector('#fullscreen-button');
const sourceButton = document.querySelector('#source-button');
const sourceSection = document.querySelector('#source-section');
const sourceTitleEl = document.querySelector('#source-title');
const sourceDescriptionEl = document.querySelector('#source-description');
const sourceImageEl = document.querySelector('#source-image');
const sourceEmptyEl = document.querySelector('#source-empty');
const sourceFilenameEl = document.querySelector('#source-filename');
const backToModelButton = document.querySelector('#back-to-model-button');
const fileInput = document.querySelector('#file-input');
const dropHint = document.querySelector('#drop-hint');
const modeOriginalButton = document.querySelector('#mode-original');
const modeClayButton = document.querySelector('#mode-clay');
const modeNormalButton = document.querySelector('#mode-normal');
const loadingCover = document.querySelector('#loading-cover');
const loadingCoverImage = document.querySelector('#loading-cover-image');
const loadingStageEl = document.querySelector('#loading-stage');
const loadingDetailEl = document.querySelector('#loading-detail');
const loadingPercentEl = document.querySelector('#loading-percent');

let siteConfig = {};
let work = null;
let activeModel = null;
let activeMixer = null;
let initialView = null;
let wireframeEnabled = false;
let activeMaterialMode = 'original';
let activeModelLooksTextured = false;
let activeTriangleCount = 0;
let outlinesPrepared = false;
let outlinePreparationPromise = null;
const clock = new THREE.Clock();

function absoluteUrl(path) {
  return new URL(path, ROOT_URL).href;
}

function setStatus(message, state = 'loading', detail = '') {
  statusTextEl.textContent = message;
  statusEl.dataset.state = state;
  if (loadingStageEl) loadingStageEl.textContent = message;
  if (loadingDetailEl && detail) loadingDetailEl.textContent = detail;
}

function showLoadingCover() {
  loadingCover?.classList.remove('is-hidden');
  loadingCover?.setAttribute('aria-hidden', 'false');
}

function hideLoadingCover() {
  loadingCover?.classList.add('is-hidden');
  loadingCover?.setAttribute('aria-hidden', 'true');
}

function setProgress(value, visible = true) {
  progressShell.hidden = !visible;
  const percent = Math.max(0, Math.min(100, value));
  progressBar.style.width = `${Math.max(4, percent)}%`;
  if (loadingPercentEl) loadingPercentEl.textContent = visible ? `${Math.round(percent)}%` : '';
}

function updateProgress(event) {
  if (event?.total) {
    const percent = (event.loaded / event.total) * 100;
    setProgress(percent, true);
    if (loadingDetailEl) {
      const loadedMb = event.loaded / 1024 / 1024;
      const totalMb = event.total / 1024 / 1024;
      loadingDetailEl.textContent = `${loadedMb.toFixed(1)} / ${totalMb.toFixed(1)} MB`;
    }
  } else {
    const current = Number.parseFloat(progressBar.style.width) || 8;
    setProgress(Math.min(current + 3, 92), true);
    if (loadingDetailEl) loadingDetailEl.textContent = '正在接收模型資料';
  }
}

function humanNumber(value) {
  return new Intl.NumberFormat('zh-Hant-TW').format(value || 0);
}

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 1000);
camera.position.set(4.2, 2.6, 5.8);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  powerPreference: 'high-performance'
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
if ('environmentIntensity' in scene) scene.environmentIntensity = 0.52;
pmrem.dispose();

const hemisphere = new THREE.HemisphereLight(0xdce8ff, 0x151722, 0.62);
scene.add(hemisphere);

const keyLight = new THREE.DirectionalLight(0xfff4e8, 3.4);
keyLight.position.set(4.5, 7.2, 5.0);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.near = 0.1;
keyLight.shadow.camera.far = 30;
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0x9fc6ff, 1.05);
fillLight.position.set(-4.5, 3.0, 4.0);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0xb69cff, 2.15);
rimLight.position.set(-4.0, 5.5, -5.0);
scene.add(rimLight);

const frontSoftLight = new THREE.PointLight(0xffffff, 0.8, 20);
frontSoftLight.position.set(0, 2.5, 5.5);
scene.add(frontSoftLight);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.065;
controls.autoRotate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
controls.autoRotateSpeed = 0.85;
controls.minDistance = 0.15;
controls.maxDistance = 100;
controls.screenSpacePanning = true;

const grid = new THREE.GridHelper(12, 24, 0x5d6172, 0x292c36);
grid.material.transparent = true;
grid.material.opacity = 0.34;
scene.add(grid);

const shadowPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(24, 24),
  new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.38 })
);
shadowPlane.rotation.x = -Math.PI / 2;
shadowPlane.position.y = -0.006;
shadowPlane.receiveShadow = true;
scene.add(shadowPlane);

const gltfLoader = new GLTFLoader();
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath(absoluteUrl('shared/vendor/draco/gltf/'));
gltfLoader.setDRACOLoader(dracoLoader);
gltfLoader.setMeshoptDecoder(MeshoptDecoder);

function updateStatistics(object) {
  let vertices = 0;
  let triangles = 0;
  object.traverse((child) => {
    if (child.userData?.__viewerHelper) return;
    if (!child.isMesh || !child.geometry) return;
    const position = child.geometry.getAttribute('position');
    if (position) vertices += position.count;
    if (child.geometry.index) triangles += child.geometry.index.count / 3;
    else if (position) triangles += position.count / 3;
  });
  const roundedVertices = Math.round(vertices);
  const roundedTriangles = Math.round(triangles);
  vertexCountEl.textContent = humanNumber(roundedVertices);
  triangleCountEl.textContent = humanNumber(roundedTriangles);
  return { vertices: roundedVertices, triangles: roundedTriangles };
}

function materialArray(material) {
  return Array.isArray(material) ? material : [material];
}

function disposeMaterial(material, disposedMaterials, disposedTextures) {
  if (!material || disposedMaterials.has(material)) return;
  disposedMaterials.add(material);
  for (const value of Object.values(material)) {
    if (value?.isTexture && !disposedTextures.has(value)) {
      disposedTextures.add(value);
      value.dispose();
    }
  }
  material.dispose?.();
}

function clearModel() {
  if (!activeModel) return;
  scene.remove(activeModel);

  const disposedMaterials = new Set();
  const disposedTextures = new Set();

  activeModel.traverse((child) => {
    if (child.userData?.__viewerHelper) {
      if (!child.userData.__viewerSharesGeometry) {
        child.geometry?.dispose?.();
      }
      for (const material of materialArray(child.material)) {
        disposeMaterial(material, disposedMaterials, disposedTextures);
      }
      return;
    }

    child.geometry?.dispose?.();
    const variants = [
      child.userData.__viewerOriginalMaterial,
      child.userData.__viewerClayMaterial,
      child.userData.__viewerNormalMaterial,
      child.material
    ];
    for (const variant of variants) {
      for (const material of materialArray(variant)) {
        disposeMaterial(material, disposedMaterials, disposedTextures);
      }
    }
  });

  activeModel = null;
  activeMixer = null;
  activeTriangleCount = 0;
  outlinesPrepared = false;
  outlinePreparationPromise = null;
  wireframeEnabled = false;
  wireframeButton.disabled = false;
  wireframeButton.setAttribute('aria-pressed', 'false');
  vertexCountEl.textContent = '—';
  triangleCountEl.textContent = '—';
  displayModeEl.textContent = '—';
}

function normalizeModel(object) {
  object.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) throw new Error('模型沒有可顯示的幾何資料。');

  const size = box.getSize(new THREE.Vector3());
  const maxDimension = Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(maxDimension) || maxDimension <= 0) {
    throw new Error('無法計算模型尺寸。');
  }

  object.scale.multiplyScalar(3.5 / maxDimension);
  object.updateMatrixWorld(true);

  box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  object.position.x -= center.x;
  object.position.z -= center.z;
  object.position.y -= box.min.y;
  object.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(object);
}

function hasTexture(material) {
  if (!material) return false;
  const mapFields = [
    'map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap',
    'aoMap', 'alphaMap', 'bumpMap', 'displacementMap', 'lightMap'
  ];
  return mapFields.some((field) => Boolean(material[field]));
}

function materialHasUsefulColor(material) {
  if (!material?.color) return false;
  const hsl = {};
  material.color.getHSL(hsl);
  return hsl.s > 0.14 || hsl.l < 0.72;
}


function getContrastingOutlineColor(backgroundValue) {
  const background = new THREE.Color(backgroundValue || '#0d1017');
  const hsl = {};
  background.getHSL(hsl);

  // 深色背景用淺灰藍輪廓；亮色背景改用深色輪廓。
  return hsl.l < 0.48
    ? new THREE.Color('#d6deea')
    : new THREE.Color('#111318');
}

function createSilhouetteMaterial(color, thickness, opacity) {
  return new THREE.ShaderMaterial({
    uniforms: {
      outlineColor: { value: color },
      outlineThickness: { value: thickness },
      outlineOpacity: { value: opacity }
    },
    vertexShader: `
      uniform float outlineThickness;

      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vec3 mvNormal = normalize(normalMatrix * normal);

        // 以視點空間法線向外擴張，形成穩定的反面外殼輪廓。
        mvPosition.xyz += mvNormal * outlineThickness;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 outlineColor;
      uniform float outlineOpacity;

      void main() {
        gl_FragColor = vec4(outlineColor, outlineOpacity);
      }
    `,
    side: THREE.BackSide,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    toneMapped: false
  });
}

function cacheMaterialVariants(object) {
  let looksTextured = false;
  const clayColor = new THREE.Color(
    work?.clayColor ||
    siteConfig.defaultClayColor ||
    '#8793a6'
  );

  const meshes = [];
  object.traverse((child) => {
    if (child.isMesh && !child.userData?.__viewerHelper) meshes.push(child);
  });

  for (const child of meshes) {
    if (!child.geometry.getAttribute('normal')) child.geometry.computeVertexNormals();

    child.castShadow = true;
    child.receiveShadow = true;
    child.userData.__viewerOriginalMaterial = child.material;

    const originals = materialArray(child.material);
    if (child.geometry.getAttribute('color')) looksTextured = true;
    if (originals.some((material) => hasTexture(material) || materialHasUsefulColor(material))) {
      looksTextured = true;
    }

    const makeClay = () => new THREE.MeshStandardMaterial({
      color: clayColor,
      metalness: 0.02,
      roughness: 0.72,
      side: THREE.DoubleSide
    });
    const makeNormal = () => new THREE.MeshNormalMaterial({
      side: THREE.DoubleSide,
      flatShading: false
    });

    child.userData.__viewerClayMaterial = Array.isArray(child.material)
      ? child.material.map(makeClay)
      : makeClay();

    child.userData.__viewerNormalMaterial = Array.isArray(child.material)
      ? child.material.map(makeNormal)
      : makeNormal();

    for (const material of originals) {
      if (!material) continue;
      if ('envMapIntensity' in material) material.envMapIntensity = 0.75;
      material.needsUpdate = true;
    }
  }

  return looksTextured;
}

function nextPaint() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

async function prepareOutlineOverlays() {
  if (!activeModel || outlinesPrepared) return;
  if (outlinePreparationPromise) return outlinePreparationPromise;

  outlinePreparationPromise = (async () => {
    const edgeColor = new THREE.Color(
      work?.edgeColor ||
      siteConfig.defaultEdgeColor ||
      '#111318'
    );
    const edgeThreshold = Number(
      work?.edgeThreshold ??
      siteConfig.defaultEdgeThreshold ??
      32
    );
    const backgroundValue =
      work?.backgroundColor ||
      siteConfig.defaultBackgroundColor ||
      '#0d1017';
    const outlineColor = new THREE.Color(
      work?.outlineColor ||
      siteConfig.defaultOutlineColor ||
      getContrastingOutlineColor(backgroundValue)
    );
    const outlineThickness = Number(
      work?.outlineThickness ??
      siteConfig.defaultOutlineThickness ??
      0.018
    );
    const outlineOpacity = Number(
      work?.outlineOpacity ??
      siteConfig.defaultOutlineOpacity ??
      0.86
    );
    const maxFeatureEdgeTriangles = Number(
      work?.maxFeatureEdgeTriangles ??
      siteConfig.maxFeatureEdgeTriangles ??
      1200000
    );
    const allowFeatureEdges =
      work?.featureEdges !== false &&
      activeTriangleCount <= maxFeatureEdgeTriangles;

    const meshes = [];
    activeModel.traverse((child) => {
      if (child.isMesh && !child.userData?.__viewerHelper) meshes.push(child);
    });

    wireframeButton.disabled = true;
    setStatus(
      allowFeatureEdges ? '建立輪廓與稜線中…' : '建立外輪廓中…',
      'loading',
      allowFeatureEdges
        ? '首次使用需要分析模型表面，完成後會保留結果'
        : '高面數模型使用輕量外輪廓'
    );

    await nextPaint();

    for (let index = 0; index < meshes.length; index += 1) {
      const child = meshes[index];

      if (!child.isSkinnedMesh && !child.userData.__viewerOutlineOverlay) {
        const outlineMaterial = createSilhouetteMaterial(
          outlineColor,
          outlineThickness,
          outlineOpacity
        );
        const outlineOverlay = new THREE.Mesh(child.geometry, outlineMaterial);
        outlineOverlay.name = '__viewerSilhouetteOutline';
        outlineOverlay.visible = wireframeEnabled;
        outlineOverlay.renderOrder = 998;
        outlineOverlay.frustumCulled = false;
        outlineOverlay.raycast = () => {};
        outlineOverlay.userData.__viewerHelper = true;
        outlineOverlay.userData.__viewerSharesGeometry = true;
        child.add(outlineOverlay);
        child.userData.__viewerOutlineOverlay = outlineOverlay;
      }

      if (allowFeatureEdges && !child.userData.__viewerWireframeOverlay) {
        const edgeGeometry = new THREE.EdgesGeometry(child.geometry, edgeThreshold);
        const edgeMaterial = new THREE.LineBasicMaterial({
          color: edgeColor,
          transparent: true,
          opacity: 0.84,
          depthTest: true,
          depthWrite: false
        });
        const edgeOverlay = new THREE.LineSegments(edgeGeometry, edgeMaterial);
        edgeOverlay.name = '__viewerFeatureEdges';
        edgeOverlay.visible = wireframeEnabled;
        edgeOverlay.renderOrder = 999;
        edgeOverlay.frustumCulled = false;
        edgeOverlay.raycast = () => {};
        edgeOverlay.userData.__viewerHelper = true;
        edgeOverlay.userData.__viewerSharesGeometry = false;
        child.add(edgeOverlay);
        child.userData.__viewerWireframeOverlay = edgeOverlay;
      }

      if (meshes.length > 1) {
        setStatus(
          allowFeatureEdges ? '建立輪廓與稜線中…' : '建立外輪廓中…',
          'loading',
          `${index + 1} / ${meshes.length} 個網格`
        );
        await nextPaint();
      }
    }

    outlinesPrepared = true;
    setFeatureEdgeVisibility();
    setStatus('載入完成', 'ready');
  })();

  try {
    await outlinePreparationPromise;
  } finally {
    wireframeButton.disabled = false;
    outlinePreparationPromise = null;
  }
}

function setFeatureEdgeVisibility() {
  activeModel?.traverse((child) => {
    const edgeOverlay = child.userData?.__viewerWireframeOverlay;
    const outlineOverlay = child.userData?.__viewerOutlineOverlay;
    if (edgeOverlay) edgeOverlay.visible = wireframeEnabled;
    if (outlineOverlay) outlineOverlay.visible = wireframeEnabled;
  });
}

function setMaterialMode(mode) {
  if (!activeModel || !MODE_LABELS[mode]) return;
  activeMaterialMode = mode;

  activeModel.traverse((child) => {
    if (child.userData?.__viewerHelper) return;
    if (!child.isMesh) return;
    if (mode === 'clay') child.material = child.userData.__viewerClayMaterial;
    else if (mode === 'normal') child.material = child.userData.__viewerNormalMaterial;
    else child.material = child.userData.__viewerOriginalMaterial;
  });

  setFeatureEdgeVisibility();
  displayModeEl.textContent = MODE_LABELS[mode];
  modeOriginalButton.setAttribute('aria-pressed', String(mode === 'original'));
  modeClayButton.setAttribute('aria-pressed', String(mode === 'clay'));
  modeNormalButton.setAttribute('aria-pressed', String(mode === 'normal'));
}

function chooseInitialMaterialMode() {
  const requested = String(work?.materialMode || 'auto').toLowerCase();
  if (['original', 'clay', 'normal'].includes(requested)) return requested;
  return activeModelLooksTextured ? 'original' : 'clay';
}

function fitCamera(box) {
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const radius = Math.max(sphere.radius, 0.25);
  const fov = THREE.MathUtils.degToRad(camera.fov);
  const distance = radius / Math.sin(fov / 2) * 1.08;

  controls.target.copy(sphere.center);
  camera.position.copy(sphere.center).add(new THREE.Vector3(distance * 0.72, distance * 0.42, distance));
  camera.near = Math.max(distance / 500, 0.005);
  camera.far = Math.max(distance * 80, 100);
  camera.updateProjectionMatrix();
  controls.update();

  initialView = {
    position: camera.position.clone(),
    target: controls.target.clone(),
    near: camera.near,
    far: camera.far
  };
}

function showModel(object, label, animations = []) {
  clearModel();
  activeModel = object;
  activeModelLooksTextured = cacheMaterialVariants(activeModel);

  const box = normalizeModel(activeModel);
  scene.add(activeModel);
  const statistics = updateStatistics(activeModel);
  activeTriangleCount = statistics.triangles;
  fitCamera(box);

  if (animations.length) {
    activeMixer = new THREE.AnimationMixer(activeModel);
    for (const clip of animations) activeMixer.clipAction(clip).play();
  }

  setMaterialMode(chooseInitialMaterialMode());
  modelNameEl.textContent = label;
  emptyState.hidden = true;
  setProgress(100, false);
  setStatus('載入完成', 'ready');
  requestAnimationFrame(() => requestAnimationFrame(hideLoadingCover));
}

function genericMaterial(geometry) {
  const hasColor = Boolean(geometry.getAttribute('color'));
  return new THREE.MeshStandardMaterial({
    color: hasColor ? 0xffffff : new THREE.Color(siteConfig.defaultClayColor || '#8793a6'),
    vertexColors: hasColor,
    metalness: 0.02,
    roughness: 0.72,
    side: THREE.DoubleSide
  });
}

function loadWith(loader, url, transform) {
  return new Promise((resolve, reject) => {
    loader.load(url, (result) => {
      try { resolve(transform ? transform(result) : result); }
      catch (error) { reject(error); }
    }, updateProgress, reject);
  });
}

async function resourceExists(path) {
  try {
    const response = await fetch(absoluteUrl(path), { method: 'HEAD', cache: 'no-cache' });
    return response.ok;
  } catch {
    return false;
  }
}

function directoryOf(url) {
  return url.slice(0, Math.max(0, url.lastIndexOf('/') + 1));
}

async function loadGLB(url) {
  const gltf = await loadWith(gltfLoader, url);
  return { object: gltf.scene, animations: gltf.animations || [] };
}

async function loadOBJ(url) {
  const objLoader = new OBJLoader();
  const mtlUrl = url.replace(/\.obj(?:\?.*)?$/i, '.mtl');
  try {
    const head = await fetch(mtlUrl, { method: 'HEAD', cache: 'no-cache' });
    if (head.ok) {
      const materials = await loadWith(
        new MTLLoader().setResourcePath(directoryOf(url)),
        mtlUrl,
        (materialCreator) => {
          materialCreator.preload();
          return materialCreator;
        }
      );
      objLoader.setMaterials(materials);
    }
  } catch {
    // 沒有 MTL 時仍可載入 OBJ。
  }
  return { object: await loadWith(objLoader, url), animations: [] };
}

async function loadSTL(url) {
  const geometry = await loadWith(new STLLoader(), url);
  if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();
  return { object: new THREE.Mesh(geometry, genericMaterial(geometry)), animations: [] };
}

async function loadPLY(url) {
  const geometry = await loadWith(new PLYLoader(), url);
  if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();
  return { object: new THREE.Mesh(geometry, genericMaterial(geometry)), animations: [] };
}

async function loadModel(url, label = url.split('/').pop() || url) {
  const cleanUrl = url.split('?')[0].split('#')[0];
  const extension = cleanUrl.split('.').pop()?.toLowerCase();
  showLoadingCover();
  setStatus(`下載 ${label}…`, 'loading', '正在取得模型資料');
  setProgress(4, true);

  let result;
  if (extension === 'glb') result = await loadGLB(url);
  else if (extension === 'obj') result = await loadOBJ(url);
  else if (extension === 'stl') result = await loadSTL(url);
  else if (extension === 'ply') result = await loadPLY(url);
  else throw new Error(`不支援的格式：.${extension || '?'}`);

  setStatus('建立 3D 場景中…', 'loading', '模型已下載，正在準備材質與鏡頭');
  setProgress(96, true);
  await nextPaint();
  showModel(result.object, label, result.animations);
}

function modelCandidates(targetWork) {
  if (targetWork.model) return [targetWork.model];
  const base = targetWork.legacyBase || `works/${targetWork.id}`;
  const prefix = targetWork.legacyBase ? `${base}/models/model` : `${base}/model`;
  return MODEL_EXTENSIONS.map((ext) => `${prefix}${ext}`);
}

function imageCandidates(targetWork) {
  if (targetWork.image) return [targetWork.image];
  const base = targetWork.legacyBase || `works/${targetWork.id}`;
  const prefix = targetWork.legacyBase ? `${base}/images/original` : `${base}/original`;
  return IMAGE_EXTENSIONS.map((ext) => `${prefix}${ext}`);
}

async function resolveFirstExisting(candidates) {
  if (candidates.length === 1) return candidates[0];
  for (const candidate of candidates) {
    setStatus(`尋找 ${candidate.split('/').pop()}…`, 'loading');
    if (await resourceExists(candidate)) return candidate;
  }
  return null;
}

async function loadOriginalImage() {
  const candidates = imageCandidates(work);
  let index = 0;

  await new Promise((resolve) => {
    const tryNext = () => {
      if (index >= candidates.length) {
        sourceImageEl.hidden = true;
        sourceEmptyEl.hidden = false;
        sourceFilenameEl.textContent = '尚未放入原圖';
        resolve();
        return;
      }

      const path = candidates[index++];
      const imageUrl = absoluteUrl(path);

      sourceImageEl.onload = () => {
        sourceImageEl.hidden = false;
        sourceEmptyEl.hidden = true;
        sourceFilenameEl.textContent = path.split('/').pop() || path;

        if (loadingCoverImage) {
          loadingCoverImage.src = imageUrl;
          loadingCoverImage.hidden = false;
        }
        resolve();
      };
      sourceImageEl.onerror = tryNext;
      sourceImageEl.src = imageUrl;
    };
    tryNext();
  });
}

async function loadWorksData() {
  const response = await fetch(absoluteUrl('works.json'), { cache: 'no-cache' });
  if (!response.ok) throw new Error(`無法讀取 works.json：HTTP ${response.status}`);
  return response.json();
}

function applyWorkPresentation() {
  const background = work.backgroundColor || siteConfig.defaultBackgroundColor || '#0d1017';
  const accent = work.accentColor || '#9d78ff';

  document.documentElement.style.setProperty('--bg', background);
  document.documentElement.style.setProperty('--accent', accent);
  scene.background = new THREE.Color(background);

  document.title = `${work.title}｜3D 模型展示`;
  titleEl.textContent = work.title;
  subtitleEl.textContent = work.description || '滑鼠拖曳旋轉｜滾輪縮放｜右鍵平移';
  sourceTitleEl.textContent = `${work.title}原始參考圖`;
  sourceDescriptionEl.textContent = work.sourceDescription || `用來生成「${work.title}」3D 模型的原始圖片。`;
  sourceImageEl.alt = `${work.title}的原始參考圖`;
  if (loadingCoverImage) loadingCoverImage.alt = `${work.title}載入預覽`;
  if (loadingDetailEl) loadingDetailEl.textContent = work.description || '正在準備互動式 3D 模型';

  controls.autoRotate = work.autoRotate !== false &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  controls.autoRotateSpeed = Number(work.autoRotateSpeed || 0.85);
  grid.visible = work.showGrid !== false;
  shadowPlane.visible = work.showShadow !== false;
  rotateButton.setAttribute('aria-pressed', String(controls.autoRotate));
  gridButton.setAttribute('aria-pressed', String(grid.visible));
}

async function boot() {
  showLoadingCover();
  setStatus('讀取作品設定中…', 'loading', '正在準備檢視器');

  try {
    const data = await loadWorksData();
    siteConfig = data.site || {};
    const workId = new URLSearchParams(window.location.search).get('id');
    if (!workId) throw new Error('網址缺少作品 id。');

    work = (data.works || []).find((item) => item.id === workId);
    if (!work) throw new Error(`找不到作品：${workId}`);

    applyWorkPresentation();
    loadOriginalImage();

    const modelPath = await resolveFirstExisting(modelCandidates(work));
    if (!modelPath) {
      setProgress(0, false);
      setStatus('未找到模型', 'error');
      emptyState.hidden = false;
      return;
    }

    await loadModel(absoluteUrl(modelPath), modelPath.split('/').pop());
  } catch (error) {
    console.error(error);
    setProgress(0, false);
    setStatus('作品載入失敗', 'error', String(error?.message || error));
    hideLoadingCover();
    emptyState.hidden = false;
    emptyState.querySelector('h2').textContent = '作品載入失敗';
    emptyState.querySelector('p').textContent = String(error?.message || error);
  }
}

function resetView() {
  if (!initialView) return;
  camera.position.copy(initialView.position);
  controls.target.copy(initialView.target);
  camera.near = initialView.near;
  camera.far = initialView.far;
  camera.updateProjectionMatrix();
  controls.update();
}

async function toggleWireframe() {
  if (!activeModel || wireframeButton.disabled) return;

  wireframeEnabled = !wireframeEnabled;
  wireframeButton.setAttribute('aria-pressed', String(wireframeEnabled));

  if (wireframeEnabled && !outlinesPrepared) {
    await prepareOutlineOverlays();
  } else {
    setFeatureEdgeVisibility();
  }
}

function openLocalPicker() {
  fileInput.click();
}

async function loadLocalFile(file) {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (!['glb', 'obj', 'stl', 'ply'].includes(extension)) {
    setStatus('不支援這個格式', 'error');
    return;
  }

  const objectUrl = URL.createObjectURL(file);
  const previousWork = work;
  work = {
    ...(work || {}),
    title: file.name,
    materialMode: 'auto',
    clayColor: siteConfig.defaultClayColor || '#8793a6'
  };

  try {
    await loadModel(objectUrl, file.name);
  } catch (error) {
    console.error(error);
    setProgress(0, false);
    setStatus('本機模型載入失敗', 'error');
  } finally {
    work = previousWork;
    URL.revokeObjectURL(objectUrl);
    fileInput.value = '';
  }
}

modeOriginalButton.addEventListener('click', () => setMaterialMode('original'));
modeClayButton.addEventListener('click', () => setMaterialMode('clay'));
modeNormalButton.addEventListener('click', () => setMaterialMode('normal'));

rotateButton.addEventListener('click', () => {
  controls.autoRotate = !controls.autoRotate;
  rotateButton.setAttribute('aria-pressed', String(controls.autoRotate));
});
gridButton.addEventListener('click', () => {
  grid.visible = !grid.visible;
  gridButton.setAttribute('aria-pressed', String(grid.visible));
});
wireframeButton.addEventListener('click', toggleWireframe);
resetButton.addEventListener('click', resetView);
localButton.addEventListener('click', openLocalPicker);
emptyOpenLocalButton.addEventListener('click', openLocalPicker);
fileInput.addEventListener('change', () => fileInput.files?.[0] && loadLocalFile(fileInput.files[0]));
sourceButton.addEventListener('click', () => sourceSection.scrollIntoView({ behavior: 'smooth', block: 'start' }));
backToModelButton.addEventListener('click', () => viewerSection.scrollIntoView({ behavior: 'smooth', block: 'start' }));
fullscreenButton.addEventListener('click', async () => {
  if (!document.fullscreenElement) await viewerSection.requestFullscreen?.();
  else await document.exitFullscreen?.();
});

let dragDepth = 0;
window.addEventListener('dragenter', (event) => {
  event.preventDefault();
  dragDepth += 1;
  dropHint.classList.add('visible');
});
window.addEventListener('dragover', (event) => event.preventDefault());
window.addEventListener('dragleave', (event) => {
  event.preventDefault();
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) dropHint.classList.remove('visible');
});
window.addEventListener('drop', (event) => {
  event.preventDefault();
  dragDepth = 0;
  dropHint.classList.remove('visible');
  const file = event.dataTransfer?.files?.[0];
  if (file) loadLocalFile(file);
});

function resize() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (
    canvas.width === Math.floor(width * renderer.getPixelRatio()) &&
    canvas.height === Math.floor(height * renderer.getPixelRatio())
  ) return;

  renderer.setSize(width, height, false);
  camera.aspect = width / Math.max(height, 1);
  camera.updateProjectionMatrix();
}

function animate() {
  requestAnimationFrame(animate);
  resize();
  const delta = clock.getDelta();
  activeMixer?.update(delta);
  controls.update();
  renderer.render(scene, camera);
}

animate();
boot();
