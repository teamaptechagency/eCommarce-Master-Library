import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {root,sources} from './sources.mjs';
fs.mkdirSync(path.join(root,'data/native-engines'),{recursive:true});
const imported=[];
function copyTree(from,to,manifest){
 if(!fs.existsSync(from))return;
 for(const entry of fs.readdirSync(from,{withFileTypes:true})){
  const src=path.join(from,entry.name),dst=path.join(to,entry.name);
  if(entry.isDirectory()){fs.mkdirSync(dst,{recursive:true});copyTree(src,dst,manifest)}
  else if(entry.isFile()){
   fs.mkdirSync(path.dirname(dst),{recursive:true});fs.copyFileSync(src,dst);
   const hash=crypto.createHash('sha256').update(fs.readFileSync(src)).digest('hex');
   if(hash!==crypto.createHash('sha256').update(fs.readFileSync(dst)).digest('hex'))throw Error('Source copy mismatch: '+src);
   manifest.push({source:src,copy:dst,sha256:hash});
  }
 }
}
for(const source of sources){
 const engine=source.engine;fs.mkdirSync(engine,{recursive:true});
 for(const entry of fs.readdirSync(source.source,{withFileTypes:true})){
  if(entry.name==='storage'||entry.name==='bootstrap'||entry.name==='.env'||entry.name.startsWith('.env.'))continue;
  const dst=path.join(engine,entry.name);if(fs.existsSync(dst))continue;
  if(entry.isDirectory())fs.symlinkSync(path.join(source.source,entry.name),dst,'junction');
  else if(entry.isFile()&&!entry.name.endsWith('.zip'))fs.copyFileSync(path.join(source.source,entry.name),dst);
 }
 fs.mkdirSync(path.join(engine,'bootstrap/cache'),{recursive:true});
 for(const f of fs.readdirSync(path.join(source.source,'bootstrap'))){const p=path.join(source.source,'bootstrap',f);if(fs.statSync(p).isFile())fs.copyFileSync(p,path.join(engine,'bootstrap',f));}
 for(const folder of ['framework/views','framework/cache/data','framework/sessions','logs','app/public','app/purifier']){const p=path.join(engine,'storage',folder);fs.mkdirSync(p,{recursive:true});fs.chmodSync(p,0o777);}
 const marker=path.join(engine,'.source-import.json');
 if(!fs.existsSync(marker)){
  const manifest=[];const snapshot=path.join(root,'data/source-templates',source.id);
  for(const folder of ['resources/views','resources/js','platform/themes','platform/core/base/resources/views','platform/core/dashboard/resources/views','Modules/CMS/Resources/views'])copyTree(path.join(source.source,folder),path.join(snapshot,folder),manifest);
  fs.writeFileSync(marker,JSON.stringify({source:source.source,files:manifest},null,2));
 }
 const env=path.join(engine,'.env');if(!fs.existsSync(env))fs.copyFileSync(path.join(source.source,'.env'),env);
 imported.push({...source,ownership:crypto.createHash('sha256').update(root+'|'+source.id).digest('hex')});
 console.log(source.id+': original template snapshot verified; isolated engine prepared');
}
fs.writeFileSync(path.join(root,'data/native-sources.json'),JSON.stringify(imported,null,2));
