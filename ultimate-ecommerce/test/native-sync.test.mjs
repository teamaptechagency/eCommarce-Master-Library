import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {createStore} from '../store.mjs';import {writeSnapshot} from '../native/snapshot.mjs';import {importChanges} from '../native/import-changes.mjs';import {paletteCss} from '../native/palette.mjs';import {defaultAppearance} from '../appearance.mjs';
test('native edits change only edited fields, retain core IDs, and record inventory movements',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'astrallab-native-'));fs.mkdirSync(path.join(root,'data'));const store=createStore(':memory:',{seed:false});
 const product=store.insert('products',{name:'Shared item',sku:'AST-001',slug:'shared-item',price:120,cost:40,stock:10,status:'active',description:'Shared',image:'/assets/product-1.png'});
 const before={native_id:product.id,name:'Shared item',stock:10,cost:0};const after={...before,name:'Updated in source admin',stock:8};
 importChanges(store,root,{id:'martvill'},[{kind:'products',native_id:product.id,before,after}]);const result=store.get('products',product.id);
 assert.equal(result.name,after.name);assert.equal(result.stock,8);assert.equal(result.cost,40);assert.equal(result.image,product.image);
 assert.equal(store.db.prepare('SELECT delta FROM stock_movements').get().delta,-2);store.db.close();
});
test('native new IDs are mapped and subsequent edits reach the same canonical record',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'astrallab-native-id-'));fs.mkdirSync(path.join(root,'data'));const store=createStore(':memory:',{seed:false});
 store.insert('brands',{name:'ID already occupied',status:'active'});const after={native_id:1,name:'Native category',slug:'native-category',status:'active'};
 importChanges(store,root,{id:'nest'},[{kind:'categories',native_id:1,before:null,after}]);const category=store.list('categories')[0];assert.notEqual(category.id,1);
 importChanges(store,root,{id:'nest'},[{kind:'categories',native_id:1,before:after,after:{...after,name:'Renamed'}}]);assert.equal(store.list('categories').length,1);assert.equal(store.get('categories',category.id).name,'Renamed');store.db.close();
});
test('snapshot gives all source engines the same guest customers and does not duplicate them',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'astrallab-snapshot-'));fs.mkdirSync(path.join(root,'data'));const store=createStore(':memory:');
 const a=writeSnapshot(store,root);const b=writeSnapshot(store,root);assert.equal(a.revision,b.revision);assert.equal(a.customers.length,b.customers.length);assert(a.orders.every(o=>a.customers.some(c=>c.email===o.email)));store.db.close();
});
test('native color modes retain accent and never introduce layout geometry',()=>{
 const a=defaultAppearance();a.frontend.mode='dark';const dark=paletteCss(a,'frontend');a.frontend.mode='night';const night=paletteCss(a,'frontend');assert(dark.includes('#191d29'));assert(night.includes('#070b14'));assert(dark.includes('#7959da'));assert(!/\b(?:display|width|height|grid-template|position|padding|margin)\s*:/.test(night));
});
