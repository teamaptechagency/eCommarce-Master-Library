import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { root, sites } from './sites.mjs';
import { reactRoutes } from './react-routes.mjs';
import { Installer } from './installer.mjs';
import {adminPortalRoutes} from './admin-discovery.mjs';

const port = Number(process.env.MASTER_PORT || 8090);
const data = path.join(root,'data');
fs.mkdirSync(data,{recursive:true});
const secret = crypto.randomBytes(32).toString('hex');
fs.writeFileSync(path.join(data,'runtime.json'), JSON.stringify({secret, sites}));
const state = new Map(sites.map(s=>[s.id,{status:s.blocked?'blocked':'starting',title:s.subtitle,detail:s.blocked||'Starting local preview…'}]));
const children = [];
const csrf = crypto.randomBytes(32).toString('hex');
function syncRuntime(){
  fs.writeFileSync(path.join(data,'runtime.json'),JSON.stringify({secret,sites}));
  for(const site of sites)if(site.managedUpload)state.set(site.id,{status:site.blocked?(site.installState==='running'?'starting':'blocked'):'online',title:site.subtitle,detail:site.blocked||'Installed from ZIP'});
}
async function startUploaded(site){
  if(await listening(site.port)){
    let health;try{health=await(await fetch(`http://127.0.0.1:${site.port}/__master/health`,{headers:{'X-Master-Library':secret},signal:AbortSignal.timeout(3000)})).json()}catch{throw Error('Cannot verify the preview using this port. Stop it before restarting this installation.');}
    if(path.resolve(health.source||'')!==path.resolve(site.app))throw Error('Preview port belongs to another application.');
    const expected=site.kind==='react-demo'?'master-react-source':site.kind==='uploaded-static'?'master-uploaded-static':'master-uploaded-php';
    if(health.application===expected)return;
    if(site.kind!=='react-demo'||health.application!=='master-uploaded-static')throw Error('Unknown preview process. Restart this uploaded preview.');
    await stopUploaded(site);
  }
  if(site.kind==='react-demo')launch(process.execPath,[path.join(root,'react-server.mjs')],site.app,site.id,{MASTER_LIBRARY_ROOT:root,MASTER_REACT_PORT:String(site.port),MASTER_REACT_APP:site.app});
  else if(site.kind==='uploaded-static')launch(process.execPath,[path.join(root,'uploaded-server.mjs')],site.app,site.id,{MASTER_LIBRARY_ROOT:root,MASTER_UPLOAD_APP:site.app,MASTER_UPLOAD_PORT:String(site.port),MASTER_UPLOAD_PUBLIC:site.publicDir,MASTER_UPLOAD_SPA:String(site.spa)});
  else {
    const token=crypto.randomBytes(32).toString('hex');
    const child=launch(site.php,['-S','127.0.0.1:'+site.port,'-t',site.publicDir,path.join(root,'uploaded-router.php')],site.app,site.id,{MASTER_LIBRARY_ROOT:root,MASTER_PREVIEW_TOKEN:token,MASTER_UPLOAD_APP:site.app,MASTER_UPLOAD_PUBLIC:site.publicDir,MASTER_UPLOAD_PORT:String(site.port)});
    fs.writeFileSync(workerRecord(site),JSON.stringify({pid:child.pid,app:site.app,port:site.port,token}));
  }
}
function workerRecord(site){if(!/^[a-z0-9-]+$/i.test(site.id))throw Error('Invalid preview ID');return path.join(data,'worker-'+site.id+'.json');}
async function stopUploaded(site){
  if(!site.port||!await listening(site.port))return;
  let health;try{health=await(await fetch(`http://127.0.0.1:${site.port}/__master/health`,{headers:{'X-Master-Library':secret},signal:AbortSignal.timeout(3000)})).json()}catch{throw Error('Cannot verify this preview process. Stop its local server and retry.');}
  if(path.resolve(health.source||'')!==path.resolve(site.app))throw Error('Preview port belongs to another application.');
  if(['master-react-source','master-uploaded-static'].includes(health.application)){
    const response=await fetch(`http://127.0.0.1:${site.port}/__master/shutdown`,{method:'POST',headers:{'X-Master-Library':secret},signal:AbortSignal.timeout(3000)});if(!response.ok)throw Error('Could not stop the preview.');await response.body?.cancel();
    // Older previews do not report a PID; their shutdown fallback exits in 500ms.
    if(!Number.isInteger(health.pid))await wait(800);
  }else if(health.application==='master-uploaded-php'){
    const recordFile=workerRecord(site);if(!fs.existsSync(recordFile))throw Error('Restart this PHP preview before deleting it.');
    const record=JSON.parse(fs.readFileSync(recordFile,'utf8')),signature=crypto.createHmac('sha256',record.token).update(health.pid+'|'+health.source+'|'+health.port).digest('hex');
    if(!Number.isInteger(record.pid)||record.pid===process.pid||record.pid!==health.pid||record.port!==site.port||path.resolve(record.app)!==path.resolve(site.app)||signature!==health.signature)throw Error('PHP preview ownership could not be verified.');
    process.kill(record.pid);
  }else throw Error('Unknown preview process. No files were moved.');
  const processAlive=()=>{if(!Number.isInteger(health.pid))return false;try{process.kill(health.pid,0);return true}catch{return false}};
  for(let attempt=0;attempt<30;attempt++){if(!await listening(site.port)&&!processAlive())return;await wait(100);}
  throw Error('Preview is still running. No files were moved.');
}
let startupDone = false;
const listening = p => new Promise(resolve=>{ const s=net.connect({host:'127.0.0.1',port:p}); s.setTimeout(700); s.once('connect',()=>{s.destroy();resolve(true)}); s.once('error',()=>resolve(false)); s.once('timeout',()=>{s.destroy();resolve(false)}); });
const wait = ms => new Promise(r=>setTimeout(r,ms));
function launch(exe,args,cwd,label,env={}) {
  const log=fs.openSync(path.join(data,label+'.log'),'a');
  const child=spawn(exe,args,{cwd,env:{...process.env,...env},windowsHide:true,stdio:['ignore',log,log]});
  fs.closeSync(log);
  children.push(child);
  child.on('error',e=>console.error(label,e.message));
  return child;
}
async function database(p,exe,args) {
  if(await listening(p)) return;
  if(!fs.existsSync(exe)) { console.error('Database runtime missing:',exe); return; }
  launch(exe,args,path.dirname(exe),'database-'+p);
  for(let i=0;i<30;i++) { if(await listening(p))return; await wait(500); }
}
async function exportRoutes(site) {
  if(site.managedUpload){fs.writeFileSync(path.join(data,site.id+'-routes.json'),JSON.stringify(adminPortalRoutes(site)));return;}
  if(site.kind==='react-demo'){fs.writeFileSync(path.join(data,site.id+'-routes.json'),JSON.stringify(reactRoutes()));return;}
  for(let attempt=0;attempt<3;attempt++)try {
    const response=await fetch(`http://127.0.0.1:${site.port}/__master/routes`,{headers:{'X-Master-Library':secret},signal:AbortSignal.timeout(30000)});
    if(!response.ok)throw Error('HTTP '+response.status);
    let rows=await response.json();
    rows=rows.concat(clientRoutes(site));
    rows=[...new Map(rows.map(r=>[r.path,r])).values()].sort((a,b)=>a.access.localeCompare(b.access)||a.path.localeCompare(b.path));
    fs.writeFileSync(path.join(data,site.id+'-routes.json'),JSON.stringify(rows));
    return;
  } catch(e) { if(attempt===2)console.error('Route discovery failed:',site.id,e.message,e.cause?.message||'');else await wait(700); }
}
function clientRoutes(site) {
  const rows=[];
  let files=[];
  if(site.kind==='shopperzz'){
    const dir=path.join(site.app,'resources/js/router/modules');
    files=[path.join(site.app,'resources/js/router/index.js'),...fs.readdirSync(dir).filter(f=>f.endsWith('.js')).map(f=>path.join(dir,f))];
  }
  if(site.kind==='sohag'){
    const dir=path.join(site.app,'public/assets');
    files=fs.readdirSync(dir).filter(f=>/^(index-|AdminLayout-|Admin-|Dashboard-).*\.js$/.test(f)).map(f=>path.join(dir,f));
  }
  for(const file of files){
    const source=fs.readFileSync(file,'utf8');
    if(site.kind==='sohag'&&path.basename(file).startsWith('Dashboard-')){
      rows.push({path:'/admin',name:'admin.dashboard',label:'Dashboard',access:'admin',parameterized:false});
      for(const match of source.matchAll(/\bS===`([a-z_]+)`/g)){
        rows.push({path:'/admin?tab='+match[1],name:'admin.'+match[1],label:match[1].replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()),access:'admin',parameterized:false});
      }
    }
    for(const match of source.matchAll(/\bpath\s*:\s*["'`]([^"'`]+)["'`]/g)){
      let uri=match[1];
      if(uri.includes('*')||/login|logout|install|success|callback|exception|notfound|forget|reset/i.test(uri))continue;
      if(!uri.startsWith('/')){
        if(site.kind==='sohag') uri='/admin/'+uri;
        else continue;
      }
      uri=uri.replace(/:([\w]+)(\?)?/g,(_,name,optional)=>'{'+name+(optional?'?':'')+'}');
      rows.push({path:uri,name:uri.slice(1).replace(/\//g,'.')||'home',access:/^\/(admin|builder|license-portal)/.test(uri)?'admin':'public',parameterized:uri.includes('{')});
    }
  }
  return rows;
}
async function startServices() {
  await Promise.all([
    database(3306,'C:/xampp/mysql/bin/mysqld.exe',['--defaults-file=C:/xampp/mysql/bin/my.ini','--standalone','--bind-address=127.0.0.1']),
    database(3308,'E:/kris_deepler/wpress/runtime/mariadb-package/mariadb-11.8.9-winx64/bin/mariadbd.exe',['--defaults-file=E:/Tawhid/runtime/database/my.ini','--bind-address=127.0.0.1','--port=3308'])
  ]);
  const startedReactPorts=new Set();
  for(const site of sites.filter(s=>!s.blocked)) {
    if(site.managedUpload){await startUploaded(site);continue;}
    if(site.kind==='react-demo'){
      if(startedReactPorts.has(site.port))continue;startedReactPorts.add(site.port);
      if(!fs.existsSync(path.join(site.app,'dist/index.html'))){state.set(site.id,{status:'error',title:site.subtitle,detail:'Imported source needs its local Vite build.'});continue;}
      if(!await listening(site.port))launch(process.execPath,[path.join(root,'react-server.mjs')],site.app,'react-'+site.port,{MASTER_REACT_PORT:String(site.port),MASTER_REACT_APP:site.app});
      continue;
    }
    if(!fs.existsSync(site.app)||!fs.existsSync(site.php)) { state.set(site.id,{status:'error',title:site.subtitle,detail:'Application or PHP runtime is missing.'});continue; }
    if(!await listening(site.port)) {
      const docroot=fs.existsSync(path.join(site.app,'public/index.php'))?path.join(site.app,'public'):site.app;
      launch(site.php,['-S','127.0.0.1:'+site.port,'-t',docroot,path.join(root,'router.php')],site.app,site.id,{
        MASTER_SITE_ID:site.id, MASTER_LIBRARY_ROOT:root, APP_URL:'http://127.0.0.1:'+site.port,
        SESSION_COOKIE:'master_'+site.id+'_session',SESSION_DOMAIN:'',SESSION_SECURE_COOKIE:'false'
      });
    }
  }
  for(const job of installer.jobs.filter(j=>j.status==='setup'&&j.nativeSetup&&j.progress>=85))await startUploaded(sites.find(s=>s.id===job.siteId));
  await Promise.all(sites.filter(s=>!s.blocked).map(exportRoutes));
  startupDone=true;
  await refresh();
}
let checking;
async function refresh() {
  if(checking)return checking;
  checking=Promise.all(sites.filter(s=>!s.blocked).map(async site=>{
    try {
      const response=await fetch('http://127.0.0.1:'+site.port,{signal:AbortSignal.timeout(12000)});
      const html=await response.text();
      const title=(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||site.subtitle).replace(/\s+/g,' ').replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"').trim();
      state.set(site.id,{status:response.ok?'online':'error',title,detail:response.ok?'Public portal is ready':'Homepage returned HTTP '+response.status,checkedAt:new Date().toISOString()});
    }catch(e){state.set(site.id,{status:startupDone?'offline':'starting',title:site.subtitle,detail:startupDone?'Preview is not responding. Check the local service log.':'Starting local preview…'});}
  })).finally(()=>checking=null);
  return checking;
}
const installer=new Installer({root,sites,startSite:startUploaded,stopSite:stopUploaded,onChange:syncRuntime});
syncRuntime();
function catalog(){return sites.map(s=>({id:s.id,name:s.name,subtitle:s.subtitle,initials:s.initials,color:s.color,category:s.category,description:s.description,features:s.features,source:s.source,blocked:s.blocked,admin:s.admin,setupId:s.setupId,managedUpload:s.managedUpload,installState:s.installState,demoSupported:s.demoSupported!==false,duplicateCount:s.duplicateCount,archiveHash:s.archiveHash,url:s.port?'http://127.0.0.1:'+s.port:null,...state.get(s.id)}));}
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml'};
function send(res,status,body,type='application/json; charset=utf-8') { res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'});res.end(type.startsWith('application/json')?JSON.stringify(body):body); }
const server=http.createServer(async(req,res)=>{
  try {
    if(!['127.0.0.1:'+port,'localhost:'+port].includes(req.headers.host))return send(res,403,{error:'Local host only'});
    const url=new URL(req.url,'http://127.0.0.1:'+port);
    if(url.pathname==='/api/installer'&&req.method==='GET')return send(res,200,{csrf,installations:installer.list(),trash:installer.trashList(),maxZipMB:512});
    if(url.pathname.startsWith('/api/installations')&&req.method==='POST'){
      if(req.headers['x-master-csrf']!==csrf||req.headers.origin!==`http://${req.headers.host}`||req.headers['sec-fetch-site']==='cross-site')return send(res,403,{error:'Open installation from this local library.'});
      try{
        const action=url.pathname.slice('/api/installations/'.length);
        if(action==='upload')return send(res,202,await installer.upload(req,{filename:decodeURIComponent(req.headers['x-file-name']||''),name:url.searchParams.get('name'),replaceSiteId:url.searchParams.get('replace')}));
        if(action.startsWith('sql/'))return send(res,200,await installer.sql(action.slice(4),req));
        let bytes=0,body='';for await(const chunk of req){bytes+=chunk.length;if(bytes>65536)throw Error('Setup request is too large.');body+=chunk;}
        const config=JSON.parse(body||'{}');
        if(action==='adopt')return send(res,202,await installer.adopt(config.siteId));
        if(action.startsWith('trash/'))return send(res,200,await installer.trashInstallation(action.slice(6)));
        if(action.startsWith('restore/'))return send(res,200,await installer.restoreInstallation(action.slice(8)));
        if(action.startsWith('admin/'))return send(res,202,await installer.enableAdmin(action.slice(6)));
        if(action.startsWith('setup/'))return send(res,202,await installer.setup(action.slice(6),config));
        if(action.startsWith('check/'))return send(res,200,await installer.check(action.slice(6)));
        return send(res,404,{error:'Unknown installation action.'});
      }catch(e){return send(res,400,{error:e.message});}
    }
    if(req.method!=='GET')return send(res,405,{error:'Method not allowed'});
    if(url.pathname==='/api/sites')return send(res,200,catalog());
    if(url.pathname==='/api/refresh'){await Promise.all(sites.filter(s=>!s.blocked).map(exportRoutes));await refresh();return send(res,200,catalog());}
    if(url.pathname.startsWith('/api/routes/')){
      const id=url.pathname.split('/').pop();if(!sites.some(s=>s.id===id))return send(res,404,{error:'Unknown site'});
      const site=sites.find(s=>s.id===id);if(site.managedUpload)return send(res,200,adminPortalRoutes(site));
      const file=path.join(data,id+'-routes.json');return send(res,200,fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):[]);
    }
    if(url.pathname.startsWith('/demo/')){
      if(req.headers['sec-fetch-site']==='cross-site')return send(res,403,{error:'Open demo login from the master library.'});
      const site=sites.find(s=>s.id===url.pathname.split('/')[2]);
      if(!site||site.blocked||site.demoSupported===false)return send(res,409,{error:site?.blocked||'This uploaded source uses its own admin login. Open Admin portal.'});
      const target=url.searchParams.get('next')||site.admin;
      if(!target.startsWith('/')||target.startsWith('//')||/[\r\n\\]/.test(target)||target.includes('://'))return send(res,400,{error:'Invalid local path'});
      const expires=Math.floor(Date.now()/1000)+60;
      const signature=crypto.createHmac('sha256',secret).update(site.id+'|'+expires+'|'+target).digest('hex');
      res.writeHead(302,{'Location':`http://127.0.0.1:${site.port}/__master/demo-login?${new URLSearchParams({site:site.id,expires:String(expires),next:target,signature})}`,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});return res.end();
    }
    const files={'/':'index.html','/app.js':'app.js','/installer-ui.js':'installer-ui.js','/cloud-library.js':'cloud-library.js','/styles.css':'styles.css'};
    const file=files[url.pathname];
    if(!file)return send(res,404,{error:'Not found'});
    send(res,200,fs.readFileSync(path.join(root,'public',file)),mime[path.extname(file)]);
  }catch(e){console.error(e);send(res,500,{error:'Local library request failed.'});}
});
server.listen(port,'127.0.0.1',()=>{console.log(`Master Library: http://127.0.0.1:${port}`);startServices().catch(console.error);});
setInterval(()=>refresh(),30000).unref();
function stop(){for(const child of children){try{child.kill()}catch{}}server.close(()=>process.exit());}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
