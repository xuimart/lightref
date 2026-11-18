/* Artist-controlled sky/ground colors and optional daylight starting points.
 * Presets are illustrative, not astronomical simulations. No camera/material reset.
 */
(function(global){
 'use strict';
 var B=global.BABYLON,P=global.LightRefScene.prototype;
 var presets={
  sunrise:{label:'Nascer do sol',sky:'#b77c80',ground:'#8a645b',sun:'#ffd0a0',intensity:2.7,azimuth:110,elevation:10,softness:55,sourceSize:9},
  noon:{label:'Meio-dia',sky:'#86b3d9',ground:'#939780',sun:'#fff4dd',intensity:3.8,azimuth:185,elevation:75,softness:22,sourceSize:4},
  afternoon:{label:'Tarde',sky:'#dc9b72',ground:'#98725d',sun:'#ffb266',intensity:3.1,azimuth:255,elevation:20,softness:40,sourceSize:7},
  night:{label:'Noite',sky:'#111c36',ground:'#283345',sun:'#9dbbff',intensity:.65,azimuth:225,elevation:35,softness:65,sourceSize:10}
 };
 function hex(value,fallback){return typeof value==='string'&&/^#[a-f\d]{6}$/i.test(value)?value.toLowerCase():fallback;}
 function clean(value,fallback){
  value=value&&typeof value==='object'?value:{};fallback=fallback||{};
  return {skyColor:hex(value.skyColor,hex(fallback.skyColor,'#3a4a6a')),groundColor:hex(value.groundColor,hex(fallback.groundColor,'#9e9ea3')),period:presets[value.period]?value.period:'custom',adjustSun:value.adjustSun!==false,skyOverride:value.skyOverride===true};
 }
 function sync(sc){
  var host=document.querySelector('.lr04-atmosphere');if(!host)return;
  var state=sc.getAtmosphere();
  var transparent=document.getElementById('bg-transp');if(transparent)transparent.checked=!!sc.getBackground().transparent;
  ['sky','ground'].forEach(function(key){var input=host.querySelector('[data-atmosphere-color="'+key+'"]'),output=host.querySelector('[data-atmosphere-hex="'+key+'"]');if(input)input.value=state[key+'Color'];if(output)output.textContent=state[key+'Color'].toUpperCase();});
  var ck=host.querySelector('#atmosphere-adjust-sun');if(ck)ck.checked=state.adjustSun;
  Array.prototype.forEach.call(host.querySelectorAll('[data-daylight]'),function(button){button.setAttribute('aria-pressed',String(button.getAttribute('data-daylight')===state.period));});
 }
 function edited(sc){sync(sc);if(sc.onAtmosphereEdit)sc.onAtmosphereEdit();}
 P.getGroundColor=function(){var mat=this.artEngine?this.artEngine.originalFloor:this.ground&&this.ground.material;return this._groundColor||(mat&&mat.diffuseColor?mat.diffuseColor.toHexString().toLowerCase():'#9e9ea3');};
 P.setGroundColor=function(value){
  this._groundColor=hex(value,this.getGroundColor());var mat=this.artEngine?this.artEngine.originalFloor:this.ground&&this.ground.material;
  if(mat)mat.diffuseColor=B.Color3.FromHexString(this._groundColor);
  if(this.ambient)this.ambient.groundColor=B.Color3.FromHexString(this._groundColor).scale(.08);
  if(!this._applyingAtmosphere)this._dayPeriod='custom';sync(this);
 };
 P.getAtmosphere=function(){return {skyColor:this.getBackground().color,groundColor:this.getGroundColor(),period:this._dayPeriod||'custom',adjustSun:this._adjustAtmosphereSun!==false,skyOverride:!!this._skyColorOverride};};
 P.setAtmosphere=function(value){
  var state=clean(value);this._applyingAtmosphere=true;
  try{
   this.setGroundColor(state.groundColor);this.setBackground(this._bgTransparent?'transparent':'color',state.skyColor);
   this._dayPeriod=state.period;this._adjustAtmosphereSun=state.adjustSun;this._skyColorOverride=state.skyOverride;
   if(state.skyOverride)this.setEnvBackgroundVisible(false);
  }finally{this._applyingAtmosphere=false;}sync(this);
 };
 P.setSkyColor=function(value){
  this.setBackground('color',hex(value,this._bgColor));this._skyColorOverride=true;this.setEnvBackgroundVisible(false);
  var viewport=document.querySelector('.lr04-viewport');if(viewport)viewport.classList.remove('transparent');
  var hdr=document.getElementById('ck-envbg');if(hdr)hdr.checked=false;
  this._dayPeriod='custom';sync(this);
 };
 var setBackground=P.setBackground;
 P.setBackground=function(mode,color){setBackground.call(this,mode,color);if(!this._applyingAtmosphere)this._dayPeriod='custom';sync(this);};
 var setEnvBackgroundVisible=P.setEnvBackgroundVisible,setEnvironment=P.setEnvironment;
 P.setEnvBackgroundVisible=function(on){if(on){this._skyColorOverride=false;if(!this._applyingAtmosphere)this._dayPeriod='custom';}setEnvBackgroundVisible.call(this,on);sync(this);};
 P.setEnvironment=function(url,opts){setEnvironment.call(this,url,opts);if(url&&(!opts||opts.showBackground!==false)){this._skyColorOverride=false;this._dayPeriod='custom';}sync(this);};
 P.applyDaylightPreset=function(id,adjustSun){
  var preset=presets[id];if(!preset)return false;
  this.setSkyColor(preset.sky);
  this.setAtmosphere({skyColor:preset.sky,groundColor:preset.ground,period:id,adjustSun:adjustSun!==false,skyOverride:true});
  if(adjustSun!==false){
   var light=this.lightManager.lights[0]||this.lightManager.add({name:'Principal'}),self=this;
   ['intensity','azimuth','elevation','softness','sourceSize'].forEach(function(key){self.lightManager.update(light.id,key,preset[key]);});
   this.lightManager.update(light.id,'color',preset.sun);this.lightManager.update(light.id,'enabled',true);
  }
  sync(this);return true;
 };
 function render(sc){
  var host=document.querySelector('.lr04-atmosphere');if(!host)return;
  if(!host.firstElementChild){
   host.innerHTML='<div class="lr04-atmosphere-colors">'+
    '<label><span>Céu</span><input type="color" data-atmosphere-color="sky" aria-label="Cor do céu"><output data-atmosphere-hex="sky"></output></label>'+
    '<label><span>Chão</span><input type="color" data-atmosphere-color="ground" aria-label="Cor do chão"><output data-atmosphere-hex="ground"></output></label></div>'+
    '<div class="lr04-daylight-presets">'+
    Object.keys(presets).map(function(id){var p=presets[id];return '<button type="button" data-daylight="'+id+'" aria-pressed="false"><span class="lr04-daylight-preview" style="--sky:'+p.sky+';--ground:'+p.ground+';--sun:'+p.sun+'"></span><span>'+p.label+'</span></button>';}).join('')+'</div>'+
    '<label class="lr04-check lr04-atmosphere-sun"><input id="atmosphere-adjust-sun" type="checkbox" checked>Ajustar luz principal</label>';
   Array.prototype.forEach.call(host.querySelectorAll('[data-atmosphere-color]'),function(input){input.oninput=function(){if(this.getAttribute('data-atmosphere-color')==='sky')sc.setSkyColor(this.value);else sc.setGroundColor(this.value);edited(sc);};});
   Array.prototype.forEach.call(host.querySelectorAll('[data-daylight]'),function(button){button.onclick=function(){sc.applyDaylightPreset(this.getAttribute('data-daylight'),host.querySelector('#atmosphere-adjust-sun').checked);edited(sc);};});
   host.querySelector('#atmosphere-adjust-sun').onchange=function(){sc._adjustAtmosphereSun=this.checked;edited(sc);};
  }
  sync(sc);
 }
 global.LightRefAtmosphere={presets:presets,clean:clean,render:render,sync:sync};
})(window);
