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