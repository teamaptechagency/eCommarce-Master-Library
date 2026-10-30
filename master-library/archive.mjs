import fs from 'node:fs';
import path from 'node:path';
import {pipeline} from 'node:stream/promises';
import yauzl from 'yauzl';

// Never let an archive choose a path outside its private installation directory.
export function archivePath(name) {
  const parts=name.replaceAll('\\','/').split('/');
  if(!name||name.startsWith('/')||parts.some(p=>p==='..'||p==='.'||p.includes(':')||/[\x00-\x1f]/.test(p)||/[. ]$/.test(p)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p)))throw Error('Unsafe ZIP entry: '+name);
  return parts.filter(Boolean).join(path.sep);
}
export async function extractZip(file,destination,{maxFiles=60000,maxBytes=3*1024**3}={}) {
  const zip=await new Promise((resolve,reject)=>yauzl.open(file,{lazyEntries:true,validateEntrySizes:true},(error,value)=>error?reject(error):resolve(value)));
  let count=0,bytes=0;
  await fs.promises.mkdir(destination,{recursive:true});
  return new Promise((resolve,reject)=>{
    let ended=false;
    const fail=error=>{if(ended)return;ended=true;zip.close();reject(error)};
    zip.on('error',fail);
    zip.on('end',()=>{if(!ended){ended=true;resolve({count,bytes})}});
    zip.on('entry',async entry=>{
      try{
        if(++count>maxFiles||(bytes+=entry.uncompressedSize)>maxBytes)throw Error('ZIP exceeds the extraction limit (60,000 files / 3 GB).');
        if((entry.externalFileAttributes>>>16&0xf000)===0xa000)throw Error('ZIP symbolic links are not supported.');
        const target=path.join(destination,archivePath(entry.fileName));
        if(entry.fileName.endsWith('/'))await fs.promises.mkdir(target,{recursive:true});
        else {
          await fs.promises.mkdir(path.dirname(target),{recursive:true});
          const stream=await new Promise((resolve,reject)=>zip.openReadStream(entry,(e,s)=>e?reject(e):resolve(s)));
          await pipeline(stream,fs.createWriteStream(target,{flags:'wx'}));
        }
        if(!ended)zip.readEntry();
      }catch(e){fail(e)}
    });
    zip.readEntry();
  });
}
