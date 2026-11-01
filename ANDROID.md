# Android (Capacitor)

Empacotamento do Reta como app Android via Capacitor **8.6.0**
(`@capacitor/core`, `@capacitor/cli`, `@capacitor/android`).
O app web/Vercel continua igual: nada aqui altera o build de produção da web.

## Estrutura

| Item | Valor |
| --- | --- |
| `appId` | `com.guilhermelramos.reta` |
| `appName` | `Reta` |
| `webDir` | `dist-cap/client` (saída do build SPA) |
| `androidScheme` | `https` (origem `https://localhost` no WebView) |
| Config | [`capacitor.config.ts`](./capacitor.config.ts) |
| Projeto nativo | [`android/`](./android) (gerado por `npx cap add android`) |

## Build

```bash
# 1. Build estático SPA (CAP_BUILD=1 ativa o modo SPA do TanStack Start)
npm run build:cap

# 2. Copia o build para o projeto Android
npx cap sync android

# 3. Gera o APK de debug
cd android && ./gradlew assembleDebug --no-daemon -Dorg.gradle.jvmargs=-Xmx1536m
```

APK gerado em: `android/app/build/outputs/apk/debug/app-debug.apk`.

`npm run build:cap` produz:

- `dist-cap/client/` — HTML + JS + CSS + assets estáticos (o que o Capacitor usa);
- `dist-cap/server/` — usado só para pré-renderizar o shell; **não** vai para o APK.

### Como o modo SPA funciona

- `vite.config.ts` lê `CAP_BUILD=1` e liga `tanstackStart({ spa: { enabled: true } })`.
- O shell é pré-renderizado para `dist-cap/client/index.html`; o roteador do
  TanStack Router assume a navegação no cliente. Com isso o app abre sem Node.
- O plugin do Nitro (preset `vercel`) **não** é carregado nesse modo.
- `dist-cap` é um diretório separado de `dist/`, então o build web/Vercel não é
  tocado.
- `scripts/cap-postbuild.mjs` corrige o `<link rel="stylesheet">` do shell para
  o CSS que o build do cliente realmente emitiu (os hashes do ambiente SSR e do
  cliente divergem) e falha se algum asset referenciado não existir.

## IA no APK (cliente xAI)

O APK é 100% estático: não existe servidor Node, Nitro, banco de dados nem
rotas de API. Os fluxos de IA têm dois caminhos, escolhidos em
[`src/lib/ai/xai-client.ts`](./src/lib/ai/xai-client.ts):

| Ambiente | Transporte |
| --- | --- |
| Web/Vercel | server functions (`/lib/ai/*.functions.ts`) e `POST /api/professor` |
| Android (`Capacitor.isNativePlatform()`) | xAI direto pelo `CapacitorHttp`, com a chave do cofre seguro |

O prompt, o parse/validação zod e a sanitização de SVG são os mesmos nos dois
caminhos (`src/lib/ai/prompts.ts`, `parse.ts`, `block-package.ts`, `study/svg.ts`
e `core.ts`). Assim o pacote gerado no APK não diverge do gerado na web.

O `CapacitorHttp` está ligado em [`capacitor.config.ts`](./capacitor.config.ts).
No APK a chave vem de [`src/lib/secure/keys.ts`](./src/lib/secure/keys.ts)
(Keystore); `XAI_API_KEY` do ambiente só existe no servidor da web. Sem chave
no aparelho, a IA responde com uma mensagem pedindo para preencher Ajustes — o
resto do app continua funcionando.

**Chat do professor sem stream no APK:** `CapacitorHttp` não entrega SSE. No
nativo a chamada usa `stream: false` e a resposta completa chega de uma vez; a
UI aplica o mesmo `present()` (status DENTRO/FORA, citação e SVG). Na web o
streaming continua igual. O tempo de espera é o mesmo; só não há texto
aparecendo letra a letra.

Os pesquisadores Perplexity, Gemini e Claude também funcionam no APK pelo
mesmo `CapacitorHttp` (APIs oficiais já usadas no servidor). Se um provedor
recusar a chamada, aparece o erro tratado — nunca um crash.

Erros são traduzidos em português em [`src/lib/ai/errors.ts`](./src/lib/ai/errors.ts):
sem internet (`navigator.onLine === false` ou falha de rede), 401/403 (chave
recusada), 429 (limite da API, respeitando `Retry-After`), 5xx (indisponível) e
timeout. O botão **Testar conexão** de Ajustes sempre sai de "Testando…", mesmo
quando a chamada falha antes de responder.

O que continua dependendo de servidor no APK:

| Fluxo | Onde | Depende de |
| --- | --- | --- |
| Connectors (calendar, mail, etc.) | `getConnectorReadiness` em `src/lib/app-data/readiness.ts` | server function + gate |
| Login/sessão Better Auth | `/api/auth/*` | rotas de servidor (hoje o app não usa gate de login na UI) |
| Banco Postgres | `@/lib/db` | servidor (o app nativo usa IndexedDB) |

O resto do app (plano, sessões, timer, erros, progresso, ajustes, IndexedDB)
funciona offline. Pacotes já gerados ficam salvos no aparelho.


## Chaves de API (armazenamento seguro)

As chaves dos pesquisadores (xAI, Perplexity, Gemini e Claude) **não** ficam
mais em texto puro no IndexedDB no Android. O serviço
[`src/lib/secure/keys.ts`](./src/lib/secure/keys.ts) concentra get/set/remove:

| Plataforma | Onde a chave fica |
| --- | --- |
| Android (`Capacitor.isNativePlatform()`) | `@aparajita/capacitor-secure-storage` 8.x: AES-GCM com chave do **Android Keystore**, guardada em SharedPreferences do app |
| Web / Vercel | fallback documentado: `settings.keys` no IndexedDB, como antes (o navegador não tem um Keystore equivalente) |

Na primeira abertura de uma versão nova no Android, `loadKeys()` migra
`settings.keys` do IndexedDB para o Keystore e apaga a cópia antiga. A migração
é idempotente: se a chave já estiver no cofre, o valor seguro é preservado e só
a cópia antiga sai. Se o plugin nativo falhar, as chaves antigas são mantidas
nesta execução e a migração tenta de novo na próxima abertura (nenhuma chave é
perdida).

O backup `.json` (`exportAll`) **nunca inclui chaves**: o campo `keys` é
removido dos ajustes e da cópia da store `meta`. Restaurar um backup também
ignora qualquer `keys` que exista em arquivos antigos.

No aparelho ainda é preciso validar o Keystore de verdade (criar/ler/apagar a
chave e a migração de uma instalação antiga). O emulador deste ambiente não
sobe, então o WebView foi exercitado com o mesmo bundle do APK.

## Ambiente Android

Requer JDK 21 e Android SDK com **platform 36** e **build-tools 35+**
(Capacitor 8 compila com `compileSdk 36`). O Gradle baixa a platform 36 se ela
não estiver instalada e as licenças estiverem aceitas.

## Arquivos ignorados

`dist-cap/`, `android/.gradle/`, `android/build/`, `android/app/build/`,
`android/local.properties` e os assets copiados
(`android/app/src/main/assets/public/`) não entram no git — o APK é regenerado
com os comandos acima. `.env.example` traz só um placeholder de `XAI_API_KEY`.
