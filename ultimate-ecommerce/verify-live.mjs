import assert from 'node:assert/strict';
const origin=process.env.BASE_URL||'http://127.0.0.1:8200';let cookie='';
async function request(path){const response=await fetch(origin+path,{redirect:'manual',headers:{Connection:'close',Cookie:cookie}});const set=response.headers.getSetCookie()[0];if(set)cookie=set.split(';')[0];const text=await response.text();let json;try{json=JSON.parse(text)}catch{}return {status:response.status,json,text};}
const boot=await request('/api/bootstrap');assert.equal(boot.status,200);assert.equal(boot.json.themes.length,7);assert(boot.json.products.length>=12);
assert.equal((await request('/demo')).status,302);const admin=await request('/api/admin/bootstrap');assert.equal(admin.status,200);
for(const m of admin.json.modules){const result=await request('/api/records/'+m.id);assert.equal(result.status,200,m.id);assert(Array.isArray(result.json),m.id);}
for(const path of ['/api/dashboard','/api/inventory','/api/reports','/api/media','/api/settings'])assert.equal((await request(path)).status,200,path);
for(const product of boot.json.products){const result=await request(product.image);assert.equal(result.status,200,product.image);}
console.log(JSON.stringify({application:boot.json.store.name,modules:admin.json.modules.length,themes:boot.json.themes.length,products:boot.json.products.length,checks:'All module reads, core dashboard routes and product assets passed.'},null,2));
