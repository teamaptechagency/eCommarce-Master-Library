import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));const readJson=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
const imports=readJson(path.join(root,'data/new-imports.json'));const inventory=readJson(path.join(root,'data/new-archive-inventory.json'));
const registry=[];let port=8401;
for(const entry of imports){
 let app;let sourceTitle;let metadata={};try{metadata=readJson(path.join(entry.Directory,'metadata.json'))}catch{}
 if(entry.Runnable){
  app=path.join(root,'data/new-apps',entry.Hash.slice(0,12).toLowerCase());
  fs.cpSync(entry.Directory,app,{recursive:true,force:false,errorOnExist:false});
  const originals=path.join(app,'.library-originals');fs.mkdirSync(originals,{recursive:true});
  for(const file of ['src/lib/supabase.ts','src/context/StoreContext.tsx','src/components/AdminDashboard.tsx']){
   const src=path.join(entry.Directory,file);const dst=path.join(originals,file);fs.mkdirSync(path.dirname(dst),{recursive:true});if(!fs.existsSync(dst))fs.copyFileSync(src,dst);
  }
  fs.copyFileSync(path.join(root,'react-local-adapter.ts'),path.join(app,'src/lib/supabase.ts'));
  let context=fs.readFileSync(path.join(originals,'src/context/StoreContext.tsx'),'utf8');
  context=context.replace("const StoreContext = createContext", "const serverDemoUser = (window as any).__MASTER_LIBRARY_DEMO__?.user as UserProfile | undefined;\nconst StoreContext = createContext");
  context=context.replace('useState<UserProfile | null>(() => {','useState<UserProfile | null>(() => {\n    if (serverDemoUser) return serverDemoUser;');
  context=context.replace('const [isRoleVerified, setIsRoleVerified] = useState(false);','const [isRoleVerified, setIsRoleVerified] = useState(Boolean(serverDemoUser));');
  context=context.replace('const [isAdminDashboardOpen, setIsAdminDashboardOpen] = useState(false);',"const [isAdminDashboardOpen, setIsAdminDashboardOpen] = useState(Boolean(serverDemoUser && location.pathname.startsWith('/admin')));");
  context=context.replace('const logout = () => {',"const logout = () => {\n    if (!isSupabaseConfigured) fetch('/__master/logout',{method:'POST',headers:{'X-Master-CSRF':(window as any).__MASTER_LIBRARY_DEMO__?.csrf||''}}).then(()=>location.assign('/')); ");
  fs.writeFileSync(path.join(app,'src/context/StoreContext.tsx'),context);
  let dashboard=fs.readFileSync(path.join(originals,'src/components/AdminDashboard.tsx'),'utf8');
  dashboard=dashboard.replace(">('orders');",">((['orders','products','banners','tracking','settings','sql'].includes(new URLSearchParams(location.search).get('tab')||'')?new URLSearchParams(location.search).get('tab'):'orders') as any);");
  fs.writeFileSync(path.join(app,'src/components/AdminDashboard.tsx'),dashboard);
  let application=fs.readFileSync(path.join(entry.Directory,'src/App.tsx'),'utf8');
  application=application.replace('    showToast,','    showToast,\n    setIsCartOpen,\n    openTrackOrder,');
  application=application.replace('  // Strict route & hash guard',"  useEffect(()=>{const portal=new URLSearchParams(location.search).get('portal');if(portal==='cart')setIsCartOpen(true);if(portal==='track')openTrackOrder();},[]);\n\n  // Strict route & hash guard");
  fs.writeFileSync(path.join(app,'src/App.tsx'),application);
  // A separate build config leaves the supplied Vite configuration unchanged.
  fs.writeFileSync(path.join(app,'library.vite.config.mjs'),`import {defineConfig} from 'vite';import react from '@vitejs/plugin-react';import tailwind from '@tailwindcss/vite';export default defineConfig({plugins:[react(),tailwind()],build:{outDir:'dist',emptyOutDir:true},resolve:{alias:{'@':${JSON.stringify(app)}}}});`);
  sourceTitle=fs.readFileSync(path.join(entry.Directory,'index.html'),'utf8').match(/<title>(.*?)<\/title>/)?.[1]||metadata.name;
 }
 for(const archive of entry.Archives){
  const basename=archive.replace(/\.zip$/i,'');let name=basename.replace(/\{ZIP\}|\bfull(?: source code)?\b|\bsource code\b|\bzip(?: file| code)?\b|primium theme/ig,'').replace(/[-_]+$/,'').replace(/\s+/g,' ').trim();
  if(/^theme_/.test(name))name=metadata.name+' · '+basename;
  const slug=basename.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');const id='new-'+slug;
  registry.push({id,name,subtitle:entry.Runnable?metadata.name+' · imported React source':metadata.name+' · incomplete archive',initials:name.split(/\s+/).slice(0,2).map(n=>n[0]).join('').toUpperCase().slice(0,2),color:entry.Runnable?'#377b4e':'#8a8790',app:app?path.relative(root,app).split(path.sep).join('/'):undefined,port:entry.Runnable?port:undefined,admin:'/admin',kind:entry.Runnable?'react-demo':'unavailable',category:entry.Runnable?'New imports':'Needs setup',description:entry.Runnable?(entry.Archives.length>1?'Identical source archive shared by '+entry.Archives.length+' filenames. Original storefront and admin with a local browser demo.':'Original storefront and admin with a local browser demo.'):'The archive contains setup files but no src/main.tsx, components or application source.',features:entry.Runnable?['Storefront','Products','Cart & checkout','Orders','Admin demo','Banners']:[],source:'New/'+archive,sourceTitle,archiveHash:entry.Hash,duplicateCount:entry.Archives.length,blocked:entry.Runnable?undefined:'Missing src/main.tsx and the entire src directory. The supplied ZIP cannot run without its application files.'});
 }
 if(entry.Runnable)port++;
}
if(new Set(registry.map(s=>s.id)).size!==registry.length)throw Error('Archive IDs are not unique');
fs.writeFileSync(path.join(root,'new-sites.json'),JSON.stringify(registry,null,2));
const audit=imports.map(i=>({source:i.Directory,hash:i.Hash,filenames:i.Archives,runnable:i.Runnable}));fs.writeFileSync(path.join(root,'data/new-source-provenance.json'),JSON.stringify(audit,null,2));
console.log('Prepared '+registry.length+' archive entries; '+imports.filter(i=>i.Runnable).length+' unique runnable sources; '+imports.filter(i=>!i.Runnable).length+' incomplete archive.');
