import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8').replace(/^\uFEFF/,''));const write=(file,data)=>fs.writeFileSync(path.join(root,file),JSON.stringify(data,null,2));
const result=read('data/duplicate-removal-result.json');if(!result.Completed)throw Error('Duplicate removal did not finish');
const names=new Set(result.Kept.map(a=>a.Name));const keepPaths=new Set([...names].map(n=>'New/'+n));const sites=read('new-sites.json');const removed=sites.filter(s=>!keepPaths.has(s.source));
const retained=sites.filter(s=>keepPaths.has(s.source)).map(s=>({...s,duplicateCount:1,description:s.blocked?s.description:'Original storefront and admin with a local browser demo. One archive copy retained.'}));
if(retained.length!==names.size)throw Error('Retained archive/catalog mismatch');
for(const site of retained){const name=site.source.slice(4);if(!fs.existsSync(path.join(result.Root,name)))throw Error('Retained archive is missing: '+name);}
write('new-sites.json',retained);
write('data/new-archive-inventory.json',read('data/new-archive-inventory.json').filter(a=>names.has(a.Name)));
const imports=read('data/new-imports.json').map(i=>({...i,Archives:i.Archives.filter(n=>names.has(n))})).filter(i=>i.Archives.length);write('data/new-imports.json',imports);
write('data/new-source-provenance.json',imports.map(i=>({source:i.Directory,hash:i.Hash,filenames:i.Archives,runnable:i.Runnable})));
write('data/removed-clone-entries.json',removed.map(s=>({id:s.id,name:s.name,archive:s.source,archiveHash:s.archiveHash})));
for(const site of removed){if(!/^new-[a-z0-9-]+$/.test(site.id))throw Error('Invalid cached route ID');const file=path.join(root,'data',site.id+'-routes.json');if(fs.existsSync(file))fs.unlinkSync(file);}
console.log('Removed '+removed.length+' duplicate library entries; kept '+retained.length+' unique archive entries.');
