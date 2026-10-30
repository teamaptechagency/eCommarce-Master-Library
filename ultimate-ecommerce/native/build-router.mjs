import fs from 'node:fs';import path from 'node:path';import {root} from './sources.mjs';
const master=fs.readFileSync(path.join(root,'../master-library/router.php'),'utf8');
const demo=master.slice(master.indexOf('$demoRoute ='),master.indexOf('try {\n    $response =')).replaceAll('/__master/demo-login','/__native/demo-login');
const head=fs.readFileSync(path.join(root,'native/router-head.php.txt'),'utf8');
const tail=`\n$response=$kernel->handle($request);$response->headers->remove('X-Frame-Options');$response->send();$kernel->terminate($request,$response);\n`;
fs.writeFileSync(path.join(root,'native/router.php'),head+'\n'+demo+tail);
