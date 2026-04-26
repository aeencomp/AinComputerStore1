#Requires -Version 5.1
# Copy PostgreSQL data from REMOTE_DATABASE_URL (e.g. Neon) into DATABASE_URL (local).
# Requires PostgreSQL client tools: pg_dump and psql on PATH (e.g. ...\PostgreSQL\16\bin).
$ErrorActionPreference = "Stop"

$Root = Split-Path $PSScriptRoot -Parent
$EnvFile = Join-Path $Root ".env"

function Import-DotEnv {
    param([string]$Path)
    if (-not (Test-Path $Path)) { return }
    Get-Content -LiteralPath $Path | ForEach-Object {
        $line = $_.TrimEnd()
        if ($line -eq "" -or $line.StartsWith("#")) { return }
        $idx = $line.IndexOf("=")
        if ($idx -lt 1) { return }
        $name = $line.Substring(0, $idx).Trim()
        $value = $line.Substring($idx + 1).Trim()
        if ($value.Length -ge 2 -and $value.StartsWith('"') -and $value.EndsWith('"')) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        [Environment]::SetEnvironmentVariable($name, $value, "Process")
    }
}

Import-DotEnv $EnvFile

$remote = $env:REMOTE_DATABASE_URL
if ($args.Count -ge 1 -and $args[0]) {
    $remote = $args[0]
}

$local = $env:DATABASE_URL
if (-not $remote) {
    Write-Error @"
Set REMOTE_DATABASE_URL in .env (your Neon connection string with ?sslmode=require),
or pass it as the first argument:
  .\scripts\copy-remote-to-local.ps1 'postgresql://...'
"@
    exit 1
}
if (-not $local) {
    Write-Error "DATABASE_URL is not set in .env"
    exit 1
}

$pgDump = Get-Command pg_dump -ErrorAction SilentlyContinue
$psql = Get-Command psql -ErrorAction SilentlyContinue
if (-not $pgDump -or -not $psql) {
    Write-Error "pg_dump and psql must be on PATH. Add PostgreSQL 'bin' to your PATH (e.g. C:\Program Files\PostgreSQL\16\bin)."
    exit 1
}

# Database name in path (e.g. ...5432/aincomputerstore?...)
if ($local -notmatch ':\d+/([^/?]+)') {
    Write-Error "Cannot parse database name from DATABASE_URL (expected ...host:port/dbname...)."
    exit 1
}
$dbName = $Matches[1]
if ($dbName -notmatch '^[a-zA-Z0-9_]+$') {
    Write-Error "Unsupported database name in DATABASE_URL; use letters, digits, underscore only."
    exit 1
}
$adminUrl = $local -replace [regex]::Escape("/$dbName"), "/postgres"

$tmp = Join-Path $env:TEMP "aincomputerstore-pgdump-$(Get-Date -Format 'yyyyMMddHHmmss').sql"
try {
    Write-Host "Recreating empty local database '$dbName'..."
    & psql -d $adminUrl -v ON_ERROR_STOP=1 -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$dbName' AND pid <> pg_backend_pid();"
    if ($LASTEXITCODE -ne 0) { throw "psql (terminate) exited with code $LASTEXITCODE" }
    & psql -d $adminUrl -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS $dbName WITH (FORCE);"
    if ($LASTEXITCODE -ne 0) { throw "psql (dropdb) exited with code $LASTEXITCODE" }
    & psql -d $adminUrl -v ON_ERROR_STOP=1 -c "CREATE DATABASE $dbName;"
    if ($LASTEXITCODE -ne 0) { throw "psql (createdb) exited with code $LASTEXITCODE" }

    Write-Host "Dumping remote database..."
    # No --clean: avoids DROP ordering issues; target DB is empty.
    & pg_dump -d $remote --no-owner --no-acl --format=p -f $tmp
    if ($LASTEXITCODE -ne 0) { throw "pg_dump exited with code $LASTEXITCODE" }

    Write-Host "Restoring into local DATABASE_URL..."
    & psql -d $local -v ON_ERROR_STOP=1 -f $tmp
    if ($LASTEXITCODE -ne 0) { throw "psql exited with code $LASTEXITCODE" }

    Write-Host "Done. Local database should match remote."
}
finally {
    if (Test-Path -LiteralPath $tmp) {
        Remove-Item -LiteralPath $tmp -ErrorAction SilentlyContinue
    }
}
