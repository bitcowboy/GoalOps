<#
.SYNOPSIS
  One-shot sync of local backend/pocketbase/pb_data -> server.

.DESCRIPTION
  Bulk-overwrites the server's pb_data with the local copy. Intended for
  seeding production from your dev DB, or rare schema-data resets. The remote
  side is stopped, backed up, replaced, chown'd, then restarted.

  Caveats:
    - SQLite consistency: local pocketbase must NOT be running. We refuse to
      run if pocketbase.exe is alive locally.
    - Identity overwrite: the _superusers collection comes with the data, so
      remote admin accounts get replaced by whatever exists locally.
    - File ownership: remote files get chown -R goalops:goalops so the
      pocketbase.service user can read/write them.

.PARAMETER Remote
  user@host for ssh/scp. Default: from $env:GOALOPS_REMOTE or
  root@host.996007.fun.

.PARAMETER RemoteRoot
  Install root on the server. Default /opt/goalops.

.PARAMETER PbServiceUser
  Linux user owning pb_data. Default goalops.

.PARAMETER NoBackup
  Skip taking a tar.gz of the existing remote pb_data before overwrite.
  Don't use this unless you really mean it.

.EXAMPLE
  .\deploy\sync-pb-data.ps1
  .\deploy\sync-pb-data.ps1 -Remote me@1.2.3.4 -NoBackup
#>
#requires -Version 5.1
[CmdletBinding()]
param(
	[string]$Remote,
	[string]$RemoteRoot,
	[string]$PbServiceUser,
	[switch]$NoBackup
)

$ErrorActionPreference = 'Stop'

function Coalesce { foreach ($v in $args) { if ($v) { return $v } } }
$Remote        = Coalesce $Remote        $env:GOALOPS_REMOTE      'root@host.996007.fun'
$RemoteRoot    = Coalesce $RemoteRoot    $env:GOALOPS_REMOTE_ROOT '/opt/goalops'
$PbServiceUser = Coalesce $PbServiceUser $env:GOALOPS_PB_USER     'goalops'

$RepoRoot = Split-Path -Parent $PSScriptRoot
$LocalPbData = Join-Path $RepoRoot 'backend/pocketbase/pb_data'

if (-not (Test-Path $LocalPbData)) {
	throw "Local pb_data not found at $LocalPbData"
}

# Refuse to run while a local pocketbase is alive — SQLite WAL would be in
# flux and the tar snapshot could be inconsistent.
$running = Get-Process -Name pocketbase -ErrorAction SilentlyContinue
if ($running) {
	throw "Local pocketbase (PID $($running.Id)) is running. Stop it first (Ctrl-C in its terminal, or Stop-Process)."
}

function Say($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
function Invoke-NativeExit { param([string]$What) if ($LASTEXITCODE -ne 0) { throw "$What failed (exit $LASTEXITCODE)" } }

# Big-yellow warning + interactive confirm.
Write-Host ""
Write-Host "  Local  :  $LocalPbData" -ForegroundColor Yellow
Write-Host "  Remote :  $($Remote):$RemoteRoot/pocketbase/pb_data" -ForegroundColor Yellow
Write-Host ""
Write-Host "  This will REPLACE remote pb_data wholesale, including _superusers." -ForegroundColor Yellow
if (-not $NoBackup) {
	Write-Host "  Old remote pb_data goes to $RemoteRoot/backups/pb_data-pre-sync-*.tar.gz" -ForegroundColor DarkYellow
} else {
	Write-Host "  -NoBackup specified: old remote pb_data will be DELETED, no rollback." -ForegroundColor Red
}
Write-Host ""
$confirm = Read-Host "Type the word SYNC to proceed"
if ($confirm -ne 'SYNC') { Write-Host "Aborted." -ForegroundColor Red; return }

$tmp = Join-Path $env:TEMP ("goalops-pbdata-" + [Guid]::NewGuid().ToString('N') + '.tar.gz')

try {
	Say "Packing local pb_data ($((Get-ChildItem $LocalPbData -Recurse | Measure-Object Length -Sum).Sum / 1MB) MB total)"
	# -C to the parent dir so the tarball contains a `pb_data/` root entry. This
	# lets the remote side extract into pocketbase/ and end up with
	# pocketbase/pb_data/... in one step.
	& tar -czf $tmp -C (Split-Path -Parent $LocalPbData) `
		--exclude='pb_data/backups' `
		--exclude='pb_data/types.d.ts' `
		'pb_data'
	Invoke-NativeExit 'tar pack'

	Say "scp -> /tmp"
	& scp $tmp "${Remote}:/tmp/goalops-pbdata.tar.gz"
	Invoke-NativeExit 'scp'

	$backupFlag = if ($NoBackup) { '' } else { '1' }
	$remoteScript = @"
set -euo pipefail

PB_DIR="$RemoteRoot/pocketbase"
PB_DATA="`$PB_DIR/pb_data"
BACKUP_DIR="$RemoteRoot/backups"
TS="`$(date -u +%Y%m%dT%H%M%SZ)"

echo "==> Stopping pocketbase.service"
sudo systemctl stop pocketbase.service || true

if [ -n "$backupFlag" ] && [ -d "`$PB_DATA" ]; then
	sudo mkdir -p "`$BACKUP_DIR"
	echo "==> Backing up existing pb_data -> `$BACKUP_DIR/pb_data-pre-sync-`$TS.tar.gz"
	sudo tar czf "`$BACKUP_DIR/pb_data-pre-sync-`$TS.tar.gz" -C "`$PB_DIR" pb_data
fi

echo "==> Removing old pb_data"
sudo rm -rf "`$PB_DATA"

echo "==> Extracting incoming pb_data"
sudo tar xzf /tmp/goalops-pbdata.tar.gz -C "`$PB_DIR"

echo "==> chown -R ${PbServiceUser}:${PbServiceUser} pb_data"
sudo chown -R ${PbServiceUser}:${PbServiceUser} "`$PB_DATA"

rm -f /tmp/goalops-pbdata.tar.gz

echo "==> Starting pocketbase.service"
sudo systemctl start pocketbase.service
sleep 1
sudo systemctl status --no-pager pocketbase.service | head -20

echo "==> Health check"
curl -fsS http://127.0.0.1:8090/api/health && echo
"@

	$scriptTmp = Join-Path $env:TEMP ("goalops-sync-remote-" + [Guid]::NewGuid().ToString('N') + '.sh')
	$utf8NoBom = New-Object System.Text.UTF8Encoding $false
	[IO.File]::WriteAllText($scriptTmp, ($remoteScript -replace "`r`n", "`n"), $utf8NoBom)

	Say "scp remote script"
	& scp $scriptTmp "${Remote}:/tmp/goalops-sync-remote.sh"
	Invoke-NativeExit 'scp remote script'
	Remove-Item $scriptTmp -Force

	Say "Running remote replace + restart"
	& ssh -t $Remote 'bash /tmp/goalops-sync-remote.sh && rm -f /tmp/goalops-sync-remote.sh'
	Invoke-NativeExit 'remote bash'

	Say "Done. Open https://goal.996007.fun/_/ — log in with your LOCAL superuser credentials."
}
finally {
	if (Test-Path $tmp) { Remove-Item $tmp -Force -ErrorAction SilentlyContinue }
}
