$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$inventory=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'data/new-archive-inventory.json') -Raw | ConvertFrom-Json
$importRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'data/new-sites'))
New-Item -ItemType Directory -Path $importRoot -Force | Out-Null
$result=foreach($group in ($inventory | Group-Object Hash)){
 $archive=$group.Group[0]
 $destination=[IO.Path]::GetFullPath((Join-Path $importRoot $archive.Hash.Substring(0,12).ToLowerInvariant()))
 if(!$destination.StartsWith($importRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Invalid import destination'}
 New-Item -ItemType Directory -Path $destination -Force | Out-Null
 $zip=[IO.Compression.ZipFile]::OpenRead((Join-Path 'E:\Tawhid\Ecommerce\New' $archive.Name))
 try{
  foreach($entry in $zip.Entries){
   $target=[IO.Path]::GetFullPath((Join-Path $destination $entry.FullName))
   if(!$target.StartsWith($destination+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw ('Unsafe archive entry: '+$entry.FullName)}
   if(($entry.ExternalAttributes -shr 16 -band 0xF000) -eq 0xA000){throw 'Symbolic links are not imported from archives'}
   if($entry.FullName.EndsWith('/')){New-Item -ItemType Directory -Path $target -Force | Out-Null;continue}
   New-Item -ItemType Directory -Path (Split-Path -Parent $target) -Force | Out-Null
   [IO.Compression.ZipFileExtensions]::ExtractToFile($entry,$target,$false)
  }
 } finally{$zip.Dispose()}
 [pscustomobject]@{Hash=$archive.Hash;Directory=$destination;Archives=@($group.Group.Name);Runnable=(Test-Path -LiteralPath (Join-Path $destination 'src/main.tsx'))}
}
$result | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'data/new-imports.json') -Encoding utf8
$result | Select-Object Hash,Runnable,@{Name='Archives';Expression={$_.Archives.Count}},Directory | Format-Table -AutoSize
