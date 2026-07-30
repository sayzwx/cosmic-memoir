import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { MemoryCarrier, MEMORY_CARRIER_STATES, loadCarrierTexture } from './MemoryCarrier.js';
import { createCosmicWeb } from './CosmicWeb.js';

const clamp01 = value => THREE.MathUtils.clamp(Number.isFinite(value) ? value : 0, 0, 1);
const smooth = value => { const t = clamp01(value); return t * t * (3 - 2 * t); };

const IMAGE_VERTEX = `
uniform float uTime, uReveal, uCapture, uRelease, uMotion;
varying vec2 vUv;
varying float vNoise;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
void main() {
  vUv = uv;
  vec3 p = position;
  float n = hash(floor(uv * 18.0)) * 2.0 - 1.0;
  float trapped = 1.0 - smoothstep(0.0, 0.9, uCapture);
  float released = smoothstep(0.0, 1.0, uRelease);
  p.xy *= mix(0.62, 1.0, smoothstep(0.0, 0.7, uReveal));
  p.z += trapped * uMotion * (1.0 - released) *
    ((sin(uv.x * 12.0 + uTime * 0.45) + cos(uv.y * 15.0 - uTime * 0.34)) * 0.16 + n * 0.12);
  p.z += (uCapture - uRelease) * 0.75;
  vNoise = n;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

const IMAGE_FRAGMENT = `
uniform sampler2D uMap;
uniform float uTime, uReveal, uCapture, uRelease, uOpacity;
varying vec2 vUv;
varying float vNoise;
float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3,289.1))) * 45758.5453); }
void main() {
  vec2 centered = vUv - 0.5;
  float angle = atan(centered.y, centered.x);
  float irregularity = sin(angle * 7.0 + 0.7) * 0.035 + sin(angle * 13.0 - 1.4) * 0.018;
  vec2 warpedUv = vUv + vec2(sin(vUv.y * 17.0 + uTime * 0.22),
    cos(vUv.x * 15.0 - uTime * 0.18)) * 0.012 * (1.0 - uCapture);
  vec4 image = texture2D(uMap, warpedUv);
  float radius = length(centered / vec2(0.72, 0.54));
  float mask = 1.0 - smoothstep(0.78 + irregularity, 1.0 + irregularity, radius);
  float front = 1.0 - smoothstep(0.04, 1.08,
    length(centered) + (1.0 - uReveal) * 0.82 + vNoise * 0.035);
  float particles = smoothstep(0.45, 0.94,
    hash(floor(vUv * mix(64.0, 150.0, uCapture)) + floor(uTime * 1.5)));
  float particulate = mix(0.4 + particles * 0.6, 1.0, smoothstep(0.35, 1.0, uCapture));
  float alpha = image.a * mask * front * particulate * uReveal * uOpacity
    * (1.0 - smoothstep(0.88, 1.0, uRelease));
  if (alpha < 0.008) discard;
  vec3 tint = mix(vec3(0.42,0.34,0.72), vec3(1.0,0.84,0.55), particles * 0.2);
  gl_FragColor = vec4(mix(image.rgb * tint, image.rgb, 0.72 + uCapture * 0.28), alpha);
}`;

const WAVE_VERTEX = `
varying vec3 vNormal, vView;
void main() {
  vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vView = normalize(-viewPosition.xyz);
  gl_Position = projectionMatrix * viewPosition;
}`;

const WAVE_FRAGMENT = `
uniform float uProgress, uOpacity;
varying vec3 vNormal, vView;
void main() {
  float fresnel = pow(1.0 - abs(dot(vNormal, vView)), 2.4);
  float band = smoothstep(0.08, 0.55, fresnel) * (1.0 - smoothstep(0.82, 1.0, fresnel));
  float fade = sin(3.14159265 * uProgress) * uOpacity;
  vec3 color = mix(vec3(0.25,0.18,0.62), vec3(1.0,0.72,0.28), fresnel);
  gl_FragColor = vec4(color, (fresnel * 0.34 + band * 0.4) * fade);
}`;

function fallbackTexture() {
  const texture = new THREE.DataTexture(new Uint8Array([
    37, 28, 66, 255, 115, 85, 125, 255,
    174, 133, 84, 255, 47, 58, 92, 255
  ]), 2, 2, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createNodes(count, seed) {
  const positions = new Float32Array(count * 3);
  let state = seed >>> 0;
  const random = () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
  for (let i = 0; i < count; i++) {
    const radius = Math.pow(random(), 0.62);
    const theta = random() * Math.PI * 2;
    const z = random() * 2 - 1;
    const radial = Math.sqrt(1 - z * z);
    positions[i * 3] = Math.cos(theta) * radial * radius * 4.2;
    positions[i * 3 + 1] = z * radius * 2.8;
    positions[i * 3 + 2] = Math.sin(theta) * radial * radius * 2.5;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0xf0c978, size: 0.105, sizeAttenuation: true, transparent: true,
    opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending
  });
  return new THREE.Points(geometry, material);
}

export class CosmicWebMemory extends MemoryCarrier {
  constructor(data = {}, options = {}) {
    super({ ...data, carrier: 'cosmicWeb' }, { ...options, carrierType: 'cosmicWeb' });
    this.carrierType = 'cosmicWeb';
    this.captureProgress = clamp01(options.captureProgress ?? (this.visited ? 1 : 0));
    this.releaseProgress = clamp01(options.releaseProgress);
    this.elapsed = 0;
    this.mobile = Boolean(options.mobile);
    this._ownsTexture = !options.texture;

    const capacity = Math.max(32, Math.floor(options.capacity ?? 900));
    const shared = {
      capacity, extent: options.extent || [9, 6, 5.5], position: [0, 0, 0], reveal: 0,
      opacity: options.webOpacity ?? 0.92, quality: this.quality, mobile: this.mobile,
      rotationSpeed: 0.012
    };
    this.goldWeb = createCosmicWeb({ ...shared, seed: options.seed ?? 4801, color: 0xd4aa62 });
    this.indigoWeb = createCosmicWeb({ ...shared, capacity: Math.ceil(capacity * 0.62),
      seed: (options.seed ?? 4801) + 31, color: 0x55408f, opacity: 0.74, rotationSpeed: -0.009 });
    this.add(this.goldWeb.object3D, this.indigoWeb.object3D);
    this.nodes = createNodes(Math.max(20, Math.ceil(capacity * 0.11)), (options.seed ?? 4801) + 79);
    this.add(this.nodes);
    this._createImage(options);
    this._createWave(options);
    this._createHitProxy(options);

    const source = data.image || data.src || data.url || data.textureUrl;
    this.ready = options.texture
      ? Promise.resolve({ texture: options.texture, fallback: false })
      : this._loadTexture(source, options);
    this.setQuality(this.quality, this.mobile);
    this.setReducedMotion(this.reducedMotion);
    this._syncVisuals();
  }

  _createImage(options) {
    const size = this.data.size || options.imageSize || [4.8, 3.35];
    this.texture = options.texture || fallbackTexture();
    this.imageUniforms = {
      uMap: { value: this.texture }, uTime: { value: 0 }, uReveal: { value: 0 },
      uCapture: { value: this.captureProgress }, uRelease: { value: this.releaseProgress },
      uMotion: { value: this.reducedMotion ? 0 : 1 }, uOpacity: { value: options.imageOpacity ?? 0.92 }
    };
    this.imageGeometry = new THREE.PlaneGeometry(size[0], size[1], 18, 14);
    this.imageMaterial = new THREE.ShaderMaterial({
      uniforms: this.imageUniforms, vertexShader: IMAGE_VERTEX, fragmentShader: IMAGE_FRAGMENT,
      transparent: true, depthWrite: false, side: THREE.DoubleSide
    });
    this.image = new THREE.Mesh(this.imageGeometry, this.imageMaterial);
    this.image.position.z = 0.12;
    this.add(this.image);
  }

  _createWave(options) {
    this.waveUniforms = {
      uProgress: { value: 0 }, uOpacity: { value: options.waveOpacity ?? 0.82 }
    };
    this.waveMaterial = new THREE.ShaderMaterial({
      uniforms: this.waveUniforms, vertexShader: WAVE_VERTEX, fragmentShader: WAVE_FRAGMENT,
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending
    });
    this.wave = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 18), this.waveMaterial);
    this.wave.visible = false;
    this.add(this.wave);
  }

  _createHitProxy(options) {
    this.hitProxy = new THREE.Mesh(
      new THREE.SphereGeometry(options.hitRadius ?? 4.8, 12, 8),
      new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })
    );
    this.hitProxy.userData.memoryCarrier = this;
    this.hitProxy.userData.cosmicWebMemory = this;
    this.add(this.hitProxy);
    this.hitTargets.push(this.hitProxy);
  }

  async _loadTexture(url, options) {
    const fallback = this.texture;
    const result = await loadCarrierTexture(url, {
      fallback, anisotropy: this.quality === 'high' ? 4 : 1, loader: options.textureLoader
    });
    if (this.disposed) {
      if (result.texture && result.texture !== fallback) result.texture.dispose();
      return { ...result, texture: null };
    }
    if (result.texture && result.texture !== this.texture) {
      const previous = this.texture;
      this.texture = result.texture;
      this.imageUniforms.uMap.value = result.texture;
      if (this._ownsTexture) previous?.dispose();
    }
    if (result.error && typeof this.data.onTextureError === 'function') {
      this.data.onTextureError(result.error, this);
    }
    return result;
  }

  setDiscoveryProgress(progress = 0) {
    super.setDiscoveryProgress(progress);
    this._syncVisuals();
    return this;
  }

  setUnlocked(unlocked = true) {
    super.setUnlocked(unlocked);
    this._syncVisuals();
    return this;
  }

  setVisited(visited = true) {
    super.setVisited(visited);
    this.setCaptureProgress(visited ? 1 : 0);
    if (!visited) this.setReleaseProgress(0);
    this._syncVisuals();
    return this;
  }

  setCaptureProgress(progress = 0) {
    this.captureProgress = clamp01(progress);
    this.imageUniforms.uCapture.value = smooth(this.captureProgress);
    if (this.captureProgress >= 1) this.state = MEMORY_CARRIER_STATES.CAPTURED;
    return this;
  }

  setReleaseProgress(progress = 0) {
    this.releaseProgress = clamp01(progress);
    this.imageUniforms.uRelease.value = smooth(this.releaseProgress);
    return this;
  }

  setCaptureAnimationProgress(progress = 0) { return this.setCaptureProgress(progress); }
  setReleaseAnimationProgress(progress = 0) { return this.setReleaseProgress(progress); }

  setAnimationProgress(progress = {}) {
    if (Number.isFinite(progress)) return this.setCaptureProgress(progress);
    if (Number.isFinite(progress.capture)) this.setCaptureProgress(progress.capture);
    if (Number.isFinite(progress.release)) this.setReleaseProgress(progress.release);
    return this;
  }

  getDiscoverySample(context = {}) {
    const samples = context.discoverySamples || {};
    const source = samples[this.memoryId] || context.carriers?.[this.memoryId] || context.scan || {};
    const aimed = Boolean(source.aimed ?? source.targeted ?? context.aimed ?? context.targeted ?? this.focused);
    const nearValue = source.proximity ?? source.inProximity ?? source.near
      ?? context.proximity ?? context.inProximity ?? context.near;
    const proximity = typeof nearValue === 'number' ? nearValue > 0 : Boolean(nearValue);
    const eligible = this.unlocked;
    const canCapture = this.discoveryProgress >= 1
      || this.state === MEMORY_CARRIER_STATES.REVEALED || this.visited;
    return {
      type: 'scan', interaction: 'scan', requiredSeconds: 2, duration: 2,
      eligible, aimed, proximity, inProximity: proximity, canCapture,
      active: eligible && !this.visited
        && Boolean(source.active ?? context.scanning ?? (aimed && proximity)),
      ...(Number.isFinite(source.progress ?? context.scanProgress)
        ? { progress: clamp01(source.progress ?? context.scanProgress) } : {})
    };
  }

  setQuality(quality = 'high', mobile = this.mobile) {
    super.setQuality(quality);
    this.mobile = Boolean(mobile);
    this.goldWeb?.setQuality(quality, this.mobile);
    this.indigoWeb?.setQuality(quality, this.mobile);
    const ranges = { high: 1, medium: 0.64, low: 0.34 };
    const nodeCapacity = this.nodes?.geometry.attributes.position.count || 0;
    this.nodes?.geometry.setDrawRange(0, Math.ceil(nodeCapacity * (ranges[quality] || 1)));
    const secondary = quality !== 'low';
    if (this.indigoWeb) this.indigoWeb.object3D.visible = secondary;
    if (this.nodes) this.nodes.visible = secondary;
    if (this.texture) {
      this.texture.anisotropy = quality === 'high' ? 4 : 1;
      this.texture.needsUpdate = true;
    }
    return this;
  }

  setReducedMotion(reduced = true) {
    super.setReducedMotion(reduced);
    if (this.imageUniforms) this.imageUniforms.uMotion.value = this.reducedMotion ? 0 : 1;
    return this;
  }

  _syncVisuals() {
    if (!this.goldWeb) return;
    const progress = smooth(this.discoveryProgress);
    const trace = this.unlocked ? 0.022 : 0.008;
    this.goldWeb.setReveal(Math.max(trace, progress));
    this.indigoWeb.setReveal(Math.max(trace * 0.75, progress * 0.92));
    this.nodes.material.opacity = trace * 0.32 + progress * 0.46;
    this.imageUniforms.uReveal.value = smooth(Math.max(0, (progress - 0.46) / 0.54));
    this.waveUniforms.uProgress.value = this.discoveryProgress;
    this.wave.visible = this.discoveryProgress > 0.001 && this.discoveryProgress < 0.999;
    this.wave.scale.setScalar(1.1 + progress * 5.8);
  }

  update(delta = 0, context = {}) {
    if (this.disposed) return;
    const elapsed = context.elapsed;
    const dt = Math.min(Math.max(Number(delta) || 0, 0), 0.1);
    this.elapsed = Number.isFinite(elapsed) ? elapsed : this.elapsed + dt;
    const motionDelta = this.reducedMotion ? 0 : dt;
    this.goldWeb.update(motionDelta, this.elapsed);
    this.indigoWeb.update(motionDelta, this.elapsed);
    this.imageUniforms.uTime.value = this.elapsed;
    if (!this.reducedMotion) this.nodes.rotation.y += dt * 0.018;
  }

  dispose() {
    if (this.disposed) return;
    const texture = this._ownsTexture ? this.texture : null;
    const goldWeb = this.goldWeb;
    const indigoWeb = this.indigoWeb;
    if (goldWeb?.object3D?.parent) goldWeb.object3D.parent.remove(goldWeb.object3D);
    if (indigoWeb?.object3D?.parent) indigoWeb.object3D.parent.remove(indigoWeb.object3D);
    goldWeb?.dispose();
    indigoWeb?.dispose();
    texture?.dispose?.();
    this.texture = null;
    this.goldWeb = null;
    this.indigoWeb = null;
    super.dispose();
    this.imageUniforms = null;
    this.waveUniforms = null;
  }
}
