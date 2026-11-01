#!/usr/bin/env bash
#
# Gera a keystore de release do Reta FORA do repositório.
#
# Uso:
#   ./scripts/gerar-keystore.sh
#   ./scripts/gerar-keystore.sh --path ~/.reta/reta-release.jks --alias reta
#
# Padrões:
#   keystore: $HOME/.reta/reta-release.jks
#   alias:    reta
#
# As senhas são pedidas interativamente (nunca ficam no script, no histórico do
# shell nem no repositório). O arquivo existente NÃO é sobrescrito.
#
# Requer o `keytool` no PATH (vem com o JDK; no Windows, também com o Android
# Studio em ...\Android Studio\jbr\bin).

set -euo pipefail

DEFAULT_KEYSTORE="$HOME/.reta/reta-release.jks"
DEFAULT_ALIAS="reta"

KEYSTORE="${RETA_KEYSTORE_PATH:-$DEFAULT_KEYSTORE}"
ALIAS="${RETA_KEY_ALIAS:-$DEFAULT_ALIAS}"
DNAME="${RETA_KEYSTORE_DNAME:-CN=Reta, OU=Reta, O=Reta, L=Sao Paulo, ST=SP, C=BR}"
VALIDITY_DAYS="${RETA_KEYSTORE_VALIDITY:-10000}"

uso() {
  cat <<'EOF'
Gera a keystore de release do Reta (fora do repositório).

Uso: scripts/gerar-keystore.sh [opções]

Opções:
  -p, --path <arquivo>   Caminho da keystore (padrão: $HOME/.reta/reta-release.jks)
  -a, --alias <nome>     Alias da chave (padrão: reta)
  -h, --help             Mostra esta ajuda

Variáveis opcionais:
  RETA_KEYSTORE_DNAME     Nome distinguido X.500 (padrão: CN=Reta, ...)
  RETA_KEYSTORE_VALIDITY  Validade em dias (padrão: 10000)

As senhas são pedidas na hora. A keystore nunca é sobrescrita.
EOF
}

erro() {
  printf 'erro: %s\n' "$1" >&2
  exit 1
}

# Expande um "~/..." inicial (o shell não expande ~ vindo de variável).
case "$KEYSTORE" in
  "~/"*) KEYSTORE="$HOME/${KEYSTORE#\~/}" ;;
  "~") KEYSTORE="$HOME" ;;
esac

while [[ $# -gt 0 ]]; do
  case "$1" in
    -p|--path|--keystore)
      [[ $# -ge 2 ]] || erro "faltou o valor de $1"
      KEYSTORE="$2"
      shift 2
      ;;
    -a|--alias)
      [[ $# -ge 2 ]] || erro "faltou o valor de $1"
      ALIAS="$2"
      shift 2
      ;;
    -h|--help)
      uso
      exit 0
      ;;
    *)
      printf 'erro: opção desconhecida: %s\n\n' "$1" >&2
      uso >&2
      exit 2
      ;;
  esac
done

case "$KEYSTORE" in
  "~/"*) KEYSTORE="$HOME/${KEYSTORE#\~/}" ;;
esac

[[ -n "$ALIAS" ]] || erro "o alias não pode ser vazio"
[[ "$VALIDITY_DAYS" =~ ^[0-9]+$ ]] || erro "RETA_KEYSTORE_VALIDITY deve ser um número de dias"

command -v keytool >/dev/null 2>&1 || erro "keytool não encontrado no PATH. Instale um JDK 21 ou use o JDK do Android Studio."

if [[ -e "$KEYSTORE" ]]; then
  erro "já existe um arquivo em '$KEYSTORE'. Não vou sobrescrever: apague-o ou escolha outro caminho com --path."
fi

[[ -t 0 ]] || erro "este script precisa de um terminal interativo para pedir as senhas."

KEYSTORE_DIR="$(dirname "$KEYSTORE")"
mkdir -p "$KEYSTORE_DIR"
chmod 700 "$KEYSTORE_DIR" 2>/dev/null || true

printf 'Keystore: %s\n' "$KEYSTORE"
printf 'Alias:    %s\n\n' "$ALIAS"

STORE_PASS=""
STORE_PASS_CONFIRM=""
KEY_PASS=""

while :; do
  read -r -s -p "Senha da keystore (mínimo 6 caracteres): " STORE_PASS
  printf '\n'
  if [[ ${#STORE_PASS} -lt 6 ]]; then
    printf 'A senha precisa ter pelo menos 6 caracteres. Tente de novo.\n'
    continue
  fi
  read -r -s -p "Repita a senha da keystore: " STORE_PASS_CONFIRM
  printf '\n'
  if [[ "$STORE_PASS" != "$STORE_PASS_CONFIRM" ]]; then
    printf 'As senhas não conferem. Tente de novo.\n'
    continue
  fi
  break
done

printf '\n'
read -r -s -p "Senha da chave (Enter para usar a mesma da keystore): " KEY_PASS
printf '\n'
if [[ -z "$KEY_PASS" ]]; then
  KEY_PASS="$STORE_PASS"
elif [[ ${#KEY_PASS} -lt 6 ]]; then
  erro "a senha da chave precisa ter pelo menos 6 caracteres"
fi

# PKCS12 (formato moderno) exige a mesma senha para a keystore e para a chave.
# Se forem diferentes, usamos JKS, que aceita senhas distintas.
STORE_TYPE="PKCS12"
if [[ "$KEY_PASS" != "$STORE_PASS" ]]; then
  STORE_TYPE="JKS"
  printf 'Aviso: senhas diferentes para keystore e chave exigem o formato JKS (legado).\n'
fi

printf '\nGerando keystore...\n'

if ! RETA_KS_PASS_TMP="$STORE_PASS" RETA_KEY_PASS_TMP="$KEY_PASS" \
  keytool -genkeypair \
    -keystore "$KEYSTORE" \
    -storetype "$STORE_TYPE" \
    -alias "$ALIAS" \
    -keyalg RSA \
    -keysize 2048 \
    -validity "$VALIDITY_DAYS" \
    -dname "$DNAME" \
    -storepass:env RETA_KS_PASS_TMP \
    -keypass:env RETA_KEY_PASS_TMP
then
  rm -f "$KEYSTORE"
  erro "o keytool falhou; nenhum arquivo foi mantido."
fi

chmod 600 "$KEYSTORE" 2>/dev/null || true

# Confere que a keystore abre com a senha informada.
if ! RETA_KS_PASS_TMP="$STORE_PASS" \
  keytool -list -keystore "$KEYSTORE" -storepass:env RETA_KS_PASS_TMP >/dev/null 2>&1
then
  erro "a keystore foi criada, mas não abre com a senha informada. Verifique antes de usar."
fi

printf '\nKeystore criada com sucesso.\n\n'
printf 'Guarde o arquivo, o alias e as senhas. Sem eles não dá para atualizar o app publicado.\n\n'

esc() {
  # Escapa para uso entre aspas simples no shell.
  printf "%s" "$1" | sed "s/'/'\\\\''/g"
}

cat <<EOF
Defina estas variáveis no terminal antes de rodar o Gradle:

export RETA_KEYSTORE_PATH='$(esc "$KEYSTORE")'
export RETA_KEYSTORE_PASSWORD='$(esc "$STORE_PASS")'
export RETA_KEY_ALIAS='$(esc "$ALIAS")'
export RETA_KEY_PASSWORD='$(esc "$KEY_PASS")'

Alternativa: crie android/keystore.properties (ignorado pelo git) com
storeFile, storePassword, keyAlias e keyPassword.

Atenção: a saída acima contém as senhas. Não cole em chats, issues ou logs.
Faça backup da keystore e das senhas em local seguro, fora do repositório.
EOF
