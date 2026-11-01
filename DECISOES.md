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
