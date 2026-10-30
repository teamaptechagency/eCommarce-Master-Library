import assert from 'node:assert/strict';
const control='http://127.0.0.1:8201';const gateway='http://127.0.0.1:8200';let cookie='';let csrf;
async function api(url,method='GET',body){const r=await fetch(control+url,{method,redirect:'manual',headers:{Cookie:cookie,'Content-Type':'application/json','X-CSRF-Token':csrf||''},body:body?JSON.stringify(body):undefined});const set=r.headers.getSetCookie().find(c=>c.startsWith('astrallab_session='));if(set)cookie=set.split(';')[0];const text=await r.text();let data;try{data=JSON.parse(text)}catch{}return {status:r.status,data,headers:r.headers};}
assert.equal((await api('/demo?next=/admin/themes')).headers.get('location'),'/admin/themes');csrf=(await api('/api/bootstrap')).data.csrf;const saved=(await api('/api/appearance')).data;
try{
 const ids=['shopperzz','nest','shofy','grostore','martvill','footstep'];
 for(let i=0;i<ids.length;i++){
  const frontend=ids[i],backend=ids[(i+1)%ids.length];const changed=await api('/api/appearance','PATCH',{frontend:{layout:frontend},backend:{layout:backend}});assert.equal(changed.status,200);
  assert.equal(changed.data.frontend.pack,saved.frontend.pack);assert.equal(changed.data.backend.pack,saved.backend.pack);
  const publicResponse=await fetch(gateway+'/');const html=await publicResponse.text();assert.equal(publicResponse.status,200);assert(html.includes('/__ultimate/engine/'+frontend+'/'),'Selected original storefront is rendered');assert(html.includes('<title>Ultimate Ecommarce By Astrallab</title>'));
  const demo=await fetch(gateway+'/demo',{redirect:'manual'});assert(demo.headers.get('location')?.startsWith('/__ultimate/engine/'+backend+'/__native/demo-login'),'Selected backend receives demo login');
  const photo=await fetch(gateway+'/assets/product-1-400x400.png');assert.equal(photo.status,200);assert(photo.headers.get('content-type').startsWith('image/'));await photo.arrayBuffer();
  console.log('PASS: public '+frontend+' / admin '+backend+'; color packs retained; thumbnail loaded');
 }
}finally{const restore=await api('/api/appearance','PATCH',{frontend:saved.frontend,backend:saved.backend});assert.equal(restore.status,200);console.log('Original layout, pack and mode selections restored.');}
