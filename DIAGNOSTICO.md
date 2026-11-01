# Diagnóstico inicial (Fase 1) — 2026-11-01 (UTC-3)

Base: `main` após merge dos PRs #1 e #2 (tag `pre-merge` = main anterior). Branch: `android/capacitor`.
APK debug: `android/app/build/outputs/apk/debug/app-debug.apk` (5,45 MiB, Capacitor 8.6.0).

**Limite do ambiente:** o box não tem acesso a `/dev/kvm` (sem permissão/sudo), então o emulador Android x86_64 não sobe. A reprodução foi feita com o **mesmo bundle que vai no APK** (`dist-cap/client`) servido como o WebView do Capacitor (sem servidor) no Chromium em viewport de celular 393×851 (claro/escuro), 320×568 e paisagem. Screenshots em `consultor/shots/`, log em `consultor/shots/log.txt`. Itens nativos (notificação, timer em 2º plano, Doze) ficam **pendentes de teste no aparelho**.

## Por critério de aceite
| # | Função | Estado no APK | Evidência / causa |
|---|---|---|---|
| 1 | Login com o Grok | ❌ | Não existe login. A chave xAI fica em Ajustes, salva **em texto puro no IndexedDB** (`settings.keys.xai`). "Testar conexão" faz `POST /_serverFn/...` (createServerFn) que não existe no APK → fica preso em "Testando…" sem erro (`shots/ajustes-testar-conexao-apk.png`). xAI não documenta OAuth público para terceiros. |
| 2 | Leitura da planilha | ⚠️ parcial | Parser roda no cliente e tem testes passando. Mas: roda na thread principal (sem Web Worker); mantém colunas extras (Leitura/escrita) além de data, A, B, revisão e tempos; erro de planilha vazia/malformada a validar no aparelho. Download da planilha-modelo usa `<a download>`, que não funciona no WebView do Capacitor. |
| 3 | Notificações confiáveis | ❌ | Só Notification API web + service worker (`lib/study/notify.ts`), disparada enquanto o app está aberto. Manifest só tem INTERNET: falta POST_NOTIFICATIONS, SCHEDULE_EXACT_ALARM/USE_EXACT_ALARM, plugin de notificação local, tratamento de Doze/otimização de bateria. |
| 4 | Timer com tela bloqueada | ⚠️ | Fonte de verdade já é `startedAt` + tempo acumulado salvo (setInterval só redesenha) — bom. Falta: notificação local agendada para o término, permissão de alarme exato com fallback, wake lock é API web. Pendente de teste no aparelho. |
| 5 | Perguntas geradas pelo Grok | ❌ | `generatePackage`/`generateBlockPackage` são createServerFn → 404 no APK. |
| 6 | Pacotes offline | ⚠️ | Pacotes já baixados ficam no IndexedDB (ok offline). Gerar novos depende do servidor (❌ no APK). Imagens do Wikimedia são URLs remotas (não offline). |
| 7 | Chat com professor | ❌ | `POST /api/professor` (rota de servidor com stream) → não existe no APK. |

## Requisitos Android
- Material 3: não usa M3 (Tailwind + Radix, tema próprio escuro). App é **só escuro**; ignora `prefers-color-scheme` claro.
- Toque ≥ 48dp: muitos alvos com 44px (botões "Trocar planilha", "Exportar resumo", "Preparar semana", "Voltar para hoje", inputs) e checkboxes de 20×20 em Ajustes (`shots/log.txt`).
- Voltar/gesto: precisa do plugin `@capacitor/app` (backButton) — hoje o botão voltar do Android fecha o app.
- Rotação/telas pequenas: 320px e paisagem renderizam sem overflow horizontal (`hoje-320px.png`, `hoje-paisagem.png`).
- Erros: sem internet / limite da API (429) / permissão negada não têm mensagem tratada no caminho nativo.
- Backup: export usa `navigator.share`/`<a download>`; no APK precisa de Filesystem + Share nativos. `navigator.storage.persist()` a validar no WebView.
- Segurança: chave xAI precisa ir para armazenamento seguro (Keystore), não IndexedDB.

## Sem crash
Nenhum `pageerror` ou erro de console ao navegar Hoje → Plano → Sessão → Importar → Erros → Progresso → Ajustes (claro e escuro).

## Plano de correção (Fase 2, uma branch por problema)
1. `fix/ia-cliente-xai` — camada cliente xAI via CapacitorHttp (pacotes, perguntas, chat, pesquisa) com erros 401/429/offline.
2. `fix/login-chave-segura` — tela de entrada com validação da chave, armazenamento seguro; OAuth experimental atrás de flag.
3. `fix/notificacoes-nativas` — Local Notifications, POST_NOTIFICATIONS, alarme exato com fallback, orientação de bateria.
4. `fix/timer-segundo-plano` — notificação agendada no término, retomada pelo horário salvo.
5. `fix/backup-nativo` — Filesystem + Share para exportar/importar/planilha-modelo.
6. `fix/voltar-android` — backButton.
7. `fix/planilha-worker` — parser fora da thread principal e só as colunas pedidas.
