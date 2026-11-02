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