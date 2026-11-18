/* Local light geometry and editor. Rectangular PBR uses a spot approximation. */
(function(global){
 'use strict';var B=global.BABYLON,P=global.LightManager.prototype,types=['directional','point','spot','area'];
 function number(value,fallback,min,max){value=Number(value);return isFinite(value)?Math.max(min,Math.min(max,value)):fallback;}
 function direction(l){var a=l.azimuth*Math.PI/180,e=l.elevation*Math.PI/180;return new B.Vector3(Math.cos(e)*Math.sin(a),-Math.sin(e),-Math.cos(e)*Math.cos(a));}
 function normalize(raw){raw=raw||{};var az=number(raw.azimuth,215,0,360),el=number(raw.elevation,30,-90,90),d=direction({azimuth:az,elevation:el});return {
  name:typeof raw.name==='string'?raw.name:'Luz',color:typeof raw.color==='string'&&/^#[a-f\d]{6}$/i.test(raw.color)?raw.color:'#ffffff',
  intensity:number(raw.intensity,3,0,10),azimuth:az,elevation:el,enabled:raw.enabled!==false,softness:number(raw.softness,32,0,96),sourceSize:number(raw.sourceSize,6,1,14),
  type:types.indexOf(raw.type)>=0?raw.type:'directional',positionX:number(raw.positionX,-d.x*3.4,-20,20),positionY:number(raw.positionY,-d.y*3.4,-20,20),positionZ:number(raw.positionZ,-d.z*3.4,-20,20),
  range:number(raw.range,20,.5,60),angle:number(raw.angle,55,2,170),penumbra:number(raw.penumbra,.2,0,1),width:number(raw.width,2,.1,10),height:number(raw.height,1.5,.1,10),roll:number(raw.roll,0,-180,180),
  beamEnabled:raw.beamEnabled===true,beamWidth:number(raw.beamWidth,.2,.02,10),beamHeight:number(raw.beamHeight,4,.02,10),beamSoftness:number(raw.beamSoftness,.1,0,1)
 };}
 P.direction=function(l){return direction(l);};
 P.position=function(l){return l.type==='directional'?direction(l).scale(-12):new B.Vector3(l.positionX,l.positionY,l.positionZ);};
 P.areaFrame=function(l){var d=direction(l),up=Math.abs(d.y)>.98?new B.Vector3(0,0,1):B.Vector3.Up(),u=B.Vector3.Cross(up,d).normalize(),v=B.Vector3.Cross(d,u).normalize(),a=l.roll*Math.PI/180;return {u:u.scale(Math.cos(a)).add(v.scale(Math.sin(a))).scale(l.width*.5),v:v.scale(Math.cos(a)).subtract(u.scale(Math.sin(a))).scale(l.height*.5)};};
 P.toDescriptor=function(l){return normalize(l);};
 P.subjectBounds=function(){var min=null,max=null;this._casters.forEach(function(mesh){if(!mesh||mesh.isDisposed()||!mesh.isEnabled()||!mesh.isVisible)return;mesh.computeWorldMatrix(true);var box=mesh.getBoundingInfo().boundingBox;min=min?B.Vector3.Minimize(min,box.minimumWorld):box.minimumWorld.clone();max=max?B.Vector3.Maximize(max,box.maximumWorld):box.maximumWorld.clone();});return min?{center:min.add(max).scale(.5),radius:Math.max(1,max.subtract(min).length()*.5)}:{center:B.Vector3.Zero(),radius:1.5};};
 P.aimAtSubject=function(l){var offset=this.position(l).subtract(this.subjectBounds().center),length=Math.max(.0001,offset.length());l.azimuth=(Math.atan2(-offset.x,offset.z)*180/Math.PI+360)%360;l.elevation=Math.asin(Math.max(-1,Math.min(1,offset.y/length)))*180/Math.PI;};
 var add=P.add,update=P.update,remove=P.remove,visible=P.setHelpersVisible,enabled=P._applyEnabled;
 P.add=function(opts){var values=normalize(opts),l=add.call(this,values);Object.keys(values).forEach(function(k){l[k]=values[k];});this._configureLightType(l);return l;};
 P._configureLightType=function(l){
  var kind=l.type==='point'?'point':l.type==='directional'?'directional':'spot';
  if(l._nativeKind!==kind){
   if(l._sg)l._sg.dispose();if(l._bl)l._bl.dispose();
   var p=this.position(l),d=direction(l),native=kind==='point'?new B.PointLight('L'+l.id,p,this.scene):kind==='spot'?new B.SpotLight('L'+l.id,p,d,l.angle*Math.PI/180,1,this.scene):new B.DirectionalLight('L'+l.id,d,this.scene);
   l._bl=native;l._nativeKind=kind;l._sg=new B.ShadowGenerator(kind==='point'?512:1024,native);
   if(kind==='point'){l._sg.filter=B.ShadowGenerator.FILTER_NONE;l._sg.bias=.001;}
   else{l._sg.useCloseExponentialShadowMap=true;l._sg.depthScale=2500;l._sg.bias=0;}
   for(var i=0;i<this._casters.length;i++)l._sg.addShadowCaster(this._casters[i]);
   this._markLightsDirty();
  }
  this._syncLightGeometry(l);this._applyShadowDarkness(l);this._applySoftness(l);this._applyEnabled(l);
 };
 P._syncLightGeometry=function(l){
  var d=direction(l),p=this.position(l),native=l._bl;native.position.copyFrom(p);if(l.type!=='point')native.direction=d;
  native.intensity=l.intensity;native.diffuse=B.Color3.FromHexString(l.color);native.range=l.type==='directional'?Number.MAX_VALUE:l.range;native.shadowMinZ=.05;native.shadowMaxZ=l.type==='directional'?80:l.range;
  if(l._nativeKind==='spot'){native.angle=(l.type==='area'?Math.min(160,90+Math.max(l.width,l.height)*4):l.angle)*Math.PI/180;native.innerAngle=native.angle*(1-l.penumbra);native.exponent=1;}
  var hp=l.type==='directional'?d.scale(-3.4):p.clone();l._marker.position.copyFrom(hp);
  l._line=B.MeshBuilder.CreateLines('ln'+l.id,{points:[hp,hp.add(d.scale(l.type==='point'?.5:2))],instance:l._line});l._line.color=B.Color3.FromHexString(l.color);
  var lines=[],frame=this.areaFrame(l);
  if(l.type==='area'){
   var u=frame.u,v=frame.v;lines.push([hp.add(u).add(v),hp.subtract(u).add(v),hp.subtract(u).subtract(v),hp.add(u).subtract(v),hp.add(u).add(v)]);
   if(l.beamEnabled){var bu=u.clone().normalize().scale(l.beamWidth*.5),bv=v.clone().normalize().scale(l.beamHeight*.5),front=hp.add(d.scale(2.2)),near=[hp.add(bu).add(bv),hp.subtract(bu).add(bv),hp.subtract(bu).subtract(bv),hp.add(bu).subtract(bv)],far=[front.add(bu).add(bv),front.subtract(bu).add(bv),front.subtract(bu).subtract(bv),front.add(bu).subtract(bv)];lines.push([far[0],far[1],far[2],far[3],far[0]]);for(var bi=0;bi<4;bi++)lines.push([near[bi],far[bi]]);}
  }else if(l.type==='spot'){
   var distance=2.2,radius=Math.tan(l.angle*Math.PI/360)*distance,center=hp.add(d.scale(distance)),ring=[];
   var u=frame.u.normalize(),v=frame.v.normalize();for(var n=0;n<=24;n++){var a=n*Math.PI/12;ring.push(center.add(u.scale(Math.cos(a)*radius)).add(v.scale(Math.sin(a)*radius)));}lines.push(ring);for(var n=0;n<4;n++)lines.push([hp,ring[n*6]]);
  }
  var shapeKind=l.type+(l.type==='area'&&l.beamEnabled?'-beam':'');
  if(l._shape&&l._shapeKind!==shapeKind){l._shape.dispose();l._shape=null;}
  if(lines.length){l._shape=B.MeshBuilder.CreateLineSystem('light-shape-'+l.id,{lines:lines,updatable:true,instance:l._shape||undefined},this.scene);l._shape.color=B.Color3.FromHexString(l.color);l._shape.isPickable=false;l._shape.setEnabled(this.showHelpers&&l.enabled);l._shapeKind=shapeKind;}
 };
 P.update=function(id,field,value){var l=this.get(id);if(!l)return;
  if(field==='type'){var previous=l.type,next=types.indexOf(value)>=0?value:'directional';if(previous==='directional'&&next!=='directional'){var subject=this.subjectBounds(),position=subject.center.subtract(direction(l).scale(Math.max(3.4,subject.radius*2)));l.positionX=position.x;l.positionY=position.y;l.positionZ=position.z;}else if(previous==='point'&&next!=='point')this.aimAtSubject(l);l.type=next;this._configureLightType(l);return;}
  var geometry=['azimuth','elevation','positionX','positionY','positionZ','range','angle','penumbra','width','height','roll','beamEnabled','beamWidth','beamHeight','beamSoftness'];
  if(geometry.indexOf(field)>=0){var data=this.toDescriptor(l);data[field]=value;l[field]=normalize(data)[field];this._syncLightGeometry(l);return;}
  update.call(this,id,field,value);if(field==='color'&&l._shape)l._shape.color=B.Color3.FromHexString(l.color);
 };
 P.setHelpersVisible=function(v){visible.call(this,v);this.lights.forEach(function(l){if(l._shape)l._shape.setEnabled(v&&l.enabled);});};
 P._applyEnabled=function(l){enabled.call(this,l);if(l._shape)l._shape.setEnabled(this.showHelpers&&l.enabled);};
 P.remove=function(id){var l=this.get(id);if(l&&l._shape)l._shape.dispose();return remove.call(this,id);};
 async function prepareChange(sc,change){
  if(!sc.artEngine||sc.artEngine.mode!=='art')return;
  var list=sc.lightManager.lights.filter(function(l){return l.id!==change.removeId;}),mask=0;
  if(change.add)list.push(change.add);
  list.slice(0,9).forEach(function(l,i){var type=change.id!=null&&l.id===change.id?change.type:l.type;if(type==='point')mask|=1<<i;});
  var d=sc.artEngine,pair=d.getVariant(mask),meshes=d.collectMeshes();
  for(var i=0;i<9;i++){var texture=mask&(1<<i)?d.cube:d.white;pair.surface.setTexture(i?'uShadow'+i:'uShadowMap',texture);pair.floor.setTexture(i?'uShadow'+i:'uShadowMap',texture);}
  pair.surface.setTexture('uDepthMap',d.cameraDepth);pair.surface.setTexture('uEnvironmentSampler',d.cube);pair.surface.setTexture('uRefractionMap',d.white);pair.surface.setTexture('uExitMap',d.white);
  var start=Date.now();while(Date.now()-start<20000){if(meshes.every(function(m){return pair.surface.isReady(m);})&&pair.floor.isReady(sc.ground))return;await new Promise(function(resolve){setTimeout(resolve,40);});}
  throw Error('O novo material de luz não ficou pronto. A luz atual foi mantida.');
 }
 function render(sc,l,host,onEdit,onType){
  var box=document.createElement('div');box.className='lr04-lighttype-controls';
  box.innerHTML='<label class="lr04-lighttype-row"><span>Tipo de luz</span><select id="light-type" aria-label="Tipo de luz">'+[['directional','Direcional'],['point','Pontual (Point)'],['spot','Spot (cone)'],['area','Retangular']].map(function(p){return '<option value="'+p[0]+'">'+p[1]+'</option>';}).join('')+'</select></label>';
  host.insertBefore(box,host.firstChild);box.querySelector('select').value=l.type;box.querySelector('select').onchange=function(){var select=this,value=this.value;select.disabled=true;select.setAttribute('aria-busy','true');global.__lrLightTypeChange=prepareChange(sc,{id:l.id,type:value}).then(function(){if(sc.lightManager.get(l.id)){sc.lightManager.update(l.id,'type',value);onEdit();onType();}}).catch(function(error){select.value=l.type;if(global.LightRefToast)LightRefToast(error.message);console.error(error);}).finally(function(){select.disabled=false;select.removeAttribute('aria-busy');});};
  if(l.type==='point'){['sl-azimuth','sl-elevation'].forEach(function(id){var input=host.querySelector('#'+id);if(input)input.parentElement.hidden=true;});}
  if(l.type==='spot'||l.type==='area'){var az=host.querySelector('#sl-azimuth'),el=host.querySelector('#sl-elevation');if(az)az.parentElement.querySelector('span').textContent='Direção';if(el)el.parentElement.querySelector('span').textContent='Inclinação';}
  var fields=document.createElement('div');fields.className='lr04-lightgeometry';host.appendChild(fields);
  var specs=[];
  if(l.type==='spot')specs.push(['angle','Abertura',2,170,1,'°'],['penumbra','Borda do feixe',0,1,.01,'%',true]);
  if(l.type==='area'&&l.beamEnabled)specs.push(['beamWidth','Largura feixe',.02,10,.01],['beamHeight','Altura feixe',.02,10,.01],['beamSoftness','Borda do feixe',0,1,.01,'%',true]);
  if(l.type==='area')specs.push(['width','Largura fonte',.1,10,.1],['height','Altura fonte',.1,10,.1],['roll','Giro da luz',-180,180,1,'°']);
  if(l.type!=='directional')specs.push(['positionX','Posição X',-12,12,.1],['positionY','Posição Y',-12,12,.1],['positionZ','Posição Z',-12,12,.1],['range','Alcance',.5,60,.5]);
  specs.push(['softness','Suav. sombra',0,96,1]);
  specs.forEach(function(s){var row=document.createElement('label');row.className='lr04-row';row.innerHTML='<span>'+s[1]+'</span><input type="range" data-light-property="'+s[0]+'" aria-label="'+s[1]+'" min="'+s[2]+'" max="'+s[3]+'" step="'+s[4]+'"><output></output>';var input=row.querySelector('input'),output=row.querySelector('output');input.value=l[s[0]];function refresh(){input.style.setProperty('--fill',((input.value-input.min)/(input.max-input.min)*100)+'%');output.textContent=(s[6]?Math.round(Number(input.value)*100):Number(input.value))+(s[5]||'');if(s[6])input.setAttribute('aria-valuetext',output.textContent);}input.oninput=function(){sc.lightManager.update(l.id,s[0],Number(this.value));refresh();onEdit();};refresh();fields.appendChild(row);});
  if(l.type==='area'){var crop=document.createElement('label');crop.className='lr04-check lr04-beam-toggle';crop.innerHTML='<input type="checkbox" id="light-beam-enabled">Feixe em faixa (Artístico)';var ck=crop.querySelector('input');ck.checked=l.beamEnabled;ck.onchange=function(){sc.lightManager.update(l.id,'beamEnabled',this.checked);onEdit();onType();};fields.insertBefore(crop,fields.firstChild);}
  if(l.type==='spot'||l.type==='area'){var aim=document.createElement('button');aim.type='button';aim.className='lr04-widebutton';aim.textContent='Apontar para o centro';aim.onclick=function(){var p=sc.lightManager.position(l),len=Math.max(.0001,p.length());sc.lightManager.update(l.id,'azimuth',Math.round((Math.atan2(-p.x,p.z)*180/Math.PI+360)%360));sc.lightManager.update(l.id,'elevation',Math.round(Math.asin(p.y/len)*180/Math.PI));onEdit();onType();};fields.appendChild(aim);}
 }
 global.LightRefLightTypes={normalize:normalize,render:render,types:types,prepareChange:prepareChange};
})(window);
