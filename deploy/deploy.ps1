<#
.SYNOPSIS
  Push GoalOps frontend + MCP server to the production VPS from a Windows
  dev machine. Equivalent of deploy/deploy.sh for non-bash environments.

.DESCRIPTION
  Uses only Windows 11 built-ins:
    - ssh.exe / scp.exe  (OpenSSH client, in System32\OpenSSH\)
    - tar.exe            (bsdtar, in System32\)
  No WSL / rsync / Git Bash needed. Requires SSH key auth to $Remote.

  Pipeline:
    1. npm run build                              (skip with -SkipFrontend)
    2. Pack dist/ + mcp/ + pb_migrations/ + pb_hooks/ into local tarballs
    3. scp tarballs + remote bootstrap script to /tmp on the server
    4. ssh + bash: atomic swap dist, unpack mcp, npm ci+build, pb migrate up,
       systemctl restart both services

  Atomic dist swap: contents go to /var/www/goalops.new, then `mv` rotates
  the old tree to .old. Short window where Caddy may 404 is ~one mv call.

.PARAMETER Remote
  user@host for ssh/scp. Default: goalops@goal.996007.fun
  Override via env GOALOPS_REMOTE.

.PARAMETER SkipFrontend
  Skip `npm run build` and dist upload. Useful when only MCP changed.

.PARAMETER SkipMcp
  Skip MCP + migrations upload. Useful when only frontend changed.

.PARAMETER SkipMigrate
  Skip `pocketbase migrate up`. Use when no schema change.

.EXAMPLE
  .\deploy\deploy.ps1
  .\deploy\deploy.ps1 -SkipMigrate
  $env:GOALOPS_REMOTE = 'me@1.2.3.4'; .\deploy\deploy.ps1
#>
#requires -Version 5.1
[CmdletBinding()]
param(
	[string]$Remote,
	[string]$RemoteRoot,
	[string]$RemoteWeb,
	[string]$NodeBin,
	[string]$NpmBin,
	[switch]$SkipFrontend,
	[switch]$SkipMcp,
	[switch]$SkipMigrate
)

$ErrorActionPreference = 'Stop'

# --- defaults: arg > env > literal -------------------------------------------
function Coalesce { foreach ($v in $args) { if ($v) { return $v } } }
$Remote     = Coalesce $Remote     $env:GOALOPS_REMOTE      'root@host.996007.fun'
$RemoteRoot = Coalesce $RemoteRoot $env:GOALOPS_REMOTE_ROOT '/opt/goalops'
$RemoteWeb  = Coalesce $RemoteWeb  $env:GOALOPS_REMOTE_WEB  '/var/www/goalops'
$NodeBin    = Coalesce $NodeBin    $env:GOALOPS_NODE_BIN    '/usr/bin/node'
$NpmBin     = Coalesce $NpmBin     $env:GOALOPS_NPM_BIN     '/usr/bin/npm'

$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

function Say($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }

# --- prerequisite tools -------------------------------------------------------
foreach ($bin in @('ssh', 'scp', 'tar', 'npm')) {
	if (-not (Get-Command $bin -ErrorAction SilentlyContinue)) {
		throw "$bin not found on PATH. ssh/scp/tar should be Windows 11 built-ins under System32\OpenSSH and System32; npm needs Node.js installed."
	}
}

# --- helpers ------------------------------------------------------------------
function Invoke-NativeExit {
	param([string]$What)
	# Native exes set $LASTEXITCODE. PowerShell's $? for native commands is also
	# usable but $LASTEXITCODE is the unambiguous signal.
	if ($LASTEXITCODE -ne 0) { throw "$What failed (exit $LASTEXITCODE)" }
}

function New-Tarball {
	param([string]$Output, [string]$BaseDir, [string[]]$Excludes = @())
	$tarArgs = @('-czf', $Output, '-C', $BaseDir)
	foreach ($ex in $Excludes) { $tarArgs += "--exclude=$ex" }
	$tarArgs += '.'
	& tar @tarArgs
	Invoke-NativeExit "tar $BaseDir"
}

function Send-File {
	param([string]$Local, [string]$RemotePath)
	& scp $Local "${Remote}:$RemotePath"
	Invoke-NativeExit "scp $Local"
}

function Write-LfFile {
	# Write a script with LF endings and no BOM — bash on the server will
	# choke on CRLF or a leading UTF-8 BOM otherwise.
	param([string]$Path, [string]$Content)
	$lf = $Content -replace "`r`n", "`n"
	[IO.File]::WriteAllText($Path, $lf, (New-Object System.Text.UTF8Encoding $false))
}

$tmpFiles = @()
function New-TempPath([string]$Suffix) {
	$p = Join-Path $env:TEMP ("goalops-" + [Guid]::NewGuid().ToString('N') + $Suffix)
	$script:tmpFiles += $p
	return $p
}

try {
	# --- 1. build frontend ----------------------------------------------------
	if (-not $SkipFrontend) {
		Say 'Building frontend (npm run build)'
		& npm run build
		Invoke-NativeExit 'npm run build'
	}

	# --- 2. pack tarballs -----------------------------------------------------
	$distTar = $null; $mcpTar = $null; $migTar = $null; $hooksTar = $null

	if (-not $SkipFrontend) {
		$distTar = New-TempPath '-dist.tar.gz'
		Say "Packing dist/ -> $(Split-Path -Leaf $distTar)"
		New-Tarball -Output $distTar -BaseDir (Join-Path $RepoRoot 'dist')
	}

	if (-not $SkipMcp) {
		$mcpTar = New-TempPath '-mcp.tar.gz'
		Say "Packing mcp/ (excluding node_modules / dist / .env)"
		New-Tarball -Output $mcpTar -BaseDir (Join-Path $RepoRoot 'mcp') `
			-Excludes @('node_modules', 'dist', '.env')

		$migTar = New-TempPath '-migrations.tar.gz'
		Say "Packing backend/pocketbase/pb_migrations/"
		New-Tarball -Output $migTar `
			-BaseDir (Join-Path $RepoRoot 'backend/pocketbase/pb_migrations')

		$hooksDir = Join-Path $RepoRoot 'backend/pocketbase/pb_hooks'
		if (Test-Path $hooksDir) {
			$hooksTar = New-TempPath '-hooks.tar.gz'
			Say "Packing backend/pocketbase/pb_hooks/"
			New-Tarball -Output $hooksTar -BaseDir $hooksDir
		}
	}

	# --- 3. upload artifacts --------------------------------------------------
	if ($distTar)  { Say 'scp dist tarball'; Send-File $distTar '/tmp/goalops-dist.tar.gz' }
	if ($mcpTar)   { Say 'scp mcp tarball';  Send-File $mcpTar  '/tmp/goalops-mcp.tar.gz' }
	if ($migTar)   { Say 'scp migrations tarball'; Send-File $migTar '/tmp/goalops-migrations.tar.gz' }
	if ($hooksTar) { Say 'scp hooks tarball';      Send-File $hooksTar '/tmp/goalops-hooks.tar.gz' }

	# --- 4. remote script -----------------------------------------------------
	# PowerShell expands $RemoteWeb / $RemoteRoot / $NpmBin / $SkipMigrate
	# below (double-quoted here-string). Bash gets the already-substituted
	# literals. Anything that should stay as a bash variable must be escaped
	# with a backtick — e.g. `${REPLY}` — but we don't need any here.
	$skipMigrateFlag = if ($SkipMigrate) { '1' } else { '' }
	$remoteScript = @"
set -euo pipefail

# --- 4a. atomic dist swap ----------------------------------------------------
if [ -f /tmp/goalops-dist.tar.gz ]; then
	echo "==> Atomic-swapping $RemoteWeb"
	sudo rm -rf "${RemoteWeb}.new"
	sudo mkdir -p "${RemoteWeb}.new"
	sudo tar xzf /tmp/goalops-dist.tar.gz -C "${RemoteWeb}.new"
	sudo rm -rf "${RemoteWeb}.old"
	if [ -d "$RemoteWeb" ]; then sudo mv "$RemoteWeb" "${RemoteWeb}.old"; fi
	sudo mv "${RemoteWeb}.new" "$RemoteWeb"
	sudo chown -R goalops:goalops "$RemoteWeb"
	rm -f /tmp/goalops-dist.tar.gz
fi

# --- 4b. mcp sources ---------------------------------------------------------
if [ -f /tmp/goalops-mcp.tar.gz ]; then
	echo "==> Unpacking mcp/"
	sudo mkdir -p $RemoteRoot/mcp
	sudo tar xzf /tmp/goalops-mcp.tar.gz -C $RemoteRoot/mcp
	sudo chown -R goalops:goalops $RemoteRoot/mcp
	rm -f /tmp/goalops-mcp.tar.gz
fi

# --- 4c. migrations ----------------------------------------------------------
if [ -f /tmp/goalops-migrations.tar.gz ]; then
	echo "==> Unpacking pb_migrations/"
	sudo mkdir -p $RemoteRoot/pocketbase/pb_migrations
	sudo tar xzf /tmp/goalops-migrations.tar.gz -C $RemoteRoot/pocketbase/pb_migrations
	sudo chown -R goalops:goalops $RemoteRoot/pocketbase/pb_migrations
	rm -f /tmp/goalops-migrations.tar.gz
fi

# --- 4c'. hooks -------------------------------------------------------------
if [ -f /tmp/goalops-hooks.tar.gz ]; then
	echo "==> Unpacking pb_hooks/"
	sudo rm -rf $RemoteRoot/pocketbase/pb_hooks
	sudo mkdir -p $RemoteRoot/pocketbase/pb_hooks
	sudo tar xzf /tmp/goalops-hooks.tar.gz -C $RemoteRoot/pocketbase/pb_hooks
	sudo chown -R goalops:goalops $RemoteRoot/pocketbase/pb_hooks
	rm -f /tmp/goalops-hooks.tar.gz
fi

# --- 4d. npm install + tsc build (only if mcp was pushed) --------------------
if [ -d $RemoteRoot/mcp ] && [ -f $RemoteRoot/mcp/package.json ]; then
	echo "==> npm ci + build"
	cd $RemoteRoot/mcp
	sudo -u goalops $NpmBin ci --no-audit --no-fund
	sudo -u goalops $NpmBin run build
fi

# --- 4e. pb migrate up -------------------------------------------------------
if [ -z "$skipMigrateFlag" ] && [ -x $RemoteRoot/pocketbase/pocketbase ]; then
	echo "==> pocketbase migrate up"
	sudo -u goalops $RemoteRoot/pocketbase/pocketbase migrate up \
		--dir=$RemoteRoot/pocketbase/pb_data \
		--migrationsDir=$RemoteRoot/pocketbase/pb_migrations
fi

# --- 4f. restart services ----------------------------------------------------
echo "==> Restarting services"
sudo systemctl restart pocketbase.service goalops-mcp.service
sudo systemctl status --no-pager pocketbase.service goalops-mcp.service | head -40
"@

	$scriptTmp = New-TempPath '-remote.sh'
	Write-LfFile -Path $scriptTmp -Content $remoteScript
	Say 'scp remote script'
	Send-File $scriptTmp '/tmp/goalops-remote.sh'

	# --- 5. run remote --------------------------------------------------------
	Say 'Running remote build + restart'
	& ssh -t $Remote 'bash /tmp/goalops-remote.sh && rm -f /tmp/goalops-remote.sh'
	Invoke-NativeExit 'remote bash'

	Say 'Done. Visit https://goal.996007.fun/'
}
finally {
	foreach ($f in $tmpFiles) {
		if (Test-Path $f) { Remove-Item $f -Force -ErrorAction SilentlyContinue }
	}
}
