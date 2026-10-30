<?php
$root=dirname(__DIR__);$runtime=json_decode(file_get_contents($root.'/data/native-runtime.json'),true);
$source=current(array_filter($runtime['sources'],fn($s)=>$s['id']===getenv('ULTIMATE_SOURCE_ID')));
if(!$source||!in_array($_SERVER['REMOTE_ADDR']??'',['127.0.0.1','::1'],true)||!in_array($_SERVER['HTTP_HOST']??'',['127.0.0.1:'.$source['port'],'localhost:'.$source['port']],true)){http_response_code(403);exit('Local source engine only');}
$site=['id'=>$source['id'],'app'=>$source['engine'],'port'=>$source['port'],'admin'=>$source['admin'],'kind'=>$source['family']==='footstep'?'sohag':$source['family']];
$uri=rawurldecode(parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH)?:'/');
if($uri==='/__native/health'){header('Content-Type: application/json');echo json_encode(['source'=>$site['id'],'application'=>'astrallab-native']);exit;}
if(preg_match('#^/images/required/theme-(?:footer-|favicon-)?logo\.png$#',$uri)&&$source['id']==='shopperzz'){header('Content-Type: image/svg+xml');readfile($root.'/public/assets/astrallab-logo.svg');exit;}
if(preg_match('#(?:^|/)\.#',$uri)||preg_match('#^/(?:bootstrap|config|database|app|resources|routes|storage/logs)(?:/|$)#i',$uri)){http_response_code(404);exit('Not found');}
// Shared catalog images keep the source's native image URLs and conversion names.
$snapshot=json_decode(file_get_contents($root.'/data/native-snapshot.json'),true);
$shared=null;
if(preg_match('#^/storage/(9\d{6,})/#',$uri,$m)){foreach($snapshot['products'] as $p)if(9000000+$p['id']==(int)$m[1]){$shared=$p['image'];break;}}
if(str_contains($uri,'/astrallab/'))foreach($snapshot['products'] as $p)if(basename($p['image'])===basename($uri)){$shared=$p['image'];break;}
if(preg_match('#^/storage/assets/(product-[0-9]+\.png)$#',$uri,$m))$shared='/assets/'.$m[1];
if(str_starts_with($uri,'/storage/__ultimate/engine/')){header('Location: '.substr($uri,8));exit;}
if(preg_match('#^/assets/product-([0-9]+)(?:-[0-9]+x[0-9]+)?\.png$#',$uri,$m))$shared='/assets/product-'.$m[1].'.png';
if($shared){$sameNativePath='/__ultimate/engine/'.$site['id'].$uri;if((str_starts_with($shared,'/__ultimate/engine/')||preg_match('#^https?://#',$shared))&&$shared!==$sameNativePath){header('Location: '.$shared);exit;}$file=realpath($root.'/public'.$shared);if($file&&str_starts_with(str_replace('\\','/',$file),str_replace('\\','/',realpath($root.'/public')).'/')){header('Content-Type: '.(mime_content_type($file)?:'image/png'));readfile($file);exit;}}
$docroot=is_file($site['app'].'/public/index.php')?$site['app'].'/public':$site['app'];
$asset=null;$candidates=[$docroot.$uri];
if(str_starts_with($uri,'/public/')&&$docroot!==$site['app'])array_unshift($candidates,$docroot.substr($uri,7));
if(str_starts_with($uri,'/storage/')){array_unshift($candidates,$site['app'].'/storage/app/public/'.substr($uri,9));$candidates[]=$source['source'].'/storage/app/public/'.substr($uri,9);}
foreach($candidates as $file){$candidate=realpath($file);if(!$candidate||!is_file($candidate))continue;$allowed=false;
 foreach([$docroot,$source['source'].'/public',$site['app'].'/storage/app/public',$source['source'].'/storage/app/public'] as $base){$base=realpath($base);if($base&&str_starts_with(str_replace('\\','/',$candidate),str_replace('\\','/',$base).'/'))$allowed=true;}
 if($docroot===$site['app']&&preg_match('#^/vendor(?:/|$)#i',$uri))$allowed=false;
 if($allowed&&in_array(strtolower(pathinfo($candidate,PATHINFO_EXTENSION)),['css','js','json','png','jpg','jpeg','gif','svg','webp','ico','woff','woff2','ttf','eot','map','mp4','webm','pdf','avif','html'],true)){$asset=$candidate;break;}}
if($asset){$ext=strtolower(pathinfo($asset,PATHINFO_EXTENSION));$mime=['css'=>'text/css','js'=>'text/javascript','json'=>'application/json','svg'=>'image/svg+xml','woff'=>'font/woff','woff2'=>'font/woff2','ttf'=>'font/ttf','html'=>'text/html'];header('Content-Type: '.($mime[$ext]??mime_content_type($asset)));readfile($asset);exit;}
chdir($site['app']);define('LARAVEL_START',microtime(true));require __DIR__.'/common.php';nativeAutoload($source);$app=require $site['app'].'/bootstrap/app.php';
$request=Illuminate\Http\Request::capture();$app->instance('request',$request);$kernel=$app->make(Illuminate\Contracts\Http\Kernel::class);$kernel->bootstrap();
config(['app.url'=>'http://127.0.0.1:8200','session.cookie'=>'ultimate_native_'.$site['id'],'session.domain'=>null,'session.secure'=>false,'app.debug'=>false]);
$app->make('session')->driver()->setName('ultimate_native_'.$site['id']);Illuminate\Support\Facades\URL::forceRootUrl('http://127.0.0.1:8200');

$demoRoute = Illuminate\Support\Facades\Route::middleware('web')->get('/__native/demo-login', function (Illuminate\Http\Request $request) use ($site, $runtime) {
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
if ($uri === '/__native/demo-login') {
    $ordered = new Illuminate\Routing\RouteCollection();
    $ordered->add($demoRoute);
    foreach (Illuminate\Support\Facades\Route::getRoutes() as $route) {
        if ($route !== $demoRoute) $ordered->add($route);
    }
    Illuminate\Support\Facades\Route::setRoutes($ordered);
}

$response=$kernel->handle($request);$response->headers->remove('X-Frame-Options');$response->send();$kernel->terminate($request,$response);
