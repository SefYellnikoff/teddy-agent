<template>
  <div class="teddy-face">
    <div ref="canvasHost" class="canvas-host"></div>
    <p class="status-text">{{ stateLabel }}</p>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import * as THREE from 'three';

const props = defineProps({
  state: {
    type: String,
    default: 'idle',
    validator: (value) => ['idle', 'listening', 'speaking'].includes(value),
  },
});

const canvasHost = ref(null);

const stateLabel = computed(() => {
  if (props.state === 'listening') return 'Listening...';
  if (props.state === 'speaking') return 'Teddy is speaking...';
  return 'Ready to chat';
});

let renderer = null;
let scene = null;
let camera = null;
let animationFrame = null;
let resizeRaf = null;
let clock = null;

let teddyRoot = null;
let head = null;
let torso = null;
let leftEar = null;
let rightEar = null;
let muzzle = null;
let mouth = null;
let glowRing = null;
const bbox = new THREE.Box3();
const bboxSize = new THREE.Vector3();
const bboxCenter = new THREE.Vector3();

const meshes = [];

const createMesh = (geometry, material, position = [0, 0, 0], parent = null) => {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(position[0], position[1], position[2]);
  (parent || scene).add(mesh);
  meshes.push(mesh);
  return mesh;
};

const buildTeddy = () => {
  teddyRoot = new THREE.Group();
  scene.add(teddyRoot);
  teddyRoot.scale.set(0.72, 0.72, 0.72);

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xa46b3f,
    roughness: 0.86,
    metalness: 0.04,
  });

  const innerEarMat = new THREE.MeshStandardMaterial({
    color: 0xdeaf8a,
    roughness: 0.88,
    metalness: 0.02,
  });

  const faceFeatureMat = new THREE.MeshBasicMaterial({
    color: 0x1e1713,
  });

  head = createMesh(new THREE.SphereGeometry(1.12, 64, 64), bodyMat, [0, 0.15, 0], teddyRoot);
  torso = createMesh(new THREE.SphereGeometry(1.05, 64, 64), bodyMat, [0, -1.15, -0.08], teddyRoot);
  torso.scale.set(1.05, 1.25, 0.95);

  leftEar = createMesh(new THREE.SphereGeometry(0.36, 48, 48), bodyMat, [-0.7, 0.95, -0.2], teddyRoot);
  rightEar = createMesh(new THREE.SphereGeometry(0.36, 48, 48), bodyMat, [0.7, 0.95, -0.2], teddyRoot);

  createMesh(new THREE.SphereGeometry(0.2, 32, 32), innerEarMat, [0, 0, 0.18], leftEar);
  createMesh(new THREE.SphereGeometry(0.2, 32, 32), innerEarMat, [0, 0, 0.18], rightEar);

  muzzle = createMesh(new THREE.SphereGeometry(0.5, 48, 48), innerEarMat, [0, -0.2, 0.97], teddyRoot);
  muzzle.scale.set(1.18, 0.82, 1.05);

  // Eyes and mouth must stay clearly in front of the face.
  createMesh(new THREE.SphereGeometry(0.11, 24, 24), faceFeatureMat, [-0.32, 0.16, 1.42], teddyRoot);
  createMesh(new THREE.SphereGeometry(0.11, 24, 24), faceFeatureMat, [0.32, 0.16, 1.42], teddyRoot);

  createMesh(new THREE.SphereGeometry(0.038, 16, 16), new THREE.MeshBasicMaterial({ color: 0xffffff }), [-0.29, 0.2, 1.5], teddyRoot);
  createMesh(new THREE.SphereGeometry(0.038, 16, 16), new THREE.MeshBasicMaterial({ color: 0xffffff }), [0.35, 0.2, 1.5], teddyRoot);

  createMesh(new THREE.SphereGeometry(0.11, 24, 24), faceFeatureMat, [0, -0.1, 1.5], teddyRoot);

  mouth = createMesh(new THREE.TorusGeometry(0.2, 0.03, 16, 42, Math.PI), faceFeatureMat, [0, -0.44, 1.48], teddyRoot);
  mouth.rotation.set(Math.PI / 2, 0, Math.PI);
  mouth.scale.set(1.05, 0.55, 1);

  const shoulderLeft = createMesh(new THREE.SphereGeometry(0.42, 32, 32), bodyMat, [-0.78, -0.7, -0.05], teddyRoot);
  shoulderLeft.scale.set(1, 0.9, 1.1);
  const shoulderRight = createMesh(new THREE.SphereGeometry(0.42, 32, 32), bodyMat, [0.78, -0.7, -0.05], teddyRoot);
  shoulderRight.scale.set(1, 0.9, 1.1);

  const leftArm = createMesh(new THREE.CapsuleGeometry(0.24, 0.62, 8, 24), bodyMat, [-1.02, -1.18, 0.12], teddyRoot);
  leftArm.rotation.z = 0.34;
  const rightArm = createMesh(new THREE.CapsuleGeometry(0.24, 0.62, 8, 24), bodyMat, [1.02, -1.18, 0.12], teddyRoot);
  rightArm.rotation.z = -0.34;

  const belly = createMesh(new THREE.SphereGeometry(0.65, 48, 48), innerEarMat, [0, -1.06, 0.56], teddyRoot);
  belly.scale.set(1, 1.12, 0.9);

  const leftLeg = createMesh(new THREE.SphereGeometry(0.42, 32, 32), bodyMat, [-0.48, -2.05, 0.25], teddyRoot);
  leftLeg.scale.set(1.05, 0.92, 1.15);
  const rightLeg = createMesh(new THREE.SphereGeometry(0.42, 32, 32), bodyMat, [0.48, -2.05, 0.25], teddyRoot);
  rightLeg.scale.set(1.05, 0.92, 1.15);

  createMesh(new THREE.SphereGeometry(0.2, 24, 24), innerEarMat, [0, -0.03, 0.24], leftLeg);
  createMesh(new THREE.SphereGeometry(0.2, 24, 24), innerEarMat, [0, -0.03, 0.24], rightLeg);

  glowRing = createMesh(
    new THREE.TorusGeometry(2, 0.03, 32, 180),
    new THREE.MeshBasicMaterial({ color: 0xffb865, transparent: true, opacity: 0.2 }),
    [0, -2.34, -0.35],
    teddyRoot,
  );
  glowRing.rotation.x = Math.PI / 2;
};

const setSize = () => {
  if (!canvasHost.value || !renderer || !camera) return;
  const width = Math.max(canvasHost.value.clientWidth, 1);
  const height = Math.max(canvasHost.value.clientHeight, 1);
  renderer.setSize(width, height, true);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
};

const fitCameraToTeddy = () => {
  if (!camera || !teddyRoot) return;
  // Refit camera every resize to keep full teddy visible.
  bbox.setFromObject(teddyRoot);
  bbox.getSize(bboxSize);
  bbox.getCenter(bboxCenter);

  const maxSize = Math.max(bboxSize.x, bboxSize.y, bboxSize.z);
  const fov = THREE.MathUtils.degToRad(camera.fov);
  const distance = (maxSize / (2 * Math.tan(fov / 2))) * 1.85;

  camera.position.set(bboxCenter.x, bboxCenter.y + bboxSize.y * 0.04, bboxCenter.z + distance);
  camera.lookAt(bboxCenter.x, bboxCenter.y - bboxSize.y * 0.05, bboxCenter.z);
  camera.near = 0.1;
  camera.far = distance * 6;
  camera.updateProjectionMatrix();
};

const handleResize = () => {
  if (resizeRaf) return;
  resizeRaf = requestAnimationFrame(() => {
    resizeRaf = null;
    setSize();
    fitCameraToTeddy();
  });
};

const animate = () => {
  animationFrame = requestAnimationFrame(animate);
  const t = clock.getElapsedTime();

  // Shared idle bob.
  const bob = Math.sin(t * 1.2) * 0.02;
  teddyRoot.position.y = bob;

  // State-driven micro animation keeps Teddy expressive without jitter.
  if (props.state === 'idle') {
    head.rotation.x = Math.sin(t * 1.1) * 0.05;
    head.rotation.y = Math.sin(t * 0.7) * 0.08;
    torso.rotation.y = Math.sin(t * 0.65) * 0.04;
    leftEar.rotation.z = Math.sin(t * 0.9) * 0.05;
    rightEar.rotation.z = -Math.sin(t * 0.9) * 0.05;
    mouth.scale.y = 0.55 + (Math.sin(t * 2.8) + 1) * 0.04;
    glowRing.material.opacity = 0.12;
  }

  if (props.state === 'listening') {
    head.rotation.x = 0.08 + Math.sin(t * 2.5) * 0.03;
    head.rotation.y = Math.sin(t * 1.6) * 0.2;
    torso.rotation.y = Math.sin(t * 1.6) * 0.08;
    leftEar.rotation.z = 0.2 + Math.sin(t * 3.4) * 0.1;
    rightEar.rotation.z = -0.2 - Math.sin(t * 3.4) * 0.1;
    mouth.scale.y = 0.5 + (Math.sin(t * 3.2) + 1) * 0.03;
    glowRing.material.opacity = 0.22 + (Math.sin(t * 4) + 1) * 0.12;
  }

  if (props.state === 'speaking') {
    head.rotation.x = Math.sin(t * 4.5) * 0.08;
    head.rotation.y = Math.sin(t * 3) * 0.1;
    torso.rotation.y = Math.sin(t * 3.2) * 0.06;
    leftEar.rotation.z = Math.sin(t * 4) * 0.07;
    rightEar.rotation.z = -Math.sin(t * 4) * 0.07;
    mouth.scale.y = 0.65 + (Math.sin(t * 14) + 1) * 0.55;
    muzzle.scale.y = 0.82 + Math.sin(t * 14) * 0.05;
    glowRing.material.opacity = 0.35 + (Math.sin(t * 8) + 1) * 0.18;
  } else {
    muzzle.scale.y = 0.82;
  }

  renderer.render(scene, camera);
};

const initScene = () => {
  scene = new THREE.Scene();
  scene.background = null;

  camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;

  canvasHost.value.appendChild(renderer.domElement);

  // Three-point-like setup: key + fill + rim.
  const keyLight = new THREE.DirectionalLight(0xfff7ee, 1.25);
  keyLight.position.set(3.2, 4.3, 4);
  keyLight.castShadow = true;
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xffd8ab, 0.6);
  fillLight.position.set(-3.5, 2.5, 2);
  scene.add(fillLight);

  const rimLight = new THREE.PointLight(0xff8f57, 0.7, 10);
  rimLight.position.set(0, 1.8, -2.6);
  scene.add(rimLight);

  scene.add(new THREE.AmbientLight(0xfde9d2, 0.9));

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(2.5, 64),
    new THREE.ShadowMaterial({ opacity: 0.25 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -2.45;
  floor.receiveShadow = true;
  scene.add(floor);

  buildTeddy();
  clock = new THREE.Clock();

  handleResize();
  animate();
  window.addEventListener('resize', handleResize);
};

watch(
  () => props.state,
  () => {
    if (!head || !torso || !leftEar || !rightEar || !mouth) return;
    if (props.state === 'idle') {
      head.rotation.set(0, 0, 0);
      torso.rotation.set(0, 0, 0);
      leftEar.rotation.set(0, 0, 0);
      rightEar.rotation.set(0, 0, 0);
      mouth.scale.set(1.15, 0.58, 1);
    }
  },
);

onMounted(() => {
  initScene();
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  if (resizeRaf) {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = null;
  }

  if (animationFrame) {
    cancelAnimationFrame(animationFrame);
    animationFrame = null;
  }

  if (scene) {
    meshes.forEach((mesh) => {
      mesh.geometry?.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((material) => material.dispose());
      } else {
        mesh.material?.dispose();
      }
    });
  }

  if (renderer) {
    renderer.dispose();
    const canvas = renderer.domElement;
    if (canvas && canvas.parentNode) {
      canvas.parentNode.removeChild(canvas);
    }
  }

  renderer = null;
  scene = null;
  camera = null;
  teddyRoot = null;
  head = null;
  torso = null;
  leftEar = null;
  rightEar = null;
  muzzle = null;
  mouth = null;
  glowRing = null;
  clock = null;
});
</script>

<style scoped>
.teddy-face {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  max-width: 340px;
  margin: 0 auto;
  position: relative;
  z-index: 0;
}

.canvas-host {
  width: 100%;
  max-width: 340px;
  aspect-ratio: 1 / 1;
  background: transparent;
  border: none;
  box-shadow: none;
  overflow: hidden;
}

.status-text {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: #6a3d1f;
  letter-spacing: 0.2px;
  text-align: center;
}

@media (max-width: 768px) {
  .teddy-face {
    max-width: 250px;
  }

  .canvas-host {
    max-width: 250px;
  }

  .status-text {
    font-size: 13px;
  }
}
</style>
