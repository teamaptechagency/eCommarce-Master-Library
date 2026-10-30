import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
export function writeSnapshot(store,root){
 // Native commerce engines require a customer record for an order. Materialize
 // historical guest buyers once in the canonical store, rather than inventing
 // different customer IDs in each layout's database.
 const orders=store.db.prepare('SELECT id FROM orders ORDER BY id').all().map(o=>store.order(o.id));
 const emails=new Set(store.list('customers').map(c=>c.email.toLowerCase()));
 for(const o of orders)if(!emails.has(o.email.toLowerCase())){store.insert('customers',{name:o.customer_name,email:o.email,phone:o.phone||'',address:o.address||'',status:'active'});emails.add(o.email.toLowerCase());}
 const snapshot={};for(const kind of ['products','categories','brands','customers'])snapshot[kind]=store.list(kind).map(store.clean);
 snapshot.products=snapshot.products.map(p=>({cost:0,description:'',brand_id:snapshot.brands[0]?.id||null,...p,sale_price:store.salePrice(p)}));
 snapshot.orders=orders;
 const content=JSON.stringify(snapshot);snapshot.revision=crypto.createHash('sha256').update(content).digest('hex');
 const file=path.join(root,'data/native-snapshot.json');const old=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')).revision:null;
 if(old!==snapshot.revision){fs.writeFileSync(file+'.tmp',JSON.stringify(snapshot));fs.renameSync(file+'.tmp',file);}
 return snapshot;
}
