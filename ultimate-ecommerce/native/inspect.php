<?php
$root=dirname(__DIR__);$sources=json_decode(file_get_contents($root.'/data/native-sources.json'),true);
$s=current(array_filter($sources,fn($s)=>$s['id']===$argv[1]));chdir($s['engine']);require $s['engine'].'/vendor/autoload.php';$app=require $s['engine'].'/bootstrap/app.php';$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$pdo=Illuminate\Support\Facades\DB::connection()->getPdo();$result=[];
foreach($pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN) as $table){if(!preg_match('/product|categor|brand|order|customer|user|stock|media|slug|file|setting|slider|banner|theme|shop|localization/i',$table))continue;$result[$table]=['columns'=>$pdo->query("SHOW COLUMNS FROM `$table`")->fetchAll(PDO::FETCH_ASSOC),'sample'=>$pdo->query("SELECT * FROM `$table` LIMIT 1")->fetch(PDO::FETCH_ASSOC)];}
file_put_contents($root.'/data/schema-'.$s['id'].'.json',json_encode($result,JSON_PRETTY_PRINT|JSON_INVALID_UTF8_SUBSTITUTE));echo $s['id'].': schema captured'.PHP_EOL;
