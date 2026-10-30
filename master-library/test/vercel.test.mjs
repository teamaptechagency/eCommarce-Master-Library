import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {buildVercel} from '../build-vercel.mjs';
import {root} from '../sites.mjs';
test('Vercel output contains the entry page and every local module, with no private runtime or source files',t=>{
  const destination=fs.mkdtempSync(path.join(os.tmpdir(),'master-vercel-'));t.after(()=>fs.rmSync(destination,{recursive:true,force:true}));
  const catalog=buildVercel(destination);
  assert.ok(catalog.length>=10);
  for(const file of ['index.html','app.js','installer-ui.js','cloud-library.js','styles.css','cloud/catalog.json'])assert.ok(fs.existsSync(path.join(destination,file)),file);
  for(const filename of ['app.js','installer-ui.js']){const code=fs.readFileSync(path.join(destination,filename),'utf8');for(const [,module] of code.matchAll(/from ['"]\/([^'"]+)['"]/g))assert.ok(fs.existsSync(path.join(destination,module)),module);}
  assert.deepEqual(fs.readdirSync(destination).sort(),['app.js','cloud','cloud-library.js','index.html','installer-ui.js','styles.css']);
  const content=fs.readFileSync(path.join(destination,'cloud/catalog.json'),'utf8');assert.ok(!/E:\\\\|E:\/|C:\/|APP_KEY|DB_PASSWORD|archiveHash/.test(content));
  assert.ok(catalog.every(site=>site.requiresHosting&&site.url===null&&site.demoSupported===false&&site.status!=='online'));
});
test('both repository-root and master-library Vercel settings resolve to a build script and isolated dist output',()=>{
  for(const directory of [root,path.dirname(root)]){const config=JSON.parse(fs.readFileSync(path.join(directory,'vercel.json'),'utf8'));assert.equal(config.framework,null);assert.ok(fs.existsSync(path.resolve(directory,config.buildCommand.replace(/^node /,''))));assert.equal(path.resolve(directory,config.outputDirectory),path.join(root,'dist'));}
});
