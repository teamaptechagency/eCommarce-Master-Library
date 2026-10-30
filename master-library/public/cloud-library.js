export let cloudMode=false;
let catalog;
export async function loadCloudCatalog(){
  if(catalog)return catalog;
  const response=await fetch('/cloud/catalog.json',{cache:'no-store'});
  if(!response.ok)throw Error('The local library is unavailable.');
  const data=await response.json();if(data.mode!=='cloud'||!Array.isArray(data.sites))throw Error('Invalid cloud catalog.');
  catalog=data.sites;cloudMode=true;
  const notice=document.createElement('div');notice.className='cloud-notice';notice.setAttribute('role','status');
  const message=document.createElement('span');message.textContent='Library interface is online. Storefronts, admin demos and ZIP installation need an application backend.';
  const button=document.createElement('button');button.className='button secondary';button.textContent='Hosting setup';button.addEventListener('click',()=>showCloudSetup());notice.append(message,button);
  document.querySelector('.metrics').before(notice);
  document.querySelector('.local-chip').textContent='VERCEL LIBRARY';
  document.querySelector('.intro').textContent='Browse your collection. Connect the application backend to visit storefronts and admin portals.';
  document.querySelector('.local-label').textContent='Cloud catalog · backend required';
  return catalog;
}
export function showCloudSetup(site){
  let dialog=document.querySelector('#cloud-setup-dialog');
  if(!dialog){
    dialog=document.createElement('dialog');dialog.id='cloud-setup-dialog';dialog.className='install-dialog';
    const heading=document.createElement('div');heading.className='install-dialog-heading';
    const title=document.createElement('h2');title.id='cloud-setup-title';
    const close=document.createElement('button');close.className='icon-button';close.type='button';close.textContent='×';close.setAttribute('aria-label','Close hosting setup');close.addEventListener('click',()=>dialog.close());heading.append(title,close);
    const reason=document.createElement('p');reason.id='cloud-source-reason';
    const explanation=document.createElement('p');explanation.textContent='Vercel hosts this library interface. The original websites run on separate PHP/Node servers with their databases. Those servers must be hosted and connected before public portals, admin demos and ZIP installation can work online.';
    const local=document.createElement('a');local.id='cloud-local-link';local.className='button primary';local.target='_blank';local.rel='noopener';local.textContent='Open this computer’s local library ↗';
    const hint=document.createElement('p');hint.className='install-hint';hint.textContent='The local link requires Start-MasterLibrary.cmd to be running on this computer. For access from other devices, provide the backend hosting address.';
    dialog.append(heading,reason,explanation,local,hint);document.body.append(dialog);
  }
  dialog.querySelector('#cloud-setup-title').textContent=site?site.name+' · Hosting setup':'Connect the application backend';
  dialog.querySelector('#cloud-source-reason').textContent=site?.blocked||'';
  dialog.querySelector('#cloud-local-link').href='http://127.0.0.1:8090/'+(site?'#'+new URLSearchParams(site.blocked?{setup:site.id}:{site:site.id}):'');
  if(!dialog.open)dialog.showModal();
}
