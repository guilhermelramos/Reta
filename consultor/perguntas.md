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
