<#
This is a small command line tool to check for connectivity 
to use Andrew's Website, usage:

./test_connection.ps1
#>

param(
    [string]$InternetIp = "8.8.8.8",
    [string]$InternetUrl = "www.google.com",
    [string]$GithubAddr = "github.com",
    [string]$WebsiteAddr = "https://29miaoet.github.io/Andrew_WebPage",
    [string]$SshHost = "git@github.com",
    [string]$HttpsRepo = "https://github.com/octocat/Hello-World.git"
)

try {
    ping -n 4 $InternetIp *> $null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Connected to internet." -ForegroundColor Green
    } else {
        Write-Host "❌ Cannot reach internet." -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Cannot reach internet." -ForegroundColor Red
}

try {
    ping -n 4 $InternetUrl *> $null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Domain names resolve correctly." -ForegroundColor Green
    } else {
        Write-Host "❌ Domain names do not resolve." -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Domain names do not resolve." -ForegroundColor Red
}


try {
    ping -n 4 $GithubAddr *> $null
    if ($lastexitcode -eq 0) {
        Write-host "✅ Github is reachable." -foregroundcolor green
    } else {
        Write-host "❌ Cannot connect to github." -foregroundcolor red
    }
} catch {
    Write-host "❌ Cannot connect to github." -foregroundcolor red
}

try {
    curl -s $WebsiteAddr *> $null
    if ($lastexitcode -eq 0) {
        write-host "✅ Andrew's Website is reachable." -foregroundcolor green
    } else {
        write-host "❌ Cannot connect to Andrew's Website." -foregroundcolor red
    }
} catch {
    write-host "❌ Cannot connect to Andrew's Website." -foregroundcolor red
}

try {
    ssh -T -o BatchMode=yes -o ConnectTimeout=5 $SshHost *> $null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Git is reachable through SSH." -ForegroundColor Green
    } else {
        Write-Host "⚠️ Cannot connect to git through SSH." -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️ Cannot connect to git through SSH." -ForegroundColor Yellow
}


$env:GIT_TERMINAL_PROMPT = "0"

try {
    git ls-remote $HttpsRepo *> $null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Git is reachable through HTTPS." -ForegroundColor Green
    } else {
        Write-Host "❌ Cannot connect to git through HTTPS." -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Cannot connect to git through HTTPS." -ForegroundColor Red
} finally {
    Remove-Item Env:GIT_TERMINAL_PROMPT -ErrorAction SilentlyContinue
}

