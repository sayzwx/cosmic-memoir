import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { CelestialRenderer } from '../core/CelestialRenderer.js';
import { createDeepSpaceBackground } from '../core/DeepSpaceBackground.js';

export class RocheLimitRenderer extends CelestialRenderer {
  constructor(canvas, data, options = {}) {
    super(canvas, data, options);
    this.params = data.physicsParams || {};
    this.narrative = data.narrative || {};
    this.media = data.media || {};
    this.primary = null;
    this.secondary = null;
    this.rocheLine = null;
    this.lightBridge = null;
    this.debris = null;
    this.starfield = null;
    this.deepSpace = null;
    this.draggedSecondary = false;
    this.dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    this.raycaster = new THREE.Raycaster();
    this.state = 'safe';
    this.locked = false;
    this.rocheLimit = 0;
    this.tidalForce = 0;
    this.currentDistance = 0;
    this.secondaryDensity = 1.0;
    this.rlParams = {};
  }

  async init() {
    const p = this.params.rocheLimit || {};
    this.rlParams = p;
    this.secondaryDensity = p.secondaryDensity || 1.0;

    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();

    this._createPrimary(p);
    this._createSecondary(p);
    this._createStarfield(1000);

    this.deepSpace = createDeepSpaceBackground({
      starCount: 5000, dustCount: 1500, starRadius: 3000,
      dustExtent: [1400, 600, 900], dustPosition: [0, 0, -800],
      pixelRatio: this.renderer.getPixelRatio()
    });
    this.scene.add(this.deepSpace.object3D);

    this.camera.position.set(0, 0, 700);
    this.camera.lookAt(0, 0, 0);

    this.currentDistance = this.secondary.position.x - this.primary.position.x;
    this._calculateRocheLimit();
    this._createRocheLine();
    this._updatePhysics();

    window.dispatchEvent(new CustomEvent('rocheUIReady', {
      detail: {
        density: this.secondaryDensity,
        d_R: this.rocheLimit,
        tidalLockingDistance: p.tidalLockingDistance || 200
      }
    }));
  }

  _createPrimary(p) {
    const radius = Math.max(20, (p.primaryMass || 100) * 0.8);
    const geo = new THREE.SphereGeometry(radius, 48, 48);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xff6633,
      transparent: true,
      opacity: 0.9
    });
    this.primary = new THREE.Mesh(geo, mat);
    this.primary.position.set(-250, 0, 0);
    this.primary.userData = { radius, mass: p.primaryMass || 100 };
    this.scene.add(this.primary);
    this.addDisposable(geo);
    this.addDisposable(mat);

    const glowGeo = new THREE.SphereGeometry(radius * 1.3, 32, 32);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xff4400,
      transparent: true,
      opacity: 0.15,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    this.primary.add(glow);
    this.addDisposable(glowGeo);
    this.addDisposable(glowMat);
  }

  _createSecondary(p) {
    const radius = Math.max(10, (p.secondaryMass || 30) * 0.6);
    const geo = new THREE.SphereGeometry(radius, 32, 32);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x4499ff,
      transparent: true,
      opacity: 0.9
    });
    this.secondary = new THREE.Mesh(geo, mat);
    this.secondary.position.set(250, 0, 0);
    this.secondary.userData = { radius, mass: p.secondaryMass || 30, baseRadius: radius };
    this.scene.add(this.secondary);
    this.addDisposable(geo);
    this.addDisposable(mat);
  }

  _createRocheLine() {
    const geo = new THREE.BufferGeometry();
    const points = [];
    const yRange = 300;
    for (let i = 0; i <= 20; i++) {
      const y = -yRange + (i / 20) * yRange * 2;
      points.push(new THREE.Vector3(this.primary.position.x + this.rocheLimit, y, -10));
    }
    geo.setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending
    });
    this.rocheLine = new THREE.Line(geo, mat);
    this.scene.add(this.rocheLine);
    this.addDisposable(geo);
    this.addDisposable(mat);
  }

  _updateRocheLine() {
    if (!this.rocheLine) return;
    const x = this.primary.position.x + this.rocheLimit;
    const positions = this.rocheLine.geometry.attributes.position.array;
    for (let i = 0; i < positions.length; i += 3) {
      positions[i] = x;
    }
    this.rocheLine.geometry.attributes.position.needsUpdate = true;
  }

  _createStarfield(count) {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const r = 1500 + Math.random() * 2500;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = r * Math.cos(phi);
      const c = 0.3 + Math.random() * 0.7;
      colors[i3] = c;
      colors[i3 + 1] = c * 0.9;
      colors[i3 + 2] = c;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({
      size: 2,
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      sizeAttenuation: false
    });
    this.starfield = new THREE.Points(geo, mat);
    this.scene.add(this.starfield);
    this.addDisposable(geo);
    this.addDisposable(mat);
  }

  _calculateRocheLimit() {
    const p = this.rlParams;
    const pm = p.primaryMass || 100;
    const density = Math.max(0.01, this.secondaryDensity);
    this.rocheLimit = pm * Math.pow(2 / density, 1 / 3);
  }

  _calculateTidalForce() {
    const p = this.rlParams;
    const pm = p.primaryMass || 100;
    const sm = p.secondaryMass || 30;
    const d = Math.max(1, this.currentDistance);
    this.tidalForce = (2 * pm * sm) / (d * d * d);
  }

  _updatePhysics() {
    this.currentDistance = this.secondary.position.x - this.primary.position.x;
    this.currentDistance = Math.max(1, this.currentDistance);
    this._calculateTidalForce();
    this._updateRocheLine();

    const p = this.rlParams;
    const lockDist = p.tidalLockingDistance || 200;

    if (this.state === 'destroyed') return;

    if (this.currentDistance <= this.rocheLimit) {
      this._destroySecondary();
      return;
    }

    if (this.locked) {
      this.state = 'locked';
    } else if (this.currentDistance < this.rocheLimit * 1.3) {
      this.state = 'warning';
    } else {
      this.state = 'safe';
    }

    const deformation = Math.min(0.5, this.tidalForce * 500);
    const stretchDir = this.primary.position.x < this.secondary.position.x ? 1 : -1;
    this.secondary.scale.x = 1 + deformation * stretchDir;
    this.secondary.scale.y = 1 - deformation * 0.3;
    this.secondary.scale.z = 1 - deformation * 0.3;

    window.dispatchEvent(new CustomEvent('rocheState', {
      detail: {
        d: this.currentDistance,
        d_R: this.rocheLimit,
        F_tidal: this.tidalForce,
        state: this.state
      }
    }));
  }

  _destroySecondary() {
    if (this.state === 'destroyed') return;
    this.state = 'destroyed';
    this.secondary.visible = false;
    const p = this.rlParams;
    this._createDebris(p.debrisCount || 1000, p.accretionTemperature || 4500);
    window.dispatchEvent(new CustomEvent('rocheState', {
      detail: {
        d: this.currentDistance,
        d_R: this.rocheLimit,
        F_tidal: this.tidalForce,
        state: 'destroyed'
      }
    }));
    window.dispatchEvent(new CustomEvent('rocheDestroyed', {
      detail: { debrisCount: p.debrisCount || 1000 }
    }));
  }

  _createDebris(count, temperature) {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const angles = new Float32Array(count);
    const radii = new Float32Array(count);
    const speeds = new Float32Array(count);

    const center = this.secondary.position.clone();
    const baseRadius = this.secondary.userData.baseRadius;

    const tempColor = new THREE.Color();
    tempColor.setRGB(1, 0.6, 0.2);

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = baseRadius * (0.8 + Math.random() * 2.5);
      angles[i] = angle;
      radii[i] = r;
      speeds[i] = 0.5 + Math.random() * 2;
      positions[i * 3] = center.x + Math.cos(angle) * r;
      positions[i * 3 + 1] = center.y + Math.sin(angle) * r;
      positions[i * 3 + 2] = 0;
      const intensity = 0.6 + Math.random() * 0.4;
      colors[i * 3] = intensity;
      colors[i * 3 + 1] = intensity * 0.5;
      colors[i * 3 + 2] = intensity * 0.15;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({
      size: 3,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.debris = new THREE.Points(geo, mat);
    this.debris.userData = { angles, radii, speeds, center };
    this.scene.add(this.debris);
    this.addDisposable(geo);
    this.addDisposable(mat);
  }

  _createLightBridge() {
    if (this.lightBridge) return;
    const geo = new THREE.CylinderGeometry(1, 1, 1, 8);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffdd88,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.lightBridge = new THREE.Mesh(geo, mat);
    this.scene.add(this.lightBridge);
    this.addDisposable(geo);
    this.addDisposable(mat);
  }

  _updateLightBridge() {
    if (!this.lightBridge || !this.locked) return;
    const distance = this.secondary.position.distanceTo(this.primary.position);
    const midpoint = new THREE.Vector3().lerpVectors(this.primary.position, this.secondary.position, 0.5);
    this.lightBridge.position.copy(midpoint);
    this.lightBridge.scale.set(3, distance, 3);
    this.lightBridge.lookAt(this.primary.position);
    this.lightBridge.rotateX(Math.PI / 2);
  }

  _screenToNDC(x, y) {
    const rect = this.canvas.getBoundingClientRect();
    return new THREE.Vector2(
      ((x - rect.left) / rect.width) * 2 - 1,
      -((y - rect.top) / rect.height) * 2 + 1
    );
  }

  onDragStart(x, y) {
    if (this.state === 'destroyed') return;
    const mouse = this._screenToNDC(x, y);
    this.raycaster.setFromCamera(mouse, this.camera);
    const intersects = this.raycaster.intersectObject(this.secondary);
    if (intersects.length > 0) {
      this.draggedSecondary = true;
    }
  }

  onDrag(deltaX, deltaY, startX, startY, currentX, currentY) {
    if (!this.draggedSecondary || this.state === 'destroyed') return;
    const mouse = this._screenToNDC(currentX, currentY);
    this.raycaster.setFromCamera(mouse, this.camera);
    const point = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(this.dragPlane, point)) {
      const minX = this.primary.position.x + this.primary.userData.radius + 20;
      this.secondary.position.x = Math.max(minX, point.x);
      this.secondary.position.y = point.y * 0.3;
      this.secondary.position.z = 0;
    }
    this._updatePhysics();
  }

  onDragEnd(totalDeltaX, totalDeltaY) {
    this.draggedSecondary = false;
    const p = this.rlParams;
    const lockDist = p.tidalLockingDistance || 200;
    if (this.currentDistance > lockDist && this.state !== 'destroyed') {
      this.locked = true;
      this._createLightBridge();
      this._updatePhysics();
      window.dispatchEvent(new CustomEvent('rocheLocked', {
        detail: { distance: this.currentDistance }
      }));
    }
  }

  onTap(x, y) {
    if (this.state === 'destroyed') return;
    const p = this.rlParams;
    const lockDist = p.tidalLockingDistance || 200;
    if (this.currentDistance > lockDist && !this.locked) {
      this.locked = true;
      this._createLightBridge();
      this._updatePhysics();
      window.dispatchEvent(new CustomEvent('rocheLocked', {
        detail: { distance: this.currentDistance }
      }));
    }
  }

  onPinch(scale, centerX, centerY) {
    if (this.state === 'destroyed') return;
    this.secondaryDensity = Math.max(0.1, Math.min(5, this.secondaryDensity * scale));
    this._calculateRocheLimit();
    this._updatePhysics();
    window.dispatchEvent(new CustomEvent('densityChange', {
      detail: { density: this.secondaryDensity, d_R: this.rocheLimit }
    }));
  }

  update(deltaTime, elapsedTime) {
    if (this.primary) {
      this.primary.rotation.y += deltaTime * 0.2;
    }

    if (this.secondary && this.state !== 'destroyed') {
      this.secondary.rotation.y += deltaTime * 0.5;
    }

    if (this.debris && this.state === 'destroyed') {
      const pos = this.debris.geometry.attributes.position.array;
      const ud = this.debris.userData;
      for (let i = 0; i < pos.length / 3; i++) {
        ud.angles[i] += ud.speeds[i] * deltaTime * 2;
        pos[i * 3] = ud.center.x + Math.cos(ud.angles[i]) * ud.radii[i];
        pos[i * 3 + 1] = ud.center.y + Math.sin(ud.angles[i]) * ud.radii[i];
      }
      this.debris.geometry.attributes.position.needsUpdate = true;
    }

    if (this.rocheLine) {
      this.rocheLine.material.opacity = 0.4 + Math.sin(elapsedTime * 2) * 0.15;
    }

    if (this.lightBridge && this.locked) {
      this.lightBridge.material.opacity = 0.2 + Math.sin(elapsedTime * 3) * 0.15;
      this._updateLightBridge();

      if (this.secondary && this.state !== 'destroyed') {
        const angle = elapsedTime * 0.3;
        const r = this.currentDistance / 2;
        this.secondary.position.x = this.primary.position.x + this.currentDistance * Math.cos(angle * 0.1);
        this.secondary.position.y = Math.sin(angle * 0.1) * 30;
      }
    }

    if (this.deepSpace) {
      this.deepSpace.update(deltaTime, elapsedTime);
    }

    if (this.starfield) {
      this.starfield.rotation.y += deltaTime * 0.002;
    }
  }

  onQualityChange(quality) {
    if (this.starfield) {
      this.starfield.material.size = quality === 'low' ? 1 : 2;
    }
    if (this.debris && quality === 'low') {
      this.debris.material.size = 1.5;
    }
  }

  destroy() {
    if (this.deepSpace) {
      this.scene.remove(this.deepSpace.object3D);
      this.deepSpace.dispose();
      this.deepSpace = null;
    }
    super.destroy();
  }
}
