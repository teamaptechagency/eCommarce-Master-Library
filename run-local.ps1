$ErrorActionPreference = 'Stop'
$php = 'C:\xampp\php\php.exe'
$root = $PSScriptRoot
foreach ($id in @(2,6,9,14,19,25)) {
    $folder = Join-Path $root "E-commerce-$id"
    $app = Join-Path $folder 'local-app'
    if (Test-Path (Join-Path $app 'shopperzz\artisan')) { $app = Join-Path $app 'shopperzz' }
    if (!(Test-Path (Join-Path $app 'artisan'))) { Write-Output "${id}: extraction incomplete"; continue }
    $port = 8000 + $id
    $envFile = Join-Path $app '.env'
    if (!(Test-Path $envFile)) { Copy-Item (Join-Path $app '.env.example') $envFile }
    $content = [IO.File]::ReadAllText($envFile)
    $settings = @{APP_ENV='local';APP_DEBUG='true';APP_URL="http://127.0.0.1:$port";DB_HOST='127.0.0.1';DB_PORT='3306';DB_DATABASE="ecommerce_local_$id";DB_USERNAME='root';DB_PASSWORD='';CACHE_DRIVER='file';SESSION_DRIVER='file';QUEUE_CONNECTION='sync'}
    if ($id -eq 19) { $settings.DB_DATABASE = 'ecommerce_local_19_preview_20261029' }
    foreach ($key in $settings.Keys) {
        $line = "$key=$($settings[$key])"
        if ($content -match "(?m)^$key=") { $content = [regex]::Replace($content,"(?m)^$key=.*$",$line) } else { $content += "`n$line" }
    }
    [IO.File]::WriteAllText($envFile,$content)
    foreach ($cache in @('config.php','routes-v7.php')) { $cachePath = Join-Path $app "bootstrap\cache\$cache"; if (Test-Path $cachePath) { Remove-Item -LiteralPath $cachePath } }
    $docroot = if (Test-Path (Join-Path $app 'public\index.php')) { Join-Path $app 'public' } else { $app }
    $router = Join-Path $folder 'local-router.php'
    $routerSource = '<?php $root = ' + "'" + ($docroot.Replace('\','/')) + "'" + '; $path = $root . rawurldecode(parse_url($_SERVER["REQUEST_URI"], PHP_URL_PATH)); if (is_file($path)) { return false; } require $root . "/index.php";'
    [IO.File]::WriteAllText($router,$routerSource)
    if (!(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)) {
        Start-Process -FilePath $php -ArgumentList @('-S',"127.0.0.1:$port",'-t',('"'+$docroot+'"'),('"'+$router+'"')) -WorkingDirectory $app -WindowStyle Hidden -RedirectStandardOutput (Join-Path $folder 'server.stdout.log') -RedirectStandardError (Join-Path $folder 'server.stderr.log')
    }
    Write-Output "${id}: http://127.0.0.1:$port"
}
