import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const workspace=path.dirname(root);
const php='C:/xampp/php/php.exe';
export const sources=[
 {id:'shopperzz',source:path.join(workspace,'E-commerce-6/local-app/shopperzz'),php,port:8306,admin:'/admin/dashboard',family:'shopperzz'},
 {id:'nest',source:path.join(workspace,'E-commerce-14/local-app'),php,port:8314,admin:'/admin',family:'botble'},
 {id:'shofy',source:path.join(workspace,'E-commerce-25/local-app'),php,port:8325,admin:'/admin',family:'botble'},
 {id:'grostore',source:path.join(workspace,'E-commerce-19/local-app'),php,port:8319,admin:'/admin',family:'grostore'},
 {id:'martvill',source:path.join(workspace,'E-commerce-2/local-app'),php,port:8302,admin:'/admin/dashboard',family:'martvill'},
 {id:'footstep',source:'E:/Tawhid/public_html',php:'E:/Tawhid/runtime/php/php.exe',port:8301,admin:'/admin',family:'footstep'}
].map(s=>({...s,engine:path.join(root,'data/native-engines',s.id),database:'astrallab_source_'+s.id+'_20261029'}));
