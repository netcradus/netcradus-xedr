# NET XDR — start backend + frontend in parallel
# Usage: .\start.ps1

$root = $PSScriptRoot
$lanIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
    $_.IPAddress -notlike '169.254.*' -and $_.IPAddress -ne '127.0.0.1' -and $_.InterfaceAlias -notmatch 'Loopback|vEthernet'
} | Select-Object -First 1 -ExpandProperty IPAddress)

Write-Host "`n=== NET XDR Dev Server ===" -ForegroundColor Cyan
Write-Host "Backend  -> http://localhost:8888  (also reachable at http://${lanIP}:8888 from other machines/VMs on this network)" -ForegroundColor Green
Write-Host "Frontend -> http://localhost:5173" -ForegroundColor Green
Write-Host "API Docs -> http://localhost:8888/docs`n" -ForegroundColor Yellow
Write-Host "First time reaching the backend from another machine? Run as Administrator:" -ForegroundColor DarkYellow
Write-Host "  New-NetFirewallRule -DisplayName 'NET XDR Backend' -Direction Inbound -Protocol TCP -LocalPort 8888 -Action Allow`n" -ForegroundColor DarkYellow

# ── Backend ──────────────────────────────────────────────────────────────────
# Bound to 0.0.0.0, not 127.0.0.1, so other machines on the network (e.g. a VM
# running the agent) can reach it — loopback-only binding is a common reason
# "it works on this machine but the VM can't connect."
$backendJob = Start-Job -Name "Backend" -ScriptBlock {
    param($root)
    Set-Location "$root\backend"
    & "$root\backend\venv\Scripts\python.exe" -m uvicorn main:app --reload --host 0.0.0.0 --port 8888 2>&1
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
