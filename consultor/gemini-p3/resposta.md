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