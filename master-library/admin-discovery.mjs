import fs from 'node:fs';
import path from 'node:path';
const read=(app,file)=>{const full=path.join(app,file);return fs.existsSync(full)&&fs.statSync(full).size<2*1024**2?fs.readFileSync(full,'utf8'):'';};
export const adminPortalRoutes=site=>[{path:'/',name:'public.home',label:'Storefront',access:'public',parameterized:false},...(site.admin?[{path:site.admin,name:'admin.dashboard',label:'Admin dashboard',access:'admin',parameterized:false},...(site.adminTabs||[]).map(tab=>({path:site.admin+'?tab='+encodeURIComponent(tab),name:'admin.'+tab,label:tab.replace(/[_-]/g,' ').replace(/\b\w/g,c=>c.toUpperCase()),access:'admin',parameterized:false}))]:[])];
export function discoverAdmin(app,type){
  const application=read(app,'src/App.tsx'),context=read(app,'src/context/StoreContext.tsx'),dashboard=read(app,'src/components/AdminDashboard.tsx'),sdk=read(app,'src/lib/supabase.ts');
  let profile;
  if(dashboard&&sdk&&/const \[isAdmin, setIsAdmin\]/.test(application)&&/supabase\.auth\.getUser/.test(application)&&/isAdminOpen|['"]\/admin['"]/.test(application))profile='supabase-direct';
  else if(dashboard&&sdk&&/useStore/.test(application)&&/useState<UserProfile \| null>/.test(context)&&/isRoleVerified/.test(context)&&/isAdminDashboardOpen/.test(context))profile='supabase-context';
  const tabs=new Set();
  for(const union of dashboard.matchAll(/type\s+(?:TabKey|Page)\s*=\s*([^;]+);/g))for(const key of union[1].matchAll(/['"]([\w-]+)['"]/g))tabs.add(key[1]);
  for(const key of dashboard.matchAll(/(?:activeTab|page)\s*===\s*['"]([\w-]+)['"]/g))tabs.add(key[1]);
  if(profile)return {path:'/admin',profile,tabs:[...tabs]};
  for(const [file,route]of [['wp-admin/index.php','/wp-admin/'],['public/admin/index.php','/admin/'],['admin/index.php','/admin/'],['admin/index.html','/admin/'],['public/admin/index.html','/admin/'],['admin.php','/admin.php'],['admin.html','/admin.html']])if(fs.existsSync(path.join(app,file)))return {path:route,tabs:[]};
  const router=application+'\n'+read(app,'src/App.jsx')+'\n'+read(app,'src/router.tsx')+'\n'+read(app,'routes/web.php')+'\n'+read(app,'routes/admin.php');
  if(/(?:path\s*[:=]\s*|prefix\(\s*)['"]\/?admin(?:\/|['"])/.test(router))return {path:'/admin',tabs:[]};
  return {path:null,tabs:[]};
}
export function prepareAdminDemo({app,directory,profile,root,log=()=>{}}){
  const originals=path.join(directory,'admin-originals');
  const original=file=>{const snapshot=path.join(originals,file),current=path.join(app,file);fs.mkdirSync(path.dirname(snapshot),{recursive:true});if(!fs.existsSync(snapshot))fs.copyFileSync(current,snapshot);return fs.readFileSync(snapshot,'utf8');};
  const sdk='src/lib/supabase.ts';original(sdk);
  if(profile==='supabase-direct'){
    let application=original('src/App.tsx');
    application=application.replace('useState<any>(null)','useState<any>((window as any).__MASTER_LIBRARY_DEMO__?.user || null)');
    application=application.replace('const [isAdmin, setIsAdmin] = useState(false);',"const [isAdmin, setIsAdmin] = useState(Boolean((window as any).__MASTER_LIBRARY_DEMO__?.user?.role === 'admin'));");
    application=application.replace('const checkAdminRole = async (userId: string) => {','async function checkAdminRole(userId: string) {');
    fs.writeFileSync(path.join(app,'src/App.tsx'),application);
    fs.copyFileSync(path.join(root,'local-supabase.mjs'),path.join(app,'src/lib/library-local-supabase.js'));
    const fixture=fs.existsSync(path.join(app,'src/data/mockProducts.ts'))?"import * as fixtures from '../data/mockProducts';":"const fixtures: any = {};";
    fs.writeFileSync(path.join(app,sdk),`import {createLocalSupabase} from './library-local-supabase.js';\n${fixture}\nconst demo=(window as any).__MASTER_LIBRARY_DEMO__||{};\nexport const supabase:any=createLocalSupabase({storage:localStorage,user:demo.user,csrf:demo.csrf,seed:{products:(fixtures as any).MOCK_PRODUCTS||[],categories:(fixtures as any).MOCK_CATEGORIES||[],banners:(fixtures as any).MOCK_BANNERS||[],delivery_zones:(fixtures as any).MOCK_DELIVERY_ZONES||[],coupons:(fixtures as any).MOCK_COUPONS||[]}});\n`);
  }else if(profile==='supabase-context'){
    let context=original('src/context/StoreContext.tsx');
    context=context.replace('const StoreContext = createContext',"const serverDemoUser=(window as any).__MASTER_LIBRARY_DEMO__?.user as UserProfile | undefined;\nconst StoreContext = createContext");
    context=context.replace('useState<UserProfile | null>(() => {','useState<UserProfile | null>(() => {\n    if(serverDemoUser) return serverDemoUser;');
    context=context.replace('const [isRoleVerified, setIsRoleVerified] = useState(false);','const [isRoleVerified, setIsRoleVerified] = useState(Boolean(serverDemoUser));');
    context=context.replace('const [isAdminDashboardOpen, setIsAdminDashboardOpen] = useState(false);',"const [isAdminDashboardOpen, setIsAdminDashboardOpen] = useState(Boolean(serverDemoUser && location.pathname.startsWith('/admin')));");
    context=context.replace('const logout = () => {',"const logout = () => {\n    fetch('/__master/logout',{method:'POST',headers:{'X-Master-CSRF':(window as any).__MASTER_LIBRARY_DEMO__?.csrf||''}}).then(()=>location.assign('/')); ");
    if(!context.includes('const serverDemoUser=')||!context.includes('if(serverDemoUser) return serverDemoUser;')||!context.includes('useState(Boolean(serverDemoUser))'))throw Error('This source needs an updated context admin adapter.');
    fs.writeFileSync(path.join(app,'src/context/StoreContext.tsx'),context);
    let adapter=fs.readFileSync(path.join(root,'react-local-adapter.ts'),'utf8');
    adapter+="\nexport const supabaseUrl='';export const supabaseAnonKey='';export const uploadBrandOrReviewImage=uploadImageToSupabase;\n";
    fs.writeFileSync(path.join(app,sdk),adapter);
    const dashboard='src/components/AdminDashboard.tsx';let code=original(dashboard);
    const tabs=discoverAdmin(app,'vite').tabs;
    code=code.replace(/useState<TabKey>\('orders'\)/,`useState<TabKey>(((${JSON.stringify(tabs)} as string[]).includes(new URLSearchParams(location.search).get('tab')||'')?new URLSearchParams(location.search).get('tab'):'orders') as TabKey)`);
    fs.writeFileSync(path.join(app,dashboard),code);
  }else throw Error('Unknown local admin adapter.');
  log('Prepared password-free local admin demo using the original dashboard. Source snapshots are private; database changes use local demo storage.');
}
