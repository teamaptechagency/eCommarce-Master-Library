<?php
require __DIR__.'/common.php';[$root,$s,$app]=nativeBootstrap($argv[1]);$pdo=ownedConnection($s);$r=new NativeRows($pdo);
$current=require __DIR__.'/read-model.php';$baseline=json_decode(file_get_contents($root.'/data/native-baseline-'.$s['id'].'.json'),true);
$changes=[];foreach($current as $type=>$rows){$before=[];foreach($baseline[$type] as $row)$before[$row['native_id']]=$row;$ids=[];foreach($rows as $row){$ids[]=$row['native_id'];$old=$before[$row['native_id']]??null;if($old!==$row)$changes[]=['kind'=>$type,'native_id'=>$row['native_id'],'before'=>$old,'after'=>$row];}foreach($before as $id=>$row)if(!in_array($id,$ids))$changes[]=['kind'=>$type,'native_id'=>$id,'before'=>$row,'after'=>null];}
echo json_encode($changes,JSON_THROW_ON_ERROR|JSON_INVALID_UTF8_SUBSTITUTE);
