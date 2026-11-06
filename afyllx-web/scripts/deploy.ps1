# Build the AFYLLX brand website and deploy only the static `afyllx-web` Worker.
# The `my-website` Worker (which owns afyllx.com) is not touched.
$ErrorActionPreference = 'Stop'
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { $node = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' }
$env:PATH = (Split-Path $node) + ';' + $env:PATH
$web = Split-Path -Parent $PSScriptRoot
$root = Split-Path -Parent $web

Push-Location $web
try {
  & $node node_modules\astro\bin\astro.mjs build
  if ($LASTEXITCODE) { throw "astro build failed ($LASTEXITCODE)" }
} finally { Pop-Location }

Push-Location $root
try {
  & $node scripts/cli.mjs wrangler deploy --config afyllx-web/wrangler.jsonc
  if ($LASTEXITCODE) { throw "wrangler deploy failed ($LASTEXITCODE)" }
} finally { Pop-Location }
