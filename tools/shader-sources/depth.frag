#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform float uLinearMode;
varying float vLinDepth;
varying vec3 vViewNormal;
void main() {
  float d = mix(gl_FragCoord.z, clamp(vLinDepth, 0.0, 0.9999), uLinearMode);
  d = clamp(d, 0.0, 0.9999);
  float d255 = d * 255.0;
  float hi = floor(d255) / 255.0;
  float lo = fract(d255);
  vec2 enc=vec2(0.0,1.0);if(uLinearMode>.5){vec3 n=normalize(vViewNormal);n/=max(.00001,abs(n.x)+abs(n.y)+abs(n.z));enc=n.xy;if(n.z<0.0)enc=(1.0-abs(enc.yx))*vec2(enc.x>=0.0?1.0:-1.0,enc.y>=0.0?1.0:-1.0);enc=enc*.5+.5;}
  gl_FragColor = vec4(hi,lo,enc);
}