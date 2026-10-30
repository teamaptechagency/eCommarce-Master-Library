<?php
require __DIR__.'/common.php';[$root,$s,$app]=nativeBootstrap($argv[1]);$pdo=ownedConnection($s);$r=new NativeRows($pdo);
foreach(['ec_currencies','currencies','preferences','settings','system_settings'] as $t){if(!$r->has($t))continue;foreach($r->all($t) as $row){$key=$row['key']??$row['field']??$row['entity']??'';if(str_contains($t,'currencies')||preg_match('/title|name|currency|db_version|logo|home_page/',$key))echo $t.' '.json_encode($row,JSON_INVALID_UTF8_SUBSTITUTE).PHP_EOL;}}
