import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {repairViteEsbuildPeer} from '../npm-compatibility.mjs';
const report='npm error code ERESOLVE\nnpm error peerOptional esbuild@"^0.27.0 || ^0.28.0" from vite@8.3.5';
function fixture(t,pkg){const root=fs.mkdtempSync(path.join(os.tmpdir(),'master-npm-peer-')),app=path.join(root,'app'),backupDirectory=path.join(root,'private');fs.mkdirSync(app);fs.writeFileSync(path.join(app,'package.json'),JSON.stringify(pkg));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));return {app,backupDirectory,report};}
test('Vite/esbuild conflict is repaired using the declared peer range and originals are preserved',t=>{
  const original={dependencies:{vite:'^8.3.0',react:'^19.0.1'},devDependencies:{esbuild:'^0.25.0',tsx:'^4.21.0'}};
  const options=fixture(t,original);fs.writeFileSync(path.join(options.app,'package-lock.json'),'{"lockfileVersion":3}');const logs=[];
  assert.equal(repairViteEsbuildPeer({...options,log:line=>logs.push(line)}),true);
  const pkg=JSON.parse(fs.readFileSync(path.join(options.app,'package.json'),'utf8'));assert.equal(pkg.devDependencies.esbuild,'^0.27.0 || ^0.28.0');assert.equal(pkg.dependencies.vite,'^8.3.0');assert.equal(pkg.devDependencies.tsx,'^4.21.0');
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(options.backupDirectory,'package.json.before-peer-repair'),'utf8')),original);assert.equal(fs.readFileSync(path.join(options.backupDirectory,'package-lock.json.before-peer-repair'),'utf8'),'{"lockfileVersion":3}');assert.match(logs[0],/peer validation enabled/);
  assert.equal(repairViteEsbuildPeer(options),false);
});
test('unrelated errors, non-Vite projects and local overrides are left intact',t=>{
  for(const [pkg,error] of [[{dependencies:{vite:'^8',esbuild:'file:../esbuild'}},report],[{dependencies:{esbuild:'^0.25.0'}},report],[{devDependencies:{vite:'^8',esbuild:'^0.25.0'}},'npm error ENOTFOUND registry.npmjs.org'],[{dependencies:{vite:'^8',esbuild:'^0.25.0'}},'npm error ERESOLVE peer react@"^20" from plugin@1.0.0']]){
    const options=fixture(t,pkg);assert.equal(repairViteEsbuildPeer({...options,report:error}),false);assert.deepEqual(JSON.parse(fs.readFileSync(path.join(options.app,'package.json'),'utf8')),pkg);
  }
});
