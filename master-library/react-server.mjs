import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';import {newDemoData} from './new-demo-data.mjs';import {reactRoutes} from './react-routes.mjs';import {adminPortalRoutes} from './admin-discovery.mjs';
const root=process.env.MASTER_LIBRARY_ROOT||path.dirname(fileURLToPath(import.meta.url));const port=Number(process.env.MASTER_REACT_PORT);const app=path.resolve(process.env.MASTER_REACT_APP||'');const dist=path.join(app,'dist');
const runtimeFile=path.join(root,'data/runtime.json');const registeredSite=JSON.parse(fs.readFileSync(runtimeFile,'utf8')).sites.find(s=>s.kind==='react-demo'&&s.port===port&&path.resolve(s.app)===app);
if(!port||!['data/new-apps','data/installations'].some(folder=>app.startsWith(path.join(root,folder)+path.sep))||!registeredSite||!fs.existsSync(path.join(dist,'index.html')))throw Error('A registered, built imported source is required');
const sessions=new Map();const cookieName='master_react_'+port;const demoUser={id:'master-local-demo-admin',email:'demo-admin@master-library.local',full_name:'Master Library Demo Admin',role:'admin',user_metadata:{full_name:'Master Library Demo Admin'}};
const jsonScript=data=>JSON.stringify(data).replaceAll('<','\\u003c');
function send(res,status,data,type='application/json; charset=utf-8'){res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'});res.end(type.startsWith('application/json')?JSON.stringify(data):data);}
function getSession(req){const token=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.split('=')[1];const s=token&&sessions.get(token);if(s&&s.expires>Date.now())return {token,...s};return null;}
const mime={'.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.woff':'font/woff','.woff2':'font/woff2','.ico':'image/x-icon','.json':'application/json','.sql':'text/plain; charset=utf-8'};
Object.assign(mime,{'.mjs':'text/javascript; charset=utf-8','.gif':'image/gif','.avif':'image/avif','.ttf':'font/ttf','.mp4':'video/mp4','.webm':'video/webm','.pdf':'application/pdf'});
const server=http.createServer((req,res)=>{try{
 if(!['127.0.0.1:'+port,'localhost:'+port].includes(req.headers.host)||!['127.0.0.1','::1'].includes(req.socket.remoteAddress))return send(res,403,{error:'Local preview only'});
 const url=new URL(req.url,'http://127.0.0.1:'+port);const route=decodeURIComponent(url.pathname);const session=getSession(req);
 if(route==='/__master/health')return send(res,200,{application:'master-react-source',port,source:app,mode:'local-browser-demo'});
 if(route==='/__master/shutdown'&&req.method==='POST'){
  if(req.headers['x-master-library']!==JSON.parse(fs.readFileSync(runtimeFile,'utf8')).secret)return send(res,403,{error:'Forbidden'});
  send(res,200,{ok:true});server.close(()=>process.exit(0));setTimeout(()=>process.exit(0),500).unref();return;
 }
 if(route==='/__master/session')return send(res,200,{user:session?demoUser:null});
 if(route==='/__master/logout'&&req.method==='POST'){
  if(!session||req.headers['x-master-csrf']!==session.csrf)return send(res,403,{error:'Invalid local session'});
  sessions.delete(session.token);res.setHeader('Set-Cookie',cookieName+'=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');return send(res,200,{ok:true});
 }
 if(route==='/__master/demo-login'){
  if(req.headers['sec-fetch-site']==='cross-site')return send(res,403,{error:'Open demo login from Master Library'});
  const runtime=JSON.parse(fs.readFileSync(path.join(root,'data/runtime.json'),'utf8'));const id=url.searchParams.get('site');const site=runtime.sites.find(s=>s.id===id&&s.kind==='react-demo'&&s.port===port&&path.resolve(s.app)===app);
  const expires=Number(url.searchParams.get('expires'));const next=url.searchParams.get('next')||'/admin';const signature=url.searchParams.get('signature')||'';const expected=crypto.createHmac('sha256',runtime.secret).update(id+'|'+expires+'|'+next).digest('hex');
  if(!site||!Number.isFinite(expires)||expires<Date.now()/1000||expires>Date.now()/1000+90||!(/^[a-f0-9]{64}$/.test(signature))||!crypto.timingSafeEqual(Buffer.from(signature),Buffer.from(expected))||!next.startsWith('/')||next.startsWith('//')||/[\r\n\\]/.test(next)||next.includes('://'))return send(res,403,{error:'Invalid or expired demo link'});
  const token=crypto.randomBytes(32).toString('hex');sessions.set(token,{csrf:crypto.randomBytes(24).toString('hex'),expires:Date.now()+8*3600000});res.writeHead(302,{Location:next,'Set-Cookie':cookieName+'='+token+'; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800','Cache-Control':'no-store'});return res.end();
 }
 if(req.method!=='GET'&&req.method!=='HEAD')return send(res,405,{error:'This imported source uses its browser-local demo storage'});
 if(route==='/__master/routes')return send(res,200,registeredSite.managedUpload?adminPortalRoutes(registeredSite):reactRoutes());
 if(route.startsWith('/admin')&&!session){res.writeHead(302,{Location:'http://127.0.0.1:8090/demo/'+JSON.parse(fs.readFileSync(path.join(root,'data/runtime.json'),'utf8')).sites.find(s=>s.kind==='react-demo'&&s.port===port).id+'?'+new URLSearchParams({next:route+url.search})});return res.end();}
 if(/(?:^|\/)\./.test(route)||route.includes('\\'))return send(res,404,{error:'Not found'});
 const candidate=path.resolve(dist,'.'+route);if(!candidate.startsWith(dist+path.sep)&&candidate!==dist)return send(res,404,{error:'Not found'});
 if(fs.existsSync(candidate)&&fs.statSync(candidate).isFile()){
  if(path.extname(candidate)==='.sql'&&!session)return send(res,403,{error:'Open the local admin demo first'});
  const type=mime[path.extname(candidate).toLowerCase()];if(!type)return send(res,404,{error:'Not found'});res.writeHead(200,{'Content-Type':type,'Cache-Control':'public, max-age=300','X-Content-Type-Options':'nosniff'});return fs.createReadStream(candidate).pipe(res);
 }
 if(path.extname(route))return send(res,404,{error:'File not found'});
 let html=fs.readFileSync(path.join(dist,'index.html'),'utf8');const bootstrap={user:session?demoUser:null,csrf:session?.csrf||'',mode:'local-browser-demo'};
 const script='<script>window.__MASTER_LIBRARY_DEMO__='+jsonScript(bootstrap)+';'+(registeredSite.managedUpload?'':'{const seed='+jsonScript(newDemoData())+';for(const [key,value]of Object.entries(seed)){if(localStorage.getItem(key)===null)localStorage.setItem(key,JSON.stringify(value));}}')+'</script>';
 html=html.replace('</head>',script+'</head>');return send(res,200,html,'text/html; charset=utf-8');
}catch(e){console.error(e);if(!res.headersSent)send(res,500,{error:'Imported source preview failed'});else res.end();}});
server.listen(port,'127.0.0.1',()=>console.log('Imported React source: http://127.0.0.1:'+port));
