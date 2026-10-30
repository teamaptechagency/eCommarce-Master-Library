<?php
// Generic PHP/Laravel uploads run only from a dedicated loopback process.
$app = getenv('MASTER_UPLOAD_APP');
$root = realpath(getenv('MASTER_UPLOAD_PUBLIC'));
$port = getenv('MASTER_UPLOAD_PORT');
if (!in_array($_SERVER['HTTP_HOST'] ?? '', ['127.0.0.1:' . $port, 'localhost:' . $port], true)) { http_response_code(403); exit; }
$uri = rawurldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?: '/');
if (str_contains($uri, '\\') || preg_match('#(?:^|/)\.#', $uri)
    || ($root === realpath($app) && preg_match('#^/(?:vendor|node_modules|config|database|storage|app|bootstrap|resources|routes)(?:/|$)#i', $uri))) { http_response_code(404); exit; }
$candidate = realpath($root . $uri);
$media = realpath($app . '/storage/app/public');
$publicMedia = $candidate && $media && str_starts_with($uri, '/storage/') && str_starts_with($candidate, $media . DIRECTORY_SEPARATOR);
if ($candidate && (str_starts_with($candidate, $root . DIRECTORY_SEPARATOR) || $publicMedia) && is_file($candidate)) {
    if ($publicMedia && strtolower(pathinfo($candidate, PATHINFO_EXTENSION)) === 'php') { http_response_code(404); exit; }
    if (strtolower(pathinfo($candidate, PATHINFO_EXTENSION)) === 'php') { chdir(dirname($candidate)); require $candidate; return; }
    if (preg_match('/\.(?:html|css|js|json|svg|png|jpe?g|webp|avif|gif|ico|woff2?|ttf|mp4|webm|pdf)$/i', $candidate)) return false;
    http_response_code(404); exit;
}
chdir($app);
require $root . '/index.php';
