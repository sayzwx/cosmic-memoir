import * as THREE from 'three'

/**
 * Shared mutable state for 3D scene and UI cross-communication.
 * Updated directly (not via React state) to avoid per-frame re-renders.
 */
export const sharedState = {
  // Gravitational wave pulse triggered by input focus
  pulseRadius: 0,
  pulseStrength: 0,
  pulseOrigin: new THREE.Vector3(0, 0, 0),

  // Focused input localizes star brightness boost
  focusPoint: new THREE.Vector3(0, 0, 0),
  focusStrength: 0,

  // Login success transition
  isTransitioning: false,
  transitionProgress: 0,

  // Global parallax / camera influence
  mouseParallax: new THREE.Vector2(0, 0),
  cameraRotation: { x: 0, y: 0 },

  // Form validity
  isValid: false,

  // Photon pool queue emitted from the UI to the scene
  photons: [],
  maxPhotons: 60,

  // Live camera reference (set by CameraRig) for screen-to-world projection
  camera: null
}
