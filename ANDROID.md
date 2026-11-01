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

## Botão/gesto voltar (Android)

Implementado com `@capacitor/app` **8.1.2** (compatível com Capacitor 8).
O handler fica em [`src/components/android-back.tsx`](./src/components/android-back.tsx),
montado no layout do app ([`src/routes/_shell.tsx`](./src/routes/_shell.tsx)), e
só registra o listener no Android nativo — na web o navegador continua cuidando
do voltar.

Ordem de decisão (função pura em
[`src/lib/android/back-navigation.ts`](./src/lib/android/back-navigation.ts)):

1. **Overlay aberto** (gaveta do professor, gaveta "Anotar erro externo",
   imagem ampliada) → fecha o mais recente. A pilha fica em
   [`src/lib/android/back-overlays.ts`](./src/lib/android/back-overlays.ts) e
   cada overlay se registra com `useBackOverlay(open, onClose)`.
2. **Histórico do roteador** tem entrada anterior (`router.history.canGoBack()`)
   → volta uma entrada.
3. **Hoje sem histórico** → `App.minimizeApp()` em vez de fechar o app.
4. **Outra rota aberta sem histórico** (deep link) → vai para Hoje.

O cronômetro não é afetado por voltar/minimizar: a sessão ativa e o horário
real de início já estão no IndexedDB (`activeSession` + `runStartedAt`), e a
tela de sessão recalcula o tempo decorrido e retoma de onde parou.

Testes: `src/lib/android/back-navigation.test.ts`,
`src/lib/android/back-overlays.test.ts` e
`src/lib/study/time-timer.test.ts` (fazem parte de `npm test`).



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

### Estados de erro padronizados

[`src/lib/feedback/error-copy.ts`](./src/lib/feedback/error-copy.ts) converte o
erro em `{ title, message, detail, action, secondaryAction }` (testes em
`error-copy.test.ts`), e os componentes
[`InlineError`](./src/components/feedback/inline-error.tsx) (banner no cartão) e
[`ErrorState`](./src/components/feedback/error-state.tsx) (cartão cheio, ícone
48dp, botão de 48dp) mostram o mesmo texto na web e no APK. Textos e ações:

| Caso | Texto | Ação |
| --- | --- | --- |
| Offline | Você está offline. Pacotes baixados continuam funcionando. | Tentar de novo |
| 429 | Muitas perguntas seguidas. Aguarde ~1 min. | Tentar de novo com contagem (`Retry-After`, padrão 60 s) |
| 401/403 | Chave xAI inválida. | Atualizar chave → Ajustes |
| Permissão negada | Lembretes desativados. Você não vai receber aviso do timer. | Abrir configurações |
| Planilha | Não encontramos as colunas Data, Bloco A, Bloco B e Revisão. | Escolher outro arquivo / Baixar modelo |
| Bloco ausente | Esse bloco não existe mais no seu plano (talvez a planilha tenha mudado). | Ver plano de hoje |

O `AiResult` carrega `failure` (`kind`, status e `Retry-After`) para a UI não
perder a causa do erro. Todo pedido de IA usa **15 s** para conectar e para
responder nos fluxos curtos (teste de conexão, tutor e professor); a geração de
um pacote completo mantém um teto maior (90 s) para não cortar a aula no meio.

No Android, **Abrir configurações** usa o plugin
`capacitor-native-settings` 8.2.0 (`src/lib/native/settings.ts`), que abre a
tela de detalhes do app via intent do sistema. Na web a ação mostra a orientação
do navegador. A permissão de notificação é lida em
`src/lib/native/notifications.ts` (hoje a API web `Notification`; o WebView do
Android a reporta como indisponível).

A ação **Baixar modelo** e o **backup `.json`** de Ajustes gravam o arquivo no
cache do app (`@capacitor/filesystem` 8.1.5) e abrem o share sheet
(`@capacitor/share` 8.0.3) no APK; na web continua o Web Share / download do
navegador (`src/lib/native/files.ts`). Restaurar backup lê o `.json` pelo
seletor de arquivos do próprio WebView.

Para validar no aparelho: a tela de detalhes do app realmente abre, a permissão
de notificação corresponde ao estado do sistema e a contagem do 429 reinicia o
botão no tempo do `Retry-After`.

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

## Notificações locais

- `src/lib/study/notification-schedule.ts` calcula, de forma pura, os avisos
  dos próximos 7 dias com a mesma lógica/texto de `src/lib/study/notify.ts`
  (início, questões, revisão e bloco não iniciado).
- `src/lib/native/notifications.ts` entrega essa lista ao
  `@capacitor/local-notifications` (canais `estudo`, `questoes` e `timer`,
  `allowWhileIdle`, alarme exato quando autorizado e inexato como fallback).
  Na web o serviço é inerte: o comportamento antigo (Notification API +
  service worker) continua igual.
- O shell reagenda ao abrir/voltar ao app e quando o plano ou os ajustes
  mudam; o modo silencioso cancela os lembretes agendados.
- O botão “Permitir notificações” dos Ajustes pede `POST_NOTIFICATIONS` e,
  se preciso, abre a tela de alarmes exatos do Android.
- `BatteryOptimizationPlugin.java` expõe `isIgnoringBatteryOptimizations()` e
  `openBatteryOptimizationSettings()` (sem pedir
  `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`).
- Permissões no manifesto: `POST_NOTIFICATIONS`, `SCHEDULE_EXACT_ALARM` e
  `RECEIVE_BOOT_COMPLETED` (esta última restaura os alarmes após reiniciar).
- Entrega real em Doze, telas de permissão, reboot e otimização de bateria só
  podem ser validadas num aparelho.

## Timer com tela bloqueada

- O tempo continua derivado de `startedAt` + acumulado (`src/lib/study/time.ts`);
  o `setInterval` de `sessao.tsx` só redesenha. Nada de contar segundos em JS.
- Ao iniciar/retomar, `src/lib/study/timer-plan.ts` calcula o fim previsto
  (`endsAt`) e a sessão grava esse instante no IndexedDB. Pausar zera `endsAt`;
  encerrar/concluir também.
- `syncTimerNotifications` (em `src/lib/native/notifications.ts`) agenda o
  alarme do fim com `allowWhileIdle` no canal `timer` (título "Tempo do bloco
  acabou"). Se o Android negou alarmes exatos, o plugin agenda como **inexato**
  e o fallback fica registrado no console; `isExactNotification` só é `true`
  quando `checkExactNotificationSetting()` autorizou.
- Ao reabrir o app, o `endsAt` gravado é preservado se ainda estiver no futuro
  (o alarme é reagendado). Registros antigos sem `endsAt` derivam o fim de
  `startedAt` + acumulado. Se o fim já passou, nada é reagendado.
- A notificação persistente usa `ongoing: true` / `autoCancel: false` do
  `@capacitor/local-notifications` (campos documentados do plugin), no canal
  silencioso `timer-progresso`. Ela mostra bloco + horário de término quando
  corre e vira "pausado · restam X" na pausa; é removida ao encerrar. **Não**
  foi preciso criar um foreground service em Kotlin: uma notificação
  `setOngoing(true)` é uma notificação normal, então as regras de
  `FOREGROUND_SERVICE_SPECIAL_USE`/`SHORT_SERVICE` do Android 14 não se aplicam.
  O processo pode ser morto pelo sistema, mas o alarme exato continua no
  `AlarmManager` e o tempo é recalculado na reabertura.
- Alarme entregue com tela bloqueada, pausa/retomada com o app morto e
  comportamento em Doze só podem ser validados num aparelho.


## Ambiente Android

Requer JDK 21 e Android SDK com **platform 36** e **build-tools 35+**
(Capacitor 8 compila com `compileSdk 36`). O Gradle baixa a platform 36 se ela
não estiver instalada e as licenças estiverem aceitas.

## Arquivos ignorados

`dist-cap/`, `android/.gradle/`, `android/build/`, `android/app/build/`,
`android/local.properties` e os assets copiados
(`android/app/src/main/assets/public/`) não entram no git — o APK é regenerado
com os comandos acima. `.env.example` traz só um placeholder de `XAI_API_KEY`.
