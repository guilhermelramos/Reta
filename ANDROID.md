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

## Redesign da sessão de estudo (Material 3)

A tela `/sessao` virou modo foco: a barra lateral e a navegação inferior somem
em **qualquer largura**. O número principal é o **tempo restante** (o mesmo do
chip da folha do Professor) e a fonte de verdade continua sendo `endsAt` +
horário salvo + alarme agendado.

| Elemento | Comportamento |
| --- | --- |
| App bar (retrato) | fixa: voltar 48dp (`ArrowLeft`, “Voltar para hoje”, não encerra o timer), bloco em title-small, tempo restante em mono/tabular de 36sp/600 (`-0.5px`), barra de progresso de 6dp (12dp acima, 8dp abaixo), sub-linha “N min estudado(s) de M min” (13sp) e **Encerrar** como text button sem sublinhado (48dp, raio 8dp, 14sp/500) |
| Tempo principal | contagem regressiva; depois da meta vira `+MM:SS`. `timerHeadline()` em `session-timer.ts` alimenta o cabeçalho **e** o chip do sheet, então os dois nunca divergem |
| Pausar/Retomar | botão de 56dp, raio 28dp, `0 24dp`: parado/pausado = filled âmbar com `play`; rodando = tonal (âmbar escuro, borda 1.5dp primária, texto/ícone primários) com `pause` |
| Encerrar | abre diálogo M3 (`role=dialog`, foco preso pelo Radix) com “Encerrar e salvar N min?” e **Cancelar / Encerrar** |
| Voltar do Android | diálogos e folha do professor entram na pilha de overlays (`useBackOverlay`): o voltar fecha só o overlay mais recente |
| Paisagem larga (≥600dp) | split view: coluna fixa de 260dp com 100dvh (16dp de padding, borda direita) traz voltar + bloco, timer de 40sp, progresso, sub-linha, Pausar/Encerrar e o botão **Professor** (48dp, largura total) na base; coluna direita rolável com o conteúdo. Sem FAB e sem app bar fixa |
| Professor (retrato) | FAB fixo na viewport (`right: 16dp`, `bottom: 16dp + safe-area`, z 30, 56dp, raio 16dp) e 96dp de padding no rodapé do conteúdo para nada ficar sob ele |
| Folha do Professor | alça 32×4dp, chip `⏱ mm:ss` (32dp, mono 13sp, borda primária), título “Professor IA”, assist chip **Caderno** (visual 32dp, alvo 48dp) e fechar 48dp; perguntas rápidas em uma linha com rolagem horizontal e fade na borda (somem depois da 1ª mensagem; atalhos continuam); enviar virou IconButton 48×48 com `ArrowUp`, desabilitado com o campo vazio |
| Conclusão | háptico (`navigator.vibrate`, permissão normal `VIBRATE`) e snackbar “Bloco concluído · N min” com **Desfazer**, que devolve a sessão ativa com o tempo já salvo |
| Bloco ausente | `<ErrorState>` com “Esse bloco não existe mais no seu plano (talvez a planilha tenha mudado).” e ação **Ver plano de hoje** |
| Conteúdo vazio | um único cartão (20dp de padding, raio 16dp) com o CTA “Gerar material com IA” em uma linha e **Montar esta aula** como ação secundária (monta do plano, sem IA) |

A fonte de verdade do tempo continua sendo `startedAt` + acumulado e o
`endsAt` gravado; o `setInterval` de um segundo só repinta a barra
(`src/lib/study/session-timer.ts`, pura e testada em `session-timer.test.ts`).
O texto do diálogo e do snackbar também sai dessa lógica pura, assim como a
sub-linha (`studiedSubline`) e o rótulo acessível do timer
(`timerHeadlineAria`). A visibilidade dos chips e o envio da folha são puros em
`src/lib/study/chat-ui.ts` (`chat-ui.test.ts`).

**Alarme exato contextual:** na primeira vez que o timer começa a correr, se o
Android liberou notificações mas negou alarmes exatos, aparece um diálogo M3 com
a frase “Para o aviso tocar no minuto certo com a tela bloqueada, permita
alarmes exatos” e as opções **Permitir / Agora não**. *Permitir* chama
`requestNativeNotifications({ askExact: true })` (tela de alarmes do sistema) e
reagenda o alarme; *Agora não* mantém o alarme inexato que já estava agendado.
A pergunta acontece uma única vez (`reta:exactAlarmAsked` no `localStorage`,
flag de UI). A decisão é pura em `src/lib/study/exact-alarm.ts` e testada em
`exact-alarm.test.ts`.

A notificação persistente continua sendo só a notificação local agendada
(`ongoing: true`, canal `timer-progresso`), sem foreground service: o título
mostra o bloco e o tempo restante (`Bloco A · 23:14 restantes`). Ações
Pausar/Encerrar na própria notificação não foram adicionadas — exigiriam
`actionTypeId` + listener de ação e não são necessárias para a fonte de verdade.

Para validar no aparelho: criar/ler o alarme exato, o diálogo ao tocar
*Permitir* (abre a tela do Android), a entrega exata/inexata com tela bloqueada,
a vibração no fim do bloco e o snackbar **Desfazer** depois de matar/reabrir o
app. No WebView (mesmo bundle do APK) os fluxos de UI, a folha, o foco do
diálogo, o split view em 780×360 e o layout de 320px foram exercitados.


Para validar no aparelho: criar/ler o alarme exato, o diálogo ao tocar
*Permitir* (abre a tela do Android), a entrega exata/inexata com tela bloqueada,
a vibração no fim do bloco e o snackbar **Desfazer** depois de matar/reabrir o
app. No WebView (mesmo bundle do APK) os fluxos de UI, a folha, o foco do
diálogo e o layout de 320px foram exercitados.

## Redesign da tela Hoje (Material 3)

A tela `/` agora responde "o que estudar agora" em vez de listar quatro cartões
iguais. A leitura é pura em [`src/lib/study/today.ts`](./src/lib/study/today.ts)
(escolha da próxima ação, agrupamento dos blocos vazios e chave da semana) e
testada em `today.test.ts`.

| Elemento | Comportamento |
| --- | --- |
| Topo | data em 14px muted, título serifado "O que estudar agora", "Faltam N dias para a prova." e **Mais opções** (`MoreVertical`, alvo 48×48) |
| Menu de overflow | **Trocar planilha** (vai para Importar) e **Exportar resumo** (impressão), em `role=menu`; fecha com Esc e com o voltar do Android pela pilha de overlays (`useBackOverlay`) |
| Cartão herói | `surface-2` com borda âmbar, bloco, assunto em serifa, minutos e **Começar bloco** (48dp). Com timer ativo vira **Continuar** e o bloco em andamento tem prioridade |
| Descanso / dia concluído | cartão sem borda âmbar ("Hoje é descanso" ou "Blocos de hoje concluídos") com **Revisar erros (N)** quando o caderno tem erros vencidos hoje |
| Blocos | cartões compactos só para quem tem carga, com estado **Pendente / Em andamento / Concluído**; o herói não se repete na lista |
| Blocos vazios | uma linha só, ex.: "Bloco B, Revisão e Leitura: sem carga hoje" |
| Pacote | o estado aparece uma vez, no herói ("Pacote pronto"), em vez de "Pacote na hora" em todo cartão |
| Preparar semana | cartão de sugestão com **Preparar** e **Dispensar**. A dispensa fica em `meta.prepDismissedWeek` (segunda-feira da semana) e volta na semana seguinte |
| Largura | coluna de 600dp centralizada e 16dp de margem; em ≥600dp a navegação vira **navigation rail** M3 de 80dp (ícone + rótulo e pílula no item ativo); abaixo disso continua a barra inferior M3. A `/sessao` segue sem navegação |

Para validar no aparelho: o voltar do Android com o menu aberto, o TalkBack nos
itens do menu e do rail, e a largura do rail numa tablet real.

### Correções P3 na tela Hoje

- O banner "Bloco de hoje ainda não iniciado" entre o herói e a lista saiu. O
  espaço até o subtítulo "Blocos de hoje" ficou em 16px.
- O aviso virou o chip **Atrasado** no próprio cartão do bloco pendente, no
  lugar de **Pendente**. Ele mantém a tolerância de 45 min do Ajuste "Aviso se
  o bloco ainda não começou" (`LATE_GRACE_MIN` em `today.ts`) e continua
  respeitando `alerts.pending` e o modo silencioso. Sem horário válido na
  store, nada é sinalizado.
- **Só 15 min** aparece só no cartão herói, quando o bloco está pendente e tem
  30 min ou mais (`showsShortSession`). Bloco em andamento mostra só
  **Continuar**; os cartões da lista mostram só **Iniciar** (tonal, 48dp).
- **Preparar** passou a tonal (borda e texto âmbar sobre `primary-tonal`), então
  o único botão preenchido âmbar da tela é o CTA do herói.
- Em ≥600px a coluna de 600px centraliza na área à direita do navigation rail
  (`margin-inline: auto`), com 24px de padding lateral.
- O menu ⋮ ganhou ícones lucide de 20px (`FileUp` e `Download`), gap de 12px,
  padding lateral de 12px e itens de 48px.

As regras novas são puras e testadas em `today.test.ts` (`showsShortSession` e
`isLatePending`), incluídas em `npm test`. Para validar no aparelho: o TalkBack
anunciando o chip "Atrasado" e os itens do menu com ícone, e a coluna
centralizada numa tablet real em paisagem.

## Redesign da tela Ajustes (Material 3)

A tela `/ajustes` virou uma lista de seções com cabeçalho overline (âmbar, 14px),
cartão de 16dp de raio, itens de 56dp com 16dp de padding e separadores sutis;
tudo numa coluna de no máximo 600dp. Nenhuma função existente saiu: horário e
alertas de estudo, pesquisador, chave dos outros provedores, backup, planilha e
introdução continuam nos mesmos serviços.

| Elemento | Comportamento |
| --- | --- |
| Professor IA | Linha "Chave xAI" com status **Conectada / Não configurada**; campo de 48dp; **Salvar/Atualizar chave**, **Remover chave** (cofre seguro) e **Testar conexão** (idle, testando, conexão ok e erro com `InlineError`). **Avançado** recolhe as chaves opcionais de Perplexity/Gemini/Claude |
| Notificações | Status da permissão (ativadas/bloqueadas/não ativadas), **Ativar lembretes**, status do **alarme exato** com **Abrir configurações** quando negado, e a linha **Avisos atrasando? Toque aqui**, que abre a tela de otimização de bateria do Android (nunca bloqueia; na web mostra a orientação) |
| Switches | Componente M3 com `role="switch"`/`aria-checked` (Radix), trilho de 52×32dp, polegar de 24/28dp e a **linha inteira** clicável (56dp+, rótulo à esquerda, apoio de 14px e switch à direita). Substituem todos os checkboxes |
| Horário de estudo | Inputs de hora/minuto com `<label for>` e 48dp; switches e horário gravam na hora por `saveSettings` (fila local evita que uma gravação sobrescreva a outra) |
| Aparência | Só informativo: "Tema escuro" (o modo claro continua no `MELHORIAS.md`; o app não segue o tema do sistema) |
| Dados | Armazenamento persistente com uso/quota, exportar/restaurar backup `.json` (Filesystem + Share no APK) e **Trocar planilha** |
| Sobre | **Rever introdução** e versão (injetada no build a partir do `package.json` por `__APP_VERSION__`) |

Os rótulos e estados são puros em
[`src/lib/ui/settings-status.ts`](./src/lib/ui/settings-status.ts) (chave,
permissão, alarme exato, bateria, teste de conexão, armazenamento e versão) e
testados em `settings-status.test.ts`, incluído em `npm test`. Os componentes de
lista/switch ficam em `src/components/settings/` e são usados só por Ajustes.
Erros continuam usando `InlineError` com os textos padronizados de
`src/lib/feedback`.

Para validar no aparelho: abrir a tela de alarmes exatos e de otimização de
bateria e ver o status mudar ao voltar, remover a chave xAI do Keystore, a
permissão real do Android 13+ refletida na linha "Lembretes" e o TalkBack lendo
cada switch como "ativado/desativado" com a linha inteira como alvo.

## Redesign da tela Importar (Material 3)

A tela `/importar` agora mostra o estado do plano, a escolha do arquivo e a
pré-visualização antes de confirmar. Nenhuma função saiu: a leitura continua no
Web Worker (`parse-sheet-client.ts`), o download da planilha modelo continua no
`saveAndShare` nativo e o mapeamento manual de colunas segue disponível.

| Elemento | Comportamento |
| --- | --- |
| Topo | título serifado **Importar planilha**, a frase "Colunas usadas: Data, Bloco A, Bloco B, Revisão e os minutos de cada um." e uma coluna de no máximo 600dp |
| Plano atual | cartão com a planilha ativa (nome, período `DD/MM a DD/MM` e N dias) ou **Nenhuma planilha importada** quando o plano ainda é o modelo de exemplo |
| Escolher arquivo | cartão tocável de 120dp, borda tracejada de 1,5dp e raio de 16dp, ícone `FileSpreadsheet` de 32dp e o texto **Escolher arquivo .xlsx**; durante a leitura vira spinner + **Lendo planilha…** e a ação fica desabilitada |
| Modelo | **Baixar modelo** (48dp) ao lado do resumo das colunas do arquivo `.xlsx`; no APK abre a folha de compartilhamento |
| Pré-visualização | resumo "N dias, de DD/MM a DD/MM, M blocos", as 3 primeiras linhas com bloco, minutos e conteúdo, e os avisos de linha/coluna do parser |
| Mapeamento | **Ajustar colunas** recolhe os selects quando os cabeçalhos foram reconhecidos; abre direto no mapeamento manual ou quando falta alguma coluna obrigatória |
| Substituição | texto de apoio "Ao importar, esta planilha substitui o plano atual. O histórico de sessões e erros continua aqui." — sem diálogo extra |
| Erros | `InlineError` com o texto padrão "Não encontramos as colunas Data, Bloco A, Bloco B e Revisão.", o motivo em letra menor, a lista de linhas/colunas com problema e as ações **Escolher outro arquivo** / **Baixar modelo** |
| Sucesso | snackbar **Plano importado · N dias** com **Ir para Hoje** e um cartão com **Ir para Hoje** / **Preparar os próximos 7 dias** (o gerador de pacotes continua no mesmo serviço) |

O nome da planilha ativa fica em `meta.activeSheet` no IndexedDB e a importação
grava `meta.seeded = false`; assim o estado "planilha ativa" sobrevive a recarregar
o app e o backup `.json` leva a informação junto (a store `meta` já era copiada).
O resumo, as 3 linhas, o estado vazio e o texto do snackbar são puros em
[`src/lib/study/import-preview.ts`](./src/lib/study/import-preview.ts) e testados
em `import-preview.test.ts` (fazem parte de `npm test`). Os alvos são de 48dp, os
metadados de 12dp e o layout foi conferido em 320px, 390px e 1280px.

Para validar no aparelho: o seletor de arquivos do WebView, a folha de
compartilhamento do **Baixar modelo**, a leitura de uma planilha grande no Worker
e o TalkBack anunciando o cartão de seleção como um único alvo.

## Ambiente Android

Requer JDK 21 e Android SDK com **platform 36** e **build-tools 35+**
(Capacitor 8 compila com `compileSdk 36`). O Gradle baixa a platform 36 se ela
não estiver instalada e as licenças estiverem aceitas.

## Arquivos ignorados

`dist-cap/`, `android/.gradle/`, `android/build/`, `android/app/build/`,
`android/local.properties` e os assets copiados
(`android/app/src/main/assets/public/`) não entram no git — o APK é regenerado
com os comandos acima. `.env.example` traz só um placeholder de `XAI_API_KEY`.
