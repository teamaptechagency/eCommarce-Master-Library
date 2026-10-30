import fs from 'node:fs';import path from 'node:path';import {root} from './sources.mjs';
const registry=JSON.parse(fs.readFileSync(path.join(root,'data/native-sources.json'),'utf8'));
for(const source of registry){
 for(const entry of fs.readdirSync(source.source,{withFileTypes:true})){
  if(!entry.isDirectory()||['vendor','node_modules','storage','bootstrap','.git'].includes(entry.name))continue;
  const destination=path.join(source.engine,entry.name);
  if(fs.existsSync(destination)&&fs.lstatSync(destination).isSymbolicLink()){
   if(!path.resolve(destination).startsWith(path.resolve(source.engine)+path.sep))throw Error('Invalid isolated destination');
   fs.unlinkSync(destination); // Remove only the directory junction, never its source tree.
  }
  fs.cpSync(path.join(source.source,entry.name),destination,{recursive:true,force:false,errorOnExist:false,filter:src=>!(entry.name==='public'&&path.relative(path.join(source.source,'public'),src).split(path.sep)[0]==='storage')});
 }
 for(const file of ['installed','oauth-private.key','oauth-public.key']){const src=path.join(source.source,'storage',file);if(fs.existsSync(src))fs.copyFileSync(src,path.join(source.engine,'storage',file));}
 console.log(source.id+': application code, templates and public files isolated');
}
