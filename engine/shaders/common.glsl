float cm_hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float cm_noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(cm_hash(i), cm_hash(i + vec2(1.0, 0.0)), u.x),
               mix(cm_hash(i + vec2(0.0, 1.0)), cm_hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float cm_fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
        v += a * cm_noise(p);
        p *= 2.0;
        a *= 0.5;
    }
    return v;
}

float cm_fbm6(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 6; i++) {
        v += a * cm_noise(p);
        p = p * 2.03 + vec2(1.7, 9.2);
        a *= 0.5;
    }
    return v;
}

vec3 cm_colorTemperatureToRGB(float temperature) {
    float t = clamp(temperature, 1000.0, 40000.0) / 100.0;
    vec3 color;
    if (t <= 66.0) {
        color.r = 1.0;
        color.g = clamp(0.39008157876 * log(t) - 0.63184144378, 0.0, 1.0);
    } else {
        color.r = clamp(1.29293618606 * pow(t - 60.0, -0.1332047592), 0.0, 1.0);
        color.g = clamp(1.12989086089 * pow(t - 60.0, -0.0755148492), 0.0, 1.0);
    }
    if (t >= 66.0) {
        color.b = 1.0;
    } else if (t <= 19.0) {
        color.b = 0.0;
    } else {
        color.b = clamp(0.54320678911 * log(t - 10.0) - 1.19625408914, 0.0, 1.0);
    }
    return color;
}

vec3 cm_dopplerShift(vec3 baseColor, float velocityFactor) {
    float v = clamp(velocityFactor, -1.0, 1.0);
    if (v > 0.0) {
        return baseColor * mix(vec3(1.0), vec3(0.6, 0.8, 1.4), v);
    } else {
        return baseColor * mix(vec3(1.0), vec3(1.5, 0.5, 0.3), -v);
    }
}

float cm_smoothBorder(float edge0, float edge1, float x) {
    float t = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
    return t * t * (3.0 - 2.0 * t);
}

mat2 cm_rotate2D(float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return mat2(c, -s, s, c);
}
