param(
  [string]$Repository = (Get-Location).Path
)

$clone = Join-Path $env:TEMP ("concourse-clean-" + [guid]::NewGuid())

try {
  git clone --no-local $Repository $clone
  if ($LASTEXITCODE -ne 0) { throw 'Clean-clone creation failed.' }

  Push-Location $clone
  try {
    npm ci
    if ($LASTEXITCODE -ne 0) { throw 'Clean-clone npm ci failed.' }

    npm run format:check
    if ($LASTEXITCODE -ne 0) { throw 'Clean-clone format check failed.' }

    npm run typecheck
    if ($LASTEXITCODE -ne 0) { throw 'Clean-clone typecheck failed.' }

    npm run lint
    if ($LASTEXITCODE -ne 0) { throw 'Clean-clone lint failed.' }

    npm run test
    if ($LASTEXITCODE -ne 0) { throw 'Clean-clone test failed.' }

    npm run build
    if ($LASTEXITCODE -ne 0) { throw 'Clean-clone build failed.' }

    $externalLinks = @(rg -n --glob '!**/node_modules/**' --glob '!**/dist/**' 'file:\.\./learning-pack-(contracts|sdk)' package.json package-lock.json packages)
    if ($LASTEXITCODE -gt 1) { throw 'Unable to check clean-clone package links.' }
    if ($externalLinks.Count -gt 0) {
      $externalLinks | Write-Output
      throw 'Clean clone retains an external learning-pack sibling dependency.'
    }
  } finally {
    Pop-Location
  }
} finally {
  if (Test-Path -LiteralPath $clone) {
    Remove-Item -LiteralPath $clone -Recurse -Force
  }
}
