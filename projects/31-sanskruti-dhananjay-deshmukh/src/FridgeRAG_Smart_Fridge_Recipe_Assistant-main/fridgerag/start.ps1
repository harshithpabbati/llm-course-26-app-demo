$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$pythonExe = Join-Path (Split-Path -Parent $scriptDir) '.venv\Scripts\python.exe'
$runFile = Join-Path $scriptDir 'run.py'

if (-not (Test-Path $pythonExe)) {
    Write-Error "Python executable not found at $pythonExe"
}

if (-not (Test-Path $runFile)) {
    Write-Error "run.py not found at $runFile"
}

& $pythonExe $runFile
