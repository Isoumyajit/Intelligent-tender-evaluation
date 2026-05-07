$ErrorActionPreference = "Stop"

$ContainerName = "ite-postgres"
$ImageName     = "ite-postgres-img"

Write-Host "`n=== ITE PostgreSQL Teardown ===" -ForegroundColor Cyan

# ---------- Stop & remove container ----------
$existing = docker ps -a --filter "name=$ContainerName" --format "{{.Names}}" 2>$null
if ($existing -eq $ContainerName) {
    Write-Host "Stopping and removing container '$ContainerName'..." -ForegroundColor Yellow
    docker rm -f $ContainerName | Out-Null
    Write-Host "Container '$ContainerName' removed." -ForegroundColor Green
} else {
    Write-Host "No container named '$ContainerName' found." -ForegroundColor Gray
}

# ---------- Optionally remove the image ----------
$imageExists = docker images -q $ImageName 2>$null
if ($imageExists) {
    Write-Host "Removing image '$ImageName'..." -ForegroundColor Yellow
    docker rmi $ImageName | Out-Null
    Write-Host "Image '$ImageName' removed." -ForegroundColor Green
} else {
    Write-Host "No image named '$ImageName' found." -ForegroundColor Gray
}

Write-Host "`nTeardown complete.`n" -ForegroundColor Cyan
