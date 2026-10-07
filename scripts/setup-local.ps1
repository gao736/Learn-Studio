$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$runtimePath = Join-Path $projectRoot '.runtime'
$binaryPath = Join-Path $runtimePath 'pgsql\bin'
$dataPath = Join-Path $runtimePath 'postgres-data'
New-Item -ItemType Directory -Path $runtimePath -Force | Out-Null
if (-not (Test-Path -LiteralPath (Join-Path $binaryPath 'pg_ctl.exe'))) {
    throw '先按 README 下载和解压官方 PostgreSQL 17.11 便携包到 .runtime/pgsql。'
}
function New-LocalSecret {
    $bytes = New-Object byte[] 32
    $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
    $generator.GetBytes($bytes)
    $generator.Dispose()
    return [BitConverter]::ToString($bytes).Replace('-', '').ToLowerInvariant()
}
$configPath = Join-Path $runtimePath 'local-db.json'
if (-not (Test-Path -LiteralPath $configPath)) {
    @{adminPassword=(New-LocalSecret); appPassword=(New-LocalSecret); authSecret=(New-LocalSecret)} |
        ConvertTo-Json | Set-Content -LiteralPath $configPath -Encoding utf8
}
$config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
if (-not (Test-Path -LiteralPath (Join-Path $dataPath 'PG_VERSION'))) {
    $passwordPath = Join-Path $runtimePath 'init-password'
    $config.adminPassword | Set-Content -LiteralPath $passwordPath -Encoding ascii
    & (Join-Path $binaryPath 'initdb.exe') -D $dataPath -U learning_admin -A scram-sha-256 --pwfile=$passwordPath -E UTF8 --locale=C
    if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL 初始化失败。' }
    Remove-Item -LiteralPath $passwordPath
}
& (Join-Path $binaryPath 'pg_ctl.exe') -D $dataPath status *> $null
if ($LASTEXITCODE -ne 0) {
    & (Join-Path $binaryPath 'pg_ctl.exe') -D $dataPath -l (Join-Path $runtimePath 'postgres.log') -o '-h 127.0.0.1 -p 54329' -w start
    if ($LASTEXITCODE -ne 0) { throw '本机数据库未能启动，请检查 .runtime/postgres.log。' }
}
$previousPassword = $env:PGPASSWORD
$env:PGPASSWORD = $config.adminPassword
try {
    $psqlPath = Join-Path $binaryPath 'psql.exe'
    $roleExists = & $psqlPath -h 127.0.0.1 -p 54329 -U learning_admin -d postgres -Atc "SELECT 1 FROM pg_roles WHERE rolname='learning_app'"
    if ($roleExists -ne '1') {
        & $psqlPath -h 127.0.0.1 -p 54329 -U learning_admin -d postgres -v ON_ERROR_STOP=1 -c "CREATE ROLE learning_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD '$($config.appPassword)'"
        if ($LASTEXITCODE -ne 0) { throw '应用数据库角色创建失败。' }
    }
    $dbExists = & $psqlPath -h 127.0.0.1 -p 54329 -U learning_admin -d postgres -Atc "SELECT 1 FROM pg_database WHERE datname='learning_platform'"
    if ($dbExists -ne '1') {
        & $psqlPath -h 127.0.0.1 -p 54329 -U learning_admin -d postgres -v ON_ERROR_STOP=1 -c 'CREATE DATABASE learning_platform OWNER learning_app'
        if ($LASTEXITCODE -ne 0) { throw '应用数据库创建失败。' }
    }
} finally { $env:PGPASSWORD = $previousPassword }
$envPath = Join-Path $projectRoot '.env.local'
if (-not (Test-Path -LiteralPath $envPath)) {
    @"
DATABASE_URL=postgresql://learning_app:$($config.appPassword)@127.0.0.1:54329/learning_platform
BETTER_AUTH_SECRET=$($config.authSecret)
BETTER_AUTH_URL=http://127.0.0.1:3000
SMTP_HOST=127.0.0.1
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_FROM=Learning Studio <noreply@example.test>
LOCAL_MAILBOX=true
SILICONFLOW_API_KEY=
SILICONFLOW_BASE_URL=https://api.siliconflow.cn/v1
SILICONFLOW_MODEL=XingChenAGI/Xing4.0-29B
"@ | Set-Content -LiteralPath $envPath -Encoding utf8
}
Write-Output '本机 PostgreSQL 已就绪：127.0.0.1:54329。配置已保存，未输出任何密钥。'
