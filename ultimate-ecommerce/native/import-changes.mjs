import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
export function importChanges(store,root,source,changes){
 const file=path.join(root,`data/native-identities-${source.id}.json`);const identities=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{};
 const canonical=(kind,native)=>Number(Object.entries(identities[kind]||{}).find(([,id])=>Number(id)===Number(native))?.[0]||native);
 const original=structuredClone(identities);
 // Native source validation/authentication has already run. Only fields that actually
 // changed in that request are copied, preserving central-only commerce fields.
 store.transaction(()=>{
  for(const kind of ['categories','brands','customers','products','orders'])for(const change of changes.filter(c=>c.kind===kind)){
   const id=canonical(kind,change.native_id);const before=change.before;const after=change.after;
   if(kind==='orders'){
    if(!after)throw Error('Orders cannot be deleted from a theme; cancel the order instead.');
    const prior=store.db.prepare('SELECT * FROM orders WHERE id=?').get(id);
    const status=['pending','processing','shipped','delivered','cancelled','refunded'].includes(after.status)?after.status:'pending';
    if(prior){store.db.prepare('UPDATE orders SET status=?,payment_status=?,updated_at=? WHERE id=?').run(status,after.payment_status==='paid'?'paid':'unpaid',new Date().toISOString(),id);}
    else {
     const cents=v=>Math.round(Number(v||0)*100);const stamp=new Date(after.created_at).toISOString();
     const result=store.db.prepare(`INSERT INTO orders(number,customer_name,email,phone,address,subtotal,discount,shipping,tax,total,status,payment_status,payment_method,channel,receipt_token,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(after.number,after.customer_name,after.email,after.phone,after.address,cents(after.subtotal),cents(after.discount),cents(after.shipping),cents(after.tax),cents(after.total),status,after.payment_status==='paid'?'paid':'unpaid','cod','storefront',crypto.randomUUID(),stamp,stamp);
     const newId=Number(result.lastInsertRowid);(identities.orders??={})[newId]=change.native_id;
     for(const i of after.items){const pid=canonical('products',i.product_id);const p=store.get('products',pid);if(!p)throw Error('Native order references an unknown product');store.db.prepare('INSERT INTO order_items(order_id,product_id,name,sku,image,quantity,unit_price,unit_cost,vendor_id,commission) VALUES(?,?,?,?,?,?,?,?,?,?)').run(newId,pid,i.name||p.name,i.sku||p.sku,p.image,i.quantity,cents(i.unit_price),cents(p.cost),p.vendor_id||null,0);}
    }
    store.audit('Native order updated',kind,id,source.id);continue;
   }
   const old=store.get(kind,id);
   if(!after){if(old){store.update(kind,id,{status:'archived'});store.audit('Archived from native layout',kind,id,source.id);}continue;}
   const data={};for(const [key,value]of Object.entries(after))if(key!=='native_id'&&(!before||JSON.stringify(before[key])!==JSON.stringify(value)))data[key]=value;
   for(const [field,related]of [['category_id','categories'],['brand_id','brands']])if(field in data)data[field]=data[field]?canonical(related,data[field]):null;
   if(old){store.update(kind,id,data);if(kind==='products'&&data.stock!==undefined&&data.stock!==old.stock)store.db.prepare('INSERT INTO stock_movements(product_id,delta,reason,reference,created_at) VALUES(?,?,?,?,?)').run(id,data.stock-old.stock,'Native inventory adjustment',source.id,new Date().toISOString());store.audit('Updated from native layout',kind,id,source.id);}
   else {
    const created=store.insert(kind,{status:'active',image:'/assets/product-1.png',...(kind==='products'?{product_type:'physical',featured:'yes',vendor_id:store.list('vendors')[0]?.id||null}:{}),...data});(identities[kind]??={})[created.id]=change.native_id;store.audit('Created from native layout',kind,created.id,source.id);
   }
  }
 });
 if(JSON.stringify(identities)!==JSON.stringify(original))fs.writeFileSync(file,JSON.stringify(identities));
 return changes.length;
}
