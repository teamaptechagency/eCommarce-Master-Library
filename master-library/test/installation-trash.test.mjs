import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {Installer} from '../installer.mjs';
import {moveInstallation} from '../installation-trash.mjs';
function fixture(t,options={}){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'master-trash-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const sites=[{id:'legacy-test',name:'Original source',blocked:'Needs setup',category:'Original collection'}],installer=new Installer({root,sites,...options});
  const id=crypto.randomBytes(8).toString('hex'),directory=path.join(root,'data/installations',id),app=path.join(directory,'source');fs.mkdirSync(app,{recursive:true});fs.writeFileSync(path.join(app,'index.html'),'Installed working copy');fs.writeFileSync(path.join(directory,'source.zip'),'Uploaded ZIP');fs.writeFileSync(path.join(root,'original.zip'),'External original ZIP');fs.writeFileSync(path.join(root,'database.sql'),'External database data');
  const job={id,siteId:'legacy-test',name:'Installed test site',filename:'test.zip',directory,app,publicDir:app,type:'static',status:'setup',phase:'Setup required',message:'Missing setup values',progress:25,port:8500,logs:[]};installer.jobs.push(job);installer.syncSite(job);installer.persist();return {root,sites,installer,job};
}
test('delete stops the preview, moves only its installation, survives restart, and restores setup and source metadata',async t=>{
  let stops=0;const {root,sites,installer,job}=fixture(t,{stopSite:async site=>{stops++;assert.ok(fs.existsSync(site.app));}});
  await installer.trashInstallation(job.id);assert.equal(stops,1);assert.equal(sites.length,0);assert.equal(installer.list().length,0);assert.equal(installer.trashList().length,1);assert.equal(fs.existsSync(job.directory),false);assert.equal(fs.readFileSync(path.join(job.trash.directory,'source/index.html'),'utf8'),'Installed working copy');
  assert.equal(fs.readFileSync(path.join(root,'original.zip'),'utf8'),'External original ZIP');assert.equal(fs.readFileSync(path.join(root,'database.sql'),'utf8'),'External database data');
  await assert.rejects(installer.setup(job.id,{}),/Trash/);assert.notEqual(await installer.allocatePort(),job.port);
  const restoredSites=[{id:'legacy-test',name:'Original source',blocked:'Needs setup'}],restarted=new Installer({root,sites:restoredSites});assert.equal(restoredSites.length,0);
  await restarted.restoreInstallation(job.id);assert.equal(restarted.trashList().length,0);assert.equal(restoredSites.length,1);assert.equal(restoredSites[0].category,'Original collection');assert.equal(restarted.get(job.id).status,'setup');assert.ok(fs.existsSync(job.app));assert.equal(restarted.get(job.id).message,'Missing setup values');
});
test('running and queued jobs cannot be deleted, and a failed preview stop leaves all files and metadata active',async t=>{
  const {installer,job,sites}=fixture(t,{stopSite:async()=>{throw Error('Preview ownership mismatch')}});
  job.status='running';await assert.rejects(installer.trashInstallation(job.id),/finish/);assert.ok(fs.existsSync(job.directory));job.status='setup';job.enqueued=true;await assert.rejects(installer.trashInstallation(job.id),/finish/);delete job.enqueued;
  await assert.rejects(installer.trashInstallation(job.id),/ownership mismatch/);assert.equal(job.status,'setup');assert.equal(job.trash,undefined);assert.equal(sites.length,1);assert.ok(fs.existsSync(job.directory));
});
test('tampered installation paths and symlink directories cannot move outside installation storage',async t=>{
  const {root,installer,job}=fixture(t);const original=job.directory;job.directory=root;await assert.rejects(installer.trashInstallation(job.id),/directory does not match/);job.directory=original;
  const target=path.join(root,'external');fs.renameSync(original,target);fs.symlinkSync(target,original,process.platform==='win32'?'junction':'dir');await assert.rejects(installer.trashInstallation(job.id),/symbolic link/);assert.ok(fs.existsSync(path.join(target,'source/index.html')));
});
test('restore rejects an existing destination or a duplicate installed source without overwriting either',async t=>{
  const {installer,job}=fixture(t);job.hash='same-hash';await installer.trashInstallation(job.id);installer.sites.push({id:'other-site',archiveHash:'SAME-HASH'});await assert.rejects(installer.restoreInstallation(job.id),/duplicate/);installer.sites.pop();
  fs.mkdirSync(job.directory);fs.writeFileSync(path.join(job.directory,'keep.txt'),'Do not replace');await assert.rejects(installer.restoreInstallation(job.id),/already exists/);assert.equal(fs.readFileSync(path.join(job.directory,'keep.txt'),'utf8'),'Do not replace');assert.equal(job.status,'trashed');
});
test('interrupted delete and restore transitions recover from actual directory locations',async t=>{
  const {root,installer,job}=fixture(t);await installer.trashInstallation(job.id);job.status='trashing';installer.persist();const restarted=new Installer({root,sites:[]});assert.equal(restarted.get(job.id).status,'trashed');
  const saved=restarted.get(job.id);saved.status='restoring';restarted.persist();await moveInstallation(root,saved,true);const recovered=new Installer({root,sites:[]});assert.equal(recovered.get(job.id).status,'setup');assert.equal(recovered.get(job.id).trash,undefined);assert.equal(recovered.sites.length,1);
});
