<?php
$rows = [];
foreach (Illuminate\Support\Facades\Route::getRoutes() as $route) {
    if (!in_array('GET', $route->methods())) continue;
    $uri = '/' . ltrim($route->uri(), '/');
    if (preg_match('#(?:logout|delete|destroy|remove|clear|flush|truncate|wipe|impersonate|install|migrat|debugbar|_ignition|callback|cron|activate|deactivate|toggle|update|reset|download|export|send-|cancel|force|suspend|approve|reject|payment/|successful|success|fail|cache|make-super|duplicate|clone|widgets/hide|read-notification|ajax/|bulk-changes|/json$|/popup$|/login$|csrf-cookie|sanctum-token|/cleanup|/data-synchronize|/notifications/read|__master)#i', $uri)) continue;
    if (str_starts_with($uri, '/api/') || str_starts_with($uri, '/bkash/') || str_starts_with($uri, '/payment/') || str_starts_with($uri, '/storage/') || in_array($uri, ['/up','/manifest.json','/offline','/sitemap.xml','/robots.txt'], true) || str_contains($uri, '{any') || str_contains($uri, 'pathMatch') || str_contains($uri, '{fallback')) continue;
    $middleware = implode(' ', array_filter($route->middleware(), 'is_string'));
    $admin = str_starts_with($uri, '/admin') || str_starts_with($uri, '/backend') || preg_match('/auth|permission|admin/', $middleware);
    $rows[] = ['path' => $uri, 'name' => $route->getName(), 'access' => $admin ? 'admin' : 'public', 'parameterized' => str_contains($uri, '{')];
}
return $rows;
