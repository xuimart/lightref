// Browser QA only: Node filesystem and CEP are in-memory stand-ins.
window.__uiErrors=[];window.addEventListener('error',function(e){__uiErrors.push(e.message)});
(function(){
 const files=new Map(),dirs=new Set(['/inspection','/inspection/LightRef']);
 const normalize=p=>String(p).replace(/\\/g,'/').replace(/\/+/g,'/');
 const path={join:(...p)=>normalize(p.join('/')),dirname:p=>normalize(p).replace(/\/[^/]*$/,''),basename:p=>normalize(p).split('/').pop(),extname:p=>'.'+normalize(p).split('.').pop(),resolve:(...p)=>normalize(p.join('/')),sep:'/'};
 files.set('/inspection/LightRef/config.json',JSON.stringify({language:'pt',lastModel:'models/asaro.obj',onboardingCompleted:true}));
 const fs={existsSync:p=>files.has(normalize(p))||dirs.has(normalize(p)),mkdirSync:p=>dirs.add(normalize(p)),readFileSync:p=>{const v=files.get(normalize(p));if(v===undefined)throw Error('ENOENT: '+p);return v;},writeFileSync:(p,v)=>files.set(normalize(p),String(v)),renameSync:(a,b)=>{files.set(normalize(b),files.get(normalize(a)));files.delete(normalize(a));},readdirSync:()=>[],statSync:()=>({isDirectory:()=>false,isFile:()=>true,size:100}),unlinkSync:p=>files.delete(normalize(p)),copyFileSync:()=>{throw Error('Not part of UI fixture')}};
 window.require=n=>{if(n==='https')return {get:()=>{const req={on:(type,fn)=>{if(type==='error')setTimeout(()=>fn(Error('QA offline')),0);return req},setTimeout:()=>req,destroy:()=>{}};return req}};if(n==='fs')return fs;if(n==='path')return path;if(n==='os')return {homedir:()=>'/inspection'};throw Error('Unsupported fixture module: '+n)};
 window.process={env:{APPDATA:'/inspection'},platform:'win32',versions:{node:'16.0.0'}};
 window.__adobe_cep__={getHostEnvironment:()=>JSON.stringify({appName:'PHXS',appId:'PHXS',appVersion:'26.11',appLocale:'en_US',appUILocale:'en_US',appSkinInfo:{panelBackgroundColor:{color:{red:50,green:50,blue:50}}}}),getExtensionId:()=> 'com.lightref.panel',getSystemPath:()=>'/inspection/extension',evalScript:(code,cb)=>setTimeout(()=>cb(code.includes('SessionToken')?'qa-session':'OK'),5),dispatchEvent:()=>{},addEventListener:()=>{},removeEventListener:()=>{},getHostCapabilities:()=>JSON.stringify({}),requestOpenExtension:()=>{},closeExtension:()=>{}};
})();
