import { Color, Vector4, type Material } from 'three';
import { CBD_PLANES, CBD_FADE_IN_M, CBD_FADE_OUT_M } from './cbdBoundary';

type Shader = Parameters<Material['onBeforeCompile']>[0];
export function cbdFadeUniforms() {
  return {
    cbdFadeOn: {value: 1},
    cbdIsGlow: {value: 0},
    cbdFadeColour: {value: new Color()},
    cbdFadePlanes: {value: CBD_PLANES.map(p=>new Vector4(p.normal.x,p.normal.z,p.constant,0))},
  };
}
/** Spatial mist in output colour space: preserves the material's original alpha and its shadows. */
export function addCBDFade(shader:Shader,uniforms:ReturnType<typeof cbdFadeUniforms>) {
  Object.assign(shader.uniforms,uniforms);
  shader.vertexShader=`varying vec2 vCBDWorldXZ;
`+shader.vertexShader;
  if(shader.vertexShader.includes('#include <project_vertex>')) {
    shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
      vec4 cbdWorldPosition = vec4(transformed, 1.0);
      #ifdef USE_BATCHING
        cbdWorldPosition = batchingMatrix * cbdWorldPosition;
      #endif
      #ifdef USE_INSTANCING
        cbdWorldPosition = instanceMatrix * cbdWorldPosition;
      #endif
      vCBDWorldXZ = (modelMatrix * cbdWorldPosition).xz;`);
  } else {
    // Line2 uses endpoints rather than the standard projected vertex chunk.
    shader.vertexShader=shader.vertexShader.replace('void main() {',`void main() {
      vCBDWorldXZ = (modelMatrix * vec4(mix(instanceStart,instanceEnd,step(0.5,position.y)),1.0)).xz;`);
  }
  shader.fragmentShader=`varying vec2 vCBDWorldXZ;
    uniform float cbdFadeOn;
    uniform float cbdIsGlow;
    uniform vec3 cbdFadeColour;
    uniform vec4 cbdFadePlanes[4];
`+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <colorspace_fragment>',`#include <colorspace_fragment>
    float cbdDistance = 100000.0;
    for (int i=0; i<4; i++) cbdDistance = min(cbdDistance,dot(cbdFadePlanes[i].xy,vCBDWorldXZ)+cbdFadePlanes[i].z);
    float cbdMist = cbdFadeOn * (1.0-smoothstep(-${CBD_FADE_OUT_M.toFixed(1)},${CBD_FADE_IN_M.toFixed(1)},cbdDistance));
    gl_FragColor.rgb = mix(gl_FragColor.rgb,mix(cbdFadeColour,vec3(0.0),cbdIsGlow),cbdMist);
  `);
}
