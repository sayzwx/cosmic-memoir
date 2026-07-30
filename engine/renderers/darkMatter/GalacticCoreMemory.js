import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { MemoryCarrier, loadCarrierTexture } from './MemoryCarrier.js';
import { createSpiralGalaxy } from './SpiralGalaxy.js';

const clamp01 = value => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const FIELD_VERTEX = `
  uniform float uTime;
  uniform float uPassage;
  uniform float uMotion;
  varying vec2 vUv;
  varying float vEdgeWarp;
  void main() {
    vUv = uv;
    vec3 p = position;
    float x = uv.x * 2.0 - 1.0;
    float y = uv.y * 2.0 - 1.0;
    float wave = sin(y * 5.4 + uTime * 0.22) * 0.035 * uMotion;
    p.z += (x * x * 0.48 + wave) * (1.0 + uPassage * 1.8);
    p.x += sin(y * 7.0 + x * 2.0) * 0.035 * uMotion;
    vEdgeWarp = wave;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const FIELD_FRAGMENT = `
  uniform sampler2D uMap;
  uniform float uReveal;
  uniform float uIntensity;
  uniform float uFocus;
  uniform float uPassage;
  uniform float uTime;
  varying vec2 vUv;
  varying float vEdgeWarp;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main() {
    vec2 q = vUv - 0.5;
    float r = length(q * vec2(1.0, 1.18));
    float lens = (0.018 + uPassage * 0.025) * (1.0 - smoothstep(0.0, 0.54, r));
    vec2 uv = 0.5 + q * (1.0 - lens) + normalize(q + 0.0001) * sin(r * 22.0 - uTime * 0.3) * 0.002;
    vec4 photo = texture2D(uMap, uv);
    float noise = hash(floor(vUv * 22.0)) * 0.035 + sin(vUv.y * 19.0 + vUv.x * 8.0) * 0.018;
    float irregular = 1.0 - smoothstep(0.39 + noise + vEdgeWarp, 0.51 + noise, r);
    float sweep = smoothstep(0.05, 0.82, uReveal + 0.15 - r * 0.72 + sin(vUv.y * 13.0) * 0.025);
    float centerBlend = smoothstep(0.03, 0.23, r);
    vec3 tint = vec3(0.54, 0.43, 0.78) * (1.0 - centerBlend) + vec3(0.96, 0.75, 0.38) * 0.10;
    vec3 color = mix(tint, photo.rgb, 0.62 + uReveal * 0.34);
    float halo = (1.0 - smoothstep(0.34, 0.56, r)) * (1.0 - irregular) * 0.13;
    float alpha = irregular * sweep * photo.a * uIntensity * (0.55 + uFocus * 0.12) + halo * uIntensity;
    if (alpha < 0.006) discard;
    gl_FragColor = vec4(color, min(alpha, 0.82));
  }
`;

function fallbackTexture() {
  const pixels = new Uint8Array([
    18, 12, 42, 255, 75, 49, 112, 255,
    116, 76, 72, 255, 30, 25, 67, 255
  ]);
  const texture = new THREE.DataTexture(pixels, 2, 2, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function vector3(value, fallback) {
  return Array.isArray(value) && value.length >= 3 ? value : fallback;
}

export class GalacticCoreMemory extends MemoryCarrier {
  constructor(data = {}, options = {}) {
    super({ ...data, carrier: 'galacticCore' }, { ...options, carrierType: 'galacticCore' });
    this._time = 0;
    this._passage = 0;
    this._passageTarget = 0;
    this._visualIntensity = 0.2 + this.discoveryProgress * 0.8;
    this._cameraWorld = new THREE.Vector3();
    this._cameraLocal = new THREE.Vector3();
    this._forwardWorld = new THREE.Vector3();
    this._forwardLocal = new THREE.Vector3();
    this._coreWorld = new THREE.Vector3();
    this._toCore = new THREE.Vector3();
    this._inverseWorld = new THREE.Matrix4();
    this._fieldHome = new THREE.Vector3();
    this._fieldPassage = new THREE.Vector3();

    if (!Array.isArray(data.position)) {
      this.position.fromArray(vector3(options.position, [0, 0, -18]));
    }
    const sourceSize = Array.isArray(data.size) ? data.size : [3.4, 2.25];
    const requestedRadius = Number(data.galaxyRadius ?? options.radius ?? sourceSize[0] * 5.6);
    this.radius = THREE.MathUtils.clamp(Number.isFinite(requestedRadius) ? requestedRadius : 20, 16, 24);
    this.drawCalls = 2;

    this.galaxy = createSpiralGalaxy({
      radius: this.radius, position: [0, 0, 0], capacity: options.capacity,
      quality: this.quality, mobile: options.mobile, seed: options.seed ?? data.seed,
      inclination: options.inclination ?? -0.72, yaw: options.yaw ?? -0.12,
      roll: options.roll ?? -0.2, rotationSpeed: options.rotationSpeed ?? 0.012,
      intensity: 0.5, coreIntensity: 0.7
    });
    this.add(this.galaxy.object3D);

    this.texture = fallbackTexture();
    this.uniforms = {
      uMap: { value: this.texture }, uReveal: { value: this._visualIntensity },
      uIntensity: { value: this._visualIntensity }, uFocus: { value: 0 },
      uPassage: { value: 0 }, uTime: { value: 0 }, uMotion: { value: this.reducedMotion ? 0 : 1 }
    };
    const segments = this.quality === 'low' ? 8 : (this.quality === 'medium' ? 14 : 22);
    this.fieldGeometry = new THREE.PlaneGeometry(sourceSize[0] * 1.45, sourceSize[1] * 1.45, segments, segments);
    this.fieldMaterial = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: FIELD_VERTEX, fragmentShader: FIELD_FRAGMENT,
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending
    });
    this.memoryField = new THREE.Mesh(this.fieldGeometry, this.fieldMaterial);
    this._fieldHome.set(0, this.radius * 0.025, this.radius * 0.035);
    this.memoryField.position.copy(this._fieldHome);
    this.memoryField.renderOrder = options.renderOrder ?? 2;
    this.add(this.memoryField);

    this.hitGeometry = new THREE.SphereGeometry(this.radius * 0.3, 10, 6);
    this.hitMaterial = new THREE.MeshBasicMaterial({ visible: false });
    this.hitProxy = new THREE.Mesh(this.hitGeometry, this.hitMaterial);
    this.hitProxy.userData.memoryCarrier = this;
    this.add(this.hitProxy);
    this.hitTargets.push(this.hitProxy);
    this.ready = this._loadTexture(data.src);
    this.setDiscoveryProgress(this.discoveryProgress);
  }

  async _loadTexture(src) {
    const fallback = this.texture;
    const result = await loadCarrierTexture(src, { fallback, anisotropy: this.quality === 'high' ? 4 : 1 });
    if (this.disposed) {
      if (result.texture && result.texture !== fallback) result.texture.dispose();
      return { ...result, texture: null };
    }
    if (result.texture && result.texture !== fallback) {
      this.texture = result.texture;
      this.uniforms.uMap.value = result.texture;
      fallback.dispose();
    }
    if (result.error && typeof this.data.onTextureError === 'function') this.data.onTextureError(result.error, this);
    return result;
  }

  getDiscoverySample(context = {}) {
    let alignment = Number.isFinite(context.alignment) ? clamp01(context.alignment) : 0;
    let distance = Number.isFinite(context.distance) ? Math.max(0, context.distance) : Infinity;
    const camera = context.camera;
    if (camera?.getWorldDirection && camera?.getWorldPosition) {
      camera.getWorldDirection(this._forwardWorld);
      camera.getWorldPosition(this._cameraLocal);
      this.getWorldPosition(this._coreWorld);
      this._toCore.copy(this._coreWorld).sub(this._cameraLocal);
      distance = this._toCore.length();
      if (distance > 0.0001) alignment = clamp01((this._forwardWorld.dot(this._toCore.divideScalar(distance)) - 0.9) / 0.1);
    }
    const proximity = Number.isFinite(context.proximity)
      ? clamp01(context.proximity) : (Number.isFinite(distance) ? clamp01(1 - distance / (this.radius * 4)) : 0);
    const aimed = typeof context.aimed === 'boolean' ? context.aimed : alignment > 0.35;
    const revealed = this.discoveryProgress >= 1 || this.visited;
    return {
      type: 'gaze', interaction: 'gaze', active: aimed && this.unlocked !== false,
      aimed, alignment, proximity, distance: Number.isFinite(distance) ? distance : null,
      requiredSeconds: 2, duration: 2, canCapture: revealed, revealed
    };
  }

  setDiscoveryProgress(progress = 0) {
    super.setDiscoveryProgress(progress);
    const reveal = 0.2 + this.discoveryProgress * 0.8;
    this._targetIntensity = reveal;
    if (this.uniforms) this.uniforms.uReveal.value = reveal;
    return this;
  }

  setVisited(visited = true) {
    super.setVisited(visited);
    if (this.visited) this.setDiscoveryProgress(1);
    return this;
  }

  setFocused(focused = true) {
    super.setFocused(focused);
    if (this.uniforms) this.uniforms.uFocus.value = this.focused ? 1 : 0;
    return this;
  }

  setQuality(quality = 'high', mobile = false) {
    super.setQuality(quality);
    this.galaxy?.setQuality(quality, mobile);
    if (this.texture) {
      this.texture.anisotropy = quality === 'high' ? 4 : 1;
      this.texture.needsUpdate = true;
    }
    return this;
  }

  setReducedMotion(reduced = true) {
    super.setReducedMotion(reduced);
    if (this.uniforms) this.uniforms.uMotion.value = this.reducedMotion ? 0 : 1;
    return this;
  }

  enterPassage() { this._passageTarget = 1; return this; }
  exitPassage() { this._passageTarget = 0; return this; }
  setPassageProgress(progress = 0) { this._passageTarget = clamp01(progress); return this; }

  update(delta = 0, context = {}) {
    if (this.disposed) return;
    const camera = context.camera;
    const elapsed = context.elapsed;
    const dt = Math.min(0.1, Math.max(0, Number(delta) || 0));
    this._time = Number.isFinite(elapsed)
      ? (this.reducedMotion ? 0 : elapsed)
      : this._time + (this.reducedMotion ? 0 : dt);
    const response = this.reducedMotion ? 1 : 1 - Math.exp(-dt * 3.2);
    this._passage += (this._passageTarget - this._passage) * response;
    this._visualIntensity += ((this._targetIntensity ?? 0.2) - this._visualIntensity) * (1 - Math.exp(-dt * 5));
    this.uniforms.uTime.value = this._time;
    this.uniforms.uIntensity.value = Math.min(1, this._visualIntensity + (this.focused ? 0.08 : 0));
    this.uniforms.uPassage.value = this._passage;
    this.galaxy.setIntensity(0.46 + this.discoveryProgress * 0.22, 0.64 + this.discoveryProgress * 0.5 + (this.focused ? 0.08 : 0));
    this.galaxy.setPassage(this._passage);
    this.galaxy.object3D.scale.setScalar(1 + this._passage * 1.65);
    this.memoryField.scale.setScalar(1 + this._passage * 2.7);
    this.galaxy.update(this.reducedMotion ? 0 : dt);

    if (camera) {
      camera.getWorldPosition(this._cameraWorld);
      this._cameraLocal.copy(this._cameraWorld);
      this.worldToLocal(this._cameraLocal);
      camera.getWorldDirection(this._forwardWorld);
      this._inverseWorld.copy(this.matrixWorld).invert();
      this._forwardLocal.copy(this._forwardWorld).transformDirection(this._inverseWorld);
      const targetX = this._cameraLocal.x + this._forwardLocal.x * 3;
      const targetY = this._cameraLocal.y + this._forwardLocal.y * 3;
      const targetZ = this._cameraLocal.z + this._forwardLocal.z * 3;
      this.galaxy.object3D.position.set(targetX * this._passage, targetY * this._passage, targetZ * this._passage);
      this._fieldPassage.set(targetX, targetY, targetZ);
      this.memoryField.position.lerpVectors(this._fieldHome, this._fieldPassage, this._passage);
      this.memoryField.lookAt(this._cameraWorld);
    }
  }

  dispose() {
    if (this.disposed) return;
    const galaxy = this.galaxy;
    if (galaxy?.object3D?.parent) galaxy.object3D.parent.remove(galaxy.object3D);
    galaxy?.dispose();
    this.texture?.dispose();
    this.texture = null;
    this.galaxy = null;
    super.dispose();
    this.uniforms = null;
  }
}
