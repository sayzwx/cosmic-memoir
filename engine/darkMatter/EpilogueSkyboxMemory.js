import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { MemoryCarrier, loadCarrierTexture } from './MemoryCarrier.js';
import {
  EPILOGUE_SKY_VERTEX, EPILOGUE_SKY_FRAGMENT,
  EPILOGUE_STAR_VERTEX, EPILOGUE_STAR_FRAGMENT
} from './EpilogueSkyboxShaders.js';

const clamp01 = value => Math.max(0, Math.min(1, Number(value) || 0));
const DEFAULT_TEXTURE = './OIP-C (1).webp';
const STAR_IDS = ['m8-origin', 'm8-window', 'm8-summer', 'm8-reflection', 'm8-dawn'];

function fallbackTexture() {
  const pixels = new Uint8Array([3, 5, 14, 255, 21, 12, 45, 255, 8, 24, 48, 255, 2, 3, 10, 255]);
  const texture = new THREE.DataTexture(pixels, 2, 2, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export class EpilogueSkyboxMemory extends MemoryCarrier {
  constructor(data = {}, options = {}) {
    super({ ...data, carrier: 'epilogueSkybox' }, { ...options, carrierType: 'epilogueSkybox' });
    this.panorama = false;
    this.tableau = false;
    this._elapsed = 0;
    this._skyOpacity = 0;
    this._portalOpacity = 1;
    this.starIds = data.starIds || data.memoryIds || STAR_IDS;
    this.texture = fallbackTexture();
    this.skyUniforms = {
      uMap: { value: this.texture }, uTime: { value: 0 }, uOpacity: { value: 0 },
      uDrift: { value: 0.000012 }, uDistortion: { value: 0.0018 },
      uExposure: { value: data.exposure ?? options.exposure ?? 1.08 }
    };
    this.skyGeometry = new THREE.SphereGeometry(data.radius || options.radius || 900, 64, 40);
    this.skyMaterial = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms, vertexShader: EPILOGUE_SKY_VERTEX, fragmentShader: EPILOGUE_SKY_FRAGMENT,
      side: THREE.BackSide, transparent: true, depthWrite: false
    });
    this.sky = new THREE.Mesh(this.skyGeometry, this.skyMaterial);
    this.sky.visible = false;
    this.sky.frustumCulled = false;
    this.add(this.sky);
    this._createStars(data);
    this._createHitTarget(data);
    this.setCollectedIds(data.collectedIds || []);
    this.setQuality(this.quality);
    this.ready = this._loadTexture(data.src || DEFAULT_TEXTURE, options.textureLoader);
  }

  _createStars(data) {
    const source = data.starPositions || [[0, 0, 0], [-0.16, 0.09, -0.08], [0.15, 0.12, -0.1], [-0.1, -0.13, 0.04], [0.13, -0.1, 0.02]];
    const positions = new Float32Array(15);
    source.slice(0, 5).forEach((point, index) => positions.set(point, index * 3));
    this.starCollected = new Float32Array(5);
    this.starActive = new Float32Array(5);
    this.starGeometry = new THREE.BufferGeometry();
    this.starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.starGeometry.setAttribute('aCollected', new THREE.BufferAttribute(this.starCollected, 1));
    this.starGeometry.setAttribute('aActive', new THREE.BufferAttribute(this.starActive, 1));
    this.starGeometry.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array([1.3, 0.8, 0.92, 0.75, 1.05]), 1));
    this.starUniforms = { uOpacity: { value: 1 }, uTime: { value: 0 } };
    this.stars = new THREE.Points(this.starGeometry, new THREE.ShaderMaterial({
      uniforms: this.starUniforms, vertexShader: EPILOGUE_STAR_VERTEX, fragmentShader: EPILOGUE_STAR_FRAGMENT,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    this.stars.position.fromArray(data.portalOffset || [0, 0, 0]);
    this.add(this.stars);
  }

  _createHitTarget(data) {
    const geometry = new THREE.SphereGeometry(data.hitRadius || 0.42, 8, 6);
    const material = new THREE.MeshBasicMaterial({ visible: false });
    this.hitTarget = new THREE.Mesh(geometry, material);
    this.hitTarget.position.copy(this.stars.position);
    this.hitTarget.userData.memoryCarrier = this;
    this.hitTarget.visible = this.unlocked;
    this.add(this.hitTarget);
    this.hitTargets.push(this.hitTarget);
  }

  async _loadTexture(url, loader) {
    const result = await loadCarrierTexture(url, { loader, fallback: this.texture, anisotropy: this.quality === 'high' ? 4 : 1 });
    if (this.disposed) {
      if (!result.fallback) result.texture?.dispose();
      return { ...result, texture: null };
    }
    if (!result.fallback && result.texture) {
      const previous = this.texture;
      this.texture = result.texture;
      this.skyUniforms.uMap.value = result.texture;
      previous.dispose();
    }
    if (result.error && typeof this.data.onTextureError === 'function') this.data.onTextureError(result.error, this);
    return result;
  }

  getDiscoverySample(context = {}) {
    const scoped = context.discoverySamples?.[this.memoryId] || context.carriers?.[this.memoryId] || context.epilogue || {};
    const aimed = Boolean(scoped.aimed ?? scoped.isAimed ?? context.aimed ?? context.isAimed ?? this.focused);
    const proximity = scoped.proximity ?? context.proximity;
    const near = Boolean(scoped.inProximity ?? scoped.near ?? context.inProximity ?? context.near ??
      (Number.isFinite(proximity) && proximity <= (this.data.discovery?.distance ?? 4.5)));
    const available = this.unlocked === true;
    return { type: 'epilogue', interaction: 'epilogue', available, active: available && (aimed || near),
      aimed, inProximity: near, requiredSeconds: 1, duration: 1,
      canCapture: available && (this.panorama || this.tableau || this.discoveryProgress >= 1) };
  }

  enterPanorama() { this.panorama = true; this.sky.visible = true; return this; }
  exitPanorama() { if (!this.tableau) this.panorama = false; return this; }
  setUnlocked(unlocked = true) {
    super.setUnlocked(unlocked);
    this.visible = this.unlocked || this.tableau;
    return this;
  }

  setTableau(enabled = true) {
    this.tableau = Boolean(enabled);
    this.visible = this.unlocked || this.tableau;
    if (this.tableau) this.enterPanorama();
    return this;
  }

  setCollectedIds(ids = []) {
    const collected = new Set(ids || []);
    let activeIndex = -1;
    this.starIds.slice(0, 5).forEach((id, index) => {
      const next = collected.has(id) ? 1 : 0;
      if (next && !this.starCollected[index]) activeIndex = index;
      this.starCollected[index] = next;
      this.starActive[index] = 0;
    });
    if (activeIndex < 0 && collected.size < 5) activeIndex = this.starIds.findIndex(id => !collected.has(id));
    if (activeIndex >= 0 && activeIndex < 5) this.starActive[activeIndex] = 1;
    this.starGeometry.getAttribute('aCollected').needsUpdate = true;
    this.starGeometry.getAttribute('aActive').needsUpdate = true;
    return this;
  }

  setQuality(quality = 'high') {
    super.setQuality(quality);
    const low = quality === 'low', medium = quality === 'medium';
    this.skyUniforms.uDistortion.value = low ? 0.00025 : (medium ? 0.0009 : 0.0018);
    this.skyUniforms.uDrift.value = low ? 0.000002 : (medium ? 0.000007 : 0.000012);
    if (this.texture) { this.texture.anisotropy = quality === 'high' ? 4 : 1; this.texture.needsUpdate = true; }
    return this;
  }

  setReducedMotion(reduced = true) { super.setReducedMotion(reduced); return this; }

  update(delta = 0, context = {}) {
    if (this.disposed) return;
    const elapsed = context.elapsed;
    const dt = Math.min(Math.max(Number(delta) || 0, 0), 0.1);
    this._elapsed = Number.isFinite(elapsed) ? elapsed : this._elapsed + dt;
    const targetSky = this.panorama || this.tableau ? 1 : 0;
    const targetPortal = targetSky ? 0 : (this.unlocked ? 1 : 0.28);
    const blend = this.reducedMotion ? 1 : 1 - Math.exp(-dt * 3.8);
    this._skyOpacity += (targetSky - this._skyOpacity) * blend;
    this._portalOpacity += (targetPortal - this._portalOpacity) * blend;
    this.skyUniforms.uOpacity.value = clamp01(this._skyOpacity);
    this.starUniforms.uOpacity.value = clamp01(this._portalOpacity);
    const motionTime = this.reducedMotion ? 0 : this._elapsed;
    this.skyUniforms.uTime.value = motionTime;
    this.starUniforms.uTime.value = motionTime;
    this.sky.visible = targetSky > 0 || this._skyOpacity > 0.002;
    this.stars.visible = targetPortal > 0 || this._portalOpacity > 0.002;
    this.hitTarget.visible = !targetSky && this.unlocked;
  }

  dispose() {
    if (this.disposed) return;
    this.texture?.dispose();
    this.texture = null;
    super.dispose();
    this.skyUniforms = null;
    this.starUniforms = null;
  }
}
