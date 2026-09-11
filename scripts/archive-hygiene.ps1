# T1 hygiene: archive pre-refactor .bak / .pyc into _archive/pre-refactor-20260911/
# keeping the original relative path, and (re)build MANIFEST.sha256 (sha256 + original path).
# Local-repo only. Idempotent: if source already moved, hash is taken from the archive copy.
param(
    [string]$RepoRoot = (Split-Path -Parent $PSScriptRoot),
    [string]$ArchiveDir = "_archive/pre-refactor-20260911"
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Set-Location -LiteralPath $RepoRoot
git config core.quotepath false

$logPath = Join-Path $RepoRoot '.git\archive-hygiene.log'
$log = New-Object System.Collections.Generic.List[string]

# 1. Collect: .bak files (incl. .bak-<date> variants) + __pycache__/*.pyc still in the source tree
$rootPrefix = ($RepoRoot.TrimEnd('\', '/') + '\')
$toRel = {
    param($full)
    $r = ($full.Substring($rootPrefix.Length)) -replace '\\', '/'
    if ($r -notlike '_archive/*') { $r } else { $null }
}

$bakFiles = @(Get-ChildItem -LiteralPath $RepoRoot -Recurse -File -Filter '*.bak*' -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch '\\node_modules\\' -and $_.FullName -notmatch '\\\.git\\' -and $_.FullName -notmatch '\\_archive\\' } |
    Where-Object { $_.Name -match '\.bak($|-)' } |
    ForEach-Object { & $toRel $_.FullName })
$pycFiles = @(Get-ChildItem -LiteralPath $RepoRoot -Recurse -File -Filter '*.pyc' -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch '\\node_modules\\' -and $_.FullName -notmatch '\\\.git\\' -and $_.FullName -notmatch '\\_archive\\' } |
    ForEach-Object { & $toRel $_.FullName })

$targets = @($bakFiles + $pycFiles | Where-Object { $_ } | Sort-Object -Unique)
$log.Add("bak=$(@($bakFiles | Where-Object { $_ }).Count) pyc=$(@($pycFiles | Where-Object { $_ }).Count) targets=$($targets.Count)")

# 2. Ensure archive dir exists
$manifestPath = Join-Path $RepoRoot (Join-Path $ArchiveDir 'MANIFEST.sha256')
$manifestDir = Split-Path -Parent $manifestPath
if (-not (Test-Path -LiteralPath $manifestDir)) {
    New-Item -ItemType Directory -Force -Path $manifestDir | Out-Null
}

$archiveRel = ($ArchiveDir -replace '\\', '/')

# MANIFEST records the ORIGINAL relative path (fresh rebuild every run).
$manifestLines = New-Object System.Collections.Generic.List[string]
$moved = 0; $skipped = 0; $failed = 0

foreach ($rel in $targets) {
    $diskPath = Join-Path $RepoRoot $rel

    # __pycache__/ is gitignored wholesale and '!_archive/**' cannot re-include it,
    # so inside the archive the folder is renamed to '_pycache__'.
    $relInArchive = $rel -replace '(^|/)__pycache__(/|$)', '${1}_pycache_${2}'
    $destRel = "$archiveRel/$relInArchive"
    $dest = Join-Path $RepoRoot $destRel

    try {
        if (Test-Path -LiteralPath $diskPath) {
            $hash = (Get-FileHash -LiteralPath $diskPath -Algorithm SHA256).Hash.ToLowerInvariant()
            if (Test-Path -LiteralPath $dest) {
                $log.Add("skip(exists): $rel")
                $skipped++
            } else {
                $destDir = Split-Path -Parent $dest
                if (-not (Test-Path -LiteralPath $destDir)) {
                    New-Item -ItemType Directory -Force -Path $destDir | Out-Null
                }
                # git mv writes to stderr on failure; keep the Stop preference from
                # turning that into a terminating error.
                $prev = $ErrorActionPreference
                $ErrorActionPreference = 'SilentlyContinue'
                & git mv -- "$rel" "$destRel" 2>&1 | Out-Null
                $ok = ($LASTEXITCODE -eq 0)
                $ErrorActionPreference = $prev
                if ($ok) {
                    $moved++
                } else {
                    # untracked (gitignored, e.g. pyc) -> copy + delete
                    Copy-Item -LiteralPath $diskPath -Destination $dest -Force
                    Remove-Item -LiteralPath $diskPath -Force
                    git add -f -- "$destRel" 2>&1 | Out-Null
                    $moved++
                }
            }
            $manifestLines.Add("$hash  $rel")
        } elseif (Test-Path -LiteralPath $dest) {
            # moved by a previous run -> hash the archived copy, keep original path in manifest
            $hash = (Get-FileHash -LiteralPath $dest -Algorithm SHA256).Hash.ToLowerInvariant()
            $manifestLines.Add("$hash  $rel")
            $skipped++
        } else {
            $log.Add("absent: $rel")
        }
    } catch {
        $log.Add("fail: $rel :: $($_.Exception.Message)")
        $failed++
    }
}

# MANIFEST is always rebuilt from the archive tree so re-runs can never truncate it.
# Inside the archive '__pycache__' was stored as '_pycache_', so map it back.
$entries = New-Object System.Collections.Generic.List[string]
$archiveRoot = Join-Path $RepoRoot $ArchiveDir
if (Test-Path -LiteralPath $archiveRoot) {
    $archPrefix = ($ArchiveDir.TrimEnd('\', '/') + '/')
    Get-ChildItem -LiteralPath $archiveRoot -Recurse -File -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -ne 'MANIFEST.sha256' } |
        ForEach-Object {
            $inArchive = ($_.FullName.Substring((Join-Path $RepoRoot ($archPrefix -replace '/', '\')).Length)) -replace '\\', '/'
            $original = $inArchive -replace '(^|/)_pycache_(/|$)', '${1}__pycache__${2}'
            $hash = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
            $entries.Add("$hash  $original")
        }
}
$finalManifest = @($entries | Sort-Object -Unique)
Set-Content -LiteralPath $manifestPath -Value $finalManifest -Encoding UTF8
$log.Add("moved=$moved skipped=$skipped failed=$failed manifest=$($finalManifest.Count)")
$log | Set-Content -LiteralPath $logPath -Encoding UTF8
Write-Host "archive-hygiene done: moved=$moved skipped=$skipped failed=$failed manifest=$($manifestLines.Count)"
