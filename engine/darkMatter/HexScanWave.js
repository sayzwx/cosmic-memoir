import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { disposeRenderable, setPosition } from './math.js';

const VERTEX=`attribute float aPhase;uniform float uProgress,uRadius;varying float vPhase;varying vec2 vUv;
void main(){float local=fract(uProgress-aPhase+.08);vec3 p=position;p.xy*=1.0+local*uRadius;
vPhase=local;vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}`;
const FRAGMENT=`uniform vec3 uColor;uniform float uOpacity;varying float vPhase;varying vec2 vUv;
void main(){float edge=step(.08,vUv.y)*step(vUv.y,.92);float fade=sin(vPhase*3.14159265);
float a=edge*fade*uOpacity;if(a<.01)discard;gl_FragColor=vec4(uColor*(.8+fade*.6),a);}`;

export function createHexScanWave(options={}){
  const rings=Math.max(1,options.rings??4),positions=[],uvs=[],phases=[],indices=[];let offset=0;
  for(let ring=0;ring<rings;ring++)for(let side=0;side<6;side++){
    const a=side*Math.PI/3,b=(side+1)*Math.PI/3,inner=.92;
    positions.push(Math.cos(a),Math.sin(a),0,Math.cos(a)*inner,Math.sin(a)*inner,0,
      Math.cos(b),Math.sin(b),0,Math.cos(b)*inner,Math.sin(b)*inner,0);
    uvs.push(side/6,0,side/6,1,(side+1)/6,0,(side+1)/6,1);
    phases.push(ring/rings,ring/rings,ring/rings,ring/rings);
    indices.push(offset,offset+1,offset+2,offset+2,offset+1,offset+3);offset+=4;
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.setAttribute('aPhase',new THREE.Float32BufferAttribute(phases,1));geometry.setIndex(indices);
  const uniforms={uProgress:{value:0},uRadius:{value:options.radius??8},uOpacity:{value:options.opacity??.8},
    uColor:{value:new THREE.Color(options.color??0x6ee8ff)}};
  const object3D=new THREE.Mesh(geometry,new THREE.ShaderMaterial({uniforms,vertexShader:VERTEX,fragmentShader:FRAGMENT,
    transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}));
  setPosition(object3D,options.position,[0,0,0]);object3D.visible=Boolean(options.active);
  let active=Boolean(options.active),progress=0;
  return {object3D,drawCalls:1,trigger(){active=true;progress=0;object3D.visible=true;},
    update(delta=0){if(!active)return;progress+=delta/(options.duration??1.4);uniforms.uProgress.value=progress;
      if(progress>=1.08){active=Boolean(options.loop);progress=active?0:1;object3D.visible=active;}},
    setProgress(value=0){progress=THREE.MathUtils.clamp(value,0,1);uniforms.uProgress.value=progress;object3D.visible=true;},
    setOpacity(value=1){uniforms.uOpacity.value=THREE.MathUtils.clamp(value,0,1);},dispose(){disposeRenderable(object3D);}};
}
