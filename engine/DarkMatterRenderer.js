import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { CelestialRenderer } from '../core/CelestialRenderer.js';
import { createDarkMatterEnvironment } from './darkMatter/DarkMatterEnvironment.js';
import { M8DiscoveryController } from './darkMatter/M8DiscoveryController.js';
import { MEMORY_CARRIER_STATES } from './darkMatter/MemoryCarrier.js';
import { GalacticCoreMemory } from './darkMatter/GalacticCoreMemory.js';
import { EinsteinRingMemory } from './darkMatter/EinsteinRingMemory.js';
import { CosmicWebMemory } from './darkMatter/CosmicWebMemory.js';
import { PlanetaryMonumentMemory } from './darkMatter/PlanetaryMonumentMemory.js';
import { EpilogueSkyboxMemory } from './darkMatter/EpilogueSkyboxMemory.js';
import { SpatialMemoryCamera, SPATIAL_CAMERA_STATES } from './darkMatter/SpatialMemoryCamera.js';
import { getQualityBudget, normalizeQuality } from './darkMatter/qualityBudgets.js';

const TELEMETRY_INTERVAL = 1000 / 15;
const ENTITY_COUNT = 5;
const DPR_LIMITS = Object.freeze({ high: 1.5, medium: 1.25, low: 1 });
const CARRIER_CLASSES = Object.freeze({
  galacticCore: GalacticCoreMemory,
  einsteinRing: EinsteinRingMemory,
  cosmicWeb: CosmicWebMemory,
  planetaryMonument: PlanetaryMonumentMemory,
  epilogueSkybox: EpilogueSkyboxMemory
});
const IMMERSIVE_STATES = new Set([
  SPATIAL_CAMERA_STATES.PASSAGE,
  SPATIAL_CAMERA_STATES.DIVE,
  SPATIAL_CAMERA_STATES.PANORAMA
]);

const detailOf = event => event?.detail || {};
const clamp01 = value => THREE.MathUtils.clamp(Number(value) || 0, 0, 1);

export class DarkMatterRenderer extends CelestialRenderer {
  constructor(canvas, data, options = {}) {
    super(canvas, data, options);
    this.memoryId = data.id;
    this.quality = normalizeQuality(options.quality);
    this.mobile = false;
    this.reducedMotion = false;
    this.environment = null;
    this.cameraRig = null;
    this.discovery = null;
    this.carriers = [];
    this.carrierById = new Map();
    // Keep these public aliases for consumers of the original M8 renderer.
    this.entities = this.carriers;
    this.entityById = this.carrierById;
    this.pickTargets = [];
    this.visitedIds = new Set();
    this.focusedCarrier = null;
    this.focusedEntity = null;
    this.aimedCarrier = null;
    this.aimedTarget = null;
    this.currentCandidate = null;
    this.phase = 'intro';
    this.completed = false;
    this.destroyed = false;
    this.firstFocusSent = false;
    this.lensMilestoneSent = false;
    this.completeMilestoneSent = false;
    this.corePassageEntered = false;
    this.lastDiscovery = null;
    this.lastSample = null;
    this.lastTelemetryAt = -Infinity;
    this.telemetryTimer = null;
    this.pinchBaseDistance = 0;
    this.performanceQuality = this.quality;
    this.raycaster = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.centerNdc = new THREE.Vector2(0, 0);
    this.sceneTarget = new THREE.Vector3(0, 0, -10);
    this.scratchPosition = new THREE.Vector3();
  }

  async init() {
    const width = this.canvas.clientWidth || window.innerWidth;
    const height = this.canvas.clientHeight || window.innerHeight;
    this.mobile = width <= 768 || Boolean(window.matchMedia?.('(pointer: coarse)').matches);
    this.reducedMotion = Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(1, height);
    this.camera.fov = 52;
    this.camera.near = 0.1;
    this.camera.far = 4000;
    this.camera.updateProjectionMatrix();
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.78;
    this.scene.background = new THREE.Color(0x000000);
    this._applyPixelRatio();

    this.environment = createDarkMatterEnvironment({
      quality: this.quality,
      mobile: this.mobile,
      reducedMotion: this.reducedMotion,
      pixelRatio: this.renderer.getPixelRatio(),
      stars: { radius: 205 },
      dust: { extent: [92, 42, 68], position: [0, 0, -42] }
    });
    this.scene.add(this.environment.object3D);
    this.environment.setPixelRatio(this.renderer.getPixelRatio());

    this._createCarriers();
    this.discovery = new M8DiscoveryController();
    this.discovery.setCarriers(this.carriers);
    this._unlockEligible(true);

    this.cameraRig = new SpatialMemoryCamera(this.camera, {
      target: this.sceneTarget, distance: 22, minDistance: 8, maxDistance: 48,
      yaw: 0.04, pitch: 0.1, reducedMotion: this.reducedMotion
    });
    this.camera.position.set(2, 5, 38);
    this.cameraRig.lookAt(this.sceneTarget);
    this.cameraRig.intro(this.sceneTarget, 22, 1.45);

    this.bindEvent(window, 'spatialMemoryScanRequested', event => {
      const detail = detailOf(event);
      if (detail.memoryId && detail.memoryId !== this.memoryId) return;
      if (detail.action === 'activate') this._activateFocused();
      else this._beginWebScan(detail.entityId, 'event');
    });
    this.bindEvent(window, 'spatialMemoryReturnOverview', event => {
      const detail = detailOf(event);
      if (detail.memoryId && detail.memoryId !== this.memoryId) return;
      if (this._returnOverview()) event.preventDefault?.();
    });

    await Promise.allSettled(this.carriers.map(carrier => carrier.ready).filter(Boolean));
    if (this.destroyed) return;
    this._emitReady();
    this._emitTelemetry(true);
  }

  _createCarriers() {
    const photos = Array.isArray(this.media.photos) ? this.media.photos : [];
    const order = Array.isArray(this.data.experience?.entityOrder)
      ? this.data.experience.entityOrder : photos.map(photo => photo.id);
    const ordered = order.map(id => photos.find(photo => photo.id === id)).filter(Boolean);
    const types = new Set(ordered.map(source => source.carrier));
    if (ordered.length !== ENTITY_COUNT || Object.keys(CARRIER_CLASSES).some(type => !types.has(type))) {
      throw new Error('DarkMatterRenderer requires exactly one of each of the five MemoryCarrier implementations.');
    }

    const budget = getQualityBudget(this.quality, this.mobile);
    for (const source of ordered) {
      const Carrier = CARRIER_CLASSES[source.carrier];
      const unlocked = (source.unlockAfter || []).length === 0;
      const carrier = new Carrier({ ...source, locked: !unlocked }, {
        quality: this.quality,
        mobile: this.mobile,
        reducedMotion: this.reducedMotion,
        unlocked,
        visited: Boolean(source.visited),
        textureLoader: this.textureLoader,
        capacity: source.carrier === 'galacticCore' ? budget.galaxy : budget.webSegments
      });
      if (Array.isArray(source.position)) carrier.position.fromArray(source.position);
      if (Array.isArray(source.rotation)) carrier.rotation.fromArray(source.rotation);
      carrier.userData.memoryCarrier = carrier;
      carrier.setQuality(this.quality, this.mobile);
      carrier.setReducedMotion(this.reducedMotion);
      if (carrier.visited) this.visitedIds.add(carrier.memoryId);
      this.scene.add(carrier);
      this.carriers.push(carrier);
      this.carrierById.set(carrier.memoryId, carrier);
    }
  }

  _dependenciesMet(carrier) {
    return (carrier.data.unlockAfter || []).every(id => this.visitedIds.has(id));
  }

  _unlockEligible(immediate = false) {
    const unlockedIds = [];
    this.pickTargets.length = 0;
    let candidate = null;
    for (const carrier of this.carriers) {
      const unlocked = carrier.visited || this._dependenciesMet(carrier);
      const changed = unlocked && !carrier.unlocked;
      carrier.setUnlocked(unlocked);
      carrier.visible = unlocked;
      for (const target of carrier.hitTargets || []) target.visible = unlocked;
      if (changed && !immediate) unlockedIds.push(carrier.memoryId);
      if (unlocked && !carrier.visited) this.pickTargets.push(...(carrier.hitTargets || []));
      if (unlocked && !carrier.visited && !candidate) candidate = carrier;
    }
    this.currentCandidate = candidate;
    return unlockedIds;
  }

  _carrierFromHit(object) {
    let current = object;
    while (current) {
      if (current.userData?.memoryCarrier) return current.userData.memoryCarrier;
      current = current.parent;
    }
    return null;
  }

  _raycast(ndc) {
    if (!this.pickTargets.length) return { carrier: null, target: null };
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.pickTargets, false);
    for (const hit of hits) {
      const carrier = this._carrierFromHit(hit.object);
      if (carrier?.unlocked && !carrier.visited) return { carrier, target: hit.object };
    }
    return { carrier: null, target: null };
  }

  _pick(x, y) {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    this.ndc.set(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
    return this._raycast(this.ndc).carrier;
  }

  _focus(carrier) {
    if (!carrier?.unlocked || carrier.visited || this.completed) return false;
    if (this.focusedCarrier !== carrier) {
      this.focusedCarrier = carrier;
      this.focusedEntity = carrier;
      this.discovery?.setFocusedCarrier(carrier);
      this.currentCandidate = carrier;
    }
    this.phase = 'focus';
    const metadata = carrier.getFocusMetadata({});
    const offset = carrier.data.focusOffset || [0, 0, 0];
    const duration = this.reducedMotion ? 0 : 0.82;
    if (carrier.carrierType === 'planetaryMonument') {
      this.cameraRig.dive(metadata, { altitude: metadata.altitude, duration });
      this.phase = 'dive';
    } else if (carrier.carrierType === 'epilogueSkybox') {
      carrier.enterPanorama();
      this.cameraRig.panorama(carrier, { duration });
      this.phase = 'panorama';
    } else {
      const distance = carrier.carrierType === 'galacticCore'
        ? Math.max(carrier.radius * 1.25, 20)
        : Math.max(5.5, Math.abs(offset[2] || 0));
      this.cameraRig.focus(metadata, { distance, duration });
    }
    this._emitFocus(carrier, false, this._prompt(carrier));
    if (!this.firstFocusSent) {
      this.firstFocusSent = true;
      this._emitMilestone('first-focus');
    }
    if (carrier.data.role === 'lensReflection' && !this.lensMilestoneSent) {
      this.lensMilestoneSent = true;
      this._emitMilestone('lens-reflection');
    }
    this._emitTelemetry(true);
    return true;
  }

  _enterCorePassage(carrier = this.focusedCarrier) {
    if (carrier?.carrierType !== 'galacticCore' || carrier.state !== MEMORY_CARRIER_STATES.REVEALED) return false;
    if (this.corePassageEntered) return true;
    this.corePassageEntered = true;
    carrier.enterPassage();
    this.cameraRig.passage(carrier, { depth: Math.max(3, carrier.radius * 0.18), duration: this.reducedMotion ? 0 : 1.15 });
    this.phase = 'passage';
    this._emitFocus(carrier, false, '穿过星系核心，再次点击即可收取这段记忆。');
    this._emitTelemetry(true);
    return true;
  }

  _activateFocused() {
    const carrier = this.focusedCarrier;
    if (!carrier || carrier.visited) return false;
    if (carrier.state !== MEMORY_CARRIER_STATES.REVEALED) return false;
    if (carrier.carrierType === 'galacticCore' && !this.corePassageEntered) return this._enterCorePassage(carrier);
    const triggers = {
      galacticCore: 'gaze-capture',
      einsteinRing: 'ring-capture',
      cosmicWeb: 'scan-capture',
      planetaryMonument: 'monument-capture',
      epilogueSkybox: 'epilogue-capture'
    };
    return this._capture(carrier, triggers[carrier.carrierType]);
  }

  _beginWebScan(requestedId = null, source = 'keyboard') {
    const requested = requestedId ? this.carrierById.get(requestedId) : this.focusedCarrier;
    const carrier = requested?.carrierType === 'cosmicWeb'
      ? requested : (this.currentCandidate?.carrierType === 'cosmicWeb' ? this.currentCandidate : null);
    if (!carrier?.unlocked || carrier.visited) {
      this._emitFocus(carrier, !carrier?.unlocked, '准星内没有可扫描的宇宙网记忆。');
      return false;
    }
    if (this.focusedCarrier !== carrier) this._focus(carrier);
    const result = this.discovery.beginScan(carrier.memoryId, source);
    if (result.started) {
      this.phase = 'scan';
      this._emitFocus(carrier, false, '扫描进行中，请保持对准。');
      this._emitTelemetry(true);
    }
    return result.started;
  }

  _capture(carrier, trigger) {
    if (!carrier || carrier.visited || carrier.state !== MEMORY_CARRIER_STATES.REVEALED) return false;
    carrier.setVisited(true);
    if (carrier.carrierType === 'einsteinRing') carrier.setTransformationProgress?.(1);
    if (carrier.carrierType === 'cosmicWeb') carrier.setCaptureProgress?.(1);
    this.visitedIds.add(carrier.memoryId);
    const epilogue = this.carriers.find(item => item.carrierType === 'epilogueSkybox');
    epilogue?.setCollectedIds(Array.from(this.visitedIds));
    const unlockedIds = this._unlockEligible();
    const progress = this.visitedIds.size / this.carriers.length;
    window.dispatchEvent(new CustomEvent('spatialMemoryVisited', { detail: {
      ...this._carrierDetail(carrier), visitedIds: Array.from(this.visitedIds),
      visitedCount: this.visitedIds.size, totalEntities: this.carriers.length,
      explorationProgress: progress, progress, trigger, unlockedIds,
      status: `已发现 ${this.visitedIds.size} / ${this.carriers.length} 段记忆。`
    }}));
    if (this.visitedIds.size === this.carriers.length) this._complete(carrier);
    else this._returnOverview();
    this._emitTelemetry(true);
    return true;
  }

  _complete(carrier) {
    if (this.completed) return;
    this.completed = true;
    this.phase = 'tableau';
    const epilogue = this.carriers.find(item => item.carrierType === 'epilogueSkybox');
    epilogue?.setCollectedIds(Array.from(this.visitedIds));
    epilogue?.enterPanorama();
    epilogue?.setTableau(true);
    if (this.cameraRig?.state !== SPATIAL_CAMERA_STATES.PANORAMA && epilogue) {
      this.cameraRig.panorama(epilogue, { duration: this.reducedMotion ? 0 : 0.8 });
    }
    window.dispatchEvent(new CustomEvent('hiddenMemoryUnlocked', { detail: {
      ...this._carrierDetail(carrier), hiddenMemoryId: this.media.hiddenMemoryId,
      visitedIds: Array.from(this.visitedIds), visitedCount: this.visitedIds.size,
      totalEntities: this.carriers.length, explorationProgress: 1, progress: 1
    }}));
    if (!this.completeMilestoneSent) {
      this.completeMilestoneSent = true;
      this._emitMilestone('complete');
    }
  }

  _returnOverview() {
    if (!this.cameraRig || (!this.focusedCarrier && this.cameraRig.state === SPATIAL_CAMERA_STATES.OVERVIEW)) return false;
    const previous = this.focusedCarrier;
    previous?.exitPassage?.();
    if (!this.completed) previous?.exitPanorama?.();
    this.discovery?.cancelScan('overview');
    this.discovery?.setFocusedCarrier(null);
    if (!this.cameraRig.returnToOverview(this.reducedMotion ? 0 : 0.7)) {
      this.cameraRig.overview(this.sceneTarget, 22, this.reducedMotion ? 0 : 0.7);
    }
    this.focusedCarrier = null;
    this.focusedEntity = null;
    this.corePassageEntered = false;
    this.lastDiscovery = null;
    this.lastSample = null;
    this.phase = this.completed ? 'tableau' : 'overview';
    this._emitFocus(null, false, this.completed ? '五段记忆已连成星座。' : '继续移动视角寻找记忆。');
    this._emitTelemetry(true);
    return true;
  }

  _carrierDetail(carrier = this.focusedCarrier) {
    const sample = carrier === this.focusedCarrier ? this.lastSample : null;
    return {
      memoryId: this.memoryId,
      ...this._carrierSnapshot(carrier),
      interaction: sample?.interaction || sample?.type || null,
      alignment: Number.isFinite(sample?.alignment) ? sample.alignment : null,
      proximity: Number.isFinite(sample?.proximity) ? sample.proximity : null,
      prompt: carrier ? this._prompt(carrier) : ''
    };
  }

  _carrierSnapshot(carrier) {
    return {
      entityId: carrier?.memoryId || null,
      carrier: carrier?.carrierType || null,
      state: carrier?.state || null,
      visited: Boolean(carrier?.visited),
      unlocked: Boolean(carrier?.unlocked),
      discoveryProgress: carrier?.discoveryProgress || 0,
      canScan: Boolean(
        carrier?.carrierType === 'cosmicWeb'
        && carrier.unlocked
        && !carrier.visited
        && carrier.state !== MEMORY_CARRIER_STATES.REVEALED
      ),
      canCapture: carrier?.state === MEMORY_CARRIER_STATES.REVEALED,
      accent: carrier?.data.accent || null
    };
  }

  _prompt(carrier) {
    if (!carrier) return this.completed ? '五段记忆已连成星座。' : '移动视角寻找记忆。';
    if (carrier.visited) return `「${carrier.data.title}」已收取。`;
    if (!carrier.unlocked) return '这段记忆仍被引力锁定。';
    if (carrier.state === MEMORY_CARRIER_STATES.REVEALED) {
      if (carrier.carrierType === 'galacticCore' && !this.corePassageEntered) return '核心已显形。点击或向前缩放进入通道。';
      return '记忆已显形。再次点击即可收取。';
    }
    const prompts = {
      galacticCore: '保持凝视核心 2 秒。',
      einsteinRing: '保持对准引力环的正面。',
      cosmicWeb: '长按或按 Space 开始扫描。',
      planetaryMonument: '接近并对准行星纪念碑。',
      epilogueSkybox: '环顾全景，让最后的星光汇合。'
    };
    return prompts[carrier.carrierType] || '保持对准以发现记忆。';
  }

  _emitReady() {
    window.dispatchEvent(new CustomEvent('darkMatterReady', { detail: {
      memoryId: this.memoryId, version: 2, hiddenMemoryCount: this.carriers.length,
      requiredCount: this.carriers.length,
      carriers: this.carriers.map(carrier => this._carrierSnapshot(carrier)),
      drawCallExpectation: (this.environment?.drawCalls || 0) + this.carriers.reduce((sum, carrier) => sum + (carrier.drawCalls || 1), 0)
    }}));
  }

  _emitFocus(carrier, locked = false, status = '') {
    window.dispatchEvent(new CustomEvent('spatialMemoryFocus', { detail: {
      ...this._carrierDetail(carrier), role: carrier?.data.role || null,
      title: carrier?.data.title || '', caption: carrier?.data.caption || '', body: carrier?.data.body || '',
      discoveryType: carrier?.data.discovery?.type || this.lastSample?.type || null,
      visited: Boolean(carrier?.visited), locked, status
    }}));
  }

  _emitMilestone(name) {
    window.dispatchEvent(new CustomEvent('darkMatterMilestone', { detail: {
      ...this._carrierDetail(), name, milestone: name,
      progress: this.carriers.length ? this.visitedIds.size / this.carriers.length : 0
    }}));
  }

  _status() {
    if (this.completed) return '五段记忆已连成星座。';
    if (this.focusedCarrier) return this._prompt(this.focusedCarrier);
    return `空间扫描 ${this.visitedIds.size} / ${this.carriers.length}`;
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
    const progress = this.carriers.length ? this.visitedIds.size / this.carriers.length : 0;
    const status = this._status();
    const carrierDetail = this._carrierDetail();
    const detail = {
      ...carrierDetail, sceneType: 'darkMatter', phase: this.phase,
      explorationProgress: progress, focusedEntityId: this.focusedCarrier?.memoryId || null,
      aimedEntityId: this.aimedCarrier?.memoryId || null, visitedCount: this.visitedIds.size,
      totalEntities: this.carriers.length,
      carriers: this.carriers.map(carrier => this._carrierSnapshot(carrier)),
      values: { status }, status, timestamp: Date.now()
    };
    window.dispatchEvent(new CustomEvent('sceneTelemetry', { detail }));
    if (force) window.dispatchEvent(new CustomEvent('darkMatterTelemetry', { detail: {
      ...carrierDetail, progress, convergence: progress, capturedCount: this.visitedIds.size,
      requiredCount: this.carriers.length, strength: progress, longing: progress,
      lensReflection: this.lensMilestoneSent
    }}));
  }

  onTap(x, y) {
    if (this._activateFocused()) return true;
    const carrier = this._pick(x, y);
    if (carrier) {
      if (carrier === this.focusedCarrier) return this._activateFocused() || true;
      return this._focus(carrier);
    }
    if (IMMERSIVE_STATES.has(this.cameraRig?.state)) return this._activateFocused();
    if (this.focusedCarrier) return this._returnOverview();
    return false;
  }

  onLongPress(x, y, duration) {
    const carrier = this._pick(x, y);
    if (carrier?.carrierType !== 'cosmicWeb') return false;
    return this._beginWebScan(carrier.memoryId, `longPress:${Math.round(duration || 0)}`);
  }

  onDragStart() {
    if (IMMERSIVE_STATES.has(this.cameraRig?.state)) return false;
    if (this.focusedCarrier) this._returnOverview();
    return this.cameraRig?.onDragStart() || false;
  }

  onDrag(deltaX, deltaY) {
    if (IMMERSIVE_STATES.has(this.cameraRig?.state)) return false;
    if (this.cameraRig?.onDrag(deltaX, deltaY)) {
      this.phase = 'overview';
      this._emitTelemetry();
      return true;
    }
    return false;
  }

  onDragEnd() { this.cameraRig?.onDragEnd(); }

  onScroll(deltaY) {
    if (deltaY < 0 && this._enterCorePassage()) return true;
    if (IMMERSIVE_STATES.has(this.cameraRig?.state)) return false;
    if (this.focusedCarrier) this._returnOverview();
    const changed = this.cameraRig?.onScroll(deltaY) || false;
    this.phase = this.completed ? 'tableau' : 'overview';
    this._emitTelemetry();
    return changed;
  }

  onPinch(scale, _centerX, _centerY, phase = 'move') {
    if (phase !== 'end' && scale > 1 && this._enterCorePassage()) return true;
    if (IMMERSIVE_STATES.has(this.cameraRig?.state)) return false;
    if (this.focusedCarrier) this._returnOverview();
    if (phase === 'start' || !this.pinchBaseDistance) this.pinchBaseDistance = this.cameraRig?.targetDistance || 22;
    if (phase === 'end') { this.pinchBaseDistance = 0; return true; }
    if (this.cameraRig && Number.isFinite(scale) && scale > 0) {
      this.cameraRig.targetDistance = THREE.MathUtils.clamp(
        this.pinchBaseDistance / scale, this.cameraRig.minDistance, this.cameraRig.maxDistance
      );
    }
    this._emitTelemetry();
    return true;
  }

  onKeyDown(key) {
    if (key === 'Escape') return this._returnOverview();
    if (key === ' ' || key === 'Spacebar') return this._beginWebScan(null, 'keyboard');
    if (key === 'Enter') return this.focusedCarrier ? this._activateFocused() : this._focus(this.currentCandidate);
    const dolly = key === 'w' || key === 'W' || key === 'ArrowUp' ? -90
      : (key === 's' || key === 'S' || key === 'ArrowDown' ? 90 : 0);
    if (dolly) return this.onScroll(dolly);
    const orbit = key === 'a' || key === 'A' || key === 'ArrowLeft' ? -0.14
      : (key === 'd' || key === 'D' || key === 'ArrowRight' ? 0.14 : 0);
    if (orbit && !IMMERSIVE_STATES.has(this.cameraRig?.state)) {
      if (this.focusedCarrier) this._returnOverview();
      this.cameraRig.targetYaw += orbit;
      this.phase = this.completed ? 'tableau' : 'overview';
      this._emitTelemetry(true);
      return true;
    }
    return false;
  }

  announceState() {
    this._emitReady();
    this._emitFocus(this.focusedCarrier, false, this._status());
    this._emitTelemetry(true);
  }

  _discoveryContext() {
    const carrier = this.focusedCarrier;
    if (!carrier) return null;
    carrier.getWorldPosition(this.scratchPosition);
    const distance = this.camera.position.distanceTo(this.scratchPosition);
    const immersiveView = IMMERSIVE_STATES.has(this.cameraRig?.state);
    const aimed = this.aimedCarrier === carrier || immersiveView;
    const proximity = clamp01(1 - distance / (carrier.data.discovery?.distance || 18));
    const base = {
      camera: this.camera, focused: true, aimed, isAimed: aimed,
      aimedTarget: this.aimedTarget, hitTarget: this.aimedTarget,
      target: this.aimedTarget, distance, proximity,
      inProximity: proximity > 0, near: proximity > 0,
      scanning: this.discovery?.scan?.carrierId === carrier.memoryId,
      scanProgress: this.discovery?.scanProgress || 0
    };
    const sample = carrier.getDiscoverySample(base) || {};
    this.lastSample = sample;
    return {
      ...base,
      alignment: Number.isFinite(sample.alignment) ? sample.alignment : base.alignment,
      proximity: Number.isFinite(sample.proximity) ? sample.proximity : proximity,
      inProximity: sample.inProximity ?? base.inProximity,
      near: sample.inProximity ?? base.near
    };
  }

  update(deltaTime, elapsedTime) {
    const dt = Math.min(Math.max(deltaTime || 0, 0), 0.05);
    this.cameraRig?.update(dt);
    this.environment?.update(dt, elapsedTime);
    const carrierContext = { camera: this.camera, elapsed: elapsedTime };
    for (const carrier of this.carriers) carrier.update(dt, carrierContext);

    const centerHit = this._raycast(this.centerNdc);
    this.aimedCarrier = centerHit.carrier;
    this.aimedTarget = centerHit.target;
    const context = this._discoveryContext();
    if (context && this.discovery) {
      this.lastDiscovery = this.discovery.update(dt, context);
      this.lastSample = this.lastDiscovery.sample || this.lastSample;
      if (this.lastDiscovery.discovered) {
        this._emitFocus(this.focusedCarrier, false, this._prompt(this.focusedCarrier));
        this._emitTelemetry(true);
      }
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
    for (const carrier of this.carriers) carrier.setQuality(this.quality, this.mobile);
  }

  onQualityChange(value) {
    this.quality = normalizeQuality(value);
    this.performanceQuality = this.quality;
    this._applyPixelRatio();
    this.environment?.setQuality(this.quality, this.mobile);
    for (const carrier of this.carriers) carrier.setQuality(this.quality, this.mobile);
  }

  onPerformanceSample(sample) {
    const fps = Number(typeof sample === 'number' ? sample : sample?.fps ?? sample?.averageFps);
    if (!Number.isFinite(fps)) return false;
    let next = this.performanceQuality;
    if (fps < 20) next = 'low';
    else if (this.performanceQuality === 'high' && fps < 30) next = 'medium';
    else if (this.performanceQuality === 'low' && fps > 25) next = 'medium';
    else if (this.performanceQuality === 'medium' && fps > 36) next = 'high';
    if (next === this.performanceQuality) return false;
    this.performanceQuality = next;
    this.onQualityChange(next);
    return true;
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.telemetryTimer !== null) clearTimeout(this.telemetryTimer);
    this.telemetryTimer = null;
    this.discovery?.dispose();
    this.discovery = null;
    for (const carrier of this.carriers) carrier.dispose();
    this.carriers.length = 0;
    this.carrierById.clear();
    this.pickTargets.length = 0;
    this.environment?.dispose();
    this.environment = null;
    this.cameraRig = null;
    this.focusedCarrier = null;
    this.focusedEntity = null;
    super.destroy();
  }
}
