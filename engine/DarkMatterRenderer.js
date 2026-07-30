import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { CelestialRenderer } from '../core/CelestialRenderer.js';
import { createDeepSpaceField } from './darkMatter/DeepSpaceField.js';
import { createCosmicVolumeBackdrop } from './darkMatter/CosmicVolumeBackdrop.js';
import { createSharpCosmicWeb } from './darkMatter/SharpCosmicWeb.js';
import { createSharpSpiralGalaxy } from './darkMatter/SharpSpiralGalaxy.js';
import { createRibbonNebulaClusters } from './darkMatter/RibbonNebulaClusters.js';
import { createHexScanWave } from './darkMatter/HexScanWave.js';
import { CrystalMemoryNode } from './darkMatter/CrystalMemoryNode.js';
import { MEMORY_CARRIER_STATES } from './darkMatter/MemoryCarrier.js';
import { SpatialMemoryCamera, SPATIAL_CAMERA_STATES } from './darkMatter/SpatialMemoryCamera.js';
import { getQualityBudget, MAX_ENVIRONMENT_BUDGET, normalizeQuality } from './darkMatter/qualityBudgets.js';

const TELEMETRY_INTERVAL = 1000 / 15;
const DPR_LIMITS = Object.freeze({ high: 1.5, medium: 1.25, low: 1 });
const ENTITY_COUNT = 5;
const FINAL_TYPE = 'finalSingularity';
const clamp01 = value => THREE.MathUtils.clamp(Number(value) || 0, 0, 1);

export class DarkMatterRenderer extends CelestialRenderer {
  constructor(canvas, data, options = {}) {
    super(canvas, data, { ...options, antialias: options.antialias !== false });
    this.memoryId = data.id;
    this.quality = normalizeQuality(options.quality);
    this.mobile = false;
    this.reducedMotion = false;
    this.destroyed = false;
    this.completed = false;
    this.phase = 'intro';
    this.nodes = [];
    this.nodeById = new Map();
    this.entities = this.nodes;
    this.entityById = this.nodeById;
    this.pickTargets = [];
    this.visitedIds = new Set();
    this.focusedNode = null;
    this.focusedCarrier = null;
    this.aimedNode = null;
    this.currentCandidate = null;
    this.modules = [];
    this.stars = null;
    this.backdrop = null;
    this.web = null;
    this.galaxy = null;
    this.nebulae = null;
    this.scanWave = null;
    this.cameraRig = null;
    this.lastTelemetryAt = -Infinity;
    this.telemetryTimer = null;
    this.scanStrength = 0;
    this.pinchBaseDistance = 0;
    this.firstFocusSent = false;
    this.completeMilestoneSent = false;
    this.performanceQuality = this.quality;
    this.raycaster = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.centerNdc = new THREE.Vector2(0, 0);
    this.sceneTarget = new THREE.Vector3(0, 0, -18);
    this.scratchPosition = new THREE.Vector3();
    this.scratchProjection = new THREE.Vector3();
    this.reticle = null;
  }

  async init() {
    const width = this.canvas.clientWidth || window.innerWidth;
    const height = this.canvas.clientHeight || window.innerHeight;
    this.mobile = width <= 768 || Boolean(window.matchMedia?.('(pointer: coarse)').matches);
    this.reducedMotion = Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(1, height);
    this.camera.fov = 50;
    this.camera.near = 0.05;
    this.camera.far = 2400;
    this.camera.updateProjectionMatrix();
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.scene.background = new THREE.Color(0x01020a);
    this._applyPixelRatio();
    this._createEnvironment();
    this._createNodes();

    this.cameraRig = new SpatialMemoryCamera(this.camera, {
      target: this.sceneTarget, distance: 22, minDistance: 2, maxDistance: 54,
      yaw: 0.04, pitch: 0.08, rotateSpeed: 0.0024, zoomSpeed: 0.0015,
      damping: 5.2, reducedMotion: this.reducedMotion
    });
    this.camera.position.set(2, 3, 31);
    this.cameraRig.lookAt(this.sceneTarget);
    this.cameraRig.intro(this.sceneTarget, 22, 1.5);

    this.reticle = document.querySelector('.m8-spatial__reticle');
    this.canvas.style.cursor = 'none';
    this.bindEvent(this.canvas, 'pointermove', event => this._onPointerMove(event));
    this.bindEvent(this.canvas, 'pointerleave', () => this._clearAim());
    this.bindEvent(window, 'spatialMemoryScanRequested', event => {
      const detail = event.detail || {};
      if (detail.memoryId && detail.memoryId !== this.memoryId) return;
      if (detail.action === 'activate') this._anchorFocused(detail.trigger || 'button');
      else this._scan(detail.trigger || 'event');
    });
    this.bindEvent(window, 'spatialMemoryReturnOverview', event => {
      const detail = event.detail || {};
      if (detail.memoryId && detail.memoryId !== this.memoryId) return;
      if (this._returnOverview()) event.preventDefault?.();
    });

    await Promise.allSettled(this.nodes.map(node => node.ready));
    if (this.destroyed) return;
    this._emitReady();
    this._emitFocus(null, '拖动巡航，滚轮深潜；Space 扫描不可见质量。');
    this._emitTelemetry(true);
  }

  _createEnvironment() {
    const budget = getQualityBudget(this.quality, this.mobile);
    this.backdrop = createCosmicVolumeBackdrop({ position: [0, 0, -18], radius: 150, intensity: 1 });
    this.stars = createDeepSpaceField({
      quality: this.quality, mobile: this.mobile, capacity: MAX_ENVIRONMENT_BUDGET.stars,
      radius: 220, pixelRatio: this.renderer.getPixelRatio()
    });
    this.web = createSharpCosmicWeb({
      quality: this.quality, mobile: this.mobile, capacity: MAX_ENVIRONMENT_BUDGET.webSegments,
      nodes: 72, flowPoints: MAX_ENVIRONMENT_BUDGET.webFlowPoints,
      extent: [38, 23, 30], exclusion: [7.8, 5.2, 5.5], position: [0, 0, -21],
      nodeSize: 0.28, ribbonWidth: 0.9, opacity: 0.52,
      pixelRatio: this.renderer.getPixelRatio()
    });
    this.galaxy = createSharpSpiralGalaxy({
      quality: this.quality, mobile: this.mobile, capacity: MAX_ENVIRONMENT_BUDGET.galaxy,
      radius: 8.4, position: [0, -0.35, -19], inclination: 0.52,
      yaw: -0.08, roll: 0.42, rotationSpeed: Math.PI * 2 / 230,
      haloMinOpacity: 0.025, haloMaxOpacity: 0.1,
      pixelRatio: this.renderer.getPixelRatio()
    });
    this.nebulae = createRibbonNebulaClusters({
      quality: this.quality, mobile: this.mobile, segments: MAX_ENVIRONMENT_BUDGET.nebulaSegments,
      position: [0, 0, -23], opacity: 0.44, pixelRatio: this.renderer.getPixelRatio()
    });
    this.nebulae.object3D.scale.setScalar(0.125);
    this.scanWave = createHexScanWave({ rings: 5, radius: 30, duration: 1.35, color: 0x77dcff });
    this.scanWave.object3D.renderOrder = 20;
    this.modules = [this.backdrop, this.stars, this.nebulae, this.web, this.galaxy, this.scanWave];
    for (const module of this.modules) this.scene.add(module.object3D);
    this.stars.setReducedMotion(this.reducedMotion);
    this.nebulae.setReducedMotion(this.reducedMotion);
    this._syncEnvironmentViewport();
  }

  _createNodes() {
    const sourceNodes = this.media.crystalNodes ?? this.media.photos ?? [];
    const order = this.data.experience?.entityOrder ?? sourceNodes.map(node => node.id);
    const ordered = order.map(id => sourceNodes.find(node => node.id === id)).filter(Boolean);
    if (ordered.length !== ENTITY_COUNT) throw new Error('M8 requires exactly five crystal nodes.');
    for (const source of ordered) {
      const color = source.energyColor || source.accent || '#8edcff';
      const size = source.crystalType === FINAL_TYPE ? 0.38 : Math.max(0.72, Math.min(...source.size) * 0.42);
      const node = new CrystalMemoryNode({ ...source, carrier: 'crystalMemoryNode', locked: false }, {
        quality: this.quality, mobile: this.mobile, reducedMotion: this.reducedMotion,
        unlocked: true, visited: Boolean(source.visited), textureLoader: this.textureLoader,
        crystalType: source.crystalType, size, color, hotColor: color,
        imageSize: source.size, hitRadius: source.crystalType === FINAL_TYPE ? 0.7 : size * 1.55
      });
      node.position.fromArray(source.position);
      node.rotation.fromArray(source.rotation);
      node.userData.memoryCarrier = node;
      node.visible = source.crystalType !== FINAL_TYPE;
      node.setQuality(this.quality);
      node.setReducedMotion(this.reducedMotion);
      if (node.visited) this.visitedIds.add(node.memoryId);
      this.scene.add(node);
      this.nodes.push(node);
      this.nodeById.set(node.memoryId, node);
      this.pickTargets.push(...node.hitTargets);
    }
    this.currentCandidate = this.nodes.find(node => !node.visited && node.crystalType !== FINAL_TYPE) || null;
  }

  _setNdc(x, y) {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    this.ndc.set(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
    return true;
  }

  _nodeFromHit(object) {
    let current = object;
    while (current) {
      if (current.userData?.memoryCarrier) return current.userData.memoryCarrier;
      current = current.parent;
    }
    return null;
  }

  _raycast(ndc) {
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.pickTargets.filter(target => target.visible), false);
    for (const hit of hits) {
      const node = this._nodeFromHit(hit.object);
      if (node?.unlocked) return node;
    }
    return null;
  }

  _pick(x, y) { return this._setNdc(x, y) ? this._raycast(this.ndc) : null; }

  _onPointerMove(event) {
    const node = this._pick(event.clientX, event.clientY);
    if (this.aimedNode !== node) {
      this.aimedNode?.setFocusIntensity(this.aimedNode === this.focusedNode ? 1 : 0);
      this.aimedNode = node;
      node?.setFocusIntensity(1);
      this.web?.setResonance(node ? 0.5 : 0);
    }
    if (!this.reticle) return;
    let x = event.clientX;
    let y = event.clientY;
    if (node) {
      node.getWorldPosition(this.scratchProjection).project(this.camera);
      const rect = this.canvas.getBoundingClientRect();
      const targetX = rect.left + (this.scratchProjection.x + 1) * rect.width * 0.5;
      const targetY = rect.top + (1 - this.scratchProjection.y) * rect.height * 0.5;
      const dx = THREE.MathUtils.clamp(targetX - x, -20, 20);
      const dy = THREE.MathUtils.clamp(targetY - y, -20, 20);
      x += dx * 0.7;
      y += dy * 0.7;
      this.reticle.style.setProperty('--reticle-color', node.data.energyColor || '#ffffff');
    } else this.reticle.style.setProperty('--reticle-color', '#ffffff');
    this.reticle.style.left = `${x}px`;
    this.reticle.style.top = `${y}px`;
  }

  _clearAim() {
    this.aimedNode?.setFocusIntensity(this.aimedNode === this.focusedNode ? 1 : 0);
    this.aimedNode = null;
    this.web?.setResonance(0);
    if (this.reticle) {
      this.reticle.style.left = '50%';
      this.reticle.style.top = '50%';
    }
  }

  _focus(node) {
    if (!node?.unlocked) return false;
    if (this.focusedNode && this.focusedNode !== node) this.focusedNode.retract();
    this.focusedNode = node;
    this.focusedCarrier = node;
    this.currentCandidate = node;
    node.setFocused(true);
    if (!node.visited) node.setDiscoveryProgress(1);
    node.unfold();
    this.nodes.forEach(item => { if (item !== node) item.setFocusIntensity(0); });
    this.web.setOpacity(0.28);
    this.nebulae.setOpacity(0.2);
    this.galaxy.setIntensity(0.62);
    this.phase = 'focus';
    const offset = node.data.focusOffset || [0, 0, 3.2];
    this.cameraRig.focus(node.getFocusMetadata({}), {
      distance: Math.max(2.1, Math.abs(offset[2] || 3.2)),
      duration: this.reducedMotion ? 0 : 0.6
    });
    this._emitFocus(node, node.visited ? '已锚定的记忆重新展开。' : '晶体已展开。选择“锚定记忆”将它收入宇宙网。');
    if (!this.firstFocusSent) { this.firstFocusSent = true; this._emitMilestone('first-focus'); }
    this._emitTelemetry(true);
    return true;
  }

  _anchorFocused(trigger = 'anchor') {
    const node = this.focusedNode;
    if (!node || node.visited || node.state !== MEMORY_CARRIER_STATES.REVEALED) return false;
    node.anchor().capture().setVisited(true);
    this.visitedIds.add(node.memoryId);
    const progress = this.visitedIds.size / this.nodes.length;
    window.dispatchEvent(new CustomEvent('spatialMemoryVisited', { detail: {
      ...this._nodeDetail(node), visitedIds: [...this.visitedIds], visitedCount: this.visitedIds.size,
      totalEntities: this.nodes.length, explorationProgress: progress, progress,
      trigger, unlockedIds: [], status: `已锚定 ${this.visitedIds.size} / ${this.nodes.length} 段记忆。`
    }}));
    if (this.visitedIds.size === this.nodes.length) this._complete(node);
    else this._returnOverview();
    return true;
  }

  _scan(source = 'keyboard') {
    this.scanStrength = 1;
    this.scanWave.object3D.position.copy(this.camera.position);
    this.scanWave.object3D.quaternion.copy(this.camera.quaternion);
    this.scanWave.trigger();
    this.web.setResonance(1);
    this.galaxy.setIntensity(1.15);
    this.nodes.forEach(node => node.setFocusIntensity(node.visited ? 0.2 : 0.8));
    if (this.mobile && navigator.vibrate) navigator.vibrate(40);
    this.phase = 'scan';
    this._emitFocus(this.focusedNode, `暗物质扫描已发射 · ${source}`);
    this._emitTelemetry(true);
    return true;
  }

  _complete(node) {
    if (this.completed) return;
    this.completed = true;
    this.phase = 'tableau';
    this.web.setResonance(1);
    this.nodes.forEach(item => item.setFocusIntensity(1));
    this.cameraRig.tableau(this.sceneTarget, 17, this.reducedMotion ? 0 : 0.8);
    window.dispatchEvent(new CustomEvent('hiddenMemoryUnlocked', { detail: {
      ...this._nodeDetail(node), hiddenMemoryId: this.media.hiddenMemoryId,
      visitedIds: [...this.visitedIds], visitedCount: this.visitedIds.size,
      totalEntities: this.nodes.length, explorationProgress: 1, progress: 1
    }}));
    if (!this.completeMilestoneSent) { this.completeMilestoneSent = true; this._emitMilestone('complete'); }
  }

  _returnOverview() {
    if (!this.cameraRig || (!this.focusedNode && this.cameraRig.state === SPATIAL_CAMERA_STATES.OVERVIEW)) return false;
    this.focusedNode?.retract().setFocused(false);
    if (!this.cameraRig.returnToOverview(this.reducedMotion ? 0 : 0.7)) {
      this.cameraRig.overview(this.sceneTarget, this.cameraRig.targetDistance || 22, this.reducedMotion ? 0 : 0.7);
    }
    this.focusedNode = null;
    this.focusedCarrier = null;
    this.web.setOpacity(0.78);
    this.nebulae.setOpacity(0.44);
    this.galaxy.setIntensity(1);
    this.phase = this.completed ? 'tableau' : 'overview';
    this._emitFocus(null, this.completed ? '五段记忆已锚定。' : '继续巡航宇宙网。');
    this._emitTelemetry(true);
    return true;
  }

  _nodeSnapshot(node) {
    return {
      entityId: node?.memoryId || null, carrier: 'crystalMemoryNode', crystalType: node?.crystalType || null,
      state: node?.state || null, visited: Boolean(node?.visited), unlocked: Boolean(node?.unlocked),
      discoveryProgress: node?.discoveryProgress || 0, canScan: false,
      canCapture: node?.state === MEMORY_CARRIER_STATES.REVEALED,
      aimed: node === this.aimedNode, accent: node?.data.energyColor || node?.data.accent || null
    };
  }

  _nodeDetail(node = this.focusedNode) {
    return { memoryId: this.memoryId, ...this._nodeSnapshot(node), interaction: 'crystal', prompt: node ? node.data.unfoldText : '' };
  }

  _emitReady() {
    window.dispatchEvent(new CustomEvent('darkMatterReady', { detail: {
      memoryId: this.memoryId, version: 3, hiddenMemoryCount: this.nodes.length,
      requiredCount: this.nodes.length, carriers: this.nodes.map(node => this._nodeSnapshot(node)),
      drawCallExpectation: this.modules.reduce((sum, module) => sum + (module.drawCalls || 0), 0) + this.nodes.length * 3
    }}));
  }

  _emitFocus(node, status = '') {
    window.dispatchEvent(new CustomEvent('spatialMemoryFocus', { detail: {
      ...this._nodeDetail(node), role: node?.data.role || null, title: node?.data.title || '',
      caption: node?.data.caption || '', body: node?.data.unfoldText || node?.data.body || '',
      discoveryType: node?.data.discovery?.type || null, locked: false, status
    }}));
  }

  _emitMilestone(name) {
    window.dispatchEvent(new CustomEvent('darkMatterMilestone', { detail: {
      ...this._nodeDetail(), name, milestone: name, progress: this.visitedIds.size / this.nodes.length
    }}));
  }

  _status() {
    if (this.completed) return '五段记忆已锚定，暗物质轮廓完整显形。';
    if (this.focusedNode) return '晶体已展开，等待锚定。';
    if (this.scanStrength > 0) return '暗物质扫描波正在穿过宇宙网。';
    return `记忆晶体 ${this.visitedIds.size} / ${this.nodes.length}`;
  }

  _emitTelemetry(force = false) {
    if (this.destroyed) return;
    const now = performance.now();
    const wait = TELEMETRY_INTERVAL - (now - this.lastTelemetryAt);
    if (wait > 0) {
      if (force && this.telemetryTimer === null) this.telemetryTimer = setTimeout(() => {
        this.telemetryTimer = null; this._emitTelemetry(true);
      }, wait);
      return;
    }
    this.lastTelemetryAt = now;
    const progress = this.nodes.length ? this.visitedIds.size / this.nodes.length : 0;
    const status = this._status();
    const detail = {
      ...this._nodeDetail(), sceneType: 'darkMatter', phase: this.phase,
      explorationProgress: progress, focusedEntityId: this.focusedNode?.memoryId || null,
      aimedEntityId: this.aimedNode?.memoryId || null, visitedCount: this.visitedIds.size,
      totalEntities: this.nodes.length, carriers: this.nodes.map(node => this._nodeSnapshot(node)),
      values: { status }, status, timestamp: Date.now()
    };
    window.dispatchEvent(new CustomEvent('sceneTelemetry', { detail }));
    if (force) window.dispatchEvent(new CustomEvent('darkMatterTelemetry', { detail: {
      ...this._nodeDetail(), progress, convergence: progress, capturedCount: this.visitedIds.size,
      requiredCount: this.nodes.length, strength: progress, longing: progress, lensReflection: progress >= 0.5
    }}));
  }

  onTap(x, y) {
    const node = this._pick(x, y);
    if (node) return this._focus(node);
    if (this.focusedNode) return this._returnOverview();
    return false;
  }

  onLongPress(_x, _y, duration) { return duration >= 1800 ? this._scan('long-press') : false; }
  onDragStart() { if (this.focusedNode) this._returnOverview(); return this.cameraRig?.onDragStart() || false; }
  onDrag(deltaX, deltaY) { const changed = this.cameraRig?.onDrag(deltaX, deltaY) || false; if (changed) this.phase = 'overview'; return changed; }
  onDragEnd() { this.cameraRig?.onDragEnd(); }

  onScroll(deltaY) {
    if (this.focusedNode) this._returnOverview();
    const changed = this.cameraRig?.onScroll(deltaY) || false;
    this.phase = this.completed ? 'tableau' : 'overview';
    this._emitTelemetry();
    return changed;
  }

  onPinch(scale, _centerX, _centerY, phase = 'move') {
    if (this.focusedNode) this._returnOverview();
    if (phase === 'start' || !this.pinchBaseDistance) this.pinchBaseDistance = this.cameraRig?.targetDistance || 22;
    if (phase === 'end') { this.pinchBaseDistance = 0; return true; }
    if (this.cameraRig && Number.isFinite(scale) && scale > 0) {
      this.cameraRig.targetDistance = THREE.MathUtils.clamp(this.pinchBaseDistance / scale, this.cameraRig.minDistance, this.cameraRig.maxDistance);
    }
    return true;
  }

  onKeyDown(key) {
    if (key === 'Escape') return this._returnOverview();
    if (key === ' ' || key === 'Spacebar') return this._scan('keyboard');
    if (key === 'Tab') {
      const available = this.nodes.filter(node => node.visible && !node.visited);
      const index = Math.max(-1, available.indexOf(this.focusedNode));
      return available.length ? this._focus(available[(index + 1) % available.length]) : false;
    }
    if (key === 'Enter') return this.focusedNode ? this._anchorFocused('keyboard') : this._focus(this.aimedNode || this.currentCandidate);
    const dolly = key === 'w' || key === 'W' || key === 'ArrowUp' ? -90 : (key === 's' || key === 'S' || key === 'ArrowDown' ? 90 : 0);
    if (dolly) return this.onScroll(dolly);
    const orbit = key === 'a' || key === 'A' || key === 'ArrowLeft' ? -0.14 : (key === 'd' || key === 'D' || key === 'ArrowRight' ? 0.14 : 0);
    if (orbit) { if (this.focusedNode) this._returnOverview(); this.cameraRig.targetYaw += orbit; return true; }
    return false;
  }

  announceState() { this._emitReady(); this._emitFocus(this.focusedNode, this._status()); this._emitTelemetry(true); }

  update(deltaTime, elapsedTime) {
    const dt = Math.min(Math.max(deltaTime || 0, 0), 0.05);
    this.cameraRig?.update(dt);
    this.stars?.update(dt, elapsedTime);
    this.backdrop?.update(dt, elapsedTime);
    this.web?.update(dt, elapsedTime);
    this.nebulae?.update(dt, elapsedTime);
    this.galaxy?.update(dt, { camera: this.camera });
    this.scanWave?.update(dt);
    for (const node of this.nodes) node.update(dt, { camera: this.camera, elapsed: elapsedTime });

    this.scanStrength = Math.max(0, this.scanStrength - dt * 0.72);
    if (!this.scanStrength && !this.aimedNode && !this.completed) {
      this.web?.setResonance(0);
      if (!this.focusedNode) this.galaxy?.setIntensity(1);
      this.nodes.forEach(node => node.setFocusIntensity(node === this.focusedNode ? 1 : 0));
    }
    const finalNode = this.nodes.find(node => node.crystalType === FINAL_TYPE);
    if (finalNode && !finalNode.visited) {
      finalNode.getWorldPosition(this.scratchPosition);
      finalNode.visible = this.camera.position.distanceTo(this.scratchPosition) < 17;
      finalNode.hitTargets.forEach(target => { target.visible = finalNode.visible; });
    }
    if (!this.focusedNode) {
      const centered = this._raycast(this.centerNdc);
      if (centered && centered !== this.aimedNode) this.currentCandidate = centered;
    }
    if (this.phase === 'intro' && this.cameraRig?.state === SPATIAL_CAMERA_STATES.OVERVIEW) this.phase = 'overview';
    this._emitTelemetry();
  }

  _applyPixelRatio() {
    const limit = this.mobile ? Math.max(1, Math.min(window.devicePixelRatio || 1, 1.5)) : DPR_LIMITS[this.quality];
    const ratio = Math.min(window.devicePixelRatio || 1, limit);
    this.renderer.setPixelRatio(ratio);
    this.stars?.setPixelRatio(ratio);
    this.web?.setPixelRatio(ratio);
    this.galaxy?.setPixelRatio(ratio);
    this.nebulae?.setPixelRatio(ratio);
    this.nodes.forEach(node => node.setPixelRatio(ratio));
    this._syncEnvironmentViewport();
  }

  _syncEnvironmentViewport() {
    const width = this.canvas.clientWidth || window.innerWidth;
    const height = this.canvas.clientHeight || window.innerHeight;
    this.stars?.setViewport(width, height, this.mobile);
    this.web?.setViewport(width, height);
    this.nebulae?.setViewport(width, height);
  }

  _applyVisualQuality() {
    this.stars?.setQuality(this.quality, this.mobile);
    this.web?.setQuality(this.quality, this.mobile);
    this.galaxy?.setQuality(this.quality, this.mobile);
    this.nebulae?.setQuality(this.quality, this.mobile);
    this.nodes.forEach(node => node.setQuality(this.quality));
  }

  onResize(width, height) {
    super.onResize(width, height);
    this.mobile = width <= 768 || Boolean(window.matchMedia?.('(pointer: coarse)').matches);
    this._applyPixelRatio();
    this._applyVisualQuality();
    this._syncEnvironmentViewport();
  }

  onQualityChange(value) {
    this.quality = normalizeQuality(value);
    this.performanceQuality = this.quality;
    this._applyPixelRatio();
    this._applyVisualQuality();
  }

  onPerformanceSample(sample) {
    const fps = Number(typeof sample === 'number' ? sample : sample?.fps ?? sample?.averageFps);
    return Number.isFinite(fps);
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.telemetryTimer !== null) clearTimeout(this.telemetryTimer);
    this.telemetryTimer = null;
    this.canvas.style.cursor = '';
    for (const node of this.nodes) node.dispose();
    this.nodes.length = 0;
    this.nodeById.clear();
    this.pickTargets.length = 0;
    for (const module of this.modules) module.dispose();
    this.modules.length = 0;
    this.backdrop = this.stars = this.web = this.galaxy = this.nebulae = this.scanWave = null;
    this.cameraRig = null;
    this.focusedNode = this.focusedCarrier = this.aimedNode = null;
    super.destroy();
  }
}
