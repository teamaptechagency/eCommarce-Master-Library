<?php
// Operates only on the owned projection opened by project.php.
$brand='Ultimate Ecommarce By Astrallab';$logo='http://127.0.0.1:8200/__ultimate/logo.svg';
if($family==='botble'){
 foreach($r->all('settings') as $setting){$key=$setting['key'];$value=null;
  if($key==='ecommerce_store_name'||preg_match('/^theme-.*-site_title$/',$key))$value=$brand;
  if($key==='admin_logo'||preg_match('/^theme-.*-(logo|logo_light|logo_dark|favicon)$/',$key))$value=$logo;
  if($value!==null)$pdo->prepare('UPDATE settings SET value=? WHERE id=?')->execute([$value,$setting['id']]);
 }
 $pdo->exec("UPDATE ec_currencies SET is_default=0");$pdo->prepare('UPDATE ec_currencies SET title=?,symbol=?,exchange_rate=1,is_default=1 WHERE id=1')->execute(['BDT','৳']);
}elseif($family==='shopperzz'){
 foreach(['company_name'=>$brand,'site_default_currency_symbol'=>'৳'] as $key=>$value)$pdo->prepare('UPDATE settings SET payload=? WHERE `key`=?')->execute([json_encode(['$value'=>$value,'$cast'=>null]),$key]);
 $pdo->prepare('UPDATE currencies SET name=?,code=?,symbol=? WHERE id=1')->execute(['Bangladeshi Taka','BDT','৳']);
 foreach(['theme-logo.png','theme-footer-logo.png','theme-favicon-logo.png'] as $filename){$dir=$s['engine'].'/public/images/required';if(is_dir($dir)){// Native fallbacks accept SVG content with a matching browser MIME set by the router.
  file_put_contents($dir.'/'.$filename.'.astrallab',file_get_contents($root.'/public/assets/astrallab-logo.svg'));
 }}
}elseif($family==='grostore'){
 $r->insert('media_managers',['id'=>9010000,'user_id'=>1,'media_file'=>'__ultimate/logo.svg','media_name'=>$brand,'media_type'=>'image','media_extension'=>'svg']);
 foreach(['system_title'=>$brand,'global_meta_title'=>$brand,'navbar_logo'=>'9010000','footer_logo'=>'9010000','admin_panel_logo'=>'9010000','default_currency'=>'BDT'] as $key=>$value)$pdo->prepare('UPDATE system_settings SET value=? WHERE entity=?')->execute([$value,$key]);
 $pdo->prepare('UPDATE currencies SET code=?,name=?,symbol=?,rate=1 WHERE id=1')->execute(['BDT','Bangladeshi Taka','৳']);
 $envPath=$s['engine'].'/.env';$env=file_get_contents($envPath);foreach(['DEFAULT_CURRENCY'=>'BDT','DEFAULT_CURRENCY_RATE'=>'1','DEFAULT_CURRENCY_SYMBOL'=>'৳','DEFAULT_CURRENCY_SYMBOL_ALIGNMENT'=>'0'] as $key=>$value){if(preg_match('/^'.$key.'=/m',$env))$env=preg_replace('/^'.$key.'=.*$/m',$key.'='.$value,$env);else $env.="\n$key=$value";}file_put_contents($envPath,$env);
}elseif($family==='martvill'){
 foreach(['company_name'=>$brand,'site_short_name'=>'Astrallab'] as $key=>$value)$pdo->prepare('UPDATE preferences SET value=? WHERE field=?')->execute([$value,$key]);
 $id=$pdo->query("SELECT id FROM currencies WHERE name='BDT' LIMIT 1")->fetchColumn();if($id)$pdo->prepare("UPDATE preferences SET value=? WHERE field='dflt_currency_id'")->execute([$id]);
}elseif($family==='footstep'){
 foreach(['site_name','store_name','site_title','business_name'] as $key)$pdo->prepare('UPDATE settings SET value=? WHERE `key`=?')->execute([$brand,$key]);
}
