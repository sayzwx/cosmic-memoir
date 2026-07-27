/**
 * Mock Three.js 核心导出
 * 用于在 Node/jest 环境中替代从 CDN 导入的 Three.js 模块
 * 每个类提供构造函数和基本方法的 mock 实现
 */

export class Scene {
  constructor() {
    this.children = [];
    this.background = null;
    this.fog = null;
  }
  add(object) {
    this.children.push(object);
  }
  remove(object) {
    const index = this.children.indexOf(object);
    if (index > -1) this.children.splice(index, 1);
  }
  traverse(callback) {
    this.children.forEach(child => {
      callback(child);
      if (child.traverse) child.traverse(callback);
    });
  }
  getObjectByName(name) {
    return this.children.find(child => child.name === name) || null;
  }
}

export class PerspectiveCamera {
  constructor(fov = 75, aspect = 1, near = 0.1, far = 1000) {
    this.fov = fov;
    this.aspect = aspect;
    this.near = near;
    this.far = far;
    this.position = new Vector3();
    this.rotation = new Euler();
    this.zoom = 1;
  }
  lookAt(x, y, z) {}
  updateProjectionMatrix() {}
  setPosition(x, y, z) {
    this.position.set(x, y, z);
  }
}

export class OrthographicCamera {
  constructor(left = -1, right = 1, top = 1, bottom = -1, near = 0.1, far = 1000) {
    this.left = left;
    this.right = right;
    this.top = top;
    this.bottom = bottom;
    this.near = near;
    this.far = far;
    this.position = new Vector3();
  }
  lookAt(x, y, z) {}
  updateProjectionMatrix() {}
}

export class WebGLRenderer {
  constructor(params = {}) {
    this.domElement = document.createElement('canvas');
    this.parameters = params;
    this.pixelRatio = 1;
    this.setSize = vi ? vi.fn() : function (width, height) {};
    this.setPixelRatio = vi ? vi.fn() : function (ratio) {};
    this.setClearColor = vi ? vi.fn() : function (color, alpha) {};
    this.render = vi ? vi.fn() : function (scene, camera) {};
    this.dispose = vi ? vi.fn() : function () {};
    this.getContext = vi ? vi.fn(() => ({})) : function () { return {}; };
  }
}

export class Clock {
  constructor(autoStart = true) {
    this.autoStart = autoStart;
    this.startTime = 0;
    this.oldTime = 0;
    this.elapsedTime = 0;
    this.running = false;
  }
  start() {
    this.startTime = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    this.oldTime = this.startTime;
    this.elapsedTime = 0;
    this.running = true;
  }
  stop() {
    this.getElapsedTime();
    this.running = false;
  }
  getElapsedTime() {
    this.getDelta();
    return this.elapsedTime;
  }
  getDelta() {
    let diff = 0;
    if (this.autoStart && !this.running) {
      this.start();
      return 0;
    }
    if (this.running) {
      const newTime = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      diff = (newTime - this.oldTime) / 1000;
      this.oldTime = newTime;
      this.elapsedTime += diff;
    }
    return diff;
  }
}

export class LoadingManager {
  constructor(onLoad, onProgress, onError) {
    this.onLoad = onLoad || null;
    this.onProgress = onProgress || null;
    this.onError = onError || null;
    this.itemsLoaded = 0;
    this.itemsTotal = 0;
  }
  itemStart(url) { this.itemsTotal++; }
  itemEnd(url) {
    this.itemsLoaded++;
    if (this.itemsLoaded === this.itemsTotal && this.onLoad) {
      this.onLoad();
    }
  }
  itemError(url) {
    if (this.onError) this.onError(url);
  }
}

export class TextureLoader {
  constructor(manager) {
    this.manager = manager || new LoadingManager();
    this.crossOrigin = 'anonymous';
  }
  load(url, onLoad, onProgress, onError) {
    const texture = new Texture();
    if (onLoad) setTimeout(() => onLoad(texture), 0);
    return texture;
  }
  loadAsync(url) {
    return Promise.resolve(new Texture());
  }
}

export class Texture {
  constructor() {
    this.image = null;
    this.needsUpdate = false;
    this.wrapS = 0;
    this.wrapT = 0;
    this.minFilter = 0;
    this.magFilter = 0;
  }
  dispose() {}
}

export class Vector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }
  copy(v) {
    this.x = v.x;
    this.y = v.y;
    this.z = v.z;
    return this;
  }
  clone() {
    return new Vector3(this.x, this.y, this.z);
  }
  add(v) {
    this.x += v.x;
    this.y += v.y;
    this.z += v.z;
    return this;
  }
  sub(v) {
    this.x -= v.x;
    this.y -= v.y;
    this.z -= v.z;
    return this;
  }
  multiplyScalar(scalar) {
    this.x *= scalar;
    this.y *= scalar;
    this.z *= scalar;
    return this;
  }
  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }
  normalize() {
    const len = this.length();
    if (len > 0) this.multiplyScalar(1 / len);
    return this;
  }
  distanceTo(v) {
    return Math.sqrt(
      (this.x - v.x) ** 2 +
      (this.y - v.y) ** 2 +
      (this.z - v.z) ** 2
    );
  }
  lerp(v, alpha) {
    this.x += (v.x - this.x) * alpha;
    this.y += (v.y - this.y) * alpha;
    this.z += (v.z - this.z) * alpha;
    return this;
  }
}

export class Vector2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }
  set(x, y) {
    this.x = x;
    this.y = y;
    return this;
  }
  copy(v) {
    this.x = v.x;
    this.y = v.y;
    return this;
  }
  clone() {
    return new Vector2(this.x, this.y);
  }
}

export class Color {
  constructor(r = 0, g = 0, b = 0) {
    if (typeof r === 'string') {
      this.r = 0;
      this.g = 0;
      this.b = 0;
    } else {
      this.r = r;
      this.g = g;
      this.b = b;
    }
  }
  set(r, g, b) {
    this.r = r;
    this.g = g;
    this.b = b;
    return this;
  }
  setHex(hex) {
    this.r = ((hex >> 16) & 0xff) / 255;
    this.g = ((hex >> 8) & 0xff) / 255;
    this.b = (hex & 0xff) / 255;
    return this;
  }
  copy(color) {
    this.r = color.r;
    this.g = color.g;
    this.b = color.b;
    return this;
  }
  clone() {
    return new Color(this.r, this.g, this.b);
  }
}

export class Euler {
  constructor(x = 0, y = 0, z = 0, order = 'XYZ') {
    this.x = x;
    this.y = y;
    this.z = z;
    this.order = order;
  }
  set(x, y, z, order) {
    this.x = x;
    this.y = y;
    this.z = z;
    if (order) this.order = order;
    return this;
  }
  copy(e) {
    this.x = e.x;
    this.y = e.y;
    this.z = e.z;
    this.order = e.order;
    return this;
  }
  clone() {
    return new Euler(this.x, this.y, this.z, this.order);
  }
}

export class Quaternion {
  constructor(x = 0, y = 0, z = 0, w = 1) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
  }
  set(x, y, z, w) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
    return this;
  }
  copy(q) {
    this.x = q.x;
    this.y = q.y;
    this.z = q.z;
    this.w = q.w;
    return this;
  }
  clone() {
    return new Quaternion(this.x, this.y, this.z, this.w);
  }
}

export class Matrix4 {
  constructor() {
    this.elements = new Float32Array(16);
    this.elements[0] = 1;
    this.elements[5] = 1;
    this.elements[10] = 1;
    this.elements[15] = 1;
  }
  identity() {
    this.elements = new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
    return this;
  }
  makeTranslation(x, y, z) { return this; }
  makeRotationX(theta) { return this; }
  makeRotationY(theta) { return this; }
  makeRotationZ(theta) { return this; }
  multiply(m) { return this; }
  copy(m) { return this; }
  clone() { return new Matrix4(); }
}

export class Object3D {
  constructor() {
    this.position = new Vector3();
    this.rotation = new Euler();
    this.quaternion = new Quaternion();
    this.scale = new Vector3(1, 1, 1);
    this.visible = true;
    this.children = [];
    this.parent = null;
    this.name = '';
    this.userData = {};
  }
  add(child) {
    this.children.push(child);
    child.parent = this;
  }
  remove(child) {
    const index = this.children.indexOf(child);
    if (index > -1) {
      this.children.splice(index, 1);
      child.parent = null;
    }
  }
  traverse(callback) {
    callback(this);
    this.children.forEach(child => child.traverse(callback));
  }
  updateMatrix() {}
  updateMatrixWorld() {}
}

export class Mesh extends Object3D {
  constructor(geometry, material) {
    super();
    this.geometry = geometry || null;
    this.material = material || null;
  }
}

export class BufferGeometry {
  constructor() {
    this.attributes = {};
    this.index = null;
  }
  setAttribute(name, attribute) {
    this.attributes[name] = attribute;
    return this;
  }
  getAttribute(name) {
    return this.attributes[name];
  }
  setIndex(index) {
    this.index = index;
    return this;
  }
  dispose() {}
}

export class BufferAttribute {
  constructor(array, itemSize, normalized) {
    this.array = array;
    this.itemSize = itemSize;
    this.normalized = normalized || false;
    this.count = array.length / itemSize;
  }
  setArray(array) {
    this.array = array;
    this.count = array.length / this.itemSize;
  }
}

export class ShaderMaterial {
  constructor(params = {}) {
    this.uniforms = params.uniforms || {};
    this.vertexShader = params.vertexShader || '';
    this.fragmentShader = params.fragmentShader || '';
    this.transparent = params.transparent || false;
    this.blending = params.blending || 0;
    this.depthWrite = params.depthWrite !== undefined ? params.depthWrite : true;
    this.depthTest = params.depthTest !== undefined ? params.depthTest : true;
    this.side = params.side || 0;
  }
  dispose() {}
}

export class PointsMaterial {
  constructor(params = {}) {
    this.color = new Color();
    this.size = params.size || 1;
    this.map = params.map || null;
    this.transparent = params.transparent || false;
    this.opacity = params.opacity || 1;
    this.sizeAttenuation = params.sizeAttenuation !== undefined ? params.sizeAttenuation : true;
    this.blending = params.blending || 0;
    this.depthWrite = params.depthWrite !== undefined ? params.depthWrite : true;
  }
  dispose() {}
}

export class BasicMaterial {
  constructor(params = {}) {
    this.color = new Color();
    this.map = params.map || null;
    this.transparent = params.transparent || false;
    this.opacity = params.opacity || 1;
  }
  dispose() {}
}

export class Group extends Object3D {
  constructor() {
    super();
    this.type = 'Group';
  }
}

export class Raycaster {
  constructor(origin, direction, near, far) {
    this.origin = origin || new Vector3();
    this.direction = direction || new Vector3();
    this.near = near || 0;
    this.far = far || Infinity;
  }
  setFromCamera(coords, camera) {}
  intersectObject(object, recursive) { return []; }
  intersectObjects(objects, recursive) { return []; }
}

export class PlaneGeometry extends BufferGeometry {
  constructor(width = 1, height = 1, widthSegments = 1, heightSegments = 1) {
    super();
    this.type = 'PlaneGeometry';
    this.parameters = { width, height, widthSegments, heightSegments };
  }
}

export class SphereGeometry extends BufferGeometry {
  constructor(radius = 1, widthSegments = 32, heightSegments = 16, phiStart = 0, phiLength = Math.PI * 2, thetaStart = 0, thetaLength = Math.PI) {
    super();
    this.type = 'SphereGeometry';
    this.parameters = { radius, widthSegments, heightSegments };
  }
}

export class BoxGeometry extends BufferGeometry {
  constructor(width = 1, height = 1, depth = 1) {
    super();
    this.type = 'BoxGeometry';
    this.parameters = { width, height, depth };
  }
}

export class BufferGeometryUtils {
  static mergeGeometries() { return new BufferGeometry(); }
}

export const AdditiveBlending = 2;
export const NormalBlending = 1;
export const FrontSide = 0;
export const BackSide = 1;
export const DoubleSide = 2;
export const RepeatWrapping = 1000;
export const ClampToEdgeWrapping = 1001;
export const NearestFilter = 0;
export const LinearFilter = 1;
export const sRGBEncoding = 3001;
export const LinearEncoding = 3000;

export default {
  Scene,
  PerspectiveCamera,
  OrthographicCamera,
  WebGLRenderer,
  Clock,
  LoadingManager,
  TextureLoader,
  Texture,
  Vector3,
  Vector2,
  Color,
  Euler,
  Quaternion,
  Matrix4,
  Object3D,
  Mesh,
  BufferGeometry,
  BufferAttribute,
  ShaderMaterial,
  PointsMaterial,
  BasicMaterial,
  Group,
  Raycaster,
  PlaneGeometry,
  SphereGeometry,
  BoxGeometry,
  BufferGeometryUtils,
  AdditiveBlending,
  NormalBlending,
  FrontSide,
  BackSide,
  DoubleSide,
  RepeatWrapping,
  ClampToEdgeWrapping,
  NearestFilter,
  LinearFilter,
  sRGBEncoding,
  LinearEncoding
};
