import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { M8_PHOTO_VERTEX_SHADER, M8_PHOTO_FRAGMENT_SHADER } from './M8SpatialPhotoShaders.js';

export const SPATIAL_PHOTO_ROLES = Object.freeze({
  ANCHOR: 'anchor',
  ORBITAL: 'orbital',
  WITNESS: 'witness',
  ECHO: 'echo',
  TABLEAU: 'tableau',
  COVER: 'cover',
  LETTER: 'letter',
  HIDDEN_MEMORY: 'hiddenMemory',
  LENS_REFLECTION: 'lensReflection',
  EPILOGUE: 'epilogue'
});

export const SPATIAL_PHOTO_STATES = Object.freeze({
  LOCKED: 'LOCKED', REVEALING: 'REVEALING', AVAILABLE: 'AVAILABLE',
  FOCUSING: 'FOCUSING', FOCUSED: 'FOCUSED', RETURNING: 'RETURNING'
});

const ROLE_DEFAULTS = Object.freeze({
  anchor: { size: [4.8, 3.2], glow: 0xf1c987, distortion: -0.035, bend: 0.08 },
  orbital: { size: [3.7, 2.6], glow: 0x8bb8e8, distortion: 0.045, bend: -0.05 },
  witness: { size: [3.1, 4.1], glow: 0xd8c7a1, distortion: 0.02, bend: 0.04 },
  echo: { size: [3.4, 2.4], glow: 0x9e88ca, distortion: 0.075, bend: -0.08 },
  tableau: { size: [5.6, 3.5], glow: 0xe6b36d, distortion: -0.02, bend: 0.03 },
  cover: { size: [3.2, 2.1], glow: 0xb9a7df, distortion: -0.035, bend: 0.08 },
  letter: { size: [2.7, 3.4], glow: 0xd8b98c, distortion: 0.055, bend: -0.045 },
  hiddenMemory: { size: [3, 2.25], glow: 0xe2a678, distortion: 0.085, bend: 0.07 },
  lensReflection: { size: [2.6, 2.6], glow: 0x9dc5db, distortion: 0.14, bend: -0.11 },
  epilogue: { size: [3.4, 2.2], glow: 0xf0d59b, distortion: -0.02, bend: 0.025 }
});

const clamp01 = value => Math.max(0, Math.min(1, value));
const smooth = t => t * t * (3 - 2 * t);

function createFallbackTexture(data, role) {
  const canvas = typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(256, 192)
    : (typeof document !== 'undefined' ? document.createElement('canvas') : null);
  if (!canvas) {
    const texture = new THREE.DataTexture(new Uint8Array([
      17, 24, 39, 255, 38, 57, 88, 255,
      38, 57, 88, 255, 21, 16, 31, 255
    ]), 2, 2, THREE.RGBAFormat);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  }
  canvas.width = 256;
  canvas.height = 192;
  const context = canvas.getContext('2d');
  if (!context) {
    const texture = new THREE.DataTexture(new Uint8Array([38, 57, 88, 255]), 1, 1, THREE.RGBAFormat);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  }
  const gradient = context.createLinearGradient(0, 0, 256, 192);
  gradient.addColorStop(0, '#111827'); gradient.addColorStop(0.55, '#263958'); gradient.addColorStop(1, '#15101f');
  context.fillStyle = gradient; context.fillRect(0, 0, 256, 192);
  context.strokeStyle = 'rgba(232,198,137,.55)'; context.lineWidth = 2; context.strokeRect(12, 12, 232, 168);
  context.fillStyle = 'rgba(255,255,255,.72)'; context.font = '600 15px sans-serif';
  context.fillText(String(data.title || role).slice(0, 25).toUpperCase(), 24, 158);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export class SpatialPhotoEntity extends THREE.Group {
  constructor(data = {}, options = {}) {
    super();
    this.data = data;
    this.role = ROLE_DEFAULTS[data.role] ? data.role : SPATIAL_PHOTO_ROLES.ORBITAL;
    this.state = data.locked === false ? SPATIAL_PHOTO_STATES.AVAILABLE : SPATIAL_PHOTO_STATES.LOCKED;
    this.visited = Boolean(data.visited);
    this.billboard = data.billboard !== false;
    this.quality = options.quality || data.quality || 'high';
    this.reveal = this.state === SPATIAL_PHOTO_STATES.LOCKED ? 0 : 1;
    this.targetReveal = this.reveal;
    this.disposed = false;
    this._transitionTime = 0;
    this._transitionDuration = 0.65;
    this._homePosition = new THREE.Vector3(); this._homeQuaternion = new THREE.Quaternion(); this._homeScale = new THREE.Vector3(1, 1, 1);
    this._fromPosition = new THREE.Vector3(); this._fromQuaternion = new THREE.Quaternion(); this._fromScale = new THREE.Vector3();
    this._toPosition = new THREE.Vector3(); this._toQuaternion = new THREE.Quaternion(); this._toScale = new THREE.Vector3();
    this._billboardQuaternion = new THREE.Quaternion();
    this._createVisual(options);
    this.ready = this._loadTexture(data.src || data.url || data.textureUrl);
  }

  _createVisual(options) {
    const preset = ROLE_DEFAULTS[this.role];
    const size = this.data.size || preset.size;
    const padding = this.data.glowPadding ?? 0.16;
    const segments = this.quality === 'low' ? 4 : (this.quality === 'medium' ? 10 : 18);
    this.texture = createFallbackTexture(this.data, this.role);
    this.uniforms = {
      uMap: { value: this.texture }, uFrameColor: { value: new THREE.Color(this.data.frameColor ?? 0xe7d5ae) },
      uGlowColor: { value: new THREE.Color(this.data.glowColor ?? preset.glow) }, uOpacity: { value: 1 },
      uReveal: { value: this.reveal }, uVisited: { value: this.visited ? 1 : 0 }, uInset: { value: 1 / (1 + padding * 2) },
      uDistortion: { value: this.data.distortion ?? preset.distortion }, uChromatic: { value: 0 },
      uBend: { value: this.data.bend ?? preset.bend }
    };
    this.geometry = new THREE.PlaneGeometry(size[0] * (1 + padding * 2), size[1] * (1 + padding * 2), segments, segments);
    this.material = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: M8_PHOTO_VERTEX_SHADER,
      fragmentShader: M8_PHOTO_FRAGMENT_SHADER, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    this.photoMesh = new THREE.Mesh(this.geometry, this.material); this.add(this.photoMesh);
    this.hitGeometry = new THREE.PlaneGeometry(size[0], size[1]);
    this.hitMaterial = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide });
    this.hitProxy = new THREE.Mesh(this.hitGeometry, this.hitMaterial);
    this.hitProxy.position.z = 0.015; this.hitProxy.userData.spatialPhotoEntity = this; this.add(this.hitProxy);
    this.setQuality(this.quality);
  }

  async _loadTexture(url) {
    if (!url) return { texture: this.texture, fallback: true };
    try {
      const loaded = await new THREE.TextureLoader().loadAsync(url);
      if (this.disposed) { loaded.dispose(); return { texture: null, fallback: true }; }
      loaded.colorSpace = THREE.SRGBColorSpace; loaded.anisotropy = this.quality === 'high' ? 4 : 1;
      const previous = this.texture; this.texture = loaded; this.uniforms.uMap.value = loaded; previous.dispose();
      return { texture: loaded, fallback: false };
    } catch (error) {
      if (typeof this.data.onTextureError === 'function') this.data.onTextureError(error, this);
      return { texture: this.texture, fallback: true, error };
    }
  }

  setQuality(quality = 'high') {
    this.quality = quality;
    this.uniforms.uChromatic.value = quality === 'high' ? (this.data.chromatic ?? 0.006) : 0;
    if (this.texture) { this.texture.anisotropy = quality === 'high' ? 4 : 1; this.texture.needsUpdate = true; }
    return this;
  }

  setReveal(value, immediate = false) {
    this.targetReveal = clamp01(value);
    if (immediate) { this.reveal = this.targetReveal; this.uniforms.uReveal.value = this.reveal; }
    this.state = this.targetReveal > 0 && this.targetReveal < 1 ? SPATIAL_PHOTO_STATES.REVEALING
      : (this.targetReveal === 0 ? SPATIAL_PHOTO_STATES.LOCKED : SPATIAL_PHOTO_STATES.REVEALING);
    return this;
  }

  setVisited(visited = true) { this.visited = Boolean(visited); this.uniforms.uVisited.value = this.visited ? 1 : 0; return this; }
  captureHome() { this._homePosition.copy(this.position); this._homeQuaternion.copy(this.quaternion); this._homeScale.copy(this.scale); return this; }

  focus(transform = {}, duration = 0.65) {
    if (this.state === SPATIAL_PHOTO_STATES.LOCKED) return false;
    this.captureHome(); this._beginTransform(transform, duration, SPATIAL_PHOTO_STATES.FOCUSING); return true;
  }

  returnHome(duration = 0.55) {
    this._beginTransform({ position: this._homePosition, quaternion: this._homeQuaternion, scale: this._homeScale }, duration,
      SPATIAL_PHOTO_STATES.RETURNING); return this;
  }

  _beginTransform(transform, duration, state) {
    this._fromPosition.copy(this.position); this._fromQuaternion.copy(this.quaternion); this._fromScale.copy(this.scale);
    this._toPosition.copy(transform.position || this.position); this._toQuaternion.copy(transform.quaternion || this.quaternion);
    this._toScale.copy(transform.scale || this.scale); this._transitionTime = 0;
    this._transitionDuration = Math.max(0.001, duration); this.state = state;
  }

  getFocusMetadata(target = {}) {
    target.id = this.data.id ?? this.uuid; target.role = this.role; target.title = this.data.title || '';
    target.caption = this.data.caption || ''; target.date = this.data.date || ''; target.visited = this.visited;
    target.object = this; target.distance = this.data.focusDistance ?? 6; target.duration = this.data.focusDuration ?? 0.8;
    return target;
  }

  update(deltaTime, camera = null) {
    if (this.disposed) return;
    const dt = Math.min(Math.max(deltaTime || 0, 0), 0.1);
    this.reveal += (this.targetReveal - this.reveal) * (1 - Math.exp(-dt * 8));
    if (Math.abs(this.targetReveal - this.reveal) < 0.002) {
      this.reveal = this.targetReveal;
      if (this.state === SPATIAL_PHOTO_STATES.REVEALING) this.state = this.reveal === 0 ? SPATIAL_PHOTO_STATES.LOCKED : SPATIAL_PHOTO_STATES.AVAILABLE;
    }
    this.uniforms.uReveal.value = this.reveal;
    if (this.state === SPATIAL_PHOTO_STATES.FOCUSING || this.state === SPATIAL_PHOTO_STATES.RETURNING) {
      this._transitionTime += dt; const t = smooth(clamp01(this._transitionTime / this._transitionDuration));
      this.position.lerpVectors(this._fromPosition, this._toPosition, t); this.quaternion.slerpQuaternions(this._fromQuaternion, this._toQuaternion, t);
      this.scale.lerpVectors(this._fromScale, this._toScale, t);
      if (t >= 1) this.state = this.state === SPATIAL_PHOTO_STATES.FOCUSING ? SPATIAL_PHOTO_STATES.FOCUSED : SPATIAL_PHOTO_STATES.AVAILABLE;
    } else if (this.billboard && camera && this.state !== SPATIAL_PHOTO_STATES.FOCUSED) {
      camera.getWorldQuaternion(this._billboardQuaternion); this.quaternion.copy(this._billboardQuaternion);
    }
  }

  dispose() {
    if (this.disposed) return; this.disposed = true;
    if (this.parent) this.parent.remove(this);
    this.geometry.dispose(); this.material.dispose(); this.hitGeometry.dispose(); this.hitMaterial.dispose();
    if (this.texture) this.texture.dispose(); this.clear(); this.texture = null; this.uniforms = null;
  }
}
