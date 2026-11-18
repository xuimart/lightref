#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec3 vNorm;varying vec3 vWorld;
uniform mat4 uInvView;uniform vec3 uAmbientCol;uniform vec3 uHorizonCol;uniform vec3 uFloorCol;uniform float uObjGap;
uniform float uShadowFilter;uniform float uTransparency;
uniform sampler2D uShadowMap;uniform mat4 uLightVP;uniform float uHasShadowMap;uniform float uSpread;uniform vec3 uLightDir0;uniform vec3 uLightCol0;uniform float uLightInt0;
uniform vec3 uLightPosition0;uniform vec3 uLightAxis0;uniform vec3 uAreaU0;uniform vec3 uAreaV0;uniform float uLightType0;uniform float uLightRange0;uniform vec2 uLightCone0;uniform vec2 uShadowDepth0;uniform float uShadowPacked0;uniform vec4 uBeam0;
uniform sampler2D uShadow1;uniform mat4 uLightVP1;uniform float uHasShadow1;uniform float uSpread1;uniform vec3 uLightDir1;uniform vec3 uLightCol1;uniform float uLightInt1;
uniform vec3 uLightPosition1;uniform vec3 uLightAxis1;uniform vec3 uAreaU1;uniform vec3 uAreaV1;uniform float uLightType1;uniform float uLightRange1;uniform vec2 uLightCone1;uniform vec2 uShadowDepth1;uniform float uShadowPacked1;uniform vec4 uBeam1;
uniform sampler2D uShadow2;uniform mat4 uLightVP2;uniform float uHasShadow2;uniform float uSpread2;uniform vec3 uLightDir2;uniform vec3 uLightCol2;uniform float uLightInt2;
uniform vec3 uLightPosition2;uniform vec3 uLightAxis2;uniform vec3 uAreaU2;uniform vec3 uAreaV2;uniform float uLightType2;uniform float uLightRange2;uniform vec2 uLightCone2;uniform vec2 uShadowDepth2;uniform float uShadowPacked2;uniform vec4 uBeam2;
uniform sampler2D uShadow3;uniform mat4 uLightVP3;uniform float uHasShadow3;uniform float uSpread3;uniform vec3 uLightDir3;uniform vec3 uLightCol3;uniform float uLightInt3;
uniform vec3 uLightPosition3;uniform vec3 uLightAxis3;uniform vec3 uAreaU3;uniform vec3 uAreaV3;uniform float uLightType3;uniform float uLightRange3;uniform vec2 uLightCone3;uniform vec2 uShadowDepth3;uniform float uShadowPacked3;uniform vec4 uBeam3;
uniform sampler2D uShadow4;uniform mat4 uLightVP4;uniform float uHasShadow4;uniform float uSpread4;uniform vec3 uLightDir4;uniform vec3 uLightCol4;uniform float uLightInt4;
uniform vec3 uLightPosition4;uniform vec3 uLightAxis4;uniform vec3 uAreaU4;uniform vec3 uAreaV4;uniform float uLightType4;uniform float uLightRange4;uniform vec2 uLightCone4;uniform vec2 uShadowDepth4;uniform float uShadowPacked4;uniform vec4 uBeam4;
uniform sampler2D uShadow5;uniform mat4 uLightVP5;uniform float uHasShadow5;uniform float uSpread5;uniform vec3 uLightDir5;uniform vec3 uLightCol5;uniform float uLightInt5;
uniform vec3 uLightPosition5;uniform vec3 uLightAxis5;uniform vec3 uAreaU5;uniform vec3 uAreaV5;uniform float uLightType5;uniform float uLightRange5;uniform vec2 uLightCone5;uniform vec2 uShadowDepth5;uniform float uShadowPacked5;uniform vec4 uBeam5;
uniform sampler2D uShadow6;uniform mat4 uLightVP6;uniform float uHasShadow6;uniform float uSpread6;uniform vec3 uLightDir6;uniform vec3 uLightCol6;uniform float uLightInt6;
uniform vec3 uLightPosition6;uniform vec3 uLightAxis6;uniform vec3 uAreaU6;uniform vec3 uAreaV6;uniform float uLightType6;uniform float uLightRange6;uniform vec2 uLightCone6;uniform vec2 uShadowDepth6;uniform float uShadowPacked6;uniform vec4 uBeam6;
uniform sampler2D uShadow7;uniform mat4 uLightVP7;uniform float uHasShadow7;uniform float uSpread7;uniform vec3 uLightDir7;uniform vec3 uLightCol7;uniform float uLightInt7;
uniform vec3 uLightPosition7;uniform vec3 uLightAxis7;uniform vec3 uAreaU7;uniform vec3 uAreaV7;uniform float uLightType7;uniform float uLightRange7;uniform vec2 uLightCone7;uniform vec2 uShadowDepth7;uniform float uShadowPacked7;uniform vec4 uBeam7;
uniform sampler2D uShadow8;uniform mat4 uLightVP8;uniform float uHasShadow8;uniform float uSpread8;uniform vec3 uLightDir8;uniform vec3 uLightCol8;uniform float uLightInt8;
uniform vec3 uLightPosition8;uniform vec3 uLightAxis8;uniform vec3 uAreaU8;uniform vec3 uAreaV8;uniform float uLightType8;uniform float uLightRange8;uniform vec2 uLightCone8;uniform vec2 uShadowDepth8;uniform float uShadowPacked8;uniform vec4 uBeam8;
uniform vec3 uCameraWorld;uniform float uFloorAmbient;uniform vec2 uObjCenterXZ;uniform float uCamDist;
uniform vec3 uGlassCenter;uniform float uGlassRadius;uniform float uIOR;uniform float uThickness;uniform float uAbsorption;uniform float uCaustics;uniform vec3 uBaseCol;
vec3 acesToneMap(vec3 x) {
  float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}
float compareShadow(sampler2D sm,vec2 uv,float depth){vec4 d=texture2D(sm,uv);return depth>d.r+d.g/255.0?0.0:1.0;}
float filteredShadow(sampler2D sm,vec2 uv,float depth){vec2 grid=uv*1024.0-.5,base=(floor(grid)+.5)/1024.0,f=fract(grid);return mix(mix(compareShadow(sm,base,depth),compareShadow(sm,base+vec2(1.0/1024.0,0.0),depth),f.x),mix(compareShadow(sm,base+vec2(0.0,1.0/1024.0),depth),compareShadow(sm,base+vec2(1.0/1024.0),depth),f.x),f.y);}
float artShadow(sampler2D sm,mat4 vp,float enabled,vec3 pos,float ndotl,float spread){
 if(enabled<0.5)return 1.0;vec4 p=vp*vec4(pos,1.0);vec3 sc=p.xyz/p.w*0.5+0.5;
 if(sc.x<0.002||sc.x>0.998||sc.y<0.002||sc.y>0.998||sc.z<=0.0||sc.z>=0.999)return 1.0;
 float bias=max(0.001,0.004*(1.0-max(0.0,ndotl)));float texel=(1.0/1024.0)*(1.0+spread*2.8);float result=0.0;
 if(uShadowFilter>.5){for(int x=0;x<2;x++)for(int y=0;y<2;y++)result+=filteredShadow(sm,sc.xy+(vec2(float(x),float(y))-.5)*texel*1.5,sc.z-bias);return mix(result*.25,1.0,uTransparency*.8);}
 for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++){vec4 ds=texture2D(sm,sc.xy+vec2(float(x),float(y))*texel);float depth=ds.r+ds.g/255.0;result+=(sc.z-bias>depth)?0.0:1.0;}return mix(result/9.0,1.0,uTransparency*.8);
}
float coneMask(float cosine,vec2 cone){return cone.x-cone.y<0.000001?step(cone.y,cosine):smoothstep(cone.y,cone.x,cosine);}
float rectangularBeam(vec3 source,vec3 axis,vec3 U,vec3 W,vec4 beam){
 if(beam.w<0.5)return 1.0;vec3 q=vWorld-source;if(dot(q,axis)<=0.0)return 0.0;
 vec2 xy=abs(vec2(dot(q,normalize(U)),dot(q,normalize(W)))),halfSize=max(beam.xy,vec2(.0001));
 if(beam.z<.0001)return (1.0-step(halfSize.x,xy.x))*(1.0-step(halfSize.y,xy.y));
 vec2 edge=max(halfSize*beam.z,vec2(.0001)),mask=vec2(1.0)-smoothstep(halfSize-edge,halfSize,xy);return mask.x*mask.y;
}
float localFalloff(float distance,float range){float cutoff=clamp(1.0-pow(distance/max(range,0.001),4.0),0.0,1.0);return 10.0/(1.0+distance*distance)*cutoff*cutoff;}
float pointShadow(samplerCube sm,float enabled,vec3 position,vec3 source,vec2 depthValues,float depthPacked,float spread){
 if(enabled<0.5)return 1.0;vec3 delta=position-source;float depth=clamp((length(delta)+depthValues.x)/depthValues.y,0.0,1.0)-.002;
 vec3 direction=normalize(mat3(uInvView)*vec3(delta.xy,-delta.z));direction.y=-direction.y;float visible=0.0;
 for(int i=0;i<4;i++){vec3 offset=vec3(i<2?-1.0:1.0,i==0||i==2?-1.0:1.0,i==0||i==3?-1.0:1.0)*(0.001+spread*.006);vec4 sampleDepth=textureCube(sm,direction+offset);float stored=mix(sampleDepth.r,dot(sampleDepth,vec4(1.0/16581375.0,1.0/65025.0,1.0/255.0,1.0)),depthPacked);visible+=depth>stored?0.0:1.0;}return mix(visible*.25,1.0,uTransparency*.8);
}
float shadowFor0(vec3 N,vec3 L){return artShadow(uShadowMap,uLightVP,uHasShadowMap,vWorld,dot(N,L),uSpread);}
float shadowFor1(vec3 N,vec3 L){return artShadow(uShadow1,uLightVP1,uHasShadow1,vWorld,dot(N,L),uSpread1);}
float shadowFor2(vec3 N,vec3 L){return artShadow(uShadow2,uLightVP2,uHasShadow2,vWorld,dot(N,L),uSpread2);}
float shadowFor3(vec3 N,vec3 L){return artShadow(uShadow3,uLightVP3,uHasShadow3,vWorld,dot(N,L),uSpread3);}
float shadowFor4(vec3 N,vec3 L){return artShadow(uShadow4,uLightVP4,uHasShadow4,vWorld,dot(N,L),uSpread4);}
float shadowFor5(vec3 N,vec3 L){return artShadow(uShadow5,uLightVP5,uHasShadow5,vWorld,dot(N,L),uSpread5);}
float shadowFor6(vec3 N,vec3 L){return artShadow(uShadow6,uLightVP6,uHasShadow6,vWorld,dot(N,L),uSpread6);}
float shadowFor7(vec3 N,vec3 L){return artShadow(uShadow7,uLightVP7,uHasShadow7,vWorld,dot(N,L),uSpread7);}
float shadowFor8(vec3 N,vec3 L){return artShadow(uShadow8,uLightVP8,uHasShadow8,vWorld,dot(N,L),uSpread8);}
// Bounded ball-lens approximation for an artistic contact caustic; no light tracing.
vec3 glassCaustic(vec3 lightDir,vec3 source,vec3 axis,float type,float range,vec2 cone,float spread,vec3 color,float power,vec3 floorPoint){
 if(uTransparency<.001||uCaustics<.001||uIOR<1.001)return vec3(0.0);
 vec3 worldL=normalize(mat3(uInvView)*vec3(lightDir.xy,-lightDir.z));float attenuation=1.0;
 if(type>.5){vec3 worldSource=(uInvView*vec4(source.xy,-source.z,1.0)).xyz;vec3 delta=worldSource-uGlassCenter;worldL=normalize(delta);attenuation=localFalloff(length(delta),range);vec3 worldAxis=normalize(mat3(uInvView)*vec3(axis.xy,-axis.z));if(type>1.5&&type<2.5)attenuation*=coneMask(dot(-worldL,worldAxis),cone);if(type>2.5)attenuation*=max(0.0,dot(-worldL,worldAxis));}
 vec3 ray=-worldL;if(ray.y>-.03||uGlassCenter.y<=floorPoint.y)return vec3(0.0);
 float travel=(floorPoint.y-uGlassCenter.y)/ray.y,r=max(.03,uGlassRadius),focus=uIOR*r/(2.0*(uIOR-1.0));
 vec2 hit=(uGlassCenter+ray*travel).xz,delta=floorPoint.xz-hit;vec2 along=length(ray.xz)>.001?normalize(ray.xz):vec2(1.0,0.0),across=vec2(-along.y,along.x);
 float footprint=clamp(r*abs(1.0-travel/focus)+r*spread*.7,r*.09,r*5.0),q=pow(dot(delta,along)*abs(ray.y)/footprint,2.0)+pow(dot(delta,across)/footprint,2.0);
 float concentration=min(12.0,r*r/(footprint*footprint)),profile=exp(-q*3.0)*concentration*abs(ray.y);
 vec3 transmitted=pow(max(uBaseCol,vec3(.005)),vec3(uAbsorption*2.0*r*uThickness/.35));
 return transmitted*color*power*attenuation*profile*uCaustics*uTransparency*.8;
}
void main(){
 vec3 N=normalize(vNorm),lit=uAmbientCol*uFloorAmbient;
 if(uLightInt0>0.0){for(int sampleIndex=0;sampleIndex<4;sampleIndex++){if(sampleIndex>0&&uLightType0<2.5)break;vec3 source=uLightPosition0;if(uLightType0>2.5)source+=uAreaU0*(sampleIndex==0||sampleIndex==2?-0.57735:0.57735)+uAreaV0*(sampleIndex<2?-0.57735:0.57735);vec3 L=normalize(uLightDir0);float attenuation=1.0;if(uLightType0>0.5){vec3 delta=source-vWorld;float distance=max(0.0001,length(delta));L=delta/distance;attenuation=localFalloff(distance,uLightRange0);if(uLightType0>1.5&&uLightType0<2.5)attenuation*=coneMask(dot(-L,uLightAxis0),uLightCone0);if(uLightType0>2.5)attenuation*=max(0.0,dot(-L,uLightAxis0))*0.25*rectangularBeam(uLightPosition0,uLightAxis0,uAreaU0,uAreaV0,uBeam0);}float d=dot(N,L),sh=shadowFor0(N,L);float vis=mix(1.0,sh,smoothstep(-0.15,0.2,d));lit+=uLightCol0*clamp((d+0.25)/1.25,0.0,1.0)*vis*(uLightInt0/100.0)*attenuation*0.85;}}
if(uLightInt1>0.0){for(int sampleIndex=0;sampleIndex<4;sampleIndex++){if(sampleIndex>0&&uLightType1<2.5)break;vec3 source=uLightPosition1;if(uLightType1>2.5)source+=uAreaU1*(sampleIndex==0||sampleIndex==2?-0.57735:0.57735)+uAreaV1*(sampleIndex<2?-0.57735:0.57735);vec3 L=normalize(uLightDir1);float attenuation=1.0;if(uLightType1>0.5){vec3 delta=source-vWorld;float distance=max(0.0001,length(delta));L=delta/distance;attenuation=localFalloff(distance,uLightRange1);if(uLightType1>1.5&&uLightType1<2.5)attenuation*=coneMask(dot(-L,uLightAxis1),uLightCone1);if(uLightType1>2.5)attenuation*=max(0.0,dot(-L,uLightAxis1))*0.25*rectangularBeam(uLightPosition1,uLightAxis1,uAreaU1,uAreaV1,uBeam1);}float d=dot(N,L),sh=shadowFor1(N,L);float vis=mix(1.0,sh,smoothstep(-0.15,0.2,d));lit+=uLightCol1*clamp((d+0.25)/1.25,0.0,1.0)*vis*(uLightInt1/100.0)*attenuation*0.85;}}
if(uLightInt2>0.0){for(int sampleIndex=0;sampleIndex<4;sampleIndex++){if(sampleIndex>0&&uLightType2<2.5)break;vec3 source=uLightPosition2;if(uLightType2>2.5)source+=uAreaU2*(sampleIndex==0||sampleIndex==2?-0.57735:0.57735)+uAreaV2*(sampleIndex<2?-0.57735:0.57735);vec3 L=normalize(uLightDir2);float attenuation=1.0;if(uLightType2>0.5){vec3 delta=source-vWorld;float distance=max(0.0001,length(delta));L=delta/distance;attenuation=localFalloff(distance,uLightRange2);if(uLightType2>1.5&&uLightType2<2.5)attenuation*=coneMask(dot(-L,uLightAxis2),uLightCone2);if(uLightType2>2.5)attenuation*=max(0.0,dot(-L,uLightAxis2))*0.25*rectangularBeam(uLightPosition2,uLightAxis2,uAreaU2,uAreaV2,uBeam2);}float d=dot(N,L),sh=shadowFor2(N,L);float vis=mix(1.0,sh,smoothstep(-0.15,0.2,d));lit+=uLightCol2*clamp((d+0.25)/1.25,0.0,1.0)*vis*(uLightInt2/100.0)*attenuation*0.85;}}
if(uLightInt3>0.0){for(int sampleIndex=0;sampleIndex<4;sampleIndex++){if(sampleIndex>0&&uLightType3<2.5)break;vec3 source=uLightPosition3;if(uLightType3>2.5)source+=uAreaU3*(sampleIndex==0||sampleIndex==2?-0.57735:0.57735)+uAreaV3*(sampleIndex<2?-0.57735:0.57735);vec3 L=normalize(uLightDir3);float attenuation=1.0;if(uLightType3>0.5){vec3 delta=source-vWorld;float distance=max(0.0001,length(delta));L=delta/distance;attenuation=localFalloff(distance,uLightRange3);if(uLightType3>1.5&&uLightType3<2.5)attenuation*=coneMask(dot(-L,uLightAxis3),uLightCone3);if(uLightType3>2.5)attenuation*=max(0.0,dot(-L,uLightAxis3))*0.25*rectangularBeam(uLightPosition3,uLightAxis3,uAreaU3,uAreaV3,uBeam3);}float d=dot(N,L),sh=shadowFor3(N,L);float vis=mix(1.0,sh,smoothstep(-0.15,0.2,d));lit+=uLightCol3*clamp((d+0.25)/1.25,0.0,1.0)*vis*(uLightInt3/100.0)*attenuation*0.85;}}
if(uLightInt4>0.0){for(int sampleIndex=0;sampleIndex<4;sampleIndex++){if(sampleIndex>0&&uLightType4<2.5)break;vec3 source=uLightPosition4;if(uLightType4>2.5)source+=uAreaU4*(sampleIndex==0||sampleIndex==2?-0.57735:0.57735)+uAreaV4*(sampleIndex<2?-0.57735:0.57735);vec3 L=normalize(uLightDir4);float attenuation=1.0;if(uLightType4>0.5){vec3 delta=source-vWorld;float distance=max(0.0001,length(delta));L=delta/distance;attenuation=localFalloff(distance,uLightRange4);if(uLightType4>1.5&&uLightType4<2.5)attenuation*=coneMask(dot(-L,uLightAxis4),uLightCone4);if(uLightType4>2.5)attenuation*=max(0.0,dot(-L,uLightAxis4))*0.25*rectangularBeam(uLightPosition4,uLightAxis4,uAreaU4,uAreaV4,uBeam4);}float d=dot(N,L),sh=shadowFor4(N,L);float vis=mix(1.0,sh,smoothstep(-0.15,0.2,d));lit+=uLightCol4*clamp((d+0.25)/1.25,0.0,1.0)*vis*(uLightInt4/100.0)*attenuation*0.85;}}
if(uLightInt5>0.0){for(int sampleIndex=0;sampleIndex<4;sampleIndex++){if(sampleIndex>0&&uLightType5<2.5)break;vec3 source=uLightPosition5;if(uLightType5>2.5)source+=uAreaU5*(sampleIndex==0||sampleIndex==2?-0.57735:0.57735)+uAreaV5*(sampleIndex<2?-0.57735:0.57735);vec3 L=normalize(uLightDir5);float attenuation=1.0;if(uLightType5>0.5){vec3 delta=source-vWorld;float distance=max(0.0001,length(delta));L=delta/distance;attenuation=localFalloff(distance,uLightRange5);if(uLightType5>1.5&&uLightType5<2.5)attenuation*=coneMask(dot(-L,uLightAxis5),uLightCone5);if(uLightType5>2.5)attenuation*=max(0.0,dot(-L,uLightAxis5))*0.25*rectangularBeam(uLightPosition5,uLightAxis5,uAreaU5,uAreaV5,uBeam5);}float d=dot(N,L),sh=shadowFor5(N,L);float vis=mix(1.0,sh,smoothstep(-0.15,0.2,d));lit+=uLightCol5*clamp((d+0.25)/1.25,0.0,1.0)*vis*(uLightInt5/100.0)*attenuation*0.85;}}
if(uLightInt6>0.0){for(int sampleIndex=0;sampleIndex<4;sampleIndex++){if(sampleIndex>0&&uLightType6<2.5)break;vec3 source=uLightPosition6;if(uLightType6>2.5)source+=uAreaU6*(sampleIndex==0||sampleIndex==2?-0.57735:0.57735)+uAreaV6*(sampleIndex<2?-0.57735:0.57735);vec3 L=normalize(uLightDir6);float attenuation=1.0;if(uLightType6>0.5){vec3 delta=source-vWorld;float distance=max(0.0001,length(delta));L=delta/distance;attenuation=localFalloff(distance,uLightRange6);if(uLightType6>1.5&&uLightType6<2.5)attenuation*=coneMask(dot(-L,uLightAxis6),uLightCone6);if(uLightType6>2.5)attenuation*=max(0.0,dot(-L,uLightAxis6))*0.25*rectangularBeam(uLightPosition6,uLightAxis6,uAreaU6,uAreaV6,uBeam6);}float d=dot(N,L),sh=shadowFor6(N,L);float vis=mix(1.0,sh,smoothstep(-0.15,0.2,d));lit+=uLightCol6*clamp((d+0.25)/1.25,0.0,1.0)*vis*(uLightInt6/100.0)*attenuation*0.85;}}
if(uLightInt7>0.0){for(int sampleIndex=0;sampleIndex<4;sampleIndex++){if(sampleIndex>0&&uLightType7<2.5)break;vec3 source=uLightPosition7;if(uLightType7>2.5)source+=uAreaU7*(sampleIndex==0||sampleIndex==2?-0.57735:0.57735)+uAreaV7*(sampleIndex<2?-0.57735:0.57735);vec3 L=normalize(uLightDir7);float attenuation=1.0;if(uLightType7>0.5){vec3 delta=source-vWorld;float distance=max(0.0001,length(delta));L=delta/distance;attenuation=localFalloff(distance,uLightRange7);if(uLightType7>1.5&&uLightType7<2.5)attenuation*=coneMask(dot(-L,uLightAxis7),uLightCone7);if(uLightType7>2.5)attenuation*=max(0.0,dot(-L,uLightAxis7))*0.25*rectangularBeam(uLightPosition7,uLightAxis7,uAreaU7,uAreaV7,uBeam7);}float d=dot(N,L),sh=shadowFor7(N,L);float vis=mix(1.0,sh,smoothstep(-0.15,0.2,d));lit+=uLightCol7*clamp((d+0.25)/1.25,0.0,1.0)*vis*(uLightInt7/100.0)*attenuation*0.85;}}
if(uLightInt8>0.0){for(int sampleIndex=0;sampleIndex<4;sampleIndex++){if(sampleIndex>0&&uLightType8<2.5)break;vec3 source=uLightPosition8;if(uLightType8>2.5)source+=uAreaU8*(sampleIndex==0||sampleIndex==2?-0.57735:0.57735)+uAreaV8*(sampleIndex<2?-0.57735:0.57735);vec3 L=normalize(uLightDir8);float attenuation=1.0;if(uLightType8>0.5){vec3 delta=source-vWorld;float distance=max(0.0001,length(delta));L=delta/distance;attenuation=localFalloff(distance,uLightRange8);if(uLightType8>1.5&&uLightType8<2.5)attenuation*=coneMask(dot(-L,uLightAxis8),uLightCone8);if(uLightType8>2.5)attenuation*=max(0.0,dot(-L,uLightAxis8))*0.25*rectangularBeam(uLightPosition8,uLightAxis8,uAreaU8,uAreaV8,uBeam8);}float d=dot(N,L),sh=shadowFor8(N,L);float vis=mix(1.0,sh,smoothstep(-0.15,0.2,d));lit+=uLightCol8*clamp((d+0.25)/1.25,0.0,1.0)*vis*(uLightInt8/100.0)*attenuation*0.85;}}
 vec3 worldPosition=(uInvView*vec4(vWorld.xy,-vWorld.z,1.0)).xyz;
 float distCenter=length(worldPosition.xz-uObjCenterXZ),aoRadius=0.72+uObjGap*1.45;
 float aoDarkness=mix(0.10,0.78,clamp(uObjGap/1.4,0.0,1.0));
 float contactAO=mix(aoDarkness,1.0,smoothstep(0.0,aoRadius,distCenter));
 vec3 caustic=vec3(0.0);if(uLightInt0>0.0)caustic+=glassCaustic(uLightDir0,uLightPosition0,uLightAxis0,uLightType0,uLightRange0,uLightCone0,uSpread,uLightCol0,uLightInt0/100.0,worldPosition);
if(uLightInt1>0.0)caustic+=glassCaustic(uLightDir1,uLightPosition1,uLightAxis1,uLightType1,uLightRange1,uLightCone1,uSpread1,uLightCol1,uLightInt1/100.0,worldPosition);
if(uLightInt2>0.0)caustic+=glassCaustic(uLightDir2,uLightPosition2,uLightAxis2,uLightType2,uLightRange2,uLightCone2,uSpread2,uLightCol2,uLightInt2/100.0,worldPosition);
if(uLightInt3>0.0)caustic+=glassCaustic(uLightDir3,uLightPosition3,uLightAxis3,uLightType3,uLightRange3,uLightCone3,uSpread3,uLightCol3,uLightInt3/100.0,worldPosition);
if(uLightInt4>0.0)caustic+=glassCaustic(uLightDir4,uLightPosition4,uLightAxis4,uLightType4,uLightRange4,uLightCone4,uSpread4,uLightCol4,uLightInt4/100.0,worldPosition);
if(uLightInt5>0.0)caustic+=glassCaustic(uLightDir5,uLightPosition5,uLightAxis5,uLightType5,uLightRange5,uLightCone5,uSpread5,uLightCol5,uLightInt5/100.0,worldPosition);
if(uLightInt6>0.0)caustic+=glassCaustic(uLightDir6,uLightPosition6,uLightAxis6,uLightType6,uLightRange6,uLightCone6,uSpread6,uLightCol6,uLightInt6/100.0,worldPosition);
if(uLightInt7>0.0)caustic+=glassCaustic(uLightDir7,uLightPosition7,uLightAxis7,uLightType7,uLightRange7,uLightCone7,uSpread7,uLightCol7,uLightInt7/100.0,worldPosition);
if(uLightInt8>0.0)caustic+=glassCaustic(uLightDir8,uLightPosition8,uLightAxis8,uLightType8,uLightRange8,uLightCone8,uSpread8,uLightCol8,uLightInt8/100.0,worldPosition);
 vec3 floorLit=acesToneMap(uFloorCol*(lit*contactAO+caustic));
 float distZ=max(0.0,length(worldPosition-uCameraWorld)-uCamDist),fog=smoothstep(4.0,52.0,distZ);
 gl_FragColor=vec4(clamp(mix(floorLit,uHorizonCol,fog),0.0,1.0),min(250.0/255.0,1.0-smoothstep(65.0,79.0,distZ)));
}