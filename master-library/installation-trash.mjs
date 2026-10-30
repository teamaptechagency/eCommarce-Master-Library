import fs from 'node:fs';
import path from 'node:path';
const normalize=value=>process.platform==='win32'?value.toLowerCase():value;
const equal=(a,b)=>normalize(path.resolve(a))===normalize(path.resolve(b));
const stat=file=>fs.lstatSync(file,{throwIfNoEntry:false});
export function installationPaths(root,job){
  if(!/^[a-f0-9]{16}$/.test(job.id))throw Error('Invalid installation ID.');
  const base=path.resolve(root,'data/installations'),directory=path.join(base,job.id),trashRoot=path.join(base,'.trash'),trash=path.join(trashRoot,job.id);
  const actualRoot=fs.realpathSync(root),actualBase=fs.realpathSync(base);
  if(!normalize(actualBase).startsWith(normalize(actualRoot+path.sep)))throw Error('Installation storage is outside the library.');
  if(!equal(job.directory,directory))throw Error('Installation directory does not match its ID.');
  if(stat(trashRoot)?.isSymbolicLink())throw Error('Trash cannot be a symbolic link.');
  fs.mkdirSync(trashRoot,{recursive:true});
  if(!equal(fs.realpathSync(trashRoot),path.join(actualBase,'.trash')))throw Error('Trash is outside installation storage.');
  if(job.trash?.directory&&!equal(job.trash.directory,trash))throw Error('Trash directory does not match its ID.');
  return {base,directory,trash,trashRoot};
}
export async function moveInstallation(root,job,restore=false){
  const paths=installationPaths(root,job),from=restore?paths.trash:paths.directory,to=restore?paths.directory:paths.trash;
  const source=stat(from);if(!source?.isDirectory()||source.isSymbolicLink())throw Error('The installation directory is missing or is a symbolic link.');
  const expected=path.join(fs.realpathSync(paths.base),...(restore?['.trash',job.id]:[job.id]));
  if(!equal(fs.realpathSync(from),expected))throw Error('Installation resolves outside its expected directory.');
  if(stat(to))throw Error('The destination already exists. No files were replaced.');
  // Both absolute paths and their real parents are checked before this move.
  for(let attempt=0;;attempt++)try{await fs.promises.rename(from,to);return paths;}catch(error){if(attempt>=2||!['EPERM','EBUSY','EACCES'].includes(error.code))throw error;await new Promise(resolve=>setTimeout(resolve,150*(attempt+1)));}
}
