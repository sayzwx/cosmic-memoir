export function createRandom(seed = 0x6d2b79f5) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function setPosition(object, value, fallback) {
  const position = value || fallback;
  object.position.set(position[0], position[1], position[2]);
}

export function disposeRenderable(object) {
  object.removeFromParent();
  object.geometry?.dispose();
  if (Array.isArray(object.material)) {
    for (const material of object.material) material.dispose();
  } else {
    object.material?.dispose();
  }
}
