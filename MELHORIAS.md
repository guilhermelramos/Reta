# MELHORIAS (backlog)

Itens do Consultor de prioridade média/baixa e esforço M/G.

## Da P1 (2026-11-01)
- **Modo claro seguindo o sistema** (Consultor P1, prob. 6 / melh. 2) — prioridade média, esforço M. Ajustes > Aparência "Sistema/Claro/Escuro"; tokens claros (fundo `#fbf8f1`, texto `#1d1b16`, âmbar `#8a5a14` em texto); StatusBar. Não aplicado agora pela regra (nem alta nem P).

## Da P3 (2026-11-01)
- **TimePicker M3 no horário de estudo** (P3 prob. 7) — baixa, M. Um botão "Horário de estudo: 14:00" abrindo um seletor de hora M3; por ora só o minuto passou a ter 2 dígitos.

## Da P2 (2026-11-01)
- **Notificação com cronômetro regressivo vivo** (P2 melh. 6 / prob. 9) — média, M. `setUsesChronometer(true)` + `setChronometerCountDown(true)` + `setWhen(endsAt)`, `setOngoing`, `setOnlyAlertOnce`, ações Pausar/Encerrar; substituir pelo aviso "Bloco concluído · N min" no fim. Exige código nativo (o plugin local-notifications não expõe cronômetro).
- **Chave xAI sob demanda** (P2 melh. 9) — baixa, M. Ao tocar "Gerar material com IA" ou "Professor" sem chave, abrir o formulário da chave num bottom sheet modal sem sair da sessão.

## Da P4 (2026-11-02)
- **Próximo intervalo nos botões de revisão** (P4, comparação AnkiDroid) — média, M. "Errei · amanhã", "Difícil · 3d", "Fácil · 7d" no caderno de erros.
- **Cartão "Dias do plano" em Progresso** (P4 prob. 5) — o Consultor sugeriu remover. Fica compacto, porque a regra é não remover funções. Reavaliar com o usuário.
