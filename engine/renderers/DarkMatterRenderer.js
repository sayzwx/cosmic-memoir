import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { CelestialRenderer } from '../core/CelestialRenderer.js';
import { createDarkMatterEnvironment } from './darkMatter/DarkMatterEnvironment.js';
import { SpatialPhotoEntity } from './darkMatter/SpatialPhotoEntity.js';
import { SpatialMemoryCamera, SPATIAL_CAMERA_STATES } from './darkMatter/SpatialMemoryCamera.js';
import { normalizeQuality } from './darkMatter/qualityBudgets.js';

const TELEMETRY_INTERVAL = 1000 / 15;
const ENTITY_COUNT = 5;
const DPR_LIMITS = Object.freeze({ high: 1.5, medium: 1.25, low: 1 });
const TABLEAU_POSITIONS = Object.freeze([
  [0, 4.6, -7], [-6.1, 1.3, -9], [5.9, 1.1, -10], [-4.2, -4, -11], [4.5, -3.8, -9]
]);

function eventDetail(event) { return event?.detail || {}; }

export class DarkMatterRenderer extends CelestialRenderer {
  constructor(canvas, data, options = {}) {
    super(canvas, data, options);
    this.memoryId = data.id;
    this.quality = normalizeQuality(options.quality);
    this.mobile = false;
    this.reducedMotion = false;
    this.environment = null;
    this.cameraRig = null;
    this.entities = [];
    this.entityById = new Map();
    this.pickTargets = [];
    this.visitedIds = new Set();
    this.focusedEntity = null;
    this.currentCandidate = null;
    this.focusStableAt = 0;
    this.phase = 'intro';
    this.completed = false;
    this.destroyed = false;
    this.firstFocusSent = false;
    this.lensMilestoneSent = false;
    this.completeMilestoneSent = false;
    this.lastTelemetryAt = -Infinity;
    this.telemetryTimer = null;
    this.lastPinchAt = -Infinity;
    this.pinchBaseDistance = 0;
    this.raycaster = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.sceneTarget = new THREE.Vector3(0, 0, -10);
    this.tableauTargets = TABLEAU_POSITIONS.map(position => new THREE.Vector3(...position));
    this.focusMetadata = {};
    this.focusOffset = new THREE.Vector3();
    this.letterRing = null;
    this.letterRingGeometry = null;
    this.letterRingMaterial = null;
  }

  async init() {
    const width = this.canvas.clientWidth || window.innerWidth;
    const height = this.canvas.clientHeight || window.innerHeight;
    this.mobile = width <= 768 || Boolean(window.matchMedia?.('(pointer: coarse)').matches);
    this.reducedMotion = Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(1, height);
    this.camera.fov = 58;
    this.camera.near = 0.1;
    this.camera.far = 4000;
    this.camera.updateProjectionMatrix();
    this._applyPixelRatio();

    // The environment is deliberately seven normal render calls:
    // stars, galaxy, planet surface/cloud/rim, dust, and cosmic web.
    this.environment = createDarkMatterEnvironment({
      quality: this.quality,
      mobile: this.mobile,
      reducedMotion: this.reducedMotion,
      pixelRatio: this.renderer.getPixelRatio(),
      stars: { radius: 155 },
      galaxy: { radius: 25, position: [-3, 1, -35], inclination: -0.78, yaw: -0.2, roll: -0.28 },
      planet: { radius: 9, position: [19, -12, -23], keepCloudsOnLow: false },
      dust: { extent: [70, 32, 55], position: [0, 0, -35] },
      web: { extent: [56, 34, 42], position: [0, 0, -27], reveal: 0 }
    });
    this.scene.add(this.environment.object3D);
    this.environment.setPixelRatio(this.renderer.getPixelRatio());
    this.scene.background = new THREE.Color(0x01030a);

    this._createEntities();
    this._unlockEligible(true);
    this.cameraRig = new SpatialMemoryCamera(this.camera, {
      target: this.sceneTarget, distance: 22, minDistance: 11, maxDistance: 42,
      yaw: 0.04, pitch: 0.1, reducedMotion: this.reducedMotion
    });
    this.camera.position.set(2, 5, 38);
    this.cameraRig.lookAt(this.sceneTarget);
    this.cameraRig.intro(this.sceneTarget, 22, 1.45);

    this.bindEvent(window, 'spatialMemoryScanRequested', event => {
      const detail = eventDetail(event);
      if (!detail.memoryId || detail.memoryId === this.memoryId) this._scan(detail.entityId);
    });
    this.bindEvent(window, 'spatialMemoryReturnOverview', event => {
      const detail = eventDetail(event);
      if (detail.memoryId && detail.memoryId !== this.memoryId) return;
      if (this._returnOverview()) event.preventDefault?.();
    });

    this._emitReady();
    this._emitTelemetry(true);
  }

  _createEntities() {
    const photos = Array.isArray(this.media.photos) ? this.media.photos : [];
    const order = Array.isArray(this.data.experience?.entityOrder)
      ? this.data.experience.entityOrder : photos.map(photo => photo.id);
    for (const id of order.slice(0, ENTITY_COUNT)) {
      const source = photos.find(photo => photo.id === id);
      if (!source) continue;
      const data = {
        ...source,
        locked: true,
        glowColor: source.accent,
        chromatic: source.role === 'lensReflection' ? 0.018 : undefined,
        distortion: source.role === 'lensReflection' ? 0.14 : undefined
      };
      const entity = new SpatialPhotoEntity(data, { quality: this.quality });
      entity.position.fromArray(source.position || [0, 0, -8]);
      if (source.rotation) entity.rotation.fromArray(source.rotation);
      entity.userData.focusDistance = Math.max(2.8, source.focusOffset?.[2] || 3.8);
      entity.captureHome();
      entity.setReveal(0, true);
      this.scene.add(entity);
      this.entities.push(entity);
      this.entityById.set(id, entity);
      if (source.role === 'letter') this._addEinsteinRing(entity, source.accent);
    }
  }

  _addEinsteinRing(entity, color) {
    this.letterRingGeometry = new THREE.RingGeometry(1.72, 1.82, 64);
    this.letterRingMaterial = new THREE.MeshBasicMaterial({
      color: color || 0xd8b98c, transparent: true, opacity: 0,
      depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending
    });
    this.letterRing = new THREE.Mesh(this.letterRingGeometry, this.letterRingMaterial);
    this.letterRing.position.z = 0.025;
    entity.add(this.letterRing);
  }

  _dependenciesMet(entity) {
    const dependencies = entity.data.unlockAfter || [];
    return dependencies.every(id => this.visitedIds.has(id));
  }

  _unlockEligible(immediate = false) {
    const unlockedIds = [];
    let candidate = null;
    this.pickTargets.length = 0;
    for (const entity of this.entities) {
      if (this._dependenciesMet(entity)) {
        if (entity.targetReveal === 0) unlockedIds.push(entity.data.id);
        entity.setReveal(1, immediate);
        this.pickTargets.push(entity.hitProxy);
        if (!entity.visited && !candidate) candidate = entity;
      }
    }
    this.currentCandidate = candidate;
    return unlockedIds;
  }

  _pick(x, y) {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height || this.pickTargets.length === 0) return null;
    this.ndc.set(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.pickTargets, false);
    return hits[0]?.object?.userData?.spatialPhotoEntity || null;
  }

  _focus(entity) {
    if (!entity || entity.targetReveal === 0 || entity.reveal < 0.25 || entity.visited && this.completed) return false;
    if (this.focusedEntity === entity) return true;
    this.focusedEntity = entity;
    this.currentCandidate = entity;
    this.focusStableAt = 0;
    this.phase = 'focus';
    const metadata = entity.getFocusMetadata(this.focusMetadata);
    const offset = entity.data.focusOffset;
    metadata.distance = Math.max(2.8, offset?.[2] || metadata.distance);
    this.focusOffset.set(offset?.[0] || 0, offset?.[1] || 0, 0);
    this.cameraRig.focus(metadata, {
      distance: metadata.distance,
      offset: this.focusOffset,
      duration: this.reducedMotion ? 0 : 0.82
    });
    this._emitFocus(entity, false, `正在对准「${entity.data.title || '未命名记忆'}」…`);
    if (!this.firstFocusSent) {
      this.firstFocusSent = true;
      this._emitMilestone('first-focus');
    }
    if (entity.data.role === 'lensReflection' && !this.lensMilestoneSent) {
      this.lensMilestoneSent = true;
      this._emitMilestone('lens-reflection');
    }
    this._emitTelemetry(true);
    return true;
  }

  _returnOverview() {
    if (!this.cameraRig || (!this.focusedEntity && this.cameraRig.state === SPATIAL_CAMERA_STATES.OVERVIEW)) return false;
    if (!this.cameraRig.returnToOverview(this.reducedMotion ? 0 : 0.7)) {
      this.cameraRig.overview(this.sceneTarget, 22, this.reducedMotion ? 0 : 0.7);
    }
    this.focusedEntity = null;
    this.focusStableAt = 0;
    this.phase = this.completed ? 'tableau' : 'overview';
    this._emitFocus(null, false, this.completed ? '五段记忆已连成星座。' : '继续移动视角寻找记忆。');
    this._emitTelemetry(true);
    return true;
  }

  _scan(requestedId = null) {
    const entity = requestedId ? this.entityById.get(requestedId) : this.focusedEntity;
    if (!entity || entity !== this.focusedEntity || entity.targetReveal === 0) {
      this._emitFocus(entity || null, Boolean(entity?.targetReveal === 0), '准星内没有可扫描的记忆。');
      return false;
    }
    return this._visit(entity, 'scan');
  }

  _visit(entity, trigger) {
    if (!entity || entity.visited) return false;
    entity.setVisited(true);
    this.visitedIds.add(entity.data.id);
    const unlockedIds = this._unlockEligible();
    const progress = this.visitedIds.size / this.entities.length;
    window.dispatchEvent(new CustomEvent('spatialMemoryVisited', { detail: {
      memoryId: this.memoryId, entityId: entity.data.id, visitedIds: Array.from(this.visitedIds),
      visitedCount: this.visitedIds.size, totalEntities: this.entities.length,
      explorationProgress: progress, trigger, unlockedIds,
      status: `已发现 ${this.visitedIds.size} / ${this.entities.length} 段记忆。`
    }}));
    if (this.visitedIds.size === this.entities.length) this._complete();
    this._emitTelemetry(true);
    return true;
  }

  _complete() {
    if (this.completed) return;
    this.completed = true;
    this.phase = 'tableau';
    this.environment.setReveal(1);
    this.cameraRig.tableau(this.sceneTarget, 24, this.reducedMotion ? 0 : 1.15);
    window.dispatchEvent(new CustomEvent('hiddenMemoryUnlocked', { detail: {
      memoryId: this.memoryId, hiddenMemoryId: this.media.hiddenMemoryId,
      entityId: this.focusedEntity?.data.id || null, visitedIds: Array.from(this.visitedIds),
      visitedCount: this.visitedIds.size, totalEntities: this.entities.length,
      explorationProgress: 1, progress: 1
    }}));
    if (!this.completeMilestoneSent) {
      this.completeMilestoneSent = true;
      this._emitMilestone('complete');
    }
  }

  _emitReady() {
    window.dispatchEvent(new CustomEvent('darkMatterReady', { detail: {
      memoryId: this.memoryId, version: 2, hiddenMemoryCount: this.entities.length,
      requiredCount: this.entities.length, drawCallExpectation: this.environment?.drawCalls + this.entities.length + 1
    }}));
  }

  _emitFocus(entity, locked = false, status = '') {
    window.dispatchEvent(new CustomEvent('spatialMemoryFocus', { detail: {
      memoryId: this.memoryId, entityId: entity?.data.id || null, role: entity?.data.role || null,
      title: entity?.data.title || '', caption: entity?.data.caption || '', body: entity?.data.body || '',
      discoveryType: entity?.data.discovery?.type || null, visited: Boolean(entity?.visited), locked, status
    }}));
  }

  _emitMilestone(name) {
    window.dispatchEvent(new CustomEvent('darkMatterMilestone', { detail: {
      memoryId: this.memoryId, name, milestone: name,
      progress: this.entities.length ? this.visitedIds.size / this.entities.length : 0
    }}));
  }

  _status() {
    if (this.completed) return '五段记忆已连成星座。';
    if (this.focusedEntity) return `已对准「${this.focusedEntity.data.title}」。按 Space 扫描。`;
    return `空间扫描 ${this.visitedIds.size} / ${this.entities.length}`;
  }

  _emitTelemetry(force = false) {
    if (this.destroyed) return;
    const now = performance.now();
    const wait = TELEMETRY_INTERVAL - (now - this.lastTelemetryAt);
    if (wait > 0) {
      if (force && this.telemetryTimer === null) {
        this.telemetryTimer = setTimeout(() => {
          this.telemetryTimer = null;
          this._emitTelemetry(true);
        }, wait);
      }
      return;
    }
    this.lastTelemetryAt = now;
    const progress = this.entities.length ? this.visitedIds.size / this.entities.length : 0;
    const status = this._status();
    const detail = {
      memoryId: this.memoryId, sceneType: 'darkMatter', phase: this.phase,
      explorationProgress: progress, focusedEntityId: this.focusedEntity?.data.id || null,
      visitedCount: this.visitedIds.size, totalEntities: this.entities.length,
      values: { status }, status, timestamp: Date.now()
    };
    window.dispatchEvent(new CustomEvent('sceneTelemetry', { detail }));
    if (force) window.dispatchEvent(new CustomEvent('darkMatterTelemetry', { detail: {
      memoryId: this.memoryId, progress, convergence: progress, capturedCount: this.visitedIds.size,
      requiredCount: this.entities.length, strength: progress, longing: progress,
      lensReflection: this.lensMilestoneSent
    }}));
  }

  onDragStart() {
    if (this.focusedEntity) return;
    this.cameraRig?.onDragStart();
  }

  onDrag(deltaX, deltaY) {
    if (this.focusedEntity) return;
    if (this.cameraRig?.onDrag(deltaX, deltaY)) {
      this.phase = 'overview';
      this._emitTelemetry();
    }
  }

  onDragEnd() { this.cameraRig?.onDragEnd(); }

  onScroll(deltaY) {
    if (this.focusedEntity) this._returnOverview();
    this.cameraRig?.onScroll(deltaY);
    this.phase = this.completed ? 'tableau' : 'overview';
    this._emitTelemetry();
  }

  onPinch(scale, _centerX, _centerY, phase = 'move') {
    if (this.focusedEntity) this._returnOverview();
    if (phase === 'start' || !this.pinchBaseDistance) {
      this.pinchBaseDistance = this.cameraRig?.targetDistance || 22;
    }
    if (phase === 'end') {
      this.pinchBaseDistance = 0;
      return;
    }
    if (this.cameraRig && Number.isFinite(scale) && scale > 0) {
      this.cameraRig.targetDistance = THREE.MathUtils.clamp(
        this.pinchBaseDistance / scale, this.cameraRig.minDistance, this.cameraRig.maxDistance
      );
    }
    this._emitTelemetry();
  }

  onTap(x, y) {
    const entity = this._pick(x, y);
    if (entity) return this._focus(entity);
    if (this.focusedEntity) return this._returnOverview();
    return false;
  }

  onKeyDown(key) {
    if (key === 'Escape') return this._returnOverview();
    if (key === ' ' || key === 'Spacebar') return this._scan();
    if (key === 'Enter') return this._focus(this.currentCandidate);
    const dolly = key === 'w' || key === 'W' || key === 'ArrowUp' ? -90
      : (key === 's' || key === 'S' || key === 'ArrowDown' ? 90 : 0);
    if (dolly) { this.onScroll(dolly); return true; }
    const orbit = key === 'a' || key === 'A' || key === 'ArrowLeft' ? -0.14
      : (key === 'd' || key === 'D' || key === 'ArrowRight' ? 0.14 : 0);
    if (orbit) {
      if (this.focusedEntity) this._returnOverview();
      this.cameraRig.targetYaw += orbit;
      this.phase = this.completed ? 'tableau' : 'overview';
      this._emitTelemetry(true);
      return true;
    }
    return false;
  }

  announceState() {
    this._emitReady();
    this._emitFocus(this.focusedEntity, false, this._status());
    this._emitTelemetry(true);
  }

  update(deltaTime, elapsedTime) {
    const dt = Math.min(deltaTime, 0.05);
    this.cameraRig?.update(dt);
    this.environment?.update(dt, elapsedTime);
    for (let i = 0; i < this.entities.length; i++) {
      const entity = this.entities[i];
      if (this.completed) entity.position.lerp(this.tableauTargets[i], this.reducedMotion ? 1 : Math.min(1, dt * 1.35));
      entity.update(dt, this.camera);
      if (entity.data.role === 'hiddenMemory') {
        // Keep the hidden memory readable enough to acquire, but reserve its
        // full photographic prominence for a completed scan/dwell.
        entity.uniforms.uOpacity.value = entity.visited ? 1 : (entity === this.focusedEntity ? 0.58 : 0.25);
      }
    }
    if (this.letterRing) {
      const owner = this.letterRing.parent;
      const emphasis = owner === this.focusedEntity || owner?.visited ? 1 : 0.45;
      this.letterRingMaterial.opacity = owner?.reveal * 0.36 * emphasis;
      this.letterRing.rotation.z += dt * (this.reducedMotion ? 0 : 0.09);
    }
    const progress = this.entities.length ? this.visitedIds.size / this.entities.length : 0;
    if (!this.completed) this.environment?.setReveal(progress * 0.72);

    if (this.focusedEntity && this.cameraRig?.state === SPATIAL_CAMERA_STATES.FOCUSED) {
      if (!this.focusStableAt) this.focusStableAt = elapsedTime;
      const type = this.focusedEntity.data.discovery?.type || 'focus';
      const dwell = type === 'proximity' || type === 'lensing' ? 1.45 : (type === 'milestone' ? 1.65 : 2);
      if (type !== 'scan' && !this.focusedEntity.visited && elapsedTime - this.focusStableAt >= dwell) {
        this._visit(this.focusedEntity, 'dwell');
      }
    } else if (this.focusedEntity) {
      this.focusStableAt = 0;
    }
    if (this.phase === 'intro' && this.cameraRig?.state === SPATIAL_CAMERA_STATES.OVERVIEW) this.phase = 'overview';
    this._emitTelemetry();
  }

  _applyPixelRatio() {
    const limit = this.mobile ? 1 : DPR_LIMITS[this.quality];
    const ratio = Math.min(window.devicePixelRatio || 1, limit);
    this.renderer.setPixelRatio(ratio);
    this.environment?.setPixelRatio(ratio);
  }

  onResize(width, height) {
    super.onResize(width, height);
    this.mobile = width <= 768 || Boolean(window.matchMedia?.('(pointer: coarse)').matches);
    this._applyPixelRatio();
    this.environment?.setQuality(this.quality, this.mobile);
  }

  onQualityChange(value) {
    this.quality = normalizeQuality(value);
    this._applyPixelRatio();
    this.environment?.setQuality(this.quality, this.mobile);
    for (const entity of this.entities) entity.setQuality(this.quality);
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.telemetryTimer !== null) clearTimeout(this.telemetryTimer);
    this.telemetryTimer = null;
    if (this.letterRing) this.letterRing.removeFromParent();
    this.letterRingGeometry?.dispose();
    this.letterRingMaterial?.dispose();
    this.letterRing = null;
    this.letterRingGeometry = null;
    this.letterRingMaterial = null;
    for (const entity of this.entities) entity.dispose();
    this.entities.length = 0;
    this.entityById.clear();
    this.pickTargets.length = 0;
    this.environment?.dispose();
    this.environment = null;
    this.cameraRig = null;
    super.destroy();
  }
}
