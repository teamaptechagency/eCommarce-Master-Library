$ErrorActionPreference='Stop'
$planPath=Join-Path $PSScriptRoot 'data/remove-duplicates-plan.json'
$plan=Get-Content -LiteralPath $planPath -Raw | ConvertFrom-Json
$expectedRoot=[IO.Path]::GetFullPath('E:\Tawhid\Ecommerce\New')
if([IO.Path]::GetFullPath($plan.Root) -ne $expectedRoot){throw 'Unexpected archive directory'}
function Assert-ArchivePath($item){
 $resolved=[IO.Path]::GetFullPath($item.Path)
 if([IO.Path]::GetDirectoryName($resolved) -ne $expectedRoot -or [IO.Path]::GetExtension($resolved) -ne '.zip'){throw ('Unsafe archive path: '+$resolved)}
 if(!(Test-Path -LiteralPath $resolved -PathType Leaf)){throw ('Archive is missing: '+$resolved)}
 if((Get-FileHash -LiteralPath $resolved -Algorithm SHA256).Hash -ne $item.Hash){throw ('Archive changed after verification: '+$resolved)}
}
foreach($item in $plan.Keep){Assert-ArchivePath $item}
foreach($item in $plan.Remove){
 Assert-ArchivePath $item
 if(!(@($plan.Keep | Where-Object Hash -eq $item.Hash).Count)){throw 'No matching retained original'}
}
$removed=@()
foreach($item in $plan.Remove){
 $original=@($plan.Keep | Where-Object Hash -eq $item.Hash)[0]
 Assert-ArchivePath $original
 Remove-Item -LiteralPath $item.Path -ErrorAction Stop
 $removed+=$item
 [pscustomobject]@{Root=$expectedRoot;Kept=$plan.Keep;Removed=$removed;Completed=($removed.Count -eq $plan.Remove.Count)} | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'data/duplicate-removal-result.json') -Encoding utf8
}
Write-Output ('Removed '+$removed.Count+' hash-verified duplicate ZIP files; retained '+@($plan.Keep).Count+' unique archives.')
