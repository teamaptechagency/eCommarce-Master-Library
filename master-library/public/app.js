import {openSetup} from '/installer-ui.js';
import {cloudMode,loadCloudCatalog,showCloudSetup} from '/cloud-library.js';
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const escape = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let sites=[], routes={}, view='all', status='all', category='', activeSite, access='all', currentUrl='', adminMode=false;
let favorites;try{favorites=JSON.parse(localStorage.getItem('commerce-library-favorites')||'[]')}catch{favorites=[]}
if(!Array.isArray(favorites))favorites=[];
const names={all:'All websites',public:'Public portals',admin:'Admin demos',blocked:'Install / Setup',favorites:'Favorites'};
function setSidebarHidden(hidden,persist=true){
  document.body.classList.toggle('library-sidebar-hidden',hidden);
  $('#library-sidebar').hidden=hidden;
  const button=$('#sidebar-toggle');
  button.setAttribute('aria-expanded',String(!hidden));
  button.setAttribute('aria-label',hidden?'Show library sidebar':'Hide library sidebar');
  button.title=hidden?'Show library sidebar':'Hide library sidebar';
  if(persist)try{localStorage.setItem('commerce-library-sidebar-hidden',String(hidden))}catch{}
}
try{setSidebarHidden(localStorage.getItem('commerce-library-sidebar-hidden')==='true',false)}catch{}
$('#sidebar-toggle').addEventListener('click',()=>setSidebarHidden(!$('#library-sidebar').hidden));
function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').hidden=true,4000)}
function titleCase(value){return value.replace(/[._/-]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}
function render(){
  const online=sites.filter(s=>s.status==='online').length;
  $('#total-count').textContent=sites.length;$('#nav-count').textContent=sites.length;$('#online-count').textContent=online;$('#online-filter-count').textContent=online;
  $('#demo-count').textContent=sites.filter(s=>!s.blocked&&s.admin&&s.demoSupported).length;$('#blocked-count').textContent=sites.filter(s=>s.blocked).length;
  $('#setup-nav-count').textContent=$('#blocked-count').textContent;$('#setup-filter-count').textContent=$('#blocked-count').textContent;
  const term=$('#search').value.trim().toLowerCase();
  const list=sites.filter(s=>{
    if(view==='blocked'&&!s.blocked)return false;
    if(['public','admin'].includes(view)&&s.blocked)return false;
    if(view==='admin'&&!s.admin)return false;
    if(view==='favorites'&&!favorites.includes(s.id))return false;
    if(category&&s.category!==category)return false;
    if(status==='online'&&s.status!=='online')return false;
    if(status==='blocked'&&!s.blocked)return false;
    return !term||[s.name,s.subtitle,s.title,s.description,s.source,...s.features,...(routes[s.id]||[]).map(r=>r.name+' '+r.path)].join(' ').toLowerCase().includes(term);
  });
  $('#collection-title').textContent=category||names[view];$('#result-count').textContent=list.length+' website'+(list.length===1?'':'s');
  $('#site-grid').innerHTML=list.length?list.map(s=>{
    const ready=!s.blocked;const badge=s.blocked?(s.installState==='running'?'Installing':'Install / Setup'):({online:'Online',starting:'Starting',offline:'Offline',error:'Needs attention'}[s.status]||s.status);
    const routeCount=(routes[s.id]||[]).length;
    return `<article class="site-card ${s.blocked?'blocked-card':''}" style="--accent:${s.color}">
      <div class="card-art" ${ready?`data-explore="${s.id}" role="button" tabindex="0" aria-label="Explore ${escape(s.name)}"`:''}><div class="art-grid"></div><div class="art-orbit"></div><div class="card-mark">${s.initials}</div><div class="art-wordmark">${escape(s.name.split(' / ')[0])}<small>${escape(s.category)}</small></div><button class="card-favorite ${favorites.includes(s.id)?'selected':''}" data-favorite="${s.id}" aria-label="${favorites.includes(s.id)?'Remove from':'Add to'} favorites" aria-pressed="${favorites.includes(s.id)}">${favorites.includes(s.id)?'★':'☆'}</button></div>
      <div class="card-body"><div class="card-meta"><span class="card-category">${escape(s.category)}</span><span class="status-badge ${s.status}" title="${escape(s.detail)}"><i></i>${badge}</span></div><h3>${escape(s.name)}</h3><p class="card-subtitle" title="${escape(s.title)}">${escape(s.title||s.subtitle)}</p><p class="card-description">${escape(s.description)}</p>
      <div class="feature-chips">${s.duplicateCount>1?`<span title="These filenames contain identical source bytes">Same source ×${s.duplicateCount}</span>`:''}${s.features.slice(0,4).map(f=>`<span>${escape(f)}</span>`).join('')}${s.features.length>4?`<span>+${s.features.length-4} more</span>`:''}</div>
      ${s.blocked?`<p class="blocked-note">${escape(s.blocked)}</p>`:''}
      <div class="card-actions">${ready?`<button class="button secondary" data-open="${s.id}" data-mode="public">◉ Public portal <span>↗</span></button>${s.admin?`<button class="button primary" data-open="${s.id}" data-mode="admin">◇ ${s.demoSupported?'Admin demo':'Admin portal'} <span>↗</span></button>`:''}`:`<button class="button primary" data-setup="${s.id}">Install / Setup →</button>`}</div>
      <div class="card-footer"><span>${escape(s.source)}</span>${ready?`<button data-explore="${s.id}">${routeCount?routeCount+' pages · ':''}Explore features →</button>${s.managedUpload?`<button data-setup="${s.id}">Setup</button>`:""}`:`<button data-setup="${s.id}">Open setup →</button>`}</div></div></article>`;
  }).join(''):`<div class="empty-state">No websites match this view.<br>Try another search or filter.</div>`;
}
async function load(){
  if(cloudMode)sites=await loadCloudCatalog();
  else {const response=await fetch('/api/sites');sites=response.ok?await response.json():await loadCloudCatalog();if(!Array.isArray(sites))throw Error('Invalid library response');}
  if(activeSite&&!sites.some(s=>s.id===activeSite.id)){const replacement=sites.find(s=>activeSite.archiveHash&&s.archiveHash===activeSite.archiveHash&&!s.blocked);if(replacement)navigatePortal(replacement,adminMode?replacement.admin:'/',adminMode);else back();}
  $('#category-nav').innerHTML=[...new Set(sites.filter(s=>!s.blocked).map(s=>s.category))].map(c=>`<button class="nav-item category-item ${category===c?'active':''}" data-category="${escape(c)}"><span class="category-dot"></span>${escape(c)}</button>`).join('');
  $('#site-select').innerHTML=sites.filter(s=>!s.blocked).map(s=>`<option value="${s.id}">${escape(s.name)}</option>`).join('');if(activeSite)$('#site-select').value=activeSite.id;
  render();
}
async function loadRoutes(){if(cloudMode){render();return;}await Promise.all(sites.filter(s=>!s.blocked).map(async s=>{try{const response=await fetch('/api/routes/'+s.id);if(response.ok)routes[s.id]=await response.json()}catch{}}));render();if(activeSite)renderFeatures()}
function setView(next){view=next;category='';status='all';$('#search').value='';$$('#main-nav .nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===view));$$('#category-nav button').forEach(b=>b.classList.remove('active'));$$('[data-status]').forEach(b=>b.classList.toggle('active',b.dataset.status==='all'));$('#crumb').textContent=names[view];back();render()}
function back(){activeSite=null;$('#collection-view').hidden=false;$('#workspace-view').hidden=true;$('#portal-frame').src='about:blank';history.replaceState(null,'',location.pathname);$('#crumb').textContent=category||names[view]}
function navigatePortal(site,path,admin){
  if(site.requiresHosting){showCloudSetup(site);return;}
  if(site.blocked){toast(site.blocked);return}
  activeSite=site;adminMode=admin;currentUrl=admin&&site.demoSupported?'/demo/'+site.id+'?'+new URLSearchParams({next:path}):site.url+path;
  $('#collection-view').hidden=true;$('#workspace-view').hidden=false;$('#crumb').textContent=site.name;$('#site-select').value=site.id;
  $('#feature-site-name').textContent=site.name;$('#feature-site-title').textContent=site.title||site.subtitle;
  $('#mode-public').classList.toggle('active',!admin);$('#mode-admin').classList.toggle('active',admin);
  $('#mode-admin').hidden=!site.admin;$('#mode-admin').textContent=site.demoSupported?'Admin demo ↗':'Admin portal ↗';
  $('#current-address').textContent=site.url+path+(admin&&site.demoSupported?' · Admin demo session':'');$('#frame-loading').hidden=false;$('#portal-frame').src=currentUrl;
  history.replaceState(null,'','#site='+site.id+(admin?'&mode=admin':''));renderFeatures();
}
function renderFeatures(){
  if(!activeSite)return;
  const term=$('#feature-search').value.trim().toLowerCase();
  const rows=(routes[activeSite.id]||[]).filter(r=>(access==='all'||r.access===access)&&(!term||(r.name+' '+r.path).toLowerCase().includes(term)));
  $('#feature-list').innerHTML=rows.length?rows.map(r=>`<button class="feature-row" data-path="${escape(r.path)}" data-route-access="${r.access}"><span class="feature-access">${r.access==='admin'?'ADMIN':'PUBLIC'}</span><strong>${escape(r.label||titleCase((r.name||r.path).replace(/^(admin|public|site|frontend)[.\/]/,''))||'Homepage')}</strong><small title="${escape(r.path)}">${escape(r.path)}</small></button>`).join(''):'<p class="feature-note">No matching pages. Use the portal navigation to explore this website.</p>';
}
function openFeature(path,admin){
  const matches=[...path.matchAll(/\{([^}]+)\}/g)];
  if(!matches.length){navigatePortal(activeSite,path,admin);return}
  $('#parameter-path').textContent=path;
  $('#parameter-fields').innerHTML=matches.map((m,i)=>`<label>${escape(titleCase(m[1].replace(/[?:].*$/,'')))}<input name="param${i}" ${m[1].endsWith('?')?'':'required'} placeholder="Record ID or slug" autocomplete="off"></label>`).join('');
  const dialog=$('#parameter-dialog');dialog.showModal();dialog.onclose=()=>{
    if(dialog.returnValue!=='open')return;
    let result=path;matches.forEach((m,i)=>result=result.replace(m[0],encodeURIComponent($(`[name="param${i}"]`).value.trim())));
    result=result.replace(/\/$/,'')||'/';navigatePortal(activeSite,result,admin);
  };
}
document.addEventListener('click',event=>{
  const setup=event.target.closest('[data-setup]');if(setup){const site=sites.find(s=>s.id===setup.dataset.setup);if(site)openSetup(site);return;}
  const favorite=event.target.closest('[data-favorite]');if(favorite){event.stopPropagation();const id=favorite.dataset.favorite;favorites=favorites.includes(id)?favorites.filter(x=>x!==id):[...favorites,id];localStorage.setItem('commerce-library-favorites',JSON.stringify(favorites));render();return}
  const nav=event.target.closest('[data-view]');if(nav){setView(nav.dataset.view);return}
  const cat=event.target.closest('[data-category]');if(cat){setView('all');category=cat.dataset.category;$$('#category-nav button').forEach(b=>b.classList.toggle('active',b.dataset.category===category));$('#crumb').textContent=category;render();return}
  const filter=event.target.closest('[data-status]');if(filter){status=filter.dataset.status;$$('[data-status]').forEach(b=>b.classList.toggle('active',b===filter));render();return}
  const button=event.target.closest('[data-open],[data-explore]');if(button){const site=sites.find(s=>s.id===(button.dataset.open||button.dataset.explore));if(!site)return;$('#feature-search').value='';access='all';$$('[data-access]').forEach(b=>b.classList.toggle('active',b.dataset.access==='all'));navigatePortal(site,button.dataset.mode==='admin'?site.admin:'/',button.dataset.mode==='admin');return}
  const tab=event.target.closest('[data-access]');if(tab){access=tab.dataset.access;$$('[data-access]').forEach(b=>b.classList.toggle('active',b===tab));renderFeatures();return}
  const route=event.target.closest('[data-path]');if(route){openFeature(route.dataset.path,route.dataset.routeAccess==='admin');return}
});
$('#search').addEventListener('input',render);$('#feature-search').addEventListener('input',renderFeatures);$('#back').addEventListener('click',back);
$('.brand').addEventListener('click',e=>{e.preventDefault();setView('all')});
$('#site-select').addEventListener('change',e=>{const site=sites.find(s=>s.id===e.target.value);$('#feature-search').value='';navigatePortal(site,adminMode&&site.admin?site.admin:'/',adminMode&&!!site.admin)});
$('#mode-public').addEventListener('click',()=>navigatePortal(activeSite,'/',false));$('#mode-admin').addEventListener('click',()=>navigatePortal(activeSite,activeSite.admin,true));
$('#open-tab').addEventListener('click',()=>window.open(currentUrl,'_blank','noopener'));
$('#reload-frame').addEventListener('click',()=>{$('#frame-loading').hidden=false;$('#portal-frame').src=currentUrl});
$('#portal-frame').addEventListener('load',()=>$('#frame-loading').hidden=true);
$('#refresh').addEventListener('click',async()=>{$('#refresh').classList.add('spinning');try{if(cloudMode){await load();toast('Cloud catalog loaded. Application backend is required.');return;}const r=await fetch('/api/refresh');if(!r.ok)throw Error();sites=await r.json();await loadRoutes();toast('Website status refreshed')}catch{toast('Could not refresh. Check that the launcher is running.')}finally{$('#refresh').classList.remove('spinning')}});
document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)){e.preventDefault();(activeSite?$('#feature-search'):$('#search')).focus()}if(e.key==='Enter'&&document.activeElement.matches('[data-explore]'))document.activeElement.click()});
try{await load();await loadRoutes();const params=new URLSearchParams(location.hash.slice(1));const site=sites.find(s=>s.id===params.get('site'));if(site&&!site.blocked)navigatePortal(site,params.get('mode')==='admin'?site.admin:'/',params.get('mode')==='admin');const setupSite=sites.find(s=>s.id===params.get('setup'));if(setupSite)openSetup(setupSite);}catch{ $('#site-grid').innerHTML='<div class="empty-state">The local library is not responding.<br>Run Start-MasterLibrary.cmd and refresh this page.</div>'; }
setInterval(async()=>{try{await load();if(sites.some(s=>!s.blocked&&!(routes[s.id]||[]).length))await loadRoutes()}catch{}},15000);
window.addEventListener('library-updated',async()=>{try{await load();await loadRoutes()}catch{}});
