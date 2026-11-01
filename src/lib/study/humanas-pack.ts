import { renderChain, renderCompare, renderCycle, renderMap, renderTimeline, validateDiagram } from "./diagrams.ts";
import type { BlockKind, Concept, ImageCredit, LessonBeat, Pitfall, QuizItem, StudyPackage, Subtopic } from "./types.ts";

const TOPIC = "Humanas: H03 (Moderna e revoluções) + H04/H05; G04–G08 (clima, água, solo, vegetação e recursos).";

function q(
  id: string,
  difficulty: QuizItem["difficulty"],
  prompt: string,
  choices: [string, string, string, string],
  correctIndex: number,
  hint: string,
  explanation: string,
): QuizItem {
  return { id, difficulty, prompt, choices, correctIndex, hint, explanation, altExplanation: explanation, diagramSvg: "" };
}

function concept(term: string, symbol: string, meaning: string): Concept {
  return { term, symbol, meaning };
}

function must(svg: string, name: string): string {
  const check = validateDiagram(svg);
  if (!check.ok) throw new Error(`${name}: ${check.reasons.join(" | ")}`);
  return svg;
}

const painting: ImageCredit = {
  src: "/study/liberdade-1830.jpg",
  alt: "A Liberdade guiando o povo, tela de Delacroix sobre a revolução de 1830",
  credit: "Eugène Delacroix, 1830. Wikimedia Commons",
  license: "Domínio público",
  sourceUrl: "https://commons.wikimedia.org/wiki/File:Eug%C3%A8ne_Delacroix_-_Le_28_Juillet._La_Libert%C3%A9_guidant_le_peuple.jpg",
  caption: "Não é 1789. A tela mostra a Revolução de Julho de 1830, com a bandeira tricolor já existente.",
  watch: [
    "A data da obra é 1830, não a Queda da Bastilha.",
    "A bandeira tricolor sai de 1789, mas a barricada pintada é outra revolução.",
    "Burguesia de cartola, operário e garoto armado: alegoria do povo, não um retrato da Bastilha.",
  ],
  relatedTerm: "Liberdade guiando o povo",
};

const biomes: ImageCredit = {
  src: "/study/biomas-ibge.jpg",
  alt: "Mapa do IBGE dos biomas brasileiros e do sistema costeiro-marinho, 2024, com legenda em português",
  credit: "IBGE, 2024. Wikimedia Commons",
  license: "CC BY-SA 3.0",
  sourceUrl: "https://commons.wikimedia.org/wiki/File:Biomas_e_Sistema_Costeiro-Marinho_do_Brasil_2024.pdf",
  caption: "Mapa inteiro do IBGE, legenda em português. Observe onde cada bioma encosta no outro, sem cortar o Sul nem a legenda.",
  watch: [
    "A Amazônia é o grande verde do Norte; a Mata Atlântica é a faixa costeira, de cor mais clara.",
    "O Cerrado ocupa o centro e faz a ponte entre os outros biomas.",
    "O hachurado azul é o Sistema Costeiro-Marinho: não conte como sétimo bioma terrestre.",
  ],
  relatedTerm: "Bioma",
};

function beat(heading: string, paragraphs: string[], whyExam: string, dispute?: string): LessonBeat {
  return { heading, paragraphs, whyExam, dispute };
}

function trap(id: string, mistake: string, why: string, item: QuizItem): Pitfall {
  return { id, mistake, why, trap: item };
}

const timeline = must(
  renderTimeline(
    {
      kind: "timeline",
      title: "Séculos: Inglesa no XVII, França em 1789",
      events: [
        { id: "ing", label: "1642 Inglesa" },
        { id: "glo", label: "1688 Gloriosa" },
        { id: "vap", label: "1760 Vapor" },
        { id: "eua", label: "1776 EUA" },
        { id: "fra", label: "1789 França" },
        { id: "bra", label: "1822 Brasil" },
        { id: "ber", label: "1885 Berlim" },
      ],
    },
    "tl",
  ),
  "timeline",
);

const subs: Subtopic[] = [
  {
    id: "h03",
    code: "H03",
    subject: "História",
    title: "Moderna e revoluções",
    minutes: 16,
    beats: [
      beat(
        "Onde termina a Idade Moderna",
        [
          "Nos livros didáticos brasileiros, a Idade Moderna vai até 1789. A Idade Contemporânea começa com a Revolução Francesa, não com a máquina a vapor nem com a independência dos EUA.",
          "A Revolução Inglesa é do século XVII. A Guerra Civil começa em 1642, Carlos I é executado em 1649 e a Revolução Gloriosa acontece em 1688. Nada disso é século XVIII.",
        ],
        "A prova empurra a Inglesa para o mesmo século da Francesa. Separe XVII de XVIII.",
        "O início da Moderna varia (1453 ou 1492). Para a prova, o marco que importa é o fim: 1789.",
      ),
      beat(
        "Três revoluções, três séculos",
        [
          "O Iluminismo é crítica ao absolutismo no século XVIII: Montesquieu em 1748, a Enciclopédia, Rousseau em 1762. Locke, em 1689, ainda é século XVII e funciona como precursor, não como francês de 1789.",
          "A 1ª Revolução Industrial começa na Inglaterra por volta de 1760, com carvão, vapor e têxtil. A 2ª, cerca de 1870, troca a energia: eletricidade, petróleo e aço, com EUA e Alemanha à frente.",
          "Em 14 de julho de 1789 cai a Bastilha. Esse dia é o símbolo usado para abrir a Contemporânea. A independência dos EUA, em 1776, ainda fica na Moderna porque é anterior a esse marco.",
        ],
        "Cai a ordem cronológica e a troca entre 1ª e 2ª Revolução Industrial.",
        "Alguns livros datam a Inglesa em 1640 (Parlamento Longo) e outros em 1642 (guerra). Os dois anos são século XVII.",
      ),
    ],
    concepts: [
      concept("Idade Moderna", "até 1789", "Na periodização escolar brasileira, acaba em 1789. A Revolução Inglesa e a independência dos EUA ainda cabem nela."),
      concept("Idade Contemporânea", "desde 1789", "Começa na Revolução Francesa. Não começa na Inglesa nem na independência dos EUA."),
      concept("Absolutismo", "séc. XVI–XVIII", "Rei concentra poder, com burocracia, exército e impostos. O Iluminismo escreve contra esse arranjo."),
      concept("Mercantilismo", "metal e colônia", "Doutrina moderna: balança comercial favorável, monopólio e colônia fornecedora. Não é o neocolonialismo do século XIX."),
      concept("Iluminismo", "séc. XVIII", "Razão, crítica ao absolutismo e direitos. Obras-chave na França do século XVIII. Locke é precursor do século XVII."),
      concept("Revolução Inglesa", "séc. XVII", "Guerra Civil de 1642 a 1649 e Revolução Gloriosa em 1688. Resultado: rei limitado pelo Parlamento. Não é a Francesa."),
      concept("Revolução Gloriosa", "1688", "Parlamento depõe Jaime II e traz Guilherme de Orange. O Bill of Rights, de 1689, firma a monarquia parlamentar."),
      concept("Independência dos EUA", "1776", "Declaração em 1776, ainda na Idade Moderna. Guerra termina em 1783. Influencia a França, mas não abre a Contemporânea."),
      concept("Revolução Francesa", "1789", "Queda da Bastilha em 14 de julho de 1789. Marco escolar da Idade Contemporânea. República em 1792; Terror em 1793; Napoleão no 18 de Brumário de 1799."),
      concept("Queda da Bastilha", "14/07/1789", "Tomada da prisão real em Paris. Símbolo do início, não o único fato da revolução."),
      concept("1ª Revolução Industrial", "c. 1760", "Inglaterra, carvão, vapor de Watt (1769) e fábrica têxtil. Século XVIII, não eletricidade."),
      concept("2ª Revolução Industrial", "c. 1870", "Aço, eletricidade, petróleo e química. EUA e Alemanha passam à frente. Não confunda com a 1ª."),
      concept("Liberdade guiando o povo", "1830", "Tela de Delacroix sobre a Revolução de Julho de 1830. Não retrata a Queda da Bastilha."),
    ],
    diagramSvg: timeline,
    mapSvg: must(
      renderMap(
        "Cadeia só de História",
        [
          { id: "abs", label: "Absolutismo" },
          { id: "ilu", label: "Iluminismo" },
          { id: "fra", label: "Rev. Francesa" },
          { id: "cont", label: "Contemporânea" },
        ],
        [
          { from: "abs", to: "ilu", label: "criticado por" },
          { from: "ilu", to: "fra", label: "influenciou" },
          { from: "fra", to: "cont", label: "marco de 1789" },
        ],
        "h03m",
      ),
      "map h03",
    ),
    images: [painting],
    pitfalls: [
      trap(
        "seculo",
        "Juntar a Revolução Inglesa com a Francesa no século XVIII.",
        "A Inglesa é XVII (1642 e 1688). A Francesa é 1789 e abre a Contemporânea.",
        q("h03-trap-sec", "medio", "Qual acontecimento é do século XVII?", ["Revolução Francesa", "1ª Revolução Industrial", "Revolução Gloriosa", "18 de Brumário"], 2, "Pense em 1688, não em 1789.", "A Gloriosa é 1688, século XVII. Francesa e Brumário são depois de 1789. A 1ª Industrial é século XVIII."),
      ),
      trap(
        "ind",
        "Trocar 1ª e 2ª Revolução Industrial.",
        "1ª: carvão, vapor, Inglaterra, século XVIII. 2ª: eletricidade e petróleo, por volta de 1870, EUA e Alemanha.",
        q("h03-trap-ind", "dificil", "Eletricidade e petróleo caracterizam qual fase?", ["1ª Revolução Industrial", "Revolução Inglesa", "2ª Revolução Industrial", "Mercantilismo do século XVI"], 2, "A 1ª usa carvão e vapor, não a rede elétrica.", "Eletricidade e petróleo são a 2ª Revolução Industrial, cerca de 1870."),
      ),
    ],
    diagnostic: [
      q("h03-d1", "facil", "Em que século ocorre a Revolução Inglesa?", ["XV", "XVII", "XVIII", "XIX"], 1, "1642 e 1688 começam com 16.", "Século XVII. 1642 é a Guerra Civil e 1688 é a Gloriosa."),
      q("h03-d2", "facil", "Para os livros didáticos brasileiros, o que abre a Idade Contemporânea?", ["Revolução Inglesa", "Independência dos EUA", "Revolução Francesa em 1789", "2ª Revolução Industrial"], 2, "O marco escolar é 1789, não 1688.", "A Contemporânea começa em 1789, com a Revolução Francesa."),
      q("h03-d3", "facil", "Onde começa a 1ª Revolução Industrial?", ["Portugal", "Inglaterra", "Brasil", "Japão"], 1, "Pense em carvão e fábrica têxtil no século XVIII.", "Começa na Inglaterra, por volta de 1760."),
    ],
    practice: [
      q("h03-p1", "facil", "Locke publica os tratados em 1689. Como a prova deve tratá-lo?", ["Francês da Bastilha", "Precursor do século XVII", "Líder da 2ª Industrial", "Autor do Terror"], 1, "1689 ainda é século XVII.", "Locke é precursor iluminista do século XVII, não um deputado de 1789."),
      q("h03-p2", "medio", "Qual ordem está certa?", ["Francesa, Inglesa, Industrial", "Inglesa, independência dos EUA, Francesa", "Berlim, Bastilha, Gloriosa", "2ª Industrial, vapor de Watt, Gloriosa"], 1, "A Inglesa é a mais antiga das três.", "Inglesa no XVII, EUA em 1776, Francesa em 1789."),
      q("h03-p3", "dificil", "A tela A Liberdade guiando o povo serve como imagem de qual fato?", ["Queda da Bastilha em 1789", "Revolução de Julho de 1830", "Revolução Gloriosa", "Independência do Brasil"], 1, "Delacroix pinta em 1830.", "A tela é 1830. Usá-la como Bastilha é a pegadinha."),
    ],
    mastery: q("h03-m", "medio", "Qual frase está de acordo com a periodização escolar?", ["A Inglesa, no século XVIII, abre a Contemporânea.", "A Francesa de 1789 abre a Contemporânea; a Inglesa fica no XVII.", "A 2ª Industrial é o vapor de Watt em 1769.", "1776 já é Idade Contemporânea."], 1, "Separe o século da Inglesa do marco de 1789.", "Moderna até 1789. Inglesa no XVII. Contemporânea a partir da Francesa."),
  },
  {
    id: "h04",
    code: "H04/H05",
    subject: "História",
    title: "Independência e neocolonialismo",
    minutes: 12,
    beats: [
      beat(
        "Independência do Brasil",
        [
          "Em 1808 a corte portuguesa chega ao Rio e decreta a abertura dos portos. Em 1820, a Revolução do Porto quer recolonizar o Brasil. Dom Pedro fica no Dia do Fico, em 9 de janeiro de 1822.",
          "A independência política é proclamada em 7 de setembro de 1822. Continua a monarquia, a escravidão e o território unido. A escravidão só acaba em 1888, com a Lei Áurea. Não foi uma revolução social como o momento radical da França.",
        ],
        "A prova diz que 1822 aboliu a escravidão ou que foi uma revolta popular jacobina. Os dois estão errados.",
      ),
      beat(
        "Neocolonialismo",
        [
          "O neocolonialismo, ou imperialismo do fim do século XIX, não é o colonialismo mercantil da América. A indústria precisa de matéria-prima, mercado e prestígio nacional.",
          "A Conferência de Berlim, de 1884 a 1885, combina a ocupação efetiva da África e a livre navegação do Congo e do Níger. Portugal segura Angola e Moçambique, mas o mapa cor-de-rosa fracassa no ultimato britânico de 1890.",
        ],
        "Cai misturar pacto colonial do século XVI com a partilha da África.",
        "Chamar o século XIX de neocolonialismo ou de imperialismo depende do livro. Os dois nomes apontam a mesma expansão industrial sobre África e Ásia.",
      ),
    ],
    concepts: [
      concept("Vinda da família real", "1808", "A corte sai de Lisboa com a guerra napoleônica e instala o Estado no Rio de Janeiro."),
      concept("Abertura dos portos", "1808", "Decreto de 1808 acaba com o exclusivo colonial português. É consequência da vinda da corte, não da independência."),
      concept("Dia do Fico", "09/01/1822", "Dom Pedro decide ficar no Brasil contra a ordem das Cortes do Porto."),
      concept("Independência do Brasil", "1822", "Ruptura política em 7 de setembro de 1822. Mantém monarquia e escravidão. A abolição é só em 1888."),
      concept("Neocolonialismo", "séc. XIX", "Domínio europeu sobre África e Ásia no auge da indústria, diferente do colonialismo mercantil da América."),
      concept("Imperialismo", "após 1870", "Expansão armada e econômica das potências industriais. No vestibular, quase sinônimo de neocolonialismo do século XIX."),
      concept("Conferência de Berlim", "1884-1885", "Potências combinam regras para ocupar a África, inclusive a ocupação efetiva. Não é a independência do Brasil."),
      concept("Ocupação efetiva", "Berlim", "Para ter a colônia, era preciso administrar e controlar o território, não só anunciar o direito."),
    ],
    diagramSvg: must(
      renderCompare(
        {
          kind: "compare",
          title: "Partilha: colonialismo não é neocolonialismo",
          leftTitle: "Colonialismo moderno",
          rightTitle: "Neocolonialismo",
          rows: [
            { left: "América, séc. XVI a XVIII", right: "África e Ásia, séc. XIX" },
            { left: "Pacto e metalismo", right: "Ocupação efetiva" },
            { left: "Mercantilismo", right: "Indústria e mercado" },
          ],
        },
        "h04c",
      ),
      "compare h04",
    ),
    mapSvg: must(
      renderMap(
        "Do Rio à ruptura com o Porto",
        [
          { id: "corte", label: "Corte em 1808" },
          { id: "porto", label: "Cortes em 1820" },
          { id: "ind", label: "Independência" },
        ],
        [
          { from: "corte", to: "porto", label: "abriu portos" },
          { from: "porto", to: "ind", label: "ruptura" },
        ],
        "h04m",
      ),
      "map h04",
    ),
    images: [],
    pitfalls: [
      trap(
        "escravidao",
        "Achar que a independência do Brasil aboliu a escravidão.",
        "1822 separa Portugal. A Lei Áurea é 1888.",
        q("h04-trap", "medio", "O que a independência de 1822 não fez?", ["Romper com as Cortes do Porto", "Manter Dom Pedro como imperador", "Abolir a escravidão", "Ocorrer no século XIX"], 2, "Pense na data da Lei Áurea.", "A escravidão continua até 1888. 1822 é ruptura política."),
      ),
    ],
    diagnostic: [
      q("h04-d1", "facil", "Em que ano a corte portuguesa chega ao Brasil?", ["1789", "1808", "1822", "1888"], 1, "É antes do grito de setembro.", "1808, com a abertura dos portos no mesmo ano."),
      q("h04-d2", "facil", "A independência política do Brasil é proclamada em:", ["1808", "1822", "1888", "1885"], 1, "7 de setembro.", "7 de setembro de 1822."),
      q("h04-d3", "facil", "A Conferência de Berlim trata sobretudo de:", ["Abolir a escravidão no Brasil", "Regras para ocupar a África", "A Queda da Bastilha", "O Dia do Fico"], 1, "Fim do século XIX, não 1822.", "Berlim, 1884-1885, organiza a partilha da África."),
    ],
    practice: [
      q("h04-p1", "facil", "A abertura dos portos está ligada a qual fato?", ["Lei Áurea", "Vinda da corte em 1808", "Conferência de Berlim", "Revolução Gloriosa"], 1, "O mesmo ano da chegada da família real.", "1808: a corte chega e abre os portos."),
      q("h04-p2", "medio", "O neocolonialismo se distingue do colonialismo moderno porque:", ["Acontece no século XVI na América", "Usa a indústria e a ocupação efetiva da África e da Ásia", "É o mesmo pacto colonial", "Termina em 1789"], 1, "Olhe o século e o continente.", "É expansão industrial do século XIX, com ocupação efetiva, não o pacto da América."),
      q("h04-p3", "dificil", "Qual sequência do processo brasileiro está correta?", ["1888, 1822, 1808", "1808, Dia do Fico, 7 de setembro de 1822", "Berlim, Fico, Bastilha", "1822, abertura dos portos, 1808"], 1, "A corte chega antes do Fico.", "1808, depois o Fico em janeiro de 1822 e a proclamação em setembro."),
    ],
    mastery: q("h04-m", "medio", "Qual afirmação está certa?", ["1822 acaba com a escravidão.", "Berlim, em 1884-1885, regula a ocupação da África.", "A abertura dos portos é de 1888.", "O neocolonialismo é o pacto colonial do século XVI."], 1, "Separe Brasil de África e o século de cada um.", "Berlim regula a partilha. 1822 não abole a escravidão. Neocolonialismo não é o pacto do XVI."),
  },
  {
    id: "g04",
    code: "G04",
    subject: "Geografia",
    title: "Clima",
    minutes: 8,
    beats: [
      beat(
        "Tempo não é clima",
        [
          "Tempo atmosférico é o estado da atmosfera agora: chuva desta tarde, temperatura de hoje. Clima é o padrão desse tempo ao longo de cerca de trinta anos.",
          "Latitude, altitude, maritimidade e continentalidade mudam o clima. O mar segura a temperatura. O interior esquenta e esfria mais.",
        ],
        "A questão chama de clima a frente fria de um dia só.",
      ),
      beat(
        "Tipos que caem no Brasil",
        [
          "Equatorial: Amazônia, quente e chuvoso o ano inteiro, amplitude pequena. Tropical: verão chuvoso e inverno seco no Brasil central. Semiárido: sertão, chuvas irregulares e forte evaporação, associado à caatinga.",
          "Subtropical: Sul, estações mais marcadas e geada. Tropical de altitude: serras do Sudeste, verão mais brando por causa da altitude, não porque seja equatorial.",
        ],
        "A prova troca equatorial com tropical e semiárido com subtropical.",
      ),
    ],
    concepts: [
      concept("Tempo atmosférico", "agora", "Estado momentâneo da atmosfera. Uma tarde de chuva é tempo, não clima."),
      concept("Clima", "~30 anos", "Padrão do tempo em décadas. É o que define equatorial, tropical ou semiárido."),
      concept("Clima equatorial", "Amazônia", "Quente, úmido o ano todo, baixa amplitude térmica. Não é o semiárido."),
      concept("Clima tropical", "verão úmido", "Quente, com estação seca e estação chuvosa. Domina o Brasil central. Diferente do equatorial, que chove o ano inteiro."),
      concept("Clima tropical de altitude", "serras", "Tropical amenizado pela altitude no Sudeste. O verão é menos quente que no litoral baixo."),
      concept("Clima semiárido", "sertão", "Chuva escassa e irregular, alta evaporação. Sustenta a caatinga, não a floresta equatorial."),
      concept("Clima subtropical", "Sul", "Quatro estações mais nítidas, inverno com geada. Não é o clima da Amazônia."),
      concept("Maritimidade", "litoral", "O oceano diminui a amplitude térmica. O litoral varia menos entre dia e noite do que o interior."),
      concept("Continentalidade", "interior", "Longe do mar, a amplitude térmica aumenta. O continente esquenta e esfria mais rápido."),
    ],
    diagramSvg: must(
      renderChain(
        {
          kind: "chain",
          title: "O que condiciona o bioma",
          nodes: [
            { id: "lat", label: "Latitude" },
            { id: "cli", label: "Tipo de clima" },
            { id: "bio", label: "Bioma" },
          ],
          edges: [
            { from: "lat", to: "cli", label: "influencia" },
            { from: "cli", to: "bio", label: "condiciona" },
          ],
        },
        "g04c",
      ),
      "chain g04",
    ),
    mapSvg: must(
      renderMap(
        "Clima, sem misturar com História",
        [
          { id: "tmp", label: "Tempo atmosférico" },
          { id: "cli", label: "Clima" },
          { id: "bio", label: "Bioma" },
        ],
        [
          { from: "tmp", to: "cli", label: "padrão de anos" },
          { from: "cli", to: "bio", label: "condiciona" },
        ],
        "g04m",
      ),
      "map g04",
    ),
    images: [],
    pitfalls: [
      trap(
        "tempochuva",
        "Chamar de clima a chuva de um dia.",
        "Isso é tempo atmosférico. Clima é a série de muitos anos.",
        q("g04-trap", "facil", "A chuva forte desta tarde em Maringá é:", ["Clima subtropical", "Tempo atmosférico", "Clima equatorial", "Laterização"], 1, "Olhe a duração: uma tarde.", "Um evento de horas é tempo atmosférico, não o clima."),
      ),
    ],
    diagnostic: [
      q("g04-d1", "facil", "Clima e tempo atmosférico:", ["São a mesma coisa", "Tempo é o agora; clima é o padrão de anos", "Clima dura uma hora", "Tempo só existe no sertão"], 1, "Um é momentâneo, o outro é série longa.", "Tempo é agora. Clima é o padrão de cerca de trinta anos."),
      q("g04-d2", "facil", "O sertão nordestino tem, de modo geral, clima:", ["Equatorial", "Semiárido", "Subtropical", "Polar"], 1, "Chuva irregular e caatinga.", "Semiárido: pouca chuva e evaporação alta."),
      q("g04-d3", "facil", "O clima da Amazônia, quente e úmido o ano todo, é:", ["Equatorial", "Semiárido", "Subtropical", "Mediterrâneo"], 1, "Não é o do sertão nem o do Sul.", "Equatorial. Chove ao longo do ano e a amplitude é baixa."),
    ],
    practice: [
      q("g04-p1", "facil", "Maritimidade tende a:", ["Aumentar a geada no sertão", "Diminuir a amplitude térmica no litoral", "Criar o pré-sal", "Ser um bioma"], 1, "Pense no efeito do oceano.", "O mar ameniza a diferença de temperatura."),
      q("g04-p2", "medio", "Qual par está certo?", ["Subtropical — Amazônia", "Equatorial — chuva o ano todo", "Semiárido — geada frequente no Sul", "Tropical de altitude — sertão"], 1, "Amazônia não é subtropical.", "Equatorial: calor e chuva bem distribuídos no ano."),
      q("g04-p3", "dificil", "O tropical típico do Brasil central se diferencia do equatorial porque:", ["Não existe estação", "Tem estação seca e estação chuvosa", "É polar", "Só ocorre no litoral do Sul"], 1, "Equatorial quase não tem seca.", "No tropical, o inverno é mais seco e o verão é chuvoso."),
    ],
    mastery: q("g04-m", "medio", "Qual afirmação está certa?", ["Frente fria de um dia muda o tipo de clima da cidade.", "Semiárido, equatorial e subtropical são climas diferentes.", "A Amazônia é semiárida.", "Continentalidade deixa o litoral sem amplitude."], 1, "Não troque o bioma da Amazônia com o do sertão.", "São tipos distintos. Uma frente fria é tempo, não um novo clima."),
  },
  {
    id: "g05",
    code: "G05",
    subject: "Geografia",
    title: "Água",
    minutes: 7,
    beats: [
      beat(
        "O ciclo",
        [
          "No ciclo hidrológico, a água evapora e as plantas transpiram. O vapor condensa, a precipitação cai, parte infiltra e parte escoa de volta aos rios e ao oceano.",
          "Aquífero é água subterrânea, não um rio. O Guarani é um aquífero. O São Francisco é um rio, importante no semiárido, e não deve ser chamado de aquífero.",
        ],
        "A prova troca rio, aquífero e chuva de um dia.",
      ),
      beat(
        "Onde está a água no Brasil",
        [
          "O Brasil tem muita água doce superficial, mas ela é desigual: a bacia amazônica concentra a maior parte. O Sul e o Sudeste, mais povoados, não têm a mesma folga.",
          "Bacia hidrográfica é a área drenada por um rio principal. Amazônica, Tocantins-Araguaia, do Paraná e do São Francisco são as que mais caem.",
        ],
        "Cai dizer que a água brasileira está bem distribuída porque o total é alto.",
        "O percentual exato da água mundial muda conforme a fonte. O que a prova cobra é a desigualdade, não o decimal.",
      ),
    ],
    concepts: [
      concept("Ciclo hidrológico", "volta da água", "Evaporação, condensação, precipitação, infiltração e escoamento. A água não some: muda de lugar e de estado."),
      concept("Evaporação", "líquido a vapor", "A água passa ao ar pelo calor. Junto com a transpiração das plantas, alimenta a umidade."),
      concept("Condensação", "nuvem", "O vapor esfria e volta ao líquido, formando nuvens. Não é a chuva ainda."),
      concept("Precipitação", "chuva", "A água cai da nuvem. Pode ser chuva, neve ou granizo. Um dia de chuva é precipitação, não o ciclo inteiro."),
      concept("Infiltração", "solo", "Parte da chuva entra no solo e pode chegar ao aquífero. O que não infiltra escoa na superfície."),
      concept("Bacia hidrográfica", "área drenada", "Território que manda a água para um rio principal. Não é sinônimo de aquífero."),
      concept("Aquífero", "água sob o solo", "Reserva subterrânea. O Guarani é aquífero. Não é o rio São Francisco nem a chuva da tarde."),
    ],
    diagramSvg: must(
      renderCycle(
        {
          kind: "cycle",
          title: "Ciclo hidrológico",
          nodes: [
            { id: "ev", label: "Evaporação" },
            { id: "co", label: "Condensação" },
            { id: "pr", label: "Precipitação" },
            { id: "es", label: "Escoamento" },
          ],
          edges: [
            { from: "ev", to: "co", label: "sobe o vapor" },
            { from: "co", to: "pr", label: "forma nuvem" },
            { from: "pr", to: "es", label: "cai no solo" },
            { from: "es", to: "ev", label: "fecha o ciclo" },
          ],
        },
        "g05y",
      ),
      "cycle g05",
    ),
    mapSvg: must(
      renderMap(
        "Água: estados, não História",
        [
          { id: "ev", label: "Evaporação" },
          { id: "pr", label: "Precipitação" },
          { id: "aq", label: "Aquífero" },
        ],
        [
          { from: "ev", to: "pr", label: "depois da nuvem" },
          { from: "pr", to: "aq", label: "infiltra" },
        ],
        "g05m",
      ),
      "map g05",
    ),
    images: [],
    pitfalls: [
      trap(
        "aquifero",
        "Chamar o rio São Francisco de aquífero.",
        "Aquífero é subterrâneo. São Francisco é rio de superfície.",
        q("g05-trap", "medio", "O Aquífero Guarani é:", ["O rio São Francisco", "Água subterrânea", "Uma frente fria", "Um bioma do Sul"], 1, "O nome diz água sob a terra.", "Aquífero é reserva subterrânea. O São Francisco é um rio."),
      ),
    ],
    diagnostic: [
      q("g05-d1", "facil", "Evaporação, condensação e precipitação fazem parte do:", ["Pacto colonial", "Ciclo hidrológico", "Neocolonialismo", "Iluminismo"], 1, "É o caminho da água, não um fato de 1789.", "São etapas do ciclo hidrológico."),
      q("g05-d2", "facil", "A maior parte da água doce superficial do Brasil está:", ["No sertão semiárido", "Na bacia amazônica", "Só no litoral do Sul", "No pré-sal"], 1, "O Norte concentra a vazão.", "A bacia amazônica reúne a maior fatia. O total alto não significa distribuição igual."),
      q("g05-d3", "facil", "Aquífero é:", ["Um rio de planície", "Água subterrânea", "Sinônimo de clima", "A chuva de uma tarde"], 1, "Está abaixo do solo.", "É reserva subterrânea, como o Guarani."),
    ],
    practice: [
      q("g05-p1", "facil", "A água que entra no solo após a chuva está em:", ["Condensação", "Infiltração", "Absolutismo", "Laterização, sempre"], 1, "Ela desce, não forma a nuvem.", "Infiltração é a entrada da água no solo."),
      q("g05-p2", "medio", "Por que 'o Brasil tem muita água' não encerra o assunto?", ["Porque não chove em lugar nenhum", "Porque a água é muito desigual entre as regiões", "Porque aquífero é um rei", "Porque o ciclo parou em 1789"], 1, "Olhe Amazônia contra o semiárido.", "O volume é alto e mal distribuído. Amazônia concentra; outras regiões sofrem escassez."),
      q("g05-p3", "dificil", "Qual sequência do ciclo está correta?", ["Precipitação, condensação, evaporação, sem volta", "Evaporação, condensação, precipitação, escoamento", "Escoamento, Bastilha, condensação", "Aquífero, Gloriosa, chuva"], 1, "O vapor sobe antes de chover.", "A água evapora, condensa, precipita e escoa ou infiltra."),
    ],
    mastery: q("g05-m", "medio", "Qual frase está certa?", ["O Guarani é o rio principal do semiárido.", "Bacia é área drenada por um rio; aquífero é água subterrânea.", "Uma chuva prova que o clima mudou.", "O ciclo hidrológico acaba na condensação."], 1, "Não troque rio com água do subsolo.", "Bacia é superfície de drenagem. Aquífero é subterrâneo. O ciclo continua depois da nuvem."),
  },
  {
    id: "g06",
    code: "G06",
    subject: "Geografia",
    title: "Solo",
    minutes: 6,
    beats: [
      beat(
        "Como o solo aparece",
        [
          "Solo é a camada solta da superfície, feita de rocha alterada, matéria orgânica, água e ar. O intemperismo quebra a rocha. Os horizontes do solo são as faixas O, A, B e C, da superfície para baixo.",
          "Clima quente e úmido acelera essa transformação. Por isso a Amazônia e outras áreas tropicais têm solos profundos, o que não significa solo fértil.",
        ],
        "A prova trata solo profundo como sinônimo de terra boa para plantar.",
      ),
      beat(
        "Laterização não é clima",
        [
          "Lixiviação é a lavagem dos nutrientes solúveis pela água que infiltra. Laterização é o que acontece em seguida no clima quente e úmido: a sílica sai e ficam óxidos de ferro e alumínio, deixando o solo vermelho ou amarelo.",
          "O latossolo é o solo profundo e bem drenado típico desse processo no Brasil. Se a floresta sai, a matéria orgânica some e a fertilidade, que estava na vegetação, cai. Laterização não é um tipo de clima nem um bioma.",
        ],
        "A palavra aparece na pegadinha sem aula. Aqui ela fica definida antes do exercício.",
      ),
    ],
    concepts: [
      concept("Solo", "camada solta", "Mistura de minerais, matéria orgânica, água e ar sobre a rocha. Não é sinônimo de bioma nem de clima."),
      concept("Intemperismo", "quebra da rocha", "Desgaste físico e químico da rocha que abastece o solo. No clima úmido, o químico é intenso."),
      concept("Horizonte do solo", "faixas O-A-B-C", "Camadas do perfil. O e A ficam no topo, com mais matéria orgânica. C encosta na rocha alterada."),
      concept("Lixiviação", "lavagem", "A água leva nutrientes solúveis para baixo. Não é o mesmo que laterização: é o passo da lavagem."),
      concept("Laterização", "ferro e alumínio", "Em clima quente e úmido, a lixiviação tira a sílica e concentra ferro e alumínio. Não é um tipo de clima."),
      concept("Latossolo", "solo profundo", "Solo muito intemperizado, profundo e drenado, comum no Brasil tropical. A cor vermelha não garante fertilidade."),
    ],
    diagramSvg: must(
      renderChain(
        {
          kind: "chain",
          title: "Do clima úmido ao solo vermelho",
          nodes: [
            { id: "cli", label: "Clima úmido" },
            { id: "lix", label: "Lixiviação" },
            { id: "lat", label: "Laterização" },
          ],
          edges: [
            { from: "cli", to: "lix", label: "lava ions" },
            { from: "lix", to: "lat", label: "sobra Fe e Al" },
          ],
        },
        "g06c",
      ),
      "chain g06",
    ),
    mapSvg: must(
      renderMap(
        "Solo: cada seta tem causa",
        [
          { id: "chu", label: "Chuva forte" },
          { id: "lix", label: "Lixiviação" },
          { id: "lat", label: "Latossolo" },
        ],
        [
          { from: "chu", to: "lix", label: "infiltra" },
          { from: "lix", to: "lat", label: "aprofunda" },
        ],
        "g06m",
      ),
      "map g06",
    ),
    images: [],
    pitfalls: [
      trap(
        "later",
        "Tratar laterização como se fosse um clima ou um bioma.",
        "É processo de solo em clima quente e úmido, depois da lixiviação.",
        q("g06-trap", "medio", "Laterização é:", ["O clima da Amazônia", "O bioma do Cerrado", "Concentração de ferro e alumínio no solo", "Sinônimo de aquífero"], 2, "Ela acontece no solo, não na classificação do clima.", "É processo pedológico: sobram ferro e alumínio. O clima que favorece é o quente e úmido, mas o nome não é de um clima."),
      ),
    ],
    diagnostic: [
      q("g06-d1", "facil", "Laterização é favorecida por clima:", ["Polar seco", "Quente e úmido", "Subtropical com neve o ano todo", "Sem atmosfera"], 1, "Pense em chuva e calor.", "Calor e chuva lixiviam a sílica e concentram ferro e alumínio."),
      q("g06-d2", "facil", "Lixiviação é:", ["A formação da Bastilha", "A lavagem de nutrientes pela água", "Um tipo de bioma", "O mesmo que pré-sal"], 1, "A água desce pelo perfil.", "É o arraste dos solúveis para as camadas de baixo."),
      q("g06-d3", "facil", "Latossolo profundo significa, por si só, terra fértil?", ["Sim, sempre", "Não: a fertilidade tropical depende muito da matéria orgânica", "Sim, por causa do petróleo", "Só no século XVII"], 1, "Cor vermelha não é adubo.", "O latossolo pode ser pobre. Na floresta, os nutrientes circulam na vegetação."),
    ],
    practice: [
      q("g06-p1", "facil", "A diferença certa é:", ["Lixiviação é um bioma", "Lixiviação lava; laterização concentra ferro e alumínio", "Laterização é o tempo de hoje", "Horizonte é um rei absoluto"], 1, "Uma é a lavagem, a outra é o resíduo.", "A água leva os solúveis. Ferro e alumínio ficam e caracterizam a laterização."),
      q("g06-p2", "medio", "Retirar a floresta de um latossolo costuma:", ["Aumentar o ouro do horizonte C", "Reduzir a matéria orgânica que sustentava a fertilidade", "Transformar o clima em subtropical no mesmo dia", "Criar um aquífero"], 1, "O nutriente estava mais na mata do que no mineral.", "Sem a serrapilheira, o solo profundo e lavado perde a reserva orgânica."),
      q("g06-p3", "dificil", "Qual cadeia está correta?", ["Clima seco e frio → laterização máxima", "Chuva e calor → lixiviação → laterização", "Aquífero → Gloriosa → solo", "Bioma → Bastilha → horizonte"], 1, "Siga a água no perfil.", "A chuva quente lava o solo e deixa ferro e alumínio."),
    ],
    mastery: q("g06-m", "medio", "Qual afirmação está certa?", ["Laterização é um tipo de clima.", "Lixiviação e laterização são processos de solo, não climas.", "Latossolo vermelho é sempre fértil.", "Horizonte do solo é sinônimo de bacia."], 1, "Os dois nomes cabem na pedologia.", "São processos do solo. Clima quente e úmido favorece, mas não se chama laterização."),
  },
  {
    id: "g07",
    code: "G07",
    subject: "Geografia",
    title: "Vegetação",
    minutes: 7,
    beats: [
      beat(
        "Bioma não é só a planta",
        [
          "Bioma é o conjunto de clima, solo, relevo e seres vivos de uma região, não uma árvore isolada. O clima condiciona o bioma, e o bioma devolve matéria orgânica ao solo. A seta não é a única causa: relevo e uso humano também entram.",
          "O IBGE trabalha com seis biomas terrestres: Amazônia, Cerrado, Mata Atlântica, Caatinga, Pantanal e Pampa. O mapa de 2024 ainda desenha o Sistema Costeiro-Marinho, que não é um sétimo bioma de terra.",
        ],
        "A prova troca Cerrado com Amazônia e chama o Pantanal de tipo de clima.",
        "Há quem conte a zona costeira como bioma. No mapa do IBGE de 2024 ela aparece como sistema à parte. Para a prova tradicional, mantenha seis biomas terrestres.",
      ),
      beat(
        "O que observar em cada um",
        [
          "Amazônia: floresta equatorial, dossel fechado, biodiversidade alta. Cerrado: savana do Brasil central, troncos retorcidos, raízes fundas e fogo no ritmo natural. É o berço de várias nascentes.",
          "Mata Atlântica: floresta úmida do litoral, muito fragmentada. Caatinga: plantas da seca no semiárido, perdem folha na estiagem. Pantanal: planície que alaga, não um clima. Pampa: campo do Sul, no subtropical.",
        ],
        "Cai a localização e o fator dominante: água no Pantanal, seca na Caatinga, altitude não é o nome do bioma.",
      ),
    ],
    concepts: [
      concept("Bioma", "sistema vivo", "Clima, solo, relevo e seres vivos de uma grande região. Não é sinônimo de uma espécie nem de um dia de chuva."),
      concept("Amazônia", "floresta equatorial", "Norte do Brasil, clima equatorial, floresta densa. Concentra também a maior bacia hidrográfica."),
      concept("Cerrado", "savana central", "Brasil central, árvores retorcidas, raízes profundas e nascentes. Não é floresta equatorial."),
      concept("Mata Atlântica", "faixa litorânea", "Floresta úmida ao longo do litoral, hoje muito desmatada e fragmentada."),
      concept("Caatinga", "seca do sertão", "Vegetação do semiárido. Plantas xerófitas, que suportam a estiagem. Não é o Pampa."),
      concept("Pantanal", "planície inundável", "Alaga na cheia e seca em parte no resto do ano. É relevo e pulso de água, não um tipo de clima."),
      concept("Pampa", "campo do Sul", "Campos do Rio Grande do Sul, sob clima subtropical. Não confunda com o Cerrado."),
    ],
    diagramSvg: must(
      renderChain(
        {
          kind: "chain",
          title: "Clima, bioma e solo",
          nodes: [
            { id: "cli", label: "Clima" },
            { id: "bio", label: "Bioma" },
            { id: "sol", label: "Solo" },
          ],
          edges: [
            { from: "cli", to: "bio", label: "condiciona" },
            { from: "bio", to: "sol", label: "devolve matéria" },
          ],
        },
        "g07c",
      ),
      "chain g07",
    ),
    mapSvg: must(
      renderMap(
        "Três biomas que a prova troca",
        [
          { id: "ama", label: "Amazônia" },
          { id: "cer", label: "Cerrado" },
          { id: "caa", label: "Caatinga" },
        ],
        [
          { from: "ama", to: "cer", label: "faz limite" },
          { from: "cer", to: "caa", label: "faz limite" },
        ],
        "g07m",
      ),
      "map g07",
    ),
    images: [biomes],
    pitfalls: [
      trap(
        "pantanal",
        "Classificar o Pantanal como um tipo de clima.",
        "Pantanal é bioma de planície inundável. Clima é outra escala.",
        q("g07-trap", "medio", "O Pantanal é definido principalmente como:", ["Clima polar", "Planície que alaga em ciclos", "Sinônimo de Pampa", "Aquífero Guarani"], 1, "Pense na cheia, não num tipo de Köppen.", "É bioma de planície inundável. Não é clima nem o campo do Sul."),
      ),
    ],
    diagnostic: [
      q("g07-d1", "facil", "Quantos biomas terrestres o IBGE distingue no Brasil, na conta escolar?", ["Dois", "Seis", "Vinte", "Um só, a Amazônia"], 1, "Amazônia, Cerrado, Mata Atlântica, Caatinga, Pantanal e Pampa.", "São seis. O sistema costeiro-marinho do mapa de 2024 não entra como sétimo bioma de terra."),
      q("g07-d2", "facil", "O Cerrado é:", ["Floresta equatorial do Norte", "Savana do Brasil central", "Campo exclusivo do Rio Grande do Sul", "O mesmo que caatinga"], 1, "Centro do país, árvores retorcidas.", "Savana do centro, com raízes fundas. A floresta equatorial é a Amazônia."),
      q("g07-d3", "facil", "A Caatinga está associada sobretudo ao clima:", ["Equatorial", "Semiárido", "Subtropical úmido", "Polar"], 1, "Sertão.", "Semiárido, com plantas adaptadas à estiagem."),
    ],
    practice: [
      q("g07-p1", "facil", "No mapa do IBGE, a faixa úmida do litoral é sobretudo:", ["Pampa", "Mata Atlântica", "Caatinga", "Pantanal"], 1, "Ela acompanha a costa.", "Mata Atlântica acompanha o litoral e está muito fragmentada."),
      q("g07-p2", "medio", "Por que o Cerrado importa para a água?", ["Porque é um deserto sem nascente", "Porque abriga nascentes de várias bacias", "Porque é o pré-sal", "Porque substitui o ciclo hidrológico"], 1, "Ele é chamado de berço das águas.", "Várias nascentes nascem no Cerrado e alimentam bacias diferentes."),
      q("g07-p3", "dificil", "Qual relação está correta?", ["Clima equatorial condiciona a Caatinga", "Clima semiárido condiciona a Caatinga", "Pampa é a floresta do Norte", "Pantanal é um aquífero"], 1, "Ligue o sertão à seca.", "A Caatinga acompanha o semiárido. A Amazônia acompanha o equatorial."),
    ],
    mastery: q("g07-m", "medio", "Qual leitura do mapa está certa?", ["Verde do Norte e faixa costeira são o mesmo bioma.", "Amazônia, Cerrado e Caatinga ocupam posições diferentes e não são sinônimos.", "O Pampa é equatorial.", "O hachurado costeiro é a Revolução Francesa."], 1, "Use a legenda em português do IBGE.", "São biomas distintos. A legenda separa as cores; o hachurado azul é o sistema costeiro-marinho."),
  },
  {
    id: "g08",
    code: "G08",
    subject: "Geografia",
    title: "Recursos",
    minutes: 4,
    beats: [
      beat(
        "Recurso não é reserva",
        [
          "Recurso natural é o que a sociedade consegue usar da natureza. Reserva é a parte já medida e que vale a pena explorar com a técnica e o preço de hoje. Nem todo recurso vira reserva.",
          "Renovável se repõe em escala humana, como água e floresta manejada. Não renovável não se repõe nesse prazo: minério de ferro e petróleo. O ferro do Quadrilátero Ferrífero, em Minas, e o de Carajás, no Pará, são não renováveis. O pré-sal é petróleo sob uma camada de sal, no litoral do Sudeste, explorado a partir dos anos 2000.",
        ],
        "A prova chama minério de renovável ou trata o pré-sal como se fosse água doce.",
      ),
    ],
    concepts: [
      concept("Recurso natural", "uso social", "Elemento da natureza que uma sociedade sabe e quer usar. Depende de técnica, não só de existir."),
      concept("Reserva", "parte medida", "Parcela do recurso já conhecida e economicamente explorável. É menor que o recurso total."),
      concept("Recurso renovável", "se repõe", "Repõe-se em escala humana se o uso não passar da reposição. Água e floresta entram aqui, com esse limite."),
      concept("Recurso não renovável", "não se repõe", "Formação geológica lenta demais para a escala humana. Minério e petróleo estão nesse grupo."),
      concept("Minério de ferro", "MG e PA", "Quadrilátero Ferrífero, em Minas Gerais, e Serra dos Carajás, no Pará. Não é renovável."),
      concept("Pré-sal", "petróleo", "Petróleo sob a camada de sal, em águas profundas do Sudeste, explorado nos anos 2000. Não é aquífero nem bioma."),
    ],
    diagramSvg: must(
      renderCompare(
        {
          kind: "compare",
          title: "Renovável não é minério",
          leftTitle: "Renovável",
          rightTitle: "Não renovável",
          rows: [
            { left: "Água e floresta", right: "Ferro e petróleo" },
            { left: "Repõe em vida humana", right: "Tempo geológico" },
            { left: "Uso tem limite", right: "Pré-sal e Carajás" },
          ],
        },
        "g08c",
      ),
      "compare g08",
    ),
    mapSvg: must(
      renderMap(
        "Recurso vira reserva, depois produto",
        [
          { id: "rec", label: "Recurso" },
          { id: "res", label: "Reserva" },
          { id: "uso", label: "Extração" },
        ],
        [
          { from: "rec", to: "res", label: "parte medida" },
          { from: "res", to: "uso", label: "vira produto" },
        ],
        "g08m",
      ),
      "map g08",
    ),
    images: [],
    pitfalls: [
      trap(
        "ferro",
        "Classificar minério de ferro como recurso renovável.",
        "O ferro não se repõe em escala humana. Renovável, aqui, é água ou floresta manejada.",
        q("g08-trap", "facil", "O minério de ferro de Carajás é:", ["Renovável", "Não renovável", "Um bioma", "Um clima"], 1, "Ele é rocha, não uma safra.", "Minério é não renovável. Carajás fica no Pará."),
      ),
    ],
    diagnostic: [
      q("g08-d1", "facil", "Reserva mineral é:", ["Qualquer pedra do planeta", "A parte medida e explorável do recurso", "Sinônimo de bioma", "A chuva de hoje"], 1, "Ela é uma fração conhecida do recurso.", "Reserva é o que já foi medido e compensa explorar."),
      q("g08-d2", "facil", "O pré-sal é:", ["Um aquífero do sertão", "Petróleo sob a camada de sal", "Um bioma do Sul", "A Revolução Inglesa"], 1, "Está no mar do Sudeste, não no solo do Cerrado.", "É petróleo em águas profundas, abaixo do sal."),
      q("g08-d3", "facil", "Qual item é não renovável?", ["Água do ciclo, se bem usada", "Floresta manejada", "Minério de ferro", "Vento"], 2, "Pense no tempo geológico.", "O ferro não se refaz na escala da vida humana."),
    ],
    practice: [
      q("g08-p1", "facil", "O Quadrilátero Ferrífero fica em:", ["Portugal", "Minas Gerais", "Paris", "Berlim"], 1, "É um nome de Minas.", "Minas Gerais. Carajás, o outro polo, fica no Pará."),
      q("g08-p2", "medio", "Por que água pode ser renovável e ainda assim faltar?", ["Porque o ciclo não existe", "Porque o uso pode passar da reposição e a distribuição é desigual", "Porque água é minério de ferro", "Porque Berlim secou os rios"], 1, "Renovável não significa infinito.", "Se o consumo e a poluição vencem a reposição, falta água mesmo com o ciclo funcionando."),
      q("g08-p3", "dificil", "Qual par está certo?", ["Pré-sal — bioma do Pantanal", "Carajás — ferro no Pará", "Latossolo — petróleo", "Pampa — minério de carvão da Bastilha"], 1, "Separe rocha, óleo e bioma.", "Carajás é ferro no Pará. Pré-sal é petróleo, não bioma."),
    ],
    mastery: q("g08-m", "medio", "Qual frase está certa?", ["Todo recurso já é reserva.", "Ferro e pré-sal são não renováveis; água entra no ciclo hidrológico.", "O pré-sal é um aquífero.", "Carajás é um clima equatorial."], 1, "Não promova minério a energia que se repõe.", "Reserva é só a parte medida. Ferro e petróleo não se repõem como a água do ciclo."),
  },
];

function flatQuestions(sub: Subtopic): QuizItem[] {
  return [...sub.diagnostic, ...sub.practice, sub.mastery, ...sub.pitfalls.map((p) => p.trap)];
}

export function buildHumanasPackage(meta: { id: string; date: string; kind: BlockKind; topic?: string }): StudyPackage {
  const concepts = subs.flatMap((sub) => sub.concepts);
  const first = subs[0];
  if (!first) throw new Error("Pacote sem subtópico.");
  const minutes = subs.reduce((sum, sub) => sum + sub.minutes, 0);
  if (minutes !== 60) throw new Error(`Minutos somam ${minutes}, não 60.`);
  return {
    id: meta.id,
    date: meta.date,
    kind: meta.kind,
    topic: meta.topic || TOPIC,
    displayTitle: "Humanas · Moderna e revoluções",
    codes: ["H03", "H04/H05", "G04–G08"],
    schemaVersion: 2,
    essence: [
      "Na periodização escolar, a Idade Moderna acaba em 1789. A Revolução Inglesa é do século XVII; a Francesa abre a Contemporânea.",
      "A independência do Brasil, em 1822, não aboliu a escravidão. O neocolonialismo do século XIX, com Berlim em 1884-1885, não é o pacto colonial da América.",
      "Clima não é o tempo de um dia. Ele condiciona o bioma, e o clima quente e úmido favorece a laterização do solo — que não é um tipo de clima.",
    ],
    development: subs
      .flatMap((sub) => sub.beats.flatMap((b) => b.paragraphs))
      .slice(0, 8)
      .join("\n\n"),
    concepts,
    formulas: [],
    pitfalls: subs.flatMap((sub) => sub.pitfalls.map((p) => p.mistake)),
    sources: [
      { title: "Periodização escolar da Contemporânea", url: "https://brasilescola.uol.com.br/historiag/idade-contemporanea.htm", note: "Marco de 1789 usado nos manuais." },
      { title: "Revolução Inglesa", url: "https://brasilescola.uol.com.br/historiag/revolucao-inglesa.htm", note: "Século XVII: guerra civil e Gloriosa." },
      { title: "Revolução Francesa", url: "https://brasilescola.uol.com.br/historiag/revolucao-francesa.htm", note: "1789 e as fases cobradas no vestibular." },
      { title: "Revolução Industrial", url: "https://brasilescola.uol.com.br/historiag/revolucao-industrial.htm", note: "1ª na Inglaterra; 2ª com eletricidade e petróleo." },
      { title: "Independência do Brasil", url: "https://brasilescola.uol.com.br/historiab/independencia-brasil.htm", note: "1808, 1822 e a permanência da escravidão." },
      { title: "Conferência de Berlim", url: "https://brasilescola.uol.com.br/historiag/conferencia-berlim.htm", note: "1884-1885 e ocupação efetiva." },
      { title: "Climas do Brasil", url: "https://brasilescola.uol.com.br/brasil/os-climas-brasil.htm", note: "Equatorial, tropical, semiárido e subtropical." },
      { title: "Biomas — IBGE", url: "https://www.ibge.gov.br/geociencias/informacoes-ambientais/vegetacao/15842-biomas.html", note: "Seis biomas e o sistema costeiro-marinho no mapa de 2024." },
      { title: "Ciclo da água", url: "https://brasilescola.uol.com.br/geografia/ciclo-agua.htm", note: "Evaporação, condensação, precipitação e escoamento." },
      { title: "Formação dos solos", url: "https://brasilescola.uol.com.br/geografia/formacao-dos-solos.htm", note: "Intemperismo, perfil e laterização." },
    ],
    images: [painting, biomes],
    diagramSvg: timeline,
    diagnostic: first.diagnostic[0] ?? first.mastery,
    questions: subs.flatMap((sub) => sub.practice).slice(0, 8),
    flashcards: [
      { front: "Século da Revolução Inglesa?", back: "XVII. Gloriosa em 1688. A Francesa é 1789." },
      { front: "Laterização é clima?", back: "Não. É solo: ferro e alumínio depois da lixiviação, em clima quente e úmido." },
      { front: "1822 aboliu a escravidão?", back: "Não. A Lei Áurea é 1888." },
    ],
    generatedAt: Date.now(),
    provider: "aula-didatica",
    webSearch: false,
    subtopics: subs,
  };
}

export const HUMANAS_TOPIC = TOPIC;
export const humanasQuestionCount = subs.reduce((sum, sub) => sum + flatQuestions(sub).length, 0);
