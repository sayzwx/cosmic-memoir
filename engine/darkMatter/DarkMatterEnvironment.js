import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { createDeepSpaceField } from './DeepSpaceField.js';
import { createSpiralGalaxy } from './SpiralGalaxy.js';
import { createAtmosphericPlanet } from './AtmosphericPlanet.js';
import { createNebulaDust } from './NebulaDust.js';
import { createCosmicWeb } from './CosmicWeb.js';
import { getQualityBudget, normalizeQuality } from './qualityBudgets.js';

export function createDarkMatterEnvironment(options = {}) {
  const object3D = new THREE.Group();
  object3D.name = options.name || 'M8CinematicEnvironment';
  let quality = normalizeQuality(options.quality);
  let mobile = Boolean(options.mobile);
  let reducedMotion = Boolean(options.reducedMotion);
  const shared = { quality, mobile };
  const initialBudget = getQualityBudget(quality, mobile);
  const stars = createDeepSpaceField({ ...shared, capacity: initialBudget.stars, ...options.stars });
  const galaxy = createSpiralGalaxy({ ...shared, capacity: initialBudget.galaxy, ...options.galaxy });
  const planet = createAtmosphericPlanet({ ...shared, ...options.planet });
  const dust = createNebulaDust({ ...shared, capacity: initialBudget.dust, ...options.dust });
  const web = createCosmicWeb({ ...shared, capacity: initialBudget.webSegments, ...options.web });
  const modules = [stars, galaxy, planet, dust, web];
  for (const module of modules) object3D.add(module.object3D);
  stars.setReducedMotion(reducedMotion);
  dust.setReducedMotion(reducedMotion);

  return {
    object3D, modules, stars, galaxy, planet, dust, web,
    drawCalls: modules.reduce((sum, module) => sum + module.drawCalls, 0),
    update(delta, elapsed) {
      const dt = Math.min(Math.max(delta, 0), 0.05);
      const motionDelta = reducedMotion ? 0 : dt;
      stars.update(motionDelta, elapsed);
      galaxy.update(motionDelta, elapsed);
      planet.update(motionDelta, elapsed);
      dust.update(motionDelta, elapsed);
      web.update(motionDelta, elapsed);
    },
    setQuality(value, isMobile = mobile) {
      quality = normalizeQuality(value);
      mobile = Boolean(isMobile);
      for (const module of modules) module.setQuality(quality, mobile);
    },
    setReducedMotion(value) {
      reducedMotion = Boolean(value);
      stars.setReducedMotion(reducedMotion);
      dust.setReducedMotion(reducedMotion);
    },
    setPixelRatio(value) { stars.setPixelRatio(value); },
    setReveal(value) { web.setReveal(value); },
    dispose() {
      object3D.removeFromParent();
      for (const module of modules) module.dispose();
      modules.length = 0;
    }
  };
}
