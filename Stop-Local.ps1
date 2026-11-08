$ErrorActionPreference = 'Stop'
$recordPath = Join-Path $PSScriptRoot '.local-server/process.json'
if (-not (Test-Path -LiteralPath $recordPath)) { Write-Output 'MealCheck local chưa chạy.'; exit 0 }
$record = Get-Content -LiteralPath $recordPath -Raw | ConvertFrom-Json
$process = Get-Process -Id ([int]$record.pid) -ErrorAction SilentlyContinue
if ($process) {
  $expected = if ($record.startedUtcTicks) { [DateTime]::new([long]$record.startedUtcTicks,[DateTimeKind]::Utc) } elseif ($record.startedAt -is [DateTime]) { $record.startedAt.ToUniversalTime() } else { [DateTime]::Parse($record.startedAt,$null,[Globalization.DateTimeStyles]::RoundtripKind).ToUniversalTime() }
  if ([Math]::Abs(($process.StartTime.ToUniversalTime()-$expected).TotalSeconds) -gt 1) { throw 'PID đã thuộc tiến trình khác; từ chối dừng.' }
  & taskkill.exe /PID ([string]$record.pid) /T /F | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Không dừng được server local.' }
}
Remove-Item -LiteralPath $recordPath
Write-Output 'Đã dừng MealCheck local. Database được giữ nguyên.'
