import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { MemoryCarrier, MEMORY_CARRIER_STATES, loadCarrierTexture } from './MemoryCarrier.js';
import { CRYSTAL_VERTEX, CRYSTAL_FRAGMENT, PHOTO_VERTEX, PHOTO_FRAGMENT,
  ENERGY_VERTEX, ENERGY_FRAGMENT } from './CrystalMemoryNodeShaders.js';

export const CRYSTAL_TYPES=Object.freeze({CORE_PRISM:'corePrism',TWIN_LENS:'twinLens',
  DARK_WEB_PRISON:'darkWebPrison',PLANET_ANCHOR:'planetAnchor',FINAL_SINGULARITY:'finalSingularity'});
const TYPES=new Set(Object.values(CRYSTAL_TYPES));
const VARIANTS=Object.freeze({corePrism:0,twinLens:1,darkWebPrison:2,planetAnchor:3,finalSingularity:4});
const clamp=value=>THREE.MathUtils.clamp(Number.isFinite(value)?value:0,0,1);
const smooth=value=>{const t=clamp(value);return t*t*(3-2*t);};

function fallbackTexture(){
  const texture=new THREE.DataTexture(new Uint8Array([18,24,58,255,105,67,142,255,38,118,164,255,228,160,84,255]),2,2,THREE.RGBAFormat);
  texture.colorSpace=THREE.SRGBColorSpace;texture.needsUpdate=true;return texture;
}
function crystalGeometry(type,size){
  if(type===CRYSTAL_TYPES.TWIN_LENS)return new THREE.TetrahedronGeometry(size*.72,0);
  if(type===CRYSTAL_TYPES.DARK_WEB_PRISON||type===CRYSTAL_TYPES.FINAL_SINGULARITY)return new THREE.DodecahedronGeometry(size,0);
  if(type===CRYSTAL_TYPES.PLANET_ANCHOR)return new THREE.OctahedronGeometry(size,0);
  return new THREE.OctahedronGeometry(size,1);
}
function basicLine(color,opacity=.45){return new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending});}

export class CrystalMemoryNode extends MemoryCarrier{
  constructor(data={},options={}){
    const crystalType=TYPES.has(data.crystalType??options.crystalType)?data.crystalType??options.crystalType:CRYSTAL_TYPES.CORE_PRISM;
    super({...data,carrier:'crystalMemoryNode',crystalType},{...options,carrierType:'crystalMemoryNode'});
    this.crystalType=crystalType;this.elapsed=0;this._size=options.size??2.2;this.pixelRatio=Math.max(1,options.pixelRatio??1);
    this.unfoldProgress=clamp(options.unfoldProgress);this.anchorProgress=clamp(options.anchorProgress);
    this.captureProgress=clamp(options.captureProgress??(this.visited?1:0));this.focusIntensity=0;
    this._ownsTexture=!options.texture;this.texture=options.texture??fallbackTexture();
    this._cameraLocal=new THREE.Vector3();this._billboardEuler=new THREE.Euler(0,0,0,'YXZ');
    this._billboardTarget=new THREE.Quaternion();this._billboardRest=new THREE.Quaternion();
    this._build(options);this.ready=options.texture?Promise.resolve({texture:options.texture,fallback:false}):this._load(data.image??data.src??data.url,options);
    this.setQuality(this.quality);this._sync();
  }
  _build(options){
    const size=this._size,color=new THREE.Color(options.color??0x506ad1),hot=new THREE.Color(options.hotColor??0x82eaff);
    if(this.crystalType===CRYSTAL_TYPES.FINAL_SINGULARITY){color.set(0x000000);hot.set(0x090b14);}
    this.visuals=new THREE.Group();this.shellGroup=new THREE.Group();this.photoGroup=new THREE.Group();
    this.visuals.add(this.shellGroup,this.photoGroup);this.add(this.visuals);this.optionalDetails=[];
    this.crystalUniforms={uTime:{value:0},uEnergy:{value:.2},uFocus:{value:0},uCapture:{value:this.captureProgress},uDetail:{value:1},
      uVariant:{value:VARIANTS[this.crystalType]},uColor:{value:color},uHotColor:{value:hot},
      uOpacity:{value:options.crystalOpacity??(this.crystalType===CRYSTAL_TYPES.FINAL_SINGULARITY?1:.84)}};
    const crystalMaterial=new THREE.ShaderMaterial({uniforms:this.crystalUniforms,vertexShader:CRYSTAL_VERTEX,fragmentShader:CRYSTAL_FRAGMENT,
      transparent:true,depthWrite:this.crystalType===CRYSTAL_TYPES.FINAL_SINGULARITY,side:THREE.DoubleSide,extensions:{derivatives:true}});
    this.crystal=new THREE.Mesh(crystalGeometry(this.crystalType,size),crystalMaterial);this.shellGroup.add(this.crystal);
    if(this.crystalType===CRYSTAL_TYPES.TWIN_LENS)this._buildTwin(size,hot);
    this.energyUniforms={uTime:{value:0},uEnergy:{value:.2},uFocus:{value:0},uDetail:{value:1},uColor:{value:hot}};
    this.energySurface=new THREE.Mesh(crystalGeometry(this.crystalType,size*1.045),new THREE.ShaderMaterial({uniforms:this.energyUniforms,
      vertexShader:ENERGY_VERTEX,fragmentShader:ENERGY_FRAGMENT,transparent:true,depthWrite:false,side:THREE.DoubleSide,
      blending:THREE.AdditiveBlending,extensions:{derivatives:true}}));
    this.energySurface.visible=this.crystalType!==CRYSTAL_TYPES.FINAL_SINGULARITY;this.shellGroup.add(this.energySurface);
    if(this.crystalType===CRYSTAL_TYPES.PLANET_ANCHOR)this._buildPlanetRim(size,hot);
    const imageSize=options.imageSize??this.data.imageSize??[4.2,2.8];
    this.photoUniforms={uMap:{value:this.texture},uUnfold:{value:this.unfoldProgress},uCapture:{value:this.captureProgress},
      uAnchor:{value:this.anchorProgress},uOpacity:{value:options.photoOpacity??1},uFocus:{value:0},uPixelRatio:{value:this.pixelRatio}};
    this.photo=new THREE.Mesh(new THREE.PlaneGeometry(imageSize[0],imageSize[1],1,1),new THREE.ShaderMaterial({uniforms:this.photoUniforms,
      vertexShader:PHOTO_VERTEX,fragmentShader:PHOTO_FRAGMENT,transparent:true,depthWrite:false,side:THREE.DoubleSide,extensions:{derivatives:true}}));
    this.photo.renderOrder=8;this.photoGroup.position.set(0,0,size*.7);this.photoGroup.add(this.photo);
    this.hitProxy=new THREE.Mesh(new THREE.SphereGeometry(options.hitRadius??size*1.45,8,6),new THREE.MeshBasicMaterial({visible:false,side:THREE.DoubleSide}));
    this.hitProxy.userData.memoryCarrier=this;this.hitProxy.userData.crystalType=this.crystalType;this.add(this.hitProxy);this.hitTargets.push(this.hitProxy,this.crystal);
  }
  _buildTwin(size,hot){
    this.crystal.position.x=-size*.58;this.twin=this.crystal.clone();this.twin.position.x=size*.58;this.twin.rotation.y=Math.PI;this.shellGroup.add(this.twin);
    this.lensingRing=new THREE.Mesh(new THREE.TorusGeometry(size*1.12,size*.014,3,72),basicLine(hot,.48));
    this.lensingRing.rotation.x=Math.PI*.5;this.shellGroup.add(this.lensingRing);
    this.twinOrbit=new THREE.Mesh(new THREE.TorusGeometry(size*.64,size*.008,3,64),basicLine(hot,.28));
    this.twinOrbit.scale.y=.42;this.shellGroup.add(this.twinOrbit);this.optionalDetails.push(this.twinOrbit);
  }
  _buildPlanetRim(size,hot){
    this.planetLimb=new THREE.Mesh(new THREE.RingGeometry(size*2.18,size*2.205,96,1,0,Math.PI),basicLine(hot,.68));
    this.planetLimb.position.set(0,-size*2.35,-size*.8);this.shellGroup.add(this.planetLimb);
    this.planetHalo=new THREE.Mesh(new THREE.TorusGeometry(size*1.18,size*.009,3,72),basicLine(hot,.22));
    this.planetHalo.rotation.x=Math.PI*.36;this.shellGroup.add(this.planetHalo);this.optionalDetails.push(this.planetHalo);
  }
  async _load(url,options){
    const fallback=this.texture,result=await loadCarrierTexture(url,{fallback,loader:options.textureLoader,anisotropy:this.quality==='high'?8:2,signal:options.signal});
    if(this.disposed){if(result.texture&&result.texture!==fallback)result.texture.dispose();return {...result,texture:null};}
    if(result.texture&&result.texture!==this.texture){const previous=this.texture;this.texture=result.texture;this._configureTexture(result.texture);
      this.photoUniforms.uMap.value=result.texture;if(this._ownsTexture)previous?.dispose();}
    if(result.error&&typeof this.data.onTextureError==='function')this.data.onTextureError(result.error,this);return result;
  }
  _configureTexture(texture){
    if(!texture)return;texture.anisotropy=this.quality==='high'?8:this.quality==='medium'?4:2;
    texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;
  }
  setFocused(focused=true){super.setFocused(focused);this.focusIntensity=this.focused?1:0;this._sync();return this;}
  setFocusIntensity(value=0){this.focusIntensity=clamp(value);this.focused=this.focusIntensity>0;this._sync();return this;}
  setDiscoveryProgress(value=0){super.setDiscoveryProgress(value);this._sync();return this;}
  setVisited(visited=true){super.setVisited(visited);this.setCaptureProgress(visited?1:0);return this;}
  setQuality(quality='high'){super.setQuality(quality);this._configureTexture(this.texture);const detailed=quality==='high';
    this.optionalDetails?.forEach(detail=>{detail.visible=detailed;});if(this.crystalUniforms)this.crystalUniforms.uDetail.value=quality==='low'?0:1;
    if(this.energyUniforms)this.energyUniforms.uDetail.value=detailed?1:0;return this;}
  setPixelRatio(value=1){this.pixelRatio=THREE.MathUtils.clamp(Number(value)||1,1,3);if(this.photoUniforms)this.photoUniforms.uPixelRatio.value=this.pixelRatio;return this;}
  setUnfoldProgress(value=0){this.unfoldProgress=clamp(value);this._sync();return this;}
  unfold(value=1){return this.setUnfoldProgress(value);} retract(value=0){return this.setUnfoldProgress(value);}
  setAnchorProgress(value=0){this.anchorProgress=clamp(value);this._sync();return this;}
  setCaptureProgress(value=0){this.captureProgress=clamp(value);if(this.captureProgress>=1)this.state=MEMORY_CARRIER_STATES.CAPTURED;this._sync();return this;}
  anchor(value=1){return this.setAnchorProgress(value);} capture(value=1){return this.setCaptureProgress(value);}
  setAnimationProgress(value={}){if(Number.isFinite(value))return this.setUnfoldProgress(value);
    if(Number.isFinite(value.unfold??value.reveal))this.setUnfoldProgress(value.unfold??value.reveal);
    if(Number.isFinite(value.anchor))this.setAnchorProgress(value.anchor);if(Number.isFinite(value.capture))this.setCaptureProgress(value.capture);return this;}
  _sync(){if(!this.crystalUniforms)return;const energy=.18+this.discoveryProgress*.72+this.focusIntensity*.55;
    this.crystalUniforms.uEnergy.value=energy;this.crystalUniforms.uFocus.value=this.focusIntensity;this.crystalUniforms.uCapture.value=smooth(this.captureProgress);
    this.energyUniforms.uEnergy.value=energy;this.energyUniforms.uFocus.value=this.focusIntensity;this.photoUniforms.uUnfold.value=smooth(this.unfoldProgress);
    this.photoUniforms.uCapture.value=smooth(this.captureProgress);this.photoUniforms.uAnchor.value=smooth(this.anchorProgress);
    this.photoUniforms.uFocus.value=this.focusIntensity;this.photo.visible=this.unfoldProgress>.001;}
  _updateBillboard(camera,dt){
    if(camera&&this.parent){camera.getWorldPosition(this._cameraLocal);this.visuals.worldToLocal(this._cameraLocal);
      this._cameraLocal.sub(this.photoGroup.position);const yaw=THREE.MathUtils.clamp(Math.atan2(this._cameraLocal.x,this._cameraLocal.z),-.61,.61);
      const pitch=THREE.MathUtils.clamp(-Math.atan2(this._cameraLocal.y,Math.hypot(this._cameraLocal.x,this._cameraLocal.z)),-.38,.38);
      this._billboardEuler.set(pitch,yaw,0);this._billboardTarget.setFromEuler(this._billboardEuler);
      this._billboardTarget.slerp(this._billboardRest,1-smooth(this.focusIntensity));}
    else this._billboardTarget.copy(this._billboardRest);
    this.photoGroup.quaternion.slerp(this._billboardTarget,Math.min(1,dt*9));
  }
  update(delta=0,context={}){if(this.disposed)return;const dt=Math.min(Math.max(Number(delta)||0,0),.1);
    this.elapsed=Number.isFinite(context.elapsed)?context.elapsed:this.elapsed+dt;this.crystalUniforms.uTime.value=this.elapsed;this.energyUniforms.uTime.value=this.elapsed;
    if(!this.reducedMotion){this.shellGroup.rotation.y+=dt*(.12+this.focusIntensity*.16);
      if(this.twin){const orbit=this.elapsed*.42;this.crystal.position.set(Math.cos(orbit)*this._size*.58,Math.sin(orbit)*this._size*.24,0);
        this.twin.position.set(-this.crystal.position.x,-this.crystal.position.y,0);this.lensingRing.rotation.z=-orbit*.3;}
      this.visuals.position.y=Math.sin(this.elapsed*.785398163)*.03*(1-this.anchorProgress);}
    this.visuals.scale.setScalar(1+Math.sin(this.elapsed*.785398163)*.015+this.focusIntensity*.035);
    const targetZ=this._size*.7+this.anchorProgress*1.1;this.photoGroup.position.z+=(targetZ-this.photoGroup.position.z)*Math.min(1,dt*5);
    this._updateBillboard(context.camera,dt);}
  dispose(){if(this.disposed)return;const texture=this._ownsTexture?this.texture:null;super.dispose();texture?.dispose?.();
    this.texture=null;this.crystalUniforms=null;this.energyUniforms=null;this.photoUniforms=null;}
}
