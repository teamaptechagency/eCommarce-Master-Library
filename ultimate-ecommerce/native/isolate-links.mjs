import fs from 'node:fs';import path from 'node:path';import {root} from './sources.mjs';
const sources=JSON.parse(fs.readFileSync(path.join(root,'data/native-sources.json'),'utf8'));
for(const source of sources){let count=0;function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(dir===source.engine&&['vendor','node_modules'].includes(entry.name))continue;
 const stat=fs.lstatSync(file);if(stat.isSymbolicLink()){
  const original=fs.realpathSync(file);const relative=path.relative(source.source,original);if(relative.startsWith('..')||path.isAbsolute(relative))continue;
  const target=path.resolve(source.engine,relative);if(!target.startsWith(path.resolve(source.engine)+path.sep)||!fs.existsSync(target))continue;
  fs.unlinkSync(file);fs.symlinkSync(target,file,fs.statSync(target).isDirectory()?'junction':'file');count++;
 }else if(stat.isDirectory())walk(file);
 }}walk(source.engine);console.log(source.id+': '+count+' internal asset links point to the isolated copy');}
