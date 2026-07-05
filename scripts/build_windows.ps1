# scripts/build_windows.ps1
# Automates the build and signing process of WABS on Windows

# Force execute from the workspace root (parent directory of scripts/)
$scriptPath = $MyInvocation.MyCommand.Path
$scriptDir = Split-Path $scriptPath
$rootDir = Split-Path $scriptDir
Set-Location $rootDir

Write-Host "Starting build from workspace root: $rootDir" -ForegroundColor Cyan

# 1. Build React Frontend
Write-Host "--- 1. Building React Frontend ---" -ForegroundColor Yellow
if (Test-Path "frontend") {
    Set-Location frontend
    Write-Host "Running npm install..."
    npm install
    Write-Host "Running npm run build..."
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Error "npm run build failed. Aborting packaging."
        Set-Location ..
        exit 1
    }
    Set-Location ..
} else {
    Write-Error "frontend directory not found. Cannot build frontend assets."
    exit 1
}

# 2. Package with PyInstaller
Write-Host "`n--- 2. Packaging executable with PyInstaller ---" -ForegroundColor Yellow
if (Test-Path "WABS-Windows.exe.spec") {
    $pyinstallerCmd = "pyinstaller"
    $venvPyInstaller = Join-Path $rootDir "venv\Scripts\pyinstaller.exe"
    if (Test-Path $venvPyInstaller) {
        Write-Host "Using virtual environment PyInstaller: $venvPyInstaller" -ForegroundColor Green
        $pyinstallerCmd = $venvPyInstaller
    } else {
        Write-Host "No local virtual environment PyInstaller found. Using system pyinstaller." -ForegroundColor Cyan
    }
    
    if (Test-Path "build") {
        Write-Host "Cleaning existing build cache directory..." -ForegroundColor Cyan
        Remove-Item -Recurse -Force build
    }
    
    & $pyinstallerCmd --clean WABS-Windows.exe.spec
} else {
    Write-Error "WABS-Windows.exe.spec not found."
    exit 1
}

# 3. Code Sign if certificate details are provided
Write-Host "`n--- 3. Checking for Code Signing ---" -ForegroundColor Yellow
$exePath = "dist\WABS-Windows.exe"

if (Test-Path $exePath) {
    $certPath = $env:SIGNING_CERT_PATH
    $certPassword = $env:SIGNING_CERT_PASSWORD
    $tempCertUsed = $false
    
    # Check if base64 certificate data is present (e.g. from environment variables)
    if ($env:SIGNING_CERT_BASE64) {
        Write-Host "Base64 certificate data detected. Decoding to temporary PFX file..." -ForegroundColor Cyan
        $certPath = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), [System.IO.Path]::GetRandomFileName() + ".pfx")
        [System.IO.File]::WriteAllBytes($certPath, [System.Convert]::FromBase64String($env:SIGNING_CERT_BASE64))
        $tempCertUsed = $true
    }

    if ($certPath -and (Test-Path $certPath)) {
        Write-Host "Locating signtool.exe in Windows Kits..." -ForegroundColor Cyan
        # Look for signtool.exe in the standard Windows SDK paths
        $sdkPaths = @("C:\Program Files (x86)\Windows Kits")
        $signtool = (Get-ChildItem -Path $sdkPaths -Filter "signtool.exe" -Recurse -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName

        if ($signtool) {
            Write-Host "Found signtool.exe at: $signtool" -ForegroundColor Green
            Write-Host "Signing executable: $exePath" -ForegroundColor Cyan
            
            $args = @("sign", "/f", $certPath)
            if ($certPassword) {
                $args += @("/p", $certPassword)
            }
            # Append RFC 3161 timestamp server configuration
            $args += @("/tr", "http://timestamp.digicert.com", "/td", "sha256", "/fd", "sha256", $exePath)
            
            & $signtool $args
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "Successfully signed binary: $exePath" -ForegroundColor Green
            } else {
                Write-Error "signtool failed to sign the binary with exit code $LASTEXITCODE."
            }
        } else {
            Write-Warning "signtool.exe not found in Windows Kits paths ($sdkPaths). Executable remains unsigned."
        }
        
        # Clean up temporary certificate file
        if ($tempCertUsed -and (Test-Path $certPath)) {
            Write-Host "Cleaning up temporary certificate file..." -ForegroundColor Cyan
            Remove-Item $certPath -Force
        }
    } else {
        Write-Host "No valid signing certificate or base64 data provided. Skipping code signing. Executable remains unsigned." -ForegroundColor Yellow
        Write-Host "To sign, set environment variables SIGNING_CERT_PATH and SIGNING_CERT_PASSWORD, or SIGNING_CERT_BASE64."
    }
} else {
    Write-Error "Built executable was not found at $exePath."
    exit 1
}

Write-Host "`nBuild process finished!" -ForegroundColor Green
