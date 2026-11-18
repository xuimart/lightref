/* LightRef test renderer. Babylon keeps scene/camera/loaders/gizmos;
 * color, reflections, translucency and shadows use the recovered art shaders.
 * This adapter never modifies the production LightRef installation or data. */
(function(global){
 'use strict';
 var B=global.BABYLON,S=global.LightRefArtShaders;
 function clamp(x,a,b){return Math.max(a,Math.min(b,x));}
 function material(name,vertex,fragment,scene){
  var key=name.replace(/[^a-zA-Z0-9]/g,'');B.Effect.ShadersStore[key+'VertexShader']=vertex;B.Effect.ShadersStore[key+'FragmentShader']=fragment;
  var uniforms=[],samplers=[],all=vertex+'\n'+fragment,re=/uniform\s+(\w+)\s+(\w+)\s*;/g,m;
  while((m=re.exec(all))){var a=m[1].indexOf('sampler')===0?samplers:uniforms;if(a.indexOf(m[2])<0)a.push(m[2]);}
  var out=new B.ShaderMaterial(name,scene,{vertex:key,fragment:key},{attributes:['position','normal'],uniforms:uniforms,samplers:samplers,needAlphaBlending:false,needAlphaTesting:false});
  out.backFaceCulling=false;return out;
 }
 function Driver(owner){
  this.owner=owner;this.scene=owner.scene;this.engine=owner.engine;this.mode='art';this.targets={};this.meshes=[];this.activeLights=[];this.disposed=false;this.frames=0;this.errors=[];this.settings={sheen:0,ambient:.65,floorBounce:.55};
  try{var cfg=global.LightRefStorage&&LightRefStorage.readConfig(),saved=cfg&&cfg.artEngine;if(saved){Object.keys(this.settings).forEach(function(k){if(Number.isFinite(saved[k]))this.settings[k]=clamp(saved[k],0,1);},this);}}catch(_){}
  this.originalFloor=owner.ground&&owner.ground.material;
  this.surface=material('lrArtSurface',S.surfaceVertex,S.surfaceFragment,this.scene);this.floor=material('lrArtFloor',S.surfaceVertex,S.floorFragment,this.scene);
  this.depthMaterial=material('lrArtCameraDepth',S.depthVertex,S.depthFragment,this.scene);this.depthMaterial.setFloat('uLinearMode',1);
  this.shadowMaterial=material('lrArtShadowDepth',S.depthVertex,S.depthFragment,this.scene);this.shadowMaterial.setFloat('uLinearMode',0);
  this.depthMaterial.onBindObservable.add(function(mesh){if(mesh)this.setMatrix('normalMatrix',mesh.getWorldMatrix().clone().invert().transpose());}.bind(this.depthMaterial));
  this.white=B.RawTexture.CreateRGBATexture(new Uint8Array([255,0,0,255]),1,1,this.scene,false,false,B.Texture.NEAREST_SAMPLINGMODE);
  var face=new Uint8Array([128,128,128,255]);this.cube=new B.RawCubeTexture(this.scene,[face,face,face,face,face,face],1,B.Engine.TEXTUREFORMAT_RGBA,B.Engine.TEXTURETYPE_UNSIGNED_BYTE,false,false,B.Texture.NEAREST_SAMPLINGMODE);
  this.surface.setTexture('uShadowMap',this.white);this.surface.setTexture('uDepthMap',this.white);this.surface.setTexture('uEnvironmentSampler',this.cube);this.floor.setTexture('uShadowMap',this.white);
  for(var i=1;i<9;i++){this.surface.setTexture('uShadow'+i,this.white);this.floor.setTexture('uShadow'+i,this.white);}
  this.cameraDepth=this.makeTarget('artCameraDepth',{width:512,height:512},owner.camera,this.depthMaterial);
  this.refractionTarget=this.makeTarget('artRefractionBackground',{width:64,height:64},owner.camera,null);this.refractionTarget.updateSamplingMode(B.Texture.BILINEAR_SAMPLINGMODE);
  this.exitMaterial=material('lrGlassExit',S.depthVertex,S.depthFragment,this.scene);this.exitMaterial.setFloat('uLinearMode',1);this.exitMaterial.backFaceCulling=true;this.exitMaterial.cullBackFaces=false;this.exitMaterial.onBindObservable.add(function(mesh){if(mesh)this.setMatrix('normalMatrix',mesh.getWorldMatrix().clone().invert().transpose());}.bind(this.exitMaterial));
  this.exitTarget=this.makeTarget('artGlassExit',{width:64,height:64},owner.camera,this.exitMaterial);
  this.surface.setTexture('uRefractionMap',this.white);
  this.surface.setTexture('uExitMap',this.white);
  this._configureBindings();
  var self=this;this.observer=this.scene.onBeforeRenderObservable.add(function(){self.prepareFrame();});this.scene.onDisposeObservable.addOnce(function(){self.dispose();});
  this.variants={0:{surface:this.surface,floor:this.floor,bound:true}};this.variantMask=0;
  this.setMode(this.mode,false);this.buildUI();
 }
 Driver.prototype.makeTarget=function(name,size,camera,override){
  var target=new B.RenderTargetTexture(name,size,this.scene,false,true,B.Engine.TEXTURETYPE_UNSIGNED_BYTE,false,B.Texture.NEAREST_SAMPLINGMODE,true);
  target.activeCamera=camera;target.renderParticles=false;target.renderSprites=false;target.clearColor=new B.Color4(1,1,1,1);target.ignoreCameraViewport=true;target.refreshRate=1;target.renderList=[];target._artOverride=override;
  return target;
 };
 Driver.prototype.attachTarget=function(target){if(this.scene.customRenderTargets.indexOf(target)<0)this.scene.customRenderTargets.push(target);};
 Driver.prototype.detachTarget=function(target){var i=this.scene.customRenderTargets.indexOf(target);if(i>=0)this.scene.customRenderTargets.splice(i,1);};
 Driver.prototype.getVariant=function(mask){
  var pair=this.variants[mask];
  if(!pair){var shaders=S.forPointMask(mask);pair=this.variants[mask]={surface:material('lrArtSurfaceMask'+mask,shaders.surfaceVertex,shaders.surfaceFragment,this.scene),floor:material('lrArtFloorMask'+mask,shaders.surfaceVertex,shaders.floorFragment,this.scene)};}
  return pair;
 };
 Driver.prototype.ensureVariant=function(mask){
  if(mask===this.variantMask)return;var pair=this.getVariant(mask),old=this.surface,oldFloor=this.floor;
  this.surface=pair.surface;this.floor=pair.floor;this.variantMask=mask;
  if(!pair.bound){this._configureBindings();pair.bound=true;}
  for(var i=0;i<9;i++){var texture=mask&(1<<i)?this.cube:this.white;this.surface.setTexture(i?'uShadow'+i:'uShadowMap',texture);this.floor.setTexture(i?'uShadow'+i:'uShadowMap',texture);}
  this.surface.setTexture('uDepthMap',this.cameraDepth);this.surface.setTexture('uEnvironmentSampler',this.cube);
  this.surface.setTexture('uRefractionMap',this.white);
  this.surface.setTexture('uExitMap',this.white);
  var self=this;this.scene.meshes.forEach(function(mesh){if(mesh.material===old)mesh.material=self.surface;if(mesh.material===oldFloor)mesh.material=self.floor;});
 };
 Driver.prototype.releaseTarget=function(item){this.detachTarget(item.target);if(!item.native)item.target.dispose();if(item.camera)item.camera.dispose();};
 Driver.prototype._configureBindings=function(){var self=this;this.floor.disableDepthWrite=true;this.surface.alphaMode=B.Engine.ALPHA_COMBINE;this.surface.needAlphaBlending=function(){return Number(self.owner.getMaterialParams().transparency)>.001;};[this.surface,this.floor].forEach(function(mat){mat.onBindObservable.add(function(mesh){self.bindMaterial(mat,mesh);});mat.onError=function(effect,error){self.errors.push(String(error));console.error('LightRef shader',error);};});};
 Driver.prototype.collectMeshes=function(){
  var list=[],owner=this.owner;
  function add(mesh){if(!mesh||mesh.isDisposed()||!mesh.isEnabled()||!mesh.isVisible||!mesh.getTotalVertices())return;if(list.indexOf(mesh)<0)list.push(mesh);}
  if(owner.modelRoot)owner.modelRoot.getChildMeshes().forEach(add);
  owner.sceneObjects.forEach(function(obj){if(obj.pivot&&obj.pivot.isEnabled())obj.meshes.forEach(add);});return list;
 };
 Driver.prototype.bounds=function(meshes){
  var min=new B.Vector3(Infinity,Infinity,Infinity),max=new B.Vector3(-Infinity,-Infinity,-Infinity);
  meshes.forEach(function(mesh){mesh.computeWorldMatrix(true);var b=mesh.getBoundingInfo().boundingBox;min=B.Vector3.Minimize(min,b.minimumWorld);max=B.Vector3.Maximize(max,b.maximumWorld);});
  if(!meshes.length){min=new B.Vector3(-1,-1,-1);max=new B.Vector3(1,1,1);}return {min:min,max:max,center:min.add(max).scale(.5),extent:clamp(max.subtract(min).length()*.65,2.3,35)};
 };
 Driver.prototype.prepareFrame=function(){
  if(this.disposed)return;this.frames++;if(this.mode!=='art'){this.prepareRefraction();return;}
  var self=this,owner=this.owner;this.meshes=this.collectMeshes();this.bound=this.bounds(this.meshes);this.slotLights=owner.lightManager.lights.slice(0,9);this.activeLights=this.slotLights.filter(function(l){return l.enabled&&l.intensity>0;});
  var mask=0;this.slotLights.forEach(function(light,i){if(light.type==='point')mask|=1<<i;});this.ensureVariant(mask);
  this.meshes.forEach(function(mesh){mesh.material=self.surface;});
  this.surface.backFaceCulling=Number(owner.getMaterialParams().transparency)>.001;
  var floor=owner.ground,floorOn=!!(floor&&floor.isEnabled());if(floor)floor.material=this.floor;
  var seen={};this.slotLights.forEach(function(light,index){if(!light.enabled||light.intensity<=0)return;var id=String(light.id);seen[id]=true;var item=self.targets[id];
   var kind=light.type||'directional';if(item&&(item.kind!==kind||(item.native&&item.target!==light._sg.getShadowMap()))){self.releaseTarget(item);delete self.targets[id];item=null;}
   if(kind==='point'){
    if(!item)item=self.targets[id]={kind:kind,native:true,target:light._sg.getShadowMap(),camera:null};
    item.target.renderList=self.meshes.slice();item.target.activeCamera=owner.camera;self.attachTarget(item.target);item.index=index;return;
   }
   if(!item){var cam=new B.FreeCamera('artLightCamera'+id,new B.Vector3(0,10,0),self.scene);cam.minZ=.05;cam.maxZ=160;item=self.targets[id]={kind:kind,camera:cam,target:self.makeTarget('artShadow'+id,1024,cam,self.shadowMaterial)};}
   var direction=owner.lightManager.direction?owner.lightManager.direction(light):light._bl.direction.clone().normalize(),center=self.bound.center,radius=Math.max(12,self.bound.extent*2.5),cam=item.camera;
   cam.upVector=Math.abs(direction.y)>.98?new B.Vector3(0,0,-1):B.Vector3.Up();cam.minZ=.05;
   if(kind==='directional'){cam.mode=B.Camera.ORTHOGRAPHIC_CAMERA;cam.position=center.subtract(direction.scale(radius));cam.setTarget(center);cam.maxZ=radius+self.bound.extent*3+10;cam.orthoLeft=-self.bound.extent;cam.orthoRight=self.bound.extent;cam.orthoTop=self.bound.extent;cam.orthoBottom=-self.bound.extent;}
   else{cam.mode=B.Camera.PERSPECTIVE_CAMERA;cam.position=owner.lightManager.position(light);cam.setTarget(cam.position.add(direction));cam.fov=(kind==='spot'?light.angle:160)*Math.PI/180;cam.maxZ=light.range;}
   item.target.renderList=self.meshes.slice();item.target.setMaterialForRendering(self.meshes,self.shadowMaterial);self.attachTarget(item.target);item.index=index;
  });
  Object.keys(this.targets).forEach(function(id){if(!seen[id]){self.releaseTarget(self.targets[id]);delete self.targets[id];}});
  var width=this.engine.getRenderWidth(true),height=this.engine.getRenderHeight(true),aspect=width/Math.max(1,height),size=this.cameraDepth.getSize(),cel=owner.getMaterial()==='cel',dh=cel?Math.max(128,Math.min(2048,height)):512,dw=cel?Math.max(128,Math.min(2048,width)):Math.max(128,Math.min(1024,Math.round(512*aspect)));
  if(size.width!==dw||size.height!==dh)this.cameraDepth.resize({width:dw,height:dh});
  this.cameraDepth.activeCamera=owner.camera;this.cameraDepth.renderList=this.meshes.concat(floorOn?[floor]:[]);this.cameraDepth.setMaterialForRendering(this.cameraDepth.renderList,this.depthMaterial);this.attachTarget(this.cameraDepth);
  this.prepareRefraction();
 };
 Driver.prototype.prepareRefraction=function(){
  var owner=this.owner,target=this.refractionTarget;if(Number(owner.getMaterialParams().transparency)<=.001){this.detachTarget(target);this.detachTarget(this.exitTarget);return;}
  var width=this.engine.getRenderWidth(true),height=this.engine.getRenderHeight(true),scale=Math.min(1,2048/Math.max(width,height)),w=Math.max(16,Math.round(width*scale)),h=Math.max(16,Math.round(height*scale)),size=target.getSize();if(size.width!==w||size.height!==h)target.resize({width:w,height:h});
  target.activeCamera=owner.camera;target.clearColor=this.scene.clearColor.clone();target.renderList=[];if(owner.ground&&owner.ground.isEnabled())target.renderList.push(owner.ground);if(owner._skybox&&owner._skybox.isEnabled())target.renderList.push(owner._skybox);this.attachTarget(target);
  if(owner._material&&owner._material.subSurface.isRefractionEnabled)owner._material.subSurface.refractionTexture=target;
  if(this.mode==='art'&&owner.getMaterialParams().solidRefraction!==0){var exitSize=this.exitTarget.getSize();if(exitSize.width!==w||exitSize.height!==h)this.exitTarget.resize({width:w,height:h});this.exitTarget.activeCamera=owner.camera;this.exitTarget.renderList=this.collectMeshes();this.exitTarget.setMaterialForRendering(this.exitTarget.renderList,this.exitMaterial);this.attachTarget(this.exitTarget);}else this.detachTarget(this.exitTarget);
 };
 Driver.prototype.bindMaterial=function(mat,mesh){
  if(this.mode!=='art'||!mesh)return;var fx=mat.getEffect();if(!fx)return;
  var scene=this.scene,owner=this.owner,view=scene.getViewMatrix(),invView=view.clone().invert(),flip=B.Matrix.Scaling(1,1,-1),pr=owner.getMaterialParams(),lights=this.slotLights||this.activeLights,bounds=this.bound||this.bounds(this.meshes),floor=owner.ground;
  var floorOn=!!(floor&&floor.isEnabled()),gap=Math.max(0,bounds.min.y-(floor?floor.position.y:-1.5)),identity=B.Matrix.Identity();
  fx.setMatrix('normalMatrix',mesh.getWorldMatrix().clone().invert().transpose());fx.setMatrix('uInvView',invView);
  function vector(name,v){fx.setVector3(name,v);}function scalar(name,n){fx.setFloat(name,Number.isFinite(n)?n:0);}function color(name,c){fx.setColor3(name,c);}
  var bg=B.Color3.FromHexString(owner._bgColor||'#adadad'),ambient=bg.scale(this.settings.ambient),horizon=new B.Color3(Math.min(1,bg.r*1.18+.0784),Math.min(1,bg.g*1.18+.0784),Math.min(1,bg.b*1.18+.0784));
  var base=B.Color3.FromHexString(owner._formColor||LightRefScene.MATERIAL_BASE_COLOR[owner.getMaterial()]||'#c9c4bd');
  color('uBaseCol',base);color('uAmbientCol',ambient);color('uHorizonCol',horizon);color('uFloorCol',this.originalFloor&&this.originalFloor.diffuseColor||new B.Color3(.62,.62,.64));
  scalar('uShadowFilter',pr.shadowFilter===0?0:1);
  scalar('uTransparency',clamp(Number(pr.transparency)||0,0,1));scalar('uIOR',clamp(Number(pr.ior)||1.5,1,2.6));scalar('uThickness',clamp(Number(pr.thickness)||.35,.01,3));scalar('uAbsorption',clamp(Number(pr.absorption)||0,0,4));scalar('uDispersion',clamp(Number(pr.dispersion)||0,0,1));
  var projection=scene.activeCamera.getProjectionMatrix();fx.setFloat3('uRefractionProjection',projection.m[0]*.5,projection.m[5]*.5,scene.activeCamera.mode===B.Camera.ORTHOGRAPHIC_CAMERA?1:0);fx.setTexture('uRefractionMap',Number(pr.transparency)>.001?this.refractionTarget:this.white);
  fx.setTexture('uExitMap',Number(pr.transparency)>.001?this.exitTarget:this.white);scalar('uSolidRefraction',pr.solidRefraction===0?0:1);scalar('uGlassRange',clamp(bounds.max.subtract(bounds.min).length()*1.1,.1,50));scalar('uFloorY',floor?floor.position.y:-1.5);
  vector('uGlassCenter',bounds.center);var dimensions=bounds.max.subtract(bounds.min);scalar('uGlassRadius',Math.max(.03,Math.min(dimensions.x,dimensions.y,dimensions.z)*.5));scalar('uCaustics',clamp(Number(pr.caustics)||0,0,2));
  var backgroundDepth=30;if(owner._skybox&&owner._skybox.isEnabled()){owner._skybox.computeWorldMatrix(true);var corners=owner._skybox.getBoundingInfo().boundingBox.vectorsWorld;var minDepth=Infinity,maxDepth=0;corners.forEach(function(p){var z=B.Vector3.TransformCoordinates(p,view).z;minDepth=Math.min(minDepth,z);maxDepth=Math.max(maxDepth,z);});backgroundDepth=Math.max(1,maxDepth-minDepth<.05?(minDepth+maxDepth)*.5:maxDepth);}scalar('uBackgroundDepth',backgroundDepth);
  scalar('uCel',owner.getMaterial()==='cel'?1:0);scalar('uCelBands',clamp(Number(pr.celBands)||3,2,6));scalar('uCelThreshold',clamp(Number(pr.celThreshold)||0,0,1));scalar('uCelSoftness',clamp(Number(pr.celSoftness)||0,0,.3));scalar('uCelShadow',clamp(Number(pr.celShadow)||0,0,1));
  scalar('uLineEnabled',pr.lineEnabled?1:0);scalar('uLineWidth',clamp(Number(pr.lineWidth)||0,.5,5));scalar('uLineDetail',clamp(Number(pr.lineDetail)||0,0,1));color('uLineColor',B.Color3.FromHexString(/^#[a-f\d]{6}$/i.test(pr.lineColor)?pr.lineColor:'#16151c'));
  scalar('uGloss',1-clamp(pr.roughness,0,1));scalar('uMetallic',clamp(pr.metalness,0,1));scalar('uSSS',clamp(pr.subsurface,0,1));scalar('uSheen',this.settings.sheen);scalar('uSpecularStrength',clamp(pr.specular,0,1));
  color('uScatterCol',B.Color3.FromHexString(pr.scatter&&pr.scatter!=='#000000'?pr.scatter:'#ff5c24'));
  scalar('uReflectionStrength',clamp(pr.reflection,0,2));scalar('uAmbientShadowOnly',0);scalar('uFloorBounceInt',this.settings.floorBounce*100);scalar('uFloorEnabled',floorOn?1:0);scalar('uFloorDist',Math.max(.05,gap+.13));scalar('uObjGap',gap);scalar('uFloorAmbient',.45);
  fx.setFloat2('uResolution',this.engine.getRenderWidth(),this.engine.getRenderHeight());fx.setTexture('uDepthMap',this.cameraDepth);scalar('uHasDepthMap',this.meshes.length?1:0);
  fx.setVector2('uObjCenterXZ',new B.Vector2(bounds.center.x,bounds.center.z));vector('uCameraWorld',scene.activeCamera.globalPosition);scalar('uCamDist',B.Vector3.Distance(scene.activeCamera.globalPosition,bounds.center));
  var env=scene.environmentTexture,hasEnv=!!(env&&env.isCube&&env.isReady());fx.setTexture('uEnvironmentSampler',hasEnv?env:this.cube);scalar('uHasEnvironment',hasEnv?1:0);scalar('uEnvironmentIntensity',clamp(owner.getEnvIntensity(),0,2));
  scalar('uGlassEnvironment',hasEnv&&owner._envUrl&&owner._skybox&&owner._skybox.isEnabled()?1:0);
  for(var i=0;i<9;i++){
   var light=lights[i],item=light&&this.targets[String(light.id)],axis=light?(owner.lightManager.direction?owner.lightManager.direction(light):light._bl.direction.clone()):new B.Vector3(0,-1,0),d=axis.scale(-1).normalize(),viewD=B.Vector3.TransformNormal(d,view);viewD.z=-viewD.z;
   var col=light?B.Color3.FromHexString(light.color):B.Color3.Black(),intensity=light&&light.enabled?light.intensity*(70/3):0,spread=light?clamp((light.softness||0)/96*((light.sourceSize||6)/6),.01,1):.5;
   if(light&&light.type==='area')spread=clamp(spread*.5+Math.max(light.width,light.height)*.12,.01,1);
   var matrix=item&&item.camera?flip.multiply(invView).multiply(item.camera.getViewMatrix()).multiply(item.camera.getProjectionMatrix()):identity;
   var shadowName=i?'uShadow'+i:'uShadowMap',vpName=i?'uLightVP'+i:'uLightVP',hasName=i?'uHasShadow'+i:'uHasShadowMap';
   fx.setTexture(shadowName,item?item.target:(light&&light.type==='point'?this.cube:this.white));fx.setMatrix(vpName,matrix);scalar(hasName,item?1:0);scalar(i?'uSpread'+i:'uSpread',spread);
   vector('uLightDir'+i,viewD);color('uLightCol'+i,col);scalar('uLightInt'+i,intensity);
   var type=light?['directional','point','spot','area'].indexOf(light.type||'directional'):0;scalar('uLightType'+i,type);scalar('uLightRange'+i,light&&light.range||20);
   var position=light?(owner.lightManager.position?owner.lightManager.position(light):light._bl.position):B.Vector3.Zero(),p=B.Vector3.TransformCoordinates(position,view),viewAxis=B.Vector3.TransformNormal(axis,view);p.z=-p.z;viewAxis.z=-viewAxis.z;vector('uLightPosition'+i,p);vector('uLightAxis'+i,viewAxis);
   var frame=light&&owner.lightManager.areaFrame?owner.lightManager.areaFrame(light):{u:new B.Vector3(1,0,0),v:new B.Vector3(0,1,0)},u=B.Vector3.TransformNormal(frame.u,view),v=B.Vector3.TransformNormal(frame.v,view);u.z=-u.z;v.z=-v.z;vector('uAreaU'+i,u);vector('uAreaV'+i,v);
   fx.setFloat4('uBeam'+i,light&&light.beamWidth?light.beamWidth*.5:.1,light&&light.beamHeight?light.beamHeight*.5:2,light&&light.beamSoftness||0,light&&light.beamEnabled?1:0);
   var angle=(light&&light.angle||55)*Math.PI/360;fx.setFloat2('uLightCone'+i,Math.cos(angle*(1-(light&&light.penumbra||0))),Math.cos(angle));
   fx.setFloat2('uShadowDepth'+i,.05,.05+(light&&light.range||20));scalar('uShadowPacked'+i,item&&item.native&&item.target.textureType===B.Engine.TEXTURETYPE_UNSIGNED_BYTE?1:0);
  }
 };
 Driver.prototype.setMode=function(mode,persist){
  this.mode=mode==='pbr'&&persist===false?'pbr':'art';this.scene.shadowsEnabled=this.mode==='pbr';var self=this;
  if(this.mode==='pbr'){this.detachTarget(this.cameraDepth);Object.keys(this.targets).forEach(function(id){self.detachTarget(self.targets[id].target);});var native=this.owner._ensureMaterial();this.collectMeshes().forEach(function(mesh){mesh.material=native;});if(this.owner.ground)this.owner.ground.material=this.originalFloor;this.prepareRefraction();}
  else this.prepareFrame();
  if(this.ui){this.ui.value=this.mode;this.ui.setAttribute('aria-label','Aparência: '+(this.mode==='art'?'artística':'PBR original'));}
  if(persist!==false)this.save();
 };
 Driver.prototype.save=function(){try{if(global.LightRefStorage)LightRefStorage.writeConfig({artEngine:{mode:'art',sheen:this.settings.sheen,ambient:this.settings.ambient,floorBounce:this.settings.floorBounce}});}catch(e){console.warn('Art preferences',e);}};
 Driver.prototype.buildUI=function(){
  var self=this,panel=document.querySelector('.lr04-material');if(!panel)return;
  var controls=document.createElement('div');controls.id='art-material-controls';
  [['sheen','Tecido'],['ambient','Ambiente artístico'],['floorBounce','Rebate do piso']].forEach(function(item){var label=document.createElement('label');label.className='lr04-row';var name=document.createElement('span');name.textContent=item[1];var input=document.createElement('input');input.type='range';input.min=0;input.max=1;input.step=.01;input.value=self.settings[item[0]];input.id='art-'+item[0];input.setAttribute('aria-label',item[1]);var output=document.createElement('output');output.textContent=Number(input.value).toFixed(2);function refresh(){input.style.setProperty('--fill',(Number(input.value)*100)+'%');output.textContent=Number(input.value).toFixed(2);}input.oninput=function(){self.settings[item[0]]=Number(this.value);refresh();};input.onchange=function(){self.save();};refresh();label.appendChild(name);label.appendChild(input);label.appendChild(output);controls.appendChild(label);});panel.appendChild(controls);
 };
 Driver.prototype.dispose=function(){if(this.disposed)return;this.disposed=true;this.scene.onBeforeRenderObservable.remove(this.observer);var self=this;Object.keys(this.targets).forEach(function(id){self.releaseTarget(self.targets[id]);});this.detachTarget(this.cameraDepth);this.cameraDepth.dispose();this.detachTarget(this.refractionTarget);this.refractionTarget.dispose();this.detachTarget(this.exitTarget);this.exitTarget.dispose();this.exitMaterial.dispose();Object.keys(this.variants).forEach(function(mask){self.variants[mask].surface.dispose();self.variants[mask].floor.dispose();});[this.depthMaterial,this.shadowMaterial,this.white,this.cube].forEach(function(x){try{x.dispose();}catch(_){}});};
 var proto=global.LightRefScene.prototype,init=proto.init;
 var setMaterial=proto.setMaterial;proto.setMaterial=function(type){setMaterial.call(this,type);if(['cel','glass','diamond','emerald','ruby'].indexOf(type)>=0&&this.artEngine)this.artEngine.setMode('art');};
 proto.init=function(){init.call(this);this.artEngine=new Driver(this);global.__lrArtScene=this;};
 // Library thumbnails intentionally use their own flat temporary lights.
 // Keep that neutral library behavior, then restore the selected appearance.
 var standardThumbnail=proto.standardThumbnail;
 proto.standardThumbnail=function(callback){
  var driver=this.artEngine,previous=driver&&driver.mode;
  if(driver&&previous==='art')driver.setMode('pbr',false);
  var restored=false;
  function restore(){if(!restored&&driver){restored=true;driver.setMode(previous,false);}}
  try{return standardThumbnail.call(this,function(data){restore();if(callback)callback(data);});}
  catch(error){restore();throw error;}
 };
 global.LightRefArtDriver=Driver;
})(window);
