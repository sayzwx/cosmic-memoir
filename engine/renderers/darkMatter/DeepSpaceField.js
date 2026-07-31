import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { getQualityBudget, MAX_ENVIRONMENT_BUDGET } from './qualityBudgets.js';
import { createRandom, disposeRenderable } from './math.js';

const VERTEX=`attribute float aLayer,aSeed,aSize;attribute vec3 aColor;
uniform float uTime,uPixelRatio,uMotion,uMaxSize;uniform vec2 uViewport;varying vec3 vColor;varying float vAlpha,vShape;
void main(){float speed=.006+aLayer*.016,angle=uTime*speed*uMotion,c=cos(angle),s=sin(angle);
vec3 p=vec3(position.x*c-position.z*s,position.y,position.x*s+position.z*c);vec4 mv=modelViewMatrix*vec4(p,1.);
float twinkle=mix(1.,.68+.32*sin(uTime*(.35+aSeed*1.7)+aSeed*57.)*.5+.16,uMotion);
float viewportScale=clamp(sqrt(uViewport.y/900.),.82,1.16);gl_PointSize=clamp(aSize*twinkle*viewportScale,.5,uMaxSize)*uPixelRatio;
gl_Position=projectionMatrix*mv;vColor=aColor*(.78+.3*twinkle);vAlpha=(.42+aLayer*.2)*twinkle;vShape=step(.82,aSeed);}`;
const FRAGMENT=`varying vec3 vColor;varying float vAlpha,vShape;void main(){vec2 p=abs(gl_PointCoord-.5);
float diamond=p.x+p.y;float cross=min(max(p.x*5.,p.y),max(p.y*5.,p.x));float shape=mix(diamond,min(diamond,cross),vShape);
if(shape>.5)discard;float aa=max(fwidth(shape)*.7,.025);float edge=1.0-smoothstep(.5-aa,.5,shape);
gl_FragColor=vec4(vColor,edge*vAlpha);}`;
const PALETTE=[[.56,.77,1.],[.86,.91,1.],[1.,.86,.65],[.42,.84,1.],[1.,.68,.42]];

export function createDeepSpaceField(options={}){
  const capacity=Math.max(10,Math.min(options.capacity??MAX_ENVIRONMENT_BUDGET.stars,MAX_ENVIRONMENT_BUDGET.stars));
  const random=createRandom(options.seed??1837),radius=options.radius??2200,positions=new Float32Array(capacity*3);
  const colors=new Float32Array(capacity*3),layers=new Float32Array(capacity),seeds=new Float32Array(capacity),sizes=new Float32Array(capacity);
  for(let i=0;i<capacity;i++){
    const slot=i%10,layer=slot<6?0:slot<9?1:2,range=layer===0?[.78,1.08]:layer===1?[.48,.76]:[.24,.46];
    const z=random()*2-1,angle=random()*Math.PI*2,planar=Math.sqrt(1-z*z),distance=radius*(range[0]+random()*(range[1]-range[0])),i3=i*3;
    positions[i3]=Math.cos(angle)*planar*distance;positions[i3+1]=z*distance;positions[i3+2]=Math.sin(angle)*planar*distance;
    const palette=PALETTE[Math.min(PALETTE.length-1,Math.floor(random()*PALETTE.length))],energy=.82+random()*.3;
    colors[i3]=palette[0]*energy;colors[i3+1]=palette[1]*energy;colors[i3+2]=palette[2]*energy;
    layers[i]=layer;seeds[i]=random();const base=layer===0?.5:layer===1?.8:1.15;
    sizes[i]=Math.min(8,base+Math.pow(random(),layer===2?5:8)*(layer===2?6.85:4.2));
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  geometry.setAttribute('aColor',new THREE.BufferAttribute(colors,3));geometry.setAttribute('aLayer',new THREE.BufferAttribute(layers,1));
  geometry.setAttribute('aSeed',new THREE.BufferAttribute(seeds,1));geometry.setAttribute('aSize',new THREE.BufferAttribute(sizes,1));
  const uniforms={uTime:{value:0},uPixelRatio:{value:options.pixelRatio??1},uMotion:{value:1},uMaxSize:{value:options.mobile?6:8},uViewport:{value:new THREE.Vector2(1920,1080)}};
  const material=new THREE.ShaderMaterial({uniforms,vertexShader:VERTEX,fragmentShader:FRAGMENT,transparent:true,depthWrite:false,
    blending:THREE.AdditiveBlending,extensions:{derivatives:true}});
  const object3D=new THREE.Points(geometry,material);object3D.frustumCulled=false;
  const api={object3D,capacity,drawCalls:1,
    update(delta=0,elapsed){uniforms.uTime.value=Number.isFinite(elapsed)?elapsed:uniforms.uTime.value+delta;},
    setQuality(quality='high',mobile=false){const budget=getQualityBudget(quality,mobile);geometry.setDrawRange(0,Math.min(capacity,budget.stars));uniforms.uMaxSize.value=mobile?6:8;},
    setPixelRatio(value=1){uniforms.uPixelRatio.value=THREE.MathUtils.clamp(value||1,.5,2);},
    setViewport(width=1920,height=1080,mobile){uniforms.uViewport.value.set(Math.max(1,width),Math.max(1,height));if(typeof mobile==='boolean')uniforms.uMaxSize.value=mobile?6:8;},
    setReducedMotion(value=true){uniforms.uMotion.value=value?0:1;},dispose(){disposeRenderable(object3D);}};
  api.setQuality(options.quality,options.mobile);return api;
}
