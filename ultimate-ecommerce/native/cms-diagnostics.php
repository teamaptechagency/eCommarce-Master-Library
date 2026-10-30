<?php
require __DIR__.'/common.php';[$root,$s,$app]=nativeBootstrap('martvill');$pdo=ownedConnection($s);$r=new NativeRows($pdo);
foreach($r->all('component_properties') as $p)if(preg_match('/product|categor|brand|limit|type/',$p['name']))echo $p['id'].' '.$p['component_id'].' '.$p['name'].' '.substr($p['value'],0,240).PHP_EOL;
