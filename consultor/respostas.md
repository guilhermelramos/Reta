# Respostas do Consultor

## P1 — momentos (a) diagnóstico + (b) antes do redesign — 2026-11-01 (UTC-3)

**Premissas assumidas:** (1) avaliação só por screenshots (Chromium 393×851) e código, sem aparelho; (2) "M3 mínimo" = o que é verificável numa WebView sem Jetpack Compose; (3) o login é só a entrada da chave xAI (sem OAuth); (4) `sessao-dark.png` mostra "Bloco não encontrado" porque foi aberta sem bloco válido. Leio isso como um estado de erro real, não como a tela de estudo.

### VEREDITO
A identidade visual (escuro, âmbar, serifa) é boa e o contraste base passa, mas o app ainda não se comporta como app Android: a IA e o login quebram em silêncio, o botão voltar fecha o app, a navegação e os alvos de toque estão abaixo do padrão, a tela Hoje mostra 4 cartões vazios e não tem modo claro. Recomendo manter a identidade e adotar só o essencial do M3, começando por fluxo e estados antes do visual.

### PROBLEMAS (ordem de prioridade)
1. **Falhas silenciosas (bloqueante).** Onde: `ajustes.tsx` "Testar conexão" fica preso em "Testando…" (`shots/ajustes-testar-conexao-apk.png`). O mesmo vale para gerar pacote e para o chat (`teacher-chat.tsx`), porque os createServerFn dão 404 no APK. Por que é problema: o usuário não sabe se o erro foi dele, da rede ou do app. Correção: (a) todo pedido de rede com timeout de 15 s e estados `idle/loading/success/error`; (b) um componente único `<ErrorState>` (ver Melhoria 5) com título, causa em uma frase e uma ação; (c) o botão em loading mostra spinner de 20dp mais o texto "Testando…" e volta para "Tentar de novo" quando dá erro.
2. **O botão voltar do Android fecha o app.** Onde: falta `@capacitor/app` backButton. Correção: no `backButton`, se a gaveta do chat ou um diálogo estiver aberto, fechar; se `canGoBack`, chamar `history.back()`; se estiver em Hoje, sair (`App.exitApp()`) ou mostrar um toast "Toque de novo para sair". Na sessão com timer ativo, voltar **não** encerra o timer.
3. **Alvos de toque < 48dp.** Onde: `log.txt`: botões de 44px (Trocar planilha, Exportar resumo, Preparar semana, Voltar para hoje, Recalcular, Novo dia, linhas de dia no Plano com 357×44), inputs de 96×44 e **checkboxes de 20×20** em `ajustes.tsx`. A navegação usa `min-h-14 min-w-11` (`shell.tsx:112`, 44px de largura mínima). Correção: trocar `min-h-11` por `min-h-12` (48px) de forma global; checkbox com o visual de 20px dentro de um `label` clicável com 48×48 no mínimo (ou a linha inteira clicável com `min-h-12`, padrão de item de lista M3); inputs com `h-12`; pelo menos 8dp entre alvos vizinhos.
4. **Hierarquia da tela Hoje.** Onde: `index.tsx`, `hoje-dark.png`. Em dia de descanso aparecem 4 cartões de "0 min / Sem carga hoje" do mesmo tamanho, e duas ações secundárias (Trocar planilha, Exportar resumo) ficam **acima** do conteúdo. "Preparar semana" fica num cartão solto. Também há ruído: "Pacote na hora" se repete em todo cartão. Correção: (a) topo com data, título e um **cartão herói** com a próxima ação (ou "Hoje é descanso 🎉" com o CTA opcional "Revisar erros (N)"); (b) blocos vazios recolhidos numa linha só ("Bloco B, Revisão e Leitura: sem carga hoje"); (c) Trocar planilha e Exportar vão para um menu de overflow (⋮) no topo ou para Ajustes; (d) "Preparar semana" vira um cartão de sugestão com dispensar; (e) espaçamento de 16dp nas margens laterais e 12dp entre cartões, e o cartão herói usa `surface-2` com borda âmbar (já existe) só quando há tarefa.
5. **Navegação inferior fora do padrão.** Onde: `shell.tsx:98-123`. Tem 56px de altura, sem indicador de item ativo (só a cor âmbar no ícone e no texto) e rótulos de 12px. Correção (M3 Navigation bar): altura de 80dp, indicador ativo em pílula de 64×32dp atrás do ícone (âmbar a ~24% sobre o fundo, com ícone em `fg`), ícone de 24dp, rótulo de 12sp medium, `aria-current="page"` no item ativo e `pb-[env(safe-area-inset-bottom)]` (já existe). Esconder a barra dentro da Sessão (modo foco).
6. **Sem modo claro e sem respeitar o sistema.** Onde: `styles.css` só tem tokens escuros. O Android recomenda dar suporte ao tema escuro **e** seguir a configuração do sistema. Correção: ver Melhoria 2.
7. **Contraste e texto pequeno.** Pelos tokens: `fg #f3efe4` sobre `bg #10130f` dá ~16:1 e `muted #b7ae9c` sobre `surface #1a1f18` dá ~7.9:1, ambos acima do AA (4.5:1). O risco está nos textos com `text-xs` e opacidades `/50 /60` (dezenas de usos em `plano.tsx`, `study-view.tsx`, `sessao.tsx`, `erros.tsx`), como "Pacote na hora" no screenshot, que aparece bem mais apagado. Correção: proibir opacidade abaixo de /80 em texto; tamanho mínimo de 12sp para metadados e 14sp para corpo (16sp no texto da questão e do chat); medir cada par com o checador de contraste do Accessibility Scanner no aparelho. A serifa vale só para títulos (≥ 20sp), com a sans no corpo.
8. **Estados vazios e de erro crus.** Onde: `sessao-dark.png` "Bloco não encontrado" é uma tela preta com um botão e sem explicação. Planilha vazia ou malformada ainda não foi validada (`importar.tsx`). Correção: Melhoria 5.
9. **Chave xAI em texto puro no IndexedDB, dentro de Ajustes.** Por que é problema: segurança, e o usuário não descobre que precisa de uma chave. Correção: guardar em armazenamento seguro (Keystore via plugin de secure storage) e criar o fluxo de onboarding da Melhoria 3.
10. **Notificações e timer não confiáveis.** Só existe a Notification API web, o manifest só pede INTERNET e o `<a download>` não funciona na WebView. Correção: ver Melhorias 3 e 4. Isso é engenharia, mas afeta diretamente a confiança do usuário.
11. **Rótulos de acessibilidade.** O link "Ir para o conteúdo" tem 1×1, o que é ok para skip link, mas ao receber foco ele precisa aparecer com 48dp. Os ícones da navegação precisam de nome acessível (hoje o texto visível resolve). Os checkboxes de Ajustes precisam de um `<label for>` associado. Validar com o TalkBack no aparelho (pendente).

### MELHORIAS
1. **(b1) M3: manter a identidade e adotar o "M3 essencial".** Prioridade alta, esforço M. Não recomendo migrar para cores dinâmicas: elas tirariam o âmbar, que é a marca, e numa WebView exigem plugin nativo. O mínimo que conta como M3 aqui: (a) tokens de papel M3 mapeados sobre a paleta atual: `surface`, `surface-container(-high)`, `on-surface`, `on-surface-variant`, `primary`, `on-primary`, `primary-container`, `error`, `outline`; (b) escala tipográfica M3 (display, headline, title, body, label) com a serifa só em headline/display; (c) Navigation bar de 80dp com indicador ativo; (d) alvos ≥ 48dp; (e) formas com cantos de 12dp em cartões, 20dp (pílula) em botões e 28dp em bottom sheets e diálogos; (f) estados de componente: hover/pressed como camada de 8–12% e foco visível; (g) Snackbar para feedback curto e Bottom sheet para o chat. Pode gerar os tokens no Material Theme Builder a partir de `#e4a04a` como cor fonte.
2. **(b2) Modo claro seguindo o sistema.** Prioridade média, esforço M. Ajustes > Aparência com "Sistema (padrão) / Claro / Escuro", padrão "Sistema". Tokens claros: fundo creme (ex.: `#fbf8f1`), texto `#1d1b16`, âmbar escurecido para ~`#8a5a14` em texto e ícones (âmbar puro sobre claro falha no 4.5:1). Aplicar com `prefers-color-scheme`, mais classe `.light`/`.dark` e `color-scheme`. Ajustar também as barras de status e navegação (plugin StatusBar). O escuro continua sendo a "cara" do app em screenshots e na loja.
3. **(b3) Onboarding e login com a chave xAI.** Prioridade alta, esforço M. Quatro telas, com pular disponível a partir da 2:
   - **1. Boas-vindas:** "Seu plano até a prova, um bloco por vez." Botão "Começar".
   - **2. Planilha:** "Importe sua planilha ou use o modelo." Botões "Importar .xlsx" e "Baixar modelo", com Share/Filesystem nativo. Se a planilha vier vazia ou malformada, mostrar o erro inline (Melhoria 5).
   - **3. Professor IA (opcional):** título "Conecte o Grok para gerar questões e tirar dúvidas". Abaixo, um expansor "Como conseguir a chave" com 3 passos (criar conta no console da xAI, criar a API key, colar aqui) e um botão "Abrir console xAI", que abre o navegador externo. Campo de senha com mostrar/ocultar, botão "Colar" e o botão principal "Verificar chave". A validação faz uma chamada leve à API e mostra spinner. **401:** "Chave inválida ou revogada. Confira se copiou inteira." **429:** "Limite da sua conta xAI atingido. Tente em alguns minutos." **Offline:** "Sem internet. Você pode verificar depois em Ajustes." O texto de confiança diz: "A chave fica guardada só neste aparelho, criptografada. O uso é cobrado na sua conta xAI." O botão secundário diz "Agora não" (o app funciona sem IA).
   - **4. Lembretes:** um cartão explicando o benefício **antes** do pedido do sistema: "Quer um aviso na hora de cada bloco e quando o timer acabar?" O pedido do sistema POST_NOTIFICATIONS só aparece se o usuário tocar em "Ativar lembretes". **Alarme exato** e **otimização de bateria** NÃO entram no onboarding. Peça só no momento de valor: na primeira vez que o usuário inicia um timer ou agenda um lembrete com horário, com uma frase de contexto ("Para o aviso tocar no minuto certo com a tela bloqueada, permita alarmes exatos"). Se a permissão for negada, use alarme inexato e mostre um aviso discreto em Ajustes > Notificações > Status com o botão "Abrir configurações". A orientação de bateria fica só em Ajustes ("Avisos atrasando? Toque aqui"), nunca como bloqueio.
4. **(b4) Tela de estudo e timer.** Prioridade alta, esforço M.
   - **Timer:** fica no topo, numa barra fixa (app bar) de 64dp com o tempo em fonte mono/tabular de 32–36sp, o nome do bloco em title-small e uma barra de progresso linear de 4dp por baixo. Esconder a navegação inferior.
   - **Controles:** botão principal Pausar/Retomar numa pílula de 56dp à direita. "Encerrar" fica num botão de texto que abre um diálogo de confirmação ("Encerrar e salvar 23 min?"), para não cair por toque acidental.
   - **Notificação persistente:** "Bloco A · 23:14 restantes" com as ações Pausar/Encerrar. O término vem de uma notificação agendada para `startedAt + duração`, porque a fonte de verdade já é o horário salvo. Se precisar de contagem viva com a tela bloqueada, usar foreground service do tipo `specialUse`/`shortService` conforme as regras de tipos de FGS; senão, basta a notificação agendada (mais simples, e a Play exige justificativa para FGS).
   - **Chat:** abre num **bottom sheet modal** (M3, cantos de 28dp, altura de 90% com alça de arraste) por um FAB "Perguntar ao professor" de 56dp, ou um ícone na app bar. O timer continua visível como chip no topo do sheet ("⏱ 23:14"), e fechar o sheet com voltar ou gesto não pausa o timer.
5. **(b5) Estados de erro padronizados.** Prioridade alta, esforço P–M. Dois componentes: `<InlineError>` (banner M3 dentro do cartão, ícone, 1 frase, 1 ação) e `<ErrorState>` (tela cheia, ilustração ou ícone de 48dp, título, 1 frase, botão primário e um link secundário opcional). Snackbar só para erro transitório de uma ação.
   - **Sem internet:** "Você está offline. Pacotes baixados continuam funcionando." Ação: "Tentar de novo". Bloquear só as funções de IA.
   - **429:** "Muitas perguntas seguidas. Aguarde ~1 min." Ação: botão de retry com contagem regressiva (respeitar o `Retry-After` se vier).
   - **401:** "Chave xAI inválida." Ação: "Atualizar chave", que leva a Ajustes.
   - **Permissão negada:** "Lembretes desativados. Você não vai receber aviso do timer." Ação: "Abrir configurações" (intent de app settings).
   - **Planilha vazia ou malformada:** "Não encontramos as colunas Data, Bloco A, Bloco B e Revisão." Listar a linha/coluna com problema. Ações: "Escolher outro arquivo" e "Baixar modelo".
   - **Bloco não encontrado:** "Esse bloco não existe mais no seu plano (talvez a planilha tenha mudado)." Ação: "Ver plano de hoje".
6. **(b6) Ordem do redesign por tela (para as revisões c).** Prioridade alta, esforço —. 1) Onboarding/Login, 2) Sessão (timer + chat), 3) Hoje, 4) Ajustes (alvos, notificações, aparência, chave), 5) Importar, 6) Erros/revisão, 7) Plano, 8) Progresso. A justificativa é que as quatro primeiras dependem das correções de engenharia 1–4 e são o caminho de uso diário.
7. **Feedback háptico e Snackbar** ao concluir um bloco ou uma revisão. Prioridade média, esforço P.
8. **Paisagem e telas largas:** limitar o conteúdo a 600dp de largura e centralizar. Em ≥ 600dp, usar navigation rail. Prioridade baixa, esforço P.
9. **Formulários de Ajustes:** agrupar em seções com cabeçalho (Conta/IA, Notificações, Aparência, Dados) e usar switches M3 (track de 52×32 dentro de uma linha de 48dp+) no lugar dos checkboxes. Prioridade média, esforço P.

### COMPARAÇÃO
- **AnkiDroid:** fila do dia em destaque (contagens novo/aprender/revisar) e tela de estudo em foco com botões de resposta grandes no rodapé. Tem tema claro/escuro seguindo o sistema e mostra o tempo por cartão de forma discreta. Para o Reta: tela Hoje com "o que fazer agora" e estudo sem navegação. (Comportamento observado no app; sem fonte verificada nesta resposta.)
- **Duolingo:** onboarding pede a meta e mostra valor **antes** de pedir notificação, com tela própria explicando os lembretes antes do diálogo do sistema. Para o Reta: a tela 4 do onboarding. (Observação de produto; sem fonte verificada.) O padrão de explicar antes de pedir é o recomendado pela documentação do Android (fonte abaixo).
- **Quizlet:** modo "Aprender" em tela cheia com barra de progresso no topo e "sair" exigindo confirmação. Erros e respostas aparecem como feedback inline colorido. Para o Reta: progresso de 4dp e confirmação ao encerrar. (Sem fonte verificada.)

### FONTES (status HTTP 200 verificado em 2026-11-01)
- M3 Navigation bar (specs): https://m3.material.io/components/navigation-bar/specs
- M3 estrutura/layout: https://m3.material.io/foundations/designing/structure
- M3 cor a partir de fonte do usuário/dinâmica: https://m3.material.io/styles/color/dynamic/user-generated-source
- Android: permissão de notificação (explicar antes, Android 13+): https://developer.android.com/develop/ui/views/notifications/notification-permission
- Android 14: SCHEDULE_EXACT_ALARM negado por padrão: https://developer.android.com/about/versions/14/changes/schedule-exact-alarms
- Doze e App Standby: https://developer.android.com/training/monitoring-device-state/doze-standby
- Tipos de foreground service: https://developer.android.com/develop/background-work/services/fgs/service-types
- Tema escuro e seguir o sistema: https://developer.android.com/develop/ui/views/theming/darktheme
- Alvos de toque 48dp e contraste (Accessibility Scanner): https://support.google.com/accessibility/android/answer/7101858
- WCAG 2.2 contraste mínimo: https://www.w3.org/TR/WCAG22/#contrast-minimum
- Capacitor Local Notifications: https://capacitorjs.com/docs/apis/local-notifications
- Capacitor App (backButton): https://capacitorjs.com/docs/apis/app
- xAI docs (console/API key): https://docs.x.ai/docs/overview
- Reviews da Play Store de Anki/Duolingo/Quizlet: sem fonte (não consultadas nesta rodada).


## P2

_Resposta gerada pelo Gemini (Argon, raciocínio alto) a pedido do Guilherme; repassada sem edição._

### VEREDITO

O redesenho da branch `integracao-fase2` elevou a maturidade visual do Reta e acertou em decisões críticas de arquitetura Android (como adiar permissões sensíveis e isolar a chave no Keystore), mas ainda apresenta **falhas estruturais de fluxo e layout** que prejudicam a conversão no Onboarding e a ergonomia da Sessão. Os pontos mais urgentes são a saída única por `"Pular"` no passo 2 (que aborta o passo de Lembretes), a contradição entre tempo decorrido no cabeçalho (`00:02`) e tempo restante no chip do Professor (`59:58`), o corte horizontal dos chips de sugestão no chat e o bug de paisagem na Sessão, onde o menu lateral reaparece e o FAB `"Professor"` encobre o título do cartão.

---

### PROBLEMAS

#### 1. Onboarding (`src/routes/boas-vindas.tsx`) — Perguntas (c1)

1. **Saída do Passo 2 (Planilha) força o usuário a pular Chave e Lembretes**
* **Onde:** Passo 2 (`onboarding-2-dark-360.png`).


* **Por quê:** Não há um botão secundário para avançar apenas um passo sem planilha. Se o aluno quiser testar o app primeiro e tocar em `"Pular"` no canto superior direito, ele encerra o onboarding inteiro de uma vez, perdendo a configuração opcional do Grok (Passo 3) e, principalmente, o pedido contextual de notificações dos Lembretes (Passo 4). Além disso, o texto de rodapé exibe `"36 dias no plano atual."` antes mesmo de o usuário importar qualquer planilha, gerando confusão sobre qual plano está ativo.


* **COMO CORRIGIR:**
* **Fluxo (c1 — Ordem e "Agora não" vs. "Pular"):** A ordem `Boas-vindas → Planilha → Chave → Lembretes` funciona bem **desde que** cada passo opcional (2, 3 e 4) tenha avanço unitário. No Passo 2, adicione no rodapé um `TextButton` M3 **`"Agora não (usar plano de exemplo)"`** (`height: 48dp`, `padding: 0 16dp`, texto `#E4E4E7`, `14sp`, `font-weight: 500`) que avança **apenas para o Passo 3** (`setStep(3)`), mantendo `"Pular"` no topo direito (`48×48dp` de área de toque) para quem quiser encerrar tudo. No texto de apoio, oculte `"36 dias no plano atual"` até que um arquivo seja de fato importado.


* **Contador de passos consistente:** No Passo 1 o topo direito exibe `"Passo 1 de 4"`, mas nos Passos 2 a 4 esse rótulo some para dar lugar a `"Pular"`. Mantenha a contagem acessível junto aos indicadores de pontos (`aria-label="Passo 2 de 4"`) e alinhe os pontos indicadores na mesma linha horizontal do botão `"Pular"` para economizar `24dp` de altura vertical.






2. **Passo 3 (Professor IA): acordeão sem ícone de estado, botão primário ativo sem chave e atrito precoce**
* **Onde:** Passo 3 fechado (`onboarding-3-light-paisagem.png`) e aberto (`onboarding-3-chave-aberta-dark-360.png`).


* **Por quê:**
1. O componente `"Como conseguir a chave"` fechado parece um botão ou caixa estática porque não tem ícone de chevron (`expand_more` / `expand_less`) indicando que é expansível.


2. O botão `"Abrir console xAI"` dentro do expansor não indica que abrirá o navegador externo.


3. O botão primário `"Verificar chave"` está estilizado como habilitado (`#E59A46`) mesmo com o campo `xai-...` vazio, induzindo ao clique e a um erro de validação desnecessário.




* **COMO CORRIGIR:**
* **Fluxo (c1 — Chave no onboarding vs. após 1º bloco):** Mantenha o Passo 3 no onboarding para usuários avançados que já possuem a chave, mas se o campo estiver vazio, desabilite `"Verificar chave"` (`background: rgba(228, 228, 231, 0.12)`, texto `rgba(228, 228, 231, 0.38)`) e destaque `"Agora não"` (`height: 48dp`). Quando o usuário tentar usar `"Gerar Aula..."` ou `"Professor"` na Sessão sem chave configurada, abra o mesmo formulário da chave em um **Modal Bottom Sheet contextual** (lazy onboarding).


* **Componente e medidas:** No cabeçalho do expansor `"Como conseguir a chave"` (`height: 52dp`, `padding: 0 16dp`, `border: 1dp solid #2E332E`, `border-radius: 12dp`), adicione à direita o ícone Material `expand_more` (`24dp`, cor `#A1A1AA`) que rotaciona `180deg` quando aberto. No botão `"Abrir console xAI"` (`height: 48dp`, `background: #1F241F`), adicione à direita o ícone `open_in_new` (`18dp`, espaçamento `8dp` do texto).






3. **Passo 4 (Lembretes) em 320px: tipografia desproporcional dentro do card e texto duplicado**
* **Onde:** Passo 4 em viewport de 320px (`onboarding-4-light-320.png`).


* **Por quê:** O título serifado `"Quer um aviso na hora de cada bloco e quando o timer acabar?"` está dentro de um cartão com borda e `padding` interno, reduzindo a largura útil de texto para `~240dp` e forçando uma quebra pesada em 4 linhas grandes. Além disso, há redundância direta: dentro do cartão lê-se *"Você pode mudar isso quando quiser em Ajustes."* e imediatamente abaixo do cartão repete-se *"Você pode ativar depois em Ajustes."*.


* **COMO CORRIGIR:**
* **Tipografia e espaçamento em 320px:** Reduza o título em telas estreitas (`max-width: 340px`) usando `clamp(22px, 6vw, 28px)` com `line-height: 1.25` (ou mova o título para fora do card, seguindo o exato padrão visual dos Passos 1, 2 e 3).


* **Limpeza de copy:** Remova a frase duplicada fora do cartão (`"Você pode ativar depois em Ajustes."`) e, no APK nativo, exiba o botão primário `"Ativar lembretes"` (`56dp`, `#E59A46`) acompanhado de um `TextButton` `"Agora não"` (`48dp`, `#A1A1AA`) logo abaixo, com `gap: 8dp`.






4. **Onboarding em Paisagem (780×360): rolagem vertical excessiva em coluna única**
* **Onde:** `onboarding-3-light-paisagem.png`.


* **Por quê:** Empilhar cabeçalho, indicadores, overline, título serifado de 2 linhas, parágrafo, acordeão, input, aviso de privacidade e dois botões em uma coluna única de `600px` dentro de `360dp` de altura esconde as ações principais abaixo da dobra.


* **COMO CORRIGIR:**
* Em `orientation: landscape` e `max-height: 480dp` (WindowSizeClass *Compact Height*), aplique um grid de **2 colunas** (`max-width: 720dp`, `display: grid`, `grid-template-columns: 5fr 6fr`, `gap: 24dp`, `align-items: start`):
* **Coluna Esquerda:** Cabeçalho Reta + indicador de pontos + Overline + Título Serifado + Texto descritivo.
* **Coluna Direita:** Controles de ação (botões de planilha no Passo 2; expansor + input + botões no Passo 3; cartão de aviso + botões no Passo 4).









---

#### 2. Sessão de Estudo (`src/routes/_shell/sessao.tsx` e `teacher-chat.tsx`) — Perguntas (c2, c3, c4)

5. **Conflito de modelo mental no Timer: Decorrido no cabeçalho vs. Restante no Bottom Sheet**
* **Onde:** Cabeçalho da Sessão (`00:01`, `00:02`, `00:03` com `"Restam 59:59"` pequeno) vs. Chip do Bottom Sheet do Professor (`59:58`).


* **Por quê:** Na Sessão principal o número grande mostra o tempo **decorrido** (contagem progressiva), mas ao abrir a gaveta do Professor o chip em destaque mostra o tempo **restante** (contagem regressiva `59:58`). Isso obriga o cérebro do aluno a recalcular mentalmente em qual direção o relógio está andando.


* **COMO CORRIGIR (c2 — Decorrido ou Restante?):**
* **Padrão único em todo o app: Tempo Restante (contagem regressiva) como número principal.** Como cada bloco da planilha tem duração meta definida (ex.: 60 min), o aluno trabalha em *timeboxing*: o dado primário é **quanto falta para concluir o bloco** (`59:59`), exatamente como já está no chip do Professor (`59:58`).


* **Hierarquia e medidas do Timer:**
* **Número principal (Restante):** `59:59` em fonte monoespaçada (`JetBrains Mono` ou `Roboto Mono`), `36sp`, `font-weight: 600`, `font-variant-numeric: tabular-nums`, cor `#F4F4F5` (`onSurface`), `letter-spacing: -0.5px`.


* **Sub-barra abaixo da barra de progresso:** Exiba à esquerda o tempo decorrido consolidado: `"1 min estudado de 60 min"` (`13sp`, cor `#A1A1AA` `onSurfaceVariant`).








6. **Botão "Pausar" idêntico a "Iniciar", barra de progresso invisível e link "Hoje" fora do padrão Android**
* **Onde:** Topo da tela `sessao-dark-360.png` e `sessao-timer-rodando-dark-360.png`.


* **Por quê:**
1. `"Iniciar"` (`00:00`) e `"Pausar"` (`00:01`) têm exatamente a mesma cor de preenchimento âmbar `#E59A46`, não transmitindo mudança de estado visual periférico.


2. A barra de progresso entre o timer e a sub-barra tem apenas `~2dp` de espessura e contraste quase nulo contra o fundo escuro.


3. O link `"Hoje"` (`27×48px`) está solto abaixo do cabeçalho fixo, sublinhado como link web e sem ícone de seta de retorno, enquanto `"Encerrar"` também usa sublinhado HTML.




* **COMO CORRIGIR (c2 — Timer, Pausar/Encerrar e Progresso):**
* **Botão Iniciar / Retomar vs. Pausar (`height: 56dp`, `border-radius: 28dp`, `padding: 0 24dp`):**
* Estado **Parado / Pausado (`"Iniciar"` / `"Retomar"`)**: *Filled Button* M3 com fundo `#E59A46` (`primary`), texto e ícone `play_arrow` em `#18181B` (`onPrimary`), `16sp`, `font-weight: 600`.


* Estado **Rodando (`"Pausar"`)**: *Filled Tonal / Outlined Button* com fundo `#2A2218`, borda `1.5dp solid #E59A46`, texto e ícone `pause` em `#E59A46`.




* **Barra de Progresso (`LinearProgressIndicator` M3):** Aumente a espessura para **`6dp`** (`border-radius: 3dp`), trilha inativa `#27272A` (`surfaceContainerHighest`) e indicador ativo `#E59A46` (`primary`), com espaçamento vertical de `12dp` acima e `8dp` abaixo.


* **Botão Voltar e "Encerrar":** Remova o link `"Hoje"` solto do corpo da página. Insira um `IconButton` M3 (`48×48dp`, ícone `arrow_back` de `24dp` na cor `#E4E4E7`) à esquerda do título `"Bloco A · Matemática"` no cabeçalho fixo. Mantenha `"Encerrar"` à direita da sub-barra como um `TextButton` sem sublinhado (`min-height: 48dp`, `padding: 0 12dp`, `border-radius: 8dp`, texto `14sp`, `font-weight: 500`, cor `#F87171` ou `#D4D4D8`).






7. **Dois cartões de Empty State redundantes, botão quebrando em 2 linhas e colisão do FAB "Professor"**
* **Onde:** Corpo da Sessão em retrato (`sessao-dark-360.png`, `sessao-timer-rodando-dark-360.png`) e paisagem (`sessao-timer-rodando-light-paisagem.png`).


* **Por quê:**
1. A tela mostra dois cartões seguidos dizendo praticamente a mesma coisa: *"Este bloco ainda não tem material rico"* (com botão `"Gerar Aula, Flashcards e Questões com IA"`) e *"A aula deste bloco ainda não está neste aparelho"* (com botão `"Montar esta aula"`).


2. O botão `"✨ Gerar Aula, Flashcards e Questões com IA"` quebra em duas linhas a 360px, deixando a sigla `"IA"` isolada na segunda linha.


3. Em retrato (`360px`), o FAB `"Professor"` sobrepõe o canto inferior direito do segundo cartão. Em paisagem (`780×360`), o FAB sofre um **bug crítico de posicionamento**, flutuando no topo direito do primeiro cartão e **encobrindo o título `"Este bloco ainda não tem material rico"**`!




* **COMO CORRIGIR (c2 — Conteúdo e FAB):**
* **Unificar os 2 cartões em 1 único Card de Empty State:** Remova o segundo cartão (`"A aula deste bloco ainda não está neste aparelho"`). Mantenha apenas o primeiro cartão (`padding: 20dp`, `border-radius: 16dp`, `background: #181C18`, `border: 1dp solid #2E332E`).


* **Rótulo de botão em 1 linha:** Altere o texto do CTA de `"Gerar Aula, Flashcards e Questões com IA"` para **`"✨ Gerar material com IA"`** (`height: 48dp`, `border-radius: 12dp`, `font-size: 15sp`, `font-weight: 600`, `white-space: nowrap`), pois o parágrafo acima já descreve resumo, 5 flashcards e 4 questões.


* **Posicionamento e afastamento do Extended FAB `"Professor"`:** Fixe o FAB em relação à viewport (`position: fixed; right: 16dp; bottom: calc(16dp + env(safe-area-inset-bottom)); z-index: 30`), com `height: 56dp`, `padding: 0 20dp`, `border-radius: 16dp`, `background: #262016`, `border: 1.5dp solid #E59A46`, texto/ícone `#E59A46` e sombra `0 6px 16px rgba(0,0,0,0.45)`. Adicione `padding-bottom: 96dp` no container rolável da Sessão para que o último cartão nunca encoste no FAB.






8. **Bottom Sheet do Professor: avisos repetidos, chips cortados na horizontal e botão "Enviar" sempre ativo**
* **Onde:** `sessao-chat-dark-360.png`.


* **Por quê:**
1. O topo do sheet diz `"Professor · o tempo segue contando"` (espremido entre o chip `59:58` e o botão `✕`) e a caixa tracejada logo abaixo repete `"O cronômetro continua contando com a gaveta aberta."`.


2. Os chips de pergunta rápida (`"Por que a..."` na linha 1 e `"Resum..."` na linha 2) aparecem **cortados na borda direita** sem margem de respiro ou fade visual, parecendo erro de CSS.


3. O botão `"Enviar"` ocupa largura excessiva ao lado do campo de texto e permanece com cor ativa mesmo com o input vazio.


4. O link `"Caderno"` à direita de `"Matemática"` não tem aparência de botão tocável.




* **COMO CORRIGIR (c2 — Bottom Sheet do Professor):**
* **Cabeçalho do Sheet (`padding: 8dp 16dp 12dp`):** Mantenha a alça de arraste M3 (`width: 32dp`, `height: 4dp`, `border-radius: 2dp`, `#52525B`, `margin: 8dp auto`). Na linha principal do cabeçalho, coloque: à esquerda o chip `⏱ 59:58` (`height: 32dp`, `padding: 0 10dp`, `border-radius: 16dp`, `background: #2A2218`, `border: 1dp solid #E59A46`, texto `#E59A46` em `13sp mono`); no centro/esquerda o título **`"Professor IA"`** (`16sp`, `font-weight: 600`, `#F4F4F5`), removendo o texto `"· o tempo segue contando"` do cabeçalho (pois já consta no empty state); e à direita o botão `"Caderno"` como `AssistChip` (`height: 32dp`, ícone `menu_book` `16dp`, borda `#3F3F46`) seguido do `IconButton` fechar `✕` (`48×48dp` de alvo de toque).


* **Chips de pergunta rápida (`SuggestionChip` M3):** Quando o chat estiver vazio, exiba os chips em um carrossel horizontal de **linha única** (ou lista vertical compacta dentro do próprio estado vazio, desaparecendo após a 1ª mensagem enviada). Se mantiver rolagem horizontal acima do input: use `display: flex; overflow-x: auto; gap: 8dp; padding: 8dp 16dp; scroll-padding-left: 16dp`, altura do chip `36dp`, `border-radius: 8dp`, `background: #1F241F`, `border: 1dp solid #3F3F46`, texto `13sp` `#E4E4E7` (sem destacar o primeiro chip em laranja para não parecer selecionado previamente), aplicando `mask-image: linear-gradient(to right, #000 88%, transparent 100%)` na borda direita.


* **Barra de entrada (`padding: 8dp 16dp calc(12dp + env(safe-area-inset-bottom))`):** Mantenha o botão de microfone (`48×48dp`, `border-radius: 12dp`), o campo `"Pergunte sobre este trecho"` (`flex: 1`, `min-height: 48dp`, `border-radius: 24dp`, `padding: 0 16dp`, `background: #141714`, `border: 1dp solid #2E332E`) e substitua o botão textual `"Enviar"` por um **`IconButton` preenchido de `48×48dp**` (`border-radius: 24dp`, ícone `arrow_upward` ou `send` de `20dp`), desabilitado (`#27272A`, ícone `#52525B`) enquanto o campo estiver vazio e âmbar (`#E59A46`, ícone `#18181B`) quando houver texto.






9. **Notificação em segundo plano sem Foreground Service e Alarme Exato — Pergunta (c3)**
* **Onde:** Arquitetura de notificações (`src/lib/study/session-timer.ts` e `exact-alarm.ts`) e fluxo de início da Sessão.


* **Por quê:** Apenas agendar uma notificação silenciosa para o futuro (`endsAt`) deixa a gaveta de notificações do Android completamente vazia durante os 60 minutos de estudo. Se o usuário bloquear a tela ou alternar para um PDF/navegador, ele perde a referência visual de quanto tempo falta na gaveta/tela de bloqueio.
* **COMO CORRIGIR (c3 — Contagem viva sem Foreground Service + Momento do Alarme Exato):**
* **Como ter contagem regressiva viva na gaveta SEM Foreground Service:** No Android (API 24+ / Android 7.0+), o próprio `SystemUI` renderiza um cronômetro regressivo vivo numa notificação comum sem que o seu app precise rodar em segundo plano ou atualizar a notificação a cada segundo! Ao tocar em `"Iniciar"` (ou quando o app for para `background` com o timer rodando), dispare uma notificação local em andamento configurando no builder nativo:
* `setUsesChronometer(true)`
* `setChronometerCountDown(true)`
* `setWhen(endsAtTimestampMs)`
* `setOngoing(true)` e `setOnlyAlertOnce(true)`
* Adicione 2 `NotificationCompat.Action`: `"Pausar"` e `"Encerrar"`. Quando o usuário pausar ou o alarme de término (`endsAt`) disparar, cancele/substitua essa notificação pelo alerta final `"Bloco concluído · N min"`.


* **Momento do pedido de Alarme Exato (`SCHEDULE_EXACT_ALARM`):** Pedir na **primeira vez que o usuário toca em `"Iniciar"` na Sessão** (e não no Passo 4 do Onboarding) está **perfeito e alinhado às boas práticas do Android Developers**. Apenas exiba um `AlertDialog` curto no app antes de chamar a Intent do sistema (*"Para avisar no segundo exato em que o bloco acabar, ative a permissão de alarmes precisos na tela a seguir"*) e implemente fallback automático para alarme inexato caso o usuário negue.






10. **Sessão em Paisagem (780×360): Menu lateral visível e falta de Split View — Pergunta (c4)**
* **Onde:** `sessao-timer-rodando-light-paisagem.png`.


* **Por quê:**
1. A regra de esconder a navegação principal na Sessão funcionou apenas para a barra inferior em retrato (`360px`); em paisagem (`780×360`), a **sidebar/drawer lateral esquerda** (`Reta`, `Hoje`, `Plano`, `Progresso`, `Erros`, `Ajustes`) continuou aberta, roubando `~220dp` de largura e quebrando o isolamento da sessão.


2. Com apenas `360dp` de altura na tela, o cabeçalho fixo do timer ocupa mais de `115dp` verticais, deixando uma área útil muito estreita para leitura de aulas e questões.




* **COMO CORRIGIR (c4 — Mudar de layout ou só rolar?):**
* **1. Ocultar a sidebar esquerda na rota `/_shell/sessao` em qualquer largura de tela**.


* **2. Mudar para layout de 2 colunas (Split View) em paisagem (`@media (orientation: landscape) and (min-width: 600px)`):**
* **Coluna Esquerda fixa (`width: 260dp`, `height: 100dvh`, `padding: 16dp`, `border-right: 1dp solid #27272A`, `display: flex`, `flex-direction: column`, `justify-content: space-between`):** Topo com botão `← Hoje` + `"Bloco A · Matemática"`; centro com o timer `59:59` (`40sp`), barra de progresso de `6dp`, `"0 min estudados"` e botões `"Pausar"` (`48dp`) e `"Encerrar"`; base da coluna com o botão **`"💬 Professor"` fixo dentro do painel esquerdo** (`width: 100%`, `height: 48dp`), eliminando de vez a sobreposição do FAB sobre o conteúdo da direita.


* **Coluna Direita rolável (`flex: 1`, `height: 100dvh`, `overflow-y: auto`, `padding: 20dp 24dp`):** Aproveita 100% dos `360dp` de altura para leitura contínua da aula, flashcards e questões.







---

### MELHORIAS

| # | Melhoria | Prioridade | Esforço |
| --- | --- | --- | --- |
| **1** | **Unificar modelo do Timer para Contagem Regressiva (`Restante`)** no cabeçalho da Sessão (`59:59`), alinhando-o com o chip do Bottom Sheet (`59:58`) e deixando o tempo estudado (`N min estudados`) na sub-barra.

 | **Alta** | **P** |
| **2** | **Corrigir bugs de Paisagem na Sessão (`780×360`):** ocultar a sidebar esquerda na rota `/sessao`, corrigir o posicionamento do FAB `"Professor"` que cobre o título do card e aplicar layout Split View (timer à esquerda, conteúdo à direita).

 | **Alta** | **M** |
| **3** | **Adicionar botão `"Agora não"` no Passo 2 (Planilha)** que avança apenas para o Passo 3 (sem abortar os passos de Chave e Lembretes como o `"Pular"` faz hoje) e ocultar `"36 dias no plano atual"` antes da importação.

 | **Alta** | **P** |
| **4** | **Refinar o Bottom Sheet do Professor:** corrigir o corte horizontal dos `SuggestionChips` com `padding-inline: 16dp` + fade, trocar o botão `"Enviar"` por `IconButton` de `48×48dp` desabilitado quando vazio e remover o aviso duplicado do cronômetro no topo.

 | **Alta** | **P** |
| **5** | **Eliminar o 2º cartão redundante da Sessão (`"A aula deste bloco..."`),** encurtar o botão principal para `"✨ Gerar material com IA"` (1 linha a 360px) e adicionar `padding-bottom: 96dp` para o FAB não colidir com o card.

 | **Alta** | **P** |
| **6** | **Implementar notificação `ChronometerCountDown` nativa** (`setUsesChronometer(true)` + `setChronometerCountDown(true)` + `setWhen(endsAt)`) para exibir contagem regressiva viva na gaveta do Android sem precisar de Foreground Service. | **Média** | **M** |
| **7** | **Diferenciar estado visual de `"Pausar"` vs. `"Iniciar"**` (Tonal/Outlined para `"Pausar"`, Filled `#E59A46` para `"Iniciar/Retomar"`), aumentar a barra de progresso para `6dp` e mover o botão voltar (`←`) para a App Bar superior.

 | **Média** | **P** |
| **8** | **Polir Passo 3 e Passo 4 do Onboarding:** adicionar chevron `expand_more` no acordeão da chave, desabilitar `"Verificar chave"` com input vazio, ajustar o título do Passo 4 em `320px` e remover a frase duplicada sobre Ajustes.

 | **Média** | **P** |
| **9** | **Lazy Onboarding da Chave xAI:** quando o usuário pular o Passo 3 e tocar em `"Gerar material com IA"` ou `"Professor"` na Sessão, abrir o componente de chave xAI dentro de um Modal Bottom Sheet sem tirá-lo da sessão.

 | **Baixa** | **M** |

---

### COMPARAÇÃO

* **Forest (Android — Foco e Timeboxing):**
* **Como faz:** Em blocos com meta de tempo definida, exibe sempre a **contagem regressiva (`59:59`)** como elemento central dominante, esconde toda a navegação global durante a sessão e usa notificação com cronômetro nativo na gaveta do Android para o aluno acompanhar o tempo restante com a tela bloqueada.
* **Lição para o Reta:** Adotar o tempo restante como número principal no cabeçalho da Sessão (resolvendo a dissonância com o chip `59:58` do chat) e esconder a barra de navegação lateral também em modo paisagem.




* **Duolingo (Android — Onboarding Progressivo e Permissões):**
* **Como faz:** Aplica *Progressive Disclosure*: nunca bloqueia ou assusta o usuário pedindo configurações complexas na entrada; cada etapa opcional tem um botão claro de avanço unitário (`"Agora não"`) na base da tela, e o pedido de notificações ocorre em tela dedicada com um único CTA claro e sem textos repetidos.
* **Lição para o Reta:** Incluir `"Agora não"` no Passo 2 da Planilha para que o aluno chegue até o Passo 4 (Lembretes) mesmo sem ter um `.xlsx` em mãos no primeiro minuto de uso.




* **AnkiDroid & Quizlet (Android — Estudo em Tela Cheia e Assistente IA):**
* **Como fazem:** No AnkiDroid, a tela de revisão (`Reviewer`) oculta qualquer menu lateral em retrato e paisagem e concentra as ações de navegação na `TopAppBar` com alvos mínimos de `48×48dp`. No Quizlet (Q-Chat), os chips de sugestão rápida aparecem como pílulas horizontais com `padding` lateral e somem assim que a conversa começa, liberando espaço vertical para as respostas quando o teclado virtual do Android sobe.
* **Lição para o Reta:** Colocar o botão voltar `←` (`48×48dp`) na `TopAppBar` da Sessão (em vez do link `"Hoje"` de `27×48px`) e ocultar os chips de pergunta rápida após o envio da primeira mensagem no sheet do Professor.





---

### FONTES

* **Material Design 3 — Bottom Sheets (Modal, Drag Handle, Ergonomia):** [https://m3.material.io/components/bottom-sheets/guidelines](https://m3.material.io/components/bottom-sheets/guidelines)
* **Material Design 3 — Extended FAB (Posicionamento, Elevação e Espaçamento):** [https://m3.material.io/components/extended-fab/guidelines](https://m3.material.io/components/extended-fab/guidelines)
* **Material Design 3 — Chips (`SuggestionChip` e `AssistChip`):** [https://m3.material.io/components/chips/guidelines](https://m3.material.io/components/chips/guidelines)
* **Material Design 3 — Progress Indicators (`LinearProgressIndicator`, espessura e contraste):** [https://m3.material.io/components/progress-indicators/specs](https://m3.material.io/components/progress-indicators/specs)
* **Material Design 3 — Layout Responsivo e Window Size Classes (Paisagem / Split View):** [https://m3.material.io/foundations/layout/applying-layout/window-size-classes](https://m3.material.io/foundations/layout/applying-layout/window-size-classes)
* **Android Developers — `NotificationCompat.Builder.setChronometerCountDown(boolean)` (Cronômetro regressivo nativo sem Foreground Service):** [https://developer.android.com/reference/androidx/core/app/NotificationCompat.Builder#setChronometerCountDown(boolean](https://www.google.com/search?q=https://developer.android.com/reference/androidx/core/app/NotificationCompat.Builder%23setChronometerCountDown(boolean))
* **Android Developers — Permissão de Alarmes Exatos (`SCHEDULE_EXACT_ALARM` e boas práticas de UX):** [https://developer.android.com/about/versions/14/changes/schedule-exact-alarms](https://developer.android.com/about/versions/14/changes/schedule-exact-alarms)
* **Android Developers — Solicitação de Permissões em Contexto (`POST_NOTIFICATIONS`):** [https://developer.android.com/training/permissions/requesting](https://developer.android.com/training/permissions/requesting)
* **Referências de produto analisadas:** AnkiDroid (`com.ichi2.anki` — [https://docs.ankidroid.org/](https://docs.ankidroid.org/)), Duolingo (`com.duolingo`), Forest (`cc.forestapp`), Quizlet (`com.quizlet.quizletandroid`).