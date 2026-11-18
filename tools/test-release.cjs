const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert'),{EventEmitter}=require('events');
const root=path.resolve(__dirname,'..'),plugin=path.join(root,'com.lightref.cep'),source=fs.readFileSync(path.join(plugin,'js/update.js'),'utf8'),tests=[];
function check(name,fn){fn();tests.push({name,pass:true});}
async function update(options={}){
 const banners=[],toasts=[],opened=[],requests=[],host={appendChild(el){banners.push(el)},removeChild(){}};
 function element(){const nodes={};return {innerHTML:'',querySelector(sel){return nodes[sel]||(nodes[sel]={textContent:'',addEventListener(type,fn){this[type]=fn}})}};}
 const https={get(url,callback){requests.push(url);const request=new EventEmitter();request.setTimeout=()=>request;request.destroy=()=>{};
  setImmediate(()=>{let response=url.includes('xuimart.com.br')?options.site:options.release;
   if(url.includes('objects.example'))response=options.redirectBody;
   if(response instanceof Error){request.emit('error',response);return;}
   if(response===undefined)response={version:'1.0.0'};
   const res=new EventEmitter();res.statusCode=response.redirect?302:200;res.headers={location:response.redirect};res.resume=()=>{};callback(res);
   res.emit('data',response.raw!==undefined?response.raw:JSON.stringify(response));res.emit('end');
  });return request;}};
 const context={require:n=>{assert.equal(n,'https');return https},document:{createElement:element,getElementById:id=>id==='lr04'?host:null,body:host},LightRefToast:t=>toasts.push(t),CSInterface:function(){this.openURLInDefaultBrowser=url=>opened.push(url)},console};
 vm.runInNewContext(source,context);context.LightRefUpdate.check(!!options.manual);await new Promise(r=>setTimeout(r,20));
 return {api:context.LightRefUpdate,banners,toasts,opened,requests};
}
(async()=>{
 const version=JSON.parse(fs.readFileSync(path.join(root,'version.json'))),manifest=fs.readFileSync(path.join(plugin,'CSXS/manifest.xml'),'utf8');
 check('stable_official_identity',()=>{assert(manifest.includes('ExtensionBundleId="com.lightref"'));assert(manifest.includes('Id="com.lightref.panel"'));assert(!manifest.includes('arttest'));assert(manifest.includes('ExtensionBundleVersion="'+version.version+'"'));});
 check('previous_host_range_retained',()=>{assert(manifest.includes('[19.0,99.9]'));assert(manifest.includes('Name="CSXS" Version="6.0"'));});
 check('original_data_and_host_bridge',()=>{for(const name of ['storage.js','to-photoshop.js','diag.js']){const s=fs.readFileSync(path.join(plugin,'js',name),'utf8');assert(!s.includes('LightRefArtTest'));}assert(fs.readFileSync(path.join(plugin,'js/storage.js'),'utf8').includes("path.join(base, 'LightRef')"));assert(fs.readFileSync(path.join(plugin,'init.jsx'),'utf8').includes('function lightrefSessionToken()'));assert(fs.readFileSync(path.join(plugin,'js/session.js'),'utf8').includes("evalScript('lightrefSessionToken()'"));});
 let r=await update();check('compiled_version_matches_release',()=>assert.equal(r.api.VERSION,version.version));check('old_client_detects_official_upgrade',()=>assert.equal(r.api.decideUpdateOutcome(version.version,'0.9.1',false),'banner'));
 check('equal_version_silent',()=>assert.equal(r.banners.length+r.toasts.length,0));
 r=await update({manual:true});check('equal_version_manual_single_message',()=>assert.equal(r.toasts.length,1));
 r=await update({site:{version:'0.9.1'},release:{version:'1.1.0'}});check('github_can_advance_stale_site',()=>assert(r.banners[0].innerHTML.includes('1.1.0')));
 r=await update({site:{version:'1.2.0'},release:{version:'1.1.0'}});check('newest_valid_channel_wins',()=>assert(r.banners[0].innerHTML.includes('1.2.0')));
 r=await update({site:new Error('offline'),release:{version:'1.1.0'}});check('site_failure_keeps_release_channel',()=>assert.equal(r.banners.length,1));
 r=await update({site:{version:'0.9.1'},release:{redirect:'https://objects.example/version.json'},redirectBody:{version:'1.1.0'}});check('release_asset_redirect_followed',()=>assert.equal(r.banners.length,1));
 r=await update({site:new Error('offline'),release:new Error('offline')});check('offline_startup_silent',()=>assert.equal(r.toasts.length+r.banners.length,0));
 r=await update({manual:true,site:new Error('offline'),release:new Error('offline')});check('offline_manual_single_error',()=>assert.equal(r.toasts.length,1));
 r=await update({site:{raw:'invalid JSON'},release:{version:'1.1.0'}});check('invalid_json_does_not_block_other_channel',()=>assert.equal(r.banners.length,1));
 r=await update({site:{version:'9.9.9<script>'},release:{version:'1.0.0'}});check('malformed_remote_version_ignored',()=>assert.equal(r.banners.length,0));
 r=await update({site:{version:'1.1.0',downloadUrl:'javascript:bad()'},release:{version:'1.0.0'}});r.banners[0].querySelector('.lf-upd-dl').click();check('download_stays_on_official_release',()=>assert.deepEqual(r.opened,['https://github.com/xuimart/lightref/releases/latest/download/LightRef_Setup.exe']));
 r=await update({site:{version:'1.0.0'},release:{redirect:'https://objects.example/version.json'},redirectBody:{redirect:'https://objects.example/version.json'}});check('redirect_loop_bounded',()=>assert(r.requests.length<=6));
 const before=fs.readFileSync(path.join(plugin,'js/art-shaders.js'));require('child_process').execFileSync(process.execPath,[path.join(__dirname,'build-shaders.cjs')]);check('shader_build_is_reproducible',()=>assert(before.equals(fs.readFileSync(path.join(plugin,'js/art-shaders.js')))));
 fs.mkdirSync(path.join(root,'qa'),{recursive:true});fs.writeFileSync(path.join(root,'qa/release-tests.json'),JSON.stringify({tests},null,2));console.log(JSON.stringify({passed:tests.length,total:tests.length},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
