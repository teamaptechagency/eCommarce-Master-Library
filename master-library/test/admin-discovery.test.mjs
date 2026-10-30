import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {discoverAdmin,prepareAdminDemo,adminPortalRoutes} from '../admin-discovery.mjs';
import {root} from '../sites.mjs';
const temporary=t=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'master-admin-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;};
const write=(app,file,source)=>{fs.mkdirSync(path.dirname(path.join(app,file)),{recursive:true});fs.writeFileSync(path.join(app,file),source)};
test('supported direct Supabase dashboard is discovered and adapted without changing dashboard markup',t=>{
  const directory=temporary(t),app=path.join(directory,'source');
  write(app,'src/App.tsx',"const [user, setUser] = useState<any>(null);const [isAdmin, setIsAdmin] = useState(false);const isAdminOpen=true;supabase.auth.getUser();");
  const dashboard="type Page = 'dashboard' | 'orders' | 'products' | 'courier';export const AdminDashboard=()=>null;";write(app,'src/components/AdminDashboard.tsx',dashboard);write(app,'src/lib/supabase.ts','export const supabase=originalRemoteClient;');
  const result=discoverAdmin(app,'vite');assert.equal(result.profile,'supabase-direct');assert.equal(result.path,'/admin');assert.deepEqual(result.tabs,['dashboard','orders','products','courier']);
  prepareAdminDemo({app,directory,root,profile:result.profile});assert.match(fs.readFileSync(path.join(app,'src/lib/supabase.ts'),'utf8'),/createLocalSupabase/);assert.match(fs.readFileSync(path.join(app,'src/App.tsx'),'utf8'),/__MASTER_LIBRARY_DEMO__/);assert.equal(fs.readFileSync(path.join(app,'src/components/AdminDashboard.tsx'),'utf8'),dashboard);
  const first=fs.readFileSync(path.join(app,'src/App.tsx'),'utf8');prepareAdminDemo({app,directory,root,profile:result.profile});assert.equal(fs.readFileSync(path.join(app,'src/App.tsx'),'utf8'),first);
});
test('physical admin paths work and a dashboard component alone does not invent an admin route',t=>{
  const app=temporary(t);write(app,'src/components/AdminDashboard.tsx','export const AdminDashboard=()=>null');assert.equal(discoverAdmin(app,'vite').path,null);
  write(app,'admin/index.html','<h1>Admin</h1>');assert.equal(discoverAdmin(app,'static').path,'/admin/');
  assert.equal(adminPortalRoutes({admin:'/admin',adminTabs:['orders','products']}).filter(route=>route.access==='admin').length,3);
});
