precision highp float;
attribute vec3 position;attribute vec3 normal;
uniform mat4 world;uniform mat4 worldViewProjection;uniform mat4 view;uniform mat4 normalMatrix;
varying vec3 vNorm;varying vec3 vWorld;
void main(){vec4 p=view*world*vec4(position,1.0);vec3 n=mat3(view)*mat3(normalMatrix)*normal;vWorld=vec3(p.xy,-p.z);vNorm=vec3(n.xy,-n.z);gl_Position=worldViewProjection*vec4(position,1.0);}