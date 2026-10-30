<?php
// Only creates a new owned native projection. Existing source databases are read, never cleared.
$root = dirname(__DIR__);
$sources = json_decode(file_get_contents($root . '/data/native-sources.json'), true);
$source = current(array_filter($sources, fn($s) => $s['id'] === $argv[1]));
if (!$source) throw new RuntimeException('Unknown source');
chdir($source['engine']);
require $source['engine'] . '/vendor/autoload.php';
$app = require $source['engine'] . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$config = config('database.connections.mysql');
$original = $config['database'];
$target = $source['database'];
if (!preg_match('/^astrallab_source_[a-z]+_20261029$/', $target)) throw new RuntimeException('Unsafe projection target');
$pdo = new PDO('mysql:host=' . $config['host'] . ';port=' . ($config['port'] ?? 3306) . ';charset=utf8mb4', $config['username'], $config['password'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$exists = $pdo->prepare('SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=?');$exists->execute([$target]);
if ($exists->fetchColumn()) {
    $owned=$pdo->query("SELECT ownership FROM `$target`.`astrallab_bridge_meta` LIMIT 1")->fetchColumn();
    if ($owned!==$source['ownership']) throw new RuntimeException('Existing database has no matching ownership marker');
    echo $source['id'] . ": owned projection already exists\n";
} else {
    if ($original === $target) throw new RuntimeException('Missing projection; original source database must be configured first');
    $pdo->exec("CREATE DATABASE `$target` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    $pdo->exec("CREATE TABLE `$target`.`astrallab_bridge_meta` (ownership varchar(64) NOT NULL, revision varchar(64) NULL)");
    $insert=$pdo->prepare("INSERT INTO `$target`.`astrallab_bridge_meta`(ownership) VALUES(?)");$insert->execute([$source['ownership']]);
    $tables=$pdo->query("SHOW FULL TABLES FROM `$original` WHERE Table_type='BASE TABLE'")->fetchAll(PDO::FETCH_NUM);
    foreach($tables as $table){$name=$table[0];if(!preg_match('/^[a-zA-Z0-9_]+$/',$name))continue;$pdo->exec("CREATE TABLE `$target`.`$name` LIKE `$original`.`$name`");$columns=$pdo->query("SHOW COLUMNS FROM `$original`.`$name`")->fetchAll(PDO::FETCH_ASSOC);$names=[];foreach($columns as $c)if(!str_contains(strtolower($c['Extra']),'generated'))$names[]='`'.$c['Field'].'`';$list=implode(',',$names);$pdo->exec("INSERT INTO `$target`.`$name` ($list) SELECT $list FROM `$original`.`$name`");}
    echo $source['id'] . ': cloned schema and supporting configuration into an isolated projection (' . count($tables) . " tables)\n";
}
$envPath=$source['engine'].'/.env';$env=file_get_contents($envPath);
$values=['DB_DATABASE'=>$target,'APP_URL'=>'http://127.0.0.1:8200','SESSION_COOKIE'=>'ultimate_native_'.$source['id'],'DEBUGBAR_ENABLED'=>'false'];
foreach($values as $key=>$value){if(preg_match('/^'.$key.'=/m',$env))$env=preg_replace('/^'.$key.'=.*$/m',$key.'='.$value,$env);else $env.="\n$key=$value";}
file_put_contents($envPath,$env);
