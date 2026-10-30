import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {root,sites} from './sites.mjs';

export function buildVercel(destination=path.join(root,'dist')) {
  fs.mkdirSync(destination,{recursive:true});
  // Copy an explicit public allowlist. Never publish the repository or runtime data.
  for(const file of ['index.html','app.js','styles.css','installer-ui.js','cloud-library.js'])fs.copyFileSync(path.join(root,'public',file),path.join(destination,file));
  const index=path.join(destination,'index.html');
  fs.writeFileSync(index,fs.readFileSync(index,'utf8').replace('<html lang="en">','<html lang="en" data-runtime="cloud">'));
  fs.mkdirSync(path.join(destination,'cloud'),{recursive:true});
  const catalog=sites.map(site=>({
    id:site.id,name:site.name,subtitle:site.subtitle,title:site.sourceTitle||site.subtitle,
    initials:site.initials,color:site.color,category:site.category,description:site.description,
    features:site.features,source:site.id==='sohag'?'Footstep source installation':site.source,
    blocked:site.blocked||null,admin:site.admin||null,duplicateCount:site.duplicateCount,
    url:null,demoSupported:false,requiresHosting:true,status:site.blocked?'blocked':'offline',
    detail:site.blocked||'This application needs a hosted backend. Its local server is not part of this Vercel deployment.'
  }));
  fs.writeFileSync(path.join(destination,'cloud/catalog.json'),JSON.stringify({mode:'cloud',sites:catalog},null,2));
  return catalog;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const catalog=buildVercel();console.log(`Built Vercel library interface: ${catalog.length} websites. Native portals and ZIP installation require the application backend.`);
}
