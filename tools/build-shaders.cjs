const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'../com.lightref.cep'),reference=path.resolve(__dirname,'shader-sources');
const read=n=>fs.readFileSync(path.join(reference,n),'utf8');
const tone=read('tone.glsl').trim(),ssao=read('ssao.glsl').trim();
const surfaceVertex=`precision highp float;
attribute vec3 position;attribute vec3 normal;
uniform mat4 world;uniform mat4 worldViewProjection;uniform mat4 view;uniform mat4 normalMatrix;
varying vec3 vNorm;varying vec3 vWorld;
void main(){vec4 p=view*world*vec4(position,1.0);vec3 n=mat3(view)*mat3(normalMatrix)*normal;vWorld=vec3(p.xy,-p.z);vNorm=vec3(n.xy,-n.z);gl_Position=worldViewProjection*vec4(position,1.0);}`;
const depthVertex=`precision highp float;attribute vec3 position;attribute vec3 normal;uniform mat4 worldViewProjection;uniform mat4 world;uniform mat4 view;uniform mat4 normalMatrix;varying float vLinDepth;varying vec3 vViewNormal;void main(){vLinDepth=(view*world*vec4(position,1.0)).z/30.0;vViewNormal=mat3(view)*mat3(normalMatrix)*normal;gl_Position=worldViewProjection*vec4(position,1.0);}`;
const depthFragment=read('depth.frag');
const precision=`#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec3 vNorm;varying vec3 vWorld;
uniform mat4 uInvView;uniform vec3 uAmbientCol;uniform vec3 uHorizonCol;uniform vec3 uFloorCol;uniform float uObjGap;
uniform float uShadowFilter;uniform float uTransparency;
`;
const uniforms=[],calls=[],floorCalls=[],causticCalls=[],shadowSlots=[];
for(let i=0;i<9;i++){
 const sm=i?'uShadow'+i:'uShadowMap',vp=i?'uLightVP'+i:'uLightVP',has=i?'uHasShadow'+i:'uHasShadowMap',spread=i?'uSpread'+i:'uSpread';
 causticCalls.push(`if(uLightInt${i}>0.0)caustic+=glassCaustic(uLightDir${i},uLightPosition${i},uLightAxis${i},uLightType${i},uLightRange${i},uLightCone${i},${spread},uLightCol${i},uLightInt${i}/100.0,worldPosition);`);
 uniforms.push(`uniform sampler2D ${sm};uniform mat4 ${vp};uniform float ${has};uniform float ${spread};uniform vec3 uLightDir${i};uniform vec3 uLightCol${i};uniform float uLightInt${i};`);
 uniforms.push(`uniform vec3 uLightPosition${i};uniform vec3 uLightAxis${i};uniform vec3 uAreaU${i};uniform vec3 uAreaV${i};uniform float uLightType${i};uniform float uLightRange${i};uniform vec2 uLightCone${i};uniform vec2 uShadowDepth${i};uniform float uShadowPacked${i};uniform vec4 uBeam${i};`);
 shadowSlots.push(`float shadowFor${i}(vec3 N,vec3 L){return artShadow(${sm},${vp},${has},vWorld,dot(N,L),${spread});}`);
 calls.push(`if(uLightInt${i}>0.0){for(int sampleIndex=0;sampleIndex<4;sampleIndex++){if(sampleIndex>0&&uLightType${i}<2.5)break;vec3 source=uLightPosition${i};if(uLightType${i}>2.5)source+=uAreaU${i}*(sampleIndex==0||sampleIndex==2?-0.57735:0.57735)+uAreaV${i}*(sampleIndex<2?-0.57735:0.57735);vec3 L=normalize(uLightDir${i});float attenuation=1.0;if(uLightType${i}>0.5){vec3 delta=source-vWorld;float distance=max(0.0001,length(delta));L=delta/distance;attenuation=localFalloff(distance,uLightRange${i});if(uLightType${i}>1.5&&uLightType${i}<2.5)attenuation*=coneMask(dot(-L,uLightAxis${i}),uLightCone${i});if(uLightType${i}>2.5)attenuation*=max(0.0,dot(-L,uLightAxis${i}))*0.25*rectangularBeam(uLightPosition${i},uLightAxis${i},uAreaU${i},uAreaV${i},uBeam${i});}float sh=shadowFor${i}(N,L);accumulateLight(L,uLightCol${i},uLightInt${i}/100.0*attenuation,${spread},sh,uLightType${i}>2.5?0.0:1.0,N,V,NdotV,diffuseDirect,specularDirect,reflectionDisks,sheenLight,floorIllum);}if(uLightType${i}>2.5){float panel=rectangularReflection(uLightPosition${i},uLightAxis${i},uAreaU${i},uAreaV${i},N,V);vec3 centerL=normalize(uLightPosition${i}-vWorld);float strength=rectangularBeam(uLightPosition${i},uLightAxis${i},uAreaU${i},uAreaV${i},uBeam${i})*(uLightInt${i}/100.0)*localFalloff(length(uLightPosition${i}-vWorld),uLightRange${i})*shadowFor${i}(N,centerL)*uSpecularStrength;reflectionDisks+=uLightCol${i}*panel*strength*(0.25+1.8*uGloss);specularDirect+=uLightCol${i}*panel*strength*uGloss*0.35;}}`);
 floorCalls.push(`if(uLightInt${i}>0.0){for(int sampleIndex=0;sampleIndex<4;sampleIndex++){if(sampleIndex>0&&uLightType${i}<2.5)break;vec3 source=uLightPosition${i};if(uLightType${i}>2.5)source+=uAreaU${i}*(sampleIndex==0||sampleIndex==2?-0.57735:0.57735)+uAreaV${i}*(sampleIndex<2?-0.57735:0.57735);vec3 L=normalize(uLightDir${i});float attenuation=1.0;if(uLightType${i}>0.5){vec3 delta=source-vWorld;float distance=max(0.0001,length(delta));L=delta/distance;attenuation=localFalloff(distance,uLightRange${i});if(uLightType${i}>1.5&&uLightType${i}<2.5)attenuation*=coneMask(dot(-L,uLightAxis${i}),uLightCone${i});if(uLightType${i}>2.5)attenuation*=max(0.0,dot(-L,uLightAxis${i}))*0.25*rectangularBeam(uLightPosition${i},uLightAxis${i},uAreaU${i},uAreaV${i},uBeam${i});}float d=dot(N,L),sh=shadowFor${i}(N,L);float vis=mix(1.0,sh,smoothstep(-0.15,0.2,d));lit+=uLightCol${i}*clamp((d+0.25)/1.25,0.0,1.0)*vis*(uLightInt${i}/100.0)*attenuation*0.85;}}`);
}
const shadow=`float compareShadow(sampler2D sm,vec2 uv,float depth){vec4 d=texture2D(sm,uv);return depth>d.r+d.g/255.0?0.0:1.0;}
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
`+shadowSlots.join('\n');
const surface=precision+uniforms.join('\n')+`
uniform sampler2D uDepthMap;uniform float uHasDepthMap;uniform vec2 uResolution;
uniform vec3 uBaseCol;uniform vec3 uScatterCol;uniform float uSSS;uniform float uGloss;uniform float uMetallic;uniform float uSheen;
uniform float uSpecularStrength;uniform float uReflectionStrength;uniform samplerCube uEnvironmentSampler;uniform float uHasEnvironment;uniform float uEnvironmentIntensity;
uniform float uFloorEnabled;uniform float uFloorBounceInt;
uniform float uCel;uniform float uCelBands;uniform float uCelThreshold;uniform float uCelSoftness;uniform float uCelShadow;
uniform float uLineEnabled;uniform float uLineWidth;uniform float uLineDetail;uniform vec3 uLineColor;
uniform sampler2D uRefractionMap;uniform float uIOR;uniform float uThickness;uniform float uAbsorption;uniform float uDispersion;uniform vec3 uRefractionProjection;
uniform sampler2D uExitMap;uniform float uSolidRefraction;uniform float uGlassRange;uniform float uBackgroundDepth;uniform float uFloorY;uniform float uGlassEnvironment;
`+tone+'\n'+ssao+'\n'+shadow+`
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
 ${calls.join('\n')}
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
}`;
const floor=precision+uniforms.join('\n')+`
uniform vec3 uCameraWorld;uniform float uFloorAmbient;uniform vec2 uObjCenterXZ;uniform float uCamDist;
uniform vec3 uGlassCenter;uniform float uGlassRadius;uniform float uIOR;uniform float uThickness;uniform float uAbsorption;uniform float uCaustics;uniform vec3 uBaseCol;
`+tone+'\n'+shadow+`
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
 ${floorCalls.join('\n')}
 vec3 worldPosition=(uInvView*vec4(vWorld.xy,-vWorld.z,1.0)).xyz;
 float distCenter=length(worldPosition.xz-uObjCenterXZ),aoRadius=0.72+uObjGap*1.45;
 float aoDarkness=mix(0.10,0.78,clamp(uObjGap/1.4,0.0,1.0));
 float contactAO=mix(aoDarkness,1.0,smoothstep(0.0,aoRadius,distCenter));
 vec3 caustic=vec3(0.0);${causticCalls.join('\n')}
 vec3 floorLit=acesToneMap(uFloorCol*(lit*contactAO+caustic));
 float distZ=max(0.0,length(worldPosition-uCameraWorld)-uCamDist),fog=smoothstep(4.0,52.0,distZ);
 gl_FragColor=vec4(clamp(mix(floorLit,uHorizonCol,fog),0.0,1.0),min(250.0/255.0,1.0-smoothstep(65.0,79.0,distZ)));
}`;
const shaders={surfaceVertex,surfaceFragment:surface,floorFragment:floor,depthVertex,depthFragment};
for(const [name,code] of Object.entries(shaders))fs.writeFileSync(path.join(root,'shaders',name+'.glsl'),code);
function forPointMask(mask){
 const result={};for(const key of ['surfaceVertex','surfaceFragment','floorFragment','depthVertex','depthFragment'])result[key]=this[key];
 for(let i=0;i<9;i++)if(mask&(1<<i)){const sampler=i?'uShadow'+i:'uShadowMap',has=i?'uHasShadow'+i:'uHasShadowMap',spread=i?'uSpread'+i:'uSpread';for(const key of ['surfaceFragment','floorFragment'])result[key]=result[key].replace('uniform sampler2D '+sampler+';','uniform samplerCube '+sampler+';').replace(new RegExp('float shadowFor'+i+'\\([^\\n]+'),`float shadowFor${i}(vec3 N,vec3 L){return pointShadow(${sampler},${has},vWorld,uLightPosition${i},uShadowDepth${i},uShadowPacked${i},${spread});}`);}
 return result;
}
fs.writeFileSync(path.join(root,'js/art-shaders.js'),'/* Unified per-light artistic shading; see README.md. */\nwindow.LightRefArtShaders='+JSON.stringify(shaders,null,2)+';\nwindow.LightRefArtShaders.forPointMask='+forPointMask.toString()+';\n');
console.log('Built five shaders: one complete lighting model across nine slots.');
