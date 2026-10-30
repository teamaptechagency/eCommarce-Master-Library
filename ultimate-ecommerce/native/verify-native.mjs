import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import assert from 'node:assert/strict';import {root} from './sources.mjs';
const base='http://127.0.0.1:8200';const runtime=JSON.parse(fs.readFileSync(path.join(root,'data/native-runtime.json'),'utf8'));const snapshot=JSON.parse(fs.readFileSync(path.join(root,'data/native-snapshot.json'),'utf8'));const cookies=new Map();
async function request(url,options={}){const r=await fetch(new URL(url,base),{redirect:'manual',...options,headers:{cookie:[...cookies].map(([k,v])=>k+'='+v).join('; '),...options.headers}});for(const cookie of r.headers.getSetCookie()){const pair=cookie.split(';')[0];const pos=pair.indexOf('=');cookies.set(pair.slice(0,pos),pair.slice(pos+1));}return r;}
const report=[];const apiKey=fs.readFileSync(path.join(root,'data/native-engines/shopperzz/.env'),'utf8').match(/^MIX_API_KEY=(.*)$/m)?.[1].replace(/^['"]|['"]$/g,'');
for(const source of runtime.sources){
 const prefix='/__ultimate/engine/'+source.id;const r=await request(prefix+'/');const html=await r.text();assert.equal(r.status,200,source.id+' homepage');assert(!/Database Upgrade Required|Application is not installed|500\s+Server Error|You need to setup your homepage first/.test(html),source.id+' must render the source storefront');
 const assets=[...new Set([...html.matchAll(/(?:src|href)=["']([^"']+\.(?:css|js)(?:\?[^"']*)?)["']/g)].map(m=>m[1]))].filter(u=>u.startsWith('/__ultimate/engine/'));
 const assetResults=[];for(const url of assets){const response=await request(url);await response.arrayBuffer();assetResults.push({url,status:response.status,type:response.headers.get('content-type')});}
 assert(assetResults.some(a=>a.type?.includes('css')),source.id+' stylesheet present');const failed=assetResults.filter(a=>a.status!==200||!/(css|javascript)/.test(a.type||''));
 const expires=Math.floor(Date.now()/1000)+60;const signature=crypto.createHmac('sha256',runtime.secret).update(source.id+'|'+expires+'|'+source.admin).digest('hex');
 const login=await request(prefix+'/__native/demo-login?'+new URLSearchParams({expires:String(expires),signature,next:source.admin}));const loginBody=await login.text();assert([200,302].includes(login.status),source.id+' demo login: '+loginBody.slice(0,100));
 let token;if(source.family==='shopperzz'||source.family==='footstep'){const payload=JSON.parse(loginBody.match(/const p=([\s\S]+?);(?:let|for)/)?.[1]||'{}');token=payload.token;assert(token,source.id+' receives passwordless token');}
 const admin=await request(prefix+source.admin);const adminHtml=await admin.text();assert.equal(admin.status,200,source.id+' original admin response');assert(!/Database Upgrade Required|500\s+Server Error/.test(adminHtml),source.id+' admin engine renders');
 const checks={};let endpoint;
 if(source.id==='shopperzz')endpoint=prefix+'/api/frontend/product?paginate=0&per_page=100';
 if(source.id==='nest')endpoint=prefix+'/ajax/popular-products?limit=100';
 if(source.id==='shofy')endpoint=prefix+'/products';
 if(source.id==='grostore')endpoint=prefix+'/products';
 if(source.id==='martvill')endpoint=prefix+'/api/user/products?from=web&showing=100';
 if(source.id==='footstep')endpoint=prefix+'/api/products';
 const catalog=await request(endpoint,{headers:{accept:'application/json','X-Requested-With':'XMLHttpRequest','X-Api-Key':source.id==='shopperzz'?apiKey:''}});const catalogBody=await catalog.text();checks.catalogStatus=catalog.status;checks.location=catalog.headers.get('location');checks.matchedNames=snapshot.products.filter(p=>p.status==='active'&&catalogBody.includes(p.name)).map(p=>p.name);
 report.push({source:source.id,homepage:r.status,assetCount:assets.length,failedAssets:failed,admin:admin.status,cookie:'ultimate_native_'+source.id,checks});console.log(source.id+': public/admin '+r.status+'/'+admin.status+', assets '+assets.length+', failures '+failed.length+', catalog '+catalog.status+', shared names '+checks.matchedNames.length);
}
fs.writeFileSync(path.join(root,'data/native-verification.json'),JSON.stringify(report,null,2));assert(report.every(r=>!r.failedAssets.length),'Some source assets failed; inspect data/native-verification.json');assert(report.every(r=>r.checks.catalogStatus===200&&r.checks.matchedNames.length>=8),'Some source catalogs do not show the shared data');console.log('All source engines verified through the unified gateway.');
