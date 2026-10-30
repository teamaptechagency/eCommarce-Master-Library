<?php
function nativeAutoload($s){
    $loader=require $s['engine'].'/vendor/autoload.php';$original=str_replace('\\','/',realpath($s['source'])).'/';$engine=str_replace('\\','/',$s['engine']).'/';$map=[];
    foreach($loader->getClassMap() as $class=>$file){$normalized=str_replace('\\','/',$file);if(str_starts_with($normalized,$original)&&!str_starts_with($normalized,$original.'vendor/'))$map[$class]=$engine.substr($normalized,strlen($original));}
    $loader->addClassMap($map);
    foreach($loader->getPrefixesPsr4() as $prefix=>$paths){$mapped=[];$changed=false;foreach($paths as $file){$normalized=str_replace('\\','/',$file);$resolved=realpath($file);$normalized=$resolved?str_replace('\\','/',$resolved):$normalized;if(str_starts_with($normalized,$original)&&!str_starts_with($normalized,$original.'vendor/')){$mapped[]=$engine.substr($normalized,strlen($original));$changed=true;}else $mapped[]=$file;}if($changed)$loader->setPsr4($prefix,$mapped);}
    return $loader;
}
function nativeBootstrap($id) {
    $root=dirname(__DIR__);$sources=json_decode(file_get_contents($root.'/data/native-sources.json'),true);
    $s=current(array_filter($sources,fn($s)=>$s['id']===$id));if(!$s)throw new RuntimeException('Unknown native source');
    chdir($s['engine']);nativeAutoload($s);$app=require $s['engine'].'/bootstrap/app.php';
    $app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();return [$root,$s,$app];
}
function ownedConnection($s) {
    $c=config('database.connections.mysql');if($c['database']!==$s['database'])throw new RuntimeException('Refusing to change a source database');
    $pdo=Illuminate\Support\Facades\DB::connection()->getPdo();
    if($pdo->query('SELECT ownership FROM astrallab_bridge_meta LIMIT 1')->fetchColumn()!==$s['ownership'])throw new RuntimeException('Database ownership mismatch');
    return $pdo;
}
class NativeRows {
    public $pdo;public $tables;public $initial=true;private $schemas=[];private $remembered=[];
    function __construct($pdo){$this->pdo=$pdo;$this->tables=$pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN);}
    function has($table){return in_array($table,$this->tables,true);}
    function clear($table,$where='1=1'){
        if(!$this->has($table))return;
        $sourceOwned=['stocks','media','media_managers','files','ec_product_variations','ec_product_variation_items','ec_product_with_attribute_set','ec_product_collection_products','ec_product_label_products','ec_product_tag_product','ec_product_related_relations','ec_product_cross_sale_relations','ec_product_up_sale_relations','ec_flash_sale_products','ec_discount_products','ec_tax_products','ec_product_views','ec_reviews','ec_order_histories','ec_order_referrals','ec_customer_addresses','ec_customer_recently_viewed_products','shipments','shipment_items','product_variations','product_variation_stocks','product_variation_combinations','product_reviews','product_tags','product_seos','product_taxes','product_videos','product_section_products','promotion_products','stock_taxes','order_coupons','order_outlet_addresses','transactions','purchases','product_colors','campaign_products','products_meta','product_stats','product_relates','product_cross_sales','product_upsales','category_stats','brand_stats','orders_meta','order_status_histories','order_note_histories','order_commissions','product_variation_attribute_value'];
        if(!$this->initial&&in_array($table,$sourceOwned,true))return;
        if(!$this->initial)foreach($this->all($table) as $row)if(isset($row['id']))$this->remembered[$table][$row['id']]=$row;
        $this->pdo->exec("DELETE FROM `$table` WHERE $where");
    }
    function all($table){return $this->has($table)?$this->pdo->query("SELECT * FROM `$table`")->fetchAll(PDO::FETCH_ASSOC):[];}
    function insert($table,$data){
        if(!$this->has($table))return null;
        $naturalKeys=['product_variation_stocks'=>['product_variation_id','location_id'],'products_meta'=>['product_id','key']];
        if(!$this->initial&&isset($naturalKeys[$table])){$keys=$naturalKeys[$table];$find=$this->pdo->prepare("SELECT * FROM `$table` WHERE ".implode(' AND ',array_map(fn($k)=>"`$k`=?",$keys)).' LIMIT 1');$find->execute(array_map(fn($k)=>$data[$k]??null,$keys));$existing=$find->fetch(PDO::FETCH_ASSOC);if($existing)$data=array_merge($existing,$data);}
        if(isset($data['id'],$this->remembered[$table][$data['id']])){
            $old=$this->remembered[$table][$data['id']];if(isset($old['password'])&&$old['password'])$data['password']=$old['password'];$data=array_merge($old,$data);
        }
        $cols=$this->schemas[$table]??= $this->pdo->query("SHOW COLUMNS FROM `$table`")->fetchAll(PDO::FETCH_ASSOC);$row=[];
        foreach($cols as $c){$k=$c['Field'];if(array_key_exists($k,$data))$row[$k]=$data[$k];
            elseif(in_array($k,['created_at','updated_at']))$row[$k]=date('Y-m-d H:i:s');
            elseif($c['Null']==='NO'&&$c['Default']===null&&!str_contains($c['Extra'],'auto_increment')&&!str_contains($c['Extra'],'GENERATED')){
                $row[$k]=preg_match('/int|decimal|double|float/',$c['Type'])?0:(str_contains($c['Type'],'date')?'2026-10-29 00:00:00':'');
            }
        }
        $keys=array_keys($row);$sql="INSERT INTO `$table` (`".implode('`,`',$keys).'`) VALUES ('.implode(',',array_fill(0,count($keys),'?')).')';
        if(isset($row['id'])){$updates=array_values(array_filter($keys,fn($k)=>$k!=='id'));if($updates)$sql.=' ON DUPLICATE KEY UPDATE '.implode(',',array_map(fn($k)=>"`$k`=VALUES(`$k`)",$updates));}
        try{$this->pdo->prepare($sql)->execute(array_values($row));}catch(Throwable $e){throw new RuntimeException($table.': '.$e->getMessage(),0,$e);}return $row['id']??$this->pdo->lastInsertId();
    }
}
