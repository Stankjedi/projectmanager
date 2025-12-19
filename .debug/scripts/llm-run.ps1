<# 
목적:
- 긴 빌드/테스트 로그에서 "에러/예외/실패" 라인만 우선 추출해 에이전트가 빠르게 원인 파악하도록 돕는다.

사용법:
- powershell -ExecutionPolicy Bypass -File .debug/scripts/llm-run.ps1 "npm run build"
#>

param(
  [Parameter(Mandatory=$true)]
  [string]$Cmd
)

$ErrorActionPreference = "Continue"

# 1) 명령 실행 + 전체 로그 캡처
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$logPath = ".debug\logs\$stamp.log"
New-Item -ItemType Directory -Force -Path ".debug\logs" | Out-Null

Write-Host "== RUN ==" 
Write-Host $Cmd

cmd.exe /c "$Cmd" 2>&1 | Tee-Object -FilePath $logPath | Out-Host

Write-Host "`n== LOG SAVED ==" 
Write-Host $logPath

# 2) 에러 후보 라인 추출
Write-Host "`n== ERROR HIGHLIGHTS (keyword scan) =="
Select-String -Path $logPath -Pattern `
  "error","failed","exception","traceback","fatal","undefined","cannot","not found","E[0-9]+","TS[0-9]+" `
  -SimpleMatch | Select-Object -First 120 | ForEach-Object { $_.Line }

# 3) 마지막 200줄(컨텍스트)
Write-Host "`n== TAIL 200 =="
Get-Content $logPath -Tail 200
