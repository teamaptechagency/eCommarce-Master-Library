import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Readable} from 'node:stream';
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {crc32} from 'node:zlib';
import {archivePath,extractZip} from '../archive.mjs';
import {Installer,detectSource} from '../installer.mjs';
const source=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
function zip(entries){
  const records=[],directory=[];let offset=0;
  for(const [filename,value,mode=0] of entries){
    const name=Buffer.from(filename),body=Buffer.from(value),header=Buffer.alloc(30),central=Buffer.alloc(46);
    header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt32LE(crc32(body),14);header.writeUInt32LE(body.length,18);header.writeUInt32LE(body.length,22);header.writeUInt16LE(name.length,26);
    central.writeUInt32LE(0x02014b50);central.writeUInt16LE(0x314,4);central.writeUInt16LE(20,6);central.writeUInt32LE(crc32(body),16);central.writeUInt32LE(body.length,20);central.writeUInt32LE(body.length,24);central.writeUInt16LE(name.length,28);central.writeUInt32LE((mode*65536)>>>0,38);central.writeUInt32LE(offset,42);
    records.push(header,name,body);directory.push(central,name);offset+=header.length+name.length+body.length;
  }
  const footer=Buffer.alloc(22),central=Buffer.concat(directory);footer.writeUInt32LE(0x06054b50);footer.writeUInt16LE(entries.length,8);footer.writeUInt16LE(entries.length,10);footer.writeUInt32LE(central.length,12);footer.writeUInt32LE(offset,16);
  return Buffer.concat([...records,central,footer]);
}
function uploadRequest(body){const req=Readable.from([body]);req.headers={'content-length':body.length};return req;}
function temporary(t,cleanup=true){const root=fs.mkdtempSync(path.join(os.tmpdir(),'master-installer-'));if(cleanup)t.after(()=>fs.rmSync(root,{recursive:true,force:true}));return root;}
test('ZIP paths reject traversal, Windows aliases and reserved device names',()=>{
  for(const value of ['../escape','C:/escape','folder/../../escape','folder/NUL.txt','folder/name.','folder/name '])assert.throws(()=>archivePath(value));
  assert.equal(archivePath('site/assets/app.css'),path.join('site','assets','app.css'));
});
test('extraction rejects links, traversal, duplicate entries and size limits',async t=>{
  const root=temporary(t);
  for(const [i,entries,limits] of [[0,[['../escape','bad']],{}],[1,[['link','../outside',0xa1ff]],{}],[2,[['a.txt','a'],['a.txt','b']],{}],[3,[['large.txt','123456']],{maxBytes:5}]]){
    const file=path.join(root,i+'.zip');fs.writeFileSync(file,zip(entries));await assert.rejects(extractZip(file,path.join(root,'extract-'+i),limits));
  }
  assert.equal(fs.existsSync(path.join(root,'escape')),false);
});
test('nested static ZIP auto-installs, serves CSS, deduplicates and survives restart',async t=>{
  const root=temporary(t),sites=[],children=[];
  t.after(async()=>{for(const child of children){child.kill();await new Promise(resolve=>child.once('exit',resolve));}});
  const installer=new Installer({root,sites,startSite:async site=>{
    const child=spawn(process.execPath,[path.join(source,'uploaded-server.mjs')],{env:{...process.env,MASTER_UPLOAD_PORT:String(site.port),MASTER_UPLOAD_PUBLIC:site.publicDir},stdio:'ignore',windowsHide:true});children.push(child);
  }});
  const body=zip([['package/shop/index.html','<title>Original Shop</title><link rel="stylesheet" href="/assets/site.css"><h1>Demo</h1>'],['package/shop/assets/site.css','body{color:green}'],['package/shop/.env','PRIVATE_TOKEN=never-public']]);
  const uploaded=await installer.upload(uploadRequest(body),{name:'Original Shop',filename:'shop.zip'});await installer.queue;
  const job=installer.get(uploaded.id);assert.equal(job.status,'ready',JSON.stringify(installer.public(job)));assert.equal(job.type,'static');assert.equal(sites.length,1);
  const address='http://127.0.0.1:'+job.port;
  assert.match(await (await fetch(address)).text(),/Original Shop/);
  assert.match((await fetch(address+'/assets/site.css')).headers.get('content-type'),/text\/css/);
  assert.equal((await fetch(address+'/.env')).status,404);
  assert.equal((await fetch(address+'/source.zip')).status,404);
  assert.equal((await fetch(address+'/missing.js')).status,404);
  assert.equal(fs.existsSync(path.join(job.app,'.env')),false);
  assert.equal((await installer.upload(uploadRequest(body),{name:'Clone',filename:'clone.zip'})).duplicate,true);assert.equal(sites.length,1);
  const restoredSites=[],restored=new Installer({root,sites:restoredSites});assert.equal(restoredSites[0].blocked,null);assert.equal(restored.list()[0].status,'ready');assert.equal(restoredSites[0].name,'Original Shop');
});
test('incomplete React archive stays actionable and does not pretend to be installed',async t=>{
  const root=temporary(t),sites=[];let starts=0;
  const installer=new Installer({root,sites,startSite:async()=>starts++});
  const body=zip([['site/package.json',JSON.stringify({dependencies:{vite:'8.3.5',react:'19.3.1'}})],['site/index.html','<title>Incomplete</title><script type="module" src="/src/main.tsx"></script>']]);
  const job=await installer.upload(uploadRequest(body),{filename:'incomplete.zip'});await installer.queue;
  const saved=installer.get(job.id);assert.equal(saved.status,'setup');assert.deepEqual(saved.missing,['/src/main.tsx']);assert.equal(starts,0);assert.ok(sites[0].blocked);assert.ok(sites[0].setupId);
  await assert.rejects(installer.setup(job.id,{adminPath:'//evil.example'}));
  await assert.rejects(installer.setup(job.id,{dbHost:'remote-database.example'}));
});
test('Laravel detection precedes frontend package and missing folders give a real source error',async t=>{
  const root=temporary(t);fs.mkdirSync(path.join(root,'public'));fs.writeFileSync(path.join(root,'artisan'),'');fs.writeFileSync(path.join(root,'composer.json'),'{}');fs.writeFileSync(path.join(root,'public/index.php'),'<?php');fs.writeFileSync(path.join(root,'package.json'),'{}');
  assert.equal(detectSource(root).type,'laravel');
  const installer=new Installer({root:temporary(t),sites:[{id:'empty',blocked:'No source'}]});await assert.rejects(installer.adopt('empty'),/Upload complete ZIP/);
});
test('Vite ZIP installs local dependencies and builds its original frontend and CSS',async t=>{
  const root=temporary(t),sites=[],children=[];
  t.after(async()=>{for(const child of children)if(child.exitCode===null){child.kill();await new Promise(resolve=>child.once('exit',resolve));}});
  const installer=new Installer({root,sites,startSite:async site=>{children.push(spawn(process.execPath,[path.join(source,'uploaded-server.mjs')],{env:{...process.env,MASTER_UPLOAD_PORT:String(site.port),MASTER_UPLOAD_PUBLIC:site.publicDir,MASTER_UPLOAD_SPA:'true'},windowsHide:true,stdio:'ignore'}));}});
  const dependencies=Object.fromEntries(['vite','react','react-dom'].map(name=>[name,'file:'+path.join(source,'node_modules',name).replaceAll('\\','/')]));
  const body=zip([['store/package.json',JSON.stringify({name:'zip-install-fixture',private:true,type:'module',dependencies})],['store/index.html','<title>React source fixture</title><div id="root"></div><script type="module" src="/src/main.js"></script>'],['store/src/main.js',"import React from 'react';import{createRoot}from'react-dom/client';import './store.css';createRoot(document.getElementById('root')).render(React.createElement('h1',null,'Original uploaded layout'));"],['store/src/store.css','h1{color:rgb(20,90,50)}']]);
  const result=await installer.upload(uploadRequest(body),{filename:'react-shop.zip'});await installer.queue;const job=installer.get(result.id);
  assert.equal(job.status,'ready',JSON.stringify(installer.public(job)));assert.equal(job.type,'vite');assert.ok(fs.existsSync(path.join(job.publicDir,'index.html')));assert.ok(job.logs.some(row=>row.text.includes('built in')));
  const response=await fetch('http://127.0.0.1:'+job.port+'/catalog');assert.equal(response.status,200);assert.match(await response.text(),/React source fixture/);
});
test('missing Laravel SQL stops with an upload and retry action before database changes',async t=>{
  const root=temporary(t),sites=[],installer=new Installer({root,sites});
  const body=zip([['artisan','<?php'],['composer.json','{"require":{"php":"^8.1"}}'],['public/index.php','<?php echo "Store";'],['vendor/autoload.php','<?php']]);
  const result=await installer.upload(uploadRequest(body),{filename:'laravel.zip'});await installer.queue;
  const job=installer.get(result.id);assert.equal(job.status,'setup');assert.deepEqual(job.missing,['Database SQL backup']);assert.equal(job.database,undefined);
  const privateSQL='CREATE TABLE demo (id int);';await installer.sql(job.id,uploadRequest(Buffer.from(privateSQL)));assert.equal(fs.readFileSync(job.sql,'utf8'),privateSQL);assert.ok(!JSON.stringify(installer.public(job)).includes(privateSQL));
});
test('SQL upload and Setup create an isolated database and start the PHP storefront',{skip:process.env.MASTER_TEST_MYSQL!=='1'},async t=>{
  const root=temporary(t,false),sites=[],children=[],php='C:/xampp/php/php.exe';let database;
  t.after(async()=>{
    for(const child of children)if(child.exitCode===null){child.kill();await new Promise(resolve=>child.once('exit',resolve));}
    if(database){const result=spawnSync(php,['-r',"$j=json_decode(stream_get_contents(STDIN),true);if(!preg_match('/^ml_[a-f0-9]{16}$/',$j['name']))exit(2);$p=new PDO('mysql:host=127.0.0.1;port=3306','root','');$p->exec('DROP DATABASE `'.$j['name'].'`');$p->exec('DROP USER '.$p->quote($j['user']).'@'.$p->quote('127.0.0.1'));"],{input:JSON.stringify(database),windowsHide:true});assert.equal(result.status,0,result.stderr?.toString());}
    fs.rmSync(root,{recursive:true,force:true});
  });
  fs.copyFileSync(path.join(source,'installer-database.php'),path.join(root,'installer-database.php'));
  const installer=new Installer({root,sites,startSite:async site=>{children.push(spawn(php,['-S','127.0.0.1:'+site.port,'-t',site.publicDir,path.join(source,'uploaded-router.php')],{cwd:site.app,env:{...process.env,MASTER_UPLOAD_PORT:String(site.port),MASTER_UPLOAD_PUBLIC:site.publicDir,MASTER_UPLOAD_APP:site.app},windowsHide:true,stdio:'ignore'}));}});
  const index="<?php $e=parse_ini_file(__DIR__.'/../.env');$p=new PDO('mysql:host='.$e['DB_HOST'].';port='.$e['DB_PORT'].';dbname='.$e['DB_DATABASE'],$e['DB_USERNAME'],$e['DB_PASSWORD']);echo '<title>Installed SQL Shop</title><link rel=\"stylesheet\" href=\"/vendor/store.css\"><h1>Products: '.$p->query('SELECT COUNT(*) FROM products')->fetchColumn().'</h1>';";
  const body=zip([['artisan','<?php echo "Package discovery complete";'],['composer.json','{"require":{"php":"^8.1"}}'],['public/index.php',index],['public/vendor/store.css','body{color:green}'],['storage/app/public/catalog.css','h1{color:blue}'],['vendor/autoload.php','<?php']]);
  const result=await installer.upload(uploadRequest(body),{filename:'sql-shop.zip'});await installer.queue;const job=installer.get(result.id);assert.equal(job.status,'setup');
  await installer.sql(job.id,uploadRequest(Buffer.from('CREATE TABLE products (id int PRIMARY KEY, name varchar(100)); INSERT INTO products VALUES (1,\'Demo item\');')));
  await installer.setup(job.id,{dbUser:'root',dbPassword:'',dbHost:'127.0.0.1',dbPort:3306,adminPath:'/admin'});await installer.queue;database=job.database;
  assert.equal(job.status,'ready',JSON.stringify(installer.public(job)));assert.match(database.name,/^ml_[a-f0-9]{16}$/);assert.match(await(await fetch('http://127.0.0.1:'+job.port)).text(),/Products: 1/);assert.ok(!JSON.stringify(installer.list()).includes(database.password));
  assert.match((await fetch('http://127.0.0.1:'+job.port+'/vendor/store.css')).headers.get('content-type'),/text\/css/);assert.match(await(await fetch('http://127.0.0.1:'+job.port+'/storage/catalog.css')).text(),/color:blue/);assert.equal((await fetch('http://127.0.0.1:'+job.port+'/.env')).status,404);
  await installer.setup(job.id,{adminPath:'/dashboard'});assert.equal(sites[0].admin,'/dashboard');assert.equal(job.status,'ready');
});
test('interrupted jobs recover with a working retry state and private values stay out of the API',t=>{
  const root=temporary(t),base=path.join(root,'data/installations');fs.mkdirSync(base,{recursive:true});
  fs.writeFileSync(path.join(base,'jobs.json'),JSON.stringify([{id:'job',siteId:'upload-job',name:'Test',status:'running',enqueued:true,config:{dbPassword:'private-value'},logs:[]}]))
  const installer=new Installer({root,sites:[]}),job=installer.get('job');assert.equal(job.status,'setup');assert.equal(job.enqueued,undefined);
  installer.log(job,'password=private-value');assert.ok(!JSON.stringify(installer.list()).includes('private-value'));
});
