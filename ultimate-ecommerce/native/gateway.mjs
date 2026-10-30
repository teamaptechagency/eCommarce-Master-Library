import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import net from 'node:net';import {spawn} from 'node:child_process';
import {root,sources} from './sources.mjs';import {createStore} from '../store.mjs';import {resolveAppearance} from '../appearance.mjs';import {writeSnapshot} from './snapshot.mjs';import {importChanges} from './import-changes.mjs';import {paletteCss} from './palette.mjs';
const store=createStore(path.join(root,'data/ultimate.sqlite'));const secret=crypto.randomBytes(32).toString('hex');const data=path.join(root,'data');
const registry=JSON.parse(fs.readFileSync(path.join(data,'native-sources.json'),'utf8'));
fs.writeFileSync(path.join(data,'native-runtime.json'),JSON.stringify({secret,sources:registry}));
const children=[];const ready=new Set();let startupError=null;let queue=Promise.resolve();
const exclusive=fn=>{const work=queue.then(fn,fn);queue=work.catch(()=>{});return work;};
const appearance=()=>resolveAppearance(store.setting('appearance'),store.setting('store',{}).theme);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function launch(exe,args,cwd,label,env={}){const fd=fs.openSync(path.join(data,label+'.log'),'a');const child=spawn(exe,args,{cwd,env:{...process.env,...env},windowsHide:true,stdio:['ignore',fd,fd]});fs.closeSync(fd);children.push(child);child.on('error',e=>console.error(label,e.message));return child;}
const listening=port=>new Promise(resolve=>{const c=net.connect({host:'127.0.0.1',port});c.setTimeout(500);c.once('connect',()=>{c.destroy();resolve(true)});c.once('error',()=>resolve(false));c.once('timeout',()=>{c.destroy();resolve(false)});});
async function database(port,exe,args){if(await listening(port))return;launch(exe,args,path.dirname(exe),'native-database-'+port);for(let i=0;i<30;i++){if(await listening(port))return;await wait(400)}throw Error('Database '+port+' did not start');}
function php(source,script,args=[]){return new Promise((resolve,reject)=>{let stdout='',stderr='';const child=spawn(source.php,[path.join(root,'native',script),source.id,...args],{cwd:root,windowsHide:true});child.stdout.on('data',d=>stdout+=d);child.stderr.on('data',d=>stderr+=d);child.on('error',reject);child.on('exit',code=>code?reject(Error(source.id+' '+script+': '+stderr+stdout)):resolve(stdout));});}
async function project(source,force=false){const result=await php(source,'project.php',force?['--force']:[]);if(!result.includes(source.id+': current')&&!result.includes(source.id+': shared catalog'))throw Error(result);}
async function start(){
 await database(3306,'C:/xampp/mysql/bin/mysqld.exe',['--defaults-file=C:/xampp/mysql/bin/my.ini','--standalone','--bind-address=127.0.0.1']);
 await database(3308,'E:/kris_deepler/wpress/runtime/mariadb-package/mariadb-11.8.9-winx64/bin/mariadbd.exe',['--defaults-file=E:/Tawhid/runtime/database/my.ini','--bind-address=127.0.0.1','--port=3308']);
 writeSnapshot(store,root);
 if(!await listening(8201))launch(process.execPath,[path.join(root,'server.mjs')],root,'control',{PORT:'8201'});
 for(const source of registry){
  const result=await php(source,'clone-database.php');if(!result.includes('owned projection already exists')&&!result.includes('cloned schema'))throw Error(result);
  await project(source);
  if(!await listening(source.port)){const docroot=fs.existsSync(path.join(source.engine,'public/index.php'))?path.join(source.engine,'public'):source.engine;launch(source.php,['-S','127.0.0.1:'+source.port,'-t',docroot,path.join(root,'native/router.php')],source.engine,'native-'+source.id,{ULTIMATE_SOURCE_ID:source.id,APP_URL:'http://127.0.0.1:8200',SESSION_COOKIE:'ultimate_native_'+source.id,SESSION_DOMAIN:'',SESSION_SECURE_COOKIE:'false'});}
  for(let i=0;i<25;i++){try{const health=await fetch(`http://127.0.0.1:${source.port}/__native/health`);if((await health.json()).source===source.id){ready.add(source.id);break}}catch{}await wait(200)}
  if(!ready.has(source.id))throw Error(source.id+' native engine failed to start');
  console.log(source.id+': original source engine ready');
 }
}
function send(res,status,data,type='application/json; charset=utf-8'){res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(type.startsWith('application/json')?JSON.stringify(data):data);}
function targetFor(req,url){
 let side=/^\/(admin|backend|builder|license-portal)(\/|$)/.test(url.pathname)?'backend':'frontend';
 if(/^\/(api|ajax|vendor|storage|themes|css|js)\//.test(url.pathname)&&req.headers.referer){try{if(/^\/(admin|backend|builder)/.test(new URL(req.headers.referer).pathname))side='backend';}catch{}}
 if(/^\/api\/(admin|backend)\//.test(url.pathname))side='backend';if(/^\/api\/frontend\//.test(url.pathname))side='frontend';
 const a=appearance();const id=a[side].layout==='astrallab'?'nest':a[side].layout;return {source:registry.find(s=>s.id===id)||registry[0],side};
}
function signedDemo(source,next=source.admin){const expires=Math.floor(Date.now()/1000)+60;const signature=crypto.createHmac('sha256',secret).update(source.id+'|'+expires+'|'+next).digest('hex');return '/__ultimate/engine/'+source.id+'/__native/demo-login?'+new URLSearchParams({expires:String(expires),signature,next});}
const demoMarker=source=>crypto.createHmac('sha256',secret).update('demo|'+source.id).digest('hex');
const assetPath=p=>/\.(?:css|js|png|jpe?g|webp|gif|svg|ico|woff2?|ttf|eot|avif|map|json|mp4|webm|pdf)(?:[?#]|$)/i.test(p);
export function rewriteAssets(content,id,type){
 const prefix='/__ultimate/engine/'+id;
 const local=value=>{if(value.startsWith('/__ultimate/'))return value;let p=value;if(/^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?\//.test(p))p=p.replace(/^https?:\/\/[^/]+/,'');if(p.startsWith('/')&&!p.startsWith('//')&&assetPath(p))return prefix+p;return value;};
 if(type.includes('text/html'))content=content.replace(/\b(src|href|poster)=(['"])(.*?)\2/gi,(m,key,q,value)=>key+'='+q+local(value)+q).replace(/\bsrcset=(['"])(.*?)\1/gi,(m,q,value)=>'srcset='+q+value.split(',').map(part=>part.replace(/^(\s*)(\S+)/,(_,space,url)=>space+local(url))).join(',')+q);
 if(type.includes('css')||type.includes('html'))content=content.replace(/url\(\s*(['"]?)([^)'"\s]+)\1\s*\)/g,(m,q,value)=>'url('+q+local(value)+q+')');
 if(type.includes('javascript'))content=content.replace(/(['"])(\/(?:assets|js|css|themes|vendor|images|fonts)\/[^'"\s]+)\1/g,(m,q,value)=>q+local(value)+q);
 return content;
}
async function proxy(req,res,source,side,route){
 const dynamic=!assetPath(route.split('?')[0]);
 if(dynamic){writeSnapshot(store,root);await project(source);}
 const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=Buffer.concat(chunks);
 const headers={...req.headers,host:'127.0.0.1:'+source.port,'accept-encoding':'identity'};delete headers.connection;delete headers['content-length'];
 const upstream=await new Promise((resolve,reject)=>{const r=http.request({hostname:'127.0.0.1',port:source.port,path:route,method:req.method,headers},u=>{const chunks=[];u.on('data',c=>chunks.push(c));u.on('end',()=>resolve({status:u.statusCode,headers:u.headers,body:Buffer.concat(chunks)}));});r.on('error',reject);r.setTimeout(60000,()=>r.destroy(Error('Native source timeout')));r.end(body);});
 const mayWrite=!['GET','HEAD','OPTIONS'].includes(req.method)||(side==='backend'&&req.method==='GET'&&!route.startsWith('/__native/'))||/(?:toggle|change-status|cancel|refund|publish|approve|reject)/i.test(route);
 if(dynamic&&mayWrite){
  const raw=await php(source,'capture.php');let changes;try{changes=JSON.parse(raw)}catch{throw Error('Native commerce capture failed: '+raw.slice(0,300));}
  if(changes.length){try{importChanges(store,root,source,changes);writeSnapshot(store,root);await project(source,true);}catch(e){await project(source,true);throw e;}}
 }
 let result=upstream.body;const type=String(upstream.headers['content-type']||'');
 if(/text\/html|text\/css|javascript/.test(type)){
  let content=rewriteAssets(result.toString('utf8'),source.id,type);
  if(type.includes('text/html')&&!route.startsWith('/__native/')){
   content=content.replace(/<title[^>]*>[\s\S]*?<\/title>/i,'<title>Ultimate Ecommarce By Astrallab</title>');
   content=content.replace(/<\/head>/i,`<link rel="stylesheet" href="/__ultimate/palette.css?surface=${side}"></head>`);
   if(side==='backend')content=content.replace(/<\/body>/i,'<a href="http://127.0.0.1:8201/demo?next=/admin/themes" style="position:fixed;bottom:16px;right:16px;z-index:2147483646;padding:10px 16px;background:#202b28;color:#fff;border-radius:24px;font:13px system-ui;text-decoration:none">Layouts & colors</a></body>');
  }result=Buffer.from(content);
 }
 const output={...upstream.headers};for(const key of ['content-length','transfer-encoding','connection','content-encoding','content-security-policy'])delete output[key];
 if(route.startsWith('/__native/demo-login')&&[200,302].includes(upstream.status))output['set-cookie']=[...(output['set-cookie']||[]),'ultimate_demo_'+source.id+'='+demoMarker(source)+'; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800'];
 if(output.location){output.location=output.location.replace(new RegExp('https?://(?:127\\.0\\.0\\.1|localhost):'+source.port),'http://127.0.0.1:8200');if(output.location.includes('/__native/'))output.location=output.location.replace('http://127.0.0.1:8200','')&&'/__ultimate/engine/'+source.id+output.location.replace(/^http:\/\/127\.0\.0\.1:8200/,'');}
 output['cache-control']='no-store';res.writeHead(upstream.status,output);res.end(result);
}
const server=http.createServer(async(req,res)=>{try{
 if(!['127.0.0.1:8200','localhost:8200'].includes(req.headers.host))return send(res,403,{error:'Local host only'});
 const url=new URL(req.url,'http://127.0.0.1:8200');
 if(url.pathname==='/api/health'||url.pathname==='/__ultimate/health')return send(res,startupError?503:200,{application:'astrallab-ultimate',status:startupError?'error':ready.size===registry.length?'ok':'starting',sources:[...ready],error:startupError});
 if(url.pathname==='/__ultimate/palette.css')return send(res,200,paletteCss(appearance(),url.searchParams.get('surface')==='backend'?'backend':'frontend'),'text/css; charset=utf-8');
 if(url.pathname==='/__ultimate/logo.svg')return send(res,200,fs.readFileSync(path.join(root,'public/assets/astrallab-logo.svg')),'image/svg+xml');
 if(url.pathname.startsWith('/__ultimate/control')){res.writeHead(302,{Location:'http://127.0.0.1:8201/demo'});return res.end();}
 if(url.pathname.startsWith('/assets/product-')){const match=url.pathname.match(/^\/assets\/product-(\d+)(?:-\d+x\d+)?\.png$/);const file=match&&path.join(root,'public/assets/product-'+match[1]+'.png');if(!file||!fs.existsSync(file))return send(res,404,{error:'Image not found'});res.writeHead(200,{'Content-Type':'image/png'});return res.end(fs.readFileSync(file));}
 const match=url.pathname.match(/^\/__ultimate\/engine\/([a-z]+)(\/.*)$/);const selected=targetFor(req,url);const source=match?registry.find(s=>s.id===match[1]):selected.source;const route=match?match[2]+url.search:url.pathname+url.search;
 if(!source)return send(res,404,{error:'Unknown source'});
 if(!ready.has(source.id))return send(res,503,'<h1>Ultimate Ecommarce By Astrallab</h1><p>The original source engines are starting. Refresh in a few seconds.</p>','text/html; charset=utf-8');
 if(url.pathname==='/demo'||(!match&&selected.side==='backend'&&!(req.headers.cookie||'').includes('ultimate_demo_'+source.id+'='+demoMarker(source)))){if(req.headers['sec-fetch-site']==='cross-site')return send(res,403,{error:'Open demo login from the local platform'});const adminSource=registry.find(s=>s.id===appearance().backend.layout)||source;res.writeHead(302,{Location:signedDemo(adminSource), 'Cache-Control':'no-store'});return res.end();}
 const operation=()=>proxy(req,res,source,selected.side,route);
 if(assetPath(route.split('?')[0]))await operation();else await exclusive(operation);
}catch(e){console.error(e);if(!res.headersSent)send(res,500,{error:'The source integration could not complete this request',detail:e.message.slice(0,600)});else res.end();}});
server.listen(8200,'127.0.0.1',()=>{console.log('Ultimate Ecommarce By Astrallab — original source gateway: http://127.0.0.1:8200');exclusive(start).catch(e=>{startupError=e.message;console.error(e)});});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{for(const child of children)child.kill();server.close(()=>process.exit(0));});
