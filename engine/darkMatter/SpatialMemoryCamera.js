import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

export const SPATIAL_CAMERA_STATES = Object.freeze({
  INTRO: 'INTRO', OVERVIEW: 'OVERVIEW', ORBITING: 'ORBITING', FOCUSING: 'FOCUSING',
  FOCUSED: 'FOCUSED', RETURNING: 'RETURNING', TABLEAU: 'TABLEAU',
  PASSAGE: 'PASSAGE', DIVE: 'DIVE', PANORAMA: 'PANORAMA'
});

const clamp = THREE.MathUtils.clamp;
const smooth = t => t * t * (3 - 2 * t);

export class SpatialMemoryCamera {
  constructor(camera, options = {}) {
    if (!camera?.isCamera) throw new TypeError('SpatialMemoryCamera requires a Three.js Camera.');
    this.camera = camera;
    this.state = SPATIAL_CAMERA_STATES.INTRO;
    this.reducedMotion = Boolean(options.reducedMotion);
    this.enabled = options.enabled !== false;
    this.rotateSpeed = options.rotateSpeed ?? 0.004;
    this.zoomSpeed = options.zoomSpeed ?? 0.0015;
    this.minPitch = options.minPitch ?? -1.25; this.maxPitch = options.maxPitch ?? 1.25;
    this.minDistance = options.minDistance ?? 3; this.maxDistance = options.maxDistance ?? 80;
    this.yaw = options.yaw ?? 0; this.pitch = options.pitch ?? 0.12; this.distance = options.distance ?? 18;
    this.targetYaw = this.yaw; this.targetPitch = this.pitch; this.targetDistance = this.distance;
    this.damping = options.damping ?? 10;
    this.target = new THREE.Vector3(); this.target.copy(options.target || new THREE.Vector3());
    this._desiredPosition = new THREE.Vector3(); this._lookMatrix = new THREE.Matrix4();
    this._desiredQuaternion = new THREE.Quaternion(); this._worldQuaternion = new THREE.Quaternion();
    this._fromPosition = new THREE.Vector3(); this._fromQuaternion = new THREE.Quaternion(); this._fromTarget = new THREE.Vector3();
    this._toPosition = new THREE.Vector3(); this._toQuaternion = new THREE.Quaternion(); this._toTarget = new THREE.Vector3();
    this._returnPosition = new THREE.Vector3(); this._returnQuaternion = new THREE.Quaternion(); this._returnTarget = new THREE.Vector3();
    this._focusWorld = new THREE.Vector3(); this._focusDirection = new THREE.Vector3(); this._up = new THREE.Vector3(0, 1, 0);
    this._hasReturnState = false;
    this._transitionTime = 0; this._transitionDuration = 1; this._transitionActive = false;
    this._dragging = false; this._pinchDistance = 0;
    this._setOrbitPosition(true);
  }

  setReducedMotion(value) { this.reducedMotion = Boolean(value); return this; }
  setTarget(target, immediate = false) { this.target.copy(target); if (immediate) this._setOrbitPosition(true); return this; }

  intro(target = this.target, distance = this.distance * 1.35, duration = 1.4) {
    this.target.copy(target); this.targetDistance = clamp(distance, this.minDistance, this.maxDistance);
    this._setOrbitDestination(); this._beginTransition(SPATIAL_CAMERA_STATES.INTRO, duration, this._desiredPosition, this.target);
    return this;
  }

  overview(target = this.target, distance = this.distance, duration = 0.9) {
    this.target.copy(target); this.targetDistance = clamp(distance, this.minDistance, this.maxDistance);
    this._setOrbitDestination(); this._beginTransition(SPATIAL_CAMERA_STATES.OVERVIEW, duration, this._desiredPosition, this.target);
    return this;
  }

  focus(subject, options = {}) {
    const object = subject?.object || subject;
    if (!object?.getWorldPosition) return false;
    this._rememberReturnState();
    object.getWorldPosition(this._focusWorld);
    object.getWorldQuaternion(this._worldQuaternion);
    this._focusDirection.set(0, 0, 1).applyQuaternion(this._worldQuaternion).normalize();
    const distance = options.distance ?? subject.distance ?? object.userData?.focusDistance ?? 6;
    this._toPosition.copy(this._focusWorld).addScaledVector(this._focusDirection, distance);
    if (options.offset) this._toPosition.add(options.offset);
    this._beginTransition(SPATIAL_CAMERA_STATES.FOCUSING, options.duration ?? subject.duration ?? 0.8, this._toPosition, this._focusWorld);
    return true;
  }

  orbitFocus(subject, options = {}) {
    const object = subject?.object || subject;
    if (!object?.getWorldPosition) return false;
    this._rememberReturnState(); object.getWorldPosition(this._focusWorld);
    const distance = options.distance ?? subject?.distance ?? object.userData?.focusDistance ?? 6;
    const yaw = options.yaw ?? subject?.yaw ?? this.targetYaw;
    const pitch = clamp(options.pitch ?? subject?.pitch ?? this.targetPitch, this.minPitch, this.maxPitch);
    const cp = Math.cos(pitch);
    this._toPosition.set(Math.sin(yaw) * cp, Math.sin(pitch), Math.cos(yaw) * cp)
      .multiplyScalar(Math.max(0.001, distance)).add(this._focusWorld);
    this._beginTransition(SPATIAL_CAMERA_STATES.FOCUSING, options.duration ?? subject?.duration ?? 0.8, this._toPosition, this._focusWorld);
    return true;
  }

  passage(subject, options = {}) {
    const object = subject?.object || subject;
    if (!object?.getWorldPosition) return false;
    this._rememberReturnState(); object.getWorldPosition(this._focusWorld); object.getWorldQuaternion(this._worldQuaternion);
    this._focusDirection.set(0, 0, -1).applyQuaternion(this._worldQuaternion).normalize();
    const distance = options.distance ?? subject?.distance ?? 6;
    const depth = options.depth ?? subject?.depth ?? 4;
    this._toPosition.copy(this._focusWorld).addScaledVector(this._focusDirection, depth);
    this._toTarget.copy(this._toPosition).addScaledVector(this._focusDirection, distance);
    this._beginTransition(SPATIAL_CAMERA_STATES.PASSAGE, options.duration ?? subject?.duration ?? 1.2, this._toPosition, this._toTarget);
    return true;
  }

  dive(subject, options = {}) {
    const object = subject?.object || subject;
    if (!object?.getWorldPosition) return false;
    this._rememberReturnState(); object.getWorldPosition(this._focusWorld);
    const suppliedNormal = options.surfaceNormal ?? subject?.surfaceNormal ?? object.userData?.surfaceNormal;
    if (suppliedNormal?.isVector3) this._focusDirection.copy(suppliedNormal);
    else if (Array.isArray(suppliedNormal)) this._focusDirection.fromArray(suppliedNormal);
    else if (suppliedNormal) this._focusDirection.set(suppliedNormal.x ?? 0, suppliedNormal.y ?? 1, suppliedNormal.z ?? 0);
    else this._focusDirection.copy(this._focusWorld);
    if (this._focusDirection.lengthSq() < 1e-8) this._focusDirection.copy(this._up);
    this._focusDirection.normalize();
    const altitude = options.altitude ?? subject?.altitude ?? object.userData?.diveAltitude ?? 5;
    this._toPosition.copy(this._focusWorld).addScaledVector(this._focusDirection, altitude);
    this._beginTransition(SPATIAL_CAMERA_STATES.DIVE, options.duration ?? subject?.duration ?? 1, this._toPosition, this._focusWorld);
    return true;
  }

  panorama(center, options = {}) {
    const source = center?.object || center;
    if (source?.getWorldPosition) source.getWorldPosition(this._focusWorld);
    else if (source?.isVector3) this._focusWorld.copy(source);
    else return false;
    this._rememberReturnState(); this.camera.getWorldDirection(this._focusDirection);
    this._toTarget.copy(this._focusWorld).add(this._focusDirection);
    this.camera.getWorldQuaternion(this._worldQuaternion);
    this._beginTransition(SPATIAL_CAMERA_STATES.PANORAMA, options.duration ?? 1, this._focusWorld, this._toTarget, this._worldQuaternion);
    return true;
  }

  returnToOverview(duration = 0.7) {
    const canReturn = this.state === SPATIAL_CAMERA_STATES.FOCUSED || this.state === SPATIAL_CAMERA_STATES.FOCUSING ||
      this.state === SPATIAL_CAMERA_STATES.PASSAGE || this.state === SPATIAL_CAMERA_STATES.DIVE || this.state === SPATIAL_CAMERA_STATES.PANORAMA;
    if (!canReturn || !this._hasReturnState) return false;
    this._beginTransition(SPATIAL_CAMERA_STATES.RETURNING, duration, this._returnPosition, this._returnTarget, this._returnQuaternion);
    return true;
  }

  tableau(target = this.target, distance = this.distance, duration = 1) {
    this.target.copy(target); this.targetDistance = clamp(distance, this.minDistance, this.maxDistance);
    this._setOrbitDestination(); this._beginTransition(SPATIAL_CAMERA_STATES.TABLEAU, duration, this._desiredPosition, this.target);
    return this;
  }

  _rememberReturnState() {
    const preserving = this.state === SPATIAL_CAMERA_STATES.FOCUSED || this.state === SPATIAL_CAMERA_STATES.FOCUSING ||
      this.state === SPATIAL_CAMERA_STATES.PASSAGE || this.state === SPATIAL_CAMERA_STATES.DIVE || this.state === SPATIAL_CAMERA_STATES.PANORAMA;
    if (this._hasReturnState && preserving) return;
    this._returnPosition.copy(this.camera.position); this.camera.getWorldQuaternion(this._returnQuaternion); this._returnTarget.copy(this.target);
    this._hasReturnState = true;
  }

  _beginTransition(state, duration, position, target, quaternion = null) {
    this._fromPosition.copy(this.camera.position); this.camera.getWorldQuaternion(this._fromQuaternion); this._fromTarget.copy(this.target);
    this._toPosition.copy(position); this._toTarget.copy(target);
    if (quaternion) this._toQuaternion.copy(quaternion);
    else { this._lookMatrix.lookAt(this._toPosition, this._toTarget, this.camera.up); this._toQuaternion.setFromRotationMatrix(this._lookMatrix); }
    this._transitionTime = 0; this._transitionDuration = this.reducedMotion ? 0.001 : Math.max(0.001, duration);
    this._transitionActive = true; this.state = state;
  }

  _setOrbitDestination() {
    const cp = Math.cos(this.targetPitch);
    this._desiredPosition.set(Math.sin(this.targetYaw) * cp, Math.sin(this.targetPitch), Math.cos(this.targetYaw) * cp)
      .multiplyScalar(this.targetDistance).add(this.target);
  }

  _setOrbitPosition(immediate) {
    this._setOrbitDestination();
    if (immediate) { this.camera.position.copy(this._desiredPosition); this.lookAt(this.target); }
  }

  lookAt(target = this.target) {
    this._lookMatrix.lookAt(this.camera.position, target, this.camera.up);
    this.camera.quaternion.setFromRotationMatrix(this._lookMatrix); return this;
  }

  onDragStart() { if (!this.enabled) return false; this._dragging = true; this.state = SPATIAL_CAMERA_STATES.ORBITING; return true; }
  onDrag(deltaX, deltaY) {
    if (!this.enabled || !this._dragging) return false;
    const scale = this.reducedMotion ? 0.5 : 1; this.targetYaw -= deltaX * this.rotateSpeed * scale;
    this.targetPitch = clamp(this.targetPitch + deltaY * this.rotateSpeed * scale, this.minPitch, this.maxPitch); return true;
  }
  onDragEnd() { this._dragging = false; if (this.state === SPATIAL_CAMERA_STATES.ORBITING) this.state = SPATIAL_CAMERA_STATES.OVERVIEW; }
  onScroll(deltaY) {
    if (!this.enabled) return false;
    this.targetDistance = clamp(this.targetDistance * Math.exp(deltaY * this.zoomSpeed), this.minDistance, this.maxDistance); return true;
  }
  onPinchStart(distance) { this._pinchDistance = Math.max(1, distance); return this.enabled; }
  onPinch(distanceOrScale) {
    if (!this.enabled) return false;
    const scale = this._pinchDistance > 0 ? distanceOrScale / this._pinchDistance : distanceOrScale;
    if (scale > 0) this.targetDistance = clamp(this.targetDistance / scale, this.minDistance, this.maxDistance);
    this._pinchDistance = Math.max(1, distanceOrScale); return true;
  }
  onPinchEnd() { this._pinchDistance = 0; }

  update(deltaTime) {
    const dt = Math.min(Math.max(deltaTime || 0, 0), 0.1);
    if (this._transitionActive) {
      this._transitionTime += dt; const t = smooth(clamp(this._transitionTime / this._transitionDuration, 0, 1));
      this.camera.position.lerpVectors(this._fromPosition, this._toPosition, t);
      this.camera.quaternion.slerpQuaternions(this._fromQuaternion, this._toQuaternion, t);
      this.target.lerpVectors(this._fromTarget, this._toTarget, t);
      if (t >= 1) {
        this._transitionActive = false;
        if (this.state === SPATIAL_CAMERA_STATES.FOCUSING) this.state = SPATIAL_CAMERA_STATES.FOCUSED;
        else if (this.state === SPATIAL_CAMERA_STATES.RETURNING || this.state === SPATIAL_CAMERA_STATES.INTRO) this.state = SPATIAL_CAMERA_STATES.OVERVIEW;
      }
      return;
    }
    if (this.state === SPATIAL_CAMERA_STATES.FOCUSED || this.state === SPATIAL_CAMERA_STATES.PASSAGE ||
      this.state === SPATIAL_CAMERA_STATES.DIVE || this.state === SPATIAL_CAMERA_STATES.PANORAMA) return;
    const factor = this.reducedMotion ? 1 : 1 - Math.exp(-this.damping * dt);
    this.yaw += (this.targetYaw - this.yaw) * factor; this.pitch += (this.targetPitch - this.pitch) * factor;
    this.distance += (this.targetDistance - this.distance) * factor;
    const cp = Math.cos(this.pitch);
    this._desiredPosition.set(Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp).multiplyScalar(this.distance).add(this.target);
    this.camera.position.lerp(this._desiredPosition, factor); this.lookAt(this.target);
  }
}
