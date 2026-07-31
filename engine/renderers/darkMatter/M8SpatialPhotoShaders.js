export const M8_PHOTO_VERTEX_SHADER = `
  varying vec2 vUv;
  uniform float uBend;
  void main() {
    vUv = uv;
    vec3 p = position;
    vec2 centered = uv - 0.5;
    p.z += (centered.x * centered.x + centered.y * centered.y) * uBend;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

export const M8_PHOTO_FRAGMENT_SHADER = `
  uniform sampler2D uMap;
  uniform vec3 uFrameColor;
  uniform vec3 uGlowColor;
  uniform float uOpacity;
  uniform float uReveal;
  uniform float uVisited;
  uniform float uInset;
  uniform float uDistortion;
  uniform float uChromatic;
  varying vec2 vUv;

  float boxDistance(vec2 p, vec2 halfSize) {
    vec2 d = abs(p) - halfSize;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
  }

  void main() {
    vec2 centered = vUv - 0.5;
    vec2 imageUv = centered / uInset + 0.5;
    float radius2 = dot(imageUv - 0.5, imageUv - 0.5);
    vec2 warpedUv = 0.5 + (imageUv - 0.5) * (1.0 + uDistortion * radius2);
    float inside = step(0.0, warpedUv.x) * step(warpedUv.x, 1.0)
      * step(0.0, warpedUv.y) * step(warpedUv.y, 1.0);

    vec4 photo;
    if (uChromatic > 0.0001) {
      vec2 direction = (warpedUv - 0.5) * uChromatic;
      vec4 centerSample = texture2D(uMap, warpedUv);
      vec4 fringeSample = texture2D(uMap, warpedUv + direction);
      photo = vec4(fringeSample.r, centerSample.g, fringeSample.b, centerSample.a);
    } else {
      photo = texture2D(uMap, warpedUv);
    }

    float distanceToImage = boxDistance(centered, vec2(uInset * 0.5));
    float frame = (1.0 - smoothstep(0.006, 0.018, abs(distanceToImage)))
      * step(distanceToImage, 0.025);
    float glow = exp(-max(distanceToImage, 0.0) * 28.0) * step(0.0, distanceToImage);
    float revealGate = smoothstep(0.0, 0.015, uReveal);
    float revealRadius = uReveal * 0.86;
    float revealMask = (1.0 - smoothstep(revealRadius - 0.16, revealRadius, length(centered))) * revealGate;
    vec3 tonedPhoto = mix(photo.rgb, photo.rgb * vec3(0.84, 0.9, 1.0), uVisited * 0.18);
    vec3 color = tonedPhoto * inside;
    color = mix(color, uFrameColor, frame * 0.92);
    color += uGlowColor * glow * (0.3 + uReveal * 0.7);
    float alpha = max(photo.a * inside, max(frame, glow * 0.42)) * revealMask * uOpacity;
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(color, alpha);
  }
`;
