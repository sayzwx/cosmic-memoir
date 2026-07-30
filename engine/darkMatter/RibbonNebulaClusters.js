import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { createRandom, disposeRenderable, setPosition } from './math.js';
import { getQualityBudget } from './qualityBudgets.js';

const VERTEX=`attribute vec3 aStart,aEnd,aColor;attribute float aSide,aAlong,aAlpha,aSeed;
uniform float uTime,uMotion,uPixelRatio;uniform vec2 uViewport;varying vec3 vColor;varying float vAcross,vAlong,vAlpha,vSeed;
void main(){float drift=sin(uTime*.16+aSeed*17.)*uMotion*.8;vec3 s=aStart,e=aEnd;s.z+=drift;e.z+=drift;
vec4 va=modelViewMatrix*vec4(s,1.),vb=modelViewMatrix*vec4(e,1.);vec4 ca=projectionMatrix*va,cb=projectionMatrix*vb;
vec2 d=(cb.xy/cb.w-ca.xy/ca.w)*uViewport;vec2 n=normalize(vec2(-d.y,d.x)+vec2(.0001,0.));vec4 clip=mix(ca,cb,aAlong);
float width=(1.0+2.2*aAlpha)*uPixelRatio;clip.xy+=n*aSide*width*2.0/uViewport*clip.w;gl_Position=clip;
vColor=aColor;vAcross=aSide;vAlong=aAlong;vAlpha=aAlpha;vSeed=aSeed;}`;
const FRAGMENT=`varying vec3 vColor;varying float vAcross,vAlong,vAlpha,vSeed;uniform float uOpacity;
void main(){float aa=max(fwidth(vAcross)*.65,.02);float edge=1.0-smoothstep(1.0-aa,1.0,abs(vAcross));
float dash=step(.28,fract(vAlong*5.0+vSeed*9.0));float core=step(abs(vAcross),.18);
float alpha=edge*vAlpha*uOpacity*(.68+.22*dash+.10*core);if(alpha<.012)discard;gl_FragColor=vec4(vColor*(.9+.22*core),alpha);}`;

export function createRibbonNebulaClusters(options={}){
  const random=createRandom(options.seed??3301),clusterCount=4,filaments=Math.max(2,options.filaments??4);
  const segmentCapacity=Math.max(12,options.segments??72),quadCount=clusterCount*filaments*segmentCapacity;
  const vertexCount=quadCount*4,positions=new Float32Array(vertexCount*3),starts=new Float32Array(vertexCount*3),ends=new Float32Array(vertexCount*3);
  const colors=new Float32Array(vertexCount*3),sides=new Float32Array(vertexCount),along=new Float32Array(vertexCount);
  const alphas=new Float32Array(vertexCount),seeds=new Float32Array(vertexCount),indices=new Uint16Array(quadCount*6);
  const palette=[new THREE.Color(0xf05aa9),new THREE.Color(0x9b50e6),new THREE.Color(0x45d8e8),new THREE.Color(0x5368df)];let q=0;
  for(let step=0;step<segmentCapacity;step++)for(let cluster=0;cluster<clusterCount;cluster++)for(let filament=0;filament<filaments;filament++){
    const base=[Math.PI,0,Math.PI*.5,-Math.PI*.5][cluster],span=.88,t0=step/segmentCapacity,t1=(step+1)/segmentCapacity;
    const radial=(filament-(filaments-1)*.5)*7,phase=filament*.83+cluster*1.7;
    const point=t=>{const angle=base+(t-.5)*span;const ripple=Math.sin(t*12.0+phase)*4.2;
      return new THREE.Vector3(Math.cos(angle)*(205+radial+ripple),Math.sin(angle)*(118+radial*.52+ripple*.45),-18+cluster*11+Math.sin(t*7+phase)*8);};
    const a=point(t0),b=point(t1),color=palette[cluster],alpha=.24+random()*.18;
    for(let v=0;v<4;v++){const n=q*4+v,n3=n*3;starts.set(a.toArray(),n3);ends.set(b.toArray(),n3);colors.set(color.toArray(),n3);
      sides[n]=v%2?-1:1;along[n]=v<2?0:1;alphas[n]=alpha;seeds[n]=random();}
    const n=q*4;indices.set([n,n+1,n+2,n+2,n+1,n+3],q*6);q++;
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  geometry.setAttribute('aStart',new THREE.BufferAttribute(starts,3));geometry.setAttribute('aEnd',new THREE.BufferAttribute(ends,3));
  geometry.setAttribute('aColor',new THREE.BufferAttribute(colors,3));geometry.setAttribute('aSide',new THREE.BufferAttribute(sides,1));
  geometry.setAttribute('aAlong',new THREE.BufferAttribute(along,1));geometry.setAttribute('aAlpha',new THREE.BufferAttribute(alphas,1));
  geometry.setAttribute('aSeed',new THREE.BufferAttribute(seeds,1));geometry.setIndex(new THREE.BufferAttribute(indices,1));
  const uniforms={uTime:{value:0},uMotion:{value:1},uOpacity:{value:options.opacity??1},uPixelRatio:{value:options.pixelRatio??1},uViewport:{value:new THREE.Vector2(1920,1080)}};
  const object3D=new THREE.Mesh(geometry,new THREE.ShaderMaterial({uniforms,vertexShader:VERTEX,fragmentShader:FRAGMENT,transparent:true,
    depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,extensions:{derivatives:true}}));setPosition(object3D,options.position,[0,0,-520]);object3D.frustumCulled=false;
  const api={object3D,clusterCount,capacity:quadCount,drawCalls:1,
    update(delta=0,elapsed){uniforms.uTime.value=Number.isFinite(elapsed)?elapsed:uniforms.uTime.value+delta;},
    setQuality(quality='high',mobile=false){const budget=getQualityBudget(quality,mobile);
      const steps=Math.max(8,Math.min(segmentCapacity,budget.nebulaSegments));geometry.setDrawRange(0,Math.min(quadCount,steps*clusterCount*filaments)*6);},
    setPixelRatio(value=1){uniforms.uPixelRatio.value=THREE.MathUtils.clamp(value||1,.5,2);},
    setViewport(width=1920,height=1080){uniforms.uViewport.value.set(Math.max(1,width)*uniforms.uPixelRatio.value,Math.max(1,height)*uniforms.uPixelRatio.value);},
    setOpacity(value=1){uniforms.uOpacity.value=THREE.MathUtils.clamp(value,0,1);},setReducedMotion(reduced=true){uniforms.uMotion.value=reduced?0:1;},
    dispose(){disposeRenderable(object3D);}};api.setQuality(options.quality,options.mobile);return api;
}
