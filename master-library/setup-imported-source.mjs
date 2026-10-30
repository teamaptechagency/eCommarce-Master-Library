import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));const sources=JSON.parse(fs.readFileSync(path.join(root,'new-sites.json'),'utf8'));
for(const source of sources.filter(s=>s.kind==='react-demo')){
 const destination=path.resolve(root,source.app);if(!destination.startsWith(path.join(root,'data/new-apps')+path.sep))throw Error('Unexpected imported source path');
 fs.mkdirSync(destination,{recursive:true});fs.cpSync(path.join(root,'templates/tuktak-shopping'),destination,{recursive:true,force:false,errorOnExist:false});
 fs.writeFileSync(path.join(destination,'library.vite.config.mjs'),`import {defineConfig} from 'vite';import react from '@vitejs/plugin-react';import tailwind from '@tailwindcss/vite';import path from 'node:path';import {fileURLToPath} from 'node:url';export default defineConfig({plugins:[react(),tailwind()],resolve:{alias:{'@':path.dirname(fileURLToPath(import.meta.url))}},build:{outDir:'dist',emptyOutDir:true}});`);
}
const build=spawnSync(process.execPath,[path.join(root,'build-new-sites.mjs')],{cwd:root,stdio:'inherit',windowsHide:true});if(build.status!==0)throw Error('Imported source build failed');
