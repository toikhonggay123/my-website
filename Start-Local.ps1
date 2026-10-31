param([switch]$OpenBrowser)
$ErrorActionPreference = 'Stop'
$projectDir = $PSScriptRoot
$url = 'http://localhost:3000/quan-tri'
$stateDir = Join-Path $projectDir '.local-server'
$recordPath = Join-Path $stateDir 'process.json'
function Get-MealCheckHealth {
  try { $result = Invoke-RestMethod 'http://127.0.0.1:3000/api/health' -TimeoutSec 2; return ($result.app -eq 'AFYLLX MealCheck' -and $result.deployment -eq 'local') } catch { return $false }
}
if (Get-MealCheckHealth) { if ($OpenBrowser) { Start-Process $url }; Write-Output $url; exit 0 }
if (-not (Test-Path -LiteralPath (Join-Path $projectDir 'dist/server/wrangler.json'))) { throw 'Chưa có bản build. Chạy pnpm build trong thư mục dự án.' }
if (-not (Test-Path -LiteralPath (Join-Path $stateDir 'data-import.json'))) { throw 'Chưa khởi tạo database local; không tự nhập đè dữ liệu.' }
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$nodePath = if ($nodeCommand) { $nodeCommand.Source } else { Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' }
if (-not (Test-Path -LiteralPath $nodePath)) { throw 'Cần cài Node.js 22.22 trở lên.' }
New-Item -ItemType Directory -Force -Path $stateDir | Out-Null
$argsList = @('scripts/cli.mjs','wrangler','dev','--config','dist/server/wrangler.json','--env-file','.dev.vars','--local','--persist-to','.wrangler/local-state','--ip','127.0.0.1','--port','3000','--inspector-port','0')
$process = Start-Process -FilePath $nodePath -ArgumentList $argsList -WorkingDirectory $projectDir -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $stateDir 'server.stdout.log') -RedirectStandardError (Join-Path $stateDir 'server.stderr.log')
@{pid=$process.Id;startedAt=$process.StartTime.ToUniversalTime().ToString('o');startedUtcTicks=$process.StartTime.ToUniversalTime().Ticks;executable=$nodePath;url=$url} | ConvertTo-Json | Set-Content -LiteralPath $recordPath -Encoding UTF8
for ($attempt=0; $attempt -lt 80; $attempt++) {
  if (Get-MealCheckHealth) { if ($OpenBrowser) { Start-Process $url }; Write-Output $url; exit 0 }
  if ($process.HasExited) { throw 'Server chưa mở được. Xem .local-server/server.stderr.log và server.stdout.log.' }
  Start-Sleep -Milliseconds 250
}
throw 'Server chưa phản hồi. Xem log trong .local-server.'
