import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {colorPacks,frontendLayouts,backendLayouts,defaultAppearance,validateAppearance,resolveAppearance} from '../appearance.mjs';
test('layout and color pack selection are independent on both surfaces',()=>{
 const a=validateAppearance({frontend:{layout:'nest',pack:'ocean',mode:'night'},backend:{layout:'shofy',pack:'forest',mode:'dark'}},defaultAppearance());
 const changed=validateAppearance({frontend:{layout:'martvill'}},a);assert.equal(changed.frontend.pack,'ocean');assert.equal(changed.frontend.mode,'night');assert.deepEqual(changed.backend,a.backend);
 assert.equal(colorPacks.length,12);assert.equal(frontendLayouts.length,6);assert.equal(backendLayouts.length,6);
});
test('custom packs are reusable and reject CSS injection or builtin replacement',()=>{
 const pack={...colorPacks[0],id:'my-brand',name:'My brand'};const a=validateAppearance({customPack:pack},defaultAppearance());const b=validateAppearance({frontend:{pack:'my-brand'},backend:{pack:'my-brand'}},a);assert.equal(b.backend.pack,'my-brand');
 assert.throws(()=>validateAppearance({customPack:{...pack,accent:'red;display:none'}},a),/six-digit/);assert.throws(()=>validateAppearance({customPack:{...pack,id:'violet'}},a),/unique/);
 assert.throws(()=>validateAppearance({frontend:{mode:'unknown'}},a),/Light, Dark or Night/);
});
test('legacy layout migrates without making its colors part of the theme',()=>{const a=resolveAppearance(null,'footstep');assert.equal(a.frontend.layout,'footstep');assert.equal(a.frontend.pack,'violet');assert.equal(a.backend.layout,'shopperzz')});
test('storefront source no longer renders a theme selector or public theme title',()=>{
 const js=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');const shell=js.slice(js.indexOf('function storefrontShell'),js.indexOf('function home'));
 assert(!shell.includes('theme-strip'));assert(!shell.includes('store-theme'));assert(!shell.includes('Theme library'));assert(!shell.includes('t.name'));
 const design=fs.readFileSync(new URL('../public/design.js',import.meta.url),'utf8');assert(!design.includes('structureStore'));assert(design.includes('ORIGINAL SOURCE'));for(const layout of frontendLayouts)assert(!layout.description.includes('Three-panel')); 
});
