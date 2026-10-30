import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {pipeline} from 'node:stream/promises';
import {Transform} from 'node:stream';
import {extractZip} from './archive.mjs';
import {repairViteEsbuildPeer} from './npm-compatibility.mjs';
import {discoverAdmin,prepareAdminDemo} from './admin-discovery.mjs';

const exists=fs.existsSync;
const readJSON=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const skip=new Set(['node_modules','vendor','.git','__MACOSX','storage']);
export function detectSource(directory) {
  const queue=[[directory,0]];let fallback,viteCandidate,staticCandidate,phpCandidate;
  while(queue.length){
    const [app,depth]=queue.shift(),has=file=>exists(path.join(app,file));
    if(has('artisan')&&has('composer.json')&&has('public/index.php'))return {app,type:'laravel',publicDir:path.join(app,'public')};
    if(has('wp-config-sample.php')&&has('wp-admin'))phpCandidate={app,type:'php',wordpress:true,publicDir:app,nativeSetup:'/wp-admin/install.php'};
    if(has('package.json')){
      const pkg=readJSON(path.join(app,'package.json')),deps={...pkg.dependencies,...pkg.devDependencies};
      if(has('index.html')&&deps.vite){
        const html=fs.readFileSync(path.join(app,'index.html'),'utf8');
        const entries=[...html.matchAll(/<script\b[^>]*src=["']([^"']+)["']/gi)].map(m=>m[1]).filter(s=>!/^https?:|^\/\//.test(s));
        const missing=entries.filter(s=>!has(s.replace(/^\//,'').split('?')[0]));
        viteCandidate||={app,type:'vite',publicDir:path.join(app,'dist'),missing};
      }
      fallback={app,type:'unsupported',message:'This framework needs a production export. Build it and select its public output directory below, or upload the exported ZIP.'};
    }
    if(has('index.php'))phpCandidate||={app,type:'php',publicDir:app};
    if(has('index.html')&&!has('package.json')){
      const html=fs.readFileSync(path.join(app,'index.html'),'utf8');
      const refs=[...html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)=["']([^"']+)["']/gi)].map(m=>m[1]).filter(s=>!/^([a-z]+:|\/\/|#)/i.test(s));
      const missing=refs.filter(s=>!has(decodeURIComponent(s.replace(/^\//,'').split('?')[0])));
      staticCandidate||={app,type:'static',publicDir:app,missing};
    }
    if(depth<4)for(const entry of fs.readdirSync(app,{withFileTypes:true}))if(entry.isDirectory()&&!skip.has(entry.name)&&!entry.name.startsWith('.'))queue.push([path.join(app,entry.name),depth+1]);
  }
  return viteCandidate||phpCandidate||staticCandidate||fallback||{app:directory,type:'incomplete',message:'No index.html, index.php or complete application source was found. Upload the complete website ZIP.'};
}
const safeRelative=(root,value)=>{
  const result=path.resolve(root,value||'.');
  if(result!==root&&!result.startsWith(root+path.sep))throw Error('Choose a directory inside the extracted source.');
  return result;
};
const envLine=value=>'"'+String(value).replaceAll('\\','\\\\').replaceAll('"','\\"').replace(/[\r\n]/g,'')+'"';
function writeEnv(app,values,extra='') {
  const file=path.join(app,'.env');
  let source=exists(file)?fs.readFileSync(file,'utf8'):exists(path.join(app,'.env.example'))?fs.readFileSync(path.join(app,'.env.example'),'utf8'):'';
  const entries={};
  for(const line of extra.split(/\r?\n/)){if(!line.trim()||line.trim().startsWith('#'))continue;const match=line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);if(!match)throw Error('Environment values must use KEY=value, one per line.');entries[match[1]]=match[2].replace(/^(["'])(.*)\1$/,'$2');}
  for(const [key,value] of Object.entries({...entries,...values})){
    const pattern=new RegExp('^'+key+'=.*$','m'),line=key+'='+envLine(value);
    source=pattern.test(source)?source.replace(pattern,()=>line):source+'\n'+line;
  }
  fs.writeFileSync(file,source+'\n');
}
export class Installer {
  constructor({root,sites,onChange=()=>{},startSite=async()=>{}}) {
    this.root=root;this.sites=sites;this.onChange=onChange;this.startSite=startSite;
    this.base=path.join(root,'data/installations');fs.mkdirSync(this.base,{recursive:true});
    this.file=path.join(this.base,'jobs.json');this.jobs=exists(this.file)?readJSON(this.file):[];
    for(const job of this.jobs){delete job.enqueued;if(['running','queued','uploading'].includes(job.status)){job.status='setup';job.message='Installation was interrupted. Choose Install / Retry to continue.';}this.syncSite(job);}
    this.queue=Promise.resolve();this.persist();
  }
  persist(){const temp=this.file+'.tmp';fs.writeFileSync(temp,JSON.stringify(this.jobs,null,2));fs.renameSync(temp,this.file);}
  public(job){return {id:job.id,siteId:job.siteId,name:job.name,filename:job.filename,status:job.status,phase:job.phase,progress:job.progress||0,message:job.message,type:job.type,databaseRequired:job.type==='laravel'||Boolean(job.wordpress),missing:job.missing||[],logs:(job.logs||[]).slice(-100),adminPath:job.adminPath||'',publicDirectory:job.publicDir&&job.app?path.relative(job.app,job.publicDir):'',nativeSetup:job.nativeSetup?`http://127.0.0.1:${job.port}${job.nativeSetup}`:null,createdAt:job.createdAt};}
  list(){return this.jobs.map(j=>this.public(j)).reverse();}
  get(id){const job=this.jobs.find(j=>j.id===id);if(!job)throw Error('Installation not found.');return job;}
  log(job,message){
    let text=String(message).replace(/\x1b\[[0-9;]*m/g,'').trim();
    for(const value of [job.config?.dbPassword,job.database?.password,...Object.values(job.config?.environmentValues||{})])if(value)text=text.replaceAll(String(value),'[private]');
    text=text.replace(/((?:password|secret|token|api_key)\s*[=:]\s*)\S+/gi,'$1[private]');
    if(!text)return;job.logs||=[];job.logs.push({time:new Date().toISOString(),text:text.slice(-4000)});job.logs=job.logs.slice(-250);this.persist();
  }
  change(job,values){Object.assign(job,values);this.syncSite(job);this.persist();this.onChange();}
  syncSite(job){
    if(!job.siteId||['duplicate','superseded'].includes(job.status))return;
    let site=this.sites.find(s=>s.id===job.siteId);
    if(!site){site={id:job.siteId,initials:job.name.split(/\s+/).map(s=>s[0]).join('').replace(/[^\p{L}\p{N}]/gu,'').slice(0,2).toUpperCase()||'WS',color:'#46796a',category:'ZIP uploads',features:[]};this.sites.push(site);}
    Object.assign(site,{name:job.name,subtitle:job.title||job.name,description:job.status==='ready'?'Installed from your ZIP archive. Original source layout and assets.':job.message||'Preparing uploaded source.',source:job.filename||site.source,archiveHash:job.hash,setupId:job.id,managedUpload:true,installState:job.status,app:job.app,port:job.port,php:job.php,kind:job.demoAdapter?'react-demo':job.type==='laravel'?'uploaded-laravel':job.type==='php'?'uploaded-php':'uploaded-static',publicDir:job.publicDir,spa:job.type==='vite',admin:job.adminPath||null,adminTabs:job.adminTabs||[],demoSupported:Boolean(job.demoAdapter),blocked:job.status==='ready'?null:job.message||'Installation in progress',features:job.status==='ready'?['Original storefront',...(job.adminPath?[job.demoAdapter?'Admin demo':'Admin portal']:[]),'Install / Setup']:['Install / Setup']});
  }
  async receive(req,file,maxBytes) {
    let bytes=0;const hash=crypto.createHash('sha256');
    if(Number(req.headers['content-length'])>maxBytes)throw Error('Upload is too large. ZIP limit: 512 MB; SQL limit: 256 MB.');
    try{await pipeline(req,new Transform({transform(chunk,encoding,callback){bytes+=chunk.length;if(bytes>maxBytes)return callback(Error('Upload exceeds the size limit.'));hash.update(chunk);callback(null,chunk)}}),fs.createWriteStream(file,{flags:'wx'}));}
    catch(e){fs.rmSync(file,{force:true});throw e;}
    if(!bytes){fs.rmSync(file,{force:true});throw Error('The uploaded file is empty.');}
    return hash.digest('hex');
  }
  async upload(req,{name,filename,replaceSiteId}={}) {
    if(!filename?.toLowerCase().endsWith('.zip'))throw Error('Choose a .zip website archive.');
    if(replaceSiteId&&!this.sites.some(s=>s.id===replaceSiteId&&s.blocked))throw Error('Only incomplete sites can be replaced.');
    if(replaceSiteId&&this.jobs.some(j=>j.siteId===replaceSiteId&&(j.status==='running'||j.enqueued)))throw Error('Wait for the current installation to finish before replacing its source.');
    const id=crypto.randomBytes(8).toString('hex'),directory=path.join(this.base,id);fs.mkdirSync(directory);
    const file=path.join(directory,'source.zip');let hash;
    try{hash=await this.receive(req,file,512*1024**2)}catch(e){fs.rmSync(directory,{recursive:true,force:true});throw e;}
    const duplicate=this.sites.find(s=>s.id!==replaceSiteId&&s.archiveHash?.toLowerCase()===hash);
    if(duplicate){fs.rmSync(directory,{recursive:true,force:true});return {duplicate:true,siteId:duplicate.id,name:duplicate.name};}
    const job={id,siteId:replaceSiteId||'upload-'+id,name:(name||path.basename(filename,'.zip')).slice(0,100),filename:path.basename(filename).slice(0,200),hash,directory,archive:file,status:'queued',phase:'Queued',progress:5,createdAt:new Date().toISOString(),logs:[]};
    if(replaceSiteId)for(const previous of this.jobs.filter(j=>j.siteId===replaceSiteId)){previous.status='superseded';previous.message='Replaced by a newer source ZIP.';}
    this.jobs.push(job);this.change(job,{message:'Queued for automatic installation.'});this.enqueue(job);return this.public(job);
  }
  async adopt(siteId){
    const previous=this.jobs.find(j=>j.siteId===siteId);if(previous)return this.public(previous);
    const site=this.sites.find(s=>s.id===siteId);if(!site?.blocked)throw Error('Choose a site that requires installation.');
    if(!site.app||!exists(site.app))throw Error('Source is incomplete. Use Upload complete ZIP to install this website.');
    const id=crypto.randomBytes(8).toString('hex');
    const job={id,siteId,name:site.name,filename:site.source,directory:path.join(this.base,id),original:site.app,adminPath:site.admin,requiresSQL:siteId==='ecommerce9',status:'queued',phase:'Queued',progress:5,createdAt:new Date().toISOString(),logs:[]};
    fs.mkdirSync(job.directory);this.jobs.push(job);this.change(job,{message:'Preparing a separate working copy of the source.'});this.enqueue(job);return this.public(job);
  }
  enqueue(job){if(job.status==='running'||job.enqueued)return;job.enqueued=true;this.queue=this.queue.catch(()=>{}).then(async()=>{delete job.enqueued;await this.install(job)});}
  async enableAdmin(id){
    const job=this.get(id);if(job.status!=='ready'||job.enqueued)throw Error('Finish the current installation before enabling admin.');
    const discovery=discoverAdmin(job.app,job.type);
    if(!discovery.path)throw Error('No supported admin route was found in this source. Enter its actual admin path in Setup.');
    job.adminPath||=discovery.path;job.adminTabs=discovery.tabs;
    if(!discovery.profile){this.change(job,{});return this.public(job);}
    this.change(job,{status:'queued',phase:'Preparing admin demo',message:'Rebuilding the original dashboard with local demo access…'});this.enqueue(job);return this.public(job);
  }
  async setup(id,config){
    const job=this.get(id);if(job.enqueued||job.status==='running')throw Error('This installation is already running.');
    if(job.status==='superseded')throw Error('Use the latest source ZIP for this website.');
    const adminPath=String(config.adminPath||'').trim();if(adminPath&&(!adminPath.startsWith('/')||adminPath.startsWith('//')||/[\\\r\n]/.test(adminPath)))throw Error('Admin path must be a local path, for example /admin.');
    if(job.status==='ready'){this.change(job,{adminPath});return this.public(job);}
    if(config.dbHost&&!['127.0.0.1','localhost'].includes(config.dbHost))throw Error('Use a local database host (127.0.0.1).');
    const environment=String(config.environment||'');if(environment.length>32000)throw Error('Environment settings are too long.');
    if(config.phpVersion&&!['8.2','8.4'].includes(config.phpVersion))throw Error('Select an available PHP runtime.');
    const environmentValues=Object.fromEntries(environment.split(/\r?\n/).filter(s=>/^[A-Z][A-Z0-9_]*=/.test(s)).map(s=>[s.split('=')[0],s.slice(s.indexOf('=')+1).replace(/^(["'])(.*)\1$/,'$2')]));
    job.config={...job.config,dbHost:config.dbHost||'127.0.0.1',dbPort:Number(config.dbPort)||3306,dbUser:String(config.dbUser||'root'),dbPassword:String(config.dbPassword||''),environment,environmentValues,phpVersion:config.phpVersion||'',outputDirectory:String(config.outputDirectory||'')};
    job.adminPath=adminPath;
    this.change(job,{status:'queued',message:'Setup saved. Continuing installation.',phase:'Queued'});this.enqueue(job);return this.public(job);
  }
  async sql(id,req){const job=this.get(id);if(job.status==='running'||job.enqueued||job.status==='ready')throw Error('SQL can be uploaded while this installation is waiting for setup.');const file=path.join(job.directory,'database-'+crypto.randomBytes(4).toString('hex')+'.sql');await this.receive(req,file,256*1024**2);job.sql=file;this.log(job,'SQL backup uploaded. Choose Install / Retry to import it into a separate database.');return this.public(job);}
  async command(job,exe,args,{input,timeout=15*60*1000,cwd=job.app}={}) {
    return new Promise((resolve,reject)=>{
      const env={...process.env,PATH:path.dirname(process.execPath)+path.delimiter+(process.env.PATH||''),COMPOSER_ALLOW_SUPERUSER:'1',COMPOSER_NO_INTERACTION:'1'};
      delete env.NODE_OPTIONS;delete env.NODE_PATH;
      const child=spawn(exe,args,{cwd,env,windowsHide:true,stdio:['pipe','pipe','pipe']});
      let tail='',done=false;const secrets=[job.config?.dbPassword,job.database?.password];
      const record=chunk=>{let value=chunk.toString();for(const secret of secrets)if(secret)value=value.replaceAll(secret,'[private]');tail=(tail+value).slice(-6000);this.log(job,value)};
      child.stdout.on('data',record);child.stderr.on('data',record);
      const timer=setTimeout(()=>{child.kill();finish(Error('Installation command timed out. Open Setup and retry.'))},timeout);timer.unref();
      const finish=error=>{if(done)return;done=true;clearTimeout(timer);error?reject(error):resolve(tail)};
      child.on('error',()=>finish(Error('Required runtime is unavailable: '+path.basename(exe))));
      child.on('exit',code=>finish(code===0?null:Object.assign(Error('Installation command failed ('+path.basename(exe)+'). See the progress log, correct the settings and retry.'),{output:tail,exitCode:code})));
      child.stdin.on('error',()=>{});child.stdin.end(input||'');
    });
  }
  need(job,message,missing=[]){this.log(job,message);this.change(job,{status:'setup',phase:'Setup required',message,missing});}
  async allocatePort(){for(let port=8500;port<9000;port++){if(this.sites.some(s=>s.port===port))continue;const free=await new Promise(resolve=>{const server=net.createServer();server.once('error',()=>resolve(false));server.listen(port,'127.0.0.1',()=>server.close(()=>resolve(true)))});if(free)return port;}throw Error('No local preview port is available.');}
  async install(job){
    try{
      this.change(job,{status:'running',phase:'Extracting source',message:'Preparing website source…',progress:10,missing:[]});
      if(!job.extracted){
        const destination=path.join(job.directory,'source');
        if(exists(destination))fs.rmSync(destination,{recursive:true,force:true});
        if(job.original)await fs.promises.cp(job.original,destination,{recursive:true,filter:src=>!['.git','node_modules'].includes(path.basename(src))&&!fs.lstatSync(src).isSymbolicLink()});
        else {const result=await extractZip(job.archive,destination);this.log(job,`Extracted ${result.count} entries (${Math.round(result.bytes/1024**2)} MB).`);}
        job.extracted=true;job.extractedRoot=destination;
      }
      this.change(job,{phase:'Detecting application',progress:25});
      const detected=detectSource(job.extractedRoot);Object.assign(job,detected);
      if(!job.sanitized){
        for(const entry of fs.readdirSync(job.app)){if(/^\.env(?:\.|$)/.test(entry)&&!entry.endsWith('.example')){const source=path.join(job.app,entry);if(fs.statSync(source).isFile())fs.renameSync(source,path.join(job.directory,'uploaded-'+entry));}}
        job.sanitized=true;this.log(job,'Original environment files kept private. Runtime uses local setup values.');
        if(job.wordpress&&exists(path.join(job.app,'wp-config.php')))fs.renameSync(path.join(job.app,'wp-config.php'),path.join(job.directory,'uploaded-wp-config.php'));
      }
      job.port||=await this.allocatePort();
      if(detected.missing?.length&&!job.config?.outputDirectory){
        if(exists(path.join(job.app,'dist/index.html'))){job.type='static';job.publicDir=path.join(job.app,'dist');}
        else return this.need(job,'Source files are missing: '+detected.missing.join(', ')+'. Upload a complete ZIP.',detected.missing);
      }
      if(detected.type==='incomplete')return this.need(job,detected.message,['Complete website source']);
      if(job.config?.outputDirectory){
        const output=safeRelative(job.app,job.config.outputDirectory);
        if(!exists(path.join(output,'index.html')))return this.need(job,'The output directory does not contain index.html.');
        job.type='static';job.publicDir=output;
      }else if(detected.type==='unsupported')return this.need(job,detected.message);
      if(job.type==='vite'){
        this.change(job,{phase:'Installing dependencies',progress:40,message:'Installing frontend dependencies…'});
        writeEnv(job.app,{},job.config?.environment);
        const npm=path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
        if(!exists(npm))return this.need(job,'Node/npm is missing. Install Node.js with npm, then retry.');
        const dependencyHash=()=>crypto.createHash('sha256').update(fs.readFileSync(path.join(job.app,'package.json'))).update(exists(path.join(job.app,'package-lock.json'))?fs.readFileSync(path.join(job.app,'package-lock.json')):'').digest('hex');
        if(!exists(path.join(job.app,'node_modules/.package-lock.json'))||job.dependenciesInstalledHash!==dependencyHash()){
          const args=[npm,'install','--ignore-scripts','--no-audit','--no-fund'];
          try{await this.command(job,process.execPath,args);}
          catch(error){
            if(!repairViteEsbuildPeer({app:job.app,backupDirectory:job.directory,report:error.output,log:message=>this.log(job,message)}))throw error;
            await this.command(job,process.execPath,args);
          }
          job.dependenciesInstalledHash=dependencyHash();this.persist();
        }
        const admin=discoverAdmin(job.app,job.type);job.adminPath||=admin.path;job.adminTabs=admin.tabs;
        if(admin.profile){prepareAdminDemo({...job,root:this.root,profile:admin.profile,log:message=>this.log(job,message)});job.demoAdapter=admin.profile;}
        const vite=path.join(job.app,'node_modules/vite/bin/vite.js');
        if(!exists(vite))return this.need(job,'Vite was not installed. Check package.json and the dependency log.');
        this.change(job,{phase:'Building website',progress:65,message:'Building original layouts and assets…'});
        await this.command(job,process.execPath,[vite,'build','--base','/']);
        if(job.demoAdapter)for(const file of fs.readdirSync(job.app).filter(file=>/schema\.sql$/i.test(file)))fs.copyFileSync(path.join(job.app,file),path.join(job.publicDir,file));
        if(!exists(path.join(job.publicDir,'index.html')))return this.need(job,'Build finished without dist/index.html. Enter the actual output directory in Setup.');
      }
      if(['laravel','php'].includes(job.type)){
        const constraint=job.type==='laravel'?readJSON(path.join(job.app,'composer.json')).require?.php||'':'';
        const newer=job.config?.phpVersion==='8.4'||(!job.config?.phpVersion&&/\b8\.[3-9]/.test(constraint));
        job.php=(newer?['E:/Tawhid/runtime/php/php.exe','C:/xampp/php/php.exe']:['C:/xampp/php/php.exe','E:/Tawhid/runtime/php/php.exe']).find(exists);
        if(!job.php)return this.need(job,'PHP runtime is missing. Install PHP locally, then retry.');
        if(job.wordpress){
          if(!job.database){const token=crypto.randomBytes(8).toString('hex'),config=job.config||{},database={name:'ml_'+token,user:'ml_'+token,password:crypto.randomBytes(24).toString('hex'),host:'127.0.0.1',port:config.dbPort||3306};await this.command(job,job.php,[path.join(this.root,'installer-database.php')],{input:JSON.stringify({...database,adminUser:config.dbUser||'root',adminPassword:config.dbPassword||''})});job.database=database;this.persist();}
          const db=job.database;
          const config={DB_NAME:db.name,DB_USER:db.user,DB_PASSWORD:db.password,DB_HOST:db.host+':'+db.port,DB_CHARSET:'utf8mb4',DB_COLLATE:'',WP_HOME:'http://127.0.0.1:'+job.port,WP_SITEURL:'http://127.0.0.1:'+job.port};
          const phpQuote=value=>"'"+String(value).replaceAll('\\','\\\\').replaceAll("'","\\'")+"'";
          fs.writeFileSync(path.join(job.app,'wp-config.php'),'<?php\n'+Object.entries(config).map(([key,value])=>'define('+phpQuote(key)+', '+phpQuote(value)+');').join('\n')+"\n$table_prefix = 'wp_';\ndefine('ABSPATH', __DIR__ . '/');\nrequire_once ABSPATH . 'wp-settings.php';\n");
        }
        if(job.type==='laravel'){
          if(!exists(path.join(job.app,'vendor/autoload.php'))){
            let composer=['C:/ProgramData/ComposerSetup/bin/composer.phar','E:/Tawhid/runtime/composer.phar',path.join(this.root,'data/tools/composer.phar')].find(exists);
            if(!composer){
              this.change(job,{phase:'Preparing Composer',progress:35});
              const tools=path.join(this.root,'data/tools');fs.mkdirSync(tools,{recursive:true});
              const response=await fetch('https://getcomposer.org/download/latest-stable/composer.phar',{signal:AbortSignal.timeout(60000)});
              const checksum=await fetch('https://getcomposer.org/download/latest-stable/composer.phar.sha256',{signal:AbortSignal.timeout(30000)});
              if(!response.ok||!checksum.ok)throw Error('Composer download failed. Check the network and retry.');
              const binary=Buffer.from(await response.arrayBuffer()),expected=(await checksum.text()).trim().split(/\s/)[0];
              if(crypto.createHash('sha256').update(binary).digest('hex')!==expected)throw Error('Composer checksum did not match. Retry the download.');
              composer=path.join(tools,'composer.phar');fs.writeFileSync(composer,binary);this.log(job,'Downloaded Composer and verified its official SHA-256 checksum.');
            }
            this.change(job,{phase:'Installing PHP dependencies',progress:45});
            await this.command(job,job.php,[composer,'install','--no-interaction','--no-scripts','--no-plugins','--prefer-dist']);
          }
          if(!job.database){
            let sql=job.sql;
            for(const candidate of ['installation/backup/database.sql','database.sql','database/database.sql','install/database.sql'])if(!sql&&exists(path.join(job.app,candidate)))sql=path.join(job.app,candidate);
            const hasMigrations=exists(path.join(job.app,'database/migrations'))&&fs.readdirSync(path.join(job.app,'database/migrations')).some(s=>s.endsWith('.php'));
            if(!sql&&(job.requiresSQL||!hasMigrations))return this.need(job,'Upload the base database .sql backup, then choose Install / Retry.',['Database SQL backup']);
            const token=crypto.randomBytes(8).toString('hex'),config=job.config||{};
            const database={name:'ml_'+token,user:'ml_'+token,password:crypto.randomBytes(24).toString('hex'),host:config.dbHost||'127.0.0.1',port:config.dbPort||3306};
            this.change(job,{phase:'Creating isolated database',progress:55});
            await this.command(job,job.php,[path.join(this.root,'installer-database.php')],{input:JSON.stringify({...database,adminUser:config.dbUser||'root',adminPassword:config.dbPassword||'',sql})});
            job.database=database;job.needsMigrations=!sql;if(job.config)job.config.dbPassword='';this.persist();
          }
          const db=job.database;
          job.appKey||='base64:'+crypto.randomBytes(32).toString('base64');
          writeEnv(job.app,{APP_ENV:'local',APP_DEBUG:'false',APP_KEY:job.appKey,APP_URL:'http://127.0.0.1:'+job.port,DB_CONNECTION:'mysql',DB_HOST:db.host,DB_PORT:db.port,DB_DATABASE:db.name,DB_USERNAME:db.user,DB_PASSWORD:db.password,SESSION_DRIVER:'file',SESSION_COOKIE:'master_upload_'+job.id,SESSION_DOMAIN:'',SESSION_SECURE_COOKIE:'false',CACHE_DRIVER:'file',CACHE_STORE:'file',QUEUE_CONNECTION:'sync',MAIL_MAILER:'log'},job.config?.environment);
          for(const dir of ['storage/framework/cache/data','storage/framework/sessions','storage/framework/views','storage/app/public','storage/logs','bootstrap/cache'])fs.mkdirSync(path.join(job.app,dir),{recursive:true});
          if(!exists(path.join(job.app,'public/storage')))try{fs.symlinkSync(path.join(job.app,'storage/app/public'),path.join(job.app,'public/storage'),process.platform==='win32'?'junction':'dir');}catch{this.log(job,'Public storage link could not be created. Check filesystem permissions for uploaded media.');}
          for(const file of ['config.php','routes-v7.php'])fs.rmSync(path.join(job.app,'bootstrap/cache',file),{force:true});
          await this.command(job,job.php,['artisan','package:discover','--ansi']);
          if(job.needsMigrations){await this.command(job,job.php,['artisan','migrate','--force']);job.needsMigrations=false;this.persist();}
        }
      }
      if(!job.adminPath)job.adminPath=discoverAdmin(job.app,job.type).path;
      this.change(job,{phase:'Starting preview',progress:85,message:'Starting and checking the installed website…'});
      await this.startSite(this.sites.find(s=>s.id===job.siteId));
      await this.check(job.id,true);
    }catch(e){this.need(job,e.message);}
  }
  async check(id,internal=false){
    const job=this.get(id);if(!job.port||!job.app)throw Error('Install the source first.');
    if(!internal&&(job.status==='running'||job.enqueued))throw Error('Wait for the current installation to finish.');
    let last;
    for(let attempt=0;attempt<15;attempt++){
      try{
        const response=await fetch('http://127.0.0.1:'+job.port,{signal:AbortSignal.timeout(5000)}),html=await response.text();
        if(!response.ok)throw Error('Homepage returned HTTP '+response.status+'. Check the application log and Setup values.');
        const final=new URL(response.url);
        if(/\/(install|setup)(?:\.php)?(\/|$)/i.test(final.pathname)){job.nativeSetup=final.pathname;this.need(job,'Open the website installer below, finish its setup, then choose Check installation.');return this.public(job);}
        const assets=[...html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)=["']([^"']+)["']/gi)].map(match=>new URL(match[1],response.url)).filter(url=>url.origin===final.origin&&/\.(?:css|m?js)$/.test(url.pathname)).slice(0,12);
        for(const asset of assets){const result=await fetch(asset,{signal:AbortSignal.timeout(5000)});if(!result.ok||!/(?:css|javascript)/.test(result.headers.get('content-type')||''))throw Error('A stylesheet or script did not load: '+asset.pathname);await result.body?.cancel();}
        job.title=(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||job.name).replace(/\s+/g,' ').slice(0,200);
        this.log(job,'Homepage responded successfully. Website installed on port '+job.port+'.');
        this.change(job,{status:'ready',phase:'Installed',progress:100,message:'Installed successfully. Public portal is ready.'});return this.public(job);
      }catch(e){last=e;await new Promise(resolve=>setTimeout(resolve,350));}
    }
    this.need(job,last?.message||'Preview did not start. Check the log and retry.');return this.public(job);
  }
}
