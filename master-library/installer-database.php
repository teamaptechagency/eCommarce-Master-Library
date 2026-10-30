<?php
// Credentials arrive through stdin, never command arguments or log output.
$config = json_decode(stream_get_contents(STDIN), true, 512, JSON_THROW_ON_ERROR);
try {
    $name = $config['name']; $user = $config['user'];
    if (!preg_match('/^ml_[a-f0-9]{16}$/', $name) || !preg_match('/^ml_[a-f0-9]{16}$/', $user)) throw new Exception('Invalid isolated database name');
    $dsn = 'mysql:host=' . $config['host'] . ';port=' . (int)$config['port'] . ';charset=utf8mb4';
    $options = [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION];
    $admin = new PDO($dsn, $config['adminUser'], $config['adminPassword'], $options);
    $admin->exec("CREATE DATABASE IF NOT EXISTS `$name` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    $admin->exec("CREATE USER IF NOT EXISTS '$user'@'127.0.0.1' IDENTIFIED BY " . $admin->quote($config['password']));
    $admin->exec("GRANT ALL ON `$name`.* TO '$user'@'127.0.0.1'");
    if (!empty($config['sql'])) {
        $sql = file_get_contents($config['sql']);
        $sql = preg_replace('/^\s*(?:CREATE DATABASE\b[^;]*|USE\s+[^;]*);\s*$/mi', '', $sql);
        $sql = preg_replace('/DEFINER\s*=\s*`[^`]*`@`[^`]*`/i', '', $sql);
        $db = new PDO($dsn . ';dbname=' . $name, $user, $config['password'], $options);
        $db->exec($sql);
    }
    echo json_encode(['ok' => true]);
} catch (Throwable $e) {
    fwrite(STDERR, 'Database setup failed. Check the local database credentials and SQL compatibility. SQLSTATE: ' . $e->getCode());
    exit(1);
}
