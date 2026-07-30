import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { createCinematicReferenceBackdrop } from './CinematicReferenceBackdrop.js';
import { createDeepSpaceField } from './DeepSpaceField.js';
import { createNebulaDust } from './NebulaDust.js';
import { getQualityBudget, normalizeQuality } from './qualityBudgets.js';

export function createDarkMatterEnvironment(options = {}) {
  const object3D = new THREE.Group();
  object3D.name = options.name || 'M8CinematicEnvironment';
  let quality = normalizeQuality(options.quality);
  let mobile = Boolean(options.mobile);
  let reducedMotion = Boolean(options.reducedMotion);
  let motionElapsed = 0;
  let disposed = false;
  const shared = { quality, mobile, reducedMotion, pixelRatio: options.pixelRatio };
  const initialBudget = getQualityBudget(quality, mobile);
  const backdrop = createCinematicReferenceBackdrop({ ...shared, ...options.backdrop });
  const stars = createDeepSpaceField({ ...shared, capacity: initialBudget.stars, ...options.stars });
  const dust = createNebulaDust({ ...shared, capacity: initialBudget.dust, ...options.dust });
  // Backdrop must render first; carrier subjects are owned by the memory entities.
  const modules = [backdrop, stars, dust];
  for (const module of modules) object3D.add(module.object3D);

  const callModules = (method, ...args) => {
    if (disposed) return;
    for (const module of modules) module[method]?.(...args);
  };

  callModules('setQuality', quality, mobile);
  callModules('setReducedMotion', reducedMotion);
  if (options.pixelRatio != null) callModules('setPixelRatio', options.pixelRatio);

  return {
    object3D, modules, backdrop, stars, dust,
    drawCalls: modules.reduce((sum, module) => sum + module.drawCalls, 0),
    update(delta) {
      if (disposed) return;
      const numericDelta = Number.isFinite(delta) ? delta : 0;
      const dt = Math.min(Math.max(numericDelta, 0), 0.05);
      if (!reducedMotion) motionElapsed += dt;
      callModules('update', reducedMotion ? 0 : dt, motionElapsed);
    },
    setQuality(value, isMobile = mobile) {
      if (disposed) return;
      quality = normalizeQuality(value);
      mobile = Boolean(isMobile);
      callModules('setQuality', quality, mobile);
    },
    setReducedMotion(value) {
      if (disposed) return;
      reducedMotion = Boolean(value);
      callModules('setReducedMotion', reducedMotion);
    },
    setPixelRatio(value) {
      if (!Number.isFinite(value) || value <= 0) return;
      callModules('setPixelRatio', value);
    },
    // Transitional no-op for renderers that still report the former web reveal.
    setReveal() {},
    dispose() {
      if (disposed) return;
      disposed = true;
      object3D.removeFromParent();
      for (const module of modules) module.dispose();
      modules.length = 0;
    }
  };
}
