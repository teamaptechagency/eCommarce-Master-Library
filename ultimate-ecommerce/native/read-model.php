<?php
// Normalized commerce records for comparing a native request with its last projection.
$out=['products'=>[],'categories'=>[],'brands'=>[],'customers'=>[],'orders'=>[]];
$family=$s['family'];$r??=new NativeRows($pdo);
$num=fn($v)=>round((float)$v,6);$active=fn($v)=>in_array(strtolower((string)$v),['active','published','1','5'],true)?'active':'draft';
$slugs=[];foreach($r->all('slugs') as $slug)$slugs[$slug['reference_type']][$slug['reference_id']]=$slug['key'];
$canonicalSnapshot=json_decode(file_get_contents($root.'/data/native-snapshot.json'),true);$imageById=[];
$idFile=$root.'/data/native-identities-'.$s['id'].'.json';$nativeIds=is_file($idFile)?json_decode(file_get_contents($idFile),true):[];
foreach($canonicalSnapshot['products'] as $canonicalProduct)$imageById[$nativeIds['products'][$canonicalProduct['id']]??$canonicalProduct['id']]=$canonicalProduct['image'];
$mediaRows=[];foreach($r->all($family==='grostore'?'media_managers':'media') as $media)$mediaRows[$media['id']]=$media;
$imageRows=[];foreach($r->all('product_images') as $im)if(!isset($imageRows[$im['product_id']])||$im['is_featured'])$imageRows[$im['product_id']]=$im['media_id'];
$metaImages=[];if($family==='martvill')foreach($r->all('products_meta') as $meta)if($meta['key']==='meta_image')$metaImages[$meta['product_id']]=json_decode($meta['value'],true)[0]??null;
$normalizeImage=function($value)use($family,$s){if(!$value)return '/assets/product-1.png';if(str_starts_with($value,'__ultimate/')||str_starts_with($value,'assets/'))return '/'.$value;if(preg_match('#^https?://(?:127\.0\.0\.1|localhost):8200(/.*)$#',$value,$m))return $m[1];if(preg_match('#^https?://#',$value)||str_starts_with($value,'/'))return $value;return '/__ultimate/engine/'.$s['id'].($family==='botble'||$family==='footstep'?'/storage/':($family==='martvill'?'/public/uploads/':'/')).$value;};
$categoryFor=[];foreach($r->all($family==='botble'?'ec_product_category_product':($family==='footstep'?'category_product':'product_categories')) as $c)if(isset($c['product_id'],$c['category_id']))$categoryFor[$c['product_id']]=$c['category_id'];
$productTable=$family==='botble'?'ec_products':'products';
foreach($r->all($productTable) as $p){if(($p['is_variation']??0)||($p['parent_id']??null))continue;$id=(int)$p['id'];$stock=$p['quantity']??$p['stock_qty']??$p['total_stocks']??$p['stock']??0;
 if($family==='shopperzz'){$stock=0;foreach($r->all('stocks') as $st)if((int)$st['product_id']===$id)$stock+=(int)$st['status']===5?(int)$st['quantity']:0;}
 $price=$num($p['price']??$p['selling_price']??$p['regular_price']??$p['min_price']??0);$sale=$num($p['sale_price']??$price);
 if($family==='grostore')$sale=max(0,$price-($p['discount_type']==='percent'?$price*$p['discount_value']/100:$p['discount_value']));
 if($family==='shopperzz')$sale=($p['add_to_flash_sale']??10)==5?$price*(1-$p['discount']/100):$price;
 $out['products'][]=['native_id'=>$id,'name'=>$p['name'],'slug'=>$p['slug']??$slugs['Botble\\Ecommerce\\Models\\Product'][$id]??null,'sku'=>$p['sku']??null,'description'=>$p['description']??'','price'=>$price,'sale_price'=>$num($sale),'cost'=>$num($p['cost_per_item']??$p['cost_price']??$p['buying_price']??0),'stock'=>max(0,(int)$stock),'category_id'=>(int)($p['product_category_id']??$categoryFor[$id]??0),'brand_id'=>(int)($p['product_brand_id']??$p['brand_id']??0),'status'=>isset($p['deleted_at'])&&$p['deleted_at']?'draft':$active($p['status']??$p['is_published']??$p['is_active']??0)];
 $image=$imageById[$id]??'/assets/product-1.png';
 if($family==='botble')$image=$normalizeImage($p['image']);
 elseif($family==='grostore')$image=$normalizeImage($mediaRows[$p['thumbnail_image']]['media_file']??$image);
 elseif($family==='martvill')$image=$normalizeImage($metaImages[$id]??$image);
 elseif($family==='footstep'){$media=$mediaRows[$imageRows[$id]??0]??null;if($media&&$media['file_path']!==ltrim($image,'/'))$image=$normalizeImage($media['file_path']);}
 elseif($family==='shopperzz'){foreach($mediaRows as $media)if($media['model_type']==='App\\Models\\Product'&&(int)$media['model_id']===$id&&$media['collection_name']==='product'){if(!(json_decode($media['custom_properties'],true)['astrallab_shared']??false))$image='/__ultimate/engine/'.$s['id'].'/storage/'.$media['id'].'/'.$media['file_name'];break;}}
 $out['products'][count($out['products'])-1]['image']=$image;
 $out['products'][count($out['products'])-1]['product_type']=($p['product_type']??$p['type']??'physical')==='digital'?'digital':'physical';
}
$ct=$family==='botble'?'ec_product_categories':(in_array($family,['shopperzz','footstep'])?'product_categories':'categories');
foreach($r->all($ct) as $c)$out['categories'][]=['native_id'=>(int)$c['id'],'name'=>$c['name'],'slug'=>$c['slug']??null,'status'=>$active($c['status']??$c['is_active']??1)];
if($family!=='footstep')foreach($r->all($family==='botble'?'ec_brands':($family==='shopperzz'?'product_brands':'brands')) as $b)$out['brands'][]=['native_id'=>(int)$b['id'],'name'=>$b['name'],'status'=>$active($b['status']??$b['is_active']??1)];
$customerTable=$family==='botble'?'ec_customers':($family==='footstep'?'customers':'users');$users=[];
foreach($r->all($customerTable) as $c){$users[$c['id']]=$c;if($customerTable==='users'&&$c['id']<9000000)continue;$out['customers'][]=['native_id'=>(int)$c['id']-(in_array($family,['shopperzz','grostore','martvill'])?9000000:0),'name'=>$c['name'],'email'=>$c['email'],'phone'=>$c['phone']??'','status'=>'active'];}
$address=[];foreach($r->all($family==='botble'?'ec_order_addresses':'order_addresses') as $a)if(isset($a['order_id']))$address[$a['order_id']]=$a;
$groups=[];foreach($r->all('order_groups') as $g)$groups[$g['id']]=$g;
$variants=[];if($family==='grostore')foreach($r->all('product_variations') as $v)$variants[$v['id']]=$v['product_id'];
$items=[];$it=$family==='botble'?'ec_order_product':($family==='martvill'?'order_details':($family==='shopperzz'?'stocks':'order_items'));
foreach($r->all($it) as $i){if($family==='shopperzz'&&$i['model_type']!=='App\\Models\\Order')continue;$oid=$i['order_id']??$i['model_id'];$items[$oid][]=['product_id'=>(int)($i['product_id']??$variants[$i['product_variation_id']]??0),'name'=>$i['product_name']??'','sku'=>$i['sku']??'','quantity'=>(int)($i['quantity']??$i['qty']??0),'unit_price'=>$num($i['price']??$i['unit_price']??0)];}
foreach($r->all($family==='botble'?'ec_orders':'orders') as $o){$id=(int)$o['id'];$g=$groups[$o['order_group_id']??0]??[];$user=$users[$o['customer_id']??$o['user_id']??$g['user_id']??0]??[];$a=$address[$id]??[];
 $status=strtolower((string)($o['status']??$o['delivery_status']??'pending'));if($family==='shopperzz')$status=[1=>'pending',5=>'processing',7=>'shipped',10=>'delivered',15=>'cancelled',20=>'refunded'][(int)$o['status']]??'pending';if($family==='martvill')$status=[1=>'pending',2=>'processing',3=>'shipped',4=>'delivered',5=>'cancelled',6=>'refunded'][$o['order_status_id']]??'pending';$status=['completed'=>'delivered','canceled'=>'cancelled','order_placed'=>'pending'][$status]??$status;
 $pay=$o['payment_status']??$g['payment_status']??'unpaid';if($family==='shopperzz')$pay=(int)$pay===5?'paid':'unpaid';
 $out['orders'][]=['native_id'=>$id,'number'=>$o['code']??$o['order_serial_no']??$o['reference']??$o['order_number']??('AST-'.str_pad((string)($g['order_code']??$id),5,'0',STR_PAD_LEFT)),'customer_name'=>$o['customer_name']??$a['name']??$a['full_name']??$user['name']??'Demo customer','email'=>$o['customer_email']??$a['email']??$user['email']??'demo@example.com','phone'=>$o['customer_phone']??$a['phone']??$user['phone']??'','address'=>$a['address']??$user['address']??'Dhaka','subtotal'=>$num($o['sub_total']??$o['subtotal']??$o['subtotal_amount']??$g['sub_total_amount']??$o['total']??0),'tax'=>$num($o['tax_amount']??$o['tax']??$o['tax_charge']??$g['total_tax_amount']??0),'discount'=>$num($o['discount_amount']??$o['discount']??$o['other_discount_amount']??$g['total_coupon_discount_amount']??0),'shipping'=>$num($o['shipping_amount']??$o['shipping_charge']??$o['shipping_cost']??$g['total_shipping_cost']??0),'total'=>$num($o['amount']??$o['total']??$o['total_amount']??$g['grand_total_amount']??0),'status'=>$status,'payment_status'=>strtolower((string)$pay),'items'=>$items[$id]??[],'created_at'=>$o['created_at']??date('Y-m-d H:i:s')];
}
foreach($out as &$rows)usort($rows,fn($a,$b)=>$a['native_id']<=>$b['native_id']);unset($rows);
return $out;
