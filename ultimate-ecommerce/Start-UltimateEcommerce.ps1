param([switch]$NoBrowser)
$ErrorActionPreference='Stop'
$node='C:\Program Files\nodejs\node.exe'
if(!(Test-Path -LiteralPath $node)) { $node=(Get-Command node -ErrorAction Stop).Source }
$ready=$false
$servicePresent=$false
try { $r=Invoke-RestMethod 'http://127.0.0.1:8200/api/health' -TimeoutSec 2; $servicePresent=($r.application -eq 'astrallab-ultimate' -and ($r.PSObject.Properties.Name -contains 'sources')); $ready=($servicePresent -and $r.status -eq 'ok') } catch {}
if(!$servicePresent) {
 Get-NetTCPConnection -LocalPort 8200 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { $processInfo=Get-CimInstance Win32_Process -Filter ('ProcessId='+$_.OwningProcess); if ($processInfo.CommandLine -like '*ultimate-ecommerce*server.mjs*') { Stop-Process -Id $_.OwningProcess -Force } }
 New-Item -ItemType Directory -Path (Join-Path $PSScriptRoot 'data') -Force | Out-Null
 Start-Process -FilePath $node -ArgumentList ('"'+(Join-Path $PSScriptRoot 'native\gateway.mjs')+'"') -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $PSScriptRoot 'data\server.stdout.log') -RedirectStandardError (Join-Path $PSScriptRoot 'data\server.stderr.log')
}
if(!$ready) { for($i=0;$i -lt 90;$i++) { Start-Sleep -Milliseconds 500; $r=$null; try { $r=Invoke-RestMethod 'http://127.0.0.1:8200/api/health' -TimeoutSec 2 } catch {}; if($r.status -eq 'error') { throw $r.error }; if($r.application -eq 'astrallab-ultimate' -and $r.status -eq 'ok') { $ready=$true;break } } }
if(!$ready) { throw 'The platform did not start. See data\server.stderr.log.' }
if(!$NoBrowser) { Start-Process 'http://127.0.0.1:8200' }
Write-Host 'Ultimate Ecommarce By Astrallab: http://127.0.0.1:8200'
Write-Host 'Admin demo: http://127.0.0.1:8200/demo'
Write-Host 'Layouts and colors: http://127.0.0.1:8201/demo?next=/admin/themes'
