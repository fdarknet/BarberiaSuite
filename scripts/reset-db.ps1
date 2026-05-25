\
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "==> Resetting DB (docker compose down -v)"
docker compose down -v

Write-Host "==> Starting containers"
docker compose up -d

Write-Host "==> Installing backend deps"
npm install --prefix backend

Write-Host "==> Pushing schema"
npm run db:push --prefix backend

Write-Host "==> Seeding MINIMAL (1 sucursal, 1 barbero)"
npm run db:seed:min --prefix backend

Write-Host "✅ DB reset done."
