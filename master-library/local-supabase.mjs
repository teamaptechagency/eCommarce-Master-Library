// Supabase-shaped storage for an isolated browser demo. No remote project keys,
// network database operations, or password-based administrator bypasses.
export function createLocalSupabase({storage,user=null,seed={},fetcher=globalThis.fetch,csrf='',prefix='master_demo_',id=()=>crypto.randomUUID()}){
  const listeners=new Set();let currentUser=user;
  const clone=value=>JSON.parse(JSON.stringify(value));
  const read=table=>{try{const saved=storage.getItem(prefix+table);return saved?JSON.parse(saved):clone(seed[table]||[])}catch{return clone(seed[table]||[])}};
  const write=(table,rows)=>storage.setItem(prefix+table,JSON.stringify(rows));
  const same=(a,b)=>a==null||b==null?a===b:String(a)===String(b);
  const value=(row,column)=>column.split('.').reduce((result,key)=>result?.[key],row);
  const compare=(row,column,operator,expected)=>{
    const actual=value(row,column);
    if(operator==='eq'||operator==='is')return same(actual,expected);
    if(operator==='neq')return !same(actual,expected);
    if(operator==='gt')return actual>expected;if(operator==='gte')return actual>=expected;
    if(operator==='lt')return actual<expected;if(operator==='lte')return actual<=expected;
    if(operator==='in')return expected.some(item=>same(actual,item));
    if(operator==='contains')return Array.isArray(actual)?expected.every(item=>actual.includes(item)):Object.entries(expected).every(([key,item])=>same(actual?.[key],item));
    if(operator==='like'||operator==='ilike'){const escaped=String(expected).replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replaceAll('%','.*').replaceAll('_','.');return new RegExp('^'+escaped+'$',operator==='ilike'?'i':'').test(String(actual||''));}
    return false;
  };
  class Query {
    constructor(table){this.table=table;this.filters=[];this.sorts=[];this.operation='select';this.offset=0;this.maximum=Infinity;}
    select(_columns='*',options={}){this.count=options.count;this.head=options.head;return this;}
    insert(payload){this.operation='insert';this.payload=payload;return this;}
    upsert(payload,options={}){this.operation='upsert';this.payload=payload;this.conflict=(options.onConflict||'id').split(',');return this;}
    update(payload){this.operation='update';this.payload=payload;return this;}
    delete(){this.operation='delete';return this;}
    filter(column,operator,expected){this.filters.push(row=>compare(row,column,operator,expected));return this;}
    eq(c,v){return this.filter(c,'eq',v)}neq(c,v){return this.filter(c,'neq',v)}is(c,v){return this.filter(c,'is',v)}
    gt(c,v){return this.filter(c,'gt',v)}gte(c,v){return this.filter(c,'gte',v)}lt(c,v){return this.filter(c,'lt',v)}lte(c,v){return this.filter(c,'lte',v)}
    in(c,v){return this.filter(c,'in',v)}contains(c,v){return this.filter(c,'contains',v)}like(c,v){return this.filter(c,'like',v)}ilike(c,v){return this.filter(c,'ilike',v)}
    match(values){for(const [c,v]of Object.entries(values))this.eq(c,v);return this;}
    not(c,op,v){this.filters.push(row=>!compare(row,c,op,v));return this;}
    or(expression){const clauses=expression.split(',').map(part=>part.match(/^([\w.]+)\.(eq|neq|ilike|like|gte|lte)\.(.*)$/)).filter(Boolean);this.filters.push(row=>clauses.some(([,c,op,v])=>compare(row,c,op,v)));return this;}
    order(column,{ascending=true}={}){this.sorts.push({column,ascending});return this;}
    limit(count){this.maximum=Math.max(0,Number(count)||0);return this;}
    range(from,to){this.offset=Math.max(0,from);this.maximum=Math.max(0,to-from+1);return this;}
    single(){this.one=true;return this;}
    maybeSingle(){this.one=true;this.optional=true;return this;}
    async execute(){
      try{
        let rows=this.table==='profiles'?(currentUser?[{...currentUser,role:'admin'}]:[]):read(this.table),result=[];
        const matches=row=>this.filters.every(filter=>filter(row));
        if(this.operation==='insert'||this.operation==='upsert'){
          for(const item of Array.isArray(this.payload)?this.payload:[this.payload]){
            const keys=this.conflict||['id'],index=this.operation==='upsert'?rows.findIndex(row=>keys.every(key=>item[key]!==undefined&&same(row[key],item[key]))):-1;
            const row={id:id(),created_at:new Date().toISOString(),...item};
            if(index>=0){rows[index]={...rows[index],...item};result.push(rows[index]);}else{rows.push(row);result.push(row);}
          }
        }else if(this.operation==='update'){rows=rows.map(row=>{if(!matches(row))return row;const next={...row,...this.payload,updated_at:new Date().toISOString()};result.push(next);return next;});}
        else if(this.operation==='delete'){result=rows.filter(matches);rows=rows.filter(row=>!matches(row));}
        else result=rows.filter(matches);
        if(this.operation!=='select')write(this.table,rows);
        const count=result.length;
        for(const {column,ascending}of this.sorts.toReversed())result.sort((a,b)=>{const x=value(a,column),y=value(b,column);return(x===y?0:x>y?1:-1)*(ascending?1:-1)});
        result=result.slice(this.offset,this.offset+this.maximum);
        const error=this.one&&!this.optional&&!result.length?{message:'Record not found',code:'PGRST116'}:null;
        return {data:this.head?null:clone(this.one?result[0]||null:result),error,count:this.count?count:null,status:error?406:200};
      }catch(error){return {data:null,error:{message:error.message},count:null,status:400};}
    }
    then(resolve,reject){this.result||=this.execute();return this.result.then(resolve,reject);}
  }
  const session=()=>currentUser?{user:currentUser,access_token:'local-demo-session'}:null;
  const denied=async()=>({data:{user:null,session:null},error:{message:'Open Admin Demo from Master Library for password-free local access.'}});
  const fileData=file=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Could not read image'));reader.readAsDataURL(file)});
  return {
    from:table=>new Query(table),
    auth:{
      getUser:async()=>({data:{user:currentUser},error:null}),getSession:async()=>({data:{session:session()},error:null}),
      onAuthStateChange(callback){listeners.add(callback);queueMicrotask(()=>{if(listeners.has(callback))callback('INITIAL_SESSION',session())});return {data:{subscription:{unsubscribe:()=>listeners.delete(callback)}}};},
      signInWithPassword:denied,signUp:denied,resetPasswordForEmail:denied,
      async signOut(){const result=await fetcher('/__master/logout',{method:'POST',headers:{'X-Master-CSRF':csrf}});if(!result.ok)return {error:{message:'Could not end the local demo session'}};currentUser=null;for(const listener of listeners)listener('SIGNED_OUT',null);return {error:null};},
      async updateUser(values){if(!currentUser)return denied();currentUser={...currentUser,user_metadata:{...currentUser.user_metadata,...values.data}};return {data:{user:currentUser},error:null};}
    },
    channel(){const channel={on:()=>channel,subscribe:()=>channel,unsubscribe:()=>{}};return channel;},removeChannel:async()=>{},
    rpc:async()=>({data:null,error:{message:'This database function requires the application backend.'}}),
    storage:{from:bucket=>({
      async upload(filename,file){try{if(file.size>5*1024**2||!file.type.startsWith('image/'))throw Error('Choose an image up to 5 MB');storage.setItem(prefix+'image:'+bucket+':'+filename,await fileData(file));return {data:{path:filename},error:null};}catch(error){return {data:null,error:{message:error.message}};}},
      getPublicUrl:filename=>({data:{publicUrl:storage.getItem(prefix+'image:'+bucket+':'+filename)||''}}),
      remove:async filenames=>{for(const filename of filenames)storage.removeItem(prefix+'image:'+bucket+':'+filename);return {data:[],error:null};}
    })}
  };
}
