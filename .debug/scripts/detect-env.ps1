<#
.SYNOPSIS
    Detects the current development environment
.DESCRIPTION
    Collects version information for common development tools
#>

$env = @{
    os = [System.Environment]::OSVersion.Platform.ToString()
    os_version = [System.Environment]::OSVersion.VersionString
    shell = "PowerShell $($PSVersionTable.PSVersion.ToString())"
    node = $null
    npm = $null
    pnpm = $null
    python = $null
    git = $null
    vscode = $null
}

# Node.js
try { $env.node = (node --version 2>$null) -replace 'v','' } catch {}

# npm
try { $env.npm = (npm --version 2>$null) } catch {}

# pnpm
try { $env.pnpm = (pnpm --version 2>$null) } catch {}

# Python
try { $env.python = (python --version 2>$null) -replace 'Python ','' } catch {}

# Git
try { $env.git = (git --version 2>$null) -replace 'git version ','' } catch {}

# VS Code
try { $env.vscode = (code --version 2>$null | Select-Object -First 1) } catch {}

$env | ConvertTo-Json -Depth 2
