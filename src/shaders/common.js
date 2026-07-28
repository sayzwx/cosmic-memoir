// Reusable GLSL snippets for cosmic shaders.

export const hashNoise = /* glsl */ `
float hash11(float n) {
  return fract(sin(n) * 43758.5453123);
}

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float noise21(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm21(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
  for (int i = 0; i < 6; i++) {
    v += a * noise21(p);
    p = rot * p * 2.1;
    a *= 0.5;
  }
  return v;
}
`

export const blackbody = /* glsl */ `
vec3 blackbody(float temp) {
  float t = clamp(temp, 1000.0, 40000.0) / 100.0;
  vec3 color;
  if (t < 66.0) {
    color.r = 1.0;
    color.g = clamp(0.39008157876 * log(t) - 0.63184144378, 0.0, 1.0);
    color.b = t < 19.0 ? 0.0 : clamp(0.54320678911 * log(t - 10.0) - 1.19625408914, 0.0, 1.0);
  } else {
    color.r = clamp(1.29293618606 * pow(t - 60.0, -0.1332047592), 0.0, 1.0);
    color.g = clamp(1.12989086089 * pow(t - 60.0, -0.0755148492), 0.0, 1.0);
    color.b = 1.0;
  }
  return color;
}
`

export const easing = /* glsl */ `
float easeOutExpo(float t) {
  return t == 1.0 ? 1.0 : 1.0 - pow(2.0, -10.0 * t);
}
`
