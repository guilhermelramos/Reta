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