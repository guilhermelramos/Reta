# DECISOES

Para cada resposta do Consultor: o que será aplicado, o que não será e por quê.
Regra: prioridade alta ou esforço P = aplicar; resto vai para MELHORIAS.md.

## Decisões técnicas do engenheiro (não-UI)
- Empacotamento: Capacitor 8 sobre build SPA do TanStack Start (`npm run build:cap`, CAP_BUILD=1). Web/Vercel inalterado.
- IA no APK: sem servidor. Chamadas diretas a api.x.ai via CapacitorHttp com a chave do usuário (implementado em `src/lib/ai/xai-client.ts`; web segue nas server functions).
- Login: a xAI não documenta OAuth público para apps de terceiros. Padrão = chave de API guardada em armazenamento seguro (Android Keystore). OAuth device-code do Grok CLI só como opção experimental atrás de flag (a decidir com o Guilherme).

## Respostas do Consultor

### P1 — problema 1/8 + melhoria 5 (estados de erro)
- **Aplicado:** `InlineError` e `ErrorState` em `src/components/feedback/`;
  mapeamento puro erro → texto/ação em `src/lib/feedback/error-copy.ts`, com os
  textos exatos (offline, 429 com `Retry-After`, 401/403, notificação negada,
  planilha e bloco ausente) e testes em `error-copy.test.ts`.
- **Aplicado:** `AiResult` passou a carregar `failure` (kind/status/retry) para a
  UI escolher a ação sem depender de comparar strings.
- **Aplicado:** timeout de 15 s em todos os pedidos de IA para conectar e nos
  fluxos curtos; geração de pacote mantém 90 s (15 s cortaria a aula).
- **Aplicado:** plugin `capacitor-native-settings` 8.2.0 só para abrir as
  configurações do app no Android; na web a ação explica o caminho do navegador.
- **Não aplicado:** notificações locais nativas (problema 3) — o aviso de
  permissão já usa o estado real da API disponível, mas o lembrete nativo fica
  para a correção própria.

## P1 — (a) diagnóstico + (b) redesign — 2026-11-01 (UTC-3)
Regra: prioridade alta ou esforço P = aplicar; resto → MELHORIAS.md.

| Item do Consultor | Prioridade/esforço | Decisão | Onde |
|---|---|---|---|
| Prob. 1 — falhas silenciosas, timeout 15 s, `<ErrorState>`/`<InlineError>` | bloqueante | **Aplicar** | `fix/estados-erro` (sobre `fix/ia-cliente-xai`) |
| Prob. 2 — backButton (fecha gaveta/diálogo, volta, não encerra timer) | alta | **Aplicar** | `fix/voltar-android`. Na tela Hoje: `minimizeApp()` (mantém o app vivo, comportamento padrão do Android) em vez de `exitApp()`/toast — ambas eram opções aceitas pelo Consultor. |
| Prob. 3 — alvos ≥ 48dp, checkbox em label 48dp | alta | **Aplicar** | `ui/alvos-navegacao-m3` |
| Prob. 4 — hierarquia da Hoje (cartão herói, blocos vazios recolhidos, overflow) | alta | **Aplicar** no redesign da tela Hoje (3ª da ordem) | redesign |
| Prob. 5 — Navigation bar M3 80dp + indicador, esconder na Sessão | alta | **Aplicar** | `ui/alvos-navegacao-m3` |
| Prob. 6 / Melh. 2 — modo claro seguindo o sistema | média, M | **MELHORIAS.md** (regra). O app segue escuro. | — |
| Prob. 7 — opacidade de texto ≥ /80, mínimos 12/14/16sp | alta | **Aplicar** (opacidade + mínimos) | `ui/alvos-navegacao-m3` e telas |
| Prob. 8 / Melh. 5 — estados vazios/erro padronizados | alta, P–M | **Aplicar** | `fix/estados-erro` |
| Prob. 9 / Melh. 3 — chave no Keystore + onboarding de 4 telas | alta, M | **Aplicar**: serviço em `fix/chave-segura`; onboarding é a 1ª tela do redesign. Alarme exato/bateria pedidos só no momento de valor. | `fix/chave-segura`, redesign |
| Prob. 10 — notificações/timer nativos | alta | **Aplicar** | `fix/notificacoes-nativas`, `fix/timer-segundo-plano` |
| Prob. 11 — acessibilidade (skip link 48dp, labels) | alta | **Aplicar**; TalkBack fica pendente de aparelho | `ui/alvos-navegacao-m3` |
| Melh. 1 — "M3 essencial" mantendo a identidade (tokens de papel, escala tipográfica, formas, estados, Snackbar, bottom sheet) | alta, M | **Aplicar** ao longo do redesign; sem cores dinâmicas (preserva o âmbar) | redesign |
| Melh. 4 — tela de estudo (app bar 64dp com timer 32–36sp, progresso 4dp, Pausar 56dp, Encerrar com confirmação, chat em bottom sheet 90% com chip do timer) | alta, M | **Aplicar** (2ª tela). Notificação persistente: sem FGS se a notificação agendada bastar (FGS exige justificativa na Play). | redesign Sessão |
| Melh. 6 — ordem: Onboarding → Sessão → Hoje → Ajustes → Importar → Erros → Plano → Progresso | alta | **Aplicar** | — |
| Melh. 7 — háptico + Snackbar ao concluir | média, P | **Aplicar** (esforço P) | redesign Sessão |
| Melh. 8 — largura máx. 600dp, rail ≥ 600dp | baixa, P | **Aplicar** (esforço P) | redesign Hoje/shell |
| Melh. 9 — Ajustes em seções + switches M3 | média, P | **Aplicar** (esforço P) | redesign Ajustes |
| Comparação (AnkiDroid/Duolingo/Quizlet) | — | Usada como referência; o Consultor marcou "sem fonte verificada". | — |

> Nota da integração (integracao-fase2): as notificações locais nativas citadas acima como "não aplicado" em fix/estados-erro chegaram por fix/notificacoes-nativas e fix/timer-segundo-plano, já mesclados.

## P2 — revisão (c) Onboarding + Sessão (2026-11-01, UTC-3)

Resposta em `consultor/respostas.md` (## P2), gerada pelo Gemini a pedido do Guilherme. Ressalva: o Gemini viu só 10 das 36 telas enviadas (`consultor/gemini-p2/`). Regra: alta ou esforço P = aplicar; o resto vai para `MELHORIAS.md`.

| Item | Prioridade/esforço | Decisão | Onde |
|---|---|---|---|
| Melh. 1 / Prob. 5 — tempo restante como número principal, igual ao chip do sheet | alta, P | **Aplicar** | `ui/p2-sessao` |
| Melh. 2 / Prob. 10 — paisagem: sem sidebar na Sessão, FAB sem cobrir cartão, split view | alta, M | **Aplicar** | `ui/p2-sessao` |
| Melh. 3 / Prob. 1 — "Agora não" no passo 2 (avança um passo), esconder "N dias no plano" antes de importar | alta, P | **Aplicar** | `ui/p2-onboarding` |
| Melh. 4 / Prob. 8 — sheet do Professor: chips em linha com rolagem e fade, Enviar 48dp desabilitado se vazio, sem aviso duplicado | alta, P | **Aplicar** | `ui/p2-sessao` |
| Melh. 5 / Prob. 7 — um só cartão de estado vazio, CTA "Gerar material com IA" em 1 linha, padding-bottom 96dp | alta, P | **Aplicar** (mantendo "Montar esta aula" como ação secundária se for função distinta) | `ui/p2-sessao` |
| Melh. 7 / Prob. 6 — Pausar tonal vs. Iniciar filled, progresso 6dp, voltar ← 48dp na app bar | média, P | **Aplicar** | `ui/p2-sessao` |
| Melh. 8 / Prob. 2–3 — chevron no expansor, Verificar desabilitado sem chave, título do passo 4 em 320px, frase duplicada | média, P | **Aplicar** | `ui/p2-onboarding` |
| Prob. 4 — onboarding em paisagem com 2 colunas | sem prioridade na tabela, P | **Aplicar** | `ui/p2-onboarding` |
| Prob. 9 — alarme exato no 1º Iniciar | — | Já aplicado (confirmado pelo Consultor) | — |
| Melh. 6 — notificação com cronômetro regressivo nativo (`setChronometerCountDown`) | média, M | **MELHORIAS.md** | — |
| Melh. 9 — chave xAI "lazy" em bottom sheet na Sessão | baixa, M | **MELHORIAS.md** | — |

### P2 Sessão — aplicado em `ui/p2-sessao`

- **Tempo restante único:** `timerHeadline()`/`studiedSubline()` em
  `src/lib/study/session-timer.ts` alimentam o cabeçalho e o chip da folha;
  depois da meta o número vira `+MM:SS` nos dois lugares. Nada mudou no serviço
  nativo do timer (`endsAt` + alarme continuam a fonte de verdade).
- **Split view sem navegação:** o shell esconde a barra lateral e a inferior em
  `/sessao` em qualquer largura; paisagem ≥600dp usa coluna fixa de 260dp com o
  timer (40sp) e o Professor na base, e conteúdo rolável à direita. O FAB fica
  só no retrato, com 96dp de respiro no rodapé.
- **Cartão vazio único:** “Gerar material com IA” (CTA de uma linha) e
  “Montar esta aula” (do plano, sem IA) no mesmo cartão; nenhuma ação removida.
- **Folha do Professor:** cabeçalho M3 com chip do timer, “Professor IA” e
  “Caderno” (alvo 48dp); perguntas rápidas em uma linha com fade (somem depois
  da 1ª mensagem; atalhos permanecem) e enviar como IconButton 48dp.
- **Fora do escopo:** a notificação com cronômetro nativo continua no backlog
  (`MELHORIAS.md`); em telas <390dp o rótulo “Caderno” e o ícone do relógio do
  chip encolhem para o título “Professor IA” caber inteiro.

