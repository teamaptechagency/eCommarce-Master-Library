import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';import {root} from './sites.mjs';
const imports=JSON.parse(fs.readFileSync(path.join(root,'new-sites.json'),'utf8'));const apps=[...new Set(imports.filter(s=>s.kind==='react-demo').map(s=>path.resolve(root,s.app)))];
for(const app of apps){const child=spawnSync(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),'build','--config','library.vite.config.mjs'],{cwd:app,windowsHide:true,stdio:'inherit'});if(child.status!==0)throw Error('Imported source build failed: '+app);
 const photos=path.join(app,'src/assets/images');if(fs.existsSync(photos))fs.cpSync(photos,path.join(app,'dist/src/assets/images'),{recursive:true});
 const sql=path.join(app,'supabase_schema.sql');if(fs.existsSync(sql))fs.copyFileSync(sql,path.join(app,'dist/supabase_schema.sql'));
}console.log(apps.length+' original React previews built.');
