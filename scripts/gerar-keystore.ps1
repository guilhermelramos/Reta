<#
.SYNOPSIS
    Gera a keystore de release do Reta FORA do repositório (Windows/PowerShell).

.DESCRIPTION
    Cria um keystore com o keytool, pedindo as senhas interativamente (elas não
    ficam no script, no histórico do PowerShell nem no repositório).
    O arquivo existente NÃO é sobrescrito.

    Padrões:
      keystore: %USERPROFILE%\.reta\reta-release.jks
      alias:    reta

.PARAMETER KeystorePath
    Caminho do arquivo .jks (padrão: $env:USERPROFILE\.reta\reta-release.jks).

.PARAMETER Alias
    Alias da chave (padrão: reta).

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\scripts\gerar-keystore.ps1

.EXAMPLE
    .\scripts\gerar-keystore.ps1 -KeystorePath D:\segredos\reta-release.jks
#>
[CmdletBinding()]
param(
    [Alias("Path")]
    [string]$KeystorePath = "",

    [string]$Alias = "reta",

    [string]$Dname = "CN=Reta, OU=Reta, O=Reta, L=Sao Paulo, ST=SP, C=BR",

    [int]$ValidityDays = 10000
)

$ErrorActionPreference = "Stop"

function Write-Erro([string]$Mensagem) {
    Write-Host "erro: $Mensagem" -ForegroundColor Red
    exit 1
}

function Read-Senha([string]$Prompt) {
    $segura = Read-Host -Prompt $Prompt -AsSecureString
    $ponteiro = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($segura)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ponteiro)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ponteiro)
    }
}

function Format-PSString([string]$Valor) {
    return "'" + $Valor.Replace("'", "''") + "'"
}

if ([string]::IsNullOrWhiteSpace($KeystorePath)) {
    if ([string]::IsNullOrWhiteSpace($env:USERPROFILE)) {
        Write-Erro "USERPROFILE não está definido. Informe o caminho com -KeystorePath."
    }
    $KeystorePath = Join-Path $env:USERPROFILE ".reta\reta-release.jks"
}

$KeystorePath = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($KeystorePath)

if ([string]::IsNullOrWhiteSpace($Alias)) {
    Write-Erro "o alias não pode ser vazio."
}

if ($ValidityDays -lt 1) {
    Write-Erro "ValidityDays deve ser um número positivo de dias."
}

$keytool = Get-Command keytool -ErrorAction SilentlyContinue
if (-not $keytool) {
    Write-Erro "keytool não encontrado no PATH. Instale um JDK 21 ou use o JDK do Android Studio (File > Settings > Build > Gradle > Gradle JDK)."
}

if (Test-Path -LiteralPath $KeystorePath) {
    Write-Erro "já existe um arquivo em '$KeystorePath'. Não vou sobrescrever: apague-o ou escolha outro caminho com -KeystorePath."
}

$keystoreDir = Split-Path -Parent $KeystorePath
if (-not [string]::IsNullOrWhiteSpace($keystoreDir) -and -not (Test-Path -LiteralPath $keystoreDir)) {
    New-Item -ItemType Directory -Force -Path $keystoreDir | Out-Null
}

Write-Host "Keystore: $KeystorePath"
Write-Host "Alias:    $Alias"
Write-Host ""

$storePass = ""
$storePassConfirm = ""
$keyPass = ""

while ($true) {
    $storePass = Read-Senha "Senha da keystore (mínimo 6 caracteres)"
    Write-Host ""
    if ($storePass.Length -lt 6) {
        Write-Host "A senha precisa ter pelo menos 6 caracteres. Tente de novo."
        continue
    }

    $storePassConfirm = Read-Senha "Repita a senha da keystore"
    Write-Host ""
    if ($storePass -ne $storePassConfirm) {
        Write-Host "As senhas não conferem. Tente de novo."
        continue
    }
    break
}

Write-Host ""
$keyPass = Read-Senha "Senha da chave (Enter para usar a mesma da keystore)"
Write-Host ""
if ([string]::IsNullOrEmpty($keyPass)) {
    $keyPass = $storePass
}
elseif ($keyPass.Length -lt 6) {
    Write-Erro "a senha da chave precisa ter pelo menos 6 caracteres."
}

# PKCS12 (formato moderno) exige a mesma senha para keystore e chave.
# Se forem diferentes, usamos JKS, que aceita senhas distintas.
$storeType = "PKCS12"
if ($keyPass -ne $storePass) {
    $storeType = "JKS"
    Write-Host "Aviso: senhas diferentes para keystore e chave exigem o formato JKS (legado)." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Gerando keystore..."

$env:RETA_KS_PASS_TMP = $storePass
$env:RETA_KEY_PASS_TMP = $keyPass
try {
    & keytool -genkeypair `
        -keystore $KeystorePath `
        -storetype $storeType `
        -alias $Alias `
        -keyalg RSA `
        -keysize 2048 `
        -validity $ValidityDays `
        -dname $Dname `
        "-storepass:env" "RETA_KS_PASS_TMP" `
        "-keypass:env" "RETA_KEY_PASS_TMP"

    if ($LASTEXITCODE -ne 0) {
        if (Test-Path -LiteralPath $KeystorePath) {
            Remove-Item -LiteralPath $KeystorePath -Force -ErrorAction SilentlyContinue
        }
        Write-Erro "o keytool falhou; nenhum arquivo foi mantido."
    }

    # Confere que a keystore abre com a senha informada.
    & keytool -list -keystore $KeystorePath "-storepass:env" "RETA_KS_PASS_TMP" | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Erro "a keystore foi criada, mas não abre com a senha informada. Verifique antes de usar."
    }
}
finally {
    Remove-Item Env:RETA_KS_PASS_TMP -ErrorAction SilentlyContinue
    Remove-Item Env:RETA_KEY_PASS_TMP -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "Keystore criada com sucesso." -ForegroundColor Green
Write-Host ""
Write-Host "Guarde o arquivo, o alias e as senhas. Sem eles não dá para atualizar o app publicado."
Write-Host ""
Write-Host "Defina estas variáveis no PowerShell (valem só nesta janela):"
Write-Host ""
Write-Host ("`$env:RETA_KEYSTORE_PATH = " + (Format-PSString $KeystorePath))
Write-Host ("`$env:RETA_KEYSTORE_PASSWORD = " + (Format-PSString $storePass))
Write-Host ("`$env:RETA_KEY_ALIAS = " + (Format-PSString $Alias))
Write-Host ("`$env:RETA_KEY_PASSWORD = " + (Format-PSString $keyPass))
Write-Host ""
Write-Host "Para valer em novas janelas, use [Environment]::SetEnvironmentVariable('RETA_KEY_ALIAS', 'reta', 'User') etc."
Write-Host "Alternativa: crie android\keystore.properties (ignorado pelo git) com"
Write-Host "storeFile, storePassword, keyAlias e keyPassword."
Write-Host ""
Write-Host "Atenção: a saída acima contém as senhas. Não cole em chats, issues ou logs." -ForegroundColor Yellow
Write-Host "Faça backup da keystore e das senhas em local seguro, fora do repositório." -ForegroundColor Yellow
