import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import assert from 'node:assert/strict';import {root} from './sources.mjs';
const base='http://127.0.0.1:8200';const runtime=JSON.parse(fs.readFileSync(path.join(root,'data/native-runtime.json'),'utf8'));const before=JSON.parse(fs.readFileSync(path.join(root,'data/native-snapshot.json'),'utf8'));const product=before.products.find(p=>p.id===9);const source=runtime.sources.find(s=>s.id==='footstep');
const expires=Math.floor(Date.now()/1000)+60;const signature=crypto.createHmac('sha256',runtime.secret).update(source.id+'|'+expires+'|'+source.admin).digest('hex');
const login=await fetch(base+'/__ultimate/engine/footstep/__native/demo-login?'+new URLSearchParams({expires:String(expires),signature,next:source.admin}));const loginBody=await login.text();const payload=JSON.parse(loginBody.match(/const p=([\s\S]+?);for/)?.[1]||'{}');assert(payload.token,'Native demo bearer token');
async function edit(name){const r=await fetch(base+'/__ultimate/engine/footstep/api/products/'+product.id,{method:'PUT',headers:{Authorization:'Bearer '+payload.token,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({name})});const text=await r.text();assert.equal(r.status,200,text.slice(0,500));return text;}
try{
 const name=product.name+' — sync verification';await edit(name);
 const central=JSON.parse(fs.readFileSync(path.join(root,'data/native-snapshot.json'),'utf8'));assert.equal(central.products.find(p=>p.id===product.id).name,name,'Native edit reaches canonical database');
 const catalog=await fetch(base+'/__ultimate/engine/nest/ajax/popular-products?limit=100',{headers:{Accept:'application/json','X-Requested-With':'XMLHttpRequest'}});const catalogData=await catalog.json();assert(catalogData.data?.some(p=>p.name===name),'Native edit reaches another original theme: '+JSON.stringify(catalogData).slice(0,300));
 console.log('PASS: original Footstep admin edit → shared database → original Nest catalog');
}finally{await edit(product.name);console.log('Original demo product name restored.');}
