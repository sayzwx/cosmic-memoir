export const QUALITY_BUDGETS = Object.freeze({
  high: Object.freeze({
    stars: 14000, dust: 5000, galaxy: 16000, webSegments: 900, webFlowPoints: 96,
    nebulaSegments: 72, nebulaClusters: 5, planetSegments: 64,
    coreParticles: 9000, ringParticles: 1200, webParticles: 900, optionalEffects: true
  }),
  medium: Object.freeze({
    stars: 9000, dust: 2500, galaxy: 10000, webSegments: 560, webFlowPoints: 72,
    nebulaSegments: 56, nebulaClusters: 4, planetSegments: 48,
    coreParticles: 5600, ringParticles: 720, webParticles: 560, optionalEffects: true
  }),
  low: Object.freeze({
    stars: 4000, dust: 800, galaxy: 4800, webSegments: 260, webFlowPoints: 40,
    nebulaSegments: 36, nebulaClusters: 3, planetSegments: 32,
    coreParticles: 2600, ringParticles: 320, webParticles: 260, optionalEffects: false
  })
});

export const MOBILE_CAP = Object.freeze({
  stars: 5500,
  dust: 1200,
  galaxy: 7200,
  webSegments: 360,
  webFlowPoints: 48,
  nebulaSegments: 42,
  nebulaClusters: 3,
  planetSegments: 40,
  coreParticles: 4200,
  ringParticles: 480,
  webParticles: 360,
  optionalEffects: false
});

export function normalizeQuality(value = 'high') {
  const quality = typeof value === 'string' ? value : value?.quality;
  return quality === 'low' || quality === 'medium' ? quality : 'high';
}

export function getQualityBudget(value = 'high', mobile = false) {
  const quality = normalizeQuality(value);
  const source = QUALITY_BUDGETS[quality];
  return {
    quality,
    mobile: Boolean(mobile),
    stars: mobile ? Math.min(source.stars, MOBILE_CAP.stars) : source.stars,
    dust: mobile ? Math.min(source.dust, MOBILE_CAP.dust) : source.dust,
    galaxy: mobile ? Math.min(source.galaxy, MOBILE_CAP.galaxy) : source.galaxy,
    webSegments: mobile ? Math.min(source.webSegments, MOBILE_CAP.webSegments) : source.webSegments,
    webFlowPoints: mobile ? Math.min(source.webFlowPoints, MOBILE_CAP.webFlowPoints) : source.webFlowPoints,
    nebulaSegments: mobile ? Math.min(source.nebulaSegments, MOBILE_CAP.nebulaSegments) : source.nebulaSegments,
    nebulaClusters: mobile ? Math.min(source.nebulaClusters, MOBILE_CAP.nebulaClusters) : source.nebulaClusters,
    planetSegments: mobile ? Math.min(source.planetSegments, MOBILE_CAP.planetSegments) : source.planetSegments,
    coreParticles: mobile ? Math.min(source.coreParticles, MOBILE_CAP.coreParticles) : source.coreParticles,
    ringParticles: mobile ? Math.min(source.ringParticles, MOBILE_CAP.ringParticles) : source.ringParticles,
    webParticles: mobile ? Math.min(source.webParticles, MOBILE_CAP.webParticles) : source.webParticles,
    optionalEffects: mobile ? MOBILE_CAP.optionalEffects : source.optionalEffects
  };
}

export const MAX_ENVIRONMENT_BUDGET = QUALITY_BUDGETS.high;
