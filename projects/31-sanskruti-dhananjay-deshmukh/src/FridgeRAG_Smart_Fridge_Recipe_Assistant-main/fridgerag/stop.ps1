$ErrorActionPreference = 'Stop'

$conn = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
if ($null -eq $conn) {
    Write-Host 'FridgeRAG is not running on port 8000.'
    exit 0
}

$procIds = $conn | Select-Object -ExpandProperty OwningProcess -Unique
foreach ($procId in $procIds) {
    Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    Write-Host "Stopped FridgeRAG process PID $procId"
}
