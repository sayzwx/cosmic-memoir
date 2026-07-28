export const photonVertexShader = /* glsl */ `
  attribute float aActive;
  attribute float aProgress;
  attribute vec3 aStartPos;
  attribute float aAngle;
  attribute float aRadius;
  attribute float aSpeed;
  attribute vec3 aColor;
  attribute float aSize;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    if (aActive < 0.5) {
      gl_Position = vec4(0.0, 0.0, -1000.0, 1.0);
      gl_PointSize = 0.0;
      vAlpha = 0.0;
      return;
    }

    float t = clamp(aProgress, 0.0, 1.0);
    float radius = aRadius * (1.0 - t);
    float angle = aAngle + t * 8.0 * aSpeed;

    vec3 pos;
    pos.x = cos(angle) * radius;
    pos.z = sin(angle) * radius;
    pos.y = aStartPos.y * (1.0 - t);

    // Smooth transition from start position into the spiral fall
    pos = mix(aStartPos, pos, smoothstep(0.0, 0.25, t));

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = aSize * 18.0 / -mvPosition.z;

    vColor = aColor;
    vAlpha = 1.0 - smoothstep(0.75, 1.0, t);
  }
`

export const photonFragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float dist = length(uv);
    if (dist > 0.5) discard;

    float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
    alpha = pow(alpha, 2.0);

    vec3 color = mix(vColor, vec3(1.0), 1.0 - smoothstep(0.0, 0.25, dist));
    gl_FragColor = vec4(color, alpha * vAlpha);
  }
`
