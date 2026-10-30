import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalSupabase} from '../local-supabase.mjs';
const storage=()=>{const values=new Map();return {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};};
const admin={id:'local-admin',email:'demo@local.test',role:'admin'};
test('demo product edits persist into the public catalog and support filtered updates, upserts and deletes',async()=>{
  const saved=storage(),client=createLocalSupabase({storage:saved,user:admin,seed:{products:[{id:'one',name:'Original',price:5},{id:'two',name:'Other',price:10}]}});
  assert.equal((await client.from('products').update({name:'Edited'}).eq('id','one').select().single()).data.name,'Edited');
  const publicClient=createLocalSupabase({storage:saved});assert.equal((await publicClient.from('products').select('*').eq('id','one').single()).data.name,'Edited');
  await client.from('products').upsert({id:'one',price:7});assert.equal((await client.from('products').select('*',{count:'exact'})).count,2);
  const found=await client.from('products').select().or('name.ilike.%edit%,price.gte.10').order('price',{ascending:false}).range(0,0);assert.equal(found.data[0].id,'two');
  await client.from('products').delete().in('id',['two']);assert.equal((await publicClient.from('products').select()).data.length,1);
});
test('anonymous sessions cannot manufacture an admin profile through local storage or password login',async()=>{
  const saved=storage(),client=createLocalSupabase({storage:saved});await client.from('profiles').upsert({id:'fake',role:'admin'});
  assert.equal((await client.auth.getUser()).data.user,null);assert.deepEqual((await client.from('profiles').select()).data,[]);
  assert.ok((await client.auth.signInWithPassword({email:'x',password:'anything'})).error);
});
test('signed demo user is exposed through auth and role lookup, and logout uses its local CSRF session',async()=>{
  const calls=[],client=createLocalSupabase({storage:storage(),user:admin,csrf:'local-csrf',fetcher:async(...args)=>{calls.push(args);return {ok:true}}});
  assert.equal((await client.auth.getSession()).data.session.user.id,admin.id);assert.equal((await client.from('profiles').select('role').eq('id',admin.id).single()).data.role,'admin');assert.equal(calls.length,0);
  await client.auth.signOut();assert.equal(calls[0][0],'/__master/logout');assert.equal(calls[0][1].headers['X-Master-CSRF'],'local-csrf');assert.equal((await client.auth.getUser()).data.user,null);
});
