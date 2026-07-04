# scripts/demo.ps1 — Warm Start 원클릭 실행
#
# 사용: 저장소 루트에서 pwsh -ExecutionPolicy Bypass -File scripts/demo.ps1
# 목적: 발표 직전 3단계(DB 기동 → 게이트 확인 → API 서버)를 한 번에.

$ErrorActionPreference = "Stop"

Write-Host "[demo] 1/3 docker compose up -d db"
docker compose up -d db

Write-Host "[demo] waiting for db healthy..."
$deadline = (Get-Date).AddSeconds(30)
while ($true) {
    $status = docker inspect -f '{{.State.Health.Status}}' pack-your-jeju-db 2>$null
    if ($status -eq "healthy") { break }
    if ((Get-Date) -gt $deadline) {
        Write-Error "[demo] db unhealthy after 30s"
        exit 1
    }
    Start-Sleep -Seconds 1
}
Write-Host "[demo] db healthy."

Write-Host "[demo] 2/3 golden set gate (report saved to data/eval)"
python -m packages.eval.run --out data/eval
if ($LASTEXITCODE -ne 0) {
    Write-Error "[demo] eval gate failed. Do not proceed."
    exit 1
}

Write-Host "[demo] 3/3 starting uvicorn on http://localhost:8000"
Write-Host "[demo] (Ctrl+C to stop)"
uvicorn apps.api.main:app --host 0.0.0.0 --port 8000 --reload
