import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createStore,AppError,fail,checkPassword,hashPassword} from './store.mjs';
import {modules,themes} from './modules.mjs';
import {colorPacks,frontendLayouts,backendLayouts,resolveAppearance,validateAppearance} from './appearance.mjs';
const appearance=()=>resolveAppearance(store.setting('appearance'),store.setting('store',{}).theme);
const root=path.dirname(fileURLToPath(import.meta.url));
const port=Number(process.env.PORT||8200);
const store=createStore(process.env.DB_FILE||path.join(root,'data/ultimate.sqlite'));
const {db}=store;
try{db.exec('ALTER TABLE sessions ADD COLUMN customer_id INTEGER')}catch{}
const publicRoot=path.join(root,'public');
fs.mkdirSync(path.join(publicRoot,'uploads'),{recursive:true});
function respond(res,status,data,type='application/json; charset=utf-8'){
 res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','X-Frame-Options':'SAMEORIGIN'});res.end(type.startsWith('application/json')?JSON.stringify(data):data);
}
function session(req,res){
 const token=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(c=>c.startsWith('astrallab_session='))?.split('=')[1];
 let session=token&&db.prepare('SELECT * FROM sessions WHERE token=? AND expires>?').get(token,Date.now());
 if(!session){const sid=crypto.randomBytes(32).toString('hex');db.prepare('INSERT INTO sessions(token,csrf,expires) VALUES(?,?,?)').run(sid,crypto.randomBytes(24).toString('hex'),Date.now()+8*3600000);res.setHeader('Set-Cookie','astrallab_session='+sid+'; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800');session=db.prepare('SELECT * FROM sessions WHERE token=?').get(sid);}
 return session;
}
function admin(session,module){
 const user=store.get('users',session.user_id);fail(!user||user.status!=='active','Sign in to the admin workspace',401);const role=store.get('roles',user.role_id);fail(!role||role.status!=='active','Your role is inactive',403);
 const permissions=String(role.permissions||'').split(',').map(s=>s.trim());
 if(module)fail(!permissions.includes('*')&&!permissions.includes(module),'Your role cannot access this module',403);
 return store.clean({...user,permissions});
}
function csrf(req,session){fail(req.headers['x-csrf-token']!==session.csrf,'Refresh the page and try again',403)}
async function body(req){let bytes=0;const chunks=[];for await(const chunk of req){bytes+=chunk.length;fail(bytes>9*1024*1024,'Request is too large',413);chunks.push(chunk)}try{return JSON.parse(Buffer.concat(chunks).toString()||'{}')}catch{throw new AppError('Invalid JSON request')}}
function publicProduct(p){const {cost,...rest}=p;const sale=store.salePrice(p);return {...rest,...(sale<p.price?{sale_price:sale}:{})}}
function rows(kind){
 if(kind==='orders')return db.prepare('SELECT * FROM orders ORDER BY id DESC').all().map(({receipt_token,idempotency_key,...r})=>r);
 return store.list(kind).map(store.clean);
}
function csv(rows){if(!rows.length)return 'No records\r\n';const keys=[...new Set(rows.flatMap(Object.keys))];const cell=v=>'"'+String(v??'').replace(/^[=+@-]/,"'").replaceAll('"','""')+'"';return keys.map(cell).join(',')+'\r\n'+rows.map(r=>keys.map(k=>cell(typeof r[k]==='object'?JSON.stringify(r[k]):r[k])).join(',')).join('\r\n')}
function parseCsv(text){
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v.trim()))rows.push(row);row=[];cell='';}else cell+=c;}
 fail(quoted,'CSV contains an unclosed quoted field');row.push(cell);if(row.some(v=>v.trim()))rows.push(row);return rows;
}
const loginAttempts=new Map();
function rateLimit(key){const old=loginAttempts.get(key)||{count:0,until:Date.now()+600000};if(old.until<Date.now()){old.count=0;old.until=Date.now()+600000}old.count++;loginAttempts.set(key,old);fail(old.count>15,'Too many attempts. Try again in 10 minutes.',429)}
const server=http.createServer(async(req,res)=>{
 try{
  fail(!['127.0.0.1:'+port,'localhost:'+port].includes(req.headers.host),'Local host only',403);
  const url=new URL(req.url,'http://127.0.0.1:'+port);const pathname=decodeURIComponent(url.pathname);const method=req.method;
  if(pathname.startsWith('/assets/')||pathname.startsWith('/uploads/')||['/app.js','/styles.css','/design.js','/design.css'].includes(pathname)){
   const file=path.resolve(publicRoot,'.'+pathname);fail(!file.startsWith(publicRoot+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile(),'Asset not found',404);
   const mime={'.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2'}[path.extname(file).toLowerCase()];fail(!mime,'Asset not found',404);res.writeHead(200,{'Content-Type':mime,'Cache-Control':'public,max-age=300','X-Content-Type-Options':'nosniff'});fs.createReadStream(file).pipe(res);return;
  }
  if(port===8201&&method==='GET'&&!pathname.startsWith('/api/')&&!pathname.startsWith('/admin')&&pathname!=='/demo'){res.writeHead(302,{Location:'http://127.0.0.1:8200/'});return res.end();}
  const sess=session(req,res);
  if(pathname==='/demo'&&method==='GET'){
   fail(req.headers['sec-fetch-site']==='cross-site','Open the local demo from the storefront',403);
   const administrator=store.list('users').find(u=>u.status==='active'&&String(store.get('roles',u.role_id)?.permissions)==='*');fail(!administrator,'No active administrator',409);
   const requestedNext=url.searchParams.get('next');const next=requestedNext&&/^\/admin(?:\/|$)/.test(requestedNext)&&!/[\r\n\\]/.test(requestedNext)?requestedNext:'/admin';
   db.prepare('UPDATE sessions SET user_id=? WHERE token=?').run(administrator.id,sess.token);store.audit('Local demo login','users',administrator.id,administrator.name);res.writeHead(302,{Location:next, 'Cache-Control':'no-store'});return res.end();
  }
  if(pathname.startsWith('/api/')){
   if(!['GET','POST','PATCH','DELETE'].includes(method))throw new AppError('Method not allowed',405);
   if(method!=='GET'){fail(req.headers.origin&&!['http://127.0.0.1:'+port,'http://localhost:'+port].includes(req.headers.origin),'Invalid origin',403);csrf(req,sess);}
   const input=method==='GET'?{}:await body(req);
   if(pathname==='/api/health'&&method==='GET')return respond(res,200,{application:'astrallab-ultimate',status:'ok'});
   if(pathname==='/api/bootstrap'&&method==='GET'){
    const published=kind=>store.list(kind).filter(r=>['active','published'].includes(r.status));
    return respond(res,200,{store:store.setting('store'),themes,appearance:appearance(),colorPacks,canPreview:!!sess.user_id,csrf:sess.csrf,products:published('products').map(publicProduct),variants:published('variants'),categories:published('categories'),brands:published('brands'),collections:published('collections'),shipping:published('shipping'),promotions:published('promotions'),sliders:published('sliders'),menus:published('menus'),reviews:published('reviews'),faqs:published('faqs'),testimonials:published('testimonials'),announcements:published('announcements'),posts:published('posts'),pages:published('pages'),vendors:published('vendors').map(v=>({id:v.id,name:v.name,image:v.image})),customer:sess.customer_id?store.clean(store.get('customers',sess.customer_id)):null});
   }
   if(pathname==='/api/quote'&&method==='POST')return respond(res,200,store.quote({...input,channel:'storefront'}));
   if(pathname==='/api/checkout'&&method==='POST'){
    const order=store.checkout(input);const {items,...receipt}=order;return respond(res,201,{...receipt,items:items.map(({unit_cost,commission,vendor_id,...r})=>r)});
   }
   if(pathname==='/api/track'&&method==='POST'){
    const o=db.prepare('SELECT id FROM orders WHERE number=? AND lower(email)=?').get(String(input.number||'').toUpperCase(),String(input.email||'').toLowerCase());fail(!o,'No order matches that number and email',404);const order=store.order(o.id);return respond(res,200,{number:order.number,status:order.status,payment_status:order.payment_status,total:order.total,created_at:order.created_at,shipments:store.list('shipments').filter(s=>s.order_id===o.id).map(({name,carrier,status,tracking_url})=>({name,carrier,status,tracking_url}))});
   }
   if(pathname==='/api/subscribe'&&method==='POST'){
    fail(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email||''),'Enter a valid email');if(!store.list('subscribers').some(s=>s.email===input.email))store.save('subscribers',{email:input.email,status:'active'});return respond(res,200,{ok:true});
   }
   if(pathname==='/api/contact'&&method==='POST'){store.save('tickets',{name:input.subject,email:input.email,message:input.message,status:'open'});return respond(res,201,{ok:true})}
   if(pathname.startsWith('/api/customer/')){
    const action=pathname.split('/').pop();
    if(['login','register'].includes(action)&&method==='POST'){
     rateLimit('customer:'+String(input.email));let customer=store.list('customers').find(c=>c.email?.toLowerCase()===String(input.email).toLowerCase());
     if(action==='register'){fail(customer,'Email already registered',409);fail(String(input.password||'').length<8,'Password must have at least 8 characters');customer=store.save('customers',{name:input.name,email:input.email,status:'active'});store.update('customers',customer.id,{password_hash:hashPassword(input.password)});}
     else fail(!customer||!checkPassword(String(input.password||''),customer.password_hash||''),'Email or password is incorrect',401);
     db.prepare('UPDATE sessions SET customer_id=? WHERE token=?').run(customer.id,sess.token);return respond(res,200,store.clean(customer));
    }
    fail(!sess.customer_id,'Sign in to your customer account',401);const customer=store.get('customers',sess.customer_id);
    if(action==='orders'&&method==='GET')return respond(res,200,db.prepare('SELECT number,total,status,payment_status,created_at FROM orders WHERE lower(email)=? ORDER BY id DESC').all(customer.email.toLowerCase()));
    if(action==='logout'&&method==='POST'){db.prepare('UPDATE sessions SET customer_id=NULL WHERE token=?').run(sess.token);return respond(res,200,{ok:true})}
   }
   if(pathname==='/api/login'&&method==='POST'){
    rateLimit('admin:'+String(input.email));const user=store.list('users').find(u=>u.email.toLowerCase()===String(input.email).toLowerCase()&&u.status==='active');fail(!user||!checkPassword(String(input.password||''),user.password_hash||''),'Email or password is incorrect',401);db.prepare('UPDATE sessions SET user_id=? WHERE token=?').run(user.id,sess.token);return respond(res,200,store.clean(user));
   }
   if(pathname==='/api/logout'&&method==='POST'){db.prepare('UPDATE sessions SET user_id=NULL WHERE token=?').run(sess.token);return respond(res,200,{ok:true})}
   if(pathname==='/api/admin/bootstrap'&&method==='GET'){const user=admin(sess);const permissions=user.permissions;return respond(res,200,{user,csrf:sess.csrf,modules:modules.filter(m=>permissions.includes('*')||permissions.includes(m.id)),themes,store:store.setting('store')});}
   if(pathname==='/api/dashboard'&&method==='GET'){admin(sess,'dashboard');return respond(res,200,store.dashboard());}
   if(pathname==='/api/inventory'&&method==='GET'){admin(sess,'inventory');return respond(res,200,{products:store.list('products').map(store.clean),movements:db.prepare('SELECT * FROM stock_movements ORDER BY id DESC LIMIT 300').all()});}
   if(pathname==='/api/reports'&&method==='GET'){admin(sess,'reports');return respond(res,200,store.dashboard());}
   if(pathname==='/api/pos'&&method==='POST'){const user=admin(sess,'pos');return respond(res,201,store.checkout({...input,channel:'pos'},{pos:true,user:user.name}));}
   if(pathname==='/api/appearance'){
    const user=admin(sess,'settings');
    if(method==='GET')return respond(res,200,{...appearance(),colorPacks,frontendLayouts,backendLayouts});
    fail(method!=='PATCH','Method not allowed',405);
    let value;try{value=validateAppearance(input,appearance())}catch(e){throw new AppError(e.message)}
    store.setSetting('appearance',value);store.audit('Appearance updated','settings',0,user.name);return respond(res,200,{...value,colorPacks,frontendLayouts,backendLayouts});
   }
   if(pathname==='/api/settings'){
    const user=admin(sess,'settings');if(method==='GET')return respond(res,200,store.setting('store'));
    fail(method!=='PATCH','Method not allowed',405);const old=store.setting('store');const allowed=['name','tagline','email','phone','address','currency','theme','tax_rate'];const next={...old};for(const k of allowed)if(input[k]!==undefined)next[k]=String(input[k]).slice(0,500);fail(!themes.some(t=>t.id===next.theme),'Choose a valid theme');fail(!['BDT','USD','EUR','GBP'].includes(next.currency),'Unsupported currency');next.tax_rate=Number(next.tax_rate);fail(!Number.isFinite(next.tax_rate)||next.tax_rate<0||next.tax_rate>100,'Invalid tax rate');store.setSetting('store',next);store.audit('Settings updated','settings',0,user.name);return respond(res,200,next);
   }
   if(pathname==='/api/media'){
    const user=admin(sess,'media');if(method==='GET')return respond(res,200,store.list('media'));
    fail(method!=='POST','Method not allowed',405);const match=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(input.data||'');fail(!match,'Choose a PNG, JPEG or WebP image');const buffer=Buffer.from(match[2],'base64');fail(buffer.length>5*1024*1024,'Image must be under 5 MB');const valid=match[1]==='png'?buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):match[1]==='jpeg'?buffer[0]===255&&buffer[1]===216:buffer.subarray(0,4).toString()==='RIFF'&&buffer.subarray(8,12).toString()==='WEBP';fail(!valid,'Invalid image data');const file=crypto.randomUUID()+'.'+(match[1]==='jpeg'?'jpg':match[1]);fs.writeFileSync(path.join(publicRoot,'uploads',file),buffer);const record=store.insert('media',{name:String(input.name||file).slice(0,200),image:'/uploads/'+file,size:buffer.length,status:'active'});store.audit('Uploaded image','media',record.id,user.name);return respond(res,201,record);
   }
   const orderMatch=/^\/api\/orders\/(\d+)$/.exec(pathname);
   if(orderMatch){const user=admin(sess,'orders');if(method==='GET'){const o=store.order(orderMatch[1]);fail(!o,'Order not found',404);return respond(res,200,o)}if(method==='PATCH')return respond(res,200,store.changeOrder(orderMatch[1],input,user.name));}
   const exportMatch=/^\/api\/export\/([a-z]+)$/.exec(pathname);
   if(exportMatch&&method==='GET'){const kind=exportMatch[1];admin(sess,kind);fail(!modules.some(m=>m.id===kind),'Unknown module',404);res.setHeader('Content-Disposition',`attachment; filename="astrallab-${kind}.csv"`);return respond(res,200,csv(rows(kind)),'text/csv; charset=utf-8');}
   const importMatch=/^\/api\/import\/([a-z]+)$/.exec(pathname);
   if(importMatch&&method==='POST'){
    const kind=importMatch[1];const user=admin(sess,kind);const spec=modules.find(m=>m.id===kind);fail(!spec||spec.readonly,'Import is unavailable for this module');
    const table=parseCsv(String(input.csv||'').replace(/^\uFEFF/,''));fail(table.length<2||table.length>1001,'Import a CSV with a header and up to 1,000 data rows');const keys=table.shift().map(k=>k.trim());let imported=0;const errors=[];
    for(let i=0;i<table.length;i++){const record=Object.fromEntries(keys.map((k,n)=>[k,table[i][n]||'']));try{store.save(kind,record,null,user.name);imported++;}catch(e){errors.push({row:i+2,error:e.status?e.message:'Duplicate or invalid record'});}}
    return respond(res,200,{imported,errors});
   }
   const records=/^\/api\/records\/([a-z]+)(?:\/(\d+))?$/.exec(pathname);
   if(records){const [,kind,id]=records;const user=admin(sess,kind);fail(!modules.some(m=>m.id===kind),'Unknown module',404);
    if(method==='GET'){let values=rows(kind);const q=(url.searchParams.get('q')||'').toLowerCase();if(q)values=values.filter(r=>JSON.stringify(r).toLowerCase().includes(q));return respond(res,200,values)}
    if(method==='POST'&&!id)return respond(res,201,store.save(kind,input,null,user.name));
    if(method==='PATCH'&&id){fail(kind==='users'&&Number(id)===user.id&&(input.status&&input.status!=='active'||input.role_id&&Number(input.role_id)!==user.role_id),'Use another administrator to change your own role or status');return respond(res,200,store.save(kind,input,id,user.name));}
    if(method==='DELETE'&&id){fail(kind==='users'&&Number(id)===user.id,'You cannot delete yourself');return respond(res,200,store.remove(kind,id,user.name));}
   }
   throw new AppError('Endpoint not found',404);
  }
  fail(method!=='GET','Method not allowed',405);
  if(pathname.startsWith('/data/')||pathname.startsWith('/.'))throw new AppError('Not found',404);
  const redirect=store.list('redirects').find(r=>r.name===pathname&&r.status==='active');if(redirect){fail(!String(redirect.target).startsWith('/')||String(redirect.target).startsWith('//'),'Invalid redirect');res.writeHead(Number(redirect.code)||301,{Location:redirect.target});return res.end();}
  const html=fs.readFileSync(path.join(publicRoot,'index.html'),'utf8');respond(res,200,html,'text/html; charset=utf-8');
 }catch(e){console.error(e instanceof AppError?e.message:e);respond(res,e.status||500,{error:e.status?e.message:'The request could not be completed. Check the local server log.'});}
});
server.listen(port,'127.0.0.1',()=>console.log(`Ultimate Ecommarce By Astrallab: http://127.0.0.1:${port}`));
process.on('SIGTERM',()=>server.close(()=>{db.close();process.exit()}));
