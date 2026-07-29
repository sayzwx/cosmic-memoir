$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot

# Rebase first so scheduled pushes do not overwrite remote work.
& git -C $repoRoot fetch origin main
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& git -C $repoRoot pull --rebase origin main
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# Retry any already-committed local work before looking for new changes.
& git -C $repoRoot push origin main
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$changes = & git -C $repoRoot status --porcelain
if ([string]::IsNullOrWhiteSpace($changes)) { exit 0 }

& git -C $repoRoot add -A
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& git -C $repoRoot diff --cached --quiet
if ($LASTEXITCODE -eq 0) { exit 0 }

$timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm'
& git -C $repoRoot commit -m "chore: auto-sync $timestamp"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& git -C $repoRoot push origin main
exit $LASTEXITCODE
