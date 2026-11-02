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
| Folha do Professor | alça 32×4dp, chip `⏱ mm:ss` (32dp, mono 13sp, borda primária), título “Professor IA”, assist chip **Caderno** (visual 32dp, alvo 48dp) e fechar 48dp; perguntas rápidas, atalhos e ações (desenho/teste) em uma única linha com rolagem horizontal e fade na borda (as perguntas rápidas somem depois da 1ª mensagem); enviar virou IconButton 48×48 com `ArrowUp`, desabilitado com o campo vazio |
| Conclusão | háptico (`navigator.vibrate`, permissão normal `VIBRATE`) e snackbar “Bloco concluído · N min” com **Desfazer**, que devolve a sessão ativa com o tempo já salvo |
| Bloco ausente | `<ErrorState>` com “Esse bloco não existe mais no seu plano (talvez a planilha tenha mudado).” e ação **Ver plano de hoje** |
| Conteúdo vazio | um único cartão (20dp de padding, raio 16dp) com o CTA “Gerar material com IA” em uma linha e **Usar só a planilha (sem IA)** como ação secundária (monta do plano, sem IA) |

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

### Correções P3 na Sessão e no onboarding

- **Paisagem (split view):** o H1 serifado do assunto sai do painel direito
  (`.session-title`), porque o painel esquerdo já mostra bloco e assunto. O
  conteúdo começa no topo com 16px de padding e os CTAs voltam à primeira dobra.
- **Painel esquerdo:** a sublinha "N min estudados de M min" voltou a ter o
  chevron de 18px (`ChevronDown`) que abre **+5 min** e as seções, com
  `justify-content: space-between` e 8px mínimos antes de **Encerrar**. Em
  retrato, nada muda.
- **Botão secundário:** **Montar esta aula** virou **Usar só a planilha (sem
  IA)** (outlined, 48dp), com a mesma ação local (`buildOne`), para contrastar
  com **Gerar material com IA**.
- **Folha do Professor:** perguntas rápidas, atalhos e as ações de desenho/teste
  ficam em uma única linha rolável (`flex-wrap: nowrap`, `overflow-x: auto`, gap
  de 8px, 16px de padding lateral), com chip visual de 32dp dentro de alvo de
  48dp e `white-space: nowrap`. Conferido em 360px e 320px sem segunda linha. O
  botão de livro virou assist chip de 32dp visual / 48dp de toque com ícone e
  rótulo **Caderno** (e **Conversa** quando o caderno está aberto), mantendo o
  toggle.
- **Onboarding passo 2:** o texto agora aponta a navegação real — "importe
  depois na aba **Plano** ou no menu de **Hoje**."

A ordem/visibilidade dos chips e o rótulo do assist chip são puros em
[`src/lib/study/professor-chips.ts`](./src/lib/study/professor-chips.ts) e
testados em `professor-chips.test.ts` (incluído em `npm test`).

Para validar no aparelho: girar a tela durante a sessão (o split view entra e
sai), o toque real nos chips com o teclado aberto, o TalkBack no assist chip
**Caderno** e o gesto de voltar fechando a folha.

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

### Correções P4 na tela Hoje

- O menu ⋮ abre ancorado pela borda direita do botão (16px da borda da tela),
  logo abaixo do bloco do cabeçalho, com largura entre 180px e 220px. Em 320px
  ele não cobre o H1 "O que estudar agora" nem sai da tela.
- O deslocamento vertical é medido na abertura (`menuSideOffset`, em
  [`src/lib/ui/overflow-menu.ts`](./src/lib/ui/overflow-menu.ts)): se o H1
  quebrar em duas ou três linhas, o menu desce até a base do bloco de texto em
  vez de ancorar só na base do botão. A posição é recalculada ao girar a tela
  ou mudar a fonte com o menu aberto.
- Esc, toque fora e o voltar do Android continuam fechando o menu. A lógica
  pura está testada em `overflow-menu.test.ts`, incluída em `npm test`.
- Para validar no aparelho: o TalkBack nos itens do menu e o voltar do Android
  com o popover aberto.

## Redesign da tela Ajustes (Material 3)

A tela `/ajustes` virou uma lista de seções com cabeçalho overline (âmbar, 14px),
cartão de 16dp de raio, itens de 56dp com 16dp de padding e separadores sutis;
tudo numa coluna de no máximo 600dp. Nenhuma função existente saiu: horário e
alertas de estudo, pesquisador, chave dos outros provedores, backup, planilha e
introdução continuam nos mesmos serviços.

| Elemento | Comportamento |
| --- | --- |
| Professor IA | Linha "Chave xAI" com status **Conectada / Não configurada**; campo de 48dp; **Salvar/Atualizar chave** (desabilitado com o campo vazio), **Remover chave** (cofre seguro) e **Testar conexão** (idle, testando, conexão ok e erro com `InlineError`). **Avançado** recolhe **Quem monta o pacote**, a pesquisa na web e as chaves opcionais de Perplexity/Gemini/Claude |
| Notificações | Um único cartão **Permissão de notificações** com badge **Ativadas / Bloqueadas / Não pedida**, a frase "Ative para receber os avisos do timer e do horário de estudo." e um botão tonal (**Ativar notificações** ou **Abrir configurações**; some quando concedida), além do status do **alarme exato** e da linha **Avisos atrasando? Toque aqui** (otimização de bateria do Android; nunca bloqueia) |
| Switches | Componente M3 com `role="switch"`/`aria-checked` (Radix), trilho de 52×32dp, polegar de 24/28dp e a **linha inteira** clicável (56dp+, rótulo à esquerda, apoio de 14px e switch à direita). Os lembretes dependentes ficam `disabled` + `aria-disabled` e opacidade 0,38 sem permissão ou no modo silencioso, sem apagar o valor salvo |
| Horário de estudo | Campo de texto de 48dp no formato 24 h (`14:00`, minuto sempre com dois dígitos; digitar `1400` vira `14:00`), sem mudar `studyHour`/`studyMinute`; também desabilitado quando a permissão falta ou o modo silencioso está ativo. Switches e horário gravam na hora por `saveSettings` |
| Plano e dados | **Trocar planilha**, exportar e restaurar backup `.json` (Filesystem + Share no APK). Restaurar pede confirmação antes de aplicar. **Avançado** recolhe o uso local e o armazenamento persistente com os botões de diagnóstico |
| Sobre | **Rever introdução** e versão (injetada no build a partir do `package.json` por `__APP_VERSION__`) |

Os rótulos e estados são puros em
[`src/lib/ui/settings-status.ts`](./src/lib/ui/settings-status.ts) (chave,
permissão, travas, horário, alarme exato, bateria, teste de conexão,
armazenamento e versão) e testados em `settings-status.test.ts`, incluído em
`npm test`. Os componentes de lista/switch/acordeão/diálogo ficam em
`src/components/settings/` e são usados só por Ajustes.
Erros continuam usando `InlineError` com os textos padronizados de
`src/lib/feedback`.

### Correções P3 na tela Ajustes

A revisão P3 do Consultor reordenou a tela em **Estudo e notificações**,
**Plano e dados**, **Professor IA** e **Sobre**, e removeu a seção **Aparência**
(que só anunciava o modo claro do backlog). As três repetições do aviso de
permissão viraram um cartão único com badge do estado real e um só botão tonal.
Os quatro lembretes dependentes e o horário ficam visualmente desabilitados
(opacidade 0,38, `aria-disabled`, não clicáveis) enquanto a permissão não está
concedida ou o modo silencioso está ligado; o valor salvo nunca é apagado.

A chave xAI só habilita **Salvar** com texto no campo (trim). Remover ou
substituir uma chave já salva abre um `alertdialog` M3 (`role="alertdialog"`,
foco preso pelo Radix, fecha com Esc e com o voltar do Android via
`useBackOverlay`, ação em cor de erro). Restaurar backup segue o mesmo padrão:
escolhe o arquivo primeiro e só aplica depois de **Substituir todos os dados?**.

O app chama `navigator.storage.persist()` sozinho ao gravar plano/importar,
salvar chave ou restaurar backup, quando a API existe e o estado ainda não é
persistente (`src/lib/study/storage.ts`, testado em `storage.test.ts`). O cartão
de diagnóstico continua disponível em **Plano e dados → Avançado**.

Para validar no aparelho: o seletor de permissão do Android 13+ (Ativar →
conceder/negar e ver o cartão e os switches mudarem), a abertura da tela de
configurações do app quando negada, o botão voltar fechando os três diálogos, a
leitura do `alertdialog` pelo TalkBack, o teclado numérico do campo de horário e
o resultado real de `navigator.storage.persist()` no WebView. Também: abrir a
tela de alarmes exatos e de otimização de bateria e ver o status mudar ao voltar,
e remover/sobrescrever a chave xAI do Keystore.

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

### Correções P3 na tela Importar

- **Estado de pré-visualização:** com o arquivo já lido, o cartão **Plano
  atual**, a área **Escolher arquivo .xlsx**, o formato de exemplo e **Baixar
  modelo** saem de cena. No cabeçalho da prévia, a pílula com o nome da planilha
  virou o botão **Trocar arquivo** (48dp) que reabre o seletor nativo; o nome da
  planilha continua visível na linha de apoio, truncado. Ao terminar a leitura,
  a prévia sobe com `scrollIntoView({ behavior: "smooth", block: "start" })` e,
  em 360×780, o botão **Importar** fica acima da barra de navegação.
- **Ajustar colunas:** virou um cabeçalho de acordeão de 48dp (`<details>` com
  `aria-expanded`), título à esquerda e `ChevronDown` de 24dp que gira ao abrir.
  Com os cabeçalhos reconhecidos, o subtítulo é **Reconhecidas automaticamente
  (N/M)**; no mapeamento manual ele avisa que os cabeçalhos não foram
  reconhecidos. O acordeão abre sozinho quando falta alguma coluna obrigatória.
- **Ordem da prévia:** as linhas com aviso/erro do parser aparecem antes dos
  dias válidos, em ordem crescente de linha da planilha. O encaixe é puro em
  `importPreviewItems` (`src/lib/study/import-preview.ts`).
- **Desfazer:** antes de substituir o plano, a tela guarda um retrato dos dias e
  de `meta.activeSheet`/`meta.seeded` (`src/lib/study/import-undo.ts`). O
  snackbar **Plano importado · N dias** mantém a ação **Desfazer** por 8 s e o
  store `undoImport` grava o retrato de volta; sessões, pacotes e erros não são
  tocados. O cartão de sucesso continua com **Ir para Hoje** e **Preparar os
  próximos 7 dias**.
- **Estado inicial:** **Baixar modelo** agora é um botão outlined de largura
  total (48dp) e, abaixo da área de escolha, há um bloco mono 12px com os
  cabeçalhos reais do parser (`Data | Bloco A | Min A | Bloco B | Min B |
  Revisão | Min Rev`) e a linha de exemplo `01/11/2026 | Matemática | 60 |
  Física | 40 | Questões | 20`. As colunas do modelo ficam em
  `TEMPLATE_HEADERS` (`parse-sheet.ts`), usadas também pelo gerador do `.xlsx`.

A ordem dos itens e o texto das colunas reconhecidas são testados em
`src/lib/study/import-preview.test.ts`; o snapshot/restauração, em
`src/lib/study/import-undo.test.ts` (fazem parte dos testes do app). Para
validar no aparelho: o seletor reaberto por **Trocar arquivo**, a rolagem suave
no WebView, o TalkBack anunciando o acordeão com `aria-expanded` e o snackbar
**Desfazer** durante os 8 s (o retrato é em memória; depois do prazo, ou de
fechar/reabrir o app, a importação já é definitiva).

## Redesign da tela Erros (Material 3)

O `/erros` virou um caderno de leitura rápida: coluna de 600dp, 16dp nas
laterais e 12dp entre cartões, com um único botão preenchido (o CTA do herói).
Nenhuma função saiu: revisão espaçada, timer de 5 min, classificação do motivo,
Professor IA, erro externo e exclusão continuam nos mesmos serviços.

| Elemento | Comportamento |
| --- | --- |
| Topo | título serifado **Caderno de erros** e a linha **N para revisar hoje · M no total** |
| Cartão herói | `surface-2` com borda âmbar e **Revisar N erros agora** + **Começar revisão** quando há vencidos. Sem vencidos, cartão positivo **Nada para revisar hoje** com a próxima data (ou **Nenhum erro guardado ainda**) |
| Filtros | uma linha rolável de FilterChips (status, matéria e motivo), visual de 32dp dentro de alvo de 48dp e **Limpar** quando algum filtro foge do padrão |
| Lista | cartões compactos com assunto, trecho da questão em 2 linhas, chip do motivo e data da próxima revisão; o toque abre o detalhe e o menu ⋮ traz **Editar** e **Excluir** |
| Registrar/editar | bottom sheet M3 aberto pelo botão tonal **Registrar erro**; campos de 48dp com label, motivo em chips de escolha única e **Sem motivo**; editar usa a mesma folha |
| Excluir | `role="alertdialog"` com **Cancelar / Excluir**, foco preso pelo Radix, Esc e voltar do Android pela pilha `useBackOverlay` |
| Revisão | um erro por vez, barra de progresso de 6dp com **k de N**, timer de 5 min no topo e resultados **Errei / Difícil / Fácil** de 48dp lado a lado |

A contagem de vencidos, os filtros, a ordem, a próxima data e os rótulos são
puros em [`src/lib/study/error-notebook.ts`](./src/lib/study/error-notebook.ts)
e testados em `error-notebook.test.ts` (incluído em `npm test`). O store ganhou
`updateMistake`/`removeMistake` e o IndexedDB, `deleteMistake`; o formulário e os
cartões ficam em `src/components/erros/`. Para validar no aparelho: o voltar do
Android fechando folhas e o `alertdialog`, o TalkBack lendo os chips filtrados e
o teclado do WebView nos campos do formulário.

## Redesign da tela Plano (Material 3)

A tela `/plano` virou uma agenda por semana, com topo fixo e o dia de hoje à
vista. Nenhuma função saiu: recalcular atrasados (com pré-visualização),
criar/editar dia, blocos, minutos, fase, estudar um bloco e excluir dia
continuam nos mesmos serviços — a exclusão agora também apaga o dia do
IndexedDB (`deleteDay` + `removeDay` na store), preservando sessões, pacotes e
erros.

| Elemento | Comportamento |
| --- | --- |
| Topo | sticky com título serifado **Plano**, a linha **Planilha: nome · DD/MM a DD/MM · N dias** e o menu ⋮ de 48dp (`role=menu`, ícones de 20dp) com **Trocar planilha**, **Novo dia** e **Recalcular atrasados** |
| Atrasados | cartão de aviso em `surface-2` (sem preenchimento âmbar) com **N dias atrasados** e o botão tonal **Recalcular**, que abre a mesma prévia/confirmação antes de gravar |
| Lista | uma linha M3 de 68dp por dia: data curta + dia da semana à esquerda, fase/assuntos em até duas linhas, total de minutos e ícone + texto do estado (**Feito / Parcial / Pendente / Descanso**) à direita; o dia de hoje tem borda âmbar e a tela abre rolada na semana dele |
| Semanas | seções **Semana de DD/MM** (segunda-feira), dias em ordem crescente e 12dp entre os cartões |
| Detalhe | bottom sheet com a data longa, os blocos (tipo, minutos, tópico e estado), seleção do bloco e **Estudar este bloco** (filled, leva à Sessão), **Editar dia** (tonal) e **Excluir dia** (texto em cor de erro) |
| Formulário | cartão com campos de 48dp e label, data/fase, blocos com tipo, minutos (`inputmode=numeric`, aceita 45/1h30/01:30) e tópico; **Salvar dia** filled e **Cancelar** texto |
| Erros/vazio | `InlineError` para falhas de gravação e validação, `ErrorState` quando o plano não tem nenhum dia |
| Diálogos | exclusão em `role=alertdialog` (ConfirmDialog), Esc e voltar do Android pela pilha `useBackOverlay` |

O agrupamento por semana, o estado do dia, a contagem de atrasados, o cabeçalho
e os tópicos da linha são puros em
[`src/lib/study/plan-schedule.ts`](./src/lib/study/plan-schedule.ts) e testados
em `plan-schedule.test.ts`. O rascunho e a validação do formulário ficam em
[`src/lib/study/plan-draft.ts`](./src/lib/study/plan-draft.ts), com
`plan-draft.test.ts`; os três testes fazem parte de `npm test`.

Para validar no aparelho: o teclado numérico nos minutos, a rolagem até o dia
de hoje num plano longo, o TalkBack lendo o estado da linha (ícone + texto), a
folha aberta por cima da barra de navegação e o gesto voltar fechando a folha e
o `alertdialog`.

## Redesign da tela Progresso (Material 3)

A tela `/progresso` virou um resumo em três camadas: métricas na primeira
dobra, mapa de calor e listas de atenção, e o plano compacto no fim. Coluna de
600dp centralizada, 16dp nas laterais e 12dp entre cartões. Nenhuma função
saiu: sequência, heatmap, planejado × real, assuntos fracos, motivos de erro,
termômetro e dias do plano continuam calculados com os mesmos dados.

| Elemento | Comportamento |
| --- | --- |
| Topo | título serifado **Progresso** e a linha **Faltam N dias para a prova** (singular em 1 dia, **A prova é hoje**, **Sem data de prova no plano**) |
| Métricas | três cartões compactos: sequência de dias, horas da semana (`1h30`) contra o planejado (`de 18h na semana`) e **% do plano concluído**; número de 26px tabular + rótulo de 12px, sem ícones |
| Mapa de calor | 28 dias em 4+ semanas, células de no mínimo 12px com gap de 4px, cabeçalho S T Q Q S S D, rótulo `DD/MM` por semana e legenda **menos → mais**; cada célula tem `aria-label` **DD/MM: N min**, hoje ganha contorno e o dia livre, borda tracejada |
| Planejado e real | uma barra por assunto do plano com **estudado de planejado** em texto (ex.: `1h10 de 9h25`) |
| Assuntos mais fracos / Motivos dos erros | listas de até 5 itens, cada linha com barra de proporção e link para `/erros` (o caderno ainda não lê filtro por query), mais o texto **Ver todos** |
| Dias do plano | termômetro compacto (blocos concluídos e esperado até hoje, sem repetir o % da métrica) e grade de datas com estado escrito (feito, parcial, falta, livre, vem); hoje em borda âmbar |
| Estado vazio | `ErrorState` neutro com **Estude o primeiro bloco para ver seu progresso** e o único botão preenchido da tela, **Ir para Hoje**; os dias do plano continuam visíveis |

A contagem até a prova, as métricas da primeira dobra, a escala e as semanas do
heatmap (0, 1–14, 15–29, 30–59, 60+ min), o planejado × real por assunto, os
motivos de erro e o estado dos dias são puros em
[`src/lib/study/progress-dashboard.ts`](./src/lib/study/progress-dashboard.ts),
com `progress-dashboard.test.ts` em `npm test`. O `ErrorState` ganhou o kind
`empty` (sem o vermelho de erro e com `role="status"`). Os cartões ficam em
`src/components/progress/`.

Para validar no aparelho: o TalkBack lendo as 28 células do heatmap e os itens
que levam ao caderno, o contorno de hoje em tela pequena, a rolagem até o fim
sem a barra de navegação cobrir o último cartão e o estado vazio com o CTA
**Ir para Hoje**.

## Ambiente Android

Requer JDK 21 e Android SDK com **platform 36** e **build-tools 35+**
(Capacitor 8 compila com `compileSdk 36`). O Gradle baixa a platform 36 se ela
não estiver instalada e as licenças estiverem aceitas.

## Arquivos ignorados

`dist-cap/`, `android/.gradle/`, `android/build/`, `android/app/build/`,
`android/local.properties` e os assets copiados
(`android/app/src/main/assets/public/`) não entram no git — o APK é regenerado
com os comandos acima. `.env.example` traz só um placeholder de `XAI_API_KEY`.
