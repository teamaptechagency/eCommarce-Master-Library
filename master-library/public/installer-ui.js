import {cloudMode,showCloudSetup} from '/cloud-library.js';
const $=selector=>document.querySelector(selector);
let csrf='',jobs=[],selectedSite=null,jobId=null,replacement=null,polling=false,busy=false;
async function inventory(){const r=await fetch('/api/installer');if(!r.ok)throw Error('Installer is unavailable. Restart the Master Library.');const data=await r.json();csrf=data.csrf;jobs=data.installations;return jobs;}
async function post(action,body){if(!csrf)await inventory();const r=await fetch('/api/installations/'+action,{method:'POST',headers:{'Content-Type':'application/json','X-Master-CSRF':csrf},body:JSON.stringify(body||{})});const data=await r.json();if(!r.ok)throw Error(data.error||'Installation request failed.');return data;}
function updated(){window.dispatchEvent(new Event('library-updated'));}
function uploadRaw(action,file,onProgress=()=>{}){return new Promise((resolve,reject)=>{const xhr=new XMLHttpRequest();xhr.open('POST','/api/installations/'+action);xhr.setRequestHeader('X-Master-CSRF',csrf);xhr.setRequestHeader('X-File-Name',encodeURIComponent(file.name));xhr.setRequestHeader('Content-Type','application/octet-stream');xhr.upload.onprogress=e=>{if(e.lengthComputable)onProgress(e.loaded/e.total*100)};xhr.onload=()=>{try{const data=JSON.parse(xhr.responseText);xhr.status<300?resolve(data):reject(Error(data.error||'Upload failed.'))}catch{reject(Error('Upload did not complete.'))}};xhr.onerror=()=>reject(Error('Upload connection failed. Keep the library running and retry.'));xhr.send(file)});}
async function showUpload(site){
  if(cloudMode){showCloudSetup(site);return;}
  try{await inventory();replacement=site||null;$('#upload-form').reset();$('#upload-name').value=site?.name||'';$('#upload-progress').hidden=true;$('#upload-message').textContent='';$('#upload-replacement').hidden=!site;$('#upload-replacement').textContent=site?'This replaces the incomplete library entry for '+site.name+'.':'';$('#upload-dialog').showModal();}catch(e){alert(e.message)}
}
$('#upload-website').addEventListener('click',()=>showUpload());
document.addEventListener('click',e=>{if(e.target.closest('[data-close-dialog]')&&!busy)e.target.closest('dialog').close()});
$('#upload-dialog').addEventListener('cancel',e=>{if(busy)e.preventDefault()});
$('#upload-form').addEventListener('submit',async event=>{
  event.preventDefault();const file=$('#upload-file').files[0];if(!file)return;
  if(file.size>512*1024**2){$('#upload-message').textContent='ZIP must be 512 MB or smaller.';return;}
  busy=true;$('#upload-submit').disabled=true;$('#upload-progress').hidden=false;$('#upload-message').textContent='Uploading website…';
  try{
    const params=new URLSearchParams({name:$('#upload-name').value.trim()});if(replacement)params.set('replace',replacement.id);
    const result=await uploadRaw('upload?'+params,file,value=>$('#upload-progress').value=value);
    $('#upload-dialog').close();updated();
    if(result.duplicate){alert('This exact ZIP is already in the library as '+result.name+'. The existing website was kept.');return;}
    await openSetup({id:result.siteId,name:result.name,setupId:result.id});
  }catch(e){$('#upload-message').textContent=e.message}finally{busy=false;$('#upload-submit').disabled=false;}
});
function showJob(job,initialize=false){
  $('#setup-title').textContent=job.name+' · Install / Setup';$('#setup-phase').textContent=job.phase;$('#setup-message').textContent=job.message;$('#setup-progress').value=job.progress;
  $('#setup-log').textContent=job.logs.map(row=>new Date(row.time).toLocaleTimeString()+'  '+row.text).join('\n');
  $('#setup-log').scrollTop=$('#setup-log').scrollHeight;
  const working=['running','queued','uploading'].includes(job.status),ready=job.status==='ready';
  $('#setup-form').hidden=false;$('#prepare-source').hidden=true;$('#setup-fields').hidden=working;$('#setup-submit').hidden=false;$('#setup-submit').disabled=working||busy;$('#setup-submit').textContent=working?'Installing…':ready?'Save admin path':'Install / Retry';
  $('#replace-source').hidden=working||ready;$('#setup-database').hidden=ready||!job.databaseRequired;$('#setup-php-field').hidden=ready||!['laravel','php'].includes(job.type);
  $('#setup-environment').closest('label').hidden=ready;$('#setup-output').closest('label').hidden=ready;
  $('#native-installer').hidden=!job.nativeSetup||ready;if(job.nativeSetup)$('#native-installer').href=job.nativeSetup;
  $('#check-install').hidden=!job.nativeSetup||working||ready;
  $('#detect-admin').hidden=!ready;$('#detect-admin').disabled=busy;
  if(initialize){$('#setup-admin').value=job.adminPath;$('#setup-db-password').value='';$('#setup-environment').value='';$('#setup-output').value='';$('#setup-sql').value='';}
  if(working)$('#install-log').open=true;
}
export async function openSetup(site){
  if(site?.requiresHosting){showCloudSetup(site);return;}
  try{
    await inventory();selectedSite=site;const job=jobs.find(j=>j.id===site.setupId||j.siteId===site.id);jobId=job?.id||null;
    $('#setup-error').textContent='';$('#setup-form').hidden=true;$('#setup-log').textContent='';$('#prepare-source').hidden=false;$('#replace-source').hidden=false;
    if(job)showJob(job,true);else{$('#setup-title').textContent=site.name+' · Install / Setup';$('#setup-phase').textContent='Source setup';$('#setup-message').textContent=site.blocked||'Prepare source to start installation.';$('#setup-progress').value=0;}
    if(!$('#setup-dialog').open)$('#setup-dialog').showModal();
  }catch(e){alert(e.message)}
}
$('#replace-source').addEventListener('click',()=>{const site=selectedSite;$('#setup-dialog').close();showUpload(site)});
$('#prepare-source').addEventListener('click',async()=>{
  $('#prepare-source').disabled=true;$('#setup-error').textContent='';
  try{const job=await post('adopt',{siteId:selectedSite.id});jobId=job.id;showJob(job,true);updated()}catch(e){$('#setup-error').textContent=e.message}finally{$('#prepare-source').disabled=false}
});
$('#setup-form').addEventListener('submit',async event=>{
  event.preventDefault();if(!jobId||busy)return;busy=true;$('#setup-submit').disabled=true;$('#setup-error').textContent='';
  try{
    const sql=$('#setup-sql').files[0];if(sql){if(sql.size>256*1024**2)throw Error('SQL backup must be 256 MB or smaller.');await uploadRaw('sql/'+jobId,sql);$('#setup-sql').value='';}
    const job=await post('setup/'+jobId,{adminPath:$('#setup-admin').value.trim(),phpVersion:$('#setup-php').value,dbHost:'127.0.0.1',dbPort:Number($('#setup-db-port').value),dbUser:$('#setup-db-user').value,dbPassword:$('#setup-db-password').value,environment:$('#setup-environment').value,outputDirectory:$('#setup-output').value.trim()});
    $('#setup-db-password').value='';showJob(job);updated();
  }catch(e){$('#setup-error').textContent=e.message}finally{busy=false;$('#setup-submit').disabled=false}
});
$('#check-install').addEventListener('click',async()=>{try{$('#check-install').disabled=true;showJob(await post('check/'+jobId));updated()}catch(e){$('#setup-error').textContent=e.message}finally{$('#check-install').disabled=false}});
$('#detect-admin').addEventListener('click',async()=>{if(!jobId||busy)return;busy=true;$('#detect-admin').disabled=true;$('#setup-error').textContent='';try{showJob(await post('admin/'+jobId));updated()}catch(e){$('#setup-error').textContent=e.message}finally{busy=false;$('#detect-admin').disabled=false}});
setInterval(async()=>{
  if(!$('#setup-dialog').open||!jobId||polling||busy)return;
  polling=true;try{const previous=jobs.find(j=>j.id===jobId)?.status;await inventory();const job=jobs.find(j=>j.id===jobId);if(job){showJob(job);if(previous!==job.status)updated()}}catch(e){$('#setup-error').textContent=e.message}finally{polling=false}
},1200);
