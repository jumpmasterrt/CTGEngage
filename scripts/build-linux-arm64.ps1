[CmdletBinding()]
param(
  [string]$OutputDirectory
)

$ErrorActionPreference = 'Stop'
$repositoryRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if (-not $OutputDirectory) {
  $OutputDirectory = Join-Path $repositoryRoot 'out\ctg-engage-linux-arm64'
}
$OutputDirectory = [IO.Path]::GetFullPath($OutputDirectory)
$repositoryPrefix = $repositoryRoot.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar

if (-not $OutputDirectory.StartsWith($repositoryPrefix, [StringComparison]::OrdinalIgnoreCase)) {
  throw "Output directory must remain inside $repositoryRoot"
}

Push-Location (Join-Path $repositoryRoot 'frontend')
try {
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) {
    throw "Frontend build failed with exit code $LASTEXITCODE"
  }
} finally {
  Pop-Location
}

if (Test-Path -LiteralPath $OutputDirectory) {
  Remove-Item -LiteralPath $OutputDirectory -Recurse -Force
}

$binDirectory = Join-Path $OutputDirectory 'bin'
$webDirectory = Join-Path $OutputDirectory 'www'
$systemdDirectory = Join-Path $OutputDirectory 'systemd'
New-Item -ItemType Directory -Path $binDirectory, $webDirectory, $systemdDirectory -Force | Out-Null
Copy-Item -Path (Join-Path $repositoryRoot 'frontend\dist\*') -Destination $webDirectory -Recurse -Force
Copy-Item -LiteralPath (Join-Path $repositoryRoot 'deploy\systemd\ctg-engage.service') -Destination $systemdDirectory
Copy-Item -LiteralPath (Join-Path $repositoryRoot 'deploy\install-expopi.sh') -Destination $OutputDirectory
Copy-Item -LiteralPath (Join-Path $repositoryRoot 'deploy\launch-kiosk.sh') -Destination $OutputDirectory
Copy-Item -LiteralPath (Join-Path $repositoryRoot 'deploy\configure-expopi-kiosk.sh') -Destination $OutputDirectory

$previousGoOS = $env:GOOS
$previousGoArch = $env:GOARCH
$previousCgoEnabled = $env:CGO_ENABLED
try {
  $env:GOOS = 'linux'
  $env:GOARCH = 'arm64'
  $env:CGO_ENABLED = '0'
  Push-Location (Join-Path $repositoryRoot 'backend')
  try {
    & go build -trimpath -ldflags '-s -w' -o (Join-Path $binDirectory 'ctg-engage') ./cmd/engage
    if ($LASTEXITCODE -ne 0) {
      throw "Backend build failed with exit code $LASTEXITCODE"
    }
  } finally {
    Pop-Location
  }
} finally {
  $env:GOOS = $previousGoOS
  $env:GOARCH = $previousGoArch
  $env:CGO_ENABLED = $previousCgoEnabled
}

Write-Host "ExpoPi package ready: $OutputDirectory"
