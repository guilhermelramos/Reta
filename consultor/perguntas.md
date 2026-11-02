# Perguntas ao Consultor

## P1 — momentos (a) diagnóstico inicial + (b) antes do redesign — 2026-11-01 (UTC-3)

**Contexto.** Reta é um app de estudos para vestibular (React 19 + TanStack Start, dados locais em IndexedDB) empacotado para Android com Capacitor 8 (WebView). Telas: Hoje (`src/routes/_shell/index.tsx`), Plano (`plano.tsx`), Sessão de estudo com timer, questões, flashcards e chat com o professor IA em gaveta (`sessao.tsx`, `components/teacher-chat.tsx`), Importar planilha (`importar.tsx`), Caderno de Erros com repetição espaçada (`erros.tsx`), Progresso (`progresso.tsx`), Ajustes (`ajustes.tsx`). Navegação inferior com 5 abas. Tema único escuro (fundo quase preto, acento âmbar, títulos serifados). Diagnóstico completo em `DIAGNOSTICO.md`. O emulador não sobe no ambiente (sem KVM); os screenshots são do mesmo bundle do APK renderizado em viewport de celular. Resultado automático: vários alvos de toque com 44px e checkboxes de 20×20 em Ajustes; sem crash; app ignora modo claro do sistema. Vamos adicionar: tela de login (entrada da chave da API xAI, já que a xAI não oferece OAuth público para terceiros), pedido de permissão de notificação + alarme exato + otimização de bateria, timer com notificação persistente.

**Screenshots** (`/workspace/reta-android/consultor/shots/`): `hoje-light.png`, `hoje-dark.png`, `plano-*.png`, `sessao-*.png`, `importar-*.png`, `erros-*.png`, `progresso-*.png`, `ajustes-*.png`, `hoje-320px.png`, `hoje-paisagem.png`, `ajustes-testar-conexao-apk.png` (botão preso em "Testando…"), `log.txt` (alvos < 48px).

**Perguntas objetivas.**
(a) Diagnóstico: com base nas telas e no `DIAGNOSTICO.md`, quais são os problemas de UI/UX mais graves para uso diário no Android, em ordem de prioridade? Inclua hierarquia da tela Hoje, navegação inferior, contraste do tema escuro, tipografia, estados vazios/erro e acessibilidade (alvos, rótulos).
(b) Redesign, antes de implementar:
  1. Devemos migrar para componentes/tokens Material 3 (cores dinâmicas, tipografia M3, NavigationBar de 80dp) ou manter a identidade atual ajustando só ao essencial do M3? Qual o mínimo que conta como "M3" num app WebView?
  2. Modo claro: criar tema claro seguindo o sistema, ou manter só escuro com opção? 
  3. Fluxo de login/onboarding com chave da API xAI: telas, textos, onde explicar como obter a chave, validação, erro de chave inválida, e como encaixar pedido de notificações/alarme exato/bateria sem assustar.
  4. Tela de estudo: posição e tamanho do timer, controles (pausar/retomar/encerrar), notificação persistente do timer, e como abrir o chat do professor sem perder o timer.
  5. Estados de erro padronizados (sem internet, limite da API 429, permissão negada, planilha vazia/malformada): componente, texto e ação.
  6. Ordem das telas a redesenhar (para as revisões (c) por tela).
Responda no formato VEREDITO / PROBLEMAS / MELHORIAS (prioridade + esforço) / COMPARAÇÃO (Anki, Duolingo, Quizlet ou Notion) / FONTES.

## P2 — momento (c) revisão por tela: Onboarding + Sessão de estudo — 2026-11-01 (UTC-3)

**Contexto.** Branch `integracao-fase2` (fora da main) com todas as correções da P1: chave no Keystore, IA direto pelo APK (CapacitorHttp), notificações nativas, timer em segundo plano por `endsAt` + notificação agendada (sem foreground service), backup nativo, botão voltar do Android, planilha em Web Worker, estados de erro padronizados (`<InlineError>`/`<ErrorState>`), alvos de 48dp e barra inferior M3 de 80dp, release assinado (PR #3). Duas telas foram redesenhadas seguindo a sua resposta P1:
- **Onboarding** (`src/routes/boas-vindas.tsx`, lógica em `src/lib/study/onboarding.ts`): 4 passos com indicador de pontos — Boas-vindas → Planilha (importar .xlsx / baixar modelo) → Professor IA (chave xAI opcional, expansor "Como conseguir a chave", mostrar/ocultar, Colar, "Verificar chave" com timeout de 15s e mensagens para 401/403, 429 e offline) → Lembretes (pede POST_NOTIFICATIONS só ao tocar "Ativar lembretes"; alarme exato e bateria NÃO são pedidos aqui). "Pular" a partir do passo 2, voltar do Android recua um passo, largura máx. 600px. Reabre por Ajustes → "Rever introdução".
- **Sessão** (`src/routes/_shell/sessao.tsx`, `components/teacher-chat.tsx`, lógica em `src/lib/study/session-timer.ts` e `exact-alarm.ts`): app bar fixa com nome do bloco, tempo em mono e barra de progresso; navegação inferior escondida; Pausar/Retomar em pílula de 56dp; "Encerrar" como botão de texto com diálogo "Encerrar e salvar N min?"; FAB "Professor" de 56dp abre bottom sheet de 90% com alça e chip do tempo restante, fechar não pausa o timer; ao concluir, háptico + Snackbar "Bloco concluído · N min"; "Bloco não encontrado" usa `<ErrorState>`; pedido contextual de alarme exato na primeira vez que o timer inicia (só no APK).

**Método dos screenshots** (o mesmo da P1: emulador não sobe sem KVM): bundle `dist-cap` do APK servido sem servidor de API e renderizado no Playwright com viewport de celular, `isMobile`, toque, DPR 2. Plano de teste de 7 dias importado pelo próprio passo 2 do onboarding. Script: `consultor/shots/p2/shots2.mjs`; log: `consultor/shots/p2/log.txt`.

**Screenshots** (`/workspace/reta-android/consultor/shots/p2/`), sufixo `-{light|dark}-{360|320|paisagem}.png` (360 em claro e escuro; 320 e paisagem 780×360 em claro):
- `onboarding-1-*` boas-vindas · `onboarding-2-*` planilha · `onboarding-3-*` professor IA · `onboarding-3-chave-aberta-*` expansor aberto · `onboarding-4-*` lembretes
- `sessao-*` antes de iniciar · `sessao-timer-rodando-*` · `sessao-chat-*` bottom sheet do professor com o timer · `sessao-encerrar-dialogo-*` diálogo de encerrar

**Limitações conhecidas dos shots:** (1) o app continua só escuro (modo claro adiado na P1), então `light` e `dark` saem iguais; (2) no navegador não há plugin nativo, então o passo 4 mostra a variante web ("Continuar" + "Você pode ativar depois em Ajustes") em vez de "Ativar lembretes", e o pedido de alarme exato da Sessão não aparece; (3) notificação persistente, háptico e voltar do Android só no aparelho.

**Observações automáticas que queremos que você avalie:**
- No passo 2 (Planilha) não há "Agora não"/avançar sem importar: a única saída sem planilha é "Pular", que encerra o onboarding inteiro e pula também chave e lembretes.
- Na Sessão o número grande é o tempo **decorrido** (00:01) e o restante aparece pequeno ("Restam 59:59"); no sheet o chip mostra o **restante**.
- Na Sessão o link "Hoje" (volta) mede 27×48px; o botão "Gerar Aula, Flashcards e Questões com IA" quebra em duas linhas a 360px; o FAB "Professor" encosta no cartão "Montar esta aula".

**Perguntas objetivas.**
(c1) Onboarding: a ordem Boas-vindas → Planilha → Chave → Lembretes está certa, ou a chave deveria vir depois do primeiro bloco estudado? O passo 2 deve ter um "Agora não" que só avança um passo, e "Pular" deve continuar encerrando tudo? Textos, hierarquia (título serifado grande no passo 4 a 320px), indicador de passos e o expansor da chave estão adequados? O que falta em 320px e em paisagem?
(c2) Sessão: o tempo principal deve ser decorrido ou restante? Tamanho/peso do timer, posição de Pausar e Encerrar, espessura e contraste da barra de progresso, posição do FAB em relação ao conteúdo, e o bottom sheet do professor (altura, chip, chips de pergunta rápida cortados na horizontal, campo de texto) — o que corrigir, com dp/cor/espaçamento?
(c3) Notificação persistente sem foreground service (só a agendada para o término): é suficiente para o usuário ou ele vai sentir falta da contagem viva na gaveta? O momento do pedido de alarme exato (primeiro início do timer) está certo?
(c4) Paisagem: a Sessão deve mudar de layout (timer à esquerda, conteúdo à direita) ou só rolar?
Responda no formato VEREDITO / PROBLEMAS / MELHORIAS (prioridade + esforço) / COMPARAÇÃO (Anki, Duolingo, Forest ou Quizlet) / FONTES.

## P3 — momento (c) revisão por tela: Onboarding + Sessão (pós-P2) + Hoje + Ajustes + Importar — 2026-11-01 (UTC-3)

**Contexto.** Branch `integracao-fase2` (fora da main). A sua P2 foi registrada em `DECISOES.md` (alta ou esforço P aplicados; cronômetro nativo na notificação e chave xAI "lazy" foram para `MELHORIAS.md`). Desde a P2:
- **Onboarding** (`ui/p2-onboarding`): passo 2 com "Agora não" que avança só um passo ("Pular" segue encerrando tudo); "N dias no plano" só aparece depois de importar; chevron no expansor da chave; "Verificar chave" desabilitado com campo vazio; título do passo 4 ajustado a 320px; frase duplicada removida; 2 colunas em paisagem.
- **Sessão** (`ui/p2-sessao`): o número principal agora é o tempo **restante** (vira `+MM:SS` no estouro), igual ao chip do sheet; ← de 48dp na app bar no lugar do link "Hoje"; Pausar tonal × Iniciar filled; progresso de 6dp; um só cartão vazio com CTA "Gerar material com IA" em 1 linha; sheet do professor com chips em linha rolável com fade e Enviar 48dp desabilitado se vazio; em paisagem, split view (timer à esquerda, conteúdo à direita) sem navegação lateral e sem FAB sobre o título.
- **Hoje** (`ui/hoje`, P1 prob. 4 / melh. 1 e 8): topo com data, "O que estudar agora" e "Faltam N dias"; Trocar planilha/Exportar resumo num menu de overflow (⋮ 48dp, `role=menu`); cartão herói com a próxima ação ("Começar bloco"/"Continuar" + "Só 15 min"); blocos com carga em cartões compactos com estado; blocos vazios numa linha; "Preparar semana" como sugestão com Preparar/Dispensar (dispensa semanal); coluna de 600dp e navigation rail M3 de 80dp a partir de 600dp.
- **Ajustes** (`ui/ajustes`, P1 melh. 9 / prob. 3 e 11): seções Professor IA, Notificações, Aparência, Dados, Sobre; listas de 56dp; switches M3 52×32dp com a linha inteira clicável; status da chave, permissão, alarme exato (com "Abrir configurações") e linha de bateria não bloqueante; versão do app.
- **Importar** (`ui/importar`): cartão do plano atual (ou "Nenhuma planilha importada"), área tocável de 120dp com borda tracejada para escolher o .xlsx, "Baixar modelo", pré-visualização (N dias, período, 3 primeiras linhas, avisos), "Ajustar colunas" recolhido quando os cabeçalhos são reconhecidos, texto de substituição sem diálogo extra, snackbar "Plano importado · N dias" com "Ir para Hoje".

Typecheck ok, 299/299 testes do app passando, `build:cap` + `assembleDebug` ok (APK em `/workspace/apk/reta-integracao-fase2-debug.apk`).

**Método dos screenshots** (o mesmo da P2): bundle `dist-cap` do APK servido sem API e renderizado no Playwright (viewport de celular, `isMobile`, toque, DPR 2), plano de 7 dias importado pelo passo 2. Script: `consultor/shots/p3/shots3.mjs`; log: `consultor/shots/p3/log.txt`.

**Screenshots** (`/workspace/reta-android/consultor/shots/p3/`), sufixo `-{light|dark}-{360|320|paisagem}.png`:
- `onboarding-1..4-*`, `onboarding-3-chave-aberta-*`
- `sessao-*`, `sessao-timer-rodando-*`, `sessao-chat-*`, `sessao-encerrar-dialogo-*`
- `hoje-*`, `hoje-menu-*` (overflow aberto)
- `ajustes-*`
- `importar-*` (estado inicial) e `importar-previa-*` (após escolher o arquivo)

**Limitações conhecidas dos shots:** (1) o app só tem tema escuro, então `light` = `dark`; (2) sem plugins nativos no navegador: o passo 4 mostra a variante web, alarme exato/bateria/permissão aparecem no estado "web" em Ajustes; (3) os shots `fullPage` desenham a barra inferior fixa no meio da página longa (artefato da captura, não do app); (4) notificação, háptico, voltar do Android e seletor de arquivos do WebView só no aparelho.

**Observações automáticas:** na varredura de alvos < 48px em 360 só sobraram elementos visualmente ocultos (link "Ir para o conteúdo" e os `input[type=file]` escondidos), em /sessao, /, /ajustes e /importar.

**Perguntas objetivas.**
(c1) Onboarding e Sessão: as correções da P2 resolveram os problemas 1–10? O que ainda falta (em especial o split view em paisagem e o sheet do professor)?
(c2) Hoje: a hierarquia cartão herói → blocos → sugestão "Preparar semana" está certa? O aviso "Bloco de hoje ainda não iniciado" entre o herói e a lista é redundante? "Só 15 min" como ação secundária em todo cartão faz sentido? O menu de overflow e o rail ≥600dp estão adequados?
(c3) Ajustes: a ordem das seções, os textos de status e a linha de bateria estão claros? Algo deveria sair, ir para "Avançado" ou ganhar confirmação (ex.: remover chave, restaurar backup)?
(c4) Importar: o fluxo escolher → pré-visualizar → confirmar está claro para quem nunca viu a planilha modelo? A substituição do plano sem diálogo é segura o bastante? A pré-visualização (3 linhas) e os erros são suficientes?
Responda no formato VEREDITO / PROBLEMAS / MELHORIAS (prioridade + esforço) / COMPARAÇÃO (Anki, Duolingo, Forest ou Quizlet) / FONTES.

## P4 — momento (c) revisão por tela: Erros + Plano + Progresso (+ confirmação da P3) — 2026-11-02 (UTC-3)

**Contexto.** Branch `integracao-fase2` (fora da main), agora com `ui/p3-hoje`, `ui/p3-sessao`, `ui/p3-ajustes`, `ui/p3-importar`, `ui/erros`, `ui/plano` e `ui/progresso`. A P3 está registrada em `DECISOES.md`: todos os itens eram de esforço P e foram aplicados; o TimePicker M3 foi para `MELHORIAS.md`. Typecheck ok, 428/428 testes do app passando, `build:cap` + `assembleDebug` ok (APK em `/workspace/apk/reta-integracao-fase2-debug.apk`).

**Correções da P3, para confirmar:**
- **Hoje:** o banner redundante saiu, "Só 15 min" aparece só no cartão herói e "Preparar semana" ficou abaixo dos blocos, como sugestão secundária.
- **Sessão em paisagem:** o split view não repete o H1, o CTA "sem IA" não é mais cortado e os chips do professor ficam numa linha só.
- **Nomenclatura:** "Planilha" é o arquivo importado e "Plano" é a agenda. O passo 2 das boas-vindas aponta para a aba Plano.
- **Ajustes:** as seções agora são Estudo e notificações, Plano e dados, Professor IA (com "Avançado") e Sobre. Há um único cartão "Permissão de notificações" com badge do estado real. Os switches dependentes ficam desabilitados sem permissão, sem perder o valor salvo. "Salvar chave" fica desabilitado com o campo vazio. Remover ou substituir a chave e restaurar o backup pedem confirmação em `alertdialog`. `storage.persist()` é chamado sozinho, e o uso local foi para "Avançado".
- **Importar:** a prévia vem compacta e o botão de confirmar fica visível sem rolar. Há acordeão de colunas e um snackbar com "Desfazer".

**Redesign novo:**
- **Erros:** herói "Revisar N erros agora" ou estado positivo, FilterChips de status, matéria e motivo, e cartões compactos com menu ⋮ (Editar/Excluir com confirmação). "Registrar erro" abre uma bottom sheet, e a revisão mostra um erro por vez com timer de 5 min e Errei/Difícil/Fácil.
- **Plano:** topo fixo com "Planilha: nome · período · N dias" e menu ⋮ (Trocar planilha/Novo dia/Recalcular atrasados). Há um cartão de atrasados com prévia, as semanas são agrupadas, cada dia ocupa uma linha de 68dp com estado em ícone e texto e a tela abre rolada no dia de hoje. O detalhe abre numa bottom sheet (Estudar/Editar/Excluir).
- **Progresso:** três métricas (sequência, horas na semana contra o planejado e % do plano), mapa de calor de 28 dias, planejado × real por assunto, assuntos mais fracos, motivos dos erros, dias do plano compactos e um estado vazio neutro com "Ir para Hoje".

**Método dos screenshots:** o mesmo da P3 (bundle `dist-cap` sem API no Playwright, viewport de celular, DPR 2, plano de 7 dias importado no onboarding). Script: `consultor/shots/p4/shots4.mjs`, log: `consultor/shots/p4/log.txt`.

**Screenshots** (`/workspace/reta-android/consultor/shots/p4/`), com sufixo `-{light|dark}-{360|320|paisagem}.png`:
- `erros-*`, `plano-*`, `progresso-*` (novos)
- `hoje-*`, `hoje-menu-*`, `sessao-*`, `sessao-chat-*`, `ajustes-*`, `importar-*`, `importar-previa-*` (para confirmar a P3)

**Limitações:** as mesmas da P3. Só existe tema escuro, então light = dark. Os shots `fullPage` desenham a barra inferior fixa no meio. Sem sessões nem erros, Erros e Progresso aparecem no estado vazio. Os plugins nativos aparecem no estado "web". A varredura de alvos menores que 48px em 360 só achou elementos ocultos.

**Perguntas objetivas.**
(c1) Confirmação curta da P3: os 9 problemas foram resolvidos? Responda sim/não por item e diga o que sobrou.
(c2) Erros: a hierarquia herói → filtros → lista e o fluxo de revisão estão claros? O estado vazio basta?
(c3) Plano: a lista por semana, a linha de 68dp e a sheet de detalhe funcionam bem num celular de 320px? O menu ⋮ esconde ações demais?
(c4) Progresso: as três métricas e o mapa de calor são legíveis em 360/320? O que corta para reduzir a rolagem?
Responda no formato VEREDITO / PROBLEMAS / MELHORIAS (prioridade + esforço) / COMPARAÇÃO (Anki, Duolingo, Forest ou Quizlet) / FONTES.

## P5 — momento (d) revisão final antes do merge — 2026-11-02 (UTC-3)

**Contexto.** Branch `integracao-fase2`, ainda fora da main e sem tag, agora com `ui/p4-hoje`, `ui/p4-sessao`, `ui/p4-ajustes`, `ui/p4-importar`, `ui/p4-plano`, `ui/p4-progresso` e `ui/p4-erros`. A P4 está registrada em `DECISOES.md`. Duas sugestões foram para `MELHORIAS.md`: o intervalo da próxima revisão no botão, e o cartão "Dias do plano", que não foi removido porque a regra proíbe tirar funções. Typecheck ok, 468/468 testes do app passando, `build:cap` + `cap sync` + `assembleDebug` ok, APK em `/workspace/apk/reta-integracao-fase2-debug.apk`.

**Correções da P4, para confirmar:**
1. **Hoje:** o menu ⋮ abre alinhado à direita, abaixo do botão, sem cobrir o H1.
2. **Sessão 320:** cronômetro com `clamp(22px, 6.5vw, 32px)`, Iniciar mais compacto e "Professor" em fluxo abaixo do cartão vazio (padding inferior de 88px).
3. **Sheet do Professor:** título "Professor IA" inteiro, o timer virou chip, "Caderno" virou IconButton 48dp e a matéria foi para o subtítulo.
4. **Ajustes:** "Testar conexão" fica desabilitado sem chave salva e com o campo vazio.
5. **Importar e nomenclatura:** a planilha leva o nome do arquivo sem a extensão, e as antigas chamadas "Plano" aparecem como "Minha planilha". A prévia mostra o rótulo "PRÉ-VISUALIZAÇÃO" sem o topo duplo, e Importar/Cancelar ficam acima da dobra.
6. **Plano:** a rolagem inicial para no aviso de atrasados, com `scroll-margin` sob o topo fixo. A linha tem 72dp e o estado é só ícone, com aria-label e title. Há um botão "+" de Novo dia visível, que saiu do ⋮.
7. **Progresso:** a sequência é 0 quando não há estudo, e o estado vazio real mostra "Ir para Hoje". O heatmap tem no máximo 340px, com células de até 28px. Em paisagem fica em 2 colunas, ao lado de "Planejado e real". Sem dados, "Assuntos fracos" e "Motivos" viram um único cartão de diagnóstico.
8. **Erros:** no estado vazio, "Registrar erro" fica tonal dentro do cartão, junto com "Estudar bloco de hoje".

**Screenshots finais:** 50 imagens em `/workspace/reta-android/consultor/shots/p5/`, geradas por `shots5.mjs` com o método da P4. Depois do onboarding, o IndexedDB foi semeado com 7 sessões concluídas em dias seguidos e 4 erros (3 vencidos hoje, 1 para 04/11), então Erros e Progresso aparecem com dados. Arquivos novos: `erros-revisao-*` (revisão um a um) e `plano-detalhe-*` (sheet do dia). Também estão lá `hoje`, `hoje-menu`, `sessao`, `sessao-chat`, `ajustes`, `importar`, `importar-previa`, `erros`, `plano` e `progresso`, em light/dark e em 360, 320 e paisagem. A varredura de alvos menores que 48px só achou elementos ocultos ("Ir para o conteúdo" e os `input[type=file]`), e não houve erros de console (`log.txt`). As limitações são as mesmas: só tema escuro e a barra fixa aparecendo no meio dos shots `fullPage`.

**Checklist por critério (sem aparelho):**

| # | Critério | Estado | Evidência |
| --- | --- | --- | --- |
| 1 | Login com Grok (padrão: chave de API no Keystore) | ✅ chave / ⚠️ OAuth experimental | `@aparajita/capacitor-secure-storage` com testes em `src/lib/secure/keys.test.ts`; nenhuma chave no repositório nem no bundle; OAuth do Grok só como opção experimental |
| 2 | Leitura da planilha (data, conteúdo A/B, revisão e tempos) | ✅ | Testes do parser e da prévia; o `plano-teste.xlsx` foi importado no fluxo dos shots (onboarding e Importar) |
| 3 | Notificações confiáveis em segundo plano | pendente-aparelho | Manifest com POST_NOTIFICATIONS, SCHEDULE_EXACT_ALARM e RECEIVE_BOOT_COMPLETED; `@capacitor/local-notifications`; cartão de permissão e alarme exato em Ajustes; a bateria/Doze só dá para validar no aparelho |
| 4 | Timer com a tela bloqueada | pendente-aparelho | `endsAt` como fonte de verdade (`timer-plan.ts` com testes), notificação local agendada, sem setInterval como verdade |
| 5 | Questões geradas pelo Grok | ✅ código / pendente-chave | Cliente xAI via CapacitorHttp (`/v1/chat/completions`); sem chave real no box não houve chamada de ponta a ponta |
| 6 | Pacotes offline com imagens | ✅ código / pendente-aparelho | Pacotes no IndexedDB e `@capacitor/filesystem`; `storage.persist()` automático; exportar/importar backup (`backup.test.ts`) |
| 7 | Chat com o professor IA | ✅ UI / pendente-chave | Sheet do Professor ajustado na P4 (`sessao-chat-*`); a resposta real depende da chave xAI |

Requisitos Android: Material 3, alvos de 48dp ou mais e 320px/paisagem foram verificados nos shots ✅. Voltar/gesto (`useBackOverlay`, com testes) ✅ em código, falta o aparelho. Tratamento de erros (planilha vazia ou malformada, sem rede, limite da API, permissão negada) ✅ em testes e UI.

**Perguntas objetivas (revisão final, momento d).**
(d1) Os 8 itens da P4 foram resolvidos? Responda sim/não por item e diga o que sobrou.
(d2) Erros com dados (lista, filtros, revisão um a um), Plano (detalhe) e Progresso com dados: há algum bloqueador visual ou de acessibilidade antes do merge?
(d3) Algum problema de prioridade alta que deva impedir o merge na main e a tag `v1.0-estavel`? O que pode ficar para depois?
(d4) O checklist acima está correto? Falta algum risco a testar no aparelho real (Doze, alarme exato no Android 14+, voltar, TalkBack)?
Responda no formato VEREDITO / PROBLEMAS / MELHORIAS (prioridade + esforço) / COMPARAÇÃO / FONTES.
