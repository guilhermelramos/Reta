import type { PlanDay } from "@/lib/study/types";

/** Plano UTFPR 2027 carregado da planilha anexa. Reimportar não apaga o histórico. */
export const SEED_DAYS: PlanDay[] = [
  {
    "date": "2026-10-18",
    "phase": "Dom · Preparação",
    "blocks": [
      {
        "kind": "A",
        "content": "Organizar materiais e confirmar o que foi feito em 15–17/10. Escolher o idioma da inscrição.",
        "plannedMin": 10
      },
      {
        "kind": "B",
        "content": "Separar os 3 livros e provas oficiais anteriores.",
        "plannedMin": 10
      },
      {
        "kind": "R",
        "content": "Sem revisão obrigatória.",
        "plannedMin": 0
      },
      {
        "kind": "L",
        "content": "Descanso após organizar.",
        "plannedMin": 0
      }
    ]
  },
  {
    "date": "2026-10-19",
    "phase": "Seg · Lacunas + revisão",
    "blocks": [
      {
        "kind": "A",
        "content": "Matemática: contagem, combinações, permutações e probabilidade condicional.",
        "plannedMin": 50
      },
      {
        "kind": "B",
        "content": "Química: termoquímica, entalpia, Hess e energia de ligação. Começar por 2 questões diagnósticas.",
        "plannedMin": 50
      },
      {
        "kind": "R",
        "content": "Retomar razão/proporção/porcentagem e mol/massa molar. 4 questões.",
        "plannedMin": 20
      },
      {
        "kind": "L",
        "content": "Leitura: Memórias Póstumas de Brás Cubas. Avançar na obra e anotar narrador, ironia e um trecho.",
        "plannedMin": 20
      }
    ]
  },
  {
    "date": "2026-10-20",
    "phase": "Ter · Lacunas + revisão",
    "blocks": [
      {
        "kind": "A",
        "content": "Física: trabalho, energia e potência; impulso, momento e colisões.",
        "plannedMin": 50
      },
      {
        "kind": "B",
        "content": "Biologia: Mendel, heredogramas, probabilidade e dominâncias.",
        "plannedMin": 50
      },
      {
        "kind": "R",
        "content": "Sem consulta: 2 questões de contagem + 2 de termoquímica de ontem.",
        "plannedMin": 20
      },
      {
        "kind": "L",
        "content": "Leitura: Memórias Póstumas de Brás Cubas. Avançar na obra e anotar narrador, ironia e um trecho.",
        "plannedMin": 20
      }
    ]
  },
  {
    "date": "2026-10-21",
    "phase": "Qua · Lacunas + revisão",
    "blocks": [
      {
        "kind": "A",
        "content": "Matemática: funções afim/quadrática, domínio, imagem, inversa, composta, modular e racional.",
        "plannedMin": 50
      },
      {
        "kind": "B",
        "content": "Química: ácidos, bases, sais, óxidos/hidretos; teorias ácido-base e neutralização.",
        "plannedMin": 50
      },
      {
        "kind": "R",
        "content": "Retomar citologia (membrana/organelas) + 2 erros de genética/energia de ontem.",
        "plannedMin": 20
      },
      {
        "kind": "L",
        "content": "Leitura: Memórias Póstumas de Brás Cubas. Avançar na obra e anotar narrador, ironia e um trecho.",
        "plannedMin": 20
      }
    ]
  },
  {
    "date": "2026-10-22",
    "phase": "Qui · Lacunas + revisão",
    "blocks": [
      {
        "kind": "A",
        "content": "Física: termometria, dilatação, transmissão de calor e calorimetria.",
        "plannedMin": 50
      },
      {
        "kind": "B",
        "content": "Matemática: geometria analítica; pontos, distância, reta, paralelismo e perpendicularismo.",
        "plannedMin": 50
      },
      {
        "kind": "R",
        "content": "Rever PA/PG e funções; recuperar 1 conceito de ácido-base sem consulta.",
        "plannedMin": 20
      },
      {
        "kind": "L",
        "content": "Leitura: Memórias Póstumas de Brás Cubas. Avançar na obra e anotar narrador, ironia e um trecho.",
        "plannedMin": 20
      }
    ]
  },
  {
    "date": "2026-10-23",
    "phase": "Sex · Lacunas + revisão",
    "blocks": [
      {
        "kind": "A",
        "content": "Biologia: bioquímica, DNA/RNA, síntese proteica, mitose/meiose e metabolismo.",
        "plannedMin": 50
      },
      {
        "kind": "B",
        "content": "Química: soluções, concentração, solubilidade, coloides e propriedades coligativas.",
        "plannedMin": 50
      },
      {
        "kind": "R",
        "content": "Rever grandezas/SI, unidades, gráficos de cinemática e 1 questão de calor.",
        "plannedMin": 20
      },
      {
        "kind": "L",
        "content": "Leitura: Memórias Póstumas de Brás Cubas. Avançar na obra e anotar narrador, ironia e um trecho.",
        "plannedMin": 20
      }
    ]
  },
  {
    "date": "2026-10-24",
    "phase": "Sáb · Manutenção + redação",
    "blocks": [
      {
        "kind": "A",
        "content": "Humanas: H01–H02 + G01–G03. Linha do tempo de Antiguidade/Medievo; cartografia, geologia e relevo.",
        "plannedMin": 55
      },
      {
        "kind": "B",
        "content": "Linguagens: P01/P05/P06 + LE01; 2 textos, inferência, coesão, semântica e variação.",
        "plannedMin": 40
      },
      {
        "kind": "R",
        "content": "Filosofia/Sociologia: FS01/FS02/FS06; mito, conhecimento e interação social. 4 questões.",
        "plannedMin": 25
      },
      {
        "kind": "L",
        "content": "Redação: 15–20 linhas; tese, 2 argumentos e intervenção. Corrigir pelos 5 critérios.",
        "plannedMin": 60
      }
    ]
  },
  {
    "date": "2026-10-25",
    "phase": "Dom · Descanso",
    "blocks": [
      {
        "kind": "A",
        "content": "Descanso planejado.",
        "plannedMin": 0
      },
      {
        "kind": "B",
        "content": "Sem compensar a semana.",
        "plannedMin": 0
      },
      {
        "kind": "R",
        "content": "Sem atividade obrigatória.",
        "plannedMin": 0
      },
      {
        "kind": "L",
        "content": "Opcional: 10 min do caderno de erros; fora da carga.",
        "plannedMin": 0
      }
    ]
  },
  {
    "date": "2026-10-26",
    "phase": "Seg · Lacunas + revisão",
    "blocks": [
      {
        "kind": "A",
        "content": "Matemática: conjuntos, divisibilidade, MMC/MDC, frações, intervalos, módulo, inequações e juros.",
        "plannedMin": 50
      },
      {
        "kind": "B",
        "content": "Física: lançamentos, movimento circular, gravitação, Kepler e satélites.",
        "plannedMin": 50
      },
      {
        "kind": "R",
        "content": "Revisão de 7 dias: combinatória/probabilidade + termoquímica. Refazer 4 erros. + 1 questão de geometria plana (12/10).",
        "plannedMin": 20
      },
      {
        "kind": "L",
        "content": "Leitura: Memórias Póstumas de Brás Cubas. Avançar na obra e anotar narrador, ironia e um trecho.",
        "plannedMin": 20
      }
    ]
  },
  {
    "date": "2026-10-27",
    "phase": "Ter · Lacunas + revisão",
    "blocks": [
      {
        "kind": "A",
        "content": "Química: estequiometria, fórmulas, limitante/rendimento, NOX, redox e balanceamento.",
        "plannedMin": 50
      },
      {
        "kind": "B",
        "content": "Matemática: sequências, recorrência, PA/PG, interpolação e somas.",
        "plannedMin": 50
      },
      {
        "kind": "R",
        "content": "Revisão de 7 dias: energia/colisões + genética. + 1 questão de fisiologia (14/10).",
        "plannedMin": 20
      },
      {
        "kind": "L",
        "content": "Leitura: Memórias Póstumas de Brás Cubas. Avançar na obra e anotar narrador, ironia e um trecho.",
        "plannedMin": 20
      }
    ]
  },
  {
    "date": "2026-10-28",
    "phase": "Qua · Lacunas + revisão",
    "blocks": [
      {
        "kind": "A",
        "content": "Biologia: origem da vida, evolução, evidências, seleção, especiação e evolução humana.",
        "plannedMin": 50
      },
      {
        "kind": "B",
        "content": "Física: gases, diagramas, termodinâmica, ciclos e rendimento de máquinas.",
        "plannedMin": 50
      },
      {
        "kind": "R",
        "content": "Rever funções, ácido-base, tabela periódica e ligações; explicar sem consulta. + 1 questão de ecologia (07/10).",
        "plannedMin": 20
      },
      {
        "kind": "L",
        "content": "Leitura: Memórias Póstumas de Brás Cubas. Avançar na obra e anotar narrador, ironia e um trecho.",
        "plannedMin": 20
      }
    ]
  },
  {
    "date": "2026-10-29",
    "phase": "Qui · Lacunas + revisão",
    "blocks": [
      {
        "kind": "A",
        "content": "Matemática: matrizes, determinantes, sistemas e discussão de soluções.",
        "plannedMin": 50
      },
      {
        "kind": "B",
        "content": "Química: equilíbrio, Le Chatelier, pH/pOH, Ka/Kb, hidrólise, tampão e Kps.",
        "plannedMin": 50
      },
      {
        "kind": "R",
        "content": "Revisão de 7 dias: calorimetria + reta. 2 questões de cada. + 1 questão de trigonometria (08/10).",
        "plannedMin": 20
      },
      {
        "kind": "L",
        "content": "Leitura: Nihonjin. Avançar na obra e anotar memória, identidade, imigração e um trecho.",
        "plannedMin": 20
      }
    ]
  },
  {
    "date": "2026-10-30",
    "phase": "Sex · Lacunas + revisão",
    "blocks": [
      {
        "kind": "A",
        "content": "Física: ondas, superposição, reflexão/refração, acústica, harmônicos e Doppler.",
        "plannedMin": 50
      },
      {
        "kind": "B",
        "content": "Biologia: histologia animal/vegetal; classificação e fisiologia vegetal.",
        "plannedMin": 50
      },
      {
        "kind": "R",
        "content": "Revisão de 7 dias: biologia molecular + soluções/coligativas. + 1 questão de estequiometria (02/10).",
        "plannedMin": 20
      },
      {
        "kind": "L",
        "content": "Leitura: Nihonjin. Avançar na obra e anotar memória, identidade, imigração e um trecho.",
        "plannedMin": 20
      }
    ]
  },
  {
    "date": "2026-10-31",
    "phase": "Sáb · Manutenção + reescrita",
    "blocks": [
      {
        "kind": "A",
        "content": "Humanas: H03 (Moderna e revoluções) + H04/H05; G04–G08 (clima, água, solo, vegetação e recursos).",
        "plannedMin": 60
      },
      {
        "kind": "B",
        "content": "Português: classes/flexões, ortografia, sintaxe, concordância, regência e pontuação em textos.",
        "plannedMin": 35
      },
      {
        "kind": "R",
        "content": "Filosofia/Sociologia: FS03/FS05/FS07/FS11; ética, ciência, cultura e diversidade.",
        "plannedMin": 25
      },
      {
        "kind": "L",
        "content": "30 min: corrigir e reescrever a redação de 24/10. 30 min: comparar Brás Cubas e Nihonjin, usando trechos.",
        "plannedMin": 60
      }
    ]
  },
  {
    "date": "2026-11-01",
    "phase": "Dom · Descanso",
    "blocks": [
      {
        "kind": "A",
        "content": "Descanso planejado.",
        "plannedMin": 0
      },
      {
        "kind": "B",
        "content": "Sem compensação.",
        "plannedMin": 0
      },
      {
        "kind": "R",
        "content": "Sem atividade obrigatória.",
        "plannedMin": 0
      },
      {
        "kind": "L",
        "content": "Leitura opcional, sem meta adicional.",
        "plannedMin": 0
      }
    ]
  },
  {
    "date": "2026-11-02",
    "phase": "Seg · Lacunas + revisão",
    "blocks": [
      {
        "kind": "A",
        "content": "Matemática: trigonometria; círculo, radianos, leis dos senos/cossenos, gráficos, identidades e equações.",
        "plannedMin": 50
      },
      {
        "kind": "B",
        "content": "Química: cinética, gráficos, energia de ativação, catalisador, ordem e etapa lenta.",
        "plannedMin": 50
      },
      {
        "kind": "R",
        "content": "Revisão de 14 dias: probabilidade/contagem + termoquímica.",
        "plannedMin": 20
      },
      {
        "kind": "L",
        "content": "Leitura: Nihonjin. Avançar na obra e anotar memória, identidade, imigração e um trecho.",
        "plannedMin": 20
      }
    ]
  },
  {
    "date": "2026-11-03",
    "phase": "Ter · Lacunas + revisão",
    "blocks": [
      {
        "kind": "A",
        "content": "Física: cargas, Coulomb, campo/potencial, capacitores e associações.",
        "plannedMin": 50
      },
      {
        "kind": "B",
        "content": "Matemática: circunferência e posições relativas; parábola, elipse e hipérbole.",
        "plannedMin": 50
      },
      {
        "kind": "R",
        "content": "Revisão de 14 dias: energia + genética; 1 erro de ácido-base.",
        "plannedMin": 20
      },
      {
        "kind": "L",
        "content": "Leitura: Nihonjin. Avançar na obra e anotar memória, identidade, imigração e um trecho.",
        "plannedMin": 20
      }
    ]
  },
  {
    "date": "2026-11-04",
    "phase": "Qua · Lacunas + revisão",
    "blocks": [
      {
        "kind": "A",
        "content": "Biologia: herança sexual, ligação/mapeamento, alelos, interações, poligenia e alterações cromossômicas.",
        "plannedMin": 50
      },
      {
        "kind": "B",
        "content": "Química: pilhas, potenciais de redução, eletrólise e leis de Faraday.",
        "plannedMin": 50
      },
      {
        "kind": "R",
        "content": "Rever evolução e termodinâmica da semana anterior; 2 questões de ligações/tabela.",
        "plannedMin": 20
      },
      {
        "kind": "L",
        "content": "Leitura: Nihonjin. Avançar na obra e anotar memória, identidade, imigração e um trecho.",
        "plannedMin": 20
      }
    ]
  },
  {
    "date": "2026-11-05",
    "phase": "Qui · Lacunas + revisão",
    "blocks": [
      {
        "kind": "A",
        "content": "Matemática: polinômios, fatoração, raízes/multiplicidade, relações de coeficientes e números complexos.",
        "plannedMin": 50
      },
      {
        "kind": "B",
        "content": "Física: espelhos, lentes, imagens, refração, reflexão total e óptica física.",
        "plannedMin": 50
      },
      {
        "kind": "R",
        "content": "Revisão de 7 dias: matrizes/sistemas e equilíbrio/pH.",
        "plannedMin": 20
      },
      {
        "kind": "L",
        "content": "Leitura: Nihonjin. Avançar na obra e anotar memória, identidade, imigração e um trecho.",
        "plannedMin": 20
      }
    ]
  },
  {
    "date": "2026-11-06",
    "phase": "Sex · Lacunas + revisão",
    "blocks": [
      {
        "kind": "A",
        "content": "Química: carbono, hibridização, funções/nomenclatura, isomeria geométrica/óptica e quiralidade.",
        "plannedMin": 50
      },
      {
        "kind": "B",
        "content": "Biologia: vírus, monera, protista, fungos, animais; reprodução e embriologia.",
        "plannedMin": 50
      },
      {
        "kind": "R",
        "content": "Revisão de 7 dias: ondas e tecidos. Retomar hidrostática por 2 questões.",
        "plannedMin": 20
      },
      {
        "kind": "L",
        "content": "Leitura: Nihonjin. Avançar na obra e anotar memória, identidade, imigração e um trecho.",
        "plannedMin": 20
      }
    ]
  },
  {
    "date": "2026-11-07",
    "phase": "Sáb · Manutenção + redação",
    "blocks": [
      {
        "kind": "A",
        "content": "Humanas: H03 (guerras, revoluções, Guerra Fria) e H06 (República); G09/G10 (população e economia).",
        "plannedMin": 50
      },
      {
        "kind": "B",
        "content": "Linguagens: leitura de Brás Cubas/Nihonjin + texto do idioma da inscrição.",
        "plannedMin": 35
      },
      {
        "kind": "R",
        "content": "Filosofia/Sociologia: FS04/FS08/FS09/FS10/FS12; política, poder, desigualdade, democracia e trabalho.",
        "plannedMin": 25
      },
      {
        "kind": "L",
        "content": "Redação: 15–20 linhas sobre um tema novo. Revisar o critério mais fraco de 24/10.",
        "plannedMin": 60
      }
    ]
  },
  {
    "date": "2026-11-08",
    "phase": "Dom · Simulado completo",
    "blocks": [
      {
        "kind": "A",
        "content": "Simulado 1, das 14h às 18h, sem consulta. 40 objetivas: 6 M, 6 F, 6 Q, 4 B, 2 G, 2 H, 6 Português, 2 Literatura, 4 idioma, 2 Filosofia/Sociologia.",
        "plannedMin": 240
      },
      {
        "kind": "B",
        "content": "Produzir também redação de 15–20 linhas e preencher cartão-resposta dentro das 4h.",
        "plannedMin": 0
      },
      {
        "kind": "R",
        "content": "Registrar respostas e tempo; corrigir amanhã.",
        "plannedMin": 0
      },
      {
        "kind": "L",
        "content": "Descanso depois da prova.",
        "plannedMin": 0
      }
    ]
  },
  {
    "date": "2026-11-09",
    "phase": "Seg · Correção + lacunas",
    "blocks": [
      {
        "kind": "A",
        "content": "Corrigir simulado 1: separar erros de conceito, interpretação, conta e tempo. Reescrever 1 parágrafo.",
        "plannedMin": 60
      },
      {
        "kind": "B",
        "content": "Matemática: geometria plana e espacial; semelhança, áreas, volumes, troncos, esfera e sólidos inscritos.",
        "plannedMin": 50
      },
      {
        "kind": "R",
        "content": "Rever trigonometria/cinética. Selecionar 3 erros do simulado para refazer em 11/11.",
        "plannedMin": 20
      },
      {
        "kind": "L",
        "content": "Leitura: Felicidade Clandestina. Ler contos, observar narrador, linguagem e conflitos; registrar um trecho.",
        "plannedMin": 20
      }
    ]
  },
  {
    "date": "2026-11-10",
    "phase": "Ter · Lacunas + revisão",
    "blocks": [
      {
        "kind": "A",
        "content": "Física: Ohm, potência, circuitos, geradores, nós/malhas; campo magnético, forças e indução.",
        "plannedMin": 50
      },
      {
        "kind": "B",
        "content": "Química: reações orgânicas, polímeros, biomoléculas, combustíveis e ambiente.",
        "plannedMin": 50
      },
      {
        "kind": "R",
        "content": "Revisão de 7 dias: eletrostática + cônicas/circunferência.",
        "plannedMin": 20
      },
      {
        "kind": "L",
        "content": "Leitura: Felicidade Clandestina. Ler contos, observar narrador, linguagem e conflitos; registrar um trecho.",
        "plannedMin": 20
      }
    ]
  },
  {
    "date": "2026-11-11",
    "phase": "Qua · Lacunas + revisão",
    "blocks": [
      {
        "kind": "A",
        "content": "Biologia: sistemas e homeostase; doenças, drogas, imunidade, saneamento e profilaxia.",
        "plannedMin": 50
      },
      {
        "kind": "B",
        "content": "Matemática: estatística (média, mediana, dispersão), binômio de Newton e probabilidade.",
        "plannedMin": 50
      },
      {
        "kind": "R",
        "content": "Refazer os 3 erros escolhidos do simulado 1 + 1 questão de genética/eletroquímica.",
        "plannedMin": 20
      },
      {
        "kind": "L",
        "content": "Leitura: Felicidade Clandestina. Ler contos, observar narrador, linguagem e conflitos; registrar um trecho.",
        "plannedMin": 20
      }
    ]
  },
  {
    "date": "2026-11-12",
    "phase": "Qui · Lacunas + revisão",
    "blocks": [
      {
        "kind": "A",
        "content": "Física: relatividade básica, corpo negro, fotoelétrico e dualidade.",
        "plannedMin": 50
      },
      {
        "kind": "B",
        "content": "Matemática: exponenciais/logaritmos, equações/inequações e funções por partes.",
        "plannedMin": 50
      },
      {
        "kind": "R",
        "content": "Revisão de 7 dias: polinômios/complexos + óptica.",
        "plannedMin": 20
      },
      {
        "kind": "L",
        "content": "Leitura: Felicidade Clandestina. Ler contos, observar narrador, linguagem e conflitos; registrar um trecho.",
        "plannedMin": 20
      }
    ]
  },
  {
    "date": "2026-11-13",
    "phase": "Sex · Lacunas + revisão",
    "blocks": [
      {
        "kind": "A",
        "content": "Química: misturas/separação, modelos atômicos, radioatividade, periodicidade, Lewis/geometria e gases.",
        "plannedMin": 50
      },
      {
        "kind": "B",
        "content": "Física: estática, torque/centro de massa, Hooke/MHS e continuidade/vazão; recuperar hidrostática.",
        "plannedMin": 50
      },
      {
        "kind": "R",
        "content": "Revisão de 7 dias: funções orgânicas/isomeria e classificação dos seres vivos.",
        "plannedMin": 20
      },
      {
        "kind": "L",
        "content": "Leitura: Felicidade Clandestina. Ler contos, observar narrador, linguagem e conflitos; registrar um trecho.",
        "plannedMin": 20
      }
    ]
  },
  {
    "date": "2026-11-14",
    "phase": "Sáb · Revisão antes do simulado",
    "blocks": [
      {
        "kind": "A",
        "content": "Humanas: G11 (geopolítica/território) + revisão dos erros de História, Geografia e Filosofia/Sociologia.",
        "plannedMin": 35
      },
      {
        "kind": "B",
        "content": "Português + idioma: 2 textos e revisão dos erros de sintaxe, coesão e vocabulário.",
        "plannedMin": 30
      },
      {
        "kind": "R",
        "content": "Literatura: comparar os 3 livros; texto, narrador, linguagem, contexto e interpretação.",
        "plannedMin": 30
      },
      {
        "kind": "L",
        "content": "Redação: reescrever a conclusão/intervenção mais fraca. Conferir os 5 critérios.",
        "plannedMin": 25
      }
    ]
  },
  {
    "date": "2026-11-15",
    "phase": "Dom · Simulado completo",
    "blocks": [
      {
        "kind": "A",
        "content": "Simulado 2, das 14h às 18h, sem consulta. 40 objetivas: 6 M, 6 F, 6 Q, 4 B, 2 G, 2 H, 6 Português, 2 Literatura, 4 idioma, 2 Filosofia/Sociologia.",
        "plannedMin": 240
      },
      {
        "kind": "B",
        "content": "Redação de 15–20 linhas e cartão-resposta. Usar uma prova diferente do simulado 1.",
        "plannedMin": 0
      },
      {
        "kind": "R",
        "content": "Registrar tempo e questões em branco. Corrigir amanhã.",
        "plannedMin": 0
      },
      {
        "kind": "L",
        "content": "Descanso depois da prova.",
        "plannedMin": 0
      }
    ]
  },
  {
    "date": "2026-11-16",
    "phase": "Seg · Reta final",
    "blocks": [
      {
        "kind": "A",
        "content": "Corrigir simulado 2; escolher os 3 temas com maior perda de pontos e refazer sem gabarito.",
        "plannedMin": 50
      },
      {
        "kind": "B",
        "content": "Matemática: probabilidade, funções e lacuna mais importante indicada pelos simulados.",
        "plannedMin": 35
      },
      {
        "kind": "R",
        "content": "Revisar geometria plana/espacial. Conferir o ensalamento disponibilizado hoje.",
        "plannedMin": 15
      },
      {
        "kind": "L",
        "content": "Leitura: Felicidade Clandestina. Ler contos, observar narrador, linguagem e conflitos; registrar um trecho.",
        "plannedMin": 20
      }
    ]
  },
  {
    "date": "2026-11-17",
    "phase": "Ter · Reta final",
    "blocks": [
      {
        "kind": "A",
        "content": "Física: questões de energia, circuitos, ondas e óptica escolhidas pelos erros.",
        "plannedMin": 35
      },
      {
        "kind": "B",
        "content": "Química: equilíbrio, pH e eletroquímica; questões fáceis/médias.",
        "plannedMin": 35
      },
      {
        "kind": "R",
        "content": "Retomar estequiometria, soluções e hidrostática; explicar as unidades.",
        "plannedMin": 20
      },
      {
        "kind": "L",
        "content": "Leitura: Felicidade Clandestina. Ler contos, observar narrador, linguagem e conflitos; registrar um trecho.",
        "plannedMin": 10
      }
    ]
  },
  {
    "date": "2026-11-18",
    "phase": "Qua · Reta final",
    "blocks": [
      {
        "kind": "A",
        "content": "Biologia: ecologia, ciclos, biomas, populações, impactos + fisiologia e genética.",
        "plannedMin": 35
      },
      {
        "kind": "B",
        "content": "Matemática: geometria espacial/analítica e os 2 erros mais persistentes.",
        "plannedMin": 35
      },
      {
        "kind": "R",
        "content": "Retomar citologia, metabolismo e evolução. 3 erros do simulado 2, sem consulta.",
        "plannedMin": 15
      },
      {
        "kind": "L",
        "content": "Leitura: Felicidade Clandestina. Ler contos, observar narrador, linguagem e conflitos; registrar um trecho.",
        "plannedMin": 15
      }
    ]
  },
  {
    "date": "2026-11-19",
    "phase": "Qui · Reta final",
    "blocks": [
      {
        "kind": "A",
        "content": "Matemática: questões mistas de funções, PA/PG, matrizes, trigonometria e geometria.",
        "plannedMin": 35
      },
      {
        "kind": "B",
        "content": "Química: geral, termoquímica, cinética e orgânica; refazer os erros selecionados.",
        "plannedMin": 30
      },
      {
        "kind": "R",
        "content": "Física: grandezas, termodinâmica, moderna e pontos fracos.",
        "plannedMin": 15
      },
      {
        "kind": "L",
        "content": "Literatura: rever fichas e trechos dos 3 livros.",
        "plannedMin": 10
      }
    ]
  },
  {
    "date": "2026-11-20",
    "phase": "Sex · Revisão leve",
    "blocks": [
      {
        "kind": "A",
        "content": "Natureza: apenas questões fáceis/médias e erros recorrentes de Biologia, Química e Física.",
        "plannedMin": 30
      },
      {
        "kind": "B",
        "content": "Português e idioma: interpretação, coesão, regência/pontuação e vocabulário em texto.",
        "plannedMin": 30
      },
      {
        "kind": "R",
        "content": "Matemática: 2 erros persistentes e relações fundamentais, sem decorar lista enorme.",
        "plannedMin": 10
      },
      {
        "kind": "L",
        "content": "Redação: revisar um texto já corrigido, tese, argumento e intervenção.",
        "plannedMin": 20
      }
    ]
  },
  {
    "date": "2026-11-21",
    "phase": "Sáb · Véspera",
    "blocks": [
      {
        "kind": "A",
        "content": "10 min: ler até 5 erros importantes e relações essenciais.",
        "plannedMin": 10
      },
      {
        "kind": "B",
        "content": "10 min: estrutura da redação e fichas das obras, sem assunto novo.",
        "plannedMin": 10
      },
      {
        "kind": "R",
        "content": "10 min: documento, ensalamento, trajeto, canetas permitidas e água.",
        "plannedMin": 10
      },
      {
        "kind": "L",
        "content": "Encerrar. Descanso e sono no horário habitual.",
        "plannedMin": 0
      }
    ]
  },
  {
    "date": "2026-11-22",
    "phase": "Dom · Prova",
    "blocks": [
      {
        "kind": "A",
        "content": "PROVA. Portões: 12h30–13h30. Início às 14h; duração de 4 horas.",
        "plannedMin": 0
      },
      {
        "kind": "B",
        "content": "Chegar com margem; entrar na sala pelo menos 20 min antes.",
        "plannedMin": 0
      },
      {
        "kind": "R",
        "content": "Documento de identificação aceito e comprovante de ensalamento.",
        "plannedMin": 0
      },
      {
        "kind": "L",
        "content": "Aplicar a estratégia treinada nos simulados.",
        "plannedMin": 0
      }
    ]
  }
];
