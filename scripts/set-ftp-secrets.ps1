# Prepara secrets FTP no repo Amarelinho (mesmos nomes do snow).
# Uso: powershell -ExecutionPolicy Bypass -File scripts/set-ftp-secrets.ps1
# Não imprime a senha; valores vão só para GitHub Actions Secrets.

param(
  [string]$Repo = "dreadpiratejhonatan/amarelinho"
)

$ErrorActionPreference = "Stop"

Write-Host "Configurando secrets FTP em $Repo" -ForegroundColor Yellow
Write-Host "Use a conta FTP dedicada do Amarelinho (jail em public_html/amarelinho/)." -ForegroundColor DarkGray
Write-Host ""

$hostName = Read-Host "HOSTGATOR_FTP_HOST"
$user = Read-Host "HOSTGATOR_FTP_USER"
$passSecure = Read-Host "HOSTGATOR_FTP_PASSWORD" -AsSecureString
$dir = Read-Host "HOSTGATOR_FTP_DIR (ex: / ou ./ )"

$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($passSecure)
try {
  $pass = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}

if (-not $hostName -or -not $user -or -not $pass -or -not $dir) {
  Write-Host "Todos os campos sao obrigatorios." -ForegroundColor Red
  exit 1
}

$hostName | gh secret set HOSTGATOR_FTP_HOST -R $Repo
$user | gh secret set HOSTGATOR_FTP_USER -R $Repo
$pass | gh secret set HOSTGATOR_FTP_PASSWORD -R $Repo
$dir | gh secret set HOSTGATOR_FTP_DIR -R $Repo

Write-Host ""
Write-Host "OK — secrets gravados em $Repo" -ForegroundColor Green
Write-Host "Dispare: gh workflow run `"Deploy HostGator`" -R $Repo --ref develop"
