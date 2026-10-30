import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const port=Number(process.env.MASTER_UPLOAD_PORT),root=fs.realpathSync(process.env.MASTER_UPLOAD_PUBLIC),spa=process.env.MASTER_UPLOAD_SPA==='true';
const library=process.env.MASTER_LIBRARY_ROOT||path.dirname(fileURLToPath(import.meta.url));
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.avif':'image/avif','.gif':'image/gif','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.mp4':'video/mp4','.webm':'video/webm','.pdf':'application/pdf','.txt':'text/plain; charset=utf-8','.wasm':'application/wasm'};
const server=http.createServer((req,res)=>{
  const reply=(status,text)=>{res.writeHead(status,{'Content-Type':'text/plain','X-Content-Type-Options':'nosniff'});res.end(text)};
  try{
    if(!['127.0.0.1:'+port,'localhost:'+port].includes(req.headers.host))return reply(403,'Local preview only');
    const pathname=new URL(req.url,'http://localhost').pathname;
    if(pathname==='/__master/health'){res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify({application:'master-uploaded-static',source:process.env.MASTER_UPLOAD_APP||root,port,pid:process.pid}));}
    if(pathname==='/__master/shutdown'&&req.method==='POST'){
      const runtime=JSON.parse(fs.readFileSync(path.join(library,'data/runtime.json'),'utf8'));
      if(req.headers['x-master-library']!==runtime.secret)return reply(403,'Forbidden');
      reply(200,'Restarting preview');server.close(()=>process.exit(0));setTimeout(()=>process.exit(0),500).unref();return;
    }
    if(!['GET','HEAD'].includes(req.method))return reply(405,'This upload contains a static frontend. Upload its backend for server features.');
    const uri=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(uri.includes('\\')||/(?:^|\/)\./.test(uri)||/^\/node_modules(\/|$)/i.test(uri))return reply(404,'Not found');
    let file=path.resolve(root,'.'+uri);
    if(file!==root&&!file.startsWith(root+path.sep))return reply(404,'Not found');
    if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
    if(!fs.existsSync(file)&&spa&&!path.extname(uri))file=path.join(root,'index.html');
    if(!fs.existsSync(file)||!fs.statSync(file).isFile()||!mime[path.extname(file).toLowerCase()])return reply(404,'Not found');
    if(!fs.realpathSync(file).startsWith(root+path.sep))return reply(404,'Not found');
    res.writeHead(200,{'Content-Type':mime[path.extname(file).toLowerCase()],'X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'});
    if(req.method==='HEAD')return res.end();fs.createReadStream(file).on('error',()=>res.destroy()).pipe(res);
  }catch{reply(400,'Invalid request')}
}).listen(port,'127.0.0.1',()=>console.log('Uploaded preview ready on '+port));
