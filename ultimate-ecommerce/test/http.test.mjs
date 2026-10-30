import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
test('HTTP admin isolation, CSRF protection, public catalog and integrated checkout',async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'astrallab-http-'));const port=18242;
 const child=spawn(process.execPath,['server.mjs'],{cwd:root,windowsHide:true,env:{...process.env,PORT:String(port),DB_FILE:path.join(directory,'test.sqlite')},stdio:'ignore'});
 let cookie='',csrf;const base='http://127.0.0.1:'+port;
 async function req(url,method='GET',body,extra={}){const r=await fetch(base+url,{method,redirect:'manual',headers:{Connection:'close',Cookie:cookie,...(method!=='GET'?{'Content-Type':'application/json','X-CSRF-Token':csrf||''}:{}),...extra},body:body===undefined?undefined:JSON.stringify(body)});const set=r.headers.getSetCookie()[0];if(set)cookie=set.split(';')[0];const text=await r.text();let json;try{json=JSON.parse(text)}catch{}return {status:r.status,json,text,headers:r.headers}}
 try{
  let ready=false;for(let i=0;i<100;i++){try{const r=await req('/api/bootstrap');if(r.status===200){ready=true;csrf=r.json.csrf;break}}catch{}await new Promise(r=>setTimeout(r,50))}assert(ready,'test server started');
  const boot=(await req('/api/bootstrap')).json;assert.equal(boot.products.length,12);assert.equal(boot.products[0].cost,undefined);assert.equal((await req('/api/records/products')).status,401);
  assert.equal((await req('/api/checkout','POST',{}, {'X-CSRF-Token':'wrong'})).status,403);
  assert.equal((await req('/demo','GET',undefined,{'Sec-Fetch-Site':'cross-site'})).status,403);
  assert.equal((await req('/demo')).status,302);assert.equal((await req('/api/admin/bootstrap')).status,200);
  const appearance=await req('/api/appearance');assert.equal(appearance.status,200);assert.equal(appearance.json.colorPacks.length,12);
  const custom={...appearance.json.colorPacks[0],id:'http-brand',name:'HTTP brand'};
  assert.equal((await req('/api/appearance','PATCH',{customPack:custom})).status,200);
  const changed=await req('/api/appearance','PATCH',{frontend:{layout:'nest',pack:'http-brand',mode:'night'},backend:{layout:'shofy',pack:'ocean',mode:'dark'}});
  assert.equal(changed.json.frontend.layout,'nest');assert.equal(changed.json.backend.mode,'dark');
  const changedLayout=await req('/api/appearance','PATCH',{frontend:{layout:'martvill'}});assert.equal(changedLayout.json.frontend.pack,'http-brand');
  const currentBoot=(await req('/api/bootstrap')).json;assert.equal(currentBoot.appearance.frontend.mode,'night');
  const created=await req('/api/records/categories','POST',{name:'Integration test category',status:'active'});assert.equal(created.status,201);
  const imported=await req('/api/import/categories','POST',{csv:'name,slug,status\n"Quoted, category",quoted-category,active\n,invalid-category,active'});assert.equal(imported.status,200);assert.equal(imported.json.imported,1);assert.equal(imported.json.errors.length,1);
  const data={customer_name:'HTTP Customer',email:'http@example.com',address:'HTTP test address',shipping_id:boot.shipping[0].id,items:[{product_id:boot.products[0].id,quantity:1}],idempotency_key:'http-checkout-123456'};
  const order=await req('/api/checkout','POST',data);assert.equal(order.status,201);assert.equal(order.json.items[0].unit_cost,undefined);assert.equal((await req('/api/checkout','POST',data)).json.id,order.json.id);
  const cancel=await req('/api/orders/'+order.json.id,'PATCH',{status:'cancelled'});assert.equal(cancel.status,200);assert.equal(cancel.json.status,'cancelled');
  assert.equal((await req('/data/test.sqlite')).status,404);
  const role=await req('/api/records/roles','POST',{name:'Catalog editor',permissions:'products',status:'active'});assert.equal(role.status,201);
  const team=await req('/api/records/users','POST',{name:'Limited editor',email:'editor@example.com',password:'local-test-password',role_id:role.json.id,status:'active'});assert.equal(team.status,201);assert.equal(team.json.password_hash,undefined);
  assert.equal((await req('/api/login','POST',{email:'editor@example.com',password:'local-test-password'})).status,200);
  assert.equal((await req('/api/records/products')).status,200);assert.equal((await req('/api/records/orders')).status,403);assert.equal((await req('/api/dashboard')).status,403);
 }finally{child.kill();await new Promise(resolve=>{if(child.exitCode!==null)resolve();else child.once('exit',resolve)});}
});
