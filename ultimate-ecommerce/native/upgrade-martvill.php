<?php
require __DIR__.'/common.php';[$root,$s,$app]=nativeBootstrap('martvill');$pdo=ownedConnection($s);
App\Lib\DatabaseUpgrader::run(config('martvill.versions'));
echo 'Isolated MartVill database upgraded with its original migrations and seeders.'.PHP_EOL;
