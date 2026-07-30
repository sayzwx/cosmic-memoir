import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

export const MEMORY_CARRIER_STATES = Object.freeze({
  LOCKED: 'LOCKED',
  AVAILABLE: 'AVAILABLE',
  TARGETED: 'TARGETED',
  DISCOVERING: 'DISCOVERING',
  REVEALED: 'REVEALED',
  CAPTURED: 'CAPTURED'
});

export const CARRIER_STATES = MEMORY_CARRIER_STATES;

const clamp01 = value => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const DISCOVERY_ALIASES = Object.freeze({ focus: 'gaze', lensing: 'align', milestone: 'epilogue' });

export async function loadCarrierTexture(url, options = {}) {
  const { loader = new THREE.TextureLoader(), fallback = null, colorSpace = THREE.SRGBColorSpace,
    anisotropy = 1, signal } = options;
  if (!url) return { texture: fallback, fallback: true, error: null };
  if (signal?.aborted) return { texture: fallback, fallback: true, error: signal.reason || new Error('Texture load aborted') };
  try {
    const texture = await loader.loadAsync(url);
    if (signal?.aborted) {
      texture.dispose();
      return { texture: fallback, fallback: true, error: signal.reason || new Error('Texture load aborted') };
    }
    texture.colorSpace = colorSpace;
    texture.anisotropy = anisotropy;
    texture.needsUpdate = true;
    return { texture, fallback: false, error: null };
  } catch (error) {
    return { texture: fallback, fallback: true, error };
  }
}

export class MemoryCarrier extends THREE.Group {
  constructor(data = {}, options = {}) {
    super();
    this.data = data;
    this.memoryId = data.id || options.memoryId || options.id || this.uuid;
    this.carrierType = data.carrier || options.carrierType || 'unknown';
    this.visited = Boolean(data.visited ?? options.visited);
    this.hitTargets = Array.isArray(options.hitTargets) ? [...options.hitTargets] : [];
    this.quality = options.quality || data.quality || 'high';
    this.reducedMotion = Boolean(options.reducedMotion);
    this.discoveryProgress = this.visited ? 1 : clamp01(options.discoveryProgress);
    this.unlocked = Boolean(options.unlocked ?? data.unlocked ?? data.locked === false);
    this.focused = false;
    this.disposed = false;
    this.state = this.visited ? MEMORY_CARRIER_STATES.CAPTURED
      : (this.unlocked ? MEMORY_CARRIER_STATES.AVAILABLE : MEMORY_CARRIER_STATES.LOCKED);
    if (Array.isArray(data.position)) this.position.fromArray(data.position);
    if (Array.isArray(data.rotation)) this.rotation.fromArray(data.rotation);
    this.visible = this.unlocked || this.visited;
  }

  setUnlocked(unlocked = true) {
    this.unlocked = Boolean(unlocked);
    this.visible = this.unlocked || this.visited;
    if (!this.visited) this._syncState();
    return this;
  }

  setQuality(quality = 'high') { this.quality = quality; return this; }
  setReducedMotion(reduced = true) { this.reducedMotion = Boolean(reduced); return this; }

  setFocused(focused = true) {
    this.focused = Boolean(focused) && this.unlocked;
    if (!this.visited) this._syncState();
    return this;
  }

  setDiscoveryProgress(progress = 0) {
    this.discoveryProgress = clamp01(progress);
    this._syncState();
    return this;
  }

  setVisited(visited = true) {
    this.visited = Boolean(visited);
    if (this.visited) {
      this.unlocked = true;
      this.discoveryProgress = 1;
      this.state = MEMORY_CARRIER_STATES.CAPTURED;
    } else {
      this._syncState();
    }
    this.visible = this.unlocked || this.visited;
    return this;
  }

  getFocusMetadata(target = {}) {
    return Object.assign(target, {
      id: this.memoryId, memoryId: this.memoryId, carrierType: this.carrierType, title: this.data.title || '',
      caption: this.data.caption || '', visited: this.visited, object: this,
      focusOffset: this.data.focusOffset || [0, 0, 0]
    });
  }

  getDiscoverySample(context = {}) {
    const configuredType = this.data.discovery?.type || 'gaze';
    const type = DISCOVERY_ALIASES[configuredType] || configuredType;
    const samples = context.discoverySamples || {};
    const sample = samples[this.memoryId] || context.carriers?.[this.memoryId] || context[type] || {};
    return typeof sample === 'number' ? { type, progress: clamp01(sample), active: sample > 0 }
      : { type, ...sample };
  }

  _syncState() {
    if (this.visited) this.state = MEMORY_CARRIER_STATES.CAPTURED;
    else if (!this.unlocked) this.state = MEMORY_CARRIER_STATES.LOCKED;
    else if (this.discoveryProgress >= 1) this.state = MEMORY_CARRIER_STATES.REVEALED;
    else if (this.discoveryProgress > 0) this.state = MEMORY_CARRIER_STATES.DISCOVERING;
    else this.state = this.focused ? MEMORY_CARRIER_STATES.TARGETED : MEMORY_CARRIER_STATES.AVAILABLE;
  }

  update(delta = 0, context = {}) {}

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this.parent) this.parent.remove(this);
    const geometries = new Set();
    const materials = new Set();
    this.traverse(object => {
      if (object === this) return;
      if (object.geometry) geometries.add(object.geometry);
      const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
      objectMaterials.filter(Boolean).forEach(material => materials.add(material));
    });
    geometries.forEach(geometry => geometry.dispose?.());
    materials.forEach(material => material.dispose?.());
    this.hitTargets.length = 0;
    this.clear();
  }
}
