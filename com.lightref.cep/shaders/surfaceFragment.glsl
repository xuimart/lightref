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
uniform sampler2D uDepthMap;uniform float uHasDepthMap;uniform vec2 uResolution;
uniform vec3 uBaseCol;uniform vec3 uScatterCol;uniform float uSSS;uniform float uGloss;uniform float uMetallic;uniform float uSheen;
uniform float uSpecularStrength;uniform float uReflectionStrength;uniform samplerCube uEnvironmentSampler;uniform float uHasEnvironment;uniform float uEnvironmentIntensity;
uniform float uFloorEnabled;uniform float uFloorBounceInt;
uniform float uCel;uniform float uCelBands;uniform float uCelThreshold;uniform float uCelSoftness;uniform float uCelShadow;
uniform float uLineEnabled;uniform float uLineWidth;uniform float uLineDetail;uniform vec3 uLineColor;
uniform sampler2D uRefractionMap;uniform float uIOR;uniform float uThickness;uniform float uAbsorption;uniform float uDispersion;uniform vec3 uRefractionProjection;
uniform sampler2D uExitMap;uniform float uSolidRefraction;uniform float uGlassRange;uniform float uBackgroundDepth;uniform float uFloorY;uniform float uGlassEnvironment;
vec3 acesToneMap(vec3 x) {
  float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}
float computeSSAO(vec2 fragXY, float myDepth) {
  if (uHasDepthMap < 0.5) return 1.0;
  vec2 uv = fragXY / max(vec2(1.0), uResolution);
  float radius = 0.018;
  float occ = 0.0;
  float angle = fract(sin(dot(fragXY, vec2(12.9898, 78.233))) * 43758.5453) * 6.283185;
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    float a = angle + fi * 2.39996;
    float r = radius * (0.25 + 0.75 * ((fi + 0.5) / 8.0));
    vec2 suv = clamp(uv + vec2(cos(a), sin(a)) * r, 0.002, 0.998);
    vec4 ds = texture2D(uDepthMap, suv);
    float sampleD = ds.r + ds.g / 255.0;
    if (sampleD < 0.998) {
      float diff = myDepth - sampleD;
      if (diff > 0.0012 && diff < 0.018) {
        occ += smoothstep(0.018, 0.004, diff) * smoothstep(0.0012, 0.004, diff);
      }
    }
  }
  return clamp(1.0 - (occ / 8.0) * 1.35, 0.25, 1.0);
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
vec2 projectGlass(vec3 p){return p.xy*uRefractionProjection.xy/mix(max(.01,-p.z),1.0,uRefractionProjection.z)+.5;}
vec3 decodeGlassNormal(vec2 encoded){vec2 f=encoded*2.0-1.0;vec3 n=vec3(f,1.0-abs(f.x)-abs(f.y));if(n.z<0.0)n.xy=(1.0-abs(n.yx))*vec2(n.x>=0.0?1.0:-1.0,n.y>=0.0?1.0:-1.0);return normalize(vec3(n.xy,-n.z));}
float glassBackDepth(vec3 p){vec2 uv=projectGlass(p);if(any(lessThan(uv,vec2(.001)))||any(greaterThan(uv,vec2(.999))))return 10000.0;vec4 d=texture2D(uExitMap,uv);return (d.r+d.g/255.0)*30.0;}
bool exitGlass(vec3 inside,out vec3 exitPoint,out vec3 exitNormal){
 float previous=0.0,hit=0.0;bool found=false;
 for(int i=1;i<=20;i++){float t=uGlassRange*float(i)/20.0;vec3 p=vWorld+inside*t;float d=glassBackDepth(p);if(d<29.9&&-p.z>=d){hit=t;found=true;break;}previous=t;}
 if(!found)return false;
 for(int i=0;i<5;i++){float mid=(previous+hit)*.5;vec3 p=vWorld+inside*mid;if(-p.z>=glassBackDepth(p))hit=mid;else previous=mid;}
 exitPoint=vWorld+inside*hit;exitNormal=decodeGlassNormal(texture2D(uExitMap,clamp(projectGlass(exitPoint),vec2(.001),vec2(.999))).ba);return true;
}
vec2 outgoingGlassUV(vec3 exitPoint,vec3 outgoing){
 float distance=max(.01,(uBackgroundDepth+exitPoint.z)/max(.05,-outgoing.z));
 vec3 worldPoint=(uInvView*vec4(exitPoint.xy,-exitPoint.z,1.0)).xyz,worldRay=mat3(uInvView)*vec3(outgoing.xy,-outgoing.z);
 if(uFloorEnabled>.5&&worldRay.y<-.0001&&worldPoint.y>uFloorY)distance=min(distance,(uFloorY-worldPoint.y)/worldRay.y);
 vec2 uv=projectGlass(exitPoint+outgoing*distance),base=gl_FragCoord.xy/uResolution;return clamp(mix(base,uv,clamp(uThickness/.35,0.0,4.0)),vec2(.001),vec2(.999));
}
vec2 refractionUV(vec3 N,vec3 V,float ior){vec3 ray=refract(-V,N,1.0/max(1.0,ior));vec2 bend=ray.xy/max(.15,abs(ray.z))-(-V).xy/max(.15,abs(V.z));float depth=mix(max(.2,-vWorld.z),1.0,uRefractionProjection.z);return clamp(gl_FragCoord.xy/uResolution+bend*uThickness*uRefractionProjection.xy/depth,vec2(.001),vec2(.999));}
vec4 refractedBackground(vec3 N,vec3 V,out float opticalPath){
 opticalPath=uThickness;vec3 outgoing=vec3(0.0),exitPoint,exitNormal;float internalReflection=0.0;
 vec2 uv=refractionUV(N,V,uIOR),uvR=refractionUV(N,V,uIOR+uDispersion*.08),uvB=refractionUV(N,V,max(1.0,uIOR-uDispersion*.08));vec3 inside=refract(-V,N,1.0/uIOR);
 if(uSolidRefraction>.5&&exitGlass(inside,exitPoint,exitNormal)){opticalPath=length(exitPoint-vWorld)*(uThickness/.35);outgoing=refract(inside,-exitNormal,uIOR);if(length(outgoing)>.001){uv=outgoingGlassUV(exitPoint,outgoing);uvR=outgoingGlassUV(exitPoint,refract(refract(-V,N,1.0/(uIOR+uDispersion*.08)),-exitNormal,uIOR+uDispersion*.08));uvB=outgoingGlassUV(exitPoint,refract(refract(-V,N,1.0/max(1.0,uIOR-uDispersion*.08)),-exitNormal,max(1.0,uIOR-uDispersion*.08)));}else{internalReflection=1.0;outgoing=reflect(inside,-exitNormal);opticalPath*=2.0;}}
 float blur=pow(max(0.0,1.0-uGloss),1.5)*.018;vec4 color=texture2D(uRefractionMap,uv)*.5;for(int i=0;i<4;i++){vec2 offset=vec2(i<2?-1.0:1.0,i==0||i==2?-1.0:1.0)*blur;color+=texture2D(uRefractionMap,clamp(uv+offset,vec2(.001),vec2(.999)))*.125;}if(uDispersion>.001){color.r=texture2D(uRefractionMap,uvR).r;color.b=texture2D(uRefractionMap,uvB).b;}
 if(length(outgoing)>.001){vec3 ray=normalize(mat3(uInvView)*vec3(outgoing.xy,-outgoing.z));if(uGlassEnvironment>.5&&(uFloorEnabled<.5||ray.y>=0.0))color=vec4(textureCube(uEnvironmentSampler,ray,pow(1.0-uGloss,1.35)*6.0).rgb*uEnvironmentIntensity,1.0);if(internalReflection>.5){vec3 internalColor=uHasEnvironment>.5?textureCube(uEnvironmentSampler,ray).rgb*uEnvironmentIntensity:mix(uFloorCol*uAmbientCol,uHorizonCol,smoothstep(-.1,.5,ray.y));color.rgb=internalColor;color.a=max(color.a,uGlassEnvironment);}}
 return color;
}
float celBand(float value){float levels=max(1.0,uCelBands-1.0),scaled=clamp(value,0.0,1.0)*levels,soft=max(.0001,uCelSoftness*levels);return (floor(scaled)+smoothstep(.5-soft,.5+soft,fract(scaled)))/levels;}
vec3 lineNormal(vec2 encoded){vec2 f=encoded*2.0-1.0;vec3 n=vec3(f,1.0-abs(f.x)-abs(f.y));if(n.z<0.0)n.xy=(1.0-abs(n.yx))*vec2(n.x>=0.0?1.0:-1.0,n.y>=0.0?1.0:-1.0);return normalize(n);}
float lineArt(){
 if(uLineEnabled<.5||uHasDepthMap<.5)return 0.0;
 vec2 uv=gl_FragCoord.xy/uResolution,stepUV=vec2(uLineWidth)/uResolution;vec4 center=texture2D(uDepthMap,uv);float depth=center.r+center.g/255.0;vec3 normal=lineNormal(center.ba);float edge=0.0,threshold=mix(.65,.055,uLineDetail);
 for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++){if(x==0&&y==0)continue;vec4 sampleValue=texture2D(uDepthMap,uv+vec2(float(x),float(y))*stepUV);float neighbor=sampleValue.r+sampleValue.g/255.0;
  float depthEdge=smoothstep(max(.0015,depth*.015),max(.003,depth*.03),abs(neighbor-depth));float normalEdge=smoothstep(threshold,threshold+.08,1.0-dot(normal,lineNormal(sampleValue.ba)));edge=max(edge,max(depthEdge,normalEdge));}
 return edge;
}
// Every active slot uses this complete model; names and list order have no role.
void accumulateLight(vec3 L,vec3 C,float power,float spread,float castShadow,float pointHighlight,vec3 N,vec3 V,float NdotV,
 inout vec3 diffuseDirect,inout vec3 specularDirect,inout vec3 reflectionDisks,inout vec3 sheenLight,inout vec3 floorIllum){
 float ndotl=dot(N,L),vis=mix(1.0,castShadow,smoothstep(-0.15,0.20,ndotl));
 float wrap=max(0.05,spread*0.55);
 float diff=smoothstep(0.0,1.0,clamp((ndotl+wrap)/(1.0+wrap),0.0,1.0))*vis;
 // Quantize only the illuminated hemisphere. Shadow visibility must reach zero.
 if(uCel>.5)diff=ndotl>0.0?celBand(clamp(ndotl+.5-uCelThreshold,0.0,1.0)*castShadow):0.0;
 vec3 lightColor=uBaseCol*C*diff;
 if(uSSS>0.001){
  vec3 baseNorm=uBaseCol/max(0.08,max(uBaseCol.r,max(uBaseCol.g,uBaseCol.b)));
  vec3 scatterTint=max(uBaseCol*vec3(1.15,0.60,0.35),vec3(0.12,0.03,0.01))*mix(max(uScatterCol,vec3(0.02)),baseNorm,0.32);
  vec3 w=max(vec3(wrap),vec3(0.52,0.24,0.08));
  vec3 sssDiff=smoothstep(vec3(0.0),vec3(1.0),clamp((vec3(ndotl)+w)/(vec3(1.0)+w),0.0,1.0))*mix(0.35,1.0,vis);
  lightColor=mix(lightColor,uBaseCol*C*sssDiff,0.22*uSSS);
  lightColor+=scatterTint*C*max(vec3(0.0),sssDiff-vec3(diff))*0.95*uSSS;
  float thinEdge=pow(max(0.0001,1.0-NdotV),2.2);
  float edge=smoothstep(-0.75,0.15,ndotl)*(1.0-smoothstep(0.15,0.65,ndotl))*thinEdge;
  float transmission=pow(max(0.0001,clamp(dot(V,-normalize(L+N*0.45)),0.0,1.0)),2.5)*(0.25+0.75*thinEdge);
  lightColor+=scatterTint*C*(edge*0.65+transmission*0.85)*uSSS;
 }
 diffuseDirect+=lightColor*power;
 float directVisibility=uCel>.5?(ndotl>0.0?castShadow:0.0):vis;
 vec3 halfSum=L+V,H=halfSum/max(0.00001,length(halfSum));
 float spec=pow(max(0.0001,dot(N,H)),10.0+uGloss*160.0)*uGloss*directVisibility*(1.0-uMetallic*0.55);
 specularDirect+=C*spec*power*1.45*uSpecularStrength*pointHighlight;
 vec3 Rview=normalize(reflect(-V,N));float diskPow=8.0+pow(uGloss,2.2)*320.0;
 float disk=pow(max(0.0,dot(Rview,L)),diskPow)*(0.25+1.8*uGloss)*directVisibility;
 reflectionDisks+=C*disk*power*uSpecularStrength*pointHighlight;
 sheenLight+=C*(0.25+0.75*diff)*power;
 vec3 Lworld=normalize(mat3(uInvView)*vec3(L.xy,-L.z));
 floorIllum+=C*max(0.0,Lworld.y)*power*0.85;
}
float rectangularReflection(vec3 source,vec3 axis,vec3 U,vec3 W,vec3 N,vec3 V){
 vec3 R=normalize(reflect(-V,N));float denominator=dot(R,axis);if(abs(denominator)<.00001)return 0.0;
 float t=dot(source-vWorld,axis)/denominator;if(t<=0.0||dot(normalize(vWorld-source),axis)<=0.0)return 0.0;
 vec3 hit=vWorld+R*t-source;float width=max(.001,length(U)),height=max(.001,length(W));float blur=.005+pow(1.0-uGloss,1.35)*t*.25;
 return (1.0-smoothstep(width-blur,width+blur,abs(dot(hit,U/width))))*(1.0-smoothstep(height-blur,height+blur,abs(dot(hit,W/height))));
}
void main(){
 if(uFloorEnabled>.5&&(uInvView*vec4(vWorld.xy,-vWorld.z,1.0)).y<uFloorY-.002)discard;
 vec3 N=normalize(vNorm),V=normalize(-vWorld),Nworld=normalize(mat3(uInvView)*vec3(N.xy,-N.z));
 float NdotV=max(0.0,dot(N,V));
 vec3 diffuseDirect=vec3(0.0),specularDirect=vec3(0.0),reflectionDisks=vec3(0.0),sheenLight=vec3(0.0),floorIllum=vec3(0.0);
 if(uLightInt0>0.0){for(int sampleIndex=0;sampleIndex<4;sampleIndex++){if(sampleIndex>0&&uLightType0<2.5)break;vec3 source=uLightPosition0;if(uLightType0>2.5)source+=uAreaU0*(sampleIndex==0||sampleIndex==2?-0.57735:0.57735)+uAreaV0*(sampleIndex<2?-0.57735:0.57735);vec3 L=normalize(uLightDir0);float attenuation=1.0;if(uLightType0>0.5){vec3 delta=source-vWorld;float distance=max(0.0001,length(delta));L=delta/distance;attenuation=localFalloff(distance,uLightRange0);if(uLightType0>1.5&&uLightType0<2.5)attenuation*=coneMask(dot(-L,uLightAxis0),uLightCone0);if(uLightType0>2.5)attenuation*=max(0.0,dot(-L,uLightAxis0))*0.25*rectangularBeam(uLightPosition0,uLightAxis0,uAreaU0,uAreaV0,uBeam0);}float sh=shadowFor0(N,L);accumulateLight(L,uLightCol0,uLightInt0/100.0*attenuation,uSpread,sh,uLightType0>2.5?0.0:1.0,N,V,NdotV,diffuseDirect,specularDirect,reflectionDisks,sheenLight,floorIllum);}if(uLightType0>2.5){float panel=rectangularReflection(uLightPosition0,uLightAxis0,uAreaU0,uAreaV0,N,V);vec3 centerL=normalize(uLightPosition0-vWorld);float strength=rectangularBeam(uLightPosition0,uLightAxis0,uAreaU0,uAreaV0,uBeam0)*(uLightInt0/100.0)*localFalloff(length(uLightPosition0-vWorld),uLightRange0)*shadowFor0(N,centerL)*uSpecularStrength;reflectionDisks+=uLightCol0*panel*strength*(0.25+1.8*uGloss);specularDirect+=uLightCol0*panel*strength*uGloss*0.35;}}
if(uLightInt1>0.0){for(int sampleIndex=0;sampleIndex<4;sampleIndex++){if(sampleIndex>0&&uLightType1<2.5)break;vec3 source=uLightPosition1;if(uLightType1>2.5)source+=uAreaU1*(sampleIndex==0||sampleIndex==2?-0.57735:0.57735)+uAreaV1*(sampleIndex<2?-0.57735:0.57735);vec3 L=normalize(uLightDir1);float attenuation=1.0;if(uLightType1>0.5){vec3 delta=source-vWorld;float distance=max(0.0001,length(delta));L=delta/distance;attenuation=localFalloff(distance,uLightRange1);if(uLightType1>1.5&&uLightType1<2.5)attenuation*=coneMask(dot(-L,uLightAxis1),uLightCone1);if(uLightType1>2.5)attenuation*=max(0.0,dot(-L,uLightAxis1))*0.25*rectangularBeam(uLightPosition1,uLightAxis1,uAreaU1,uAreaV1,uBeam1);}float sh=shadowFor1(N,L);accumulateLight(L,uLightCol1,uLightInt1/100.0*attenuation,uSpread1,sh,uLightType1>2.5?0.0:1.0,N,V,NdotV,diffuseDirect,specularDirect,reflectionDisks,sheenLight,floorIllum);}if(uLightType1>2.5){float panel=rectangularReflection(uLightPosition1,uLightAxis1,uAreaU1,uAreaV1,N,V);vec3 centerL=normalize(uLightPosition1-vWorld);float strength=rectangularBeam(uLightPosition1,uLightAxis1,uAreaU1,uAreaV1,uBeam1)*(uLightInt1/100.0)*localFalloff(length(uLightPosition1-vWorld),uLightRange1)*shadowFor1(N,centerL)*uSpecularStrength;reflectionDisks+=uLightCol1*panel*strength*(0.25+1.8*uGloss);specularDirect+=uLightCol1*panel*strength*uGloss*0.35;}}
if(uLightInt2>0.0){for(int sampleIndex=0;sampleIndex<4;sampleIndex++){if(sampleIndex>0&&uLightType2<2.5)break;vec3 source=uLightPosition2;if(uLightType2>2.5)source+=uAreaU2*(sampleIndex==0||sampleIndex==2?-0.57735:0.57735)+uAreaV2*(sampleIndex<2?-0.57735:0.57735);vec3 L=normalize(uLightDir2);float attenuation=1.0;if(uLightType2>0.5){vec3 delta=source-vWorld;float distance=max(0.0001,length(delta));L=delta/distance;attenuation=localFalloff(distance,uLightRange2);if(uLightType2>1.5&&uLightType2<2.5)attenuation*=coneMask(dot(-L,uLightAxis2),uLightCone2);if(uLightType2>2.5)attenuation*=max(0.0,dot(-L,uLightAxis2))*0.25*rectangularBeam(uLightPosition2,uLightAxis2,uAreaU2,uAreaV2,uBeam2);}float sh=shadowFor2(N,L);accumulateLight(L,uLightCol2,uLightInt2/100.0*attenuation,uSpread2,sh,uLightType2>2.5?0.0:1.0,N,V,NdotV,diffuseDirect,specularDirect,reflectionDisks,sheenLight,floorIllum);}if(uLightType2>2.5){float panel=rectangularReflection(uLightPosition2,uLightAxis2,uAreaU2,uAreaV2,N,V);vec3 centerL=normalize(uLightPosition2-vWorld);float strength=rectangularBeam(uLightPosition2,uLightAxis2,uAreaU2,uAreaV2,uBeam2)*(uLightInt2/100.0)*localFalloff(length(uLightPosition2-vWorld),uLightRange2)*shadowFor2(N,centerL)*uSpecularStrength;reflectionDisks+=uLightCol2*panel*strength*(0.25+1.8*uGloss);specularDirect+=uLightCol2*panel*strength*uGloss*0.35;}}
if(uLightInt3>0.0){for(int sampleIndex=0;sampleIndex<4;sampleIndex++){if(sampleIndex>0&&uLightType3<2.5)break;vec3 source=uLightPosition3;if(uLightType3>2.5)source+=uAreaU3*(sampleIndex==0||sampleIndex==2?-0.57735:0.57735)+uAreaV3*(sampleIndex<2?-0.57735:0.57735);vec3 L=normalize(uLightDir3);float attenuation=1.0;if(uLightType3>0.5){vec3 delta=source-vWorld;float distance=max(0.0001,length(delta));L=delta/distance;attenuation=localFalloff(distance,uLightRange3);if(uLightType3>1.5&&uLightType3<2.5)attenuation*=coneMask(dot(-L,uLightAxis3),uLightCone3);if(uLightType3>2.5)attenuation*=max(0.0,dot(-L,uLightAxis3))*0.25*rectangularBeam(uLightPosition3,uLightAxis3,uAreaU3,uAreaV3,uBeam3);}float sh=shadowFor3(N,L);accumulateLight(L,uLightCol3,uLightInt3/100.0*attenuation,uSpread3,sh,uLightType3>2.5?0.0:1.0,N,V,NdotV,diffuseDirect,specularDirect,reflectionDisks,sheenLight,floorIllum);}if(uLightType3>2.5){float panel=rectangularReflection(uLightPosition3,uLightAxis3,uAreaU3,uAreaV3,N,V);vec3 centerL=normalize(uLightPosition3-vWorld);float strength=rectangularBeam(uLightPosition3,uLightAxis3,uAreaU3,uAreaV3,uBeam3)*(uLightInt3/100.0)*localFalloff(length(uLightPosition3-vWorld),uLightRange3)*shadowFor3(N,centerL)*uSpecularStrength;reflectionDisks+=uLightCol3*panel*strength*(0.25+1.8*uGloss);specularDirect+=uLightCol3*panel*strength*uGloss*0.35;}}
if(uLightInt4>0.0){for(int sampleIndex=0;sampleIndex<4;sampleIndex++){if(sampleIndex>0&&uLightType4<2.5)break;vec3 source=uLightPosition4;if(uLightType4>2.5)source+=uAreaU4*(sampleIndex==0||sampleIndex==2?-0.57735:0.57735)+uAreaV4*(sampleIndex<2?-0.57735:0.57735);vec3 L=normalize(uLightDir4);float attenuation=1.0;if(uLightType4>0.5){vec3 delta=source-vWorld;float distance=max(0.0001,length(delta));L=delta/distance;attenuation=localFalloff(distance,uLightRange4);if(uLightType4>1.5&&uLightType4<2.5)attenuation*=coneMask(dot(-L,uLightAxis4),uLightCone4);if(uLightType4>2.5)attenuation*=max(0.0,dot(-L,uLightAxis4))*0.25*rectangularBeam(uLightPosition4,uLightAxis4,uAreaU4,uAreaV4,uBeam4);}float sh=shadowFor4(N,L);accumulateLight(L,uLightCol4,uLightInt4/100.0*attenuation,uSpread4,sh,uLightType4>2.5?0.0:1.0,N,V,NdotV,diffuseDirect,specularDirect,reflectionDisks,sheenLight,floorIllum);}if(uLightType4>2.5){float panel=rectangularReflection(uLightPosition4,uLightAxis4,uAreaU4,uAreaV4,N,V);vec3 centerL=normalize(uLightPosition4-vWorld);float strength=rectangularBeam(uLightPosition4,uLightAxis4,uAreaU4,uAreaV4,uBeam4)*(uLightInt4/100.0)*localFalloff(length(uLightPosition4-vWorld),uLightRange4)*shadowFor4(N,centerL)*uSpecularStrength;reflectionDisks+=uLightCol4*panel*strength*(0.25+1.8*uGloss);specularDirect+=uLightCol4*panel*strength*uGloss*0.35;}}
if(uLightInt5>0.0){for(int sampleIndex=0;sampleIndex<4;sampleIndex++){if(sampleIndex>0&&uLightType5<2.5)break;vec3 source=uLightPosition5;if(uLightType5>2.5)source+=uAreaU5*(sampleIndex==0||sampleIndex==2?-0.57735:0.57735)+uAreaV5*(sampleIndex<2?-0.57735:0.57735);vec3 L=normalize(uLightDir5);float attenuation=1.0;if(uLightType5>0.5){vec3 delta=source-vWorld;float distance=max(0.0001,length(delta));L=delta/distance;attenuation=localFalloff(distance,uLightRange5);if(uLightType5>1.5&&uLightType5<2.5)attenuation*=coneMask(dot(-L,uLightAxis5),uLightCone5);if(uLightType5>2.5)attenuation*=max(0.0,dot(-L,uLightAxis5))*0.25*rectangularBeam(uLightPosition5,uLightAxis5,uAreaU5,uAreaV5,uBeam5);}float sh=shadowFor5(N,L);accumulateLight(L,uLightCol5,uLightInt5/100.0*attenuation,uSpread5,sh,uLightType5>2.5?0.0:1.0,N,V,NdotV,diffuseDirect,specularDirect,reflectionDisks,sheenLight,floorIllum);}if(uLightType5>2.5){float panel=rectangularReflection(uLightPosition5,uLightAxis5,uAreaU5,uAreaV5,N,V);vec3 centerL=normalize(uLightPosition5-vWorld);float strength=rectangularBeam(uLightPosition5,uLightAxis5,uAreaU5,uAreaV5,uBeam5)*(uLightInt5/100.0)*localFalloff(length(uLightPosition5-vWorld),uLightRange5)*shadowFor5(N,centerL)*uSpecularStrength;reflectionDisks+=uLightCol5*panel*strength*(0.25+1.8*uGloss);specularDirect+=uLightCol5*panel*strength*uGloss*0.35;}}
if(uLightInt6>0.0){for(int sampleIndex=0;sampleIndex<4;sampleIndex++){if(sampleIndex>0&&uLightType6<2.5)break;vec3 source=uLightPosition6;if(uLightType6>2.5)source+=uAreaU6*(sampleIndex==0||sampleIndex==2?-0.57735:0.57735)+uAreaV6*(sampleIndex<2?-0.57735:0.57735);vec3 L=normalize(uLightDir6);float attenuation=1.0;if(uLightType6>0.5){vec3 delta=source-vWorld;float distance=max(0.0001,length(delta));L=delta/distance;attenuation=localFalloff(distance,uLightRange6);if(uLightType6>1.5&&uLightType6<2.5)attenuation*=coneMask(dot(-L,uLightAxis6),uLightCone6);if(uLightType6>2.5)attenuation*=max(0.0,dot(-L,uLightAxis6))*0.25*rectangularBeam(uLightPosition6,uLightAxis6,uAreaU6,uAreaV6,uBeam6);}float sh=shadowFor6(N,L);accumulateLight(L,uLightCol6,uLightInt6/100.0*attenuation,uSpread6,sh,uLightType6>2.5?0.0:1.0,N,V,NdotV,diffuseDirect,specularDirect,reflectionDisks,sheenLight,floorIllum);}if(uLightType6>2.5){float panel=rectangularReflection(uLightPosition6,uLightAxis6,uAreaU6,uAreaV6,N,V);vec3 centerL=normalize(uLightPosition6-vWorld);float strength=rectangularBeam(uLightPosition6,uLightAxis6,uAreaU6,uAreaV6,uBeam6)*(uLightInt6/100.0)*localFalloff(length(uLightPosition6-vWorld),uLightRange6)*shadowFor6(N,centerL)*uSpecularStrength;reflectionDisks+=uLightCol6*panel*strength*(0.25+1.8*uGloss);specularDirect+=uLightCol6*panel*strength*uGloss*0.35;}}
if(uLightInt7>0.0){for(int sampleIndex=0;sampleIndex<4;sampleIndex++){if(sampleIndex>0&&uLightType7<2.5)break;vec3 source=uLightPosition7;if(uLightType7>2.5)source+=uAreaU7*(sampleIndex==0||sampleIndex==2?-0.57735:0.57735)+uAreaV7*(sampleIndex<2?-0.57735:0.57735);vec3 L=normalize(uLightDir7);float attenuation=1.0;if(uLightType7>0.5){vec3 delta=source-vWorld;float distance=max(0.0001,length(delta));L=delta/distance;attenuation=localFalloff(distance,uLightRange7);if(uLightType7>1.5&&uLightType7<2.5)attenuation*=coneMask(dot(-L,uLightAxis7),uLightCone7);if(uLightType7>2.5)attenuation*=max(0.0,dot(-L,uLightAxis7))*0.25*rectangularBeam(uLightPosition7,uLightAxis7,uAreaU7,uAreaV7,uBeam7);}float sh=shadowFor7(N,L);accumulateLight(L,uLightCol7,uLightInt7/100.0*attenuation,uSpread7,sh,uLightType7>2.5?0.0:1.0,N,V,NdotV,diffuseDirect,specularDirect,reflectionDisks,sheenLight,floorIllum);}if(uLightType7>2.5){float panel=rectangularReflection(uLightPosition7,uLightAxis7,uAreaU7,uAreaV7,N,V);vec3 centerL=normalize(uLightPosition7-vWorld);float strength=rectangularBeam(uLightPosition7,uLightAxis7,uAreaU7,uAreaV7,uBeam7)*(uLightInt7/100.0)*localFalloff(length(uLightPosition7-vWorld),uLightRange7)*shadowFor7(N,centerL)*uSpecularStrength;reflectionDisks+=uLightCol7*panel*strength*(0.25+1.8*uGloss);specularDirect+=uLightCol7*panel*strength*uGloss*0.35;}}
if(uLightInt8>0.0){for(int sampleIndex=0;sampleIndex<4;sampleIndex++){if(sampleIndex>0&&uLightType8<2.5)break;vec3 source=uLightPosition8;if(uLightType8>2.5)source+=uAreaU8*(sampleIndex==0||sampleIndex==2?-0.57735:0.57735)+uAreaV8*(sampleIndex<2?-0.57735:0.57735);vec3 L=normalize(uLightDir8);float attenuation=1.0;if(uLightType8>0.5){vec3 delta=source-vWorld;float distance=max(0.0001,length(delta));L=delta/distance;attenuation=localFalloff(distance,uLightRange8);if(uLightType8>1.5&&uLightType8<2.5)attenuation*=coneMask(dot(-L,uLightAxis8),uLightCone8);if(uLightType8>2.5)attenuation*=max(0.0,dot(-L,uLightAxis8))*0.25*rectangularBeam(uLightPosition8,uLightAxis8,uAreaU8,uAreaV8,uBeam8);}float sh=shadowFor8(N,L);accumulateLight(L,uLightCol8,uLightInt8/100.0*attenuation,uSpread8,sh,uLightType8>2.5?0.0:1.0,N,V,NdotV,diffuseDirect,specularDirect,reflectionDisks,sheenLight,floorIllum);}if(uLightType8>2.5){float panel=rectangularReflection(uLightPosition8,uLightAxis8,uAreaU8,uAreaV8,N,V);vec3 centerL=normalize(uLightPosition8-vWorld);float strength=rectangularBeam(uLightPosition8,uLightAxis8,uAreaU8,uAreaV8,uBeam8)*(uLightInt8/100.0)*localFalloff(length(uLightPosition8-vWorld),uLightRange8)*shadowFor8(N,centerL)*uSpecularStrength;reflectionDisks+=uLightCol8*panel*strength*(0.25+1.8*uGloss);specularDirect+=uLightCol8*panel*strength*uGloss*0.35;}}
 float ssao=computeSSAO(gl_FragCoord.xy,clamp(-vWorld.z/30.0,0.0,0.9999));
 float hemi=max(0.35,Nworld.y*0.3+0.7),ao=clamp(N.z*0.35+0.65,0.45,1.0)*ssao;
 vec3 ambientColor=uBaseCol*uAmbientCol*(hemi*ao*0.65);
 float floorFacing=pow(max(0.0001,clamp((-Nworld.y+0.25)/1.25,0.0,1.0)),1.3);
 float floorBounceAo=clamp(N.z*0.35+0.65,0.4,1.0)*ssao,gapAtten=1.0/(1.0+uObjGap*0.45);
 vec3 floorBounceCol=mix(uBaseCol*uFloorCol,uFloorCol,0.22)*(uAmbientCol*0.40+floorIllum)*(floorFacing*floorBounceAo*gapAtten*(uFloorBounceInt/100.0)*0.85*uFloorEnabled);
 float roughness=pow(max(0.0,1.0-uGloss),1.35),envVis=clamp(uGloss+uMetallic,0.0,1.0);
 vec3 F0=mix(vec3(0.04),uBaseCol,uMetallic),F=F0+(vec3(1.0)-F0)*pow(max(0.0001,1.0-NdotV),5.0);
 vec3 kD=max(vec3(0.0),(vec3(1.0)-F*envVis)*(1.0-uMetallic));
 vec3 Rview=normalize(reflect(-V,N)),R=normalize(mat3(uInvView)*vec3(Rview.xy,-Rview.z));
 float skyMask=smoothstep(-0.015-roughness*0.45,0.015+roughness*0.45,R.y);
 float horGlow=exp(-abs(R.y)/(0.035+roughness*0.25))*0.26*(1.0-roughness*0.7);
 float cloud=0.88+0.12*smoothstep(-0.4,0.8,sin(R.x*3.1+R.z*2.2));
 vec3 skyRefl=mix(uHorizonCol,uAmbientCol*cloud,smoothstep(0.0,0.55,max(0.0,R.y)));
 float grdOcc=0.35+0.65*smoothstep(0.0,0.55,length(R.xz));
 vec3 grdRefl=mix(uAmbientCol*0.55*grdOcc,uFloorCol*(uAmbientCol*0.45+floorIllum)*grdOcc,uFloorEnabled);
 vec3 envCol=mix(grdRefl,skyRefl,skyMask)+uHorizonCol*horGlow;
 if(uHasEnvironment>0.5)envCol=mix(envCol,textureCube(uEnvironmentSampler,R,roughness*6.0).rgb*uEnvironmentIntensity,0.85);
 vec3 envRefl=F*(envCol+reflectionDisks)*envVis*mix(0.55,1.0,ssao)*uReflectionStrength;
 float sheenFactor=pow(max(0.0001,1.0-NdotV),3.0)*uSheen*0.95;
 vec3 sheenCol=mix(uBaseCol,vec3(1.0),0.35)*(uAmbientCol*0.35+sheenLight)*sheenFactor;
 vec3 finalColor=acesToneMap(kD*(ambientColor+diffuseDirect+floorBounceCol)+envRefl+specularDirect+sheenCol);
 if(uCel>.5){finalColor=acesToneMap(kD*(ambientColor+diffuseDirect+floorBounceCol+uBaseCol*uCelShadow*.4)+envRefl+specularDirect+sheenCol);finalColor=mix(finalColor,uLineColor,lineArt());}
 float outputAlpha=1.0;
 if(uTransparency>.001){
  vec3 glassV=mix(V,vec3(0.0,0.0,1.0),uRefractionProjection.z);float glassNdotV=max(0.0,dot(N,glassV)),opticalPath;vec4 behind=refractedBackground(N,glassV,opticalPath);float r0=pow((uIOR-1.0)/(uIOR+1.0),2.0),fresnel=r0+(1.0-r0)*pow(1.0-glassNdotV,5.0);
  vec3 tint=pow(max(uBaseCol,vec3(.005)),vec3(uAbsorption*opticalPath));float absorbed=1.0-dot(tint,vec3(.2126,.7152,.0722));
  float reflectAlpha=clamp(fresnel*max(.1,uReflectionStrength)+max(specularDirect.r,max(specularDirect.g,specularDirect.b))*.12,0.0,.98);
  float glassAlpha=reflectAlpha+(1.0-reflectAlpha)*(behind.a+(1.0-behind.a)*absorbed);
  float windowLuminance=max(envCol.r,max(envCol.g,envCol.b));vec3 glassRadiance=envCol*(1.0+uHasEnvironment*18.0*pow(clamp(windowLuminance,0.0,1.0),6.0));
  vec3 reflectionColor=acesToneMap((glassRadiance+reflectionDisks*4.0)*fresnel*uReflectionStrength+specularDirect*2.5+sheenCol);
  vec3 glassPremul=behind.rgb*tint*(1.0-reflectAlpha)*behind.a+reflectionColor+uBaseCol*absorbed*(1.0-reflectAlpha)*(1.0-behind.a);
  outputAlpha=mix(1.0,glassAlpha,uTransparency);finalColor=(finalColor*(1.0-uTransparency)+glassPremul*uTransparency)/max(.001,outputAlpha);
 }
 gl_FragColor=vec4(clamp(finalColor,0.0,1.0),outputAlpha);
}