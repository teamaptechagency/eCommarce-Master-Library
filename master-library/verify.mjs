import fs from 'node:fs';
import { sites, root } from './sites.mjs';
import path from 'node:path';
const report=[];
for(const site of sites.filter(s=>!s.blocked)) {
  try {
    const first=await fetch('http://127.0.0.1:8090/demo/'+site.id,{redirect:'manual',signal:AbortSignal.timeout(20000)});
    const bridge=await fetch(first.headers.get('location'),{redirect:'manual',signal:AbortSignal.timeout(20000)});
    let body=await bridge.text();
    let target=bridge.headers.get('location');
    const cookies=bridge.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
    let status=bridge.status;
    if(target) {
      const next=await fetch(new URL(target,'http://127.0.0.1:'+site.port),{headers:{Cookie:cookies},redirect:'manual',signal:AbortSignal.timeout(20000)});
      body=await next.text();status=next.status;
      if(next.headers.get('location'))target=next.headers.get('location');
    }
    report.push({id:site.id,status,session:!!cookies,scriptLogin:body.includes('location.replace('),title:(body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'').trim(),redirect:target,bodyExcerpt:status>=400?body.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').slice(0,220):undefined});
    if(status!==200||!cookies||(['sohag','shopperzz'].includes(site.kind)?!body.includes('location.replace('):!/dashboard/i.test(report.at(-1).title)))process.exitCode=1;
  } catch(e) {report.push({id:site.id,error:e.message})}
}
console.log(JSON.stringify(report,null,2));
fs.writeFileSync(path.join(root,'data/demo-verification.json'),JSON.stringify(report,null,2));
