param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$library = Join-Path $PSScriptRoot 'master-library'
$node = 'C:\Program Files\nodejs\node.exe'
if (!(Test-Path -LiteralPath $node)) { $node = (Get-Command node -ErrorAction Stop).Source }
$ready = $false
try { $r = Invoke-WebRequest 'http://127.0.0.1:8090/api/sites' -UseBasicParsing -TimeoutSec 2; $ready = ($r.StatusCode -eq 200) } catch {}
if (!$ready) {
    New-Item -ItemType Directory -Path (Join-Path $library 'data') -Force | Out-Null
    Start-Process -FilePath $node -ArgumentList ('"' + (Join-Path $library 'server.mjs') + '"') -WorkingDirectory $library -WindowStyle Hidden -RedirectStandardOutput (Join-Path $library 'data\library.stdout.log') -RedirectStandardError (Join-Path $library 'data\library.stderr.log')
    for ($i=0; $i -lt 30; $i++) {
        Start-Sleep -Milliseconds 500
        try { $r = Invoke-WebRequest 'http://127.0.0.1:8090/api/sites' -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -eq 200) { $ready = $true; break } } catch {}
    }
}
if (!$ready) { throw 'Master Library did not start. See master-library\data\library.stderr.log.' }
if (!$NoBrowser) { Start-Process 'http://127.0.0.1:8090' }
Write-Host 'Master Library: http://127.0.0.1:8090'
Write-Host 'Public portals and password-free Admin Demo Login are available from the library.'
