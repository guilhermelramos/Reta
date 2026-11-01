# DECISOES

Para cada resposta do Consultor: o que será aplicado, o que não será e por quê.
Regra: prioridade alta ou esforço P = aplicar; resto vai para MELHORIAS.md.

## Decisões técnicas do engenheiro (não-UI)
- Empacotamento: Capacitor 8 sobre build SPA do TanStack Start (`npm run build:cap`, CAP_BUILD=1). Web/Vercel inalterado.
- IA no APK: sem servidor. Chamadas diretas a api.x.ai via CapacitorHttp com a chave do usuário (a implementar).
- Login: a xAI não documenta OAuth público para apps de terceiros. Padrão = chave de API guardada em armazenamento seguro (Android Keystore). OAuth device-code do Grok CLI só como opção experimental atrás de flag (a decidir com o Guilherme).

## Respostas do Consultor
_(pendente)_
