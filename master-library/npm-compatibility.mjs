import fs from 'node:fs';
import path from 'node:path';

// Repair the specific peer conflict reported by npm, in the extracted working
// copy only. The uploaded archive and the original manifest remain intact.
export function repairViteEsbuildPeer({app,backupDirectory,report,log=()=>{}}){
  if(!/\bERESOLVE\b/.test(report||''))return false;
  const peer=report.match(/peer(?:Optional)?\s+esbuild@"([^"]+)"\s+from\s+vite@(\d+\.\d+\.\d+(?:-[\w.-]+)?)/);
  if(!peer||!/^\s*[\d\s.^~<>=|*+-]+\s*$/.test(peer[1]))return false;
  const manifest=path.join(app,'package.json'),source=fs.readFileSync(manifest,'utf8'),pkg=JSON.parse(source);
  if(!pkg.dependencies?.vite&&!pkg.devDependencies?.vite)return false;
  const sections=['dependencies','devDependencies','optionalDependencies'].filter(section=>pkg[section]?.esbuild);
  if(!sections.length||sections.some(section=>/^(?:file:|link:|workspace:|npm:|git|https?:)/.test(pkg[section].esbuild)))return false;
  if(sections.every(section=>pkg[section].esbuild===peer[1]))return false;
  fs.mkdirSync(backupDirectory,{recursive:true});
  for(const file of ['package.json','package-lock.json']){
    const original=path.join(app,file),backup=path.join(backupDirectory,file+'.before-peer-repair');
    if(fs.existsSync(original)&&!fs.existsSync(backup))fs.copyFileSync(original,backup,fs.constants.COPYFILE_EXCL);
  }
  const previous=[...new Set(sections.map(section=>pkg[section].esbuild))].join(', ');
  for(const section of sections)pkg[section].esbuild=peer[1];
  fs.writeFileSync(manifest,JSON.stringify(pkg,null,2)+'\n');
  log(`Compatibility repair: esbuild ${previous} → ${peer[1]}, required by vite@${peer[2]}. Original package files saved privately. Retrying npm with peer validation enabled.`);
  return true;
}
