# Instalar o Reta no celular Android

Guia de ponta a ponta, do zero até o APK de release instalado por USB.

> **Antes de tudo: faça backup da keystore e das senhas.** O arquivo `.jks` e a
> senha são a identidade do app. Se você perder os dois, não consegue mais
> atualizar o Reta já instalado — seria preciso desinstalar e publicar um app
> novo. Guarde uma cópia fora do repositório (pen drive, gerenciador de senhas,
> backup na nuvem) e **nunca** comite a keystore nem as senhas.

---

## 1. O que você precisa

- **Node.js 22+** e as dependências do projeto instaladas (`npm install`).
- **JDK 21** (o Android Studio já traz um).
- **Android SDK** com *platform-tools* (para o `adb`) e a plataforma que o
  Gradle baixa sozinho.
- Um **celular Android** com cabo USB que transmita dados (não serve cabo só
  de carga).

---

## 2. Preparar o celular

1. Abra **Configurações → Sobre o telefone**.
2. Toque **7 vezes** em **Número da versão** (em alguns aparelhos fica em
   *Sobre o telefone → Informações do software*). Aparece "Você agora é um
   desenvolvedor".
3. Volte e abra **Configurações → Sistema → Opções do desenvolvedor**
   (em Samsung: *Configurações → Sobre o telefone → Informações do software*;
   o menu pode mudar de nome conforme a marca).
4. Ative **Depuração USB**.
5. Conecte o celular ao PC. Quando aparecer **"Permitir depuração USB?"**,
   toque em **Permitir** (marque "Sempre permitir este computador").

> Se o aviso não aparecer, troque o cabo/porta USB, revise a opção de
> desenvolvedor e, no celular, use **Revogar autorizações de depuração USB** e
> reconecte.

---

## 3. Instalar o `adb` (platform-tools) no Windows

### Opção A — pelo Android Studio (recomendada)

1. Abra o Android Studio → **More Actions → SDK Manager** (ou
   *File → Settings → Languages & Frameworks → Android SDK*).
2. Na aba **SDK Tools**, marque **Android SDK Platform-Tools** e clique em
   **Apply**.
3. Os arquivos ficam em `%LOCALAPPDATA%\Android\Sdk\platform-tools`
   (normalmente `C:\Users\SEU_USUARIO\AppData\Local\Android\Sdk\platform-tools`).

### Opção B — pacote avulso

Baixe **Platform-Tools for Windows** em
<https://developer.android.com/studio/releases/platform-tools>, descompacte em
`C:\platform-tools` e use esse caminho.

### Colocar o `adb` no PATH

No PowerShell (ajuste o caminho se necessário):

```powershell
$pastaAdb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools"
[Environment]::SetEnvironmentVariable(
  "Path",
  [Environment]::GetEnvironmentVariable("Path", "User") + ";$pastaAdb",
  "User"
)
```

Feche e reabra o terminal e confirme:

```powershell
adb version
```

Se aparecer a versão, está pronto. (Sem PATH, dá para chamar pelo caminho
completo: `& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" devices`.)

---

## 4. Gerar a keystore de release

A keystore fica **fora do repositório**, em
`%USERPROFILE%\.reta\reta-release.jks` (ex.: `C:\Users\Voce\.reta\reta-release.jks`),
com alias padrão `reta`.

No PowerShell, na raiz do projeto:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\gerar-keystore.ps1
```

O script:

- pede a **senha da keystore** (mínimo 6 caracteres, digitada duas vezes);
- pergunta a **senha da chave** — aperte **Enter** para usar a mesma;
- **recusa sobrescrever** um arquivo que já exista;
- cria a pasta `.reta` com permissão restrita;
- no fim, imprime as variáveis de ambiente já preenchidas.

Opções: `-KeystorePath D:\segredos\reta-release.jks` e `-Alias reta`.

> Em Linux/macOS existe o equivalente: `./scripts/gerar-keystore.sh`
> (padrão `$HOME/.reta/reta-release.jks`).

**Anote em local seguro:** caminho do arquivo, alias e a senha. Sem isso não há
como assinar uma atualização do app.

---

## 5. Definir as variáveis no PowerShell

Copie as linhas que o script imprimiu, ou defina manualmente:

```powershell
$env:RETA_KEYSTORE_PATH = "C:\Users\Voce\.reta\reta-release.jks"
$env:RETA_KEYSTORE_PASSWORD = "sua-senha-da-keystore"
$env:RETA_KEY_ALIAS = "reta"
$env:RETA_KEY_PASSWORD = "sua-senha-da-chave"
```

Isso vale **só na janela atual**. Para manter entre sessões:

```powershell
[Environment]::SetEnvironmentVariable("RETA_KEYSTORE_PATH", "C:\Users\Voce\.reta\reta-release.jks", "User")
[Environment]::SetEnvironmentVariable("RETA_KEY_ALIAS", "reta", "User")
```

(As senhas podem ficar só na sessão, digitadas a cada build — evita deixá-las
gravadas no perfil do Windows.)

### Alternativa: `android\keystore.properties`

Se preferir não usar variáveis de ambiente, crie
`android\keystore.properties` (já está no `.gitignore`):

```properties
storeFile=C:\\Users\\Voce\\.reta\\reta-release.jks
storePassword=sua-senha-da-keystore
keyAlias=reta
keyPassword=sua-senha-da-chave
```

O Gradle usa as variáveis de ambiente quando existem e cai para esse arquivo
quando faltam. **Sem as quatro informações e com o arquivo inexistente, o build
de release sai sem assinatura** (o Gradle só emite um aviso) — o build de debug
continua funcionando normalmente.

---

## 6. Gerar o build web e sincronizar com o Android

Na raiz do projeto:

```powershell
npm run build:cap
npx cap sync android
```

`npm run build:cap` é o "build" deste projeto para o Capacitor: ele gera
`dist-cap/client`, que é a pasta que o app nativo usa. (O `npm run build`
comum gera `dist/`, voltado para a web/Vercel, e não alimenta o APK.)

---

## 7. Gerar o APK de release

```powershell
cd android
.\gradlew.bat assembleRelease
```

O primeiro build baixa dependências e pode demorar alguns minutos.

APK gerado em:

```
android\app\build\outputs\apk\release\app-release.apk
```

> Se preferir testar rápido sem assinar, use `.\gradlew.bat assembleDebug` e o
> APK sai em `android\app\build\outputs\apk\debug\app-debug.apk`.

---

## 8. Instalar no celular

Com o celular conectado e a depuração USB autorizada:

```powershell
adb devices
```

Deve aparecer o aparelho com o status `device` (se aparecer `unauthorized`,
aceite o aviso no celular; se não aparecer nada, revise cabo/opções de
desenvolvedor).

Instale (ou reinstale por cima):

```powershell
adb install -r .\app\build\outputs\apk\release\app-release.apk
```

Se você estiver na raiz do projeto, use o caminho completo:

```powershell
adb install -r .\android\app\build\outputs\apk\release\app-release.apk
```

Pronto: o Reta abre no celular, offline, com os dados no próprio aparelho.

---

## 9. Atualizações futuras

1. Aumente `versionCode` (e, se quiser, `versionName`) em
   `android/app/build.gradle`.
2. Rode de novo `npm run build:cap`, `npx cap sync android` e
   `.\gradlew.bat assembleRelease`.
3. Instale com `adb install -r ...` usando **a mesma keystore e as mesmas
   senhas** — só assim o Android aceita a atualização por cima.

---

## 10. Problemas comuns

| Mensagem / sintoma | Causa provável | Solução |
| --- | --- | --- |
| `INSTALL_FAILED_UPDATE_INCOMPATIBLE` ou "assinaturas não correspondem" | O app instalado foi assinado com outra keystore (ex.: APK de debug, ou keystore perdida) | **Desinstale o app** (`adb uninstall com.guilhermelramos.reta`) e instale de novo. Isso apaga os dados locais do app. |
| `INSTALL_FAILED_VERSION_DOWNGRADE` | `versionCode` do APK é menor que o instalado | Aumente `versionCode` em `android/app/build.gradle` e gere outro APK. |
| `adb: command not found` / `adb não é reconhecido` | platform-tools fora do PATH | Use o caminho completo do `adb.exe` ou refaça o passo 3 e reabra o terminal. |
| `adb devices` mostra `unauthorized` | O celular não autorizou o PC | Aceite "Permitir depuração USB" na tela do celular (ou revogue as autorizações e reconecte). |
| `adb devices` vazio | Cabo só de carga, porta USB ruim ou depuração desligada | Troque o cabo/porta e confira as opções de desenvolvedor. |
| `more than one device/emulator` | Há mais de um aparelho conectado | Rode `adb devices` e use `adb -s SERIAL install -r ...`. |
| `gradlew.bat não é reconhecido` | Você não está na pasta `android` | `cd android` antes de rodar. |
| `Unsupported class file major version` / erro de Java | JDK diferente de 21 | Instale o JDK 21 e aponte `JAVA_HOME` para ele (ou use o JDK do Android Studio). |
| `keytool não encontrado` | JDK fora do PATH | Instale o JDK 21 ou chame o `keytool` do Android Studio (`...\Android Studio\jbr\bin`). |
| `Keystore was tampered with, or password was incorrect` | Senha errada ou arquivo corrompido | Confira a senha; restaure a keystore do backup. Sem backup, será preciso desinstalar o app e usar uma keystore nova. |
| Release gerado sem assinatura | Faltou alguma variável ou o caminho não existe | Confira as quatro variáveis (passo 5); o Gradle mostra um aviso no build. |

---

## Resumo rápido

```powershell
# 1. keystore (uma vez só, fora do repo)
powershell -ExecutionPolicy Bypass -File .\scripts\gerar-keystore.ps1

# 2. variáveis (na janela atual)
$env:RETA_KEYSTORE_PATH = "C:\Users\Voce\.reta\reta-release.jks"
$env:RETA_KEYSTORE_PASSWORD = "..."
$env:RETA_KEY_ALIAS = "reta"
$env:RETA_KEY_PASSWORD = "..."

# 3. build + sync
npm run build:cap
npx cap sync android

# 4. APK de release
cd android
.\gradlew.bat assembleRelease

# 5. instalar
adb devices
adb install -r .\app\build\outputs\apk\release\app-release.apk
```

**Backup da keystore e das senhas: faça agora, não depois.**
