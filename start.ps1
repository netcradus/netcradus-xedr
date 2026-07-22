# NET XDR — start backend + frontend in parallel
# Usage: .\start.ps1

$root = $PSScriptRoot

Write-Host "`n=== SentryXDR Dev Server ===" -ForegroundColor Cyan
Write-Host "Backend  -> http://localhost:8888" -ForegroundColor Green
Write-Host "Frontend -> http://localhost:5173" -ForegroundColor Green
Write-Host "API Docs -> http://localhost:8888/docs`n" -ForegroundColor Yellow

# ── Backend ──────────────────────────────────────────────────────────────────
$backendJob = Start-Job -Name "Backend" -ScriptBlock {
    param($root)
    Set-Location "$root\backend"
    & "$root\backend\venv\Scripts\python.exe" -m uvicorn main:app --reload --host 127.0.0.1 --port 8888 2>&1
} -ArgumentList $root

# ── Frontend ─────────────────────────────────────────────────────────────────
# VITE_BACKEND_URL must match the backend's --port above (8888), or the Vite
# dev proxy falls back to its own default (8000) and every API call fails
# with ECONNREFUSED even though the backend is up and healthy.
$frontendJob = Start-Job -Name "Frontend" -ScriptBlock {
    param($root)
    Set-Location "$root\netcradus-dashboard"
    $env:VITE_BACKEND_URL = "http://127.0.0.1:8888"
    npm run dev 2>&1
} -ArgumentList $root

Write-Host "Both servers starting... Press Ctrl+C to stop.`n" -ForegroundColor Gray

# Stream output from both jobs
try {
    while ($true) {
        Receive-Job -Job $backendJob  | ForEach-Object { Write-Host "[backend ] $_"  -ForegroundColor DarkGreen }
        Receive-Job -Job $frontendJob | ForEach-Object { Write-Host "[frontend] $_" -ForegroundColor DarkBlue }
        Start-Sleep -Milliseconds 500
    }
} finally {
    Stop-Job  -Job $backendJob, $frontendJob
    Remove-Job -Job $backendJob, $frontendJob
    Write-Host "`nServers stopped." -ForegroundColor Red
}
