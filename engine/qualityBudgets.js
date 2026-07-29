export const QUALITY_BUDGETS = Object.freeze({
  high: Object.freeze({ stars: 18000, dust: 5000, galaxy: 9000, webSegments: 900, planetSegments: 64 }),
  medium: Object.freeze({ stars: 10000, dust: 2500, galaxy: 5600, webSegments: 560, planetSegments: 48 }),
  low: Object.freeze({ stars: 4000, dust: 800, galaxy: 2600, webSegments: 260, planetSegments: 32 })
});

export const MOBILE_CAP = Object.freeze({ stars: 6000, dust: 1200, galaxy: 4200, webSegments: 360 });

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
    planetSegments: mobile ? Math.min(source.planetSegments, 40) : source.planetSegments
  };
}

export const MAX_ENVIRONMENT_BUDGET = QUALITY_BUDGETS.high;
