/* Reversible normal smoothing. Positions, indices and UVs are left intact. */
(function(global){
 'use strict';var B=global.BABYLON,P=global.LightRefScene.prototype,update=P._updateMaterial,defaults=P._defaultParams;
 P._defaultParams=function(type){var out=defaults.call(this,type);out.surfaceSmooth=0;out.shadowFilter=1;return out;};
 function prepare(mesh){
  var positions=mesh.getVerticesData(B.VertexBuffer.PositionKind),original=mesh.getVerticesData(B.VertexBuffer.NormalKind),indices=mesh.getIndices();if(!positions||!original||!indices)return null;
  var saved=original.slice(),calculated=[];B.VertexData.ComputeNormals(positions,indices,calculated);
  var min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(var i=0;i<positions.length;i++) {var axis=i%3;min[axis]=Math.min(min[axis],positions[i]);max[axis]=Math.max(max[axis],positions[i]);}
  var epsilon=Math.max(1e-8,Math.max(max[0]-min[0],max[1]-min[1],max[2]-min[2])*1e-6),groups=new Map(),keys=[];
  for(var i=0;i<positions.length;i+=3){var key=Math.round(positions[i]/epsilon)+','+Math.round(positions[i+1]/epsilon)+','+Math.round(positions[i+2]/epsilon);keys[i/3]=key;var group=groups.get(key);if(!group){group=[];groups.set(key,group);}group.push(i);}
  var smooth=new Float32Array(original.length);
  for(var i=0;i<saved.length;i+=3){var group=groups.get(keys[i/3]),x=0,y=0,z=0;
   for(var j=0;j<group.length;j++){var k=group[j],dot=saved[i]*saved[k]+saved[i+1]*saved[k+1]+saved[i+2]*saved[k+2];if(dot<.5)continue;x+=calculated[k];y+=calculated[k+1];z+=calculated[k+2];}
   var length=Math.hypot(x,y,z);smooth[i]=length>1e-8?x/length:saved[i];smooth[i+1]=length>1e-8?y/length:saved[i+1];smooth[i+2]=length>1e-8?z/length:saved[i+2];
  }
  return {original:saved,smooth:smooth,amount:0,updatable:false};
 }
 P.applySurfaceSmoothing=function(){
  var amount=Math.max(0,Math.min(1,Number(this.getMaterialParams().surfaceSmooth)||0)),cache=this._surfaceNormalCache||(this._surfaceNormalCache=new WeakMap()),meshes=[];
  if(this.modelRoot)this.modelRoot.getChildMeshes().forEach(function(m){meshes.push(m);});this.sceneObjects.forEach(function(o){o.meshes.forEach(function(m){meshes.push(m);});});
  meshes.forEach(function(mesh){if(!mesh||mesh.isDisposed()||!mesh.getTotalVertices())return;var data=cache.get(mesh);if(!data&&amount>0){data=prepare(mesh);if(data)cache.set(mesh,data);}if(!data||data.amount===amount)return;
   var values=new Float32Array(data.original.length);for(var i=0;i<values.length;i+=3){var x=data.original[i]*(1-amount)+data.smooth[i]*amount,y=data.original[i+1]*(1-amount)+data.smooth[i+1]*amount,z=data.original[i+2]*(1-amount)+data.smooth[i+2]*amount,length=Math.hypot(x,y,z)||1;values[i]=x/length;values[i+1]=y/length;values[i+2]=z/length;}
   if(amount===0)values=data.original.slice();
   if(!data.updatable){mesh.makeGeometryUnique();mesh.setVerticesData(B.VertexBuffer.NormalKind,values,true);data.updatable=true;}else mesh.updateVerticesData(B.VertexBuffer.NormalKind,values);
   data.amount=amount;
  });
 };
 P._updateMaterial=function(){update.call(this);if(!this.modelRoot&&!this.sceneObjects.length)return;var self=this;if(this._normalUpdateQueued)return;this._normalUpdateQueued=true;requestAnimationFrame(function(){self._normalUpdateQueued=false;self.applySurfaceSmoothing();});};
})(window);
