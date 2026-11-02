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

## P3

_Resposta gerada pelo Gemini (Argon, raciocínio alto) a pedido do Guilherme; repassada sem edição._

### VEREDITO

A branch `integracao-fase2` resolveu os bloqueios críticos da P2 — unificando o cronômetro regressivo (`59:59`) entre topo e gaveta, corrigindo os alvos de toque para `>= 48dp` e acertando a hierarquia entre `Pausar` tonal e CTAs primários. Os problemas remanescentes concentram-se em redundâncias visuais que consomem altura útil (aviso de bloco pendente duplicado e repetição de "Só 15 min" em **Hoje**, triplo aviso de permissão em **Ajustes**, H1 duplicado no split view em **Sessão**) e no fluxo de **Importar**, que mantém o seletor de arquivo aberto acima da pré-visualização e empurra a confirmação para fora da dobra.

---

### PROBLEMAS

1. **(c2) Hoje — Banner "Bloco de hoje ainda não iniciado" redundante e competindo com o cartão herói:**
* **Onde:** Tela **Hoje** (`hoje-dark-360` e `hoje-light-paisagem`), entre o cartão herói (`Bloco A`) e a seção `Blocos de hoje`.


* **Por quê:** O aviso `Bloco de hoje ainda não iniciado: Bloco B · 40 min` repete exatamente a informação do primeiro cartão logo abaixo (`Bloco B · Física: Leis de Ohm · Pendente · 40 min`). Além disso, usa borda âmbar idêntica à do cartão herói (`#E6A243` / `outline`), diluindo o foco visual e consumindo `56dp` verticais na primeira dobra.


* **COMO CORRIGIR:** Remover o componente de banner intermediário. Manter apenas `16dp` de espaçamento (`margin-top: 16dp`) entre o fim do cartão herói e o subtítulo `Blocos de hoje`. Se o objetivo for alertar atraso após o horário agendado, exibir um `AssistChip` ou badge compacto (`Atrasado`) dentro do próprio cartão do `Bloco B` no lugar de `Pendente`.




2. **(c2) Hoje — Ação secundária "Só 15 min" repetida em todos os cartões (inclusive em bloco já em andamento e revisão de 20 min):**
* **Onde:** Tela **Hoje**, no cartão herói (`Bloco A · Em andamento · 1h`) e em todos os cartões da lista (`Bloco B · 40 min` e `Revisão · 20 min`).


* **Por quê:** (a) No `Bloco A` que já está `Em andamento`, oferecer `Continuar` ao lado de `Só 15 min` gera ambiguidade sobre se o timer atual será sobrescrito para 15 min; (b) na `Revisão` de `20 min`, um atalho de `Só 15 min` economiza apenas 5 minutos e adiciona ruído cognitivo; (c) repetir o botão de texto em cada linha reduz a escaneabilidade da lista.


* **COMO CORRIGIR:** Exibir o `TextButton` `Só 15 min` (`height: 48dp`, `padding-horizontal: 12dp`, cor `onSurfaceVariant`) **exclusivamente** no cartão herói quando o estado for `Pendente` (não iniciado) e a duração total do bloco for `>= 30 min`. Nos cartões secundários da lista (`Blocos de hoje`), manter apenas o botão `Iniciar` (`FilledTonalButton`, `height: 40dp` com área de toque de `48dp`).




3. **(c2) Hoje — Competição de hierarquia primária entre o cartão herói e "Preparar semana" + desalinhamento em paisagem (≥600dp):**
* **Onde:** Cartão inferior `Preparar semana` (`hoje-dark-360` e `hoje-light-paisagem`) e container principal ao lado da `NavigationRail`.


* **Por quê:** O botão `Preparar` usa o mesmo componente `FilledButton` âmbar (`background: primary #E6A243`, `color: onPrimary`) do CTA `Continuar` do cartão herói, enquanto os blocos reais de estudo (`Bloco B` e `Revisão`) usam botões escuros de baixa ênfase. Na versão paisagem (`≥600dp`), a `NavigationRail` de `80dp` funciona bem, mas a coluna de `600dp` fica colada à esquerda, deixando uma faixa vazia assimétrica à direita.


* **COMO CORRIGIR:** (a) Trocar o botão `Preparar` de `FilledButton` para `FilledTonalButton` (`background: secondaryContainer #2A312B`, `color: primary #E6A243`, `height: 48dp`), garantindo um único `FilledButton` primário na tela **Hoje**; (b) em viewports `>= 600dp`, centralizar o container de `600dp` na área útil à direita da `NavigationRail` (`margin-inline: auto`, `padding-inline: 24dp`).




4. **(c1) Sessão — Split view em paisagem repete o título H1, corta o CTA secundário e oculta o indicador de expansão do progresso:**
* **Onde:** Tela **Sessão** em paisagem (`sessao-timer-rodando-light-paisagem`).


* **Por quê:** O painel esquerdo já exibe `Bloco A / Matemática` ao lado do botão `←`, mas o painel direito repete um H1 `Matemática` em fonte serifada grande (`~32sp`), consumindo `~52dp` verticais em uma tela baixa e empurrando o botão `Montar esta aula` e o texto explicativo para fora da dobra inferior. Além disso, no painel esquerdo, o texto `0 min estudados de 60 min` perdeu o ícone chevron `⌄` (presente no retrato `[cite: 9]`) e ficou colado ao botão `Encerrar`.


* **COMO CORRIGIR:** (a) No breakpoint paisagem (`orientation: landscape`), ocultar o H1 `Matemática` do painel direito, alinhando o topo do cartão de conteúdo diretamente com o topo do painel esquerdo (`padding-top: 16dp`); (b) restaurar o ícone `expand_more` (`18dp`) ao lado de `0 min estudados de 60 min` no painel esquerdo e garantir `justify-content: space-between` com `gap: 8dp` mínimo antes de `Encerrar`; (c) renomear o botão secundário `Montar esta aula` para `Usar só a planilha (sem IA)` (`OutlinedButton`, `height: 48dp`), tornando o contraste com `Gerar material com IA` autoexplicativo sem depender da nota de rodapé.




5. **(c1) Sessão — Sheet do Professor IA com chips quebrando em 2 linhas e ícone de livro sem affordance clara:**
* **Onde:** Gaveta modal `Professor IA` (`sessao-chat-dark-360`).


* **Por quê:** Apesar da meta da P2 de manter os chips em linha única rolável, os 5 chips de sugestão estão quebrando em **duas linhas** (`Me dê uma dica...` / `Por que...` na linha 1; `Explique...` / `Dê um exemplo` / `Resuma...` na linha 2), ocupando `~96dp` verticais da área de mensagens. No cabeçalho da gaveta, o botão circular com ícone de livro (`📖`) ao lado do `✕` não informa se o contexto da aula está ativo ou se abre o material.


* **COMO CORRIGIR:** (a) Aplicar `display: flex; flex-wrap: nowrap; overflow-x: auto; gap: 8dp; padding-inline: 16dp` no container de `SuggestionChip` (`height: 32dp` visual com touch target de `48dp`), garantindo **1 única linha horizontal** acima do campo de texto; (b) transformar o botão de livro no cabeçalho em um `FilterChip` ou `AssistChip` compacto (`height: 32dp`) com rótulo curto `Contexto` (ou remover caso apenas feche a gaveta, já que o `✕` e o `scrim` cumprem essa função).




6. **(c1) Onboarding — Divergência de nomenclatura entre "Planilha" (texto) e "Plano" (barra de navegação):**
* **Onde:** Passo 2 do Onboarding (`onboarding-2-dark-360`).


* **Por quê:** O parágrafo instrui: *"Se preferir, avance e importe depois em **Planilha**."*, mas na barra de navegação inferior e na `NavigationRail` a aba correspondente chama-se **Plano** (e em Ajustes/Hoje a ação chama-se `Trocar planilha`).


* **COMO CORRIGIR:** Atualizar a string no passo 2 do Onboarding para *"Se preferir, avance e importe depois na aba **Plano** ou no menu de **Hoje**."*.




7. **(c3) Ajustes — Tripla redundância no alerta de notificações bloqueadas, switches filhos ativos com permissão negada e botão "Salvar chave" habilitado vazio:**
* **Onde:** Tela **Ajustes** (`ajustes-dark-360`), seções `PROFESSOR IA` e `NOTIFICAÇÕES`.


* **Por quê:**
1. Em `PROFESSOR IA`, o botão primário `Salvar chave` está habilitado (preenchimento âmbar `#E6A243`) mesmo com o input vazio mostrando apenas o placeholder `xai-...` e o status `Não configurada`.


2. No topo de `NOTIFICAÇÕES`, três blocos seguidos repetem a mesma informação: o item `Lembretes` (`Lembretes desativados. Você não vai receber aviso do timer.` · `Bloqueadas`), o item `Ativar lembretes` e o card de erro vermelho com a frase idêntica (`Lembretes desativados. Você não vai receber aviso do timer.` + botão `Abrir configurações`).


3. Os 4 switches de alertas (`Lembrete de início`, `Alerta para resolver questões`, `Alerta de revisão`, `Aviso se o bloco ainda não começou`) aparecem ligados em âmbar mesmo com a permissão geral `Bloqueadas`, passando a falsa impressão de que estão funcionando.


4. O rodapé de `NOTIFICAÇÕES` exibe um parágrafo técnico de 6 linhas explicando o comportamento de iOS, Windows, Chrome e Edge, desnecessário no APK Android.




* **COMO CORRIGIR:**
* Desabilitar `Salvar chave` (`disabled`, opacidade `38%` no container `onSurface 12%`) enquanto `input.value.trim().length === 0`.


* Unificar os 3 primeiros blocos de `NOTIFICAÇÕES` em **um único card de status**: título `Permissão de notificações`, badge `Bloqueadas` (`error #F2B8B5`), texto curto `Ative para receber os avisos do timer e do horário de estudo.` e um único botão `FilledTonalButton` (`Ativar notificações` se `prompt` disponível, ou `Abrir configurações` se `denied`).


* Quando a permissão estiver `Bloqueadas` ou `Modo silencioso` estiver ativo, aplicar estado visual `disabled` (`opacity: 0.38`, `pointer-events: none`) nos 4 switches dependentes e no seletor de `Horário de estudo`.


* Substituir os dois inputs separados `Hora` (`14`) e `Minuto` (`0`) por um único botão seletor `Horário de estudo: 14:00` (`height: 56dp`) que abre o `TimePicker` M3 (ou formatar o minuto sempre com dois dígitos `00`), e ocultar o parágrafo sobre iOS/Windows/Edge quando `Capacitor.isNativePlatform() === true`.






8. **(c3) Ajustes — Exposição de "Armazenamento persistente" e "Aparência (backlog)" no nível principal e falta de confirmação em ações destrutivas:**
* **Onde:** Tela **Ajustes** (`ajustes-dark-360`), seções `APARÊNCIA`, `DADOS` e `PROFESSOR IA`.


* **Por quê:** (a) A seção `APARÊNCIA` inteira existe apenas para dizer que o modo claro está no backlog; (b) `Armazenamento persistente` (`Não concedido`, `Uso local: 73 KB de 10 GB`, botões `Tornar armazenamento persistente` e `Atualizar status`) expõe jargão da API Web Storage que confunde o estudante; (c) `Restaurar backup (.json)` substitui todos os dados do aparelho sem diálogo de confirmação explícito.


* **COMO CORRIGIR:** (a) Remover a seção `APARÊNCIA` enquanto o tema claro não existir; (b) chamar `navigator.storage.persist()` automaticamente ao salvar plano/chave e mover o card de diagnóstico (`Uso local: 73 KB` + `Armazenamento persistente`) para uma sub-tela ou acordeão `Avançado`; (c) exigir um `AlertDialog` M3 de confirmação em `Restaurar backup (.json)` (*"Substituir todos os dados? O plano atual, sessões e erros deste aparelho serão apagados."* com botões `Cancelar` e `Substituir dados` em cor `error`) e ao remover/sobrescrever uma `Chave xAI` já salva.




9. **(c4) Importar — Pré-visualização e botão "Importar" ficam enterrados abaixo da dobra e "Ajustar colunas" parece texto estático:**
* **Onde:** Tela **Importar** após escolher arquivo (`importar-previa-dark-360`).


* **Por quê:** Quando o usuário seleciona a planilha, os cartões `PLANO ATUAL`, a dropzone `Escolher arquivo .xlsx` (`120dp`) e a linha `Baixar modelo` continuam totalmente abertos no topo. Isso empurra o cartão `PRÉ-VISUALIZAÇÃO / Confira antes de importar` para a metade inferior da tela e esconde o botão primário `Importar` no fim de uma rolagem longa. Além disso, a linha `Ajustar colunas` não tem ícone chevron (`⌄` / `›`), parecendo apenas um subtítulo sem ação entre dois divisores.


* **COMO CORRIGIR:**
* Ao entrar no estado `previa` (arquivo carregado), recolher ou ocultar a dropzone `Escolher arquivo .xlsx` e `Baixar modelo` (substituindo por um botão compacto `Trocar arquivo` no cabeçalho do card de pré-visualização no lugar da pílula estática `Plano`) ou fazer `scrollIntoView({ behavior: 'smooth', block: 'start' })` automático para o card `PRÉ-VISUALIZAÇÃO`.


* Transformar `Ajustar colunas` em um cabeçalho de acordeão claro (`height: 48dp`, `display: flex`, `justify-content: space-between`) com ícone `expand_more` (`24dp`) à direita e subtítulo secundário `Reconhecidas automaticamente (7/7)`.







---

### MELHORIAS

1. **(c3) Reordenar seções de Ajustes por frequência de uso do estudante — Prioridade: Alta | Esforço: P**
* Mudar a ordem das seções em **Ajustes** de `Professor IA → Notificações → Aparência → Dados → Sobre` para: **1. Estudo e Notificações** (`Horário de estudo`, permissões e lembretes), **2. Plano e Dados** (`Trocar planilha`, `Exportar/Restaurar backup`), **3. Professor IA** (chave xAI e, dentro do acordeão `Avançado`, `Quem monta o pacote` e pesquisadores extras), **4. Sobre** (`Rever introdução`, `Versão`).




2. **(c4) Adicionar ação "Desfazer" na Snackbar de substituição de plano e destacar linhas com erro no topo da prévia — Prioridade: Alta | Esforço: P**
* Como a tela de **Importar** já possui a etapa explícita `Confira antes de importar` e preserva o histórico de sessões e erros (`O histórico de sessões e erros continua aqui.`), dispensar um diálogo modal extra evita fadiga de confirmação. Para torná-la 100% segura, mantenha o snapshot do `PLANO ATUAL` anterior em memória/storage temporário e adicione a ação `Desfazer` (`ActionButton`) na Snackbar `Plano importado · N dias` por 8 segundos. Caso a planilha tenha avisos ou erros nas linhas 4 em diante (ocultas sob `e mais 4 dias`), priorize a exibição das linhas com erro acima das linhas válidas na pré-visualização.




3. **(c4) Exemplo visual em linha das colunas na tela inicial de Importar — Prioridade: Média | Esforço: P**
* Para quem nunca abriu a planilha modelo, a lista textual `Vem com Data, Bloco A, Min A, Bloco B, Min B, Revisão e Min Rev.` ao lado de `Baixar modelo` fica espremida em 3 linhas estreitas. Coloque `Baixar modelo` ocupando largura total (`OutlinedButton`, `height: 48dp`) ou exiba uma mini-tabela estática de 1 linha (`01/11/2026 | Matemática | 60 | Física | 40 | Questões | 20`) em fonte monoespaçada (`12sp`) abaixo da dropzone para entendimento imediato do formato esperado.




4. **(c2) Ícones semânticos no menu de overflow de Hoje — Prioridade: Baixa | Esforço: P**
* No menu `⋮` de **Hoje** (`hoje-menu-dark-360`), adicionar ícones leading de `20dp` (`upload_file` em `Trocar planilha` e `download` / `share` em `Exportar resumo`) conforme a especificação de Menus do Material Design 3 (`padding-inline: 12dp`, `gap: 12dp`, `min-height: 48dp`).





---

### COMPARAÇÃO

* **Anki (AnkiDroid):** Na importação de pacotes (`.apkg` / `.csv`), o AnkiDroid recolhe o seletor de arquivos assim que o arquivo é lido e exibe imediatamente na primeira dobra o resumo de mapeamento de campos e a política de conflito/substituição, evitando que o usuário precise rolar pela tela de seleção anterior como ocorre hoje em `importar-previa-dark-360`.


* **Duolingo:** Utiliza gatilhos de micro-compromisso equivalentes ao `Só 15 min` (lições rápidas de 3–5 min), mas os apresenta **apenas** no ponto de entrada único da tarefa ativa (ou em notificações de recuperação de ofensiva), nunca repetindo múltiplos botões de duração reduzida em cada item da trilha como ocorre nos cartões de `hoje-dark-360`.


* **Forest:** Durante a sessão de foco com cronômetro ativo, o Forest elimina títulos redundantes e mantém o timer e os controles principais de pausa/desistência com visibilidade integral sem rolagem em qualquer orientação, contrastando com o H1 `Matemática` duplicado que empurra os controles do card para fora da dobra em `sessao-timer-rodando-light-paisagem`.



---

### FONTES

* **Material Design 3 — Buttons (Hierarquia: um único Filled Button proeminente por visualização):** [https://m3.material.io/components/buttons/guidelines](https://m3.material.io/components/buttons/guidelines)
* **Material Design 3 — Navigation Rail (Layouts adaptativos ≥600dp e alinhamento de conteúdo):** [https://m3.material.io/components/navigation-rail/guidelines](https://m3.material.io/components/navigation-rail/guidelines)
* **Material Design 3 — Chips (Single-line horizontally scrollable Suggestion Chips):** [https://m3.material.io/components/chips/guidelines](https://m3.material.io/components/chips/guidelines)
* **Material Design 3 — Dialogs & Confirmation (Quando exigir confirmação em ações destrutivas vs. Undo em Snackbar):** [https://m3.material.io/components/dialogs/guidelines](https://m3.material.io/components/dialogs/guidelines)
* **Material Design 3 — Menus (Anatomia e ícones em Overflow Menus):** [https://m3.material.io/components/menus/guidelines](https://m3.material.io/components/menus/guidelines)
* **Android Developers — Schedule exact alarms & Battery optimization settings:** [https://developer.android.com/develop/background-work/services/alarms](https://developer.android.com/develop/background-work/services/alarms)
* **Anki Manual — Text Files / Spreadsheet Importing & Field Mapping:** [https://docs.ankiweb.net/importing/text-files.html](https://docs.ankiweb.net/importing/text-files.html)

## P4

_Resposta gerada pelo Gemini (Argon, raciocínio alto) a pedido do Guilherme; repassada sem edição. Imagens: 10 painéis com 30 telas (360, 320 e paisagem)._

**VEREDITO**
A P3 resolveu 5 dos 9 pontos integralmente e deixou 4 ajustes parciais (colisões em 320px na Sessão/Chat e botão de testar chave ativo sem chave), enquanto as novas telas da P4 (`Erros`, `Plano` e `Progresso`) acertam na arquitetura de informação, mas apresentam quebras de layout em 320px no `Plano` (truncamento severo e sobreposição do cabeçalho fixo ao rolar para hoje) e excesso de blocos zerados em `Progresso`.

---

### Respostas Objetivas (c1 a c4)

* **(c1) Confirmação da P3 (9 itens):**
1. *Hoje — remoção do banner redundante:* **Sim.** Topo limpo direto no título e subtítulo.


2. *Hoje — "Só 15 min" restrito ao cartão herói:* **Sim.** Aparece apenas no Bloco A; Bloco B e Revisão exibem apenas `Iniciar`.


3. *Hoje — "Preparar semana" abaixo dos blocos:* **Sim.** Desceu para o fim da tela com `Preparar` e `Dispensar`. (Sobrou: em `hoje-menu.png`, o menu `⋮` abre deslocado para a esquerda, cobrindo o H1 "O que estudar agora").


4. *Sessão em paisagem — split view sem H1 repetido e sem cortar CTA "sem IA":* **Sim.** O painel esquerdo concentra o timer e controles, e o painel direito exibe os dois CTAs completos. (Sobrou em 320px retrato: o botão `Iniciar` corta o último zero de `1:00:00` e o FAB `Professor` sobrepõe o botão `Gerar material com IA`).


5. *Sessão (Chat Professor IA) — chips numa linha só:* **Parcial.** Os chips estão em linha única com rolagem horizontal, mas o cabeçalho da bottom sheet esmagou o título `Professor IA` (`Professo...` em 360px e oculto/0px em 320px) por falta de espaço entre o chip `1:00:00` e o botão `Caderno`.


6. *Nomenclatura ("Planilha" vs. "Plano"):* **Parcial.** As ações usam "Importar planilha" e "Trocar planilha", mas o nome *default* salvo ainda é `"Plano"`, gerando `PLANO ATUAL: Plano` em Importar e `Planilha: Plano` no subtítulo da aba Plano.


7. *Ajustes — 4 seções, cartão único de permissão com badge e switches desabilitados mantendo valor:* **Sim.** Estrutura limpa, badge `Bloqueadas` visível e os 4 switches dependentes mantêm o estado ativo enquanto desabilitados.


8. *Ajustes — Chave xAI ("Salvar chave" desabilitado vazio, confirmações e "Avançado"):* **Parcial.** `Salvar chave` está desabilitado e o armazenamento persistente foi para `Avançado`, mas o botão `Testar conexão` permanece habilitado mesmo com o campo vazio e status `Não configurada`.


9. *Importar — prévia compacta, acordeão de colunas e confirmar visível:* **Parcial.** A lista mostra apenas 3 dias (`+ e mais 4 dias`) e o acordeão `Ajustar colunas (7/7)` vem fechado, mas `PRÉ-VISUALIZAÇÃO · Plano` trunca em 360px/320px (`PRÉ-VISUALIZA...`) e o topo duplo (`Importar planilha` + `Confira antes de importar`) ainda empurra o botão `Importar` para a borda inferior da dobra.




* **(c2) Erros — hierarquia, revisão e estado vazio:**
* **Hierarquia e revisão:** Como o `shots4.mjs` rodou sem erros cadastrados, `erros.png` captura apenas o estado vazio (`0 para revisar hoje · 0 no total`); não há evidência visual nos screenshots anexos dos `FilterChips`, da lista preenchida nem da tela de revisão com timer de 5 min (sem fonte visual no lote P4).


* **O estado vazio basta?** **Não.** O botão `+ Registrar erro` está fora do cartão com estilo *Outlined* de baixo contraste (parecendo ação secundária) e não há atalho para quem quer começar a estudar para gerar erros automaticamente (`Ir para Hoje`).




* **(c3) Plano — lista por semana, linha de 68dp, sheet de detalhe em 320px e menu `⋮`:**
* **Linha de 68dp em 320px:** **Não funciona bem.** Com 3 colunas na mesma linha (data à esquerda, textos no meio e `2h` + badge `○ Pendente` à direita), sobram apenas ~92dp para o miolo em 320px, truncando a matéria principal (`Matemática: Fu...`) e escondendo a revisão na segunda linha (`Física: Leis de Ohm ·...`).


* **Auto-scroll + cabeçalho fixo:** Ao abrir rolado no dia `02/11`, o cabeçalho fixo/sticky `Plano` sobrepõe o botão `Recalcular` (360px), o título `Semana de 02/11` (320px) e os dias `03/11`–`04/11` (paisagem), além de jogar o alerta `1 dia atrasado` para fora do topo visível.


* **Sheet de detalhe:** Não foi capturada nos screenshots da P4.


* **Menu `⋮`:** Esconder `Novo dia` no `⋮` prejudica a descoberta de uma ação criativa primária (o Material Design 3 recomenda 1–2 ícones de ação direta na Top App Bar ou FAB, reservando o overflow para ações raras como `Trocar planilha`).


* **(c4) Progresso — legibilidade em 360/320 e o que cortar para reduzir rolagem:**
* **Legibilidade:** Em 360px e 320px, os 3 cards de topo e o mapa de calor de 28 dias são legíveis com valores curtos (`1`, `0min`, `0%`), mas em 320px cada card tem ~84dp de largura (valores como `12h 30m` quebrarão linha). Em **paisagem**, o mapa de calor expande as células proporcionalmente à largura, gerando quadrados gigantes que consomem ~420dp de altura.


* **O que cortar:** (1) Ativar de fato o estado vazio neutro quando `minutosEstudados === 0` (atualmente a tela inteira renderiza zerada com `1 dia seguido`); (2) remover o card inferior `Dias do plano` (duplica a aba `Plano` e o card `0% do plano concluído`); (3) colapsar `Assuntos mais fracos` e `Motivos dos erros` num único aviso compacto enquanto não houver questões/erros registrados.





---

### PROBLEMAS

1. **Cabeçalho fixo de `Plano` sobrepondo conteúdo e escondendo alerta de atraso após auto-scroll**
* **Onde:** Tela `Plano` (`plano.png`, variantes 360px, 320px e paisagem).


* **Por quê:** O cabeçalho `Plano / Planilha: Plano · 01/11 a 07/11 · 7 dias` usa posicionamento fixo/sticky sem reserva de `scroll-margin-top` no container de rolagem e fica abaixo do card `1 dia atrasado` ou flutua sobre a lista quando `scrollIntoView()` rola até `02/11`, cobrindo o botão `Recalcular` (360px), o cabeçalho `Semana de 02/11` (320px) e os cartões `03/11` e `04/11` junto com a Navigation Rail (paisagem).


* **COMO CORRIGIR:**
* **Componente:** `Small Top App Bar` fixa no topo real do `Scaffold` (`top: 0`, `z-index: 20`, altura `64dp`, cor de superfície `#141311` com `surfaceContainer` `#201F1C` no estado `scrolled`).
* **Fluxo e Espaçamento:** Manter o banner de alerta `1 dia atrasado` fixo logo abaixo da App Bar (ou fazer o auto-scroll parar no banner de atraso quando `diasAtrasados > 0`). Aplicar `scroll-margin-top: 80dp` no elemento do dia atual (`#dia-hoje`) para que o título da semana (`Semana de 02/11`) nunca fique oculto sob a App Bar.




2. **Truncamento severo das matérias na linha de 68dp em `Plano` (320px)**
* **Onde:** Lista de dias em `Plano` (`plano.png`, variante 320px).


* **Por quê:** O badge `○ Pendente` / `⊙ Parcial` com texto + ícone na coluna direita ocupa ~88dp, somado aos ~52dp da data à esquerda e ~88dp de margens/paddings, restando apenas ~92dp para o conteúdo central (`Matemática: Fu...` e `Física: Leis de Ohm ·...`).


* **COMO CORRIGIR:**
* **Componente:** `ListItem` de 2 linhas do Material Design 3 com altura mínima de `72dp` (`padding: 12dp 16dp`, gap entre colunas de `12dp`).
* **Layout e Tamanhos:** Na coluna direita (trailing), exibir no topo o tempo total (`2h`, `12sp`, `#C9C5BC`) e abaixo **apenas o ícone semântico de status** (`20dp`: `check_circle` verde `#81C784` para concluído, `timelapse` âmbar `#E5A93C` para parcial, `radio_button_unchecked` `#8E8A80` para pendente, com `aria-label` acessível), ou ocultar o texto `"Pendente"` em viewports `< 360dp`. Isso libera `56dp` horizontais para o título do Bloco A e subtítulo dos demais blocos.




3. **Colisão no timer e sobreposição do FAB `Professor` sobre o CTA principal em `Sessão` (320px)**
* **Onde:** Tela `Sessão` (`sessao.png`, variante 320px).


* **Por quê:** Na barra superior de 320px, o timer `1:00:00` em fonte grande (`~32sp`) não cabe ao lado do botão `Iniciar`, cortando o último dígito (`1:00:0`). Na área inferior, o botão flutuante `Professor` (`position: fixed`, canto inferior direito) fica exatamente em cima do botão primário `Gerar material com IA`.


* **COMO CORRIGIR:**
* **Componente (Topo):** Usar `clamp(22px, 6.5vw, 32px)` no font-size do cronômetro e reduzir o padding horizontal do botão `Iniciar` para `12dp 16dp` (altura `40dp`) em telas `< 360dp`.
* **Componente (FAB Professor):** Ancorar o botão `Professor` como `Extended FAB` com `bottom: 16dp`, `right: 16dp` e adicionar `padding-bottom: 88dp` no container de scroll da sessão; ou melhor, enquanto o card `"Este bloco ainda não tem material rico"` estiver visível, posicionar o botão `Professor` em fluxo estático abaixo do card (`margin-top: 16dp`), evitando sobreposição em telas curtas.




4. **Título `Professor IA` truncado em 360px e invisível (0px) em 320px na Bottom Sheet de Chat**
* **Onde:** Cabeçalho da gaveta do Professor IA (`sessao-chat.png`, variantes 360px e 320px).


* **Por quê:** A mesma linha de cabeçalho tenta acomodar `[1:00:00]` (`~76dp`) + `Professor IA` + botão `[Caderno]` (`~100dp`) + botão `[X]` (`48dp`), estourando os `320dp`/`360dp` disponíveis.


* **COMO CORRIGIR:**
* **Componente:** Header da `Modal Bottom Sheet` em 2 linhas compactas ou com ícone para o Caderno.
* **Espaçamento e Medida:** Na linha 1 do header (`height: 48dp`), alinhar à esquerda `Professor IA` (`18sp`, semibold) + chip compacto do timer `1:00:00` (`height: 28dp`, `padding: 0 8dp`, `12sp`, cor `#E5A93C` sobre `#2D2618`), e à direita transformar `Caderno` em `IconButton` (`48x48dp`, ícone `menu_book` com `tooltip`/`aria-label="Abrir caderno"`) ao lado do botão `X` (`48x48dp`). A matéria (`Matemática`) permanece no subtítulo abaixo (`12sp`, `#A6A299`).




5. **Estado vazio de `Progresso` não ativado e mapa de calor desproporcional em paisagem**
* **Onde:** Tela `Progresso` (`progresso.png`, variantes 360px, 320px e paisagem).


* **Por quê:** Mesmo com `0min` estudados, `0%` concluído e `0 de 21 blocos concluídos`, a tela exibe `1 dia seguido` e renderiza todos os 6 cartões vazios/zerados em vez do estado vazio neutro com `"Ir para Hoje"`. Além disso, em paisagem, a grade de 7 colunas do mapa de calor usa `aspect-ratio: 1` sem `max-width`, criando células de ~64dp e um cartão de ~420dp de altura.


* **COMO CORRIGIR:**
* **Fluxo (Estado Vazio):** Condicionar o estado vazio a `totalMinutosEstudados === 0 && totalQuestoesRespondidas === 0` (corrigindo também o cálculo de sequência para `0 dias seguidos` quando nenhuma sessão foi concluída). Enquanto zero, exibir no topo um card positivo com botão `Filled` `Ir para Hoje` (`height: 48dp`, cor `#E2A03F`, texto `#1F1600`).
* **Layout (Mapa de Calor e Rolagem):** Limitar a largura da grade de 28 dias com `max-width: 340dp` (ou células de `max-height: 28dp`, `border-radius: 6dp`, gap `6dp`), e em paisagem colocar `Últimos 28 dias` e `Planejado e real` lado a lado num grid de 2 colunas (`grid-template-columns: 1fr 1fr`, `gap: 16dp`). Remover o card `Dias do plano` do rodapé.






6. **Botão `Testar conexão` habilitado sem chave em `Ajustes` e menu `⋮` cobrindo H1 em `Hoje**`
* **Onde:** `Ajustes` (`ajustes.png`, seção Professor IA) e `Hoje` (`hoje-menu.png`).


* **Por quê:** Em `Ajustes`, `Testar conexão` não compartilha a trava `disabled` quando `!inputKey.trim() && !hasSavedKey`. Em `Hoje`, o `Menu` de overflow usa posicionamento que avança sobre o H1 `O que estudar agora` em vez de ancorar pela borda direita (`right: 16dp`, `top: 56dp`).


* **COMO CORRIGIR:**
* Em `Ajustes`, aplicar `disabled={!hasSavedKey && !inputKey.trim()}` no botão `Testar conexão` (opacidade `0.38`, sem borda ativa).


* Em `Hoje`, ancorar o popover do `Menu` M3 no canto inferior direito do `IconButton` `⋮` (`position: absolute; right: 16dp; top: 56dp; min-width: 180dp; max-width: 220dp`).







---

### MELHORIAS

1. **Elevar `+ Registrar erro` para botão primário/tonal dentro do card vazio + CTA secundário `Ir para Hoje` em `Erros**`
* **Prioridade:** Alta | **Esforço:** P
* **Detalhe:** Em `erros.png`, mover `+ Registrar erro` para dentro do cartão vazio como `Filled Tonal Button` (`background: #3A2E1B`, texto `#F5B851`, altura `48dp`) e adicionar ao lado um `Text Button` `Estudar bloco de hoje` que leva à aba `Hoje`. Incluir no script `shots4.mjs` um cenário com 3 erros semeados para validar os `FilterChips` e a tela de revisão de 5 min.




2. **Promover `Novo dia` para fora do menu `⋮` na aba `Plano` e desambiguar nome padrão da planilha**
* **Prioridade:** Alta | **Esforço:** P
* **Detalhe:** Colocar um `IconButton` (`add` / `+`) visível ao lado do `⋮` na Top App Bar de `Plano` (ou botão de ação rápida no cabeçalho) para adicionar dia/bloco sem exigir 2 toques no menu de overflow. Ao importar arquivo sem nome customizado, salvar o nome original do arquivo (ex.: `enem-reta-final.xlsx`) em vez da string genérica `"Plano"`, evitando `Planilha: Plano`.




3. **Compactar o topo de `Importar planilha (Prévia)` para caber 100% sem scroll em 360px/320px**
* **Prioridade:** Média | **Esforço:** P
* **Detalhe:** Em `importar-previa.png`, quando o usuário já escolheu o arquivo e entrou no estado de pré-visualização, ocultar o cabeçalho introdutório (`Importar planilha / Colunas usadas...`) ou fundi-lo com `Confira antes de importar`, e trocar o rótulo truncado `PRÉ-VISUALIZAÇÃO · Pla...` por apenas `PRÉ-VISUALIZAÇÃO` (`11sp`, uppercase), garantindo que `Importar` e `Cancelar` fiquem 100% acima da dobra em telas de 640dp de altura.




4. **Fundir `Assuntos mais fracos` e `Motivos dos erros` quando vazios em `Progresso**`
* **Prioridade:** Média | **Esforço:** P
* **Detalhe:** Em `progresso.png`, enquanto o aluno não tiver questões respondidas nem erros no caderno, exibir um único card compacto (`Diagnóstico de questões e erros — Aparece após sua primeira sessão com questões`) em vez de dois cartões vazios separados, reduzindo ~160dp de rolagem vertical.





---

### COMPARAÇÃO

* **AnkiDroid (Anki):** Na tela de estudo e revisão de cartões, o AnkiDroid exibe contadores diretos no topo (novos, em aprendizagem e a revisar) e, ao revelar a resposta, apresenta de 2 a 4 botões de dificuldade na base com o intervalo exato da próxima revisão (`10m`, `5d`) Acima de cada botão. O fluxo de revisão do `Reta` (`Errei` / `Difícil` / `Fácil` com timer de 5 min) segue bem essa ergonomia de polegar, mas deve exibir no próprio botão o próximo agendamento (ex.: `Errei · amanhã`, `Difícil · 3d`, `Fácil · 7d`) para dar transparência ao algoritmo de repetição espaçada.
* **Forest:** O Forest transforma cada sessão concluída em um registro visual imediato na grade/floresta e mantém sessões incompletas de forma honesta sem poluir a tela com múltiplos gráficos vazios no primeiro dia. No `Reta`, a tela `Progresso` deve seguir essa contenção: destacar a conquista imediata (sequência + mapa de calor de 28 dias) e ocultar painéis analíticos secundários (`Assuntos mais fracos`, `Motivos dos erros` e a lista repetida `Dias do plano`) até que existam dados reais de estudo.


* **Duolingo:** Trata a sequência (*streak*) como métrica zero até que a primeira lição do dia seja efetivamente concluída (exibindo `0 dias` no onboarding antes da primeira prática). Em `progresso.png`, o `Reta` exibe `1 dia seguido` mesmo com `0min` estudados e `0 de 21 blocos concluídos`, o que gera inconsistência visual entre os três cartões de resumo do topo.



---

### FONTES

* **Material Design 3 — Top App Bars (Guidelines & Specs, limite de 1–2 ações visíveis e comportamento de scroll/fill):** [https://m3.material.io/components/app-bars/guidelines](https://m3.material.io/components/app-bars/guidelines) e [https://m3.material.io/components/app-bars/specs](https://m3.material.io/components/app-bars/specs)
* **Material Design 3 — Lists (Guidelines de escaneabilidade, alinhamento leading/trailing e truncamento em telas compactas):** [https://m3.material.io/components/lists/guidelines](https://m3.material.io/components/lists/guidelines)
* **Material Design 3 — Bottom Sheets (Guidelines de anatomia e cabeçalho modal):** [https://m3.material.io/components/bottom-sheets/guidelines](https://m3.material.io/components/bottom-sheets/guidelines)
* **Android Developers — Build adaptive apps & Responsive layouts (Window Size Classes e adaptação de grades/listas em retrato e paisagem):** [https://developer.android.com/develop/ui/compose/build-adaptive-apps](https://developer.android.com/develop/ui/compose/build-adaptive-apps) e [https://developer.android.com/develop/adaptive-apps](https://developer.android.com/develop/adaptive-apps)
* **AnkiDroid User Manual (Study Screen, contadores de revisão e botões de resposta com intervalos):** [https://ankidroid.org/](https://ankidroid.org/)
* **Forest App (Funcionamento de sessões de foco e registro visual de progresso):** [https://forestapp.cc/](https://forestapp.cc/)

## P5

_Resposta gerada pelo Gemini (Argon, raciocínio alto) a pedido do Guilherme; repassada sem edição. Imagens: 10 painéis com 36 telas._

### VEREDITO

A branch `integracao-fase2` atingiu maturidade visual e funcional de produção: 7 dos 8 itens da P4 foram resolvidos integralmente (e 1 parcialmente em paisagem/nomenclatura), os alvos de toque respeitam ≥ 48dp e a suíte de 468 testes sustenta o **sinal verde para o merge na `main` e criação da tag `v1.0-estavel**`. Restam apenas ajustes pontuais de responsividade em paisagem (`importar-previa` e `plano-detalhe`) e a normalização dos rótulos de matéria no histórico semeado de `Progresso`, que podem ser corrigidos num commit rápido pré-tag ou na `v1.0.1`.

---

### RESPOSTAS OBJETIVAS (d1 a d4)

#### (d1) Confirmação dos 8 itens da P4

* **1. Hoje (menu `⋮`):** **SIM.** O menu abre ancorado à direita (`right: 0`), abaixo do botão `⋮` de 48dp, exibindo "Trocar planilha" e "Exportar resumo" sem cobrir o H1 "O que estudar agora" em 360px, 320px e paisagem. *O que sobrou:* nada bloqueante.


* **2. Sessão 320 (cronômetro, Iniciar e Professor):** **SIM.** O cronômetro `1:00:00` com `clamp(22px, 6.5vw, 32px)` e o botão "Iniciar" compacto cabem na mesma linha em 320px, e o botão "Professor" agora segue no fluxo normal abaixo do cartão (e na coluna esquerda em paisagem), sem sobreposição. *O que sobrou:* na coluna esquerda do modo paisagem, o texto secundário trunca em `"0 min estudados de ..."`.


* **3. Sheet do Professor:** **SIM.** O título "Professor IA" aparece completo, o timer virou chip (`1:00:00`), "Caderno" virou `IconButton` de 48dp ao lado do fechar (`X`), e "Matemática" foi para o subtítulo. *O que sobrou:* em 320px, o placeholder do campo de texto corta a última letra (`"Pergunte sobre este t"`).


* **4. Ajustes (Testar conexão):** **SIM.** Os botões "Salvar chave" e "Testar conexão" permanecem desabilitados quando a chave xAI está "Não configurada" e o input `xai-...` está vazio. *O que sobrou:* nada.


* **5. Importar e nomenclatura:** **PARCIAL.** O arquivo aparece sem extensão (`plano-teste`), a prévia exibe o supertítulo `PRÉ-VISUALIZAÇÃO` sem topo duplo e os botões `Cancelar`/`Importar` ficam visíveis acima da dobra em 320px. *O que sobrou:* (a) em `importar-previa` no modo **paisagem**, a lista de cartões dos dias (`01/11`, `02/11`, `03/11`) e o acordeão `Ajustar colunas` sumiram/colapsaram; (b) a navegação principal (`NavigationBar`/`NavigationRail`), o H1 de `Plano`, o card `PLANO ATUAL` e textos de `Ajustes` ainda usam o termo "Plano" em vez de "Minha planilha".


* **6. Plano (rolagem, linha 72dp, ícone de estado, botão `+`):** **SIM.** O topo inicia exibindo o card "1 dia atrasado", as linhas têm ~72dp de altura com estado representado apenas por ícone (relógio/círculo) e o botão `+` (Novo dia) está visível na Top App Bar. *O que sobrou:* nada.


* **7. Progresso (sequência, heatmap <= 340px, 2 colunas em paisagem):** **SIM (layout).** O heatmap "Últimos 28 dias" está contido em <= 340px com células <= 28px sem vazar em 320px, e em paisagem forma 2 colunas ao lado de "Planejado e real". *O que sobrou:* nos dados exibidos, "Planejado e real" e "Assuntos mais fracos" misturam nomes de matérias (`Matemática`, `Física`) com identificadores de slot (`Bloco A`, `Bloco B`), e o KPI mostra `2 dias seguidos` enquanto o heatmap exibe 7 dias ativos.


* **8. Erros (estado vazio):** **SIM (validado em código/testes; shots da P5 mostram estado com dados).** Com dados semeados, o botão `+ Registrar erro` está bem posicionado abaixo do card principal "Revisar 3 erros agora".



#### (d2) Análise de Erros (com dados e revisão), Plano (detalhe) e Progresso (com dados)

* **Não há bloqueador crítico de acessibilidade de toque (todos os alvos ativos têm ≥ 48dp), mas há 3 pontos visuais/funcionais de atenção:**
1. Em `importar-previa` paisagem, a lista de blocos reconhecidos e o mapeamento de colunas somem da tela.


2. Em `plano-detalhe`, a gaveta modal corta o botão `Excluir dia` em 320px e oculta todos os 3 botões de ação (`Estudar este bloco`, `Editar dia`, `Excluir dia`) abaixo da dobra em paisagem.


3. Em `progresso`, a agregação de matérias separa `Bloco A` (2h35) de `Matemática` (25min de 7h), duplicando categorias nos gráficos.





#### (d3) Impeditivos para o merge na `main` e tag `v1.0-estavel`

* **O merge e a tag `v1.0-estavel` estão liberados**, recomendando-se apenas corrigir antes da tag (ou imediatamente na `v1.0.1`) o colapso da lista em `importar-previa` paisagem e verificar se a mistura `Bloco A`/`Matemática` em `Progresso` vem do código de agregação ou apenas do script `shots5.mjs`.


* **Pode ficar para depois (`v1.0.1` / `MELHORIAS.md`):** rodapé fixo na gaveta `plano-detalhe` em paisagem, ocultação da barra de navegação durante `erros-revisao`, fade lateral nos chips de filtro de `erros`, intervalo de revisão nos botões e revisão do cartão "Dias do plano".



#### (d4) Validação do Checklist e Riscos no Aparelho Real

* O checklist está **correto e bem delimitado**. Além de Doze, alarme exato, gesto Voltar e TalkBack, inclua no roteiro de teste em aparelho físico Android 12–15+:
1. **Permissão explícita de Alarme Exato no Android 14+ (API 34+):** `SCHEDULE_EXACT_ALARM` vem **revogada por padrão** em instalações limpas no Android 14+. Testar se `canScheduleExactAlarms()` detecta a negação sem crash (`SecurityException`) e abre `ACTION_REQUEST_SCHEDULE_EXACT_ALARM`.
2. **Conflito Gesto Voltar (IME vs `useBackOverlay`) no Sheet do Professor:** Com o teclado Android aberto no input `"Pergunte sobre este trecho"`, o 1º gesto de voltar fecha o teclado nativo; validar se o listener do Capacitor não fecha a gaveta do Professor acidentalmente junto com o teclado ou se não exige dois gestos dessincronizados.


3. **`windowSoftInputMode="adjustResize"` no WebView:** Verificar se abrir o teclado em `sessao-chat` mantém o cabeçalho `"Professor IA 1:00:00"` visível sem empurrar o modal para fora do viewport.


4. **Isolamento de foco do TalkBack (`inert` / `aria-hidden`) nas gavetas:** Confirmar no TalkBack real se o swipe sequencial dentro de `plano-detalhe` e `sessao-chat` fica preso no modal (focus trap) e não lê os cartões de `Plano` ou `Sessão` ao fundo.


5. **Android Auto Backup vs Keystore (`allowBackup`):** Após reinstalar o APK sobre uma conta Google com backup ativo, testar se o `@aparajita/capacitor-secure-storage` trata chaves invalidadas do Keystore limpando o estado para `"Não configurada"` em vez de travar na inicialização.





---

### PROBLEMAS

1. **Lista de dias e mapeamento de colunas ocultos na pré-visualização em paisagem**
* **Onde:** `importar+importar-previa.png` (painel inferior direito — `importar-previa paisagem`).


* **Por quê:** Na orientação paisagem, o card `Confira antes de importar` exibe apenas a pílula `"7 dias, de 01/11 a 07/11, 21 blocos"` e passa direto para os botões `Cancelar` e `Importar`, omitindo os cartões de amostra (`01/11`, `02/11`, `03/11`), o contador `"e mais 4 dias"` e o acordeão `Ajustar colunas` que aparecem em 360px. Isso impede o usuário em modo horizontal de auditar se as colunas foram lidas corretamente antes de sobrescrever o plano.


* **COMO CORRIGIR:** No contêiner da lista de prévia de `importar-previa`, remover qualquer regra `@media (orientation: landscape)` ou `max-height` que colapse a lista para `0px`; aplicar um layout de 2 colunas em paisagem (`display: grid; grid-template-columns: 1fr 280px; gap: 16dp`) onde a coluna esquerda exibe a lista rolável de dias (`max-height: 220dp; overflow-y: auto`) + `Ajustar colunas`, e a coluna direita fixa o resumo, o aviso destrutivo (`color: #C4C7BE`) e os botões `Importar` (Filled Button, altura `48dp`, fundo `#E5A946`, texto `#261900`) e `Cancelar` (Text/Outlined Button, `48dp`).


2. **Ações primárias cortadas abaixo da dobra no Bottom Sheet de Detalhe do Dia em 320px e Paisagem**
* **Onde:** `plano-detalhe.png` (variantes 320px e paisagem).


* **Por quê:** Em 320px, o botão destrutivo `Excluir dia` fica fora da área visível; em paisagem (`plano-detalhe paisagem`), o corte ocorre na metade do terceiro bloco (`REVISÃO`), escondendo completamente os botões `Estudar este bloco`, `Editar dia` e `Excluir dia`. Segundo o Material Design 3 (`Modal bottom sheets`), folhas modais em telas baixas devem permitir rolagem interna mantendo ações principais acessíveis.


* **COMO CORRIGIR:** Estruturar o `ModalBottomSheet` com `max-height: 90dvh; display: flex; flex-direction: column` no contêiner raiz (`background: #171D17`, `border-radius: 28dp 28dp 0 0`):
* **Cabeçalho fixo:** Drag handle (`32x4dp`, `#8E9289`) + título `"Domingo, 1 de novembro"` + botão `X` (`48x48dp`), `padding: 16dp 20dp 8dp`.
* **Corpo rolável:** Lista de blocos (`BLOCO A`, `BLOCO B`, `REVISÃO`) com `flex: 1; overflow-y: auto; padding: 8dp 20dp; gap: 8dp`.
* **Rodapé fixo (sticky) ou grid em paisagem:** Em paisagem, dispor os botões lado a lado (`display: flex; gap: 12dp; padding: 12dp 20dp 16dp; border-top: 1dp solid #2E352D`) com `Estudar este bloco` (Filled Button, `48dp`, `#E5A946`), `Editar dia` (Outlined Button, `48dp`, borda `#8C7248`) e `Excluir dia` (IconButton/TextButton `48dp`).




3. **Fragmentação de matérias entre `"Bloco A"`/`"Bloco B"` e `"Matemática"`/`"Física"` nos gráficos de Progresso**
* **Onde:** `progresso.png` (cartões `Planejado e real` e `Assuntos mais fracos` nas 3 variantes).


* **Por quê:** Em `Planejado e real`, aparecem 5 barras: `Matemática (25min de 7h)`, `Física (35min de 4h40)`, `Revisão (20min de 2h20)`, seguidas de `Bloco A (2h35)` e `Bloco B (30min)` sem meta planejada. O mesmo ocorre em `Assuntos mais fracos`, que lista `Bloco A (75%)` e `Bloco B (75%)` como se fossem disciplinas escolares. Além disso, o topo marca `2 dias seguidos` enquanto o heatmap `Últimos 28 dias` exibe 7 quadrados preenchidos em sequência (`27/10` a `02/11`).


* **COMO CORRIGIR:** Na função agregadora de `Progresso` (e no seed `shots5.mjs`), normalizar o campo `subject` das sessões concluídas cruzando o `blockId` (`A`, `B`, `REV`) com o assunto correspondente do dia na planilha antes de agrupar (`subject = session.subject !== 'Bloco A' ? session.subject : planDay.blockA.subject`). Para a sequência (`streak`), alinhar o cálculo do card superior (`2 dias seguidos`) com a mesma regra de dias consecutivos usada para pintar os quadrados ativos (`#E5A946`) do heatmap `Últimos 28 dias`.


4. **Barra de navegação global visível durante a Revisão Relâmpago de Erros**
* **Onde:** `erros-revisao.png` (360px, 320px e paisagem).


* **Por quê:** Enquanto `sessao.png` oculta corretamente a `NavigationBar` e a `NavigationRail` para criar um modo de foco imersivo, a tela de revisão um a um (`05:00 revisão relâmpago`, `1 de 3`) mantém a barra inferior/lateral visível. Isso reduz a área vertical útil em 80dp e aumenta o risco de toque acidental nas abas durante o uso do cronômetro de 5 minutos.


* **COMO CORRIGIR:** Aplicar na rota/estado de `erros-revisao` a mesma propriedade de layout imersivo de `sessao` (ocultando a `NavigationBar` de `80dp` e a `NavigationRail` de `80dp`), mantendo apenas a ação explícita `Voltar ao caderno` (alvo mínimo `48dp`, padding horizontal `12dp`) no cabeçalho do cartão e o suporte ao gesto Voltar via `useBackOverlay`.



---

### MELHORIAS

1. **Unificar a nomenclatura `"Minha planilha"` ou assumir `"Plano"` por completo na UI**
* **Prioridade:** Baixa | **Esforço:** P
* **Detalhes:** Caso a decisão de produto da P4 mantenha a troca de "Plano" para "Minha planilha", atualizar o supertítulo `"Plano de estudo"` e `"PLANO ATUAL"` em `importar.png`, os textos de apoio em `ajustes.png` (`"substitui o plano atual"`) e o H1 de `plano.png` (mantendo `"Plano"` apenas no rótulo curto da `NavigationBar` por limite de caracteres do Material 3).




2. **Indicador de rolagem horizontal (fade/padding) nas faixas de chips de `Erros` e `Sheet do Professor**`
* **Prioridade:** Baixa | **Esforço:** P
* **Detalhes:** Em `erros.png`, o chip `Física` aparece cortado como `Fís` em 360px e `Teoria` como `Teori` em paisagem; em `sessao-chat.png`, o chip `"Qual é a pegadinha des..."` corta na borda direita. Adicionar `mask-image: linear-gradient(to right, black 88%, transparent 100%)` e `padding-right: 24dp` nos contêineres `.chips-row` para sinalizar claramente que há mais filtros/sugestões à direita.




3. **Ajuste de texto curto para placeholder e contador em 320px / paisagem**
* **Prioridade:** Baixa | **Esforço:** P
* **Detalhes:** Em `sessao-chat.png` (320px), encurtar o placeholder `"Pergunte sobre este trecho"` para `"Pergunte sobre a matéria..."` para evitar o corte `"Pergunte sobre este t"`. Em `sessao.png` (paisagem), exibir `"0 de 60 min estudados"` na coluna esquerda para não truncar em `"0 min estudados de ..."`.





---

### COMPARAÇÃO

* **Anki (AnkiDroid):** Na tela de revisão de cartões (`Reviewer`), o AnkiDroid oculta qualquer barra de navegação entre abas e dedica 100% da tela ao enunciado, ao contador superior e aos botões de resposta na base. O Reta já faz isso perfeitamente em `sessao.png`, e aplicar o mesmo ocultamento da `NavigationBar` em `erros-revisao.png` deixará a revisão relâmpago no mesmo padrão de foco.


* **Duolingo:** Em modais de ajuda contextual durante exercícios (equivalente ao Sheet `Professor IA` em `sessao-chat.png`), o Duolingo utiliza gavetas parciais com cabeçalho compacto e fecha o teclado no 1º gesto de voltar antes de recolher a gaveta no 2º gesto — exatamente o comportamento que deve ser validado no aparelho real com `useBackOverlay`.


* **Forest:** No gerenciamento de permissões críticas do Android (bateria/Doze e alarmes em segundo plano), o Forest exibe avisos preventivos claros na tela de configurações com atalho direto para as configurações do sistema, abordagem que o Reta implementou muito bem em `ajustes.png` com os cartões `"Permissão de notificações"`, `"Alarme exato"` e `"Avisos atrasando? Toque aqui"`.



---

### FONTES

* **Material Design 3 — Bottom sheets (Modal bottom sheets, scroll e ergonomia em telas compactas/paisagem):** [https://m3.material.io/components/bottom-sheets/guidelines](https://m3.material.io/components/bottom-sheets/guidelines)
* **Material Design 3 — Navigation bar & Navigation rail (quando ocultar em fluxos focados de tarefa):** [https://m3.material.io/components/navigation-bar/guidelines](https://m3.material.io/components/navigation-bar/guidelines)
* **Material Design 3 — Menus (posicionamento relativo ao ícone de ancoragem sem obstruir títulos):** [https://m3.material.io/components/menus/guidelines](https://m3.material.io/components/menus/guidelines)
* **Android Developers — Schedule exact alarms & mudanças comportamentais no Android 14+ (`SCHEDULE_EXACT_ALARM`):** [https://developer.android.com/about/versions/14/changes/schedule-exact-alarms](https://developer.android.com/about/versions/14/changes/schedule-exact-alarms)
* **Android Developers — Optimize for Doze and App Standby (testes com `adb dumpsys deviceidle`):** [https://developer.android.com/training/monitoring-device-state/doze-standby](https://developer.android.com/training/monitoring-device-state/doze-standby)
* **Android Developers — Support predictive back gestures (interação entre IME/teclado e navegação):** [https://developer.android.com/guide/navigation/custom-back/predictive-back-gesture](https://developer.android.com/guide/navigation/custom-back/predictive-back-gesture)
* **AnkiDroid User Manual — Studying / Reviewer UI:** [https://docs.ankidroid.org/#_studying](https://www.google.com/search?q=https://docs.ankidroid.org/%23_studying)
* **Duolingo / Forest / Quizlet (detalhes proprietários internos de implementação de sheets e timers):** sem fonte pública oficial de engenharia para os detalhes internos além do comportamento observável nos apps de produção.
## P6

_Resposta gerada pelo Gemini (Argon, raciocínio alto) a pedido do Guilherme; repassada sem edição._

## VEREDITO

Adote autenticação híbrida com **OAuth PKCE do OpenRouter como fluxo primário** (1 toque via `@capacitor/browser` e Android App Links) e colagem manual de chave como fallback no Keystore, combinada a uma seleção de modelos em duas camadas (**Presets de Estudo** por padrão + explorador avançado via `GET /api/v1/models` com filtros de `:free` e modalidade `image`). Para resiliência e segurança no APK, utilize o array nativo `models` do OpenRouter para fallback automático em erros `429`, bloqueio preventivo de anexos em modelos sem visão, injeção de `HTTP-Referer` e `X-Title` via `CapacitorHttp` (contornando restrições da WebView) e exclusão das chaves no backup do Android (`data_extraction_rules.xml`).

---

## PROBLEMAS

1. **Fricção e abandono na autenticação por colagem manual de chave (Pergunta 1)**
* **Onde:** Tela de Onboarding de IA e tela `Ajustes → Provedor de IA`.
* **Por quê:** Digitar ou alternar entre apps no Android para gerar, copiar e colar uma chave `sk-or-v1-...` gera alto abandono em estudantes não técnicos. Por outro lado, depender *apenas* do OAuth PKCE impede o uso por usuários avançados que gerenciam chaves com limites de gasto pré-configurados no painel web ou em dispositivos sem navegador padrão compatível.
* **COMO CORRIGIR:**
* **Componente:** `FilledButton` (primário para OAuth PKCE) + `OutlinedTextField` recolhido sob um `TextButton` ("Inserir chave manualmente").
* **Dimensões e Espaçamento:** `FilledButton` com altura de `48dp`, largura `match_parent`, margem horizontal de `16dp`, `cornerRadius` de `24dp` (`ShapeAppearance.Material3.Corner.Full`). Espaçamento vertical de `12dp` até o divisor `"ou"` e `12dp` até o `OutlinedTextField` (altura mínima `56dp`, ícone final `EndIconMode` de colar da área de transferência com alvo de toque de `48dp x 48dp`).
* **Cores (Material Design 3):** Botão primário em `md.sys.color.primary` com texto `md.sys.color.onPrimary`; campo de texto com borda `md.sys.color.outline` (`1dp`) e `md.sys.color.primary` (`2dp`) quando focado.
* **Fluxo (OAuth PKCE):** Gerar `code_verifier` (SHA-256 → `code_challenge` em base64url) localmente → abrir `[https://openrouter.ai/auth?callback_url=https://seu-dominio-reta.app/auth/callback&code_challenge=...&code_challenge_method=S256](https://openrouter.ai/auth?callback_url=https://seu-dominio-reta.app/auth/callback&code_challenge=...&code_challenge_method=S256)` via `@capacitor/browser` (Chrome Custom Tabs) → interceptar retorno via `@capacitor/app` (`appUrlOpen`) → trocar o `code` pela chave via `CapacitorHttp.post` em `[https://openrouter.ai/api/v1/auth/keys](https://openrouter.ai/api/v1/auth/keys)` → salvar a chave `key` retornada diretamente no Android Keystore e fechar a Custom Tab.




2. **Sobrecarga cognitiva na escolha de modelos em `GET /api/v1/models` (Pergunta 2)**
* **Onde:** Seletor de modelo em `Ajustes → Provedor de IA` e no cabeçalho do chat/gerador de estudos.
* **Por quê:** O endpoint `GET [https://openrouter.ai/api/v1/models](https://openrouter.ai/api/v1/models)` retorna centenas de modelos com nomenclaturas técnicas (`provider/model-name:variant`). Exibir uma lista crua ou exigir preenchimento em campo livre paralisa o usuário de um app de estudos (Lei de Hick) e leva à seleção acidental de modelos caros ou sem suporte a imagens.
* **COMO CORRIGIR:**
* **Componente:** `SegmentedButton` para escolha do provedor (`xAI` | `OpenRouter`) + 3 `OutlinedCard` de **Presets de Estudo** (visíveis por padrão) + `ModalBottomSheet` para o "Explorador de Modelos" alimentado por `GET /api/v1/models` (cacheado localmente por 24h) com barra de busca (`SearchBar`) e `FilterChip`.
* **Dimensões e Espaçamento:** `OutlinedCard` com padding interno de `16dp`, espaçamento entre cards de `8dp`, raio de borda de `12dp` (`Medium`). No `ModalBottomSheet` (topo com `cornerRadius` de `28dp` e `DragHandle` de `32dp x 4dp`), linha horizontal (`LazyRow`) de `FilterChip` com altura de `32dp` (alvo de toque vertical expandido para `48dp`) e espaçamento horizontal de `8dp` entre chips.
* **Cores (M3):** Card de preset selecionado com fundo `md.sys.color.secondaryContainer`, borda `md.sys.color.primary` (`2dp`) e ícone `md.sys.color.onSecondaryContainer`. Chips de filtro ativos em `md.sys.color.secondaryContainer`. Badges de preço/gratuidade (`:free`) em `md.sys.color.tertiaryContainer` com texto `md.sys.color.onTertiaryContainer` (`11sp`, `Label Small`).
* **Fluxo:**
1. Exibir 3 presets mapeados dinamicamente: **Rápido & Grátis** (filtra sufixo `:free` ou `pricing.prompt == "0"`), **Custo-Benefício / Raciocínio** e **Leitura de Fotos / Caderno** (filtra `architecture.input_modalities` contendo `"image"`).
2. Ao tocar em `"Explorar todos os modelos (Avançado)"`, abrir o `ModalBottomSheet` com filtros rápidos: `[Grátis (:free)]`, `[Aceita Imagens]`, `[Ordenar por Preço/1M tokens]`.
3. Manter no rodapé do Bottom Sheet uma opção `"Digitar ID manual (ex: openrouter/auto)"` que expande um `OutlinedTextField` para novos modelos recém-lançados.






3. **Falhas silenciosas ou destrutivas em erros 402, 429 e incompatibilidade de Visão (Pergunta 3)**
* **Onde:** Tela de geração de resumos/flashcards, chat de dúvidas com anexo de imagem e camada de rede (`CapacitorHttp`).
* **Por quê:** Modelos `:free` no OpenRouter sofrem *rate limit* constante (`429`), contas novas ou chaves esgotadas retornam falta de saldo (`402`), e enviar uma foto de questão de prova para um modelo somente-texto (`architecture.input_modalities: ["text"]`) gera erro `400` após o upload do payload base64, desperdiçando tempo e banda do estudante.
* **COMO CORRIGIR:**
* **Componente:** Validação pré-envio no botão de câmera/galeria (`IconButton` + `AssistChip` contextual) + `Banner` persistente no topo para erro `402` + `Snackbar` com ação para erro `429` + roteamento de fallback no payload.
* **Dimensões e Espaçamento:** `Snackbar` com margem de `16dp` acima da barra de entrada (altura `48dp` para 1 linha, `68dp` para 2 linhas, `cornerRadius` `4dp`). `Banner` de erro `402` com padding interno de `16dp`, ícone de `24dp` à esquerda, espaçamento de `16dp` para o texto e botões de ação alinhados à direita com gap de `8dp`.
* **Cores (M3):** Para `402` (crítico), usar `md.sys.color.errorContainer` no fundo e `md.sys.color.onErrorContainer` no texto/ícone. Para `429` (transitório/fallback) e aviso de modelo sem visão, usar `md.sys.color.surfaceContainerHigh` ou `md.sys.color.tertiaryContainer`. Botão de anexo desabilitado com opacidade de `38%` (`onSurface` com alpha `0.38`).
* **Fluxo por cenário:**
* **Modelo sem visão:** Ao selecionar o modelo (ou tentar anexar imagem), checar no JSON cacheado de `/api/v1/models` se `architecture.input_modalities` inclui `"image"`. Se não incluir e o usuário tocar no ícone de imagem, exibir um `ModalBottomSheet` compacto ou `AssistChip` acima do input: *"O modelo atual não lê imagens. Trocar para um modelo com Visão?"* com botão de 1 toque que altera o modelo ativo para o preset de visão antes do envio.
* **Erro 429 (Rate Limit / Capacidade):** Enviar sempre no payload da requisição para `[https://openrouter.ai/api/v1/chat/completions](https://openrouter.ai/api/v1/chat/completions)` a propriedade nativa `models: [modeloEscolhido, modeloFallbackOpenRouter]` (ex: um segundo modelo `:free` ou `openrouter/auto`). Se ainda assim retornar `429` após o fallback nativo do OpenRouter e o usuário tiver chave da **xAI** configurada no Keystore, exibir `Snackbar`: *"Limite atingido no OpenRouter. Usar xAI para esta resposta?"* com ação `[Usar xAI]`.
* **Erro 402 (Sem créditos):** Exibir card/banner inline na conversa: *"Saldo insuficiente no OpenRouter para modelos pagos"* com dois botões de ação: `TextButton` **"Mudar para modelo :free"** (aplica filtro imediato e reenvia a pergunta) e `FilledTonalButton` **"Recarregar"** (abre `[https://openrouter.ai/settings/credits](https://openrouter.ai/settings/credits)` via `@capacitor/browser`). Also verificar saldo preventivamente em Ajustes via `GET [https://openrouter.ai/api/v1/credits](https://openrouter.ai/api/v1/credits)` (ou `GET /api/v1/auth/key`).






4. **Omissão/bloqueio de headers no WebView e vulnerabilidades da chave no APK (Pergunta 4)**
* **Onde:** Camada de serviço HTTP (`CapacitorHttp`), `AndroidManifest.xml` e configurações de build do Android.
* **Por quê:** (a) No navegador/WebView padrão (`window.fetch`), o header `HTTP-Referer` é um *forbidden header name* controlado pelo user-agent (que em apps Capacitor envia `http://localhost` ou `capacitor://localhost`, impedindo a identificação correta no ranking e analytics do OpenRouter). (b) Esquemas de URI customizados (`reta://callback`) para o OAuth PKCE podem sofrer sequestro de intent (*intent hijacking*) por outros apps instalados. (c) Chaves salvas em `SharedPreferences` ou bancos locais sem exclusão de backup podem vazar para a nuvem do Google Drive se o backup automático do Android estiver ativo, e chaves embutidas no código JS (`assets/public`) são extraídas em segundos descompilando o APK.
* **COMO CORRIGIR:**
* **Componente Técnico / Configuração:** Plugin `@capacitor/core` (`CapacitorHttp`), `IntentFilter` com `android:autoVerify="true"` no `AndroidManifest.xml`, e regras em `res/xml/data_extraction_rules.xml`.
* **Dimensões / Parâmetros de Header:** Configurar nas chamadas nativas do `CapacitorHttp.post`:
```json
{
  "Authorization": "Bearer sk-or-v1-...",
  "Content-Type": "application/json",
  "HTTP-Referer": "https://reta.app",
  "X-Title": "Reta Study App"
}

```


* **Fluxo de Segurança no APK:**
1. **Zero chaves hardcoded no bundle:** Nunca embutir chaves de produção em variáveis `.env` empacotadas no bundle web do Capacitor. O modelo deve ser estritamente BYOK (usuário autentica via PKCE ou cola sua chave) ou intermediado por backend próprio.
2. **Armazenamento e Backup:** Persistir a chave do OpenRouter no mesmo plugin de Secure Storage (Android Keystore + `EncryptedSharedPreferences`) já usado para a xAI. Configurar `res/xml/data_extraction_rules.xml` (Android 12+) e `res/xml/backup_rules.xml` com `<exclude domain="sharedpref" path="..."/>` para garantir que os arquivos criptografados atrelados ao hardware não sejam exportados em backups de nuvem ou transferência D2D.
3. **App Links verificados para PKCE:** Registrar o callback OAuth usando `https://` com verificação Digital Asset Links (`/.well-known/assetlinks.json` no domínio do app) em vez de custom scheme `reta://`, evitando interceptação do `code` OAuth por outros apps no Android.
4. **Proteção de Memória/WebView:** Garantir que em builds de `release` o debug da WebView esteja desativado e mascarar a chave na UI exibindo apenas os primeiros e últimos 4 caracteres (`sk-or-...9f2a`), limpando a variável em texto puro da memória JavaScript logo após passá-la à ponte nativa, ou realizando a leitura do Keystore diretamente na camada nativa antes do disparo HTTP.







---

## MELHORIAS

1. **Indicador de Saldo e Consumo em Tempo Real nos Ajustes** (Prioridade: **Alta** | Esforço: **P**)
* Consultar `GET [https://openrouter.ai/api/v1/auth/key](https://openrouter.ai/api/v1/auth/key)` (ou `/api/v1/credits`) ao abrir a tela de Ajustes e exibir um `LinearProgressIndicator` (altura `4dp`, `cornerRadius` `2dp`) com o saldo restante em dólares (`total_credits - total_usage`) e se a chave está no tier gratuito, prevenindo surpresas com o erro `402`.


2. **Roteamento Automático por Tarefa de Estudo (Task-based Routing)** (Prioridade: **Alta** | Esforço: **M**)
* Permitir que o estudante configure em Ajustes um modelo padrão para **Texto/Flashcards** (ex: modelo rápido `:free` no OpenRouter) e outro automático para **Análise de Imagem/Foto de Caderno** (ex: modelo Vision no OpenRouter ou xAI), alternando transparentemente conforme o payload contiver `image_url`.


3. **Teste de Conexão Instantâneo ("Ping") ao Salvar Provedor** (Prioridade: **Média** | Esforço: **P**)
* Assim que o OAuth PKCE concluir ou o usuário colar a chave, disparar `GET [https://openrouter.ai/api/v1/auth/key](https://openrouter.ai/api/v1/auth/key)` e exibir um `AssistChip` de confirmação com ícone de check (`#2E7D32` / token de sucesso customizado M3) ou erro imediato de chave inválida (`401`).


4. **Exibição Transparente de Custo por Resposta (Modo Estudante Econômico)** (Prioridade: **Baixa** | Esforço: **P**)
* Ler o objeto `usage` retornado pelo OpenRouter e exibir opcionalmente no rodapé da mensagem (`11sp`, `md.sys.color.onSurfaceVariant`) o modelo real utilizado (útil quando ocorre fallback) e se a chamada foi gratuita (`$0.00`).



---

## COMPARAÇÃO

| Critério / App | **AnkiDroid (Anki Android)** | **Quizlet (Q-Chat / Magic Notes)** | **Duolingo (Duolingo Max) / Forest** | **Recomendação para o Reta** |
| --- | --- | --- | --- | --- |
| **Autenticação de Serviços Externos / Sync** | Usa login direto por conta (AnkiWeb) na tela principal de sincronização e esconde URLs/chaves de servidor customizado sob `Configurações → Avançado` (padrão *Progressive Disclosure*). | Autenticação 100% gerenciada pela plataforma via OAuth social (Google/Apple). Não expõe configuração de chaves BYOK ao usuário final (sem fonte pública para BYOK no Quizlet). | Oculta toda a infraestrutura de LLM (GPT-4 no Duolingo Max) por trás de uma assinatura única; o Forest usa login OAuth/conta própria sem expor parâmetros de API. | **Híbrido (Progressive Disclosure):** Fluxo de 1 toque (OAuth PKCE do OpenRouter) + Presets simples visíveis para 90% dos estudantes, mantendo colagem de chave API e lista completa de `/api/v1/models` na aba "Avançado". |
| **Seleção de Modelos / Parâmetros** | Em recursos avançados (como o agendador FSRS), oferece um preset otimizado por padrão com botão de 1 toque ("Otimizar") e oculta os pesos matemáticos brutos para quem não quer editar manualmente. | O usuário escolhe o **objetivo de estudo** (*"Criar Flashcards"*, *"Testar conhecimento"*, *"Explicar passo a passo"*), nunca o nome técnico do modelo de IA subjacente. | Seleção zero pelo usuário: o app roteia automaticamente para o modelo adequado conforme a atividade (explicar erro vs. roleplay). | **Presets orientados a estudo** (*Grátis/Rápido*, *Raciocínio*, *Leitura de Foto*) mapeados sobre os dados de `/api/v1/models`, com explorador filtrável apenas sob demanda. |
| **Tratamento de Limites (402 / 429) e Visão** | Erros de rede ou sincronização exibem diálogos claros diferenciando falha de autenticação (`401/403`) de sobrecarga temporária do servidor. | No plano gratuito, atinge limites de uso exibindo um *bottom sheet* contextual com contador de cota ou alternativa imediata (continuar estudo manual sem IA). | Desabilita contextualmente ações indisponíveis e usa *banners* claros de cota/energia sem perder o progresso da lição em andamento. | **Prevenção + Fallback Invisível:** Array `models` nativo do OpenRouter para absorver `429` sem interromper o estudo, bloqueio prévio de câmera se o modelo não tiver `"image"`, e atalho de 1 toque para modelo `:free` em caso de `402`. |

---

## FONTES

* **OpenRouter — OAuth PKCE Authentication Flow:** [https://openrouter.ai/docs/use-cases/oauth-pkce](https://openrouter.ai/docs/use-cases/oauth-pkce)
* **OpenRouter — Models API (`GET /api/v1/models` & `input_modalities`):** [https://openrouter.ai/docs/overview/models](https://openrouter.ai/docs/overview/models)
* **OpenRouter — API Reference, Headers (`HTTP-Referer`, `X-Title`) & Model Fallbacks (`models` array):** [https://openrouter.ai/docs/api-reference/overview](https://openrouter.ai/docs/api-reference/overview)
* **OpenRouter — Errors & Rate Limits (`402`, `429`) e Limites de Chave (`GET /api/v1/auth/key`):** [https://openrouter.ai/docs/api-reference/errors](https://openrouter.ai/docs/api-reference/errors) e [https://openrouter.ai/docs/api-reference/limits](https://openrouter.ai/docs/api-reference/limits)
* **Capacitor Official Docs — CapacitorHttp (`@capacitor/core`):** [https://capacitorjs.com/docs/apis/http](https://capacitorjs.com/docs/apis/http)
* **Capacitor Official Docs — Deep Links / App Links & Browser API (OAuth):** [https://capacitorjs.com/docs/guides/deep-links](https://capacitorjs.com/docs/guides/deep-links) e [https://capacitorjs.com/docs/apis/browser](https://capacitorjs.com/docs/apis/browser)
* **Android Developers — Verify Android App Links (`autoVerify` & `assetlinks.json`):** [https://developer.android.com/training/app-links/verify-android-applinks](https://developer.android.com/training/app-links/verify-android-applinks)
* **Android Developers — Android Keystore System & Data Extraction Rules (Backup Security):** [https://developer.android.com/privacy-and-security/keystore](https://developer.android.com/privacy-and-security/keystore) e [https://developer.android.com/guide/topics/data/autobackup](https://developer.android.com/guide/topics/data/autobackup)
* **Material Design 3 — Chips, Bottom Sheets, Text Fields & Snackbars (Specs de dp, cores e estados):** [https://m3.material.io/components](https://m3.material.io/components)
* **AnkiDroid Official Manual (Configurações avançadas e UX de sincronização/parâmetros):** [https://docs.ankidroid.org/](https://docs.ankidroid.org/) Make sure to review any remaining details if needed.