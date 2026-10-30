import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {root} from './sites.mjs';
const cookies=new Map();
async function request(url,extraHeaders={}){
  const response=await fetch(url,{redirect:'manual',headers:{Connection:'close',Cookie:[...cookies].map(([k,v])=>k+'='+v).join('; '),...extraHeaders},signal:AbortSignal.timeout(20000)});
  for(const line of response.headers.getSetCookie()){
    const pair=line.split(';')[0];const split=pair.indexOf('=');cookies.set(pair.slice(0,split),pair.slice(split+1));
  }
  const body=await response.text();
  return {status:response.status,headers:response.headers,text:async()=>body};
}
for(const id of ['nest','shofy']){
  let response=await request('http://127.0.0.1:8090/demo/'+id);
  for(let i=0;i<5&&response.status===302;i++)response=await request(response.headers.get('location'));
  assert.equal(response.status,200,id+' demo login');
}
assert(cookies.has('master_nest_session'),'Nest must use its own session cookie');
assert(cookies.has('master_shofy_session'),'Shofy must use its own session cookie');
const report=[];
for(const [id,port] of [['nest',8114],['shofy',8125]]){
  const origin='http://127.0.0.1:'+port;
  const response=await request(origin+'/admin/ecommerce/products');
  const html=await response.text();
  assert.equal(response.status,200,id+' product page must retain login');
  assert.match(html,/<title>\s*Products\s*\|/,id+' product page title');
  const assets=[...html.matchAll(/(?:href|src)=["']([^"']*\/vendor\/[^"']+\.(?:css|js)(?:\?[^"']*)?)["']/g)].slice(0,6).map(m=>m[1]);
  assert(assets.length>0,id+' admin assets were found');
  for(const asset of assets){
    const result=await request(new URL(asset,origin));
    assert.equal(result.status,200,id+' public admin asset');
    assert.match(result.headers.get('content-type')||'',/css|javascript/,id+' asset MIME type');
  }
  const grid=await request(origin+'/admin/ecommerce/products?draw=1&start=0&length=10',{'X-Requested-With':'XMLHttpRequest',Accept:'application/json'});
  const gridData=JSON.parse(await grid.text());
  assert.equal(grid.status,200,id+' product grid request');
  assert(!gridData.error,id+' product grid: '+gridData.error);
  assert(gridData.data?.length>0,id+' product grid must include product rows');
  report.push({id,productPage:response.status,isolatedSession:true,publicAssetsChecked:assets.length,gridTotal:gridData.recordsTotal,gridRows:gridData.data.length});
}
const privateVendor=await request('http://127.0.0.1:8102/vendor/autoload.php');
assert.equal(privateVendor.status,404,'Private PHP dependencies must stay inaccessible');
console.log(JSON.stringify(report,null,2));
fs.writeFileSync(path.join(root,'data/botble-verification.json'),JSON.stringify(report,null,2));
