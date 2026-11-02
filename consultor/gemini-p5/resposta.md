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