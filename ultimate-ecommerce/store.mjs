import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {modules,themes} from './modules.mjs';
export class AppError extends Error {constructor(message,status=400){super(message);this.status=status}}
export const fail=(condition,message,status=400)=>{if(condition)throw new AppError(message,status)};
export const hashPassword=password=>{const salt=crypto.randomBytes(16).toString('hex');return salt+':'+crypto.scryptSync(password,salt,64).toString('hex')};
export function checkPassword(password,hash){try{const [salt,key]=hash.split(':');return crypto.timingSafeEqual(Buffer.from(key,'hex'),crypto.scryptSync(password,salt,64))}catch{return false}}
export function createStore(filename,{seed=true}={}){
 if(filename!==':memory:')fs.mkdirSync(path.dirname(filename),{recursive:true});
 const db=new DatabaseSync(filename);
 db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS records(id INTEGER PRIMARY KEY AUTOINCREMENT,kind TEXT NOT NULL,data TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS records_kind ON records(kind);
 CREATE UNIQUE INDEX IF NOT EXISTS products_sku ON records(json_extract(data,'$.sku')) WHERE kind='products';
 CREATE UNIQUE INDEX IF NOT EXISTS users_email ON records(lower(json_extract(data,'$.email'))) WHERE kind='users';
 CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS orders(id INTEGER PRIMARY KEY AUTOINCREMENT,number TEXT UNIQUE,customer_name TEXT NOT NULL,email TEXT NOT NULL,phone TEXT,address TEXT,subtotal INTEGER NOT NULL,discount INTEGER NOT NULL,shipping INTEGER NOT NULL,tax INTEGER NOT NULL,total INTEGER NOT NULL,status TEXT NOT NULL,payment_status TEXT NOT NULL,payment_method TEXT NOT NULL,channel TEXT NOT NULL,coupon TEXT,notes TEXT,receipt_token TEXT NOT NULL,idempotency_key TEXT UNIQUE,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS order_items(id INTEGER PRIMARY KEY AUTOINCREMENT,order_id INTEGER NOT NULL REFERENCES orders(id),product_id INTEGER NOT NULL,name TEXT NOT NULL,sku TEXT,image TEXT,variant_id INTEGER,quantity INTEGER NOT NULL,unit_price INTEGER NOT NULL,unit_cost INTEGER NOT NULL,vendor_id INTEGER,commission INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS stock_movements(id INTEGER PRIMARY KEY AUTOINCREMENT,product_id INTEGER NOT NULL,delta INTEGER NOT NULL,reason TEXT NOT NULL,reference TEXT,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id INTEGER,csrf TEXT NOT NULL,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value TEXT);
 `);
 const now=()=>new Date().toISOString();
 const parse=r=>r?{id:r.id,...JSON.parse(r.data),created_at:r.created_at,updated_at:r.updated_at}:null;
 const list=(kind)=>db.prepare('SELECT * FROM records WHERE kind=? ORDER BY id DESC').all(kind).map(parse);
 const get=(kind,id)=>parse(db.prepare('SELECT * FROM records WHERE kind=? AND id=?').get(kind,Number(id)));
 const insert=(kind,data)=>{const stamp=now();const r=db.prepare('INSERT INTO records(kind,data,created_at,updated_at) VALUES(?,?,?,?)').run(kind,JSON.stringify(data),stamp,stamp);return get(kind,Number(r.lastInsertRowid))};
 const update=(kind,id,data)=>{const old=get(kind,id);fail(!old,'Record not found',404);const {id:_,created_at,updated_at,...merged}={...old,...data};db.prepare('UPDATE records SET data=?,updated_at=? WHERE kind=? AND id=?').run(JSON.stringify(merged),now(),kind,Number(id));return get(kind,id)};
 const setting=(key,fallback=null)=>{const r=db.prepare('SELECT value FROM settings WHERE key=?').get(key);return r?JSON.parse(r.value):fallback};
 const setSetting=(key,value)=>db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,JSON.stringify(value));
 const transaction=fn=>{db.exec('BEGIN IMMEDIATE');try{const r=fn();db.exec('COMMIT');return r}catch(e){db.exec('ROLLBACK');throw e}};
 const audit=(action,module,recordId,user='System')=>insert('audit',{name:action,module,record_id:recordId,actor:user,status:'recorded'});
 const cents=n=>Math.round(Number(n)*100);
 function salePrice(product){
  const day=new Date().toISOString().slice(0,10);const tags=String(product.tags||'').split(',').map(t=>t.trim());
  const campaigns=list('flashsales').filter(c=>c.status==='active'&&(!c.starts_at||c.starts_at<=day)&&(!c.expires_at||c.expires_at>=day)&&(!c.tags||String(c.tags).split(',').some(t=>tags.includes(t.trim()))));
  const discount=Math.min(100,Math.max(0,...campaigns.map(c=>Number(c.discount)||0)));
  const campaignPrice=Math.round(Number(product.price)*(100-discount))/100;
  return Number(product.sale_price)>0?Math.min(campaignPrice,Number(product.sale_price)):campaignPrice;
 }
 function stock(productId,delta,reason,reference){
  const p=get('products',productId);fail(!p,'Product not found',404);fail(p.stock+delta<0,'Not enough stock for '+p.name,409);
  update('products',productId,{stock:p.stock+delta});db.prepare('INSERT INTO stock_movements(product_id,delta,reason,reference,created_at) VALUES(?,?,?,?,?)').run(productId,delta,reason,String(reference),now());
 }
 function validate(kind,input,old){
  const spec=modules.find(m=>m.id===kind);fail(!spec,'Unknown module',404);fail(spec.readonly,'Use the order workflow for this module');
  const data={};
  for(const f of spec.fields){
   let value=input[f.key]??old?.[f.key]??'';
   if(f.type==='password'&&!value)continue;
   fail(f.required&&(value===''||value===null),f.label+' is required');
   if(f.type==='number'){value=Number(value||0);fail(!Number.isFinite(value)||value<0,f.label+' must be a valid nonnegative number');}
   if(f.type==='relation'){value=value?Number(value):null;fail(value&&!get(f.source,value),f.label+' does not exist');}
   if(f.type==='select'){value=value||f.options[0];fail(!f.options.includes(value),'Invalid '+f.label);}
   if(['text','textarea','password'].includes(f.type)){value=String(value).trim();fail(value.length>30000,f.label+' is too long');}
   if(f.key==='email'&&value)fail(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),'Enter a valid email address');
   if(['image','link','tracking_url','endpoint'].includes(f.key)&&value)fail(!(/^(https?:\/\/|\/(?!\/))/.test(value)),f.label+' must be an HTTP URL or local path');
   data[f.key]=value;
  }
  if(kind==='products'){
   fail(!Number.isInteger(data.stock),'Stock must be a whole number');data.slug=data.slug||slug(data.name);
   fail(list(kind).some(r=>r.id!==old?.id&&r.sku===data.sku),'SKU already exists',409);
   fail(list(kind).some(r=>r.id!==old?.id&&r.slug===data.slug),'Product slug already exists',409);
  }
  if(kind==='variants')fail(!Number.isInteger(data.stock),'Variant stock must be a whole number');
  if(['categories','pages','posts','collections'].includes(kind))data.slug=data.slug||slug(data.name);
  if(kind==='coupons'){data.name=data.name.toUpperCase();fail(data.kind==='percent'&&data.value>100,'Discount cannot exceed 100%');fail(list(kind).some(r=>r.id!==old?.id&&r.name===data.name),'Coupon code already exists',409);}
  if(kind==='purchases'){fail(!data.product_id||!Number.isInteger(data.quantity)||data.quantity<1,'Choose a product and a positive whole quantity');fail(old?.posted&&(data.product_id!==old.product_id||data.quantity!==old.quantity||data.unit_cost!==old.unit_cost||data.status!=='received'),'A received purchase cannot be changed');}
  if(kind==='reviews')fail(data.rating<1||data.rating>5,'Rating must be between 1 and 5');
  if(kind==='taxes')fail(data.rate>100,'Tax rate cannot exceed 100%');
  if(kind==='flashsales')fail(data.discount>100,'Flash sale discount cannot exceed 100%');
  if(kind==='vendors')fail(data.commission>100,'Commission cannot exceed 100%');
  if(kind==='users'){
   fail(!old&&!data.password,'A password is required');
   if(data.password){fail(data.password.length<8,'Password must have at least 8 characters');data.password_hash=hashPassword(data.password);delete data.password;}
   fail(list(kind).some(r=>r.id!==old?.id&&r.email.toLowerCase()===data.email.toLowerCase()),'Email already exists',409);
  }
  return data;
 }
 function save(kind,input,id,user='Admin'){
  return transaction(()=>{
   const old=id?get(kind,id):null;fail(id&&!old,'Record not found',404);const data=validate(kind,input,old);
   if(kind==='integrations'&&data.secret){data.encrypted_secret=encrypt(data.secret);delete data.secret;}
   let record=id?update(kind,id,data):insert(kind,data);
   if(kind==='products'&&old&&record.stock!==old.stock)db.prepare('INSERT INTO stock_movements(product_id,delta,reason,reference,created_at) VALUES(?,?,?,?,?)').run(record.id,record.stock-old.stock,'Manual adjustment',String(record.id),now());
   if(kind==='purchases'&&record.status==='received'&&!old?.posted){stock(record.product_id,record.quantity,'Purchase received',record.name);record=update(kind,record.id,{posted:true});}
   audit(id?'Updated':'Created',kind,record.id,user);return clean(record);
  });
 }
 function remove(kind,id,user='Admin'){
  return transaction(()=>{
   const spec=modules.find(m=>m.id===kind);fail(!spec||spec.readonly,'This record cannot be deleted');const old=get(kind,id);fail(!old,'Record not found',404);
   fail(kind==='users'&&list('users').filter(u=>u.status==='active').length<=1,'Keep at least one active team member');
   fail(kind==='purchases'&&old.posted,'Received purchases cannot be deleted');
   for(const m of modules)for(const field of m.fields.filter(f=>f.type==='relation'&&f.source===kind))fail(list(m.id).some(r=>r[field.key]===Number(id)),m.name+' still reference this record. Archive it instead.',409);
   fail(kind==='products'&&db.prepare('SELECT 1 FROM order_items WHERE product_id=? LIMIT 1').get(Number(id)),'Ordered products must be archived instead',409);
   db.prepare('DELETE FROM records WHERE kind=? AND id=?').run(kind,Number(id));audit('Deleted',kind,id,user);return {ok:true};
  });
 }
 function quote(input){
  fail(!Array.isArray(input.items)||!input.items.length||input.items.length>100,'Your cart is empty or too large');
  const combined=new Map();for(const item of input.items){const key=item.product_id+':'+(item.variant_id||'');const q=Number(item.quantity);fail(!Number.isInteger(q)||q<1||q>1000,'Invalid quantity');combined.set(key,{...item,quantity:(combined.get(key)?.quantity||0)+q});}
  const lines=[...combined.values()].map(item=>{
   const p=get('products',item.product_id);fail(!p||p.status!=='active','Product is unavailable');let variant=null;if(item.variant_id){variant=get('variants',item.variant_id);fail(!variant||variant.product_id!==p.id||variant.status!=='active','Variant is unavailable');}
   fail(p.stock<item.quantity||(variant&&variant.stock<item.quantity),'Not enough stock for '+p.name,409);
   return {product_id:p.id,name:p.name,sku:variant?.sku||p.sku,image:p.image,variant_id:variant?.id||null,quantity:item.quantity,unit_price:cents(variant?.price??salePrice(p)),unit_cost:cents(p.cost||0),vendor_id:p.vendor_id||null,commission:get('vendors',p.vendor_id)?.commission||0};
  });
  // Different variants of one product still draw from the same parent stock.
  const quantities=new Map();for(const l of lines)quantities.set(l.product_id,(quantities.get(l.product_id)||0)+l.quantity);
  for(const [id,q] of quantities)fail(get('products',id).stock<q,'Not enough total stock for '+get('products',id).name,409);
  const subtotal=lines.reduce((s,l)=>s+l.unit_price*l.quantity,0);let discount=0;let coupon=null;
  if(input.coupon){coupon=list('coupons').find(c=>c.name===String(input.coupon).toUpperCase()&&c.status==='active');fail(!coupon,'Coupon is invalid');fail(coupon.expires_at&&coupon.expires_at<new Date().toISOString().slice(0,10),'Coupon expired');fail(subtotal<cents(coupon.minimum||0),'Coupon minimum is not met');const used=db.prepare("SELECT count(*) n FROM orders WHERE coupon=? AND status NOT IN ('cancelled','refunded')").get(coupon.name).n;fail(coupon.usage_limit&&used>=coupon.usage_limit,'Coupon usage limit reached');discount=coupon.kind==='percent'?Math.round(subtotal*coupon.value/100):cents(coupon.value);discount=Math.min(subtotal,discount);}
  const method=input.channel==='pos'?null:list('shipping').find(s=>s.id===Number(input.shipping_id)&&s.status==='active');
  fail(input.channel!=='pos'&&!method,'Choose a shipping method');
  const shipping=method&&!(method.free_above>0&&subtotal>=cents(method.free_above))?cents(method.price):0;
  const taxRate=Number(setting('store',{}).tax_rate||0);const tax=Math.round((subtotal-discount)*taxRate/100);
  return {items:lines,subtotal,discount,shipping,tax,total:subtotal-discount+shipping+tax,coupon:coupon?.name||null};
 }
 function checkout(input,{pos=false,user='Customer'}={}){
  return transaction(()=>{
   fail(!input.customer_name||String(input.customer_name).trim().length<2,'Enter the customer name');fail(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email||''),'Enter a valid email address');
   if(!pos)fail(!input.address||String(input.address).trim().length<5,'Enter a delivery address');
   const key=String(input.idempotency_key||'');fail(key.length<12||key.length>128,'A valid checkout request key is required');
   const previous=db.prepare('SELECT * FROM orders WHERE idempotency_key=?').get(key);if(previous)return order(previous.id);
   const q=quote({...input,channel:pos?'pos':'storefront'});const stamp=now();const receipt=crypto.randomBytes(24).toString('hex');
   const result=db.prepare('INSERT INTO orders(number,customer_name,email,phone,address,subtotal,discount,shipping,tax,total,status,payment_status,payment_method,channel,coupon,notes,receipt_token,idempotency_key,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(null,String(input.customer_name).trim(),String(input.email).toLowerCase(),String(input.phone||''),String(input.address||''),q.subtotal,q.discount,q.shipping,q.tax,q.total,pos?'delivered':'pending',pos?'paid':'pending',pos?'cash':'cod',pos?'pos':'storefront',q.coupon,String(input.notes||''),receipt,key,stamp,stamp);
   const id=Number(result.lastInsertRowid);db.prepare('UPDATE orders SET number=? WHERE id=?').run('AST-'+String(id).padStart(5,'0'),id);
   for(const l of q.items){stock(l.product_id,-l.quantity,'Order placed',id);if(l.variant_id){const v=get('variants',l.variant_id);update('variants',v.id,{stock:v.stock-l.quantity});}db.prepare('INSERT INTO order_items(order_id,product_id,name,sku,image,variant_id,quantity,unit_price,unit_cost,vendor_id,commission) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(id,l.product_id,l.name,l.sku,l.image||'',l.variant_id,l.quantity,l.unit_price,l.unit_cost,l.vendor_id,Math.round(l.commission*100));}
   if(!list('customers').some(c=>c.email?.toLowerCase()===String(input.email).toLowerCase()))insert('customers',{name:input.customer_name,email:String(input.email).toLowerCase(),phone:input.phone||'',address:input.address||'',status:'active'});
   insert('payments',{name:'Payment for AST-'+String(id).padStart(5,'0'),order_id:id,amount:q.total/100,method:pos?'cash':'cod',status:pos?'paid':'pending'});
   insert('notifications',{name:'New order AST-'+String(id).padStart(5,'0'),message:input.customer_name+' placed an order.',status:'unread'});
   audit('Order placed','orders',id,user);return order(id);
  });
 }
 const order=id=>{const o=db.prepare('SELECT * FROM orders WHERE id=?').get(Number(id));return o?{...o,items:db.prepare('SELECT * FROM order_items WHERE order_id=?').all(Number(id))}:null};
 function changeOrder(id,input,user='Admin'){
  return transaction(()=>{
   const o=order(id);fail(!o,'Order not found',404);
   const allowed={pending:['confirmed','cancelled'],confirmed:['processing','shipped','cancelled'],processing:['shipped','cancelled'],shipped:['delivered','cancelled'],delivered:['refunded'],cancelled:[],refunded:[]};
   const status=input.status||o.status;fail(status!==o.status&&!allowed[o.status].includes(status),'Invalid order status transition',409);
   let payment=input.payment_status||o.payment_status;fail(!['pending','paid','refunded','cancelled'].includes(payment),'Invalid payment state');fail(['cancelled','refunded'].includes(o.status)&&payment!==o.payment_status,'This order is closed',409);
   if(status!==o.status&&['cancelled','refunded'].includes(status)){
    for(const item of o.items){stock(item.product_id,item.quantity,'Order '+status,id);if(item.variant_id){const v=get('variants',item.variant_id);if(v)update('variants',v.id,{stock:v.stock+item.quantity});}}
    payment=status==='refunded'||o.payment_status==='paid'?'refunded':'cancelled';
    if(payment==='refunded')insert('refunds',{name:'Refund '+o.number,order_id:o.id,amount:o.total/100,status:'completed',reason:input.reason||'Admin return',restocked:true});
   }
   db.prepare('UPDATE orders SET status=?,payment_status=?,updated_at=? WHERE id=?').run(status,payment,now(),Number(id));
   for(const p of list('payments').filter(p=>p.order_id===Number(id)))update('payments',p.id,{status:payment});
   audit('Order '+status,'orders',id,user);return order(id);
  });
 }
 function clean(r){if(!r)return null;const {password_hash,encrypted_secret,...rest}=r;return {...rest,...(encrypted_secret?{has_secret:true}:{})}}
 const keyFile=filename===':memory:'?null:path.join(path.dirname(filename),'encryption.key');
 const encryptionKey=keyFile?(fs.existsSync(keyFile)?fs.readFileSync(keyFile):crypto.randomBytes(32)):crypto.randomBytes(32);
 if(keyFile&&!fs.existsSync(keyFile))fs.writeFileSync(keyFile,encryptionKey);
 function encrypt(value){const iv=crypto.randomBytes(12);const cipher=crypto.createCipheriv('aes-256-gcm',encryptionKey,iv);const ciphertext=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);return Buffer.concat([iv,ciphertext,cipher.getAuthTag()]).toString('base64')}
 function dashboard(){
  const orders=db.prepare('SELECT * FROM orders ORDER BY id DESC').all();const valid=orders.filter(o=>!['cancelled','refunded'].includes(o.status));
  const revenue=valid.reduce((s,o)=>s+o.total,0);const cogs=db.prepare("SELECT coalesce(sum(i.unit_cost*i.quantity),0) n FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.status NOT IN ('cancelled','refunded')").get().n;
  const expenses=list('expenses').reduce((s,e)=>s+cents(e.amount),0);
  const days=Array.from({length:14},(_,i)=>{const d=new Date();d.setDate(d.getDate()-13+i);const day=d.toISOString().slice(0,10);return {date:day,revenue:valid.filter(o=>o.created_at.startsWith(day)).reduce((s,o)=>s+o.total,0),orders:valid.filter(o=>o.created_at.startsWith(day)).length}});
  const top=db.prepare("SELECT i.product_id,i.name,sum(i.quantity) quantity,sum(i.quantity*i.unit_price) revenue FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.status NOT IN ('cancelled','refunded') GROUP BY i.product_id ORDER BY revenue DESC LIMIT 6").all();
  return {revenue,orders:orders.length,customers:list('customers').length,products:list('products').length,profit:revenue-cogs-expenses,cogs,expenses,average:valid.length?Math.round(revenue/valid.length):0,lowStock:list('products').filter(p=>p.stock<10),recent:orders.slice(0,8),chart:days,top,statuses:Object.fromEntries(['pending','confirmed','processing','shipped','delivered','cancelled','refunded'].map(s=>[s,orders.filter(o=>o.status===s).length]))};
 }
 const api={db,list,get,insert,update,setting,setSetting,transaction,audit,save,remove,quote,checkout,order,changeOrder,stock,dashboard,clean,salePrice};
 if(seed&&!db.prepare("SELECT value FROM meta WHERE key='seeded'").get())seedStore(api);
 return api;
}
export function slug(value){return String(value).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||crypto.randomBytes(4).toString('hex')}
function seedStore(s){
 s.transaction(()=>{
  s.setSetting('store',{name:'Ultimate Ecommarce By Astrallab',tagline:'Every possibility. One commerce platform.',email:'hello@astrallab.local',phone:'+880 1700 000000',address:'Dhaka, Bangladesh',currency:'BDT',tax_rate:0,theme:'astrallab',logo:'A',free_shipping_above:5000});
  const role=s.insert('roles',{name:'Administrator',permissions:'*',status:'active'});
  s.insert('users',{name:'Astrallab Admin',email:'admin@astrallab.local',password_hash:hashPassword(crypto.randomBytes(24).toString('hex')),role_id:role.id,status:'active'});
  s.insert('roles',{name:'Store manager',permissions:'dashboard,products,orders,categories,customers,purchases,shipments,inventory,reports,pos',status:'active'});
  const categoryNames=['Everyday essentials','Clothing','Accessories','Home & living'];
  const categories=categoryNames.map((name,i)=>s.insert('categories',{name,slug:slug(name),image:'/assets/product-'+(i+1)+'.png',status:'active'}));
  const vendor=s.insert('vendors',{name:'Astrallab Studio',email:'studio@astrallab.local',commission:10,status:'active'});
  const products=[['Everyday Sweatshirt',1890,790,2,'Soft essentials for every season.'],['Classic French Hoodie',2490,1190,2,'A comfortable layer, thoughtfully made.'],['Essential Black Jacket',3490,1800,2,'The versatile jacket for your daily rotation.'],['Signature Brown Jacket',3990,2100,2,'Warm tones and a timeless silhouette.'],['Classic Chino',2290,950,2,'An everyday favorite with a modern fit.'],['Everyday Gabardine',1990,850,2,'Easy comfort, effortless style.'],['Studio Denim Jacket',3790,1850,2,'The perfect finishing layer.'],['Essential Denim Jeans',2590,1200,2,'Your new favorite pair.'],['Classic Sportswear',1590,650,1,'Made to move with your day.'],['Team Red Hoodie',2690,1250,2,'A little color. A lot of comfort.'],['The Everyday Edit',1490,500,1,'A curated essential, made for you.'],['Weekend Layers',2890,1350,2,'For wherever the weekend takes you.']];
  const created=products.map((p,i)=>s.insert('products',{name:p[0],sku:'AST-'+String(i+1).padStart(3,'0'),slug:slug(p[0]),category_id:categories[p[3]-1].id,vendor_id:vendor.id,price:p[1],cost:p[2],stock:i===10?7:100,status:'active',product_type:'physical',image:'/assets/product-'+(i+1)+'.png',description:p[4]+' Designed for real life, with quality and value at its heart.',tags:i<5?'new,essentials':'bestseller,essentials',featured:i<8?'yes':'no'}));
  const shipping=s.insert('shipping',{name:'Standard delivery',price:80,free_above:5000,zone:'Bangladesh',days:3,status:'active'});
  s.insert('shipping',{name:'Express delivery',price:150,free_above:0,zone:'Dhaka',days:1,status:'active'});
  s.insert('coupons',{name:'WELCOME10',kind:'percent',value:10,minimum:1000,usage_limit:1000,expires_at:'2030-12-31',status:'active'});
  s.insert('warehouses',{name:'Main fulfillment center',code:'DHK-01',address:'Dhaka, Bangladesh',status:'active'});
  s.insert('suppliers',{name:'Astrallab Supply Co.',email:'supply@astrallab.local',status:'active'});
  for(const name of ['Studio Collection','Everyday Wear','The Essentials'])s.insert('brands',{name,status:'active'});
  s.insert('collections',{name:'The everyday edit',slug:'everyday',tags:'essentials',image:'/assets/product-1.png',description:'Thoughtfully chosen essentials.',status:'active'});
  s.insert('sliders',{name:'The new everyday',headline:'Good things. Great possibilities.',description:'Thoughtfully chosen, beautifully made.',image:'/assets/product-4.png',link:'/shop',button:'Explore the collection',status:'active'});
  s.insert('promotions',{name:'Welcome offer',headline:'A little welcome from us. Save 10% with WELCOME10.',link:'/shop',tags:'new',status:'active'});
  s.insert('announcements',{name:'Free standard delivery on orders over ৳5,000 · Welcome to Astrallab',link:'/shop',status:'active'});
  s.insert('pages',{name:'Our story',slug:'our-story',content:'We believe great commerce starts with thoughtful experiences. Astrallab brings together a considered collection of products and a complete platform for growing businesses.',status:'published'});
  s.insert('pages',{name:'Shipping & returns',slug:'shipping-returns',content:'Standard delivery takes approximately 3 business days. Contact our team with your order number to request a return. This is a local demonstration store.',status:'published'});
  s.insert('posts',{name:'A more considered everyday',slug:'a-more-considered-everyday',author:'Astrallab Journal',image:'/assets/product-3.png',content:'Buy thoughtfully. Choose pieces you love. Build an everyday collection that works for you.',status:'published'});
  s.insert('faqs',{name:'How can I track my order?',answer:'Use the Track order page with your order number and checkout email.',status:'active'});
  s.insert('testimonials',{name:'Ayesha R.',title:'Dhaka',comment:'A lovely collection and a simple shopping experience.',rating:5,status:'active'});
  for(const [name,link] of [['Shop','/shop'],['Our story','/page/our-story'],['Journal','/journal']])s.insert('menus',{name,link,position:'header',sort:0,status:'active'});
  for(const name of ['Cash on delivery','Manual payment','Courier API','WhatsApp Business','SMTP email'])s.insert('integrations',{name,kind:name.includes('Courier')?'courier':name.includes('WhatsApp')?'whatsapp':name.includes('email')?'email':'payment',provider:'',status:'not_connected',notes:'Configure a provider adapter and credentials before enabling live delivery.'});
  s.insert('translations',{name:'store.welcome',locale:'bn',value:'অ্যাস্ট্রাল্যাবে স্বাগতম',status:'active'});
  s.insert('expenses',{name:'Demo packaging supplies',amount:1200,category:'Operations',date:new Date().toISOString().slice(0,10)});
  s.db.prepare("INSERT INTO meta(key,value) VALUES('seeded','1')").run();
 });
 for(let i=0;i<18;i++){
  const o=s.checkout({customer_name:['Ayesha Rahman','Rafi Ahmed','Nadia Islam','Sami Hasan','Tania Noor'][i%5],email:'customer'+i%5+'@example.com',address:'Demo address, Dhaka, Bangladesh',phone:'+8801700000000',shipping_id:s.list('shipping').find(x=>x.name==='Standard delivery').id,items:[{product_id:s.list('products').reverse()[i%10].id,quantity:1+i%2}],idempotency_key:'seed-order-'+String(i).padStart(8,'0')},{user:'Demo seed'});
  const status=['delivered','delivered','shipped','processing','confirmed','pending'][i%6];
  const date=new Date();date.setDate(date.getDate()-i%14);
  s.db.prepare('UPDATE orders SET status=?,payment_status=?,created_at=? WHERE id=?').run(status,status==='delivered'?'paid':'pending',date.toISOString(),o.id);
  for(const p of s.list('payments').filter(p=>p.order_id===o.id))s.update('payments',p.id,{status:status==='delivered'?'paid':'pending'});
 }
}
