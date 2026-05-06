$ErrorActionPreference = "Stop"

$ContainerName = "ite-postgres"
$ImageName     = "ite-postgres-img"
$HostPort      = 5433
$DbUser        = "ite_user"
$DbPassword    = "ite_password"
$DbName        = "ite_db"
$MaxRetries    = 20
$RetryDelay    = 2

Write-Host "`n=== ITE PostgreSQL Setup ===" -ForegroundColor Cyan

# ---------- Pre-flight: Docker must be running ----------
try {
    docker info *> $null
} catch {
    Write-Host "ERROR: Docker is not running. Please start Docker Desktop and try again." -ForegroundColor Red
    exit 1
}

# ---------- Stop & remove existing container if present ----------
$existing = docker ps -a --filter "name=$ContainerName" --format "{{.Names}}" 2>$null
if ($existing -eq $ContainerName) {
    Write-Host "Removing existing container '$ContainerName'..." -ForegroundColor Yellow
    docker rm -f $ContainerName | Out-Null
}

# ---------- Build the image ----------
$dockerDir = Join-Path $PSScriptRoot "..\docker"
Write-Host "Building Docker image '$ImageName' from $dockerDir ..." -ForegroundColor Green
docker build -t $ImageName $dockerDir
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Docker build failed." -ForegroundColor Red
    exit 1
}

# ---------- Run the container ----------
Write-Host "Starting container '$ContainerName' on port $HostPort ..." -ForegroundColor Green
docker run -d `
    --name $ContainerName `
    -p "${HostPort}:5432" `
    -e POSTGRES_USER=$DbUser `
    -e POSTGRES_PASSWORD=$DbPassword `
    -e POSTGRES_DB=$DbName `
    $ImageName | Out-Null

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to start container." -ForegroundColor Red
    exit 1
}

# ---------- Wait for PostgreSQL to accept connections ----------
Write-Host "Waiting for PostgreSQL to be ready..." -ForegroundColor Yellow

$ready = $false
for ($i = 1; $i -le $MaxRetries; $i++) {
    $result = docker exec $ContainerName pg_isready -U $DbUser -d $DbName 2>$null
    if ($LASTEXITCODE -eq 0) {
        $ready = $true
        break
    }
    Write-Host "  Attempt $i/$MaxRetries - not ready yet, retrying in ${RetryDelay}s..."
    Start-Sleep -Seconds $RetryDelay
}

if (-not $ready) {
    Write-Host "ERROR: PostgreSQL did not become ready after $MaxRetries attempts." -ForegroundColor Red
    docker logs $ContainerName
    exit 1
}

# ---------- Verify connectivity with a real query ----------
Write-Host "Verifying database connectivity..." -ForegroundColor Yellow
$queryResult = docker exec $ContainerName psql -U $DbUser -d $DbName -c "SELECT count(*) FROM items;" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Could not query the database." -ForegroundColor Red
    Write-Host $queryResult
    exit 1
}

Write-Host "`n$queryResult" -ForegroundColor Gray
Write-Host "`nPostgreSQL is UP and connectable!" -ForegroundColor Green
Write-Host "  Host     : localhost"
Write-Host "  Port     : $HostPort"
Write-Host "  Database : $DbName"
Write-Host "  User     : $DbUser"
Write-Host "  Password : $DbPassword"
Write-Host "`nConnection string: postgresql://${DbUser}:${DbPassword}@localhost:${HostPort}/${DbName}" -ForegroundColor Cyan
Write-Host ""
