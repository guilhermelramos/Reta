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
