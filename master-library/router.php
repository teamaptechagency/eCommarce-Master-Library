<?php
// This router is used only by the loopback PHP processes started by the library.
$runtime = json_decode(file_get_contents(__DIR__ . '/data/runtime.json'), true);
$siteId = getenv('MASTER_SITE_ID');
$site = current(array_filter($runtime['sites'], fn($s) => $s['id'] === $siteId));
$remote = $_SERVER['REMOTE_ADDR'] ?? '';
if (!$site || !in_array($remote, ['127.0.0.1', '::1'], true)
    || !in_array($_SERVER['HTTP_HOST'] ?? '', ['127.0.0.1:' . $site['port'], 'localhost:' . $site['port']], true)) {
    http_response_code(403); exit('Local preview only.');
}
$uri = rawurldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?: '/');
$docroot = is_file($site['app'] . '/public/index.php') ? $site['app'] . '/public' : $site['app'];
$candidate = realpath($docroot . $uri);
$normalizedRoot = str_replace('\\', '/', realpath($docroot)) . '/';
$mediaRoot = realpath($site['app'] . '/storage/app/public');
$publicMedia = str_starts_with($uri, '/storage/') && $mediaRoot && $candidate
    && str_starts_with(str_replace('\\', '/', $candidate), str_replace('\\', '/', $mediaRoot) . '/');
if (preg_match('#(?:^|/)\.#', $uri)
    || preg_match('#^/(?:bootstrap|config|database|storage/logs|app|resources|routes)(?:/|$)#i', $uri)
    || ($docroot === $site['app'] && preg_match('#^/vendor(?:/|$)#i', $uri))) {
    http_response_code(404); exit('Not found');
}
if ($candidate && is_file($candidate) && (str_starts_with(str_replace('\\', '/', $candidate), $normalizedRoot) || $publicMedia)) {
    $ext = strtolower(pathinfo($candidate, PATHINFO_EXTENSION));
    if (in_array($ext, ['css','js','json','png','jpg','jpeg','gif','svg','webp','ico','woff','woff2','ttf','eot','map','mp4','webm','pdf','avif'], true)) return false;
    if ($ext !== 'html' && $uri !== '/index.php') { http_response_code(404); exit('Not found'); }
}
chdir($site['app']);
define('LARAVEL_START', microtime(true));
require $site['app'] . '/vendor/autoload.php';
$app = require $site['app'] . '/bootstrap/app.php';
$request = Illuminate\Http\Request::capture();
$app->instance('request', $request);
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
$kernel->bootstrap();
config(['app.url' => 'http://127.0.0.1:' . $site['port'], 'session.cookie' => 'master_' . $siteId . '_session', 'session.domain' => null, 'session.secure' => false]);
// Botble resolves its session store during provider boot, before this override.
// Rename the resolved store too so Nest and Shofy cannot overwrite each other.
$app->make('session')->driver()->setName('master_' . $siteId . '_session');
Illuminate\Support\Facades\URL::forceRootUrl('http://127.0.0.1:' . $site['port']);

if ($uri === '/__master/routes') {
    if (!hash_equals($runtime['secret'], $_SERVER['HTTP_X_MASTER_LIBRARY'] ?? '')) { http_response_code(403); exit('Forbidden'); }
    header('Content-Type: application/json');
    header('Cache-Control: no-store');
    echo json_encode(require __DIR__ . '/route-catalog.php', JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

$demoRoute = Illuminate\Support\Facades\Route::middleware('web')->get('/__master/demo-login', function (Illuminate\Http\Request $request) use ($site, $runtime) {
    $expires = (int) $request->query('expires', 0);
    $next = (string) $request->query('next', $site['admin']);
    $signature = (string) $request->query('signature', '');
    $expected = hash_hmac('sha256', $site['id'] . '|' . $expires . '|' . $next, $runtime['secret']);
    if ($expires < time() || $expires > time() + 90 || !hash_equals($expected, $signature)
        || !str_starts_with($next, '/') || str_starts_with($next, '//') || preg_match('/[\r\n\\\\]/', $next) || str_contains($next, '://')) {
        return response('This demo link has expired or is invalid. Open Admin Demo Login from the master library.', 403);
    }
    $kind = $site['kind'];
    if ($kind === 'botble') {
        $user = Botble\ACL\Models\User::where('super_user', 1)->firstOrFail();
        Illuminate\Support\Facades\Auth::guard('web')->login($user);
    } elseif ($kind === 'martvill') {
        $user = App\Models\User::whereHas('roles', fn($q) => $q->where('slug', 'super-admin')->where('type', 'global'))->firstOrFail();
        Illuminate\Support\Facades\Auth::guard('user')->login($user);
        $request->session()->put('vendorId', null);
    } elseif ($kind === 'grostore') {
        $user = App\Models\User::where('user_type', 'admin')->firstOrFail();
        Illuminate\Support\Facades\Auth::guard('web')->login($user);
    } elseif ($kind === 'sohag') {
        $user = App\Models\User::whereHas('roles', fn($q) => $q->whereIn('slug', ['admin','administrator','super_admin','super-admin'])->orWhere('roles.id', 1))->firstOrFail();
        $user->load('roles.permissions');
        $token = $user->createToken('master-library-demo', ['*'], now()->addHours(8))->plainTextToken;
        $payload = ['token' => $token, 'user' => $user->toArray()];
    } elseif ($kind === 'shopperzz') {
        $user = App\Models\User::role('Admin')->firstOrFail();
        Illuminate\Support\Facades\Auth::guard('web')->login($user);
        $token = $user->createToken('master-library-demo', ['*'], now()->addHours(8))->plainTextToken;
        $permission = App\Http\Resources\PermissionResource::collection(app(App\Services\PermissionService::class)->permission($user->roles[0]));
        $payload = [
            'token' => $token,
            'user' => (new App\Http\Resources\UserResource($user))->resolve($request),
            'permission' => $permission->resolve($request),
            'menu' => App\Http\Resources\MenuResource::collection(collect(app(App\Services\MenuService::class)->menu($user->roles[0])))->resolve($request),
            'defaultPermission' => App\Libraries\AppLibrary::defaultPermission($permission),
        ];
    } else {
        return response('Demo login is not configured for this project.', 409);
    }
    $request->session()->regenerate();
    if (!isset($payload)) return redirect($next)->withHeaders(['Cache-Control' => 'no-store', 'Referrer-Policy' => 'no-referrer']);
    $json = json_encode($payload, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);
    $target = json_encode($next, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);
    $script = $kind === 'sohag'
        ? 'for(const k of ["auth_token","token"])localStorage.setItem(k,p.token); for(const k of ["auth_user","user"])localStorage.setItem(k,JSON.stringify(p.user));'
        : 'let v={};try{v=JSON.parse(localStorage.getItem("vuex")||"{}")}catch{};v.auth={authStatus:true,authToken:p.token,authInfo:p.user,authMenu:p.menu,authPermission:p.permission,authDefaultPermission:p.defaultPermission,resetInfo:{email:null},phone:{},email:{}};localStorage.setItem("vuex",JSON.stringify(v));';
    return response('<!doctype html><meta charset="utf-8"><title>Opening admin demo</title><p>Opening admin demo…</p><script>const p=' . $json . ';' . $script . 'location.replace(' . $target . ');</script>')->withHeaders(['Cache-Control' => 'no-store', 'Referrer-Policy' => 'no-referrer']);
});
// SPA catch-all routes must not swallow the dedicated demo endpoint.
if ($uri === '/__master/demo-login') {
    $ordered = new Illuminate\Routing\RouteCollection();
    $ordered->add($demoRoute);
    foreach (Illuminate\Support\Facades\Route::getRoutes() as $route) {
        if ($route !== $demoRoute) $ordered->add($route);
    }
    Illuminate\Support\Facades\Route::setRoutes($ordered);
}
try {
    $response = $kernel->handle($request);
    $type = $response->headers->get('Content-Type', '');
    if (str_contains($type, 'text/html') && !str_starts_with($uri, '/__master/')) {
        $html = $response->getContent();
        if (is_string($html) && stripos($html, '</body>') !== false) {
            $name = htmlspecialchars($site['name'], ENT_QUOTES, 'UTF-8');
            $bar = '<a href="http://127.0.0.1:8090/#site=' . $site['id'] . '" target="_top" style="position:fixed;bottom:16px;left:16px;z-index:2147483646;background:#202b28;color:#fff;padding:10px 16px;border-radius:30px;font:12px system-ui;text-decoration:none;box-shadow:0 3px 16px #0003">← Master Library · ' . $name . '</a>';
            $response->setContent(str_ireplace('</body>', $bar . '</body>', $html));
        }
    }
    $response->headers->remove('X-Frame-Options');
    $csp = $response->headers->get('Content-Security-Policy');
    if ($csp && str_contains($csp, 'frame-ancestors')) $response->headers->set('Content-Security-Policy', preg_replace('/frame-ancestors[^;]*/', "frame-ancestors 'self' http://127.0.0.1:8090", $csp));
    $response->send();
    $kernel->terminate($request, $response);
} catch (Throwable $e) {
    error_log((string) $e);
    http_response_code(500);
    echo 'This local preview could not complete the request. Check its log in master-library/data.';
}
