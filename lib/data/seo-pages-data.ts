// ============================================================
// VITFIX — SEO Programmatic Pages Data
// Cities × Services = Landing Pages
// ============================================================

export interface CityData {
  slug: string
  name: string
  distrito: string
  population: number
  lat: number
  lng: number
  freguesias: string[]
  nearby: string[] // slugs of nearby cities
}

export interface ServiceFAQ {
  question: string
  answer: string
}

export interface UrgencyData {
  metaTitle: string
  metaDesc: string
  heroTitle: string
  heroSubtitle: string
  immediateSteps: string[]
  whenToCall: string[]
  avgResponseTime: string
  availableSchedule: string
}

export interface ServiceData {
  slug: string
  name: string
  icon: string
  metaTitle: string
  metaDesc: string
  heroTitle: string
  heroSubtitle: string
  features: string[]
  urgencyText: string
  problemsWeSolve: string[]
  faqs: ServiceFAQ[]
  urgency: UrgencyData
}

export interface BlogArticle {
  slug: string
  title: string
  metaTitle: string
  metaDesc: string
  category: 'eletricidade' | 'canalizacao' | 'pintura' | 'pladur' | 'obras' | 'isolamento' | 'impermeabilizacao' | 'desentupimento' | 'manutencao'
  icon: string
  datePublished: string
  intro: string
  sections: { heading: string; content: string }[]
  ctaText: string
  relatedServices: string[] // service slugs
  searchVolume: string // for internal reference
}

// ============================================================
// CITIES — Marco de Canaveses + surrounding area (20km radius)
// ============================================================

export const CITIES: CityData[] = [
  {
    slug: 'marco-de-canaveses',
    name: 'Marco de Canaveses',
    distrito: 'Porto',
    population: 53450,
    lat: 41.1842,
    lng: -8.1503,
    freguesias: ['Marco', 'Alpendorada', 'Várzea', 'Soalhães', 'Tabuado', 'Vila Boa do Bispo', 'Penha Longa', 'Constance', 'Fornos', 'Paredes de Viadores', 'Sande', 'Manhuncelos', 'Rio de Galinhas', 'Bem Viver', 'Avessadas', 'Banho e Carvalhosa', 'Freixo', 'Toutosa', 'Rosém'],
    nearby: ['penafiel', 'amarante', 'baiao'],
  },
  {
    slug: 'penafiel',
    name: 'Penafiel',
    distrito: 'Porto',
    population: 72265,
    lat: 41.2089,
    lng: -8.2847,
    freguesias: ['Penafiel', 'Paço de Sousa', 'Bustelo', 'Croca', 'Guilhufe', 'Luzim', 'Oldrões', 'Peroselo', 'Recezinhos', 'Rio de Moinhos', 'Sebolido', 'Valpedre', 'Fonte Arcada', 'Eja', 'Galegos', 'Lagares', 'Rans'],
    nearby: ['marco-de-canaveses', 'paredes', 'lousada'],
  },
  {
    slug: 'amarante',
    name: 'Amarante',
    distrito: 'Porto',
    population: 56264,
    lat: 41.2718,
    lng: -8.0831,
    freguesias: ['Amarante', 'Vila Meã', 'Fridão', 'Gatão', 'Gondar', 'Jazente', 'Lomba', 'Louredo', 'Mancelos', 'Padronelo', 'Real', 'Salvador do Monte', 'Travanca', 'Vila Chã do Marão', 'Olo', 'Telões', 'Candemil'],
    nearby: ['marco-de-canaveses', 'felgueiras', 'baiao'],
  },
  {
    slug: 'baiao',
    name: 'Baião',
    distrito: 'Porto',
    population: 20522,
    lat: 41.1625,
    lng: -8.0350,
    freguesias: ['Baião', 'Ancede', 'Campelo', 'Frende', 'Gove', 'Loivos do Monte', 'Mesquinhata', 'Ovil', 'Ribadouro', 'Santa Cruz do Douro', 'Santa Marinha do Zêzere', 'Teixeira', 'Tresouras', 'Valadares', 'Viariz'],
    nearby: ['marco-de-canaveses', 'amarante'],
  },
  {
    slug: 'felgueiras',
    name: 'Felgueiras',
    distrito: 'Porto',
    population: 58065,
    lat: 41.3659,
    lng: -8.1979,
    freguesias: ['Felgueiras', 'Margaride', 'Lixa', 'Barrosas', 'Borba de Godim', 'Idães', 'Jugueiros', 'Moure', 'Pinheiro', 'Regilde', 'Refontoura', 'Revinhade', 'Sendim', 'Torrados', 'Varziela', 'Vila Cova da Lixa', 'Vila Fria', 'Vila Verde'],
    nearby: ['amarante', 'lousada', 'penafiel'],
  },
  {
    slug: 'lousada',
    name: 'Lousada',
    distrito: 'Porto',
    population: 47387,
    lat: 41.2769,
    lng: -8.2838,
    freguesias: ['Lousada', 'Aveleda', 'Boim', 'Caíde de Rei', 'Cernadelo', 'Cristelos', 'Figueiras', 'Lodares', 'Lustosa', 'Macieira', 'Meinedo', 'Nespereira', 'Nogueira', 'Ordem', 'Pias', 'Silvares', 'Torno', 'Vilar do Torno'],
    nearby: ['penafiel', 'felgueiras', 'pacos-de-ferreira'],
  },
  {
    slug: 'pacos-de-ferreira',
    name: 'Paços de Ferreira',
    distrito: 'Porto',
    population: 56340,
    lat: 41.2780,
    lng: -8.3886,
    freguesias: ['Paços de Ferreira', 'Carvalhosa', 'Eiriz', 'Ferreira', 'Figueiró', 'Frazão', 'Lamoso', 'Meixomil', 'Modelos', 'Penamaior', 'Raimonda', 'Sanfins de Ferreira', 'Seroa'],
    nearby: ['lousada', 'penafiel', 'paredes'],
  },
  {
    slug: 'paredes',
    name: 'Paredes',
    distrito: 'Porto',
    population: 86854,
    lat: 41.2052,
    lng: -8.3310,
    freguesias: ['Paredes', 'Baltar', 'Beire', 'Besteiros', 'Bitarães', 'Campo', 'Cete', 'Cristelo', 'Duas Igrejas', 'Gandra', 'Lordelo', 'Louredo', 'Mouriz', 'Parada de Todeia', 'Rebordosa', 'Recarei', 'Sobreira', 'Sobrosa', 'Vandoma', 'Vila Cova de Carros', 'Vilela'],
    nearby: ['penafiel', 'pacos-de-ferreira', 'lousada'],
  },
  {
    slug: 'porto',
    name: 'Porto',
    distrito: 'Porto',
    population: 231800,
    lat: 41.1579,
    lng: -8.6291,
    freguesias: ['Bonfim', 'Campanhã', 'Paranhos', 'Ramalde', 'Aldoar', 'Foz do Douro', 'Nevogilde', 'Massarelos', 'Cedofeita', 'Santo Ildefonso', 'Sé', 'Miragaia', 'São Nicolau', 'Vitória'],
    nearby: ['vila-nova-de-gaia', 'maia', 'matosinhos'],
  },
  {
    slug: 'vila-nova-de-gaia',
    name: 'Vila Nova de Gaia',
    distrito: 'Porto',
    population: 302295,
    lat: 41.1239,
    lng: -8.6118,
    freguesias: ['Arcozelo', 'Avintes', 'Canidelo', 'Crestuma', 'Lever', 'Madalena', 'Olival', 'Pedroso', 'Perozinho', 'Sandim', 'Santa Marinha', 'São Félix da Marinha', 'São Pedro da Afurada', 'Seixezelo', 'Sermonde', 'Serzedo', 'Tarouquela', 'Tijosa', 'Valadares', 'Vilar de Andorinho', 'Vilar do Paraíso'],
    nearby: ['porto', 'espinho', 'gondomar'],
  },
  {
    slug: 'braga',
    name: 'Braga',
    distrito: 'Braga',
    population: 193333,
    lat: 41.5503,
    lng: -8.4200,
    freguesias: ['Braga', 'Adaúfe', 'Aveleda', 'Cabreiros', 'Celeirós', 'Crespos', 'Dume', 'Escudeiros', 'Figueiredo', 'Fraião', 'Gualtar', 'Guimarães de S. Torcato', 'Lamas', 'Lomar', 'Long', 'Maximinos', 'Merelim (S. Paio)', 'Merelim (S. Pedro)', 'Mire de Tibães', 'Morreira', 'Nogueira', 'Nogueiró', 'Palmeira', 'Priscos', 'Real', 'Ruilhe', 'S. Lázaro', 'S. Vítor', 'Sequeira', 'Sobreposta', 'Tadim', 'Tebosa', 'This'],
    nearby: ['guimaraes', 'barcelos', 'famalicao'],
  },
  {
    slug: 'maia',
    name: 'Maia',
    distrito: 'Porto',
    population: 135306,
    lat: 41.2325,
    lng: -8.6205,
    freguesias: ['Águas Santas', 'Avioso (Santa Maria)', 'Avioso (S. Pedro)', 'Barca', 'Castêlo da Maia', 'Folgosa', 'Gueifães', 'Maia', 'Milheiroços', 'Moreira', 'Nogueira', 'Pedrouços', 'S. Pedro Fins', 'Silva Escura', 'Vermoim', 'Vila Nova da Telha'],
    nearby: ['porto', 'matosinhos', 'valongo'],
  },
]

// ============================================================
// SERVICES — Focused on what the user's artisans do
// ============================================================

export const SERVICES: ServiceData[] = [
  {
    slug: 'eletricista',
    name: 'Eletricista',
    icon: '⚡',
    metaTitle: 'Eletricista em {city} — Urgências e Reparações Elétricas | VITFIX',
    metaDesc: 'Precisa de um eletricista em {city}? Intervenção rápida para curto-circuitos, quadros elétricos, avarias elétricas. Orçamento grátis. Serviço 7/7.',
    heroTitle: 'Eletricista em {city}',
    heroSubtitle: 'Intervenção rápida para todas as suas urgências elétricas. Profissionais verificados, orçamento gratuito.',
    features: [
      'Curto-circuitos e avarias elétricas',
      'Instalação e reparação de quadros elétricos',
      'Substituição de tomadas e interruptores',
      'Instalação de iluminação interior e exterior',
      'Diagnóstico de problemas elétricos',
      'Colocação de disjuntores e proteções',
      'Certificação de instalações elétricas',
      'Urgências elétricas — resposta rápida',
    ],
    urgencyText: 'Tem uma urgência elétrica? Não toque na instalação! Ligue-nos para uma intervenção segura e rápida.',
    problemsWeSolve: [
      'O disjuntor dispara constantemente',
      'Tomadas ou interruptores que não funcionam',
      'Luzes que piscam ou falham',
      'Cheiro a queimado na instalação elétrica',
      'Quadro elétrico antigo ou danificado',
      'Curto-circuito em casa',
    ],
    faqs: [
      { question: 'Quanto custa um eletricista em média?', answer: 'O custo de um eletricista varia entre 30€ e 60€ por hora, dependendo do tipo de serviço. Pequenas reparações (trocar tomadas, interruptores) custam entre 40€ e 80€. Serviços mais complexos como substituição de quadro elétrico podem custar entre 200€ e 500€. Na VITFIX, o orçamento é sempre gratuito.' },
      { question: 'O eletricista trabalha ao fim de semana?', answer: 'Sim, os eletricistas VITFIX estão disponíveis 7 dias por semana, incluindo feriados. Para urgências elétricas (curto-circuitos, falhas de eletricidade), temos profissionais de serviço permanente.' },
      { question: 'Quanto tempo demora uma intervenção elétrica?', answer: 'Uma reparação simples (trocar tomada, interruptor) demora 30 a 60 minutos. Diagnósticos de avarias mais complexas podem levar 1 a 2 horas. A substituição completa de um quadro elétrico pode demorar meio dia a um dia completo.' },
      { question: 'Como sei se a minha instalação elétrica precisa de ser atualizada?', answer: 'Se a sua casa tem mais de 20 anos e nunca foi revista, se ainda tem fusíveis em vez de disjuntores, se os disjuntores disparam frequentemente, ou se tem tomadas de modelo antigo sem terra, é recomendável uma atualização.' },
    ],
    urgency: {
      metaTitle: 'Eletricista Urgente em {city} — Disponível 24h | VITFIX',
      metaDesc: 'Precisa de um eletricista urgente em {city}? Curto-circuito, falha elétrica, disjuntor que dispara? Intervenção rápida 7/7. Ligue agora!',
      heroTitle: 'Eletricista Urgente em {city}',
      heroSubtitle: 'Tem uma urgência elétrica? Não toque na instalação! Os nossos eletricistas intervêm rapidamente em {city} e arredores para resolver qualquer emergência elétrica em segurança.',
      immediateSteps: [
        'Não toque nos fios ou equipamentos elétricos molhados',
        'Desligue o disjuntor geral do quadro elétrico',
        'Afaste-se de qualquer zona com cheiro a queimado',
        'Se houver fumo ou faíscas, saia de casa e ligue 112',
        'Desligue todos os aparelhos das tomadas',
        'Contacte um eletricista profissional VITFIX',
      ],
      whenToCall: [
        'Curto-circuito — disjuntor geral disparou e não religa',
        'Cheiro a queimado na instalação elétrica',
        'Faíscas ou fumo numa tomada ou interruptor',
        'Toda a casa sem eletricidade (e vizinhos têm luz)',
        'Quadro elétrico faz ruídos ou está quente ao toque',
        'Fio elétrico exposto ou danificado',
      ],
      avgResponseTime: '30 a 60 minutos',
      availableSchedule: '7 dias por semana, incluindo feriados',
    },
  },
  {
    slug: 'canalizador',
    name: 'Canalizador',
    icon: '🔧',
    metaTitle: 'Canalizador / Picheleiro em {city} — Urgências e Reparações | VITFIX',
    metaDesc: 'Canalizador e picheleiro profissional em {city}. Fugas de água, entupimentos, reparação de esquentadores e caldeiras. Disponível 7/7. Orçamento grátis.',
    heroTitle: 'Canalizador em {city}',
    heroSubtitle: 'Canalizador (picheleiro) profissional em {city} — resolução rápida de fugas, entupimentos e avarias de canalização. Profissionais de confiança, disponíveis 7 dias por semana.',
    features: [
      'Reparação de fugas de água',
      'Desentupimento de canos e esgotos',
      'Reparação e instalação de torneiras',
      'Manutenção de esquentadores e caldeiras',
      'Reparação de autoclismos',
      'Deteção de fugas ocultas',
      'Instalação de sistemas de canalização',
      'Picheleiro disponível — serviços completos de canalização',
      'Urgências de canalização 24h',
    ],
    urgencyText: 'Fuga de água? Feche a torneira de segurança e contacte-nos imediatamente para minimizar os danos. Canalizador (picheleiro) disponível 24h.',
    problemsWeSolve: [
      'Fuga de água na parede ou no teto',
      'Canos entupidos ou obstruídos',
      'Esquentador que não liga ou não aquece',
      'Torneira que pinga ou está avariada',
      'Humidade nas paredes',
      'Cano rebentado',
    ],
    faqs: [
      { question: 'Quanto custa chamar um canalizador?', answer: 'Uma deslocação com diagnóstico custa entre 30€ e 50€. Reparações simples (trocar torneira, reparar autoclismo) custam entre 50€ e 100€. Desentupimentos entre 60€ e 150€ conforme a complexidade. Reparação de esquentador entre 80€ e 200€.' },
      { question: 'Fazem desentupimentos de urgência?', answer: 'Sim, os canalizadores VITFIX fazem desentupimentos de urgência em {city} e toda a região. Temos equipamento profissional para desobstruir qualquer tipo de canalização.' },
      { question: 'De quanto em quanto tempo devo fazer manutenção ao esquentador?', answer: 'Recomenda-se uma revisão anual do esquentador, idealmente antes do inverno. A manutenção inclui limpeza do queimador, verificação de segurança do gás, e limpeza de calcário. Isto prolonga a vida do aparelho e evita avarias inesperadas.' },
      { question: 'Como sei se tenho uma fuga de água oculta?', answer: 'Os sinais incluem: aumento inexplicável na conta de água, manchas de humidade que crescem nas paredes, som de água a correr com tudo fechado, pavimento que incha, e bolhas na pintura. Um canalizador pode confirmar com equipamento de deteção.' },
      { question: 'O que é um picheleiro? É diferente de um canalizador?', answer: 'No Norte de Portugal (e especialmente no Tâmega e Sousa), "picheleiro" é o nome regional para canalizador. Referem-se ao mesmo profissional que faz reparações de canalização, fugas, entupimentos e instalações de água. Na VITFIX, os nossos canalizadores/picheleiros trabalham em {city} e em toda a região.' },
    ],
    urgency: {
      metaTitle: 'Canalizador Urgente em {city} — Picheleiro 24h | VITFIX',
      metaDesc: 'Fuga de água urgente em {city}? Cano rebentado, inundação, esquentador avariado? Canalizador / picheleiro disponível 24h, 7/7. Intervenção rápida!',
      heroTitle: 'Canalizador Urgente em {city}',
      heroSubtitle: 'Fuga de água? Cano rebentado? Não espere que os danos aumentem! Os nossos canalizadores (picheleiros) intervêm rapidamente em {city} e arredores, 24 horas por dia.',
      immediateSteps: [
        'Feche imediatamente a torneira de segurança geral',
        'Se não sabe onde fica, feche a torneira do contador',
        'Coloque baldes e toalhas para conter a água',
        'Desligue a eletricidade se a água tocar em tomadas',
        'Não tente reparar sozinho — pode piorar a situação',
        'Ligue para a VITFIX — estamos disponíveis 24h',
      ],
      whenToCall: [
        'Cano rebentado — água a jorrar',
        'Inundação ativa que não consegue parar',
        'Fuga de gás (cheiro a gás) — ligue 112 primeiro',
        'Esgoto a transbordar dentro de casa',
        'Fuga de água no teto ou paredes',
        'Esquentador com fuga de água ou gás',
      ],
      avgResponseTime: '20 a 45 minutos',
      availableSchedule: '24 horas por dia, 7 dias por semana',
    },
  },
  {
    slug: 'pintor',
    name: 'Pintor',
    icon: '🎨',
    metaTitle: 'Pintor em {city} — Pintura Interior e Exterior | VITFIX',
    metaDesc: 'Pintor profissional em {city}. Pintura interior e exterior, remodelação, tratamento de humidade. Orçamento grátis e trabalho de qualidade.',
    heroTitle: 'Pintor em {city}',
    heroSubtitle: 'Pintura profissional para renovar a sua casa ou escritório. Acabamento impecável garantido.',
    features: [
      'Pintura interior de paredes e tetos',
      'Pintura exterior de fachadas',
      'Tratamento de humidade e bolores',
      'Aplicação de estuque e massa corrida',
      'Pintura decorativa e efeitos especiais',
      'Lacagem de portas e janelas',
      'Impermeabilização de paredes',
      'Preparação e lixagem de superfícies',
    ],
    urgencyText: 'Manchas de humidade? Trate o problema antes que piore. Fazemos diagnóstico e reparação completa.',
    problemsWeSolve: [
      'Paredes com manchas de humidade',
      'Pintura descascada ou a estalar',
      'Bolor no teto ou paredes',
      'Fachada degradada',
      'Paredes amareladas ou sujas',
      'Necessidade de renovação do espaço',
    ],
    faqs: [
      { question: 'Quanto custa pintar uma divisão?', answer: 'Pintar uma divisão de tamanho médio (12-15m²) custa entre 150€ e 300€, incluindo material. O preço varia conforme o estado das paredes, o tipo de tinta escolhido, e se é necessária preparação prévia (massa, lixagem). Pedidos de orçamento são gratuitos.' },
      { question: 'Quanto tempo demora a pintar uma casa?', answer: 'Um apartamento T2 completo demora entre 3 e 5 dias, incluindo preparação das paredes, aplicação de primário e duas demãos de tinta. Divisões individuais podem ser pintadas em 1 a 2 dias.' },
      { question: 'Que tipo de tinta usar para paredes com humidade?', answer: 'Para paredes com histórico de humidade, recomendamos tintas anti-mofo e anti-humidade. É essencial tratar primeiro a causa da humidade antes de pintar, caso contrário o problema reaparece. Usamos tintas profissionais específicas para cada situação.' },
      { question: 'Preciso de sair de casa durante a pintura?', answer: 'Não é necessário. Usamos tintas de baixo odor e base aquosa. Recomendamos apenas manter boa ventilação durante e após a pintura. As divisões podem ser utilizadas 24 horas após a última demão.' },
    ],
    urgency: {
      metaTitle: 'Pintor Urgente em {city} — Reparação Rápida | VITFIX',
      metaDesc: 'Precisa de um pintor urgente em {city}? Danos de água, manchas de humidade, pintura descascada? Intervenção rápida e trabalho de qualidade.',
      heroTitle: 'Pintor Urgente em {city}',
      heroSubtitle: 'Danos de água nas paredes? Manchas de humidade que se espalham? Os nossos pintores intervêm rapidamente em {city} para reparar e proteger as suas paredes.',
      immediateSteps: [
        'Identifique a causa da mancha (fuga, condensação, infiltração)',
        'Ventile bem a divisão afetada',
        'Não pinte por cima de manchas de humidade — o problema volta',
        'Se há bolor, evite tocar sem proteção (luvas, máscara)',
        'Documente os danos com fotos para o seguro',
        'Contacte a VITFIX para diagnóstico e reparação completa',
      ],
      whenToCall: [
        'Manchas de humidade que crescem rapidamente',
        'Pintura a descascar em grandes áreas após fuga de água',
        'Bolor extenso no teto ou paredes',
        'Preparação urgente para venda ou arrendamento',
        'Danos de água após inundação',
        'Fachada danificada que precisa de reparação imediata',
      ],
      avgResponseTime: '24 a 48 horas',
      availableSchedule: 'Segunda a sábado, resposta no próprio dia',
    },
  },
  {
    slug: 'pladur',
    name: 'Pladur e Tetos Falsos',
    icon: '🏗️',
    metaTitle: 'Pladur em {city} — Tetos Falsos e Divisórias | VITFIX',
    metaDesc: 'Instalação de pladur em {city}. Tetos falsos, divisórias, isolamento acústico e térmico. Profissionais experientes. Orçamento grátis.',
    heroTitle: 'Pladur e Tetos Falsos em {city}',
    heroSubtitle: 'Especialistas em pladur para divisórias, tetos falsos e isolamento. Trabalho limpo e rápido.',
    features: [
      'Montagem de tetos falsos em pladur',
      'Construção de divisórias interiores',
      'Isolamento acústico e térmico',
      'Reparação de tetos e paredes em pladur',
      'Criação de nichos e prateleiras',
      'Forração de paredes e pilares',
      'Instalação de sancas para iluminação',
      'Acabamento e pintura de pladur',
    ],
    urgencyText: 'Precisa de criar divisões no seu espaço? O pladur é a solução mais rápida e económica.',
    problemsWeSolve: [
      'Necessidade de dividir um espaço grande',
      'Teto danificado ou com infiltrações',
      'Isolamento insuficiente (frio/barulho)',
      'Paredes irregulares a esconder',
      'Renovação de escritório ou loja',
      'Esconder tubagens ou instalações',
    ],
    faqs: [
      { question: 'Quanto custa instalar pladur?', answer: 'O preço do pladur varia entre 20€ e 35€ por m², incluindo material e mão de obra. Um teto falso num quarto custa entre 300€ e 600€. Uma divisória completa entre 400€ e 800€. O preço final depende da complexidade e dos acabamentos.' },
      { question: 'O pladur é resistente?', answer: 'Sim, o pladur moderno é bastante resistente. Existem diferentes tipos: standard (para divisórias normais), hidrófugo (para casas de banho e cozinhas), e corta-fogo. Pode suportar peso nas paredes usando buchas específicas para pladur.' },
      { question: 'Quanto tempo demora a montar uma divisória em pladur?', answer: 'Uma divisória simples pode ser montada em 1 a 2 dias. Um teto falso de uma divisão demora 1 dia. Projetos maiores (divisão completa de um espaço, isolamento acústico) podem demorar 3 a 5 dias.' },
      { question: 'O pladur isola do barulho?', answer: 'Sim, especialmente se combinado com lã mineral no interior da estrutura. Uma divisória em pladur com isolamento acústico pode reduzir o ruído em 35-45 dB, o equivalente a tornar uma conversa alta praticamente inaudível do outro lado.' },
    ],
    urgency: {
      metaTitle: 'Pladur Urgente em {city} — Reparação de Tetos e Paredes | VITFIX',
      metaDesc: 'Precisa de reparação urgente de pladur em {city}? Teto danificado, infiltração, divisória partida? Profissionais experientes, intervenção rápida.',
      heroTitle: 'Pladur Urgente em {city}',
      heroSubtitle: 'Teto em pladur danificado? Infiltração que afetou as placas? Os nossos profissionais de pladur intervêm rapidamente em {city} para reparar e substituir painéis danificados.',
      immediateSteps: [
        'Se o teto está inchado ou a ceder, saia da divisão',
        'Coloque um balde sob qualquer ponto de goteira',
        'Não toque em pladur molhado — pode ceder sem aviso',
        'Desligue a eletricidade se houver focos de luz no teto afetado',
        'Ventile a divisão para secar o mais rápido possível',
        'Contacte a VITFIX para avaliação e reparação',
      ],
      whenToCall: [
        'Teto em pladur a ceder ou com bolhas de água',
        'Infiltração ativa através do teto falso',
        'Placa de pladur partida ou com buraco grande',
        'Divisória danificada por impacto',
        'Pladur com bolor extenso',
        'Reparação necessária antes de pintura urgente',
      ],
      avgResponseTime: '24 a 48 horas',
      availableSchedule: 'Segunda a sábado, resposta no próprio dia',
    },
  },
  {
    slug: 'obras-remodelacao',
    name: 'Obras e Remodelação',
    icon: '🏠',
    metaTitle: 'Obras e Remodelação em {city} — Renovação de Casas e Apartamentos | VITFIX',
    metaDesc: 'Obras e remodelação em {city}. Renovação de cozinhas, casas de banho, apartamentos completos. Orçamento grátis. Profissionais verificados.',
    heroTitle: 'Obras e Remodelação em {city}',
    heroSubtitle: 'Renovação completa ou parcial da sua casa. Cozinhas, casas de banho, apartamentos — tudo com profissionais verificados e orçamento gratuito.',
    features: [
      'Remodelação completa de apartamentos',
      'Renovação de cozinhas e casas de banho',
      'Obras de ampliação e divisão de espaços',
      'Demolição e reconstrução interior',
      'Substituição de pavimentos e revestimentos',
      'Instalação de caixilharia e janelas',
      'Impermeabilização de terraços e varandas',
      'Gestão integral de obras — chave na mão',
    ],
    urgencyText: 'Precisa de fazer obras rapidamente? Avaliamos o seu projeto e apresentamos orçamento em 24 horas.',
    problemsWeSolve: [
      'Casa antiga que precisa de renovação total',
      'Cozinha ou casa de banho desatualizada',
      'Problemas de humidade e infiltrações',
      'Pavimento danificado ou desatualizado',
      'Necessidade de reorganizar o espaço',
      'Preparação de imóvel para venda ou arrendamento',
    ],
    faqs: [
      { question: 'Quanto custam obras de remodelação em média?', answer: 'O custo de uma remodelação depende da dimensão e complexidade. Uma casa de banho completa custa entre 3 000€ e 8 000€. Uma cozinha entre 5 000€ e 15 000€. A remodelação completa de um apartamento T2 varia entre 15 000€ e 40 000€. Na VITFIX, o orçamento é sempre gratuito e detalhado.' },
      { question: 'Quanto tempo demoram obras de remodelação?', answer: 'Uma casa de banho demora entre 2 a 4 semanas. Uma cozinha entre 3 a 6 semanas. A remodelação completa de um apartamento pode levar de 2 a 4 meses, dependendo da complexidade e das licenças necessárias.' },
      { question: 'Preciso de licença para fazer obras em casa?', answer: 'Obras no interior do imóvel que não alterem a estrutura geralmente não precisam de licença. No entanto, obras que modifiquem a fachada, a estrutura ou aumentem a área construída necessitam de licença camarária. A VITFIX ajuda-o com todo o processo.' },
      { question: 'Posso continuar a viver em casa durante as obras?', answer: 'Na maioria dos casos sim, especialmente em remodelações parciais (uma divisão de cada vez). Em remodelações completas, pode ser necessário arranjar alojamento temporário durante 1 a 2 semanas na fase mais intensa. Planeamos as obras para minimizar o transtorno.' },
    ],
    urgency: {
      metaTitle: 'Obras Urgentes em {city} — Reparação e Remodelação Rápida | VITFIX',
      metaDesc: 'Precisa de obras urgentes em {city}? Danos de água, reparações estruturais, preparação urgente de imóvel? Intervenção rápida com profissionais verificados.',
      heroTitle: 'Obras Urgentes em {city}',
      heroSubtitle: 'Danos de água? Problemas estruturais? Precisa de preparar um imóvel rapidamente? Os nossos profissionais intervêm com urgência em {city} e arredores para obras de reparação e remodelação.',
      immediateSteps: [
        'Documente todos os danos com fotos e vídeos',
        'Se houver danos de água, feche a torneira geral',
        'Se houver problemas elétricos, desligue o quadro',
        'Não faça reparações provisórias que possam piorar a situação',
        'Contacte o seguro se os danos forem cobertos',
        'Ligue para a VITFIX para avaliação e orçamento urgente',
      ],
      whenToCall: [
        'Danos de água extensos (inundação, cano rebentado)',
        'Problemas estruturais visíveis (fissuras, cedências)',
        'Preparação urgente de imóvel para venda ou arrendamento',
        'Obras de emergência após tempestade ou intempéries',
        'Reparação urgente antes de uma inspeção',
        'Necessidade de habitabilidade rápida após incidente',
      ],
      avgResponseTime: '24 a 48 horas',
      availableSchedule: 'Segunda a sábado, avaliação no próprio dia',
    },
  },
  {
    slug: 'isolamento-termico',
    name: 'Isolamento Térmico e Capoto',
    icon: '🧱',
    metaTitle: 'Isolamento Térmico e Capoto em {city} — ETICS e Eficiência Energética | VITFIX',
    metaDesc: 'Isolamento térmico e capoto (ETICS) em {city}. Reduza a conta de energia, elimine pontes térmicas e melhore o conforto da sua casa. IVA 6%. Orçamento grátis.',
    heroTitle: 'Isolamento Térmico e Capoto em {city}',
    heroSubtitle: 'Melhore a eficiência energética da sua casa com isolamento térmico pelo exterior (capoto/ETICS). Reduza até 40% na fatura de energia. Orçamento gratuito.',
    features: [
      'Aplicação de sistema ETICS (capoto) em fachadas',
      'Isolamento térmico pelo interior com pladur',
      'Isolamento de coberturas e telhados',
      'Isolamento de pavimentos e lajes',
      'Substituição de caixilharia com corte térmico',
      'Isolamento acústico de paredes e tetos',
      'Correção de pontes térmicas',
      'Certificação energética — melhoria de classe',
    ],
    urgencyText: 'Casa fria no inverno e quente no verão? O isolamento térmico é a solução definitiva para conforto e poupança energética.',
    problemsWeSolve: [
      'Casa muito fria no inverno apesar do aquecimento',
      'Fatura de energia excessivamente alta',
      'Condensação e bolor nas paredes interiores',
      'Fachada degradada com fissuras',
      'Casa muito quente no verão',
      'Necessidade de melhorar a classe energética',
    ],
    faqs: [
      { question: 'Quanto custa aplicar capoto por m²?', answer: 'O custo do sistema ETICS (capoto) varia entre 40€ e 80€ por m², dependendo da espessura do isolamento (geralmente 6 a 10 cm de EPS ou lã mineral), da complexidade da fachada e dos acabamentos. Para uma moradia média de 150m² de fachada, o investimento total situa-se entre 6 000€ e 12 000€. Este valor pode beneficiar de IVA reduzido a 6% em habitações com mais de 2 anos.' },
      { question: 'O isolamento térmico paga-se a si próprio?', answer: 'Sim, o isolamento térmico pode reduzir a fatura energética entre 25% e 40%. Com uma poupança média de 500€ a 1 000€ por ano em aquecimento e arrefecimento, o investimento recupera-se tipicamente em 6 a 10 anos. Além disso, valoriza o imóvel ao melhorar a sua classe energética, o que é cada vez mais importante na compra e venda de casas em Portugal.' },
      { question: 'Posso aplicar capoto sem licença da câmara?', answer: 'A aplicação de capoto altera o aspeto exterior do edifício, pelo que em muitos municípios é necessária uma comunicação prévia à Câmara Municipal. No entanto, o processo é geralmente simples e rápido. Em edifícios de apartamentos, é necessária a aprovação do condomínio. A VITFIX ajuda com todo o processo burocrático.' },
      { question: 'Qual a diferença entre EPS e lã mineral no capoto?', answer: 'O EPS (poliestireno expandido) é mais económico, leve e fácil de aplicar — é a escolha mais comum. A lã mineral oferece melhor isolamento acústico e é incombustível (classificação A1 ao fogo), sendo recomendada para edifícios altos ou zonas com requisitos especiais de proteção contra incêndio. Ambos oferecem excelente desempenho térmico.' },
    ],
    urgency: {
      metaTitle: 'Isolamento Térmico Urgente em {city} — Capoto e ETICS Rápido | VITFIX',
      metaDesc: 'Precisa de isolamento térmico urgente em {city}? Problemas de condensação, bolor, fachada danificada? Intervenção rápida. IVA 6% em habitações.',
      heroTitle: 'Isolamento Térmico Urgente em {city}',
      heroSubtitle: 'Problemas graves de condensação ou bolor? Fachada degradada que precisa de intervenção imediata? Os nossos especialistas em isolamento térmico intervêm rapidamente em {city} para proteger a sua casa.',
      immediateSteps: [
        'Ventile bem as divisões afetadas por condensação',
        'Limpe o bolor com produto anti-fúngico adequado',
        'Afaste móveis das paredes afetadas para melhorar a circulação de ar',
        'Não tape as grelhas de ventilação existentes',
        'Documente os danos com fotos para o seguro ou condomínio',
        'Contacte a VITFIX para diagnóstico térmico e orçamento',
      ],
      whenToCall: [
        'Condensação severa com água a escorrer pelas paredes',
        'Bolor extenso em várias divisões da casa',
        'Fachada com capoto danificado ou descolado',
        'Necessidade urgente de certificação energética para venda',
        'Danos de isolamento após tempestade ou intempéries',
        'Fissuras na fachada que permitem infiltrações',
      ],
      avgResponseTime: '48 a 72 horas',
      availableSchedule: 'Segunda a sábado, avaliação no próprio dia',
    },
  },
  {
    slug: 'impermeabilizacao',
    name: 'Impermeabilização',
    icon: '🛡️',
    metaTitle: 'Impermeabilização em {city} — Telhados, Terraços e Caves | VITFIX',
    metaDesc: 'Impermeabilização profissional em {city}. Telhados, terraços, varandas, caves e fachadas. Acabar com infiltrações definitivamente. Orçamento grátis.',
    heroTitle: 'Impermeabilização em {city}',
    heroSubtitle: 'Soluções definitivas contra infiltrações e humidade. Impermeabilização de telhados, terraços, varandas, caves e fachadas com garantia.',
    features: [
      'Impermeabilização de telhados e coberturas',
      'Impermeabilização de terraços e varandas',
      'Impermeabilização de caves e garagens',
      'Tratamento de fachadas contra infiltrações',
      'Aplicação de membranas betuminosas e líquidas',
      'Reparação de caleiras e rufos',
      'Impermeabilização de casas de banho e cozinhas',
      'Drenagem periférica de fundações',
    ],
    urgencyText: 'Infiltrações ativas? Cada dia que passa aumenta os danos. Não espere — a impermeabilização de urgência evita reparações muito mais caras.',
    problemsWeSolve: [
      'Infiltrações pelo telhado durante a chuva',
      'Terraço ou varanda que infiltra para o andar de baixo',
      'Cave ou garagem com humidade e água',
      'Fachada que deixa passar água',
      'Manchas de humidade no teto do último andar',
      'Caleiras e rufos danificados ou entupidos',
    ],
    faqs: [
      { question: 'Quanto custa impermeabilizar um telhado?', answer: 'O custo de impermeabilização de um telhado depende do tipo e estado atual. Reparação pontual de telhas e rufos: 200€ a 500€. Aplicação de membrana impermeabilizante sobre telhado existente: 15€ a 30€ por m². Substituição completa da sub-telha e impermeabilização: 30€ a 60€ por m². Para um telhado médio de 100m², a impermeabilização completa custa entre 3 000€ e 6 000€.' },
      { question: 'Quanto tempo dura uma impermeabilização?', answer: 'Uma impermeabilização profissional bem executada dura entre 10 e 20 anos, dependendo do tipo de material e da exposição. Membranas betuminosas duram 15-20 anos. Membranas líquidas (poliuretano, acrílicas) duram 10-15 anos. Telha cerâmica bem mantida pode durar 30-50 anos. A manutenção regular (limpeza de caleiras, verificação anual) prolonga significativamente a vida útil.' },
      { question: 'Posso impermeabilizar um terraço sem levantar o pavimento?', answer: 'Sim, existem sistemas de impermeabilização que podem ser aplicados sobre o pavimento existente. As membranas líquidas (poliuretano ou resinas acrílicas) são aplicadas como uma tinta e criam uma barreira impermeável sem necessidade de demolição. No entanto, se o pavimento está muito danificado ou se a impermeabilização existente falhou estruturalmente, pode ser necessário levantar para garantir uma solução duradoura.' },
      { question: 'A impermeabilização resolve problemas de humidade nas paredes?', answer: 'Depende da causa da humidade. Se a humidade vem de infiltrações exteriores (telhado, fachada), a impermeabilização resolve o problema. Se é condensação (falta de ventilação e isolamento), a solução passa por melhorar a ventilação e o isolamento térmico. Se é capilaridade (humidade que sobe do solo), é necessário um tratamento específico com barreiras químicas. Um diagnóstico profissional identifica a causa correta.' },
    ],
    urgency: {
      metaTitle: 'Impermeabilização Urgente em {city} — Infiltrações e Telhados | VITFIX',
      metaDesc: 'Infiltração urgente em {city}? Telhado a deixar entrar água, terraço inundado, cave alagada? Impermeabilização de emergência. Contacte-nos agora!',
      heroTitle: 'Impermeabilização Urgente em {city}',
      heroSubtitle: 'Infiltração ativa? Telhado danificado pela tempestade? Os nossos especialistas intervêm com urgência em {city} para parar as infiltrações e proteger a sua casa de danos maiores.',
      immediateSteps: [
        'Coloque baldes e recipientes sob os pontos de infiltração',
        'Proteja móveis e objetos de valor das zonas afetadas',
        'Se possível, cubra a zona do telhado com lona impermeável',
        'Desligue a eletricidade se a água atingir instalações elétricas',
        'Documente os danos com fotos para o seguro',
        'Contacte a VITFIX para impermeabilização de emergência',
      ],
      whenToCall: [
        'Infiltração ativa com água a entrar durante a chuva',
        'Telhado danificado por tempestade ou vento forte',
        'Terraço inundado que infiltra para o andar inferior',
        'Cave ou garagem alagada após chuvas intensas',
        'Caleira rebentada ou entupida a causar infiltrações',
        'Necessidade de impermeabilização antes da estação das chuvas',
      ],
      avgResponseTime: '24 a 48 horas',
      availableSchedule: 'Segunda a sábado, urgências atendidas no próprio dia',
    },
  },
  {
    slug: 'desentupimento',
    name: 'Desentupimento',
    icon: '🚿',
    metaTitle: 'Desentupimento em {city} — Esgotos, Canos e Sarjetas | VITFIX',
    metaDesc: 'Desentupimento profissional em {city}. Canos, esgotos, sarjetas, fossas e colunas de esgoto. Equipamento especializado. Disponível 24h. Orçamento grátis.',
    heroTitle: 'Desentupimento em {city}',
    heroSubtitle: 'Desentupimento rápido e eficaz de canos, esgotos e sarjetas. Equipamento profissional e intervenção urgente disponível.',
    features: [
      'Desentupimento de canos e tubagens',
      'Desentupimento de esgotos e colunas',
      'Limpeza de sarjetas e caleiras',
      'Desobstrução de fossas sépticas',
      'Desentupimento com máquina de alta pressão',
      'Inspeção vídeo de canalizações',
      'Desentupimento de sanitas e lavatórios',
      'Manutenção preventiva de esgotos',
    ],
    urgencyText: 'Esgoto entupido ou a transbordar? Não use produtos químicos! Contacte-nos para uma intervenção imediata com equipamento profissional.',
    problemsWeSolve: [
      'Sanita entupida que não desobstrui',
      'Água estagnada no lavatório ou banheira',
      'Esgoto a transbordar dentro de casa',
      'Cheiro a esgoto forte na casa de banho ou cozinha',
      'Sarjeta exterior bloqueada',
      'Fossa séptica cheia ou entupida',
    ],
    faqs: [
      { question: 'Quanto custa um desentupimento?', answer: 'Um desentupimento simples (sanita, lavatório) custa entre 60€ e 120€. Desentupimento de esgoto com máquina de alta pressão custa entre 120€ e 250€. Limpeza de fossa séptica entre 150€ e 350€. O preço depende da complexidade e do tipo de obstrução.' },
      { question: 'Posso usar produtos químicos para desentupir?', answer: 'Desaconselhamos fortemente os produtos químicos de desentupimento. Podem danificar as tubagens (especialmente as mais antigas), são perigosos para a saúde e ambiente, e geralmente não resolvem obstruções graves. Um desentupimento profissional com equipamento mecânico ou de alta pressão é mais eficaz e seguro.' },
      { question: 'Quanto tempo demora um desentupimento?', answer: 'Um desentupimento simples (sanita, lavatório) demora 30 a 60 minutos. Desentupimento de esgoto exterior ou coluna pode demorar 1 a 3 horas. A inspeção por vídeo adiciona cerca de 30 minutos mas permite identificar a causa exata do problema.' },
      { question: 'Como prevenir entupimentos?', answer: 'Para prevenir entupimentos: não deite gorduras ou óleos pelo ralo da cozinha, use um ralo com filtro para apanhar cabelos na banheira, não deite toalhitas húmidas pela sanita (mesmo as "biodegradáveis"), faça uma limpeza preventiva dos ralos mensalmente com água a ferver, e considere uma manutenção profissional anual dos esgotos.' },
    ],
    urgency: {
      metaTitle: 'Desentupimento Urgente em {city} — Disponível 24h | VITFIX',
      metaDesc: 'Esgoto entupido em {city}? Sanita bloqueada, água estagnada, cheiro a esgoto? Desentupimento urgente 24h com equipamento profissional.',
      heroTitle: 'Desentupimento Urgente em {city}',
      heroSubtitle: 'Esgoto a transbordar? Sanita bloqueada? Não espere que a situação piore! Os nossos técnicos intervêm rapidamente em {city} com equipamento profissional de desentupimento.',
      immediateSteps: [
        'Não deite mais água no ralo ou sanita entupida',
        'Não use produtos químicos de desentupimento',
        'Se o esgoto transborda, feche a torneira geral de água',
        'Ventile a divisão se houver cheiro forte a esgoto',
        'Proteja o chão com toalhas ou panos absorventes',
        'Contacte a VITFIX para desentupimento profissional urgente',
      ],
      whenToCall: [
        'Esgoto a transbordar pela sanita ou ralo',
        'Água estagnada em vários pontos da casa',
        'Cheiro forte a esgoto que não passa',
        'Sanita completamente bloqueada',
        'Inundação por obstrução de esgoto',
        'Sarjeta exterior bloqueada a causar alagamento',
      ],
      avgResponseTime: '30 a 60 minutos',
      availableSchedule: '24 horas por dia, 7 dias por semana',
    },
  },
  {
    slug: 'faz-tudo',
    name: 'Faz Tudo',
    icon: '🔨',
    metaTitle: 'Faz Tudo em {city} — Pequenas Reparações e Manutenção | VITFIX',
    metaDesc: 'Faz tudo em {city}. Pequenas reparações, montagem de móveis, bricolage, manutenção doméstica. Profissional de confiança. Orçamento grátis.',
    heroTitle: 'Faz Tudo em {city}',
    heroSubtitle: 'Um profissional para todas as pequenas reparações e manutenção da sua casa. Prático, rápido e de confiança.',
    features: [
      'Montagem e desmontagem de móveis',
      'Reparação de portas e janelas',
      'Fixação de prateleiras e quadros',
      'Pequenas reparações de canalização',
      'Substituição de fechaduras e puxadores',
      'Reparação de estores e persianas',
      'Vedação de juntas e silicones',
      'Manutenção geral da habitação',
    ],
    urgencyText: 'Precisa de uma reparação rápida em casa? O nosso faz-tudo resolve pequenos problemas no próprio dia.',
    problemsWeSolve: [
      'Porta que não fecha ou range',
      'Estore partido ou encravado',
      'Torneira que pinga (reparação simples)',
      'Prateleira solta ou a cair',
      'Fechadura avariada',
      'Silicone da banheira ou duche degradado',
    ],
    faqs: [
      { question: 'O que faz um faz-tudo?', answer: 'Um faz-tudo (ou marido de aluguer) resolve pequenas reparações e tarefas de manutenção doméstica que não exigem um especialista certificado. Inclui montagem de móveis, reparação de portas e estores, fixação de prateleiras, substituição de fechaduras, vedação de juntas, e muitas outras pequenas intervenções.' },
      { question: 'Quanto custa o serviço de faz-tudo?', answer: 'O serviço de faz-tudo cobra geralmente por hora: entre 20€ e 35€/hora na região do Tâmega e Sousa. Muitos profissionais cobram um mínimo de 1 a 2 horas. Para tarefas específicas como montagem de um armário IKEA, o preço é geralmente fixo (50€-100€ dependendo da complexidade).' },
      { question: 'Qual a diferença entre faz-tudo e canalizador/eletricista?', answer: 'O faz-tudo resolve pequenas tarefas gerais (montar móveis, reparar portas, fixar prateleiras). Para trabalhos especializados que envolvam eletricidade (quadros elétricos, instalações) ou canalização complexa (fugas, desentupimentos graves), é necessário um profissional certificado. Na VITFIX temos os dois tipos de profissionais.' },
      { question: 'O faz-tudo traz as ferramentas?', answer: 'Sim, os profissionais faz-tudo da VITFIX trazem o seu próprio equipamento e ferramentas. Para tarefas que necessitem de materiais específicos (fechaduras, parafusos, silicone), o profissional pode comprá-los antecipadamente ou inclui-los no orçamento.' },
    ],
    urgency: {
      metaTitle: 'Faz Tudo Urgente em {city} — Reparações Rápidas | VITFIX',
      metaDesc: 'Precisa de um faz-tudo urgente em {city}? Porta partida, estore encravado, fechadura avariada? Intervenção rápida no próprio dia.',
      heroTitle: 'Faz Tudo Urgente em {city}',
      heroSubtitle: 'Uma reparação urgente em casa? Porta que não fecha, estore partido, fechadura avariada? O nosso faz-tudo intervém rapidamente em {city} para resolver o problema no próprio dia.',
      immediateSteps: [
        'Se é uma porta exterior que não fecha, improvise uma segurança temporária',
        'Se o estore está encravado, não force — pode piorar',
        'Se a fechadura bloqueou, não tente forçar com objetos',
        'Tire fotos do problema para facilitar o diagnóstico',
        'Contacte a VITFIX para uma reparação rápida',
        'Descreva o problema com o máximo de detalhe possível',
      ],
      whenToCall: [
        'Porta de entrada que não fecha ou tranca',
        'Estore completamente partido ou encravado',
        'Fechadura avariada — não consegue entrar ou sair',
        'Vidro partido que precisa de proteção imediata',
        'Fuga de água simples (torneira, autoclismo)',
        'Necessidade urgente de montagem (ex: berço, cama)',
      ],
      avgResponseTime: '2 a 4 horas',
      availableSchedule: 'Segunda a sábado, 8h às 20h',
    },
  },
  {
    slug: 'serralheiro',
    name: 'Serralheiro',
    icon: '🔐',
    metaTitle: 'Serralheiro em {city} — Abertura de Portas e Fechaduras | VITFIX',
    metaDesc: 'Serralheiro profissional em {city}. Abertura de portas fechadas, mudança de fechaduras, cofres, portões. Disponível 24h. Orçamento grátis.',
    heroTitle: 'Serralheiro em {city}',
    heroSubtitle: 'Ficou fechado fora de casa? Precisa de mudar a fechadura? Os nossos serralheiros intervêm rapidamente em {city}, 24 horas por dia.',
    features: [
      'Abertura de portas sem danos',
      'Mudança e substituição de fechaduras',
      'Instalação de fechaduras de segurança',
      'Reparação e manutenção de fechaduras',
      'Abertura e reparação de cofres',
      'Instalação de fechaduras de alta segurança',
      'Duplicação de chaves',
      'Portões e automatismos',
    ],
    urgencyText: 'Fechado fora de casa? Fechadura partida? Ligue agora — serralheiro disponível 24h em {city}.',
    problemsWeSolve: [
      'Fechado fora de casa ou do carro',
      'Chave partida na fechadura',
      'Fechadura avariada ou bloqueada',
      'Porta batida sem chave',
      'Necessidade de trocar fechadura após assalto',
      'Portão automático avariado',
    ],
    faqs: [
      { question: 'Quanto custa chamar um serralheiro?', answer: 'A abertura de uma porta custa entre 60€ e 120€ dependendo do tipo de fechadura e da hora de intervenção. Substituição de fechadura entre 80€ e 200€ incluindo peça e mão de obra. Para urgências noturnas ou fins de semana pode haver uma majoração de 30% a 50%. Na VITFIX, o orçamento é sempre informado antes da intervenção.' },
      { question: 'Quanto tempo demora a abrir uma porta?', answer: 'Uma porta standard com fechadura normal pode ser aberta em 5 a 15 minutos sem danos. Portas com fechaduras de alta segurança (Mul-T-Lock, Yale, EVVA) podem demorar mais. O nosso serralheiro avalia no local e informa sempre o tempo estimado e o custo antes de avançar.' },
      { question: 'O serralheiro abre a porta sem a danificar?', answer: 'Sim, os serralheiros profissionais VITFIX utilizam técnicas não destrutivas (picking, bump key, decodificação) para abrir a maioria das fechaduras sem danos. Só em casos extremos (fechaduras muito danificadas ou bloqueadas) é necessário destruir a fechadura, sendo sempre comunicado previamente.' },
      { question: 'Posso mudar a fechadura da minha porta?', answer: 'Sim. Recomendamos mudar a fechadura sempre que: se mudou de casa, após um assalto ou tentativa, perdeu a chave, ou simplesmente por segurança. Os nossos serralheiros instalam fechaduras certificadas de classe 3 e 4, com certificação europeia, em qualquer tipo de porta.' },
    ],
    urgency: {
      metaTitle: 'Serralheiro Urgente em {city} — Abertura de Portas 24h | VITFIX',
      metaDesc: 'Serralheiro urgente em {city}: fechado fora de casa, chave partida, porta bloqueada. Intervenção rápida 24h, 7 dias por semana. Ligue agora!',
      heroTitle: 'Serralheiro Urgente em {city}',
      heroSubtitle: 'Emergência de serralharia em {city}? Os nossos serralheiros intervêm em menos de 30 minutos, 24 horas por dia, incluindo fins de semana e feriados.',
      immediateSteps: [
        'Mantenha a calma — não force a porta ou a fechadura',
        'Verifique se há outra entrada disponível (janela, porta traseira)',
        'Reúna o seu documento de identificação para mostrar ao serralheiro',
        'Avise um vizinho se necessário',
        'Não tente abrir a porta com objetos improvisados (pode danificar a fechadura)',
        'Ligue para a VITFIX — serralheiro disponível 24h em {city}',
      ],
      whenToCall: [
        'Fechado fora de casa ou do escritório',
        'Chave partida dentro da fechadura',
        'Fechadura bloqueada ou avariada',
        'Porta batida acidentalmente (sem chave)',
        'Após tentativa de arrombamento',
        'Portão elétrico bloqueado',
      ],
      avgResponseTime: '15 a 30 minutos',
      availableSchedule: '24 horas por dia, 7 dias por semana',
    },
  },
  {
    slug: 'telhador',
    name: 'Telhado e Cobertura',
    icon: '🏠',
    metaTitle: 'Telhador em {city} — Reparação e Impermeabilização de Telhados | VITFIX',
    metaDesc: 'Telhador profissional em {city}. Reparação de telhas, impermeabilização, limpeza e manutenção de coberturas. Orçamento grátis. Profissionais verificados.',
    heroTitle: 'Telhador em {city}',
    heroSubtitle: 'Especialistas em reparação e manutenção de telhados em {city}. Telhas partidas, infiltrações, impermeabilização — resolução rápida e duradoura.',
    features: [
      'Reparação e substituição de telhas',
      'Impermeabilização de coberturas',
      'Limpeza e desobstrução de caleiras',
      'Instalação de rufos e remates',
      'Reparação de telhados planos e inclinados',
      'Deteção e reparação de infiltrações',
      'Tratamento e pintura de telhados',
      'Isolamento térmico de coberturas',
    ],
    urgencyText: 'Infiltração no telhado? Não espere — a água pode danificar toda a estrutura. Chamada urgente disponível.',
    problemsWeSolve: [
      'Infiltração de água pelo teto',
      'Telhas partidas ou deslocadas após tempestade',
      'Caleiras entupidas a transbordar',
      'Manchas de humidade no teto interior',
      'Musgo e vegetação no telhado',
      'Telhado plano com bolhas ou fissuras',
    ],
    faqs: [
      { question: 'Quanto custa reparar um telhado?', answer: 'A reparação de algumas telhas partidas custa entre 150€ e 400€. A substituição de uma cobertura completa de uma moradia varia entre 3 000€ e 12 000€ dependendo do tamanho, tipo de telha e estado estrutural. A impermeabilização de um telhado plano custa entre 20€ e 40€ por m². Na VITFIX, o orçamento é gratuito e detalhado.' },
      { question: 'Com que frequência devo fazer manutenção ao telhado?', answer: 'Recomendamos uma inspeção anual do telhado, preferencialmente no outono antes das chuvas. Após tempestades fortes é sempre boa ideia verificar o estado das telhas. A limpeza de caleiras deve ser feita pelo menos uma vez por ano para evitar entupimentos e infiltrações.' },
      { question: 'O que fazer quando o telhado começa a infiltrar?', answer: 'Coloque imediatamente recipientes para recolher a água e proteja os móveis e o pavimento. Localize a zona de infiltração no interior (mancha no teto) e faça uma marcação. Evite subir ao telhado sem equipamento de segurança. Contacte um telhador profissional VITFIX o mais rapidamente possível para evitar danos estruturais.' },
      { question: 'Qual é o tipo de telha mais durável?', answer: 'As telhas cerâmicas (barro) e as telhas de betão têm uma durabilidade de 40 a 80 anos se bem mantidas. As telhas de ardósia podem durar mais de 100 anos. Para telhados planos, as membranas de PVC e betuminosas de alta qualidade têm garantias de 20 a 25 anos. O nosso telhador recomenda a melhor solução para cada situação.' },
    ],
    urgency: {
      metaTitle: 'Telhador Urgente em {city} — Reparação de Infiltrações 24h | VITFIX',
      metaDesc: 'Telhado com infiltração urgente em {city}? Telhas partidas, cobertura danificada após tempestade? Telhador disponível rapidamente. Orçamento imediato.',
      heroTitle: 'Telhador Urgente em {city}',
      heroSubtitle: 'Tempestade danificou o seu telhado? Infiltração ativa no interior? Os nossos telhadores intervêm com urgência em {city} para proteger a sua casa.',
      immediateSteps: [
        'Afaste-se das zonas com risco de queda de materiais',
        'Coloque recipientes para recolher a água que entra',
        'Proteja móveis e equipamentos com plásticos',
        'Documente os danos com fotos para o seguro',
        'Contacte o seu seguro habitação para reportar os danos',
        'Ligue para a VITFIX para intervenção urgente em {city}',
      ],
      whenToCall: [
        'Infiltração ativa com água a entrar em casa',
        'Telhas arrancadas ou partidas após tempestade',
        'Caleira partida ou deslocada',
        'Telhado plano com bolha de água (risco de cedência)',
        'Ruídos na cobertura durante o vento',
        'Manchas de humidade que crescem rapidamente no teto',
      ],
      avgResponseTime: '24 a 48 horas',
      availableSchedule: 'Segunda a sábado, resposta urgente no próprio dia',
    },
  },
  {
    slug: 'vidraceiro',
    name: 'Vidraceiro',
    icon: '🪟',
    metaTitle: 'Vidraceiro em {city} — Substituição de Vidros e Janelas | VITFIX',
    metaDesc: 'Vidraceiro profissional em {city}. Substituição de vidros partidos, instalação de vidro duplo, espelhos, claraboias. Intervenção rápida. Orçamento grátis.',
    heroTitle: 'Vidraceiro em {city}',
    heroSubtitle: 'Vidro partido? Janela com condensação? Os nossos vidraceiros substituem e instalam vidros de todos os tipos em {city} com rapidez e profissionalismo.',
    features: [
      'Substituição de vidros partidos (urgência)',
      'Instalação de vidro duplo e vidro triplo',
      'Substituição de vidros com isolamento acústico',
      'Instalação de espelhos',
      'Reparação de claraboias',
      'Vidros laminados e de segurança',
      'Corte e instalação de vidros à medida',
      'Substituição de perfis e vedantes de janelas',
    ],
    urgencyText: 'Vidro partido? Situação de segurança ou frio? Chamamos um vidraceiro com urgência em {city}.',
    problemsWeSolve: [
      'Vidro partido por acidente ou vandalismo',
      'Condensação entre os vidros (duplo vidro danificado)',
      'Janela que não isola (frio e ruído)',
      'Espelho partido ou deslocado',
      'Claraboia com fuga ou vidro rachado',
      'Necessidade de substituir vidros simples por vidro duplo',
    ],
    faqs: [
      { question: 'Quanto custa substituir um vidro?', answer: 'A substituição de um vidro simples de janela custa entre 40€ e 80€, dependendo do tamanho. Um vidro duplo (caixilho standard) custa entre 80€ e 200€. Vidros especiais (laminado, temperado, acústico) têm custos entre 150€ e 500€. A deslocação e mão de obra estão normalmente incluídas no orçamento final.' },
      { question: 'Vale a pena trocar vidro simples por vidro duplo?', answer: 'Sim, o vidro duplo (janela com duas folhas de vidro separadas por câmara de ar) reduz as perdas de calor em 50% e melhora significativamente o isolamento acústico. Em Portugal, os gastos de aquecimento e arrefecimento podem reduzir-se em 20 a 30%. O investimento recupera-se tipicamente em 5 a 8 anos através da poupança energética.' },
      { question: 'Por que há condensação entre os vidros do duplo vidro?', answer: 'A condensação entre os vidros do duplo vidro significa que a câmara de argon/ar ficou comprometida — o vedante periférico falhou e a humidade entrou. Neste caso, o duplo vidro tem de ser substituído; não é possível reparar. O nosso vidraceiro substitui apenas o painel de vidro, mantendo o caixilho existente se estiver em boas condições.' },
      { question: 'Fazem substituição de vidros ao fim de semana?', answer: 'Sim, especialmente em situações de urgência (vidro partido com risco de segurança). Para substituições programadas, trabalhamos de segunda a sábado. Em caso de vandalismo ou acidente, podemos colocar um painel temporário de proteção imediatamente e agendar a substituição definitiva para o dia seguinte.' },
    ],
    urgency: {
      metaTitle: 'Vidraceiro Urgente em {city} — Vidro Partido 24h | VITFIX',
      metaDesc: 'Vidro partido urgente em {city}? Janela partida por vandalismo ou acidente? Vidraceiro disponível rapidamente. Painel provisório e substituição definitiva.',
      heroTitle: 'Vidraceiro Urgente em {city}',
      heroSubtitle: 'Vidro partido em {city}? Os nossos vidraceiros intervêm com urgência para proteger a sua propriedade com um painel provisório e proceder à substituição definitiva.',
      immediateSteps: [
        'Afaste-se dos vidros partidos — os cacos cortam gravemente',
        'Use luvas e calçado fechado antes de limpar os cacos',
        'Proteja a abertura com cartão ou plástico resistente',
        'Se foi vandalismo, apresente queixa na PSP antes da intervenção',
        'Tire fotos dos danos para o seguro',
        'Contacte a VITFIX para intervenção urgente em {city}',
      ],
      whenToCall: [
        'Vidro partido que expõe o interior ao tempo ou a intrusos',
        'Janela partida após tempestade ou granizo',
        'Vandalismos — vidro da montra ou entrada',
        'Claraboia com vidro rachado ou partido',
        'Espelho de grande dimensão a ceder da parede',
        'Porta de vidro partida',
      ],
      avgResponseTime: '2 a 4 horas',
      availableSchedule: '7 dias por semana para urgências',
    },
  },
  {
    slug: 'azulejador',
    name: 'Azulejador e Ladrilhador',
    icon: '🏗️',
    metaTitle: 'Azulejador em {city} — Colocação de Azulejos e Ladrilhos | VITFIX',
    metaDesc: 'Azulejador profissional em {city}. Colocação de azulejos, ladrilhos, mosaicos para casas de banho, cozinhas e terraços. Orçamento grátis.',
    heroTitle: 'Azulejador em {city}',
    heroSubtitle: 'Especialistas em colocação de azulejos e ladrilhos em {city}. Casas de banho, cozinhas, terraços e pavimentos — acabamento impecável garantido.',
    features: [
      'Colocação de azulejos para paredes de casa de banho',
      'Ladrilhamento de pavimentos interiores e exteriores',
      'Colocação de mosaicos e pedra natural',
      'Reparação de azulejos partidos ou descolados',
      'Revestimento de terraços e varandas',
      'Colocação de bases de duche e banheiras',
      'Rejuntamento e impermeabilização de juntas',
      'Remoção de revestimentos antigos',
    ],
    urgencyText: 'Azulejos partidos ou descolados? Reparamos rapidamente para evitar infiltrações e danos maiores.',
    problemsWeSolve: [
      'Azulejos partidos ou fissurados',
      'Azulejos descolados (a cair)',
      'Rejunte escuro e difícil de limpar',
      'Casa de banho ou cozinha a precisar de renovação',
      'Pavimento exterior com ladrilhos partidos',
      'Infiltrações através de juntas danificadas',
    ],
    faqs: [
      { question: 'Quanto custa colocar azulejos por m²?', answer: 'O custo de colocação de azulejos (só mão de obra) varia entre 15€ e 35€ por m², dependendo do formato, complexidade do padrão e tipo de azulejo. A remoção de revestimento antigo acrescenta 5€ a 10€/m². O azulejo em si varia de 10€ a 60€/m² conforme a qualidade. Pedido de orçamento gratuito.' },
      { question: 'Quanto tempo demora a azulejar uma casa de banho?', answer: 'Uma casa de banho pequena a média (5 a 10 m²) demora entre 3 e 5 dias para paredes e pavimento completos, incluindo o tempo de cura da cola e do rejunte. Casas de banho maiores ou com azulejos especiais (grandes formatos, mármore) podem demorar 1 a 2 semanas.' },
      { question: 'Que azulejo escolher para o exterior?', answer: 'Para terraços e varandas use sempre azulejos com classe R10 ou superior (antiderrapante) e adequados a uso exterior (resistentes ao gelo se necessário). Os grês porcelânico (porcelain stoneware) são a melhor opção: muito resistentes, impermeáveis e disponíveis em grandes formatos que imitam madeira ou pedra natural.' },
      { question: 'Posso colocar azulejos novos por cima dos antigos?', answer: 'Em alguns casos sim, se o revestimento antigo estiver firme, nivelado e em boas condições. No entanto, aumenta a espessura da parede/pavimento e pode causar problemas com portas e rodapés. O nosso azulejador avalia sempre no local e recomenda a melhor opção para o seu caso.' },
    ],
    urgency: {
      metaTitle: 'Azulejador Urgente em {city} — Reparação de Azulejos | VITFIX',
      metaDesc: 'Azulejos partidos ou a cair em {city}? Infiltração por juntas danificadas? Reparação urgente de azulejos e ladrilhos. Profissionais verificados.',
      heroTitle: 'Azulejador Urgente em {city}',
      heroSubtitle: 'Azulejos descolados com risco de queda? Infiltração ativa por juntas partidas? Os nossos azulejadores intervêm rapidamente em {city}.',
      immediateSteps: [
        'Se um azulejo da parede estiver a ceder, sinalize a área com fita',
        'Não puxe os azulejos soltos — podem partir e criar cacos perigosos',
        'Se houver infiltração, coloque proteção no pavimento abaixo',
        'Documente os danos com fotos',
        'Evite utilizar a zona afetada até à reparação',
        'Contacte a VITFIX para avaliação e reparação urgente em {city}',
      ],
      whenToCall: [
        'Azulejos de parede ou pavimento a cair',
        'Infiltração ativa através de juntas partidas',
        'Azulejo partido em zona de passagem (risco de corte)',
        'Terraço com ladrilhos soltos (risco de queda)',
        'Base de duche fissurada com fuga de água',
        'Reparação urgente antes de venda ou arrendamento',
      ],
      avgResponseTime: '24 a 48 horas',
      availableSchedule: 'Segunda a sábado, avaliação no próprio dia',
    },
  },
  {
    slug: 'pedreiro',
    name: 'Pedreiro e Alvenaria',
    icon: '🧱',
    metaTitle: 'Pedreiro em {city} — Obras de Alvenaria e Construção | VITFIX',
    metaDesc: 'Pedreiro em {city}. Construção de muros, paredes, reparação de fachadas, betonagem, demolições interiores. Profissionais verificados. Orçamento grátis.',
    heroTitle: 'Pedreiro em {city}',
    heroSubtitle: 'Obras de alvenaria e construção em {city}. Muros, paredes, fachadas, betonagem — trabalho sólido, materiais de qualidade, profissionais experientes.',
    features: [
      'Construção e reparação de muros e paredes',
      'Reboco e estuque de paredes',
      'Reparação de fachadas exteriores',
      'Demolição interior e remoção de entulho',
      'Betonagem de pavimentos e lajes',
      'Construção de degraus e escadas',
      'Reparação de fissuras estruturais',
      'Trabalhos de betão armado',
    ],
    urgencyText: 'Fissuras na parede? Muro ameaçando cair? Intervimos com urgência para garantir a segurança da sua propriedade.',
    problemsWeSolve: [
      'Fissuras nas paredes ou fachada',
      'Muro com risco de colapso',
      'Rebocos a cair ou com bolhas',
      'Humidade estrutural nas paredes',
      'Necessidade de demolição de parede interior',
      'Pavimento danificado que precisa de betonagem',
    ],
    faqs: [
      { question: 'Quanto custa reparar uma fissura na parede?', answer: 'Uma fissura simples (superficial, sem causa estrutural) custa entre 80€ e 200€ para reparar, incluindo fechamento, rede de fibra de vidro e reboco. Fissuras estruturais requerem diagnóstico prévio (150€ a 300€) e o custo de reparação varia muito conforme a causa. A VITFIX oferece orçamento gratuito com avaliação no local.' },
      { question: 'Posso abrir uma parede sem licença?', answer: 'A abertura de paredes não estruturais (divisórias) em obras de remodelação interior normalmente não requer licença. A demolição de paredes estruturais requer sempre projeto de engenharia e licença camarária. A remoção de paredes exteriores também requer licença. O nosso pedreiro orienta-o sobre os requisitos legais antes de avançar.' },
      { question: 'Como sei se uma fissura é estrutural?', answer: 'Fissuras superficiais são geralmente em zig-zag ou diagonais de 45° nas paredes de reboco, sem profundidade. Fissuras estruturais são verticais ou diagonais extensas, atravessam a parede de lado a lado, aumentam de tamanho ao longo do tempo, ou estão acompanhadas de outros sinais como portas que emperram ou pavimentos a ceder. Em caso de dúvida, chame um profissional.' },
      { question: 'Quanto custa rebocar uma parede?', answer: 'O reboco de uma parede custa entre 12€ e 25€ por m², incluindo preparação e aplicação de argamassa. Para uma divisão completa (40 m² de parede), o custo situa-se entre 500€ e 1 000€. Revestimentos decorativos (estanhado, marmorite) têm custos superiores, entre 20€ e 40€/m².' },
    ],
    urgency: {
      metaTitle: 'Pedreiro Urgente em {city} — Reparação Estrutural Rápida | VITFIX',
      metaDesc: 'Pedreiro urgente em {city}: muro com risco de colapso, fissura estrutural, rebocos a cair. Intervenção rápida para garantir a segurança da sua propriedade.',
      heroTitle: 'Pedreiro Urgente em {city}',
      heroSubtitle: 'Muro em risco de colapso? Fissura estrutural preocupante? Rebocos a cair de fachada? Os nossos pedreiros intervêm com urgência em {city}.',
      immediateSteps: [
        'Se o muro ameaça cair, afaste pessoas e veículos da zona de risco',
        'Sinalize a área com fita de segurança',
        'Não tente reparar estruturas em risco sem equipamento adequado',
        'Se a fachada está a cair sobre a via pública, contacte a Câmara Municipal',
        'Documente os danos com fotos antes de qualquer intervenção',
        'Ligue para a VITFIX para avaliação de urgência em {city}',
      ],
      whenToCall: [
        'Muro com risco imediato de colapso',
        'Fissura estrutural nova e a crescer rapidamente',
        'Rebocos de fachada a cair sobre área pública',
        'Parede interior a abrir (separação visível)',
        'Danos estruturais após sismo ou inundação',
        'Betonagem urgente para estabilizar terreno',
      ],
      avgResponseTime: '24 a 48 horas',
      availableSchedule: 'Segunda a sábado, avaliação urgente no próprio dia',
    },
  },
  {
    slug: 'ar-condicionado',
    name: 'Ar Condicionado',
    icon: '❄️',
    metaTitle: 'Ar Condicionado em {city} — Instalação e Manutenção | VITFIX',
    metaDesc: 'Instalação e manutenção de ar condicionado em {city}. Split, multi-split, bomba de calor. Técnicos certificados. Orçamento grátis. Serviço 7 dias.',
    heroTitle: 'Ar Condicionado em {city}',
    heroSubtitle: 'Instalação, manutenção e reparação de sistemas de ar condicionado em {city}. Split, multi-split e bomba de calor. Técnicos certificados F-Gás.',
    features: [
      'Instalação de ar condicionado split e multi-split',
      'Instalação de bomba de calor ar-ar e ar-água',
      'Manutenção anual preventiva',
      'Reparação de avarias de ar condicionado',
      'Limpeza e desinfeção de unidades interiores',
      'Carga de gás refrigerante (F-Gás)',
      'Instalação de climatização em escritórios',
      'Substituição de equipamentos antigos',
    ],
    urgencyText: 'Ar condicionado avariado no verão? Aquecimento que não funciona no inverno? Técnico disponível rapidamente em {city}.',
    problemsWeSolve: [
      'Ar condicionado que não arrefece ou não aquece',
      'Unidade interior a verter água',
      'Ar condicionado com barulho estranho',
      'Equipamento que não liga ou desliga sozinho',
      'Cheiro a queimado ou a mofo no ar condicionado',
      'Filtros entupidos e perda de eficiência',
    ],
    faqs: [
      { question: 'Quanto custa instalar ar condicionado?', answer: 'Um split mono de 9000 BTU (adequado para uma divisão até 25m²) custa entre 600€ e 1 200€ instalado, incluindo equipamento e mão de obra. Multi-splits para 2-3 divisões situam-se entre 1 500€ e 3 000€. A bomba de calor ar-água (aquecimento central) pode custar entre 4 000€ e 10 000€ instalada. Orçamento gratuito para qualquer configuração.' },
      { question: 'Com que frequência fazer manutenção ao ar condicionado?', answer: 'A manutenção anual é essencial para garantir o bom funcionamento, eficiência energética e qualidade do ar. Inclui limpeza dos filtros e evaporador, verificação do gás refrigerante, controlo elétrico e limpeza do condensador exterior. Um equipamento bem mantido tem uma vida útil de 15 a 20 anos e consome 20 a 30% menos energia.' },
      { question: 'O ar condicionado pode ser usado para aquecer?', answer: 'Sim, os ar condicionados modernos tipo bomba de calor (inverter) funcionam tanto em modo frio como em modo calor, com eficiências (COP) de 3 a 5 — ou seja, produzem 3 a 5 vezes mais energia do que consomem. São muito mais eficientes que radiadores elétricos e mais práticos que sistemas de gás para o aquecimento de divisões individuais.' },
      { question: 'Quais as marcas de ar condicionado mais fiáveis?', answer: 'As marcas com melhor relação qualidade-preço são Daikin, Mitsubishi Electric, Fujitsu e Panasonic. Para uma gama mais económica, LG e Samsung oferecem bom desempenho. O nosso técnico é certificado para instalar e reparar todas as principais marcas. Recomendamos sempre equipamentos com inverter e classe energética A++.' },
    ],
    urgency: {
      metaTitle: 'Ar Condicionado Urgente em {city} — Reparação Rápida | VITFIX',
      metaDesc: 'Ar condicionado avariado em {city}? Verão com calor intenso, inverno sem aquecimento? Técnico F-Gás disponível rapidamente para reparação urgente.',
      heroTitle: 'Ar Condicionado Urgente em {city}',
      heroSubtitle: 'Ar condicionado avariado no pico do verão ou do inverno em {city}? Os nossos técnicos certificados F-Gás intervêm rapidamente para repor o conforto.',
      immediateSteps: [
        'Desligue o equipamento do quadro elétrico se houver cheiro a queimado',
        'Se houver fuga de água, coloque um balde para recolher o líquido',
        'Verifique se o filtro não está completamente entupido (pode resolver o problema)',
        'Verifique se o termostato está na temperatura correta',
        'Reinicie o equipamento após 5 minutos desligado (pode resolver erros simples)',
        'Se nada resultar, contacte a VITFIX para intervenção urgente em {city}',
      ],
      whenToCall: [
        'Ar condicionado não arrefece em dia de calor extremo',
        'Aquecimento que não funciona em dia de frio intenso',
        'Fuga de água do equipamento interior',
        'Cheiro a queimado ou fumo no equipamento',
        'Barulho anormal (ranger, vibração excessiva)',
        'Equipamento que desliga sozinho em loop',
      ],
      avgResponseTime: '24 a 48 horas',
      availableSchedule: 'Segunda a sábado, urgências no próprio dia',
    },
  },
  {
    slug: 'pedreiro',
    name: 'Pedreiro',
    icon: '🧱',
    metaTitle: 'Pedreiro em {city} — Construção de Muros, Alvenaria, Reparação de Paredes | VITFIX',
    metaDesc: 'Pedreiro profissional em {city}. Muros, alvenaria, reparação de paredes, fundações. Profissionais verificados, orçamento grátis. Vitfix.io',
    heroTitle: 'Pedreiro em {city}',
    heroSubtitle: 'Pedreiro profissional para construção de muros, alvenaria, reparação de paredes e fundações. Profissionais de confiança verificados.',
    features: [
      'Construção de muros e vedações',
      'Reparação de paredes e estruturas',
      'Alvenaria estrutural em edifícios',
      'Fundações e reforço',
      'Chaminés e coberturas',
      'Escadas em granito ou pedra',
      'Rebocos e acabamentos',
      'Trabalhos em edifícios históricos',
    ],
    urgencyText: 'Tem uma parede rachada ou muro para construir? Contacte-nos para reparação ou construção profissional com garantia.',
    problemsWeSolve: [
      'Parede rachada ou com infiltração',
      'Muro danificado ou que precisa construção',
      'Alvenaria que precisa reforço',
      'Fundações fracas ou instáveis',
      'Reboco degradado que precisa renovação',
      'Estruturas em edifícios históricos',
    ],
    faqs: [
      { question: 'Qual é a diferença entre um pedreiro e um empreiteiro?', answer: 'Um pedreiro especializa-se em alvenaria (muros, paredes, estruturas em pedra/tijolo). Um empreiteiro gere obras inteiras (pode contratar pedreiros, eletricistas, etc.). Se precisa apenas alvenaria, um pedreiro é mais barato e rápido.' },
      { question: 'Quanto custa um pedreiro em média?', answer: 'Reparação simples de parede: €150-250. Construção de muro (por metro): €250-400. Alvenaria completa (m²): €350-500. Escadas em granito: €2.000-3.500. Fundação/reforço: €600-1.200. Preços variam conforme complexidade e materiais.' },
      { question: 'Quanto tempo demora reparação de uma parede?', answer: 'Parede simples: 1-2 dias. Parede com infiltração que precisa diagnóstico: 2-3 dias. Depende da extensão. Para estruturas mais complexas, pode demorar mais.' },
      { question: 'Preciso de projeto arquitetónico antes de contratar um pedreiro?', answer: 'Para reparações menores, não. Para construção nova ou alvenaria estrutural, recomenda-se projeto de técnico ou arquiteto que guie o trabalho.' },
      { question: 'Como sei se uma parede precisa reparação urgente?', answer: 'Sinais: rachas em V (indicam movimento estrutural), infiltrações visíveis, reboco que descasca, paredes inclinadas. Se vê isto, contacta um pedreiro rapidamente.' },
    ],
    urgency: {
      metaTitle: 'Pedreiro Urgente em {city} — Reparação Rápida | VITFIX',
      metaDesc: 'Parede rachada ou muro danificado em {city}? Pedreiro urgente para reparação. Profissional verificado, resposta rápida. Vitfix.io',
      heroTitle: 'Pedreiro Urgente em {city}',
      heroSubtitle: 'Parede rachada? Muro a ceder? Os nossos pedreiros intervêm rapidamente em {city} para reparar estruturas e evitar danos maiores.',
      immediateSteps: [
        'Não toque numa parede que está a ceder visualmente',
        'Documente os danos com fotos',
        'Afaste-se de áreas com risco de colapso',
        'Se é uma parede de suporte e está danificada, é uma emergência estrutural',
        'Ventile bem se há mofo ou humidade associada',
        'Contacte a VITFIX para diagnóstico imediato',
      ],
      whenToCall: [
        'Parede com rachas em V (indicam movimento)',
        'Infiltrações que afetam a parede',
        'Reboco a descascar em grandes áreas',
        'Parede que está inclinada ou a ceder',
        'Fundação com sinais de colapso',
        'Chaminé ou estrutura em edifício histórico danificada',
      ],
      avgResponseTime: '24 a 48 horas',
      availableSchedule: 'Segunda a sábado, diagnóstico no próprio dia',
    },
  },
]

// ============================================================
// Generate all page combinations (slug format: service-city)
// ============================================================

export interface PageCombo {
  slug: string
  service: ServiceData
  city: CityData
  nearbyCities: CityData[]
}

export function getAllPageCombos(): PageCombo[] {
  return SERVICES.flatMap(service =>
    CITIES.map(city => ({
      slug: `${service.slug}-${city.slug}`,
      service,
      city,
      nearbyCities: city.nearby
        .map(ns => CITIES.find(c => c.slug === ns))
        .filter((c): c is CityData => !!c),
    }))
  )
}

export function getPageCombo(slug: string): PageCombo | undefined {
  return getAllPageCombos().find(p => p.slug === slug)
}

// ============================================================
// Urgency page combos (same structure, different slug pattern)
// URL: /pt/urgencia/canalizador-urgente-marco-de-canaveses/
// ============================================================

export function getAllUrgencyCombos(): PageCombo[] {
  return SERVICES.flatMap(service =>
    CITIES.map(city => ({
      slug: `${service.slug}-urgente-${city.slug}`,
      service,
      city,
      nearbyCities: city.nearby
        .map(ns => CITIES.find(c => c.slug === ns))
        .filter((c): c is CityData => !!c),
    }))
  )
}

export function getUrgencyCombo(slug: string): PageCombo | undefined {
  return getAllUrgencyCombos().find(p => p.slug === slug)
}

// ============================================================
// BLOG ARTICLES — Problem-based content for SEO
// ============================================================

export const BLOG_ARTICLES: BlogArticle[] = [
  {
    slug: 'curto-circuito-o-que-fazer',
    title: 'Curto-Circuito em Casa — O Que Fazer?',
    metaTitle: 'Curto-Circuito em Casa: O Que Fazer e Como Resolver | VITFIX',
    metaDesc: 'O que fazer quando há um curto-circuito em casa? Saiba como agir em segurança, identificar a causa e quando chamar um eletricista profissional.',
    category: 'eletricidade',
    icon: '⚡',
    datePublished: '2025-11-15',
    intro: 'Um curto-circuito é uma das avarias elétricas mais comuns e potencialmente perigosas em casa. Pode causar o disparo dos disjuntores, deixar divisões sem eletricidade, ou até provocar um incêndio. Saiba como reagir de forma segura, identificar as causas e prevenir futuros incidentes.',
    sections: [
      {
        heading: 'O que é um curto-circuito?',
        content: 'Um curto-circuito ocorre quando a corrente elétrica segue um caminho não previsto, geralmente devido a um contacto direto entre dois condutores (fase e neutro) ou por um isolamento danificado. Isto provoca um pico súbito de corrente — podendo atingir centenas de amperes em milissegundos — que faz disparar as proteções do quadro elétrico. Em instalações sem proteções adequadas, este pico pode gerar calor suficiente para derreter condutores e iniciar um incêndio. É por isso que um quadro elétrico moderno e bem dimensionado é essencial para a segurança de qualquer habitação.',
      },
      {
        heading: 'Tipos de curto-circuito',
        content: 'Existem vários tipos de curto-circuito. O curto-circuito franco ocorre quando dois condutores entram em contacto direto, provocando um disparo imediato do disjuntor — é o mais fácil de detetar. O curto-circuito intermitente acontece quando o contacto entre condutores é esporádico, por exemplo devido a um cabo mal fixado que se move com vibrações ou vento. Este tipo é mais difícil de diagnosticar porque o problema aparece e desaparece. O curto-circuito por defeito de isolamento ocorre quando o isolamento dos cabos se deteriora com o tempo, a humidade ou o calor, permitindo fugas de corrente para a terra. Neste caso, é o diferencial (e não o disjuntor) que dispara.',
      },
      {
        heading: 'O que fazer imediatamente?',
        content: 'Primeiro, mantenha a calma. Se o disjuntor geral disparou, não tente religá-lo de imediato. Siga estes passos: desligue todos os aparelhos elétricos das tomadas e apague todos os interruptores. Verifique se há algum cheiro a queimado, fumo, ou marcas escuras em tomadas ou interruptores. Se tudo parecer normal, tente religar o disjuntor geral. Se o disjuntor se mantiver ligado, ligue os circuitos um a um para identificar qual está com problema. Se voltar a disparar imediatamente ao religar, o problema está na instalação fixa e precisa de um eletricista profissional. Nunca tente contornar ou bloquear um disjuntor que dispara — ele está a proteger a sua casa de um perigo real.',
      },
      {
        heading: 'Causas mais comuns em casas portuguesas',
        content: 'As causas mais frequentes de curto-circuito incluem cabos elétricos danificados ou envelhecidos, que é particularmente comum em casas com mais de 30 anos no Norte de Portugal onde muitas instalações nunca foram atualizadas. Aparelhos eletrodomésticos defeituosos, especialmente máquinas de lavar, esquentadores elétricos e aquecedores, são outra causa frequente. Tomadas ou interruptores danificados pela humidade, um problema recorrente na região do Tâmega e Sousa devido ao clima húmido, também provocam curto-circuitos. Infiltrações de água que atingem a instalação elétrica são particularmente perigosas. A sobrecarga de circuitos, quando se ligam demasiados aparelhos de alta potência num mesmo circuito, pode danificar os condutores ao longo do tempo. Extensões e multiconnectores em cascata são uma causa frequente mas evitável.',
      },
      {
        heading: 'Perigos de um curto-circuito não resolvido',
        content: 'Ignorar um curto-circuito, mesmo que intermitente, pode ter consequências graves. O risco mais sério é o incêndio elétrico — segundo dados dos bombeiros portugueses, os incêndios de origem elétrica representam uma parte significativa dos incêndios domésticos. Um curto-circuito repetido pode danificar progressivamente a cablagem dentro das paredes, tornando a reparação mais complexa e dispendiosa. Há também risco de eletrocussão se o diferencial não atuar corretamente, especialmente em instalações antigas sem ligação à terra. Os aparelhos eletrodomésticos ligados durante um curto-circuito podem sofrer danos permanentes nos seus componentes eletrónicos.',
      },
      {
        heading: 'Quanto custa reparar um curto-circuito?',
        content: 'O custo de reparação depende da causa e da complexidade. Um diagnóstico elétrico profissional custa entre 40€ e 80€. Substituir uma tomada ou interruptor danificado custa entre 30€ e 60€ por unidade, incluindo material e mão de obra. Reparar ou substituir um troço de cablagem danificada pode custar entre 100€ e 300€, dependendo do comprimento e da acessibilidade. Se o problema exige substituição do quadro elétrico, o custo pode atingir 300€ a 600€ para um quadro moderno com todas as proteções. Na VITFIX, o orçamento é sempre gratuito e sem compromisso.',
      },
      {
        heading: 'Prevenção: como evitar curto-circuitos',
        content: 'A melhor forma de prevenir curto-circuitos é manter a instalação elétrica em bom estado. Faça uma inspeção profissional a cada 10 anos, ou sempre que fizer obras. Evite utilizar extensões e adaptadores múltiplos em permanência — se precisa de mais tomadas, peça a instalação de novas. Não ligue aparelhos de alta potência (aquecedores, máquinas de lavar) em multiconnectores. Substitua imediatamente qualquer tomada ou interruptor que apresente sinais de deterioração, como descoloração, aquecimento ou faíscas. Em zonas húmidas como casas de banho e cozinhas, certifique-se de que as tomadas são do tipo adequado com proteção contra salpicos.',
      },
      {
        heading: 'Quando chamar um eletricista?',
        content: 'Deve chamar um eletricista profissional se o disjuntor continua a disparar depois de desligar todos os aparelhos, se sente cheiro a queimado perto de tomadas, interruptores ou do quadro elétrico, se vê marcas de queimadura ou descoloração em qualquer componente elétrico, se ouve zumbidos ou estalidos vindos do quadro elétrico, se nota que tomadas ou interruptores aquecem anormalmente, ou se a sua instalação tem mais de 20 anos sem ter sido revista por um profissional. Não tente fazer reparações elétricas sozinho — o risco de eletrocussão é real e as reparações mal feitas podem criar problemas mais graves.',
      },
    ],
    ctaText: 'Tem um curto-circuito em casa? Contacte um eletricista VITFIX para uma intervenção segura e rápida.',
    relatedServices: ['eletricista'],
    searchVolume: '50-100/mois, en hausse',
  },
  {
    slug: 'quadro-eletrico-problemas-solucoes',
    title: 'Quadro Elétrico: Problemas Comuns e Soluções',
    metaTitle: 'Quadro Elétrico: Problemas Comuns e Como Resolver | VITFIX',
    metaDesc: 'O seu quadro elétrico tem problemas? Disjuntor que dispara, fusíveis queimados, quadro antigo? Saiba como identificar e resolver cada situação.',
    category: 'eletricidade',
    icon: '🔌',
    datePublished: '2025-11-20',
    intro: 'O quadro elétrico é o coração da instalação elétrica da sua casa. Quando há um problema no quadro, toda a casa é afetada. Saiba identificar os sinais de alerta, entender cada componente e quando é necessário intervir para garantir a segurança da sua família.',
    sections: [
      {
        heading: 'O que é o quadro elétrico e para que serve?',
        content: 'O quadro elétrico é o ponto central que recebe a eletricidade da rede pública e a distribui pelos diferentes circuitos da casa — iluminação, tomadas, cozinha, casa de banho, etc. Contém dispositivos de proteção que cortam automaticamente a corrente em caso de anomalia, protegendo as pessoas contra choques elétricos e os equipamentos contra sobrecargas. Um quadro bem dimensionado e atualizado é fundamental para a segurança elétrica de qualquer habitação. Em Portugal, as normas elétricas (RTIEBT — Regras Técnicas de Instalações Elétricas de Baixa Tensão) definem os requisitos mínimos que cada quadro deve cumprir.',
      },
      {
        heading: 'Componentes do quadro elétrico',
        content: 'Um quadro elétrico moderno contém vários componentes essenciais. O disjuntor geral (ou interruptor de corte geral) permite desligar toda a instalação de uma só vez — é o primeiro componente depois do contador. Os disjuntores individuais protegem cada circuito contra sobrecargas e curto-circuitos, desligando automaticamente quando a corrente excede o valor nominal. O diferencial (ou interruptor diferencial) deteta fugas de corrente à terra e corta a alimentação para prevenir eletrocussões — é obrigatório em todas as instalações em Portugal. Os barramentos de ligação distribuem a corrente do disjuntor geral para os vários circuitos. Pode ainda incluir descarregadores de sobretensão para proteger contra raios, e relés de controlo para sistemas específicos.',
      },
      {
        heading: 'Sinais de alerta no quadro elétrico',
        content: 'Esteja atento a estes sinais que indicam problemas no seu quadro elétrico. Disjuntores que disparam frequentemente sem causa aparente podem indicar sobrecarga, curto-circuito ou defeito de isolamento. Zumbidos, estalidos ou ruídos contínuos vindos do quadro são sinal de ligações soltas ou componentes defeituosos. Cheiro a queimado é um sinal grave que exige ação imediata — desligue o disjuntor geral e chame um eletricista. Descoloração, marcas escuras ou deformação de componentes indicam sobreaquecimento passado ou presente. Aquecimento excessivo do quadro ou de disjuntores individuais ao toque é sinal de sobrecarga ou mau contacto. Se notar qualquer destes sinais, não os ignore — podem evoluir para situações perigosas.',
      },
      {
        heading: 'Disjuntor que dispara: o que fazer',
        content: 'Se um disjuntor específico dispara repetidamente, o problema está geralmente no circuito que ele protege, não no próprio disjuntor. Comece por desligar todos os aparelhos ligados a esse circuito. Religue o disjuntor. Se se mantiver ligado, ligue os aparelhos um a um para identificar qual está a causar o problema. Se o disjuntor dispara mesmo sem aparelhos ligados, há provavelmente um defeito de isolamento na cablagem dentro das paredes — esta situação exige intervenção profissional. Se é o diferencial que dispara (e não um disjuntor individual), a fuga de corrente pode ser mais perigosa e deve ser diagnosticada com urgência, pois pode representar risco de eletrocussão.',
      },
      {
        heading: 'Diferença entre disjuntor e diferencial',
        content: 'É importante distinguir estes dois dispositivos porque protegem contra riscos diferentes. O disjuntor protege a instalação contra sobrecargas e curto-circuitos — quando a corrente excede o limite, ele desliga. Protege os cabos e equipamentos, não as pessoas diretamente. O diferencial compara a corrente que entra num circuito com a que sai. Se houver uma diferença (fuga de corrente à terra, por exemplo através do corpo de uma pessoa), desliga em milissegundos. O diferencial de 30mA é o que protege efetivamente as pessoas contra eletrocussão. Ambos são obrigatórios e complementares — um não substitui o outro. Se o seu quadro não tem diferencial, a atualização é urgente.',
      },
      {
        heading: 'Quadro elétrico antigo: quando substituir?',
        content: 'Se o seu quadro ainda tem fusíveis em vez de disjuntores, a substituição é fortemente recomendada. Os fusíveis oferecem proteção limitada e não podem ser reutilizados após atuarem. Se a casa tem mais de 30 anos e o quadro nunca foi atualizado, provavelmente não cumpre as normas atuais de segurança. Os quadros modernos oferecem proteções muito mais eficazes, incluindo disjuntores diferenciais de alta sensibilidade que protegem contra choques elétricos, descarregadores de sobretensão que protegem os seus equipamentos eletrónicos contra picos de tensão, e disjuntores dimensionados para as necessidades reais de cada circuito. O custo de substituição de um quadro completo situa-se entre 300€ e 600€, um investimento modesto considerando que protege a sua casa e família durante as próximas décadas.',
      },
      {
        heading: 'Potência contratada: está adequada?',
        content: 'Muitas casas no distrito do Porto ainda têm potências contratadas de 3.45 kVA ou 6.9 kVA, que eram suficientes há 30 anos mas hoje podem ser insuficientes. Com a multiplicação de aparelhos elétricos — máquinas de lavar roupa e louça, forno, micro-ondas, aquecedor, ar condicionado — é comum exceder a potência contratada, causando o disparo do disjuntor geral. Se o seu disjuntor geral dispara frequentemente quando liga vários aparelhos em simultâneo, pode ser necessário aumentar a potência contratada junto da EDP ou outro comercializador. Um eletricista pode avaliar o consumo real da sua habitação e recomendar a potência adequada.',
      },
      {
        heading: 'Manutenção preventiva do quadro',
        content: 'Recomenda-se uma verificação profissional do quadro elétrico a cada 10 anos, ou sempre que fizer obras de remodelação. Um eletricista qualificado pode apertar ligações que se soltaram com o tempo, verificar o estado dos disjuntores e diferenciais, testar o diferencial com equipamento adequado (o botão de teste no próprio diferencial deve ser pressionado mensalmente pelo proprietário), verificar se a instalação de terra está em boas condições, e identificar circuitos sobrecarregados. Esta manutenção simples pode prevenir problemas graves e dar-lhe tranquilidade sobre a segurança elétrica da sua casa.',
      },
    ],
    ctaText: 'Precisa de verificar ou substituir o seu quadro elétrico? Os eletricistas VITFIX fazem diagnóstico gratuito.',
    relatedServices: ['eletricista'],
    searchVolume: '50-100/mois, en hausse',
  },
  {
    slug: 'humidade-parede-causas-reparacao',
    title: 'Humidade na Parede: Causas e Reparação',
    metaTitle: 'Humidade na Parede: Causas, Soluções e Reparação | VITFIX',
    metaDesc: 'Manchas de humidade nas paredes? Descubra as causas (infiltração, condensação, capilaridade) e como resolver definitivamente com profissionais.',
    category: 'canalizacao',
    icon: '💧',
    datePublished: '2025-12-01',
    intro: 'A humidade nas paredes é um dos problemas mais comuns nas casas portuguesas, especialmente durante o outono e inverno no Norte do país. Além de ser antiestética, pode causar problemas sérios de saúde e danificar a estrutura do edifício. Saiba como identificar a causa, escolher a solução adequada e prevenir que o problema regresse.',
    sections: [
      {
        heading: 'Tipos de humidade nas paredes',
        content: 'Existem três tipos principais de humidade que afetam as casas. A infiltração ocorre quando a água entra do exterior por fissuras nas paredes, juntas deterioradas, ou defeitos no telhado. É mais evidente durante períodos de chuva intensa e aparece frequentemente no topo das paredes ou junto a janelas. A condensação acontece quando o vapor de água presente no ar se deposita em superfícies frias, formando gotas de água. É muito comum em casas com pouca ventilação, especialmente em casas de banho, cozinhas e quartos onde se seca roupa. A capilaridade é a absorção de água do solo pelas paredes, que sobe por efeito capilar. É frequente em rés-do-chão e caves, especialmente em construções antigas sem barreiras impermeabilizantes adequadas. Cada tipo exige um tratamento diferente, por isso o diagnóstico correto é fundamental.',
      },
      {
        heading: 'A humidade no Norte de Portugal',
        content: 'A região do Tâmega e Sousa — incluindo Marco de Canaveses, Penafiel, Amarante e Baião — é particularmente afetada por problemas de humidade devido ao seu clima. A precipitação anual na região ultrapassa frequentemente os 1200mm, concentrada entre outubro e março. Muitas casas foram construídas nas décadas de 1960-1980 sem isolamento térmico adequado nem barreiras contra humidade, tornando-as vulneráveis a condensação e infiltrações. As casas em granito, tradicionais da região, são particularmente suscetíveis a capilaridade. Além disso, a proximidade dos rios Tâmega e Douro aumenta os níveis de humidade ambiente em muitas freguesias. Tratar a humidade nestas casas exige frequentemente uma combinação de soluções — não basta pintar por cima.',
      },
      {
        heading: 'Como identificar a causa da humidade',
        content: 'O diagnóstico correto é essencial para evitar gastar dinheiro em soluções que não resolvem o problema. Observe a localização das manchas: manchas no topo das paredes ou junto ao teto sugerem infiltração pelo telhado ou terraço. Manchas na base das paredes, que sobem de forma uniforme, indicam capilaridade ascendente. Manchas dispersas com bolor, especialmente em cantos e atrás de móveis, sugerem condensação. Manchas junto a janelas ou marcos de portas indicam infiltração por deficiente vedação. Um profissional pode complementar a observação visual com equipamento especializado como higrómetros de profundidade, câmaras termográficas e testes de pressão para determinar a causa exata.',
      },
      {
        heading: 'Consequências para a saúde',
        content: 'A humidade prolongada nas paredes não é apenas um problema estético — pode ter consequências sérias para a saúde. O bolor que se desenvolve em ambientes húmidos liberta esporos microscópicos que são inalados pelos ocupantes da casa. Estes esporos podem causar ou agravar problemas respiratórios como asma, bronquite, rinite alérgica e sinusite. Crianças, idosos e pessoas com sistemas imunitários comprometidos são particularmente vulneráveis. A exposição prolongada ao bolor está associada a infeções respiratórias recorrentes e pode contribuir para o desenvolvimento de alergias. Além dos esporos, a humidade elevada favorece a proliferação de ácaros, outro alérgeno comum. Por estas razões, tratar problemas de humidade deve ser considerado uma prioridade de saúde, não apenas uma questão estética.',
      },
      {
        heading: 'Soluções para infiltrações',
        content: 'O tratamento de infiltrações exige identificar e reparar o ponto de entrada da água. Para infiltrações pelo telhado, é necessário verificar e substituir telhas partidas ou deslocadas, reparar rufos e caleiras, e aplicar impermeabilização. Para infiltrações pelas paredes exteriores, as soluções incluem reparação de fissuras com argamassas flexíveis, aplicação de revestimentos hidrófugos que repelem a água sem impedir a parede de respirar, e em casos mais graves, aplicação de sistemas de impermeabilização por membrana. Para infiltrações em janelas, a substituição das vedações (silicone ou borracha) é geralmente suficiente. Em casos de infiltrações persistentes, pode ser necessário rever toda a fachada.',
      },
      {
        heading: 'Soluções para condensação e capilaridade',
        content: 'Para resolver problemas de condensação, a chave é melhorar a ventilação e o isolamento térmico. Instalar extratores em casas de banho e cozinhas, criar grelhas de ventilação em janelas, e manter uma ventilação regular da casa são medidas essenciais. O isolamento térmico das paredes pelo exterior (sistema ETICS/capoto) elimina as pontes térmicas que provocam condensação. Para a capilaridade, as soluções são mais especializadas. A injeção de resinas hidrófugas na base das paredes cria uma barreira química que impede a água de subir — é o método mais eficaz e menos invasivo. Em alternativa, podem ser aplicadas membranas impermeabilizantes no exterior das fundações, embora isto exija escavação. Em caves, sistemas de drenagem periférica e bombas de água podem ser necessários.',
      },
      {
        heading: 'Reparação das paredes danificadas',
        content: 'Após resolver a causa da humidade, é essencial tratar as paredes afetadas corretamente para evitar que o problema volte a manifestar-se. O processo inclui várias etapas: remoção completa do reboco danificado até encontrar material são, limpeza e tratamento anti-fúngico da parede para eliminar esporos de bolor, aplicação de primário bloqueador de sais (para paredes afetadas por capilaridade), reboco novo com argamassa adequada (resistente à humidade em zonas de risco), e finalmente pintura com tinta anti-mofo de qualidade profissional. Pintar diretamente sobre paredes com humidade, sem tratar a causa nem preparar a superfície, é o erro mais comum — as manchas reaparecem em poucas semanas ou meses.',
      },
      {
        heading: 'Custos de tratamento da humidade',
        content: 'Os custos variam conforme o tipo e a extensão do problema. Tratamento de condensação (ventilação, extratores): entre 200€ e 800€. Reparação de infiltrações pontuais (fissuras, vedações): entre 150€ e 500€. Impermeabilização de fachada completa: entre 15€ e 30€ por m². Injeção contra capilaridade: entre 50€ e 100€ por metro linear. Reparação e pintura de paredes danificadas: entre 15€ e 25€ por m². Isolamento térmico pelo exterior (capoto): entre 40€ e 80€ por m². Na VITFIX, fazemos diagnóstico gratuito e apresentamos orçamento detalhado com as diferentes opções de tratamento, para que possa tomar uma decisão informada.',
      },
    ],
    ctaText: 'Problemas de humidade em casa? Os profissionais VITFIX fazem diagnóstico e reparação completa.',
    relatedServices: ['canalizador', 'pintor'],
    searchVolume: '40-75/mois, forte hausse',
  },
  {
    slug: 'esquentador-nao-liga-diagnostico',
    title: 'Esquentador Não Liga — Diagnóstico e Reparação',
    metaTitle: 'Esquentador Não Liga: Causas e Como Resolver | VITFIX',
    metaDesc: 'O seu esquentador não liga ou não aquece água? Saiba as causas mais comuns e quando chamar um técnico. Reparação rápida na zona de Marco de Canaveses.',
    category: 'canalizacao',
    icon: '🔥',
    datePublished: '2025-12-10',
    intro: 'Ficar sem água quente é um dos problemas domésticos mais incómodos, especialmente durante os invernos frios do Norte de Portugal. Se o seu esquentador não liga, não aquece a água suficientemente, ou faz ruídos estranhos, este guia completo ajuda-o a identificar possíveis causas e a tomar a decisão certa entre reparar ou substituir.',
    sections: [
      {
        heading: 'Verificações básicas antes de chamar um técnico',
        content: 'Antes de chamar um técnico, faça estas verificações simples que resolvem muitos casos. Primeiro, verifique se o gás está aberto — a torneira de gás junto ao esquentador e a torneira geral devem estar ambas abertas. Confirme que a água chega ao esquentador abrindo uma torneira de água fria. Verifique se a pilha ou sistema de ignição funciona — deve ouvir o "click" de ignição quando abre uma torneira de água quente. Inspecione o tubo de exaustão para verificar se não está obstruído por ninhos de pássaros, folhas ou outros detritos. Se o esquentador tem visor de chama, verifique se a chama aparece quando abre água quente. Estas verificações são seguras e não requerem conhecimentos técnicos.',
      },
      {
        heading: 'Tipos de esquentadores em Portugal',
        content: 'Existem vários tipos de esquentadores no mercado português. O esquentador a gás (natural ou butano/propano) é o mais comum nas casas portuguesas, aquecendo a água instantaneamente quando se abre a torneira. O termoacumulador elétrico armazena água quente num reservatório isolado e é comum em apartamentos sem ligação a gás. A caldeira mural combina aquecimento central e água quente sanitária, sendo cada vez mais popular em construções novas. O esquentador ventilado tem sistema de exaustão forçada, obrigatório em determinadas situações de instalação. Cada tipo tem as suas particularidades de funcionamento e avaria, e nem todos os técnicos trabalham com todos os tipos.',
      },
      {
        heading: 'Causas comuns de avaria',
        content: 'As causas mais frequentes de um esquentador que não liga ou funciona mal incluem vários componentes. A membrana do corpo de água é uma peça de borracha que, ao desgastar-se, impede o esquentador de detetar o fluxo de água e acender. É uma das avarias mais comuns e tem reparação relativamente económica (30€ a 60€). O sensor de chama (termopar ou elétrodo de ionização) pode ficar sujo com resíduos de combustão, impedindo o esquentador de detetar que a chama está acesa e cortando o gás por segurança. A válvula de gás pode desenvolver defeitos que impedem a passagem de gás ao queimador. A calcificação interna é especialmente problemática em zonas com água dura como acontece em partes do distrito do Porto — o calcário acumula-se no permutador de calor, reduzindo a eficiência e eventualmente bloqueando o fluxo de água. Problemas no sistema de exaustão, como obstruções ou mau funcionamento do ventilador em modelos ventilados, ativam os sensores de segurança que impedem o esquentador de funcionar.',
      },
      {
        heading: 'Esquentador liga mas a água não aquece o suficiente',
        content: 'Se o esquentador liga mas a água sai morna em vez de quente, as causas mais prováveis são o acúmulo de calcário no permutador de calor, que reduz a transferência de calor para a água. Pode também indicar que o queimador está sujo ou com chama irregular, que a pressão de gás está baixa (verifique se a botija está a acabar, em caso de gás butano), ou que o regulador de temperatura do esquentador está mal ajustado. Em casas com vários pontos de água quente distantes do esquentador, a água pode perder calor no percurso pelas tubagens, especialmente se estas não estão isoladas. A instalação de isolamento nas tubagens de água quente é uma solução simples e económica.',
      },
      {
        heading: 'Manutenção preventiva',
        content: 'A manutenção regular do esquentador é essencial para garantir o seu bom funcionamento e prolongar a sua vida útil. Recomenda-se uma revisão anual, idealmente antes do início do inverno. A manutenção profissional inclui limpeza completa do queimador e remoção de resíduos de combustão, verificação e eventual substituição da membrana do corpo de água, teste de segurança do circuito de gás e deteção de fugas, limpeza de calcário do permutador de calor, verificação do sistema de exaustão, e teste do termopar e outros sensores de segurança. O custo de uma revisão anual situa-se entre 50€ e 80€ — um investimento que evita avarias dispendiosas e garante que o esquentador funciona com segurança e eficiência máxima.',
      },
      {
        heading: 'Reparar ou substituir?',
        content: 'A decisão entre reparar ou substituir depende de vários fatores. Se o esquentador tem menos de 8 anos e a avaria é pontual, a reparação é geralmente a melhor opção. Se tem mais de 10-12 anos e precisa de reparações frequentes (duas ou mais por ano), é provavelmente mais económico substituí-lo. Os esquentadores modernos são significativamente mais eficientes — um modelo novo de classe A pode reduzir o consumo de gás em 20-30% face a um modelo antigo, o que representa uma poupança considerável ao longo dos anos. Além disso, os modelos novos têm sistemas de segurança mais avançados, incluindo corte automático por falta de chama, proteção contra congelamento e controlo eletrónico de temperatura. Um esquentador novo de boa qualidade custa entre 250€ e 500€, mais 100€ a 150€ de instalação.',
      },
      {
        heading: 'Segurança: quando há perigo real',
        content: 'Algumas situações relacionadas com o esquentador exigem ação imediata. Se sentir cheiro a gás, feche imediatamente a torneira de gás, abra janelas para ventilar, não acenda qualquer tipo de chama ou interruptor elétrico, saia de casa e ligue para o 112. Se notar manchas pretas ou fuligem à volta do esquentador, pode indicar uma combustão incompleta com produção de monóxido de carbono — um gás inodoro e potencialmente mortal. Se o esquentador está instalado numa divisão sem ventilação adequada, o risco de intoxicação por monóxido de carbono é real. Em Portugal, é obrigatório que os esquentadores a gás sejam instalados em locais ventilados ou sejam do tipo estanque com exaustão forçada. Se o seu esquentador não cumpre estas condições, consulte um profissional urgentemente.',
      },
      {
        heading: 'Custos de reparação de referência',
        content: 'Para que possa ter uma ideia dos custos envolvidos, eis os preços médios praticados na região do Tâmega e Sousa. Deslocação e diagnóstico: 30€ a 50€. Substituição de membrana: 40€ a 70€ (peça + mão de obra). Limpeza de queimador e sensores: 50€ a 80€. Limpeza de calcário do permutador: 60€ a 100€. Substituição de válvula de gás: 80€ a 150€. Substituição de corpo de água completo: 100€ a 200€. Revisão anual completa: 50€ a 80€. Na VITFIX, os canalizadores apresentam sempre o orçamento antes de iniciar qualquer reparação, sem surpresas.',
      },
    ],
    ctaText: 'Esquentador avariado? Os canalizadores VITFIX fazem diagnóstico e reparação no próprio dia.',
    relatedServices: ['canalizador'],
    searchVolume: '25-75/mois, saisonnier (hiver)',
  },
  {
    slug: 'fuga-agua-como-agir',
    title: 'Fuga de Água: Como Agir Rapidamente',
    metaTitle: 'Fuga de Água em Casa: O Que Fazer de Imediato | VITFIX',
    metaDesc: 'Descobriu uma fuga de água? Saiba os passos imediatos para minimizar danos e quando chamar um canalizador de urgência. Atuamos em Marco de Canaveses e arredores.',
    category: 'canalizacao',
    icon: '🚿',
    datePublished: '2025-12-20',
    intro: 'Uma fuga de água pode causar danos significativos em poucas horas se não for tratada rapidamente. Saber como agir nos primeiros minutos pode poupar-lhe centenas ou milhares de euros em reparações. Este guia explica os passos imediatos, como identificar a origem, o que fazer com o seguro e como prevenir futuros problemas.',
    sections: [
      {
        heading: 'Ação imediata: os primeiros 5 minutos',
        content: 'Os primeiros minutos após descobrir uma fuga de água são críticos para minimizar os danos. Feche imediatamente a torneira de segurança geral — geralmente localizada junto ao contador de água, na entrada da casa ou no rés-do-chão do prédio. Se não sabe onde está, procure junto ao contador ou na cave do edifício. Se a fuga é visível, coloque baldes, bacias e toalhas para recolher e absorver a água. Desligue a eletricidade na zona afetada se houver qualquer risco de contacto entre água e instalação elétrica — isto é especialmente importante se a água está a escorrer por paredes onde existem tomadas ou interruptores. Se tem vizinhos por baixo, avise-os imediatamente para que possam proteger os seus bens. Documente os danos com fotografias e vídeos enquanto espera pelo canalizador — estas provas serão importantes para o seguro.',
      },
      {
        heading: 'Tipos de fugas de água',
        content: 'As fugas de água podem ser classificadas em vários tipos, cada um com causas e soluções diferentes. A fuga visível e ativa é a mais urgente — um cano rebentado ou uma ligação que cedeu com água a jorrar. Exige ação imediata e canalizador de urgência. A fuga lenta e contínua, como uma torneira que pinga ou um autoclismo que corre, pode parecer insignificante mas ao longo de um ano pode desperdiçar milhares de litros de água e causar danos cumulativos. A fuga oculta ocorre dentro de paredes, sob pavimentos ou em canalizações enterradas. É a mais difícil de detetar e frequentemente só se manifesta quando os danos já são significativos. A fuga por condensação não é tecnicamente uma fuga de canalização, mas a água que se acumula em tubagens frias pode causar os mesmos danos — manchar paredes, estragar pavimentos e criar condições para o bolor.',
      },
      {
        heading: 'Identificar a origem da fuga',
        content: 'Encontrar a origem exata da fuga é essencial para uma reparação eficaz. Comece pelas zonas mais comuns: ligações de torneiras (por baixo de lavatórios e lava-loiças), autoclismos (a ligação de entrada de água e o mecanismo interior), mangueiras de máquinas de lavar roupa e louça, esquentador ou caldeira (ligações de água e válvula de segurança), e juntas de tubagem visíveis na cave ou arrecadação. Se a fuga vem da parede ou teto, a origem pode estar num andar superior, numa tubagem embutida na parede, ou numa infiltração exterior que se confunde com uma fuga. Para fugas ocultas, um canalizador profissional pode utilizar equipamento especializado como câmaras termográficas que detetam diferenças de temperatura causadas pela água, equipamento de deteção acústica que ouve o som da água a escapar dentro das paredes, e gás traçador que é injetado na tubagem para localizar o ponto exato da fuga.',
      },
      {
        heading: 'Fugas ocultas: sinais de alerta',
        content: 'Nem todas as fugas são visíveis, e as fugas ocultas podem causar danos estruturais graves antes de serem detetadas. Esteja atento a estes sinais: manchas de humidade que crescem progressivamente em paredes ou tetos, bolhas ou descamação na pintura, aumento inexplicável na conta de água (compare com meses anteriores), sons de água a correr quando todas as torneiras estão fechadas, pavimento que incha, descola ou apresenta manchas escuras, bolor ou cheiro a mofo persistente, e pressão de água que diminuiu sem explicação. Um teste simples para verificar se tem fugas ocultas: feche todas as torneiras e aparelhos que usam água, verifique o contador de água e anote a leitura. Espere 2 horas sem usar água e verifique novamente. Se o contador avançou, tem uma fuga algures na instalação.',
      },
      {
        heading: 'Seguro de habitação e fugas de água',
        content: 'A maioria dos seguros multiriscos de habitação cobre danos causados por fugas de água, mas é importante conhecer as condições da sua apólice. Em Portugal, o seguro obrigatório de condomínio cobre danos causados por água em frações vizinhas, mas pode não cobrir a reparação da canalização em si. O seguro facultativo multirriscos geralmente cobre pesquisa de fugas (incluindo abertura e reposição de paredes), reparação dos danos causados pela água (pintura, pavimentos, móveis), e custos de canalização para reparar a fuga. Para acionar o seguro, documente os danos antes de qualquer intervenção, contacte a seguradora antes de autorizar reparações não urgentes, guarde todas as faturas de reparação, e peça um relatório ao canalizador descrevendo a causa e extensão da fuga. Se a fuga causou danos a um vizinho, a responsabilidade depende da origem: se o problema está na sua fração, o seu seguro deve cobrir os danos ao vizinho.',
      },
      {
        heading: 'Custos de reparação de fugas',
        content: 'Os custos variam conforme a gravidade e a localização da fuga. Uma reparação simples (substituir vedante de torneira, reparar ligação) custa entre 40€ e 80€. Substituição de torneira completa: entre 60€ e 120€ (mais o custo da torneira). Reparação de autoclismo: entre 30€ e 80€. Reparação de cano rebentado acessível: entre 80€ e 150€. Pesquisa de fuga oculta com equipamento especializado: entre 100€ e 250€. Reparação de fuga embutida (inclui abertura e reposição de parede): entre 200€ e 500€. Deslocação de urgência fora de horas: acréscimo de 30% a 50% sobre os valores normais. Na VITFIX, o diagnóstico inclui-se no preço da reparação — não cobra duas vezes.',
      },
      {
        heading: 'Prevenção de fugas de água',
        content: 'A prevenção é sempre mais económica do que a reparação. Faça verificações periódicas das torneiras e ligações visíveis, apertando ligações que pingam. Substitua mangueiras de máquinas de lavar roupa e louça a cada 5 anos, mesmo que pareçam em bom estado — a borracha deteriora-se com o tempo. Verifique regularmente o mecanismo do autoclismo e substitua vedantes desgastados. Em casas com mais de 20 anos, peça uma inspeção profissional da canalização para avaliar o estado das tubagens. Se as tubagens são em ferro galvanizado (comum em casas das décadas de 1960-1980), considere a substituição por tubagem em multicamadas ou PPR, que não corrói. Instale válvulas de segurança nos pontos críticos para poder isolar zonas específicas sem cortar a água a toda a casa. No inverno, proteja as tubagens exteriores ou em zonas não aquecidas contra congelamento com isolamento térmico.',
      },
    ],
    ctaText: 'Fuga de água urgente? Contacte os canalizadores VITFIX — intervenção rápida em Marco de Canaveses e arredores.',
    relatedServices: ['canalizador'],
    searchVolume: '10-30/mois, sporadique',
  },
  {
    slug: 'disjuntor-dispara-causas',
    title: 'O Disjuntor Dispara: Porquê e Como Resolver',
    metaTitle: 'Disjuntor Dispara Constantemente? Causas e Soluções | VITFIX',
    metaDesc: 'O disjuntor da sua casa dispara frequentemente? Descubra as causas (sobrecarga, curto-circuito, defeito de isolamento) e como resolver o problema.',
    category: 'eletricidade',
    icon: '🔋',
    datePublished: '2026-01-05',
    intro: 'Quando o disjuntor dispara, está a cumprir a sua função: proteger-nos de uma situação perigosa. Mas se dispara repetidamente, há um problema subjacente que precisa de ser resolvido. Este guia completo explica todas as causas possíveis, como diagnosticar o problema e quando precisa de um eletricista.',
    sections: [
      {
        heading: 'Porque é que o disjuntor dispara?',
        content: 'O disjuntor é um dispositivo de segurança que corta automaticamente a corrente elétrica quando deteta uma anomalia. Existem três razões principais para o disparo: sobrecarga (a corrente excede a capacidade do circuito), curto-circuito (contacto direto entre condutores) e fuga de corrente à terra (detetada pelo diferencial). Cada causa tem sintomas e soluções diferentes, por isso é importante identificar qual dos cenários se aplica à sua situação. O comportamento do disjuntor ao disparar dá pistas valiosas — se dispara imediatamente ao religar, gradualmente após alguns minutos, ou apenas quando liga determinados aparelhos.',
      },
      {
        heading: 'Sobrecarga: a causa mais comum',
        content: 'A sobrecarga é a causa mais frequente de disparo do disjuntor, especialmente em casas mais antigas onde os circuitos foram dimensionados para consumos muito inferiores aos atuais. Se o disjuntor dispara quando liga vários aparelhos de alta potência em simultâneo — por exemplo aquecedor elétrico (2000W) + máquina de lavar (2200W) + micro-ondas (1000W) — o circuito está em sobrecarga. Os sinais de sobrecarga incluem o disjuntor que dispara após algum tempo de uso (não imediatamente), luzes que diminuem momentaneamente quando liga um aparelho, e aquecimento dos cabos ou tomadas. A solução pode ser redistribuir os aparelhos por diferentes circuitos, evitar ligar vários aparelhos de alta potência no mesmo circuito, ou em último caso, pedir ao eletricista a instalação de circuitos dedicados para os aparelhos mais exigentes.',
      },
      {
        heading: 'Curto-circuito: disparo imediato',
        content: 'Se o disjuntor dispara instantaneamente ao ser ligado — em menos de um segundo — há provavelmente um curto-circuito no circuito que ele protege. Isto pode ser causado por um aparelho eletrodoméstico defeituoso (motor queimado, cabo danificado), uma tomada ou interruptor danificado com contactos internos em curto, cablagem deteriorada dentro das paredes (isolamento danificado por humidade, roedores ou envelhecimento), ou uma ligação mal feita (por exemplo após uma reparação amadora). Para diagnosticar, desligue todos os aparelhos ligados ao circuito afetado e religue o disjuntor. Se se mantiver ligado, vá ligando os aparelhos um a um até identificar qual causa o disparo. Se dispara mesmo sem nenhum aparelho ligado, o problema está na cablagem fixa ou numa tomada — precisa de um eletricista.',
      },
      {
        heading: 'Diferencial vs. disjuntor: qual disparou?',
        content: 'É fundamental distinguir qual dispositivo disparou, pois indicam problemas diferentes. O disjuntor individual protege um circuito específico contra sobrecargas e curto-circuitos. Quando dispara, apenas o circuito afetado fica sem eletricidade. O diferencial (interruptor diferencial) deteta fugas de corrente à terra e protege as pessoas contra eletrocussão. Quando dispara, todos os circuitos que ele protege ficam sem eletricidade. Se é o diferencial que dispara, a situação é potencialmente mais perigosa porque significa que há corrente a escapar para a terra — possivelmente através de um aparelho com defeito de isolamento que poderia causar um choque elétrico a alguém que lhe tocasse. Neste caso, a intervenção profissional é urgente. O diferencial tem um botão de teste (geralmente marcado com T) que deve ser pressionado mensalmente para verificar o seu correto funcionamento.',
      },
      {
        heading: 'Potência contratada em Portugal',
        content: 'Um problema frequente em Portugal, especialmente em casas mais antigas, é ter uma potência contratada insuficiente para as necessidades atuais. Se é o disjuntor geral (limitador de potência) que dispara, pode simplesmente estar a exceder a potência contratada. As potências mais comuns em Portugal são 3.45 kVA (mínima, para casas pequenas com consumo baixo), 4.6 kVA (a mais comum em apartamentos antigos), 6.9 kVA (adequada para a maioria das habitações modernas), e 10.35 kVA ou superior (para casas com equipamentos de alta potência como bombas de calor ou carregadores de veículos elétricos). Para alterar a potência contratada, contacte o seu comercializador de energia (EDP, Galp, Endesa, etc.). O aumento de potência pode implicar uma alteração no quadro elétrico que deve ser feita por um eletricista certificado.',
      },
      {
        heading: 'Como testar e diagnosticar',
        content: 'Se o seu disjuntor dispara repetidamente, siga este processo de diagnóstico sistemático. Primeiro, identifique qual disjuntor disparou (individual ou geral). Se foi um disjuntor individual, desligue todos os aparelhos e luzes desse circuito. Religue o disjuntor. Se se mantiver ligado, ligue os aparelhos um a um, esperando alguns minutos entre cada um. O aparelho que causa o disparo é provavelmente o culpado — desligue-o e não o use até ser verificado. Se o disjuntor dispara mesmo sem aparelhos, desaperte as tomadas do circuito e verifique visualmente se há sinais de danos ou humidade. Se é o diferencial que dispara, deslige todos os disjuntores individuais, religue o diferencial, e ligue os disjuntores um a um. O circuito que causa o disparo do diferencial tem uma fuga de corrente à terra. Se não consegue identificar a causa, um eletricista pode usar equipamento como um megóhmetro para medir a resistência de isolamento de cada circuito.',
      },
      {
        heading: 'Disjuntor antigo ou defeituoso',
        content: 'Os disjuntores não duram para sempre. Após 15-20 anos de serviço, os mecanismos internos podem degradar-se, tornando o disjuntor mais sensível e causando disparos sem motivo aparente. Outros sinais de um disjuntor defeituoso incluem dificuldade em religar (a alavanca não fica na posição ligado), aquecimento excessivo do corpo do disjuntor, marcas de descoloração ou queimadura, e disparo intermitente sem padrão identificável. A substituição de um disjuntor individual custa entre 30€ e 60€ incluindo material e mão de obra. Se o quadro completo está desatualizado, pode ser mais vantajoso substituir o quadro inteiro por um modelo moderno com disjuntores e diferenciais de última geração.',
      },
      {
        heading: 'Custos de diagnóstico e reparação',
        content: 'Os custos de resolução de problemas com disjuntores dependem da causa. Um diagnóstico elétrico profissional custa entre 40€ e 80€. A substituição de um disjuntor individual custa entre 30€ e 60€. A redistribuição de circuitos sobrecarregados pode custar entre 100€ e 300€ dependendo da complexidade. Reparação de cablagem danificada: entre 80€ e 250€ por troço. Substituição completa do quadro elétrico: entre 300€ e 600€. Aumento de potência contratada (parte elétrica): entre 100€ e 200€. Na VITFIX, o diagnóstico é gratuito quando seguido de reparação — não paga duas vezes pelo mesmo serviço.',
      },
    ],
    ctaText: 'Disjuntor que dispara sem parar? Os eletricistas VITFIX diagnosticam e resolvem o problema.',
    relatedServices: ['eletricista'],
    searchVolume: '10-25/mois, stable',
  },
  {
    slug: 'canalizador-24-horas-quando-chamar',
    title: 'Canalizador 24 Horas: Quando Chamar?',
    metaTitle: 'Canalizador 24 Horas: Quando é Realmente Urgente? | VITFIX',
    metaDesc: 'Quando é que precisa realmente de um canalizador de urgência 24 horas? Saiba distinguir uma emergência de uma situação que pode esperar.',
    category: 'canalizacao',
    icon: '🆘',
    datePublished: '2026-01-15',
    intro: 'Nem todos os problemas de canalização são urgências que justifiquem chamar um canalizador a meio da noite. Mas algumas situações exigem ação imediata para evitar danos graves e dispendiosos. Este guia completo ajuda-o a distinguir uma verdadeira urgência de uma situação que pode esperar, e explica como escolher o profissional certo.',
    sections: [
      {
        heading: 'Situações de urgência real — chame imediatamente',
        content: 'Algumas situações de canalização exigem intervenção imediata, independentemente da hora. Deve chamar um canalizador de urgência se tem um cano rebentado com água a jorrar — cada minuto que passa aumenta os danos. Se sente cheiro a gás, a prioridade é ligar para o 112 e para a empresa de gás, mas um canalizador certificado também deve intervir para reparar a fuga. Uma inundação ativa que não consegue parar fechando a torneira geral é uma emergência que pode causar danos estruturais. Esgoto a transbordar dentro de casa é não só uma emergência de canalização mas também um risco sanitário grave. Se há água a escorrer para instalações elétricas, deve desligar a eletricidade e chamar canalizador e eletricista. Nestas situações, cada minuto conta — os danos causados pela água aumentam exponencialmente com o tempo.',
      },
      {
        heading: 'Situações que podem esperar até ao dia seguinte',
        content: 'Muitos problemas de canalização, embora inconvenientes, não são verdadeiras urgências e podem esperar pelo horário normal de trabalho, poupando-lhe o acréscimo de uma chamada fora de horas. Uma torneira que pinga pode ser controlada fechando a torneira de segurança específica dessa torneira. Um autoclismo que corre um pouco desperdiça água mas não causa danos imediatos — feche a torneira de entrada do autoclismo se possível. A pressão da água que baixou ligeiramente pode indicar um problema na rede pública que se resolve sozinho. Substituição de acessórios de casa de banho (chuveiro, bica, ralo) são trabalhos de rotina. Entupimentos parciais que ainda permitem algum escoamento podem geralmente esperar. A regra geral é: se consegue fechar uma torneira e conter a situação sem danos contínuos, pode esperar por uma intervenção em horário normal.',
      },
      {
        heading: 'O que fazer enquanto espera pelo canalizador',
        content: 'Se a situação está controlada e aguarda a intervenção de um profissional, tome estas medidas para minimizar danos. Se fechou a torneira geral, informe os outros ocupantes da casa para que não tentem abrir água. Coloque toalhas e baldes nas zonas onde há água acumulada ou a escorrer. Afaste móveis e objetos de valor das zonas húmidas. Abra janelas para promover a ventilação e evitar acumulação de humidade. Se há água no pavimento, limpe o mais rápido possível para evitar danos no material (especialmente em pavimentos de madeira). Documente todos os danos com fotografias e vídeos — serão fundamentais para o seguro. Se mora num apartamento e a fuga pode afetar vizinhos dos andares inferiores, avise-os imediatamente. Anote a leitura do contador de água para referência.',
      },
      {
        heading: 'Como escolher um canalizador de confiança',
        content: 'Escolher o canalizador certo, especialmente numa urgência quando não há tempo para pesquisar, pode ser difícil. Eis os critérios a considerar. Verifique se o profissional tem alvará ou está inscrito na atividade — em Portugal, os canalizadores devem ter formação e certificação adequada. Peça sempre um orçamento antes da intervenção, mesmo que seja uma estimativa verbal. Desconfie de preços demasiado baixos — podem significar trabalho de má qualidade ou materiais baratos. Pergunte se dá garantia sobre o trabalho realizado — um profissional de confiança garante o seu trabalho. Verifique se tem seguro de responsabilidade civil, que o protege em caso de danos adicionais durante a reparação. Peça referências ou consulte avaliações online. Na VITFIX, todos os canalizadores são verificados, dão garantia sobre o trabalho e apresentam orçamento antes de iniciar.',
      },
      {
        heading: 'Custos de referência: urgência vs. horário normal',
        content: 'Conhecer os preços de referência ajuda-o a avaliar se está a receber um orçamento justo. Em horário normal (dias úteis, 8h-18h), os preços médios na região de Marco de Canaveses são: deslocação e diagnóstico entre 30€ e 50€, reparação de torneira entre 40€ e 80€, desentupimento simples entre 60€ e 120€, reparação de autoclismo entre 30€ e 70€, e reparação de cano rebentado entre 80€ e 200€. Para chamadas de urgência fora de horas (noites, fins de semana e feriados), aplica-se geralmente um acréscimo de 30% a 50% sobre estes valores. Ao fim de semana durante o dia, o acréscimo é tipicamente de 25-30%. Em feriados e durante a noite (22h-8h), o acréscimo pode atingir os 50%. Avalie se a situação justifica este custo adicional ou se pode esperar pelo horário normal. Se tiver dúvidas, ligue para a VITFIX — ajudamos a avaliar a urgência gratuitamente por telefone.',
      },
      {
        heading: 'Entupimentos: o que funciona e o que não funciona',
        content: 'Os entupimentos são um dos motivos mais frequentes de chamadas de urgência, mas muitos podem ser resolvidos ou pelo menos atenuados sem chamar um profissional. O que funciona: um desentupidor de borracha (ventosa) é a primeira ferramenta a experimentar, funcionando bem em entupimentos parciais. Água a ferver pode dissolver acumulações de gordura em canos de cozinha. Bicarbonato de sódio com vinagre pode ajudar em entupimentos ligeiros. O que não funciona e pode piorar: produtos químicos desentupidores agressivos podem corroer tubagens, especialmente as mais antigas, e criar fugas. Arames ou objetos improvisados podem empurrar a obstrução para mais longe e danificar os canos. Pressão excessiva com mangueira pode rebentar juntas em tubagens envelhecidas. Se o entupimento resiste aos métodos simples, é melhor chamar um profissional que tem equipamento adequado como molas profissionais e hidropressão.',
      },
      {
        heading: 'Direitos do consumidor',
        content: 'Ao contratar um canalizador, tem direitos que deve conhecer. O profissional é obrigado a apresentar orçamento antes de iniciar o trabalho, identificando os materiais a utilizar e o custo da mão de obra. Tem direito a uma fatura com NIF (contribuinte) pela prestação do serviço. O trabalho deve ter garantia — o prazo mínimo legal para serviços de construção e reparação é de 5 anos para defeitos estruturais e 2 anos para outros defeitos. Se o trabalho não ficar bem feito, tem direito à reparação gratuita. Em caso de danos causados pelo profissional durante a intervenção, o seu seguro de responsabilidade civil deve cobri-los. Nunca pague a totalidade antes do trabalho estar concluído — o habitual é pagar apenas os materiais antecipadamente (se necessário) e o restante após conclusão satisfatória.',
      },
      {
        heading: 'Manutenção preventiva da canalização',
        content: 'A melhor forma de evitar chamadas de urgência é fazer manutenção preventiva regular. Limpe os ralos e sifões de lavatórios e banheiras a cada 2-3 meses, removendo cabelos e resíduos acumulados. Evite deitar gordura e óleo usado pelo ralo da cozinha — são a principal causa de entupimentos. Verifique periodicamente as mangueiras de ligação de máquinas de lavar e substitua-as a cada 5 anos. Faça revisão anual do esquentador ou caldeira, incluindo verificação das ligações de água. Em casas com mais de 20 anos, peça uma inspeção das tubagens — as tubagens em ferro galvanizado deterioram-se com o tempo e devem ser substituídas preventivamente por materiais modernos como multicamadas ou PPR. No inverno, proteja as tubagens exteriores contra congelamento — embora as temperaturas na região do Porto raramente atinjam o ponto de congelação, nas zonas mais altas de Amarante ou Baião pode acontecer. Esta manutenção simples pode evitar-lhe milhares de euros em reparações de emergência.',
      },
    ],
    ctaText: 'Precisa de um canalizador urgente? A VITFIX atua em Marco de Canaveses, Penafiel e arredores.',
    relatedServices: ['canalizador'],
    searchVolume: 'canalizador 24 horas +450% crescimento',
  },
  {
    slug: 'quanto-custa-remodelar-casa-portugal',
    title: 'Quanto Custa Remodelar uma Casa em Portugal? Guia Completo 2026',
    metaTitle: 'Quanto Custa Remodelar uma Casa em Portugal? Preços 2026 | VITFIX',
    metaDesc: 'Guia completo de preços de remodelação em Portugal em 2026. Cozinha, casa de banho, apartamento completo — todos os custos detalhados por m².',
    category: 'obras',
    icon: '💰',
    datePublished: '2026-02-01',
    intro: 'Está a pensar remodelar a sua casa mas não sabe quanto vai custar? É a pergunta mais frequente que recebemos. Os custos de remodelação variam muito conforme o tipo de obra, a qualidade dos materiais e a região. Este guia completo apresenta os preços reais praticados em 2026, com foco na região do Porto e Tâmega e Sousa.',
    sections: [
      {
        heading: 'Preços médios de remodelação por divisão',
        content: 'Os custos de remodelação em Portugal dependem do tipo de divisão e do nível de acabamento. Para uma casa de banho completa (demolição, impermeabilização, canalização, revestimentos, louças e acessórios), os preços variam entre 3 000€ e 8 000€. Uma cozinha completa com móveis, eletrodomésticos, canalização e eletricidade situa-se entre 5 000€ e 15 000€. A remodelação de um quarto (pintura, pavimento, eletricidade) custa entre 1 500€ e 4 000€. Uma sala de estar completa entre 2 000€ e 6 000€. Estes valores incluem materiais e mão de obra para acabamentos de qualidade média-alta.',
      },
      {
        heading: 'Custo por m² em 2026',
        content: 'O custo médio de remodelação por m² em Portugal em 2026 situa-se entre 250€ e 600€ por m² para uma remodelação completa de qualidade média. Para acabamentos de gama alta, pode atingir 800€ a 1 200€ por m². Na região do Tâmega e Sousa (Marco de Canaveses, Penafiel, Amarante), os preços são geralmente 10% a 20% inferiores aos praticados no centro do Porto, devido a custos operacionais mais baixos. Uma remodelação básica (pintura, pavimento, eletricidade) custa entre 150€ e 300€ por m². Uma remodelação intermédia (incluindo cozinha e casa de banho) entre 300€ e 500€ por m². Uma remodelação premium (tudo novo, materiais topo de gama) entre 500€ e 800€ por m².',
      },
      {
        heading: 'Remodelação completa de apartamento',
        content: 'Para ter uma ideia realista, eis os custos típicos por tipo de apartamento na região do Porto em 2026. Um T1 (40-50m²) com remodelação completa custa entre 12 000€ e 25 000€. Um T2 (60-80m²) entre 18 000€ e 40 000€. Um T3 (90-120m²) entre 25 000€ e 60 000€. Uma moradia (150-250m²) entre 40 000€ e 120 000€. Estes valores incluem demolições, canalização nova, eletricidade nova, reboco, pavimentos, revestimentos, cozinha e casas de banho completas, pintura e limpeza final. Não incluem eletrodomésticos, mobiliário nem eventuais reforços estruturais.',
      },
      {
        heading: 'O que encarece e o que poupa numa remodelação',
        content: 'Vários fatores podem aumentar ou reduzir significativamente o custo final. O que encarece: alterações na disposição de paredes (exige projeto de arquitetura e eventualmente engenharia), mudança de localização da cozinha ou casas de banho (canalização e esgotos novos), materiais importados ou de gama alta, imprevistos estruturais (especialmente em casas antigas), e necessidade de licenciamento camarário. O que permite poupar: manter a disposição original (sem mexer em paredes estruturais), escolher materiais nacionais de boa qualidade (cerâmicas, torneiras, louças portuguesas), reaproveitar elementos em bom estado (caixilharia, portas interiores), planear bem antes de começar para evitar alterações durante a obra, e contratar um empreiteiro com orçamento fechado em vez de preço por hora.',
      },
      {
        heading: 'IVA de 6% em remodelações — como beneficiar',
        content: 'Em Portugal, as obras de remodelação e conservação em habitações com mais de 2 anos podem beneficiar de uma taxa de IVA reduzida de 6%, em vez dos habituais 23%. Esta redução aplica-se à mão de obra e pode representar uma poupança significativa — em obras de 20 000€, a diferença entre 23% e 6% de IVA representa cerca de 3 400€. Para beneficiar desta taxa, o imóvel deve ser para habitação própria e ter mais de 2 anos. O empreiteiro deve aplicar a taxa correta na fatura. Os materiais fornecidos pelo empreiteiro que não ultrapassem 20% do valor total da fatura também podem beneficiar da taxa reduzida. Materiais comprados separadamente pelo proprietário pagam IVA a 23%.',
      },
      {
        heading: 'Prazos típicos de remodelação',
        content: 'Os prazos dependem da dimensão e complexidade da obra. Uma casa de banho completa demora entre 2 e 4 semanas. Uma cozinha completa entre 3 e 6 semanas. A remodelação completa de um apartamento T2 demora entre 2 e 4 meses. Uma moradia completa pode levar de 4 a 8 meses. Estes prazos podem ser afetados pela disponibilidade dos materiais (especialmente importados), pela necessidade de licenciamento (que pode adicionar 1 a 3 meses), por imprevistos encontrados durante a demolição (humidade, problemas estruturais, canalização antiga), e pela coordenação entre diferentes profissionais (canalizador, eletricista, pedreiro, pintor). Um bom planeamento inicial e a contratação de um empreiteiro geral que coordene todos os trabalhos é a melhor forma de evitar atrasos.',
      },
      {
        heading: 'Como pedir orçamentos corretamente',
        content: 'Para obter orçamentos realistas e comparáveis, siga estas recomendações. Peça pelo menos 3 orçamentos a empresas diferentes. Defina claramente o que pretende antes de pedir orçamento — quanto mais detalhado for o seu pedido, mais preciso será o orçamento. Peça orçamentos itemizados (com detalhe de cada trabalho e material) em vez de um valor global. Verifique se o orçamento inclui tudo: demolições, remoção de entulho, materiais, mão de obra, IVA, e se há custos extra previsíveis. Pergunte sobre o prazo de execução e as condições de pagamento. Verifique se a empresa tem seguro e alvará adequado. Desconfie de orçamentos demasiado baixos — podem significar materiais de qualidade inferior ou trabalho apressado. Na VITFIX, todos os orçamentos são detalhados, gratuitos e sem compromisso.',
      },
      {
        heading: 'Preços na região de Marco de Canaveses vs. Porto',
        content: 'A região do Tâmega e Sousa oferece geralmente preços mais competitivos do que o centro do Porto. A mão de obra é tipicamente 10% a 20% mais económica. Os custos operacionais (deslocação, estacionamento, logística) são inferiores. A disponibilidade de profissionais é frequentemente melhor, com prazos mais curtos. No entanto, para materiais especializados ou de gama alta, os preços são semelhantes em toda a região. Marco de Canaveses, Penafiel e Amarante beneficiam de uma boa rede de fornecedores de materiais de construção e de profissionais experientes em remodelação de casas tradicionais do Norte de Portugal, incluindo casas em granito que exigem conhecimentos específicos.',
      },
    ],
    ctaText: 'Precisa de um orçamento para a sua remodelação? Na VITFIX, o orçamento é gratuito, detalhado e sem compromisso.',
    relatedServices: ['obras-remodelacao'],
    searchVolume: '1000-3000/mois, forte hausse',
  },
  {
    slug: 'obras-sem-licenca-portugal',
    title: 'Obras Sem Licença em Portugal: O Que Pode Fazer Legalmente',
    metaTitle: 'Obras Sem Licença em Portugal: Guia Legal Completo 2026 | VITFIX',
    metaDesc: 'Que obras pode fazer sem licença da câmara em Portugal? Guia completo sobre obras isentas, comunicação prévia e licenciamento. Evite multas.',
    category: 'obras',
    icon: '📋',
    datePublished: '2026-01-20',
    intro: 'Uma das dúvidas mais comuns de quem quer fazer obras em casa é saber se precisa de licença da câmara municipal. A legislação portuguesa distingue vários tipos de procedimentos conforme a natureza e dimensão da obra. Fazer obras sem a devida autorização pode resultar em multas pesadas e até na obrigação de demolir o que foi construído. Saiba exatamente o que pode e não pode fazer.',
    sections: [
      {
        heading: 'Obras isentas de licenciamento',
        content: 'Segundo o RJUE (Regime Jurídico da Urbanização e Edificação), estão isentas de controlo prévio as seguintes obras: obras de conservação interior que não alterem a estrutura do edifício (pintura, pavimentos, substituição de louças, remodelação de cozinha sem alterar paredes estruturais), substituição de revestimentos interiores e exteriores (desde que mantenham o aspeto exterior em zonas protegidas), obras de manutenção corrente de equipamentos e instalações (canalização, eletricidade, aquecimento), instalação de painéis solares e equipamentos de energias renováveis (com limitações de dimensão), e construções ligeiras com altura inferior a 2,20m sem fundações permanentes. Importante: mesmo obras isentas devem respeitar os regulamentos gerais de construção e as normas de segurança.',
      },
      {
        heading: 'Comunicação prévia: quando é necessária',
        content: 'A comunicação prévia é um procedimento simplificado que substituiu o antigo licenciamento para determinadas obras. É obrigatória para alterações na fachada do edifício (incluindo aplicação de capoto ou pintura exterior diferente), construção de piscinas, muros de vedação e anexos com fundações, instalação de equipamentos exteriores visíveis (ar condicionado, painéis solares acima do limite isento), e obras em zonas protegidas ou de valor patrimonial que estejam isentas de licença noutras circunstâncias. A comunicação prévia é geralmente mais rápida que o licenciamento, com prazos de decisão entre 20 e 60 dias conforme o município.',
      },
      {
        heading: 'Licença de obras: quando é obrigatória',
        content: 'A licença de construção é obrigatória para obras mais significativas: construção nova, ampliação ou alteração da área construída, obras que modifiquem a estrutura do edifício (demolição de paredes resistentes, abertura de vãos em paredes de carga), alteração do uso do imóvel (de habitação para comércio, por exemplo), obras em edifícios classificados ou em vias de classificação, e reconstrução com preservação de fachadas. O processo de licenciamento inclui a apresentação de projeto de arquitetura e especialidades, o pagamento de taxas camarárias, e um prazo de apreciação que pode variar entre 30 e 120 dias conforme o município e a complexidade da obra.',
      },
      {
        heading: 'Multas por obras ilegais',
        content: 'Realizar obras sem o procedimento legal adequado constitui contraordenação e pode resultar em sanções significativas. As multas por obras ilegais em Portugal variam conforme a gravidade: para obras menores sem comunicação prévia, as multas vão de 500€ a 5 000€ para particulares. Para obras maiores sem licença, as multas podem atingir 200 000€ para particulares e valores superiores para empresas. Além da multa, a câmara pode ordenar a suspensão imediata dos trabalhos, a demolição do que foi construído, e a reposição do estado anterior do imóvel. Os custos de demolição e reposição são por conta do proprietário. É sempre mais económico e seguro seguir os procedimentos legais.',
      },
      {
        heading: 'Obras em apartamentos: regras de condomínio',
        content: 'Se vive num apartamento, além das regras camarárias, deve respeitar as regras do condomínio. Obras que afetem partes comuns (fachada, telhado, estrutura) necessitam de aprovação em assembleia de condóminos. Obras ruidosas devem respeitar os horários permitidos (geralmente dias úteis das 8h às 20h, sábados das 9h às 13h, proibidas domingos e feriados). Deve informar a administração do condomínio e os vizinhos antes de iniciar obras. Obras que modifiquem o aspeto exterior do edifício podem necessitar de aprovação do condomínio mesmo que não alterem partes comuns. A proteção das partes comuns durante as obras (escadas, elevadores, entradas) é responsabilidade de quem faz as obras.',
      },
      {
        heading: 'Como legalizar obras já feitas',
        content: 'Se já fez obras sem licença e quer regularizar a situação, o processo depende da natureza das obras e do município. Para obras menores, pode ser possível submeter uma comunicação prévia a posteriori. Para obras maiores, será necessário apresentar um pedido de licenciamento acompanhado de projeto elaborado por arquiteto e engenheiro. Os custos de legalização incluem as taxas camarárias normais mais eventuais penalizações. Em alguns casos, pode ser necessário realizar alterações para que a obra cumpra os regulamentos em vigor. O custo de legalização é quase sempre inferior ao custo de demolição e reconstituição, pelo que vale a pena regularizar. Consulte o departamento de urbanismo da sua câmara municipal para orientação específica sobre o seu caso.',
      },
      {
        heading: 'Exemplos práticos: preciso de licença para isto?',
        content: 'Para esclarecer as dúvidas mais comuns, eis alguns exemplos práticos. Pintar o interior da casa: isento — pode fazer livremente. Pintar a fachada com a mesma cor: geralmente isento, mas confirme na câmara. Pintar a fachada com cor diferente: comunicação prévia. Substituir o pavimento interior: isento. Trocar as janelas por caixilharia nova: comunicação prévia se alterar o aspeto exterior. Remodelar a cozinha sem mexer em paredes: isento. Remodelar a cozinha demolindo uma parede não estrutural: isento na maioria dos casos. Demolir uma parede estrutural: licença obrigatória. Instalar ar condicionado com unidade exterior visível: comunicação prévia. Construir uma piscina no quintal: comunicação prévia. Fechar uma varanda com vidro: licença obrigatória (altera a área construída).',
      },
    ],
    ctaText: 'Vai fazer obras e não sabe se precisa de licença? Contacte a VITFIX — ajudamos com todo o processo.',
    relatedServices: ['obras-remodelacao'],
    searchVolume: '300-1000/mois, stable',
  },
  {
    slug: 'iva-6-obras-remodelacao-portugal',
    title: 'IVA de 6% em Obras de Remodelação: Como Beneficiar',
    metaTitle: 'IVA 6% em Obras de Remodelação Portugal: Guia Completo | VITFIX',
    metaDesc: 'Saiba como beneficiar do IVA reduzido de 6% em obras de remodelação em Portugal. Condições, requisitos e quanto pode poupar. Guia atualizado 2026.',
    category: 'obras',
    icon: '🧾',
    datePublished: '2026-01-10',
    intro: 'Em Portugal, as obras de remodelação e conservação em habitações podem beneficiar de uma taxa de IVA reduzida de 6%, em vez dos habituais 23%. Esta diferença pode representar milhares de euros de poupança. Mas nem todas as obras qualificam e há condições específicas a cumprir. Este guia explica tudo o que precisa de saber para beneficiar desta vantagem fiscal.',
    sections: [
      {
        heading: 'O que diz a lei sobre o IVA reduzido',
        content: 'A aplicação da taxa reduzida de IVA de 6% a obras de remodelação está prevista na verba 2.24 da Lista I anexa ao Código do IVA. Aplica-se a empreitadas de reabilitação, remodelação, renovação, restauro, reparação e conservação de imóveis para habitação. A condição principal é que o imóvel seja destinado a habitação e tenha sido construído há mais de 2 anos. Esta medida visa incentivar a reabilitação do parque habitacional português, que inclui muitos edifícios antigos necessitando de obras.',
      },
      {
        heading: 'Condições para beneficiar do IVA de 6%',
        content: 'Para que a taxa reduzida se aplique, devem verificar-se cumulativamente as seguintes condições: o imóvel deve destinar-se a habitação (não se aplica a espaços comerciais ou escritórios), o imóvel deve ter mais de 2 anos de construção, os trabalhos devem ser de conservação, remodelação ou reparação (não construção nova), os materiais incorporados não devem exceder 20% do valor total da fatura (acima disso, os materiais pagam 23%), e a prestação de serviço deve ser faturada ao proprietário ou inquilino do imóvel. A taxa aplica-se à mão de obra e aos materiais fornecidos pelo empreiteiro desde que estes não ultrapassem o limite de 20%.',
      },
      {
        heading: 'Quanto pode poupar com o IVA de 6%',
        content: 'A diferença entre pagar 23% e 6% de IVA pode ser muito significativa. Numa obra de 10 000€ (sem IVA), pagaria 2 300€ de IVA a 23% mas apenas 600€ a 6% — uma poupança de 1 700€. Numa obra de 20 000€, a poupança sobe para 3 400€. Numa remodelação completa de 40 000€, a poupança atinge 6 800€. Para uma moradia completa de 80 000€, pode poupar até 13 600€ em IVA. Estes valores demonstram a importância de garantir que a taxa correta é aplicada. Se o empreiteiro aplicar 23% numa obra que qualifica para 6%, está a pagar a mais.',
      },
      {
        heading: 'Que obras qualificam para IVA de 6%',
        content: 'Qualificam para a taxa reduzida as seguintes obras em imóveis habitacionais com mais de 2 anos: remodelação de cozinhas e casas de banho, pintura interior e exterior, substituição de pavimentos e revestimentos, reparação e substituição de canalização e eletricidade, aplicação de isolamento térmico (capoto/ETICS), impermeabilização de telhados e terraços, reparação de telhados e coberturas, instalação de sistemas de aquecimento e ar condicionado, substituição de caixilharia e janelas, e construção de divisórias interiores em pladur. Não qualificam: construção de ampliações (aumento da área), construção nova (mesmo em terreno com edifício demolido), e obras em imóveis comerciais.',
      },
      {
        heading: 'Materiais: a regra dos 20%',
        content: 'Um ponto que gera muita confusão é a regra dos materiais. Os materiais fornecidos e incorporados pelo empreiteiro beneficiam da taxa de 6% desde que não ultrapassem 20% do valor total da fatura. Se os materiais ultrapassarem este limite, a parte excedente deve ser faturada a 23%. Por exemplo, numa fatura de 10 000€ em que os materiais representam 1 500€ (15%), tudo é faturado a 6%. Mas se os materiais representam 3 000€ (30%), os primeiros 2 000€ (20%) pagam 6% e os restantes 1 000€ pagam 23%. Os materiais comprados diretamente pelo proprietário numa loja pagam sempre 23% de IVA, independentemente de serem para uma remodelação. Por isso, pode ser vantajoso que o empreiteiro forneça os materiais, desde que o total fique dentro dos 20%.',
      },
      {
        heading: 'Erros comuns e como evitá-los',
        content: 'Os erros mais comuns na aplicação do IVA reduzido incluem o empreiteiro aplicar 23% por desconhecimento ou para simplificar — peça sempre que aplique 6% se a obra qualifica. Outro erro frequente é não verificar se o imóvel tem mais de 2 anos — a data de construção pode ser confirmada na caderneta predial. Alguns empreiteiros facturam materiais e mão de obra em separado para evitar a regra dos 20% — esta prática é aceitável desde que reflita a realidade. Misturar obras em partes habitacionais e comerciais do mesmo edifício sem separar corretamente a faturação também é problemático. Em caso de dúvida, consulte um contabilista ou peça informação vinculativa às Finanças.',
      },
    ],
    ctaText: 'Vai fazer obras de remodelação? Na VITFIX, aplicamos sempre a taxa de IVA correta — sem surpresas na fatura.',
    relatedServices: ['obras-remodelacao'],
    searchVolume: '200-600/mois, forte hausse',
  },
  {
    slug: 'quanto-custa-remodelar-cozinha',
    title: 'Quanto Custa Remodelar uma Cozinha em Portugal?',
    metaTitle: 'Quanto Custa Remodelar uma Cozinha? Preços 2026 Portugal | VITFIX',
    metaDesc: 'Preços reais de remodelação de cozinha em Portugal em 2026. Desde renovação simples a cozinha completa — todos os custos detalhados.',
    category: 'obras',
    icon: '🍳',
    datePublished: '2026-02-10',
    intro: 'A cozinha é uma das divisões mais importantes da casa e também uma das mais caras de remodelar. Os custos variam enormemente conforme o que se pretende — desde uma simples renovação de portas e bancada até uma remodelação completa com alteração de layout. Este guia apresenta os preços reais praticados em 2026.',
    sections: [
      {
        heading: 'Níveis de remodelação e custos',
        content: 'A remodelação de uma cozinha pode ser dividida em três níveis. A renovação ligeira (pintura, substituição de portas de armários, nova bancada, troca de torneira) custa entre 1 500€ e 4 000€ e demora 1 a 2 semanas. A remodelação intermédia (móveis novos, eletrodomésticos, revestimentos, iluminação, mantendo a disposição) custa entre 5 000€ e 10 000€ e demora 3 a 4 semanas. A remodelação completa (demolição total, alteração de layout, canalização nova, eletricidade nova, tudo novo) custa entre 10 000€ e 20 000€ e pode demorar 4 a 8 semanas.',
      },
      {
        heading: 'Decomposição dos custos',
        content: 'Para uma remodelação completa, eis como os custos se distribuem tipicamente. Demolição e remoção de entulho: 500€ a 1 000€. Canalização (água e esgotos): 800€ a 1 500€. Eletricidade (pontos de luz, tomadas, quadro): 600€ a 1 200€. Revestimento de paredes e chão (azulejos ou outro): 1 000€ a 3 000€. Móveis de cozinha: 2 000€ a 8 000€ (a maior variação de custo). Bancada: 500€ a 3 000€ (conforme material — laminado, granito, quartzo, Silestone). Eletrodomésticos de encastre: 1 500€ a 5 000€. Torneira e lava-loiça: 200€ a 800€. Iluminação: 200€ a 600€. Pintura e acabamentos finais: 300€ a 600€.',
      },
      {
        heading: 'Bancadas: comparação de materiais',
        content: 'A bancada é um dos elementos mais visíveis e utilizados da cozinha, e os preços variam enormemente conforme o material. O laminado (tipo Formica) é a opção mais económica, custando entre 80€ e 150€ por metro linear — resistente ao uso diário mas vulnerável a cortes e calor intenso. O granito é uma opção clássica e durável, entre 150€ e 300€ por metro linear — resiste ao calor e riscos. O quartzo compacto (Silestone, Caesarstone) é a escolha mais popular em remodelações modernas, entre 200€ e 400€ por metro linear — muito resistente, higiénico e disponível em muitas cores. O Dekton é uma opção premium ultraresistente, entre 300€ e 500€ por metro linear. A madeira maciça oferece um visual quente e natural, entre 150€ e 350€ por metro linear, mas requer manutenção regular.',
      },
      {
        heading: 'Dicas para poupar na remodelação da cozinha',
        content: 'É possível obter uma cozinha bonita e funcional sem gastar uma fortuna. Considere renovar as portas dos armários em vez de substituir os móveis inteiros — se a estrutura está em bom estado, novas portas e puxadores transformam completamente o aspeto por uma fração do custo. Mantenha a disposição existente se possível — mover a posição do lava-loiça, fogão ou frigorífico implica mexer em canalização e eletricidade, o que aumenta muito o custo. Compare preços de eletrodomésticos online e em várias lojas antes de comprar. Escolha azulejos nacionais de boa qualidade em vez de importados — a cerâmica portuguesa tem excelente relação qualidade-preço. Peça orçamento a pelo menos 3 empresas diferentes para garantir que obtém o melhor preço.',
      },
      {
        heading: 'Erros comuns na remodelação de cozinhas',
        content: 'Evite estes erros frequentes que encarecem ou complicam a obra. Não planear a iluminação adequadamente — uma cozinha precisa de luz geral, luz de trabalho sobre a bancada e luz ambiente. Esquecer as tomadas — uma cozinha moderna precisa de muitas tomadas para pequenos eletrodomésticos. Escolher materiais bonitos mas pouco práticos — o pavimento da cozinha deve ser resistente à água e fácil de limpar. Não prever espaço de arrumação suficiente — é o erro mais lamentado após a obra. Não considerar a ventilação e exaustão — o exaustor deve ter potência adequada e saída para o exterior. Começar a obra sem ter todos os materiais disponíveis — atrasos na entrega de um material podem parar toda a obra.',
      },
    ],
    ctaText: 'Quer remodelar a sua cozinha? Peça um orçamento gratuito e detalhado à VITFIX.',
    relatedServices: ['obras-remodelacao'],
    searchVolume: '500-1500/mois, forte hausse',
  },
  {
    slug: 'quanto-custa-remodelar-casa-de-banho',
    title: 'Quanto Custa Remodelar uma Casa de Banho em Portugal?',
    metaTitle: 'Quanto Custa Remodelar uma Casa de Banho? Preços 2026 | VITFIX',
    metaDesc: 'Preços reais de remodelação de casa de banho em Portugal 2026. Base de duche, banheira, revestimentos — custos detalhados por componente.',
    category: 'obras',
    icon: '🚿',
    datePublished: '2026-02-15',
    intro: 'A casa de banho é, depois da cozinha, a divisão que mais se remodela em Portugal. As razões são várias: louças datadas, problemas de humidade, vontade de substituir a banheira por base de duche, ou simplesmente modernizar o espaço. Este guia apresenta os custos reais de remodelação em 2026.',
    sections: [
      {
        heading: 'Custos por tipo de remodelação',
        content: 'Os preços variam conforme a extensão da remodelação. Uma renovação simples (substituição de louças, torneiras e acessórios, mantendo revestimentos) custa entre 1 500€ e 3 000€ e demora 3 a 5 dias. Uma remodelação intermédia (louças novas, novos revestimentos de parede e chão, nova torneira) custa entre 3 000€ e 5 000€ e demora 1 a 2 semanas. Uma remodelação completa (demolição total, impermeabilização, canalização, eletricidade, tudo novo) custa entre 5 000€ e 8 000€ e demora 2 a 4 semanas. Para uma casa de banho premium com materiais topo de gama, o custo pode atingir 10 000€ a 15 000€.',
      },
      {
        heading: 'Substituir banheira por base de duche',
        content: 'É a remodelação mais pedida em casas de banho em Portugal. A substituição simples (remover banheira, colocar base de duche e resguardo, revestir a parede exposta) custa entre 1 200€ e 2 500€ e demora 2 a 3 dias. Esta opção é ideal quando não se quer fazer uma remodelação completa. Os benefícios são significativos: maior acessibilidade (especialmente para idosos), mais espaço útil na casa de banho, menor consumo de água, e aspeto mais moderno. A base de duche pode ser em acrílico (mais económica, 150€-300€), em resina (mais durável e estética, 300€-600€), ou embutida no pavimento com sistema de calha (mais cara mas visualmente limpa, 500€-1 000€ incluindo instalação).',
      },
      {
        heading: 'Decomposição dos custos',
        content: 'Para uma remodelação completa típica de uma casa de banho de 5-6m², os custos distribuem-se da seguinte forma. Demolição e remoção de entulho: 300€ a 600€. Impermeabilização (essencial para evitar infiltrações): 200€ a 400€. Canalização: 400€ a 800€. Eletricidade: 200€ a 400€. Revestimentos cerâmicos de parede e chão: 800€ a 2 000€ (depende muito do tipo de cerâmica). Louças sanitárias (sanita, lavatório, base de duche ou banheira): 500€ a 2 000€. Torneiras e acessórios: 200€ a 800€. Móvel de casa de banho: 200€ a 1 000€. Resguardo de duche: 200€ a 600€. Espelho e iluminação: 100€ a 400€. Mão de obra total: 1 500€ a 2 500€.',
      },
      {
        heading: 'Impermeabilização: o passo que não pode falhar',
        content: 'A impermeabilização é o passo mais importante na remodelação de uma casa de banho, mas infelizmente é muitas vezes negligenciado para poupar tempo ou dinheiro. Uma impermeabilização mal feita resulta em infiltrações que danificam o andar de baixo, bolor nas paredes, e eventualmente a necessidade de refazer toda a obra. A impermeabilização deve ser aplicada em todas as paredes da zona de banho (até pelo menos 1,80m de altura), em todo o pavimento, e nas junções parede-pavimento. Os materiais mais utilizados são membranas líquidas (aplicadas como tinta) e bandas impermeabilizantes nas junções. O custo é relativamente baixo (200€-400€) comparado com o custo de reparar infiltrações depois (que pode facilmente ultrapassar os 2 000€).',
      },
      {
        heading: 'Tendências de design 2026',
        content: 'As casas de banho em Portugal estão a seguir várias tendências em 2026. Os revestimentos de grande formato (60x120cm ou maiores) são cada vez mais populares — menos juntas significa menos manutenção e aspeto mais limpo. As cores neutras e naturais dominam — tons de bege, cinza suave e branco quente em vez do branco frio tradicional. Os móveis suspensos são preferidos por facilitarem a limpeza do chão. A iluminação LED integrada em espelhos e nichos substitui as tradicionais lâmpadas de teto. Torneiras de cor preta ou dourada escovada substituem o cromado clássico. Bases de duche niveladas com o pavimento (walk-in) são a escolha premium. Nichos embutidos na parede do duche substituem as tradicionais prateleiras para produtos.',
      },
    ],
    ctaText: 'Quer remodelar a sua casa de banho? Orçamento gratuito e detalhado na VITFIX.',
    relatedServices: ['obras-remodelacao', 'canalizador', 'impermeabilizacao'],
    searchVolume: '500-1500/mois, forte hausse',
  },
  {
    slug: 'capoto-isolamento-termico-quanto-custa',
    title: 'Capoto e Isolamento Térmico: Quanto Custa e Vale a Pena?',
    metaTitle: 'Capoto (ETICS) em Portugal: Preços 2026, Vantagens e Poupança | VITFIX',
    metaDesc: 'Quanto custa aplicar capoto (ETICS) em Portugal? Preços por m², poupança energética, materiais e tudo o que precisa saber. Guia completo 2026.',
    category: 'isolamento',
    icon: '🏠',
    datePublished: '2026-02-20',
    intro: 'O capoto, tecnicamente conhecido como sistema ETICS (External Thermal Insulation Composite System), é uma das soluções mais eficazes para melhorar a eficiência energética de uma casa. Com os custos de energia em alta e incentivos fiscais disponíveis, o isolamento térmico pelo exterior tornou-se um dos investimentos mais inteligentes para proprietários em Portugal.',
    sections: [
      {
        heading: 'O que é o capoto e como funciona',
        content: 'O capoto é um sistema de isolamento térmico aplicado pelo exterior das paredes de um edifício. Consiste em placas de material isolante (EPS, lã mineral ou XPS) coladas e fixadas mecanicamente à fachada existente, revestidas com uma armadura de fibra de vidro e um reboco final de acabamento. Funciona como um casaco para a casa — cria uma camada contínua de isolamento que elimina as pontes térmicas, os pontos onde o calor escapa mais facilmente. No inverno, mantém o calor dentro da casa, reduzindo a necessidade de aquecimento. No verão, impede o calor exterior de entrar, mantendo a casa mais fresca. Além do conforto térmico, protege a fachada das intempéries e dá ao edifício um aspeto renovado.',
      },
      {
        heading: 'Preços do capoto em 2026',
        content: 'O custo de aplicação de capoto em Portugal varia conforme vários fatores. O preço médio situa-se entre 40€ e 80€ por m², incluindo material e mão de obra. Para uma moradia com 150m² de fachada, o investimento total varia entre 6 000€ e 12 000€. Para um apartamento (fachada correspondente), entre 2 000€ e 5 000€. Os fatores que influenciam o preço são a espessura do isolamento (6cm, 8cm ou 10cm — mais espesso é mais caro mas mais eficaz), o tipo de isolante (EPS é mais económico, lã mineral é mais cara mas com melhor desempenho acústico e ao fogo), a complexidade da fachada (janelas, varandas, ornamentos encarecem a aplicação), a altura do edifício (andaimes para edifícios altos aumentam o custo), e o tipo de acabamento final.',
      },
      {
        heading: 'Poupança energética real',
        content: 'A poupança energética com capoto é significativa e documentada. Em casas sem isolamento no Norte de Portugal (onde se incluem Marco de Canaveses, Penafiel e Amarante), o capoto pode reduzir os custos de aquecimento entre 25% e 40%. Para uma família que gasta 1 200€ por ano em aquecimento (gás, eletricidade, pellets), isto representa uma poupança de 300€ a 480€ anuais. Considerando também a poupança em arrefecimento no verão, a poupança total pode atingir 500€ a 800€ por ano. Com um investimento de 8 000€ a 10 000€, o retorno do investimento situa-se tipicamente entre 10 e 16 anos. Além da poupança direta, o isolamento valoriza o imóvel ao melhorar a classe energética — um fator cada vez mais importante na compra e venda de casas.',
      },
      {
        heading: 'EPS vs. lã mineral: qual escolher',
        content: 'Os dois materiais isolantes mais utilizados em sistemas ETICS são o EPS (poliestireno expandido) e a lã mineral. O EPS é mais económico (custo 15-20% inferior), mais leve e mais fácil de trabalhar. Tem excelente desempenho térmico e é a escolha mais comum para moradias e edifícios baixos. A sua principal limitação é o comportamento ao fogo (classe E) e o facto de não oferecer isolamento acústico significativo. A lã mineral é incombustível (classe A1 ao fogo), o que a torna obrigatória em edifícios com mais de 28 metros de altura e recomendada para zonas com requisitos específicos de proteção contra incêndio. Oferece também melhor isolamento acústico. O seu custo é 15-25% superior ao EPS. Para a maioria das moradias e edifícios baixos na região de Marco de Canaveses, o EPS é a escolha mais adequada e económica.',
      },
      {
        heading: 'Incentivos fiscais e apoios',
        content: 'Existem vários incentivos que tornam o isolamento térmico mais acessível em Portugal. O IVA reduzido de 6% aplica-se a obras de isolamento em habitações com mais de 2 anos, representando uma poupança significativa face à taxa normal de 23%. O Fundo Ambiental disponibiliza periodicamente apoios para eficiência energética residencial, que podem cobrir até 70% do custo do isolamento (com limites máximos por habitação). O PRR (Plano de Recuperação e Resiliência) inclui programas de eficiência energética para edifícios. Alguns municípios oferecem isenções ou reduções de taxas para obras que melhorem a eficiência energética. Consulte a ADENE (Agência para a Energia) e a sua câmara municipal para informação atualizada sobre os apoios disponíveis.',
      },
      {
        heading: 'O processo de aplicação',
        content: 'A aplicação de capoto segue um processo estruturado que demora geralmente entre 1 e 3 semanas para uma moradia. Primeiro, faz-se a preparação da fachada — limpeza, reparação de fissuras e tratamento de eventuais problemas de humidade. Depois, aplicam-se os perfis de arranque na base e os perfis de canto. As placas de isolamento são coladas com argamassa e fixadas mecanicamente com buchas. A camada de base (argamassa armada com rede de fibra de vidro) é aplicada sobre as placas. Após secagem, aplica-se o primário e o revestimento final de acabamento. O processo deve ser executado em condições climatéricas adequadas — sem chuva e com temperaturas entre 5°C e 35°C. A qualidade da aplicação é determinante para a durabilidade do sistema, que pode ultrapassar os 25 anos se bem executado.',
      },
    ],
    ctaText: 'Quer aplicar capoto na sua casa? Orçamento gratuito e sem compromisso na VITFIX.',
    relatedServices: ['isolamento-termico'],
    searchVolume: '100-400/mois, forte hausse',
  },
  {
    slug: 'como-escolher-empreiteiro-confianca',
    title: 'Como Escolher um Empreiteiro de Confiança em Portugal',
    metaTitle: 'Como Escolher um Empreiteiro de Confiança? Guia Completo | VITFIX',
    metaDesc: 'Como escolher um empreiteiro de confiança para obras em Portugal? Critérios, sinais de alerta, garantias e direitos do consumidor. Guia prático.',
    category: 'obras',
    icon: '🤝',
    datePublished: '2026-03-01',
    intro: 'Escolher o empreiteiro certo é provavelmente a decisão mais importante de qualquer obra. Um bom empreiteiro transforma a experiência de remodelar numa operação tranquila. Um mau empreiteiro pode transformá-la num pesadelo de atrasos, custos adicionais e trabalho mal feito. Este guia ajuda-o a tomar a decisão certa.',
    sections: [
      {
        heading: 'Critérios essenciais de seleção',
        content: 'Antes de contratar um empreiteiro, verifique estes critérios fundamentais. O alvará ou título de registo no IMPIC (Instituto dos Mercados Públicos, do Imobiliário e da Construção) é obrigatório para empresas de construção em Portugal. Peça o número e verifique no site do IMPIC. O seguro de responsabilidade civil protege-o em caso de danos causados durante a obra. O seguro de acidentes de trabalho é obrigatório e protege os trabalhadores na sua obra. Referências de trabalhos anteriores — peça contactos de clientes anteriores e, se possível, visite obras já concluídas. Experiência documentada no tipo de obra que pretende — uma empresa especializada em construção nova pode não ser a melhor para uma remodelação, e vice-versa.',
      },
      {
        heading: 'Sinais de alerta — quando não contratar',
        content: 'Esteja atento a estes sinais que indicam potenciais problemas. Recusa em apresentar orçamento detalhado por escrito — um profissional sério formaliza sempre a proposta. Pedido de pagamento integral ou maioritário antes de começar a obra — o habitual é um adiantamento de 10-20% e pagamentos faseados conforme o progresso. Preço muito abaixo dos outros orçamentos — pode significar que vai usar materiais inferiores, subcontratar a preços muito baixos, ou que não incluiu tudo no orçamento. Sem NIF ou empresa registada — significa que não pode emitir fatura e o trabalho não terá garantia legal. Indisponibilidade para assinar contrato — um contrato protege ambas as partes e é essencial para obras de valor significativo. Pressão para decidir rapidamente — um profissional de confiança dá-lhe tempo para pensar e comparar.',
      },
      {
        heading: 'O orçamento: o que deve incluir',
        content: 'Um bom orçamento deve ser detalhado e incluir a descrição pormenorizada de todos os trabalhos a realizar (por item ou por divisão), os materiais a utilizar (marca, modelo, quantidade), o custo da mão de obra separado dos materiais, o prazo de execução previsto (data de início e de conclusão), as condições de pagamento (faseamento, meios de pagamento), o prazo de validade do orçamento, a taxa de IVA aplicável (6% ou 23%), o que está e o que não está incluído (remoção de entulho, limpeza final, licenças), e as condições de revisão de preço em caso de imprevistos. Compare orçamentos item a item, não apenas o total — o mais barato no total pode ter os mesmos serviços a preços diferentes, com alguns itens subvalorizados que serão cobrados como extra durante a obra.',
      },
      {
        heading: 'O contrato de empreitada',
        content: 'Para obras acima de 5 000€, um contrato escrito é altamente recomendado. O contrato deve incluir a identificação completa das partes (nome, NIF, morada), a descrição detalhada dos trabalhos (pode remeter para o orçamento como anexo), o preço total e as condições de pagamento, o prazo de execução e as penalizações por atraso, a garantia sobre os trabalhos (mínimo legal é 5 anos para defeitos estruturais, 2 anos para outros defeitos), as condições de resolução do contrato por ambas as partes, a responsabilidade por imprevistos e trabalhos adicionais, e o seguro de responsabilidade civil e acidentes de trabalho. Um contrato bem feito previne a maioria dos conflitos e dá-lhe proteção legal em caso de problemas.',
      },
      {
        heading: 'Pagamentos: como estruturar',
        content: 'A estrutura de pagamento mais segura para o cliente é a seguinte: 10-20% como adiantamento na assinatura do contrato ou início da obra (para o empreiteiro comprar materiais iniciais), pagamentos faseados conforme marcos da obra (por exemplo, 20% após demolição e trabalhos de preparação, 20% após canalização e eletricidade, 20% após revestimentos, 20% na conclusão), e 5-10% retidos durante 30 dias após conclusão para garantir que não surgem problemas. Nunca pague a totalidade antecipadamente. Nunca pague em dinheiro sem recibo. Exija sempre fatura com IVA. Condicione cada pagamento à conclusão satisfatória da fase correspondente. Se o empreiteiro pedir adiantamentos muito elevados, pode indicar problemas de tesouraria — um sinal de alerta.',
      },
      {
        heading: 'Garantias e direitos do consumidor',
        content: 'Em Portugal, os seus direitos como consumidor em obras de construção e remodelação são protegidos pela lei. A garantia legal para defeitos em obras de construção e remodelação é de 5 anos para defeitos estruturais (fundações, paredes, telhado) e de 2 anos para defeitos em equipamentos e acabamentos. Se detetar defeitos dentro do prazo de garantia, deve comunicar por escrito ao empreiteiro no prazo de 1 ano após a deteção. O empreiteiro é obrigado a reparar os defeitos gratuitamente. Se o empreiteiro não reparar no prazo acordado, pode contratar outro profissional e exigir o reembolso. Em caso de litígio, pode recorrer ao Centro de Arbitragem de Conflitos de Consumo da sua região. Guarde sempre toda a documentação: contrato, orçamento, faturas, e comunicações escritas (email, mensagens).',
      },
    ],
    ctaText: 'Procura um empreiteiro de confiança? Na VITFIX, todos os profissionais são verificados e com garantia.',
    relatedServices: ['obras-remodelacao'],
    searchVolume: '200-500/mois, stable',
  },
  {
    slug: 'substituir-banheira-base-duche-preco',
    title: 'Substituir Banheira por Base de Duche: Preços e Guia Completo',
    metaTitle: 'Substituir Banheira por Base de Duche: Preço 2026 Portugal | VITFIX',
    metaDesc: 'Quanto custa substituir a banheira por base de duche em Portugal? Preços por tipo, materiais, vantagens e processo completo. Guia atualizado 2026.',
    category: 'canalizacao',
    icon: '🛁',
    datePublished: '2026-03-01',
    intro: 'A substituição da banheira por uma base de duche é a remodelação de casa de banho mais pedida em Portugal. As razões são claras: mais espaço, maior acessibilidade, menos consumo de água e um aspeto mais moderno. Mas quanto custa realmente? Este guia apresenta os preços detalhados para 2026.',
    sections: [
      {
        heading: 'Preços por tipo de substituição',
        content: 'O custo varia conforme a complexidade da intervenção. A substituição simples — remover a banheira, colocar uma base de duche standard em acrílico, resguardo de vidro simples e revestir a parede exposta — custa entre 800€ e 1 500€ e demora 1 a 2 dias. A substituição intermédia — base de duche em resina, resguardo de vidro temperado fixo, revestimento cerâmico novo na zona do duche e nova torneira — custa entre 1 500€ e 2 500€ e demora 2 a 3 dias. A substituição premium — base de duche encastrada no pavimento (walk-in), painel de vidro à medida, revestimento cerâmico em toda a casa de banho, nicho embutido e nova torneira termostática — custa entre 2 500€ e 4 500€ e demora 3 a 5 dias.',
      },
      {
        heading: 'Tipos de bases de duche e preços',
        content: 'A escolha da base de duche influencia significativamente o preço final. A base em acrílico é a mais económica, custando entre 80€ e 200€. É leve, fácil de instalar e disponível em muitas dimensões. A sua principal desvantagem é que pode amarelecer com o tempo e risca com relativa facilidade. A base em resina (tipo Stonex ou equivalente) custa entre 200€ e 500€. É mais resistente, disponível em cores e texturas variadas e tem uma aparência premium. A base em cerâmica custa entre 150€ e 350€. É durável e fácil de limpar, mas mais pesada e frágil a impactos. A base embutida no pavimento (walk-in) custa entre 400€ e 800€ incluindo o trabalho de encastramento. Oferece o visual mais moderno e elimina a necessidade de entrada elevada, sendo ideal para acessibilidade.',
      },
      {
        heading: 'Resguardos de duche: opções e preços',
        content: 'O resguardo é o segundo componente mais importante (e visível) da substituição. A cortina de duche é a opção mais económica (20€-50€) mas menos estética e durável. O resguardo em acrílico custa entre 100€ e 200€ — leve e económico mas pode tornar-se opaco com o tempo. O painel fixo de vidro temperado custa entre 150€ e 350€ — a opção mais popular em remodelações modernas, com visual limpo e manutenção fácil. A porta de vidro de correr custa entre 250€ e 500€ — ideal para espaços reduzidos. A porta de vidro pivotante custa entre 300€ e 600€ — oferece maior abertura mas necessita de espaço para abrir. O vidro temperado com tratamento anti-calcário facilita a limpeza e mantém a transparência.',
      },
      {
        heading: 'Vantagens da base de duche vs. banheira',
        content: 'A substituição oferece múltiplas vantagens. Em termos de espaço, uma base de duche ocupa geralmente menos área do que uma banheira, libertando espaço na casa de banho. A acessibilidade melhora significativamente, especialmente para idosos ou pessoas com mobilidade reduzida — entrar e sair de um duche é muito mais fácil e seguro do que de uma banheira. O consumo de água reduz-se drasticamente: um duche de 5 minutos consome cerca de 50 litros, enquanto encher uma banheira requer 150 a 200 litros. Com as tarifas de água em Portugal, isto pode representar uma poupança de 200€ a 400€ por ano para uma família. A limpeza é mais fácil e rápida. E o aspeto da casa de banho moderniza-se instantaneamente.',
      },
      {
        heading: 'O processo passo a passo',
        content: 'O processo típico de substituição segue estas etapas. No primeiro dia, o profissional remove a banheira (cortando-a se necessário para facilitar a remoção), desliga e ajusta a canalização para a nova posição da base de duche, e prepara o pavimento (nivelamento, impermeabilização). No segundo dia, instala a base de duche com o ralo e a ligação ao esgoto, reveste a parede exposta (onde antes estava a banheira) com azulejo ou outro material impermeável, e instala a torneira do duche. No terceiro dia (se aplicável), monta o resguardo de vidro, faz os acabamentos finais (silicone, perfis, acessórios), e limpa o espaço. O processo pode ser mais rápido (1 dia) para substituições simples ou mais longo (4-5 dias) se incluir remodelação completa da casa de banho.',
      },
      {
        heading: 'Preços na região do Tâmega e Sousa',
        content: 'Na região de Marco de Canaveses, Penafiel e Amarante, os preços de substituição de banheira são geralmente 10% a 15% inferiores aos praticados no centro do Porto. Isto deve-se a custos operacionais mais baixos e menor pressão de procura. Uma substituição simples pode custar a partir de 700€ na região, enquanto no Porto raramente desce abaixo dos 900€. A disponibilidade de profissionais é geralmente boa, com prazos de espera de 1 a 2 semanas para agendamento. Na VITFIX, todos os canalizadores são verificados, dão garantia de 2 anos sobre o trabalho e apresentam orçamento detalhado antes de iniciar, sem surpresas no final.',
      },
    ],
    ctaText: 'Quer substituir a banheira por base de duche? Orçamento gratuito na VITFIX.',
    relatedServices: ['canalizador', 'obras-remodelacao'],
    searchVolume: '1000-3000/mois, forte hausse',
  },
  {
    slug: 'trocar-caixilharia-preco-portugal',
    title: 'Trocar Caixilharia: Preços PVC vs Alumínio em 2026',
    metaTitle: 'Trocar Caixilharia: Preços PVC vs Alumínio Portugal 2026 | VITFIX',
    metaDesc: 'Quanto custa trocar a caixilharia em Portugal? Comparação PVC vs alumínio, preços por janela, poupança energética e quando vale a pena. Guia 2026.',
    category: 'obras',
    icon: '🪟',
    datePublished: '2026-03-05',
    intro: 'As janelas são um dos pontos mais críticos para o conforto térmico e acústico de uma casa. Janelas antigas de vidro simples e caixilho de alumínio sem corte térmico podem ser responsáveis por até 30% das perdas de calor no inverno. Trocar a caixilharia é um investimento que se paga em conforto e poupança energética. Mas quanto custa e qual o material certo para si?',
    sections: [
      {
        heading: 'Preços de caixilharia por material em 2026',
        content: 'Os preços variam significativamente conforme o material e as dimensões da janela. O alumínio com corte térmico custa entre 250€ e 500€ por janela standard (120×120cm), incluindo vidro duplo e instalação. É o material mais popular em Portugal, resistente à corrosão e disponível em muitas cores. O PVC custa entre 200€ e 450€ por janela standard. Oferece excelente isolamento térmico e acústico, baixa manutenção e boa relação qualidade-preço. A madeira custa entre 350€ e 700€ por janela. Oferece o melhor aspeto estético e isolamento natural, mas exige manutenção periódica (envernizamento a cada 3-5 anos). O alumínio-madeira (exterior em alumínio, interior em madeira) custa entre 500€ e 900€ — combina a resistência do alumínio com a estética da madeira.',
      },
      {
        heading: 'PVC vs Alumínio: comparação detalhada',
        content: 'A escolha entre PVC e alumínio depende das suas prioridades. Em isolamento térmico, o PVC é superior — o material é naturalmente isolante, enquanto o alumínio conduz calor e necessita de corte térmico para ser eficaz. Em resistência e durabilidade, o alumínio é mais resistente a impactos e deformação, especialmente em janelas de grandes dimensões. Em manutenção, ambos são de baixa manutenção, mas o PVC pode amarelecer com exposição solar intensa ao longo de muitos anos. Em estética, o alumínio oferece perfis mais finos e elegantes, permitindo mais entrada de luz. O PVC tem perfis mais grossos. Em preço, o PVC é geralmente 10-20% mais económico. Em reciclabilidade, ambos são recicláveis. Para a região do Tâmega e Sousa, onde os invernos são frios e húmidos, ambos os materiais com corte térmico e vidro duplo oferecem excelente desempenho.',
      },
      {
        heading: 'Vidros: simples, duplo ou triplo?',
        content: 'O tipo de vidro é tão importante quanto o material do caixilho. O vidro simples (4mm) está presente nas janelas mais antigas e oferece isolamento térmico e acústico mínimo — se ainda tem vidro simples, a substituição é altamente recomendada. O vidro duplo (4+16+4mm com câmara de ar ou árgon) é o standard atual, reduzindo as perdas térmicas em 50-60% face ao vidro simples. Com câmara de árgon em vez de ar, o desempenho melhora mais 10-15%. O vidro duplo com controlo solar inclui uma camada metalizada que reduz o ganho de calor no verão — ideal para fachadas expostas a sul e oeste. O vidro triplo oferece o melhor isolamento possível mas é significativamente mais caro e pesado — geralmente só se justifica em climas muito frios ou em edifícios passivos.',
      },
      {
        heading: 'Quanto se poupa com caixilharia nova?',
        content: 'A substituição de caixilharia antiga por moderna com vidro duplo pode gerar poupanças significativas. Em aquecimento, a redução pode atingir 20-30% da fatura, o que para uma família que gasta 800€ por ano em aquecimento representa 160€ a 240€ de poupança anual. Em arrefecimento, vidros com controlo solar podem reduzir a necessidade de ar condicionado em 15-25%. Em conforto acústico, a redução de ruído exterior pode atingir 30-40 dB, transformando completamente a qualidade de vida em casas junto a estradas. A eliminação de correntes de ar frio junto às janelas melhora imediatamente o conforto térmico, mesmo sem alterar o sistema de aquecimento. O retorno do investimento situa-se tipicamente entre 8 e 15 anos apenas em poupança energética, sem contar a valorização do imóvel.',
      },
      {
        heading: 'Processo de substituição e prazos',
        content: 'A substituição de caixilharia é um processo relativamente rápido e limpo. Para uma casa com 8-10 janelas, o trabalho demora geralmente 2 a 3 dias. O processo inclui medição exata de todas as janelas (feita antecipadamente, com fabricação sob medida em 2-4 semanas), remoção cuidadosa da caixilharia antiga sem danificar as paredes, instalação da nova caixilharia com fixação mecânica e vedação com espuma e silicone, teste de funcionamento (abertura, fecho, estanquidade), e limpeza e recolha dos materiais antigos. A substituição de caixilharia não exige obras de alvenaria significativas na maioria dos casos, o que significa menos pó, menos barulho e menos transtorno. Em edifícios de apartamentos, pode ser necessária aprovação do condomínio se se alterar o aspeto exterior.',
      },
      {
        heading: 'Incentivos e IVA reduzido',
        content: 'A substituição de caixilharia em habitações com mais de 2 anos beneficia de IVA reduzido a 6% (em vez de 23%), o que representa uma poupança significativa. Numa obra de 5 000€, a diferença entre 23% e 6% de IVA é de 850€. Além disso, o Fundo Ambiental disponibiliza periodicamente apoios para eficiência energética que podem incluir a substituição de janelas. As novas janelas melhoram a classe energética do imóvel na certificação, o que é cada vez mais importante para venda e arrendamento. Na região de Marco de Canaveses e Penafiel, existem bons fabricantes e instaladores locais, o que permite preços competitivos e prazos de entrega mais curtos do que na cidade do Porto.',
      },
    ],
    ctaText: 'Quer trocar a caixilharia? Peça orçamento gratuito na VITFIX — medição ao domicílio sem compromisso.',
    relatedServices: ['obras-remodelacao', 'isolamento-termico'],
    searchVolume: '500-2000/mois, forte hausse',
  },
  {
    slug: 'desentupir-canos-preco',
    title: 'Desentupir Canos: Preços, Métodos e Quando Chamar um Profissional',
    metaTitle: 'Desentupir Canos: Preço em Portugal 2026, Métodos e Dicas | VITFIX',
    metaDesc: 'Quanto custa desentupir canos em Portugal? Preços por tipo de entupimento, métodos profissionais vs. caseiros e quando chamar um canalizador.',
    category: 'canalizacao',
    icon: '🔧',
    datePublished: '2026-03-08',
    intro: 'Os entupimentos são um dos problemas de canalização mais comuns e incómodos. Podem afetar lavatórios, sanitas, banheiras, ralos de chuveiro e até a canalização principal do edifício. Saber quando pode resolver sozinho e quando precisa de um profissional pode poupar-lhe tempo e dinheiro.',
    sections: [
      {
        heading: 'Preços de desentupimento em 2026',
        content: 'Os custos variam conforme o tipo e a localização do entupimento. O desentupimento simples de lavatório ou lava-loiça (com ventosa ou mola manual) custa entre 40€ e 80€. O desentupimento de sanita custa entre 50€ e 100€. O desentupimento de banheira ou base de duche entre 40€ e 90€. O desentupimento com mola elétrica profissional (para obstruções mais profundas) custa entre 80€ e 150€. O desentupimento com hidropressão (jato de água a alta pressão, para esgotos e canalizações principais) custa entre 120€ e 300€. A inspeção com câmara de vídeo (para localizar obstruções ou danos na canalização) custa entre 80€ e 200€. Estes valores incluem deslocação e mão de obra na região do Tâmega e Sousa.',
      },
      {
        heading: 'Métodos caseiros que funcionam',
        content: 'Antes de chamar um profissional, experimente estes métodos caseiros para entupimentos ligeiros. O desentupidor de borracha (ventosa) é a primeira ferramenta a usar — funciona por pressão e sucção alternadas para deslocar a obstrução. Coloque-o sobre o ralo, cubra com água e faça movimentos vigorosos de bombeamento. Para entupimentos causados por gordura no lava-loiça, deite água a ferver em abundância — a água quente dissolve a gordura acumulada. O bicarbonato de sódio com vinagre pode ajudar: deite meia chávena de bicarbonato pelo ralo, seguido de meia chávena de vinagre branco. Espere 30 minutos e depois lave com água quente. Para ralos de chuveiro ou lavatório, frequentemente o problema é acumulação de cabelos — use um gancho fino ou uma ferramenta própria para remover os cabelos acumulados no sifão.',
      },
      {
        heading: 'O que NÃO fazer: erros comuns',
        content: 'Alguns métodos populares podem piorar a situação ou danificar a canalização. Os produtos químicos desentupidores agressivos (tipo ácido ou soda cáustica) podem corroer as tubagens, especialmente se forem antigas em PVC ou ferro. Se o produto não resolver o entupimento, fica retido na canalização e pode ser perigoso quando o canalizador intervém. Nunca use arames improvisados ou objetos pontiagudos — podem perfurar os canos ou empurrar a obstrução para uma zona mais difícil de alcançar. Não aplique pressão excessiva com mangueira de jardim — pode rebentar juntas ou ligações em tubagens envelhecidas. Não despeje grandes quantidades de lixívia — além de ineficaz contra a maioria dos entupimentos, é tóxica e danifica as juntas de borracha dos sifões.',
      },
      {
        heading: 'Quando chamar um profissional',
        content: 'Algumas situações exigem intervenção profissional. Se o entupimento não cede com ventosa e água quente após 2-3 tentativas, é provável que a obstrução seja mais profunda ou mais sólida do que métodos caseiros conseguem resolver. Se vários ralos entopem simultaneamente (lavatório e sanita, por exemplo), o problema está na canalização principal e necessita de equipamento profissional. Se ouve sons de borbulhar quando usa um ralo diferente do entupido, há uma obstrução na ventilação ou na canalização partilhada. Se há mau cheiro persistente de esgoto, pode indicar uma obstrução parcial ou um problema no sifão. Se nota que a água do esgoto volta a subir pelo ralo ou pela sanita, o entupimento pode ser na canalização do edifício e requer intervenção urgente.',
      },
      {
        heading: 'Prevenção: como evitar entupimentos',
        content: 'A maioria dos entupimentos é evitável com hábitos simples. Nunca deite gordura, óleo de cozinha ou restos de comida pelo ralo do lava-loiça — são a causa número um de entupimentos em cozinhas. Use um filtro ou rede no ralo para reter resíduos sólidos. Nos chuveiros e lavatórios, instale um filtro de cabelos — pequeno investimento que evita o problema mais comum nestas divisões. Não deite toalhitas húmidas, cotonetes, fio dental ou pensos na sanita — mesmo os que dizem ser biodegradáveis podem causar entupimentos. Faça uma limpeza preventiva mensal: deite água a ferver pelos ralos da cozinha para dissolver acumulações de gordura. Limpe os sifões dos lavatórios a cada 3-4 meses, removendo detritos acumulados. Se vive numa casa com canalização antiga (pré-1980), considere uma inspeção profissional com câmara de vídeo para avaliar o estado das tubagens.',
      },
    ],
    ctaText: 'Canos entupidos? Os canalizadores VITFIX resolvem no próprio dia. Orçamento gratuito.',
    relatedServices: ['canalizador'],
    searchVolume: '500-1500/mois, stable',
  },
  {
    slug: 'reparar-telhado-preco-portugal',
    title: 'Reparar Telhado: Quanto Custa em Portugal? Guia de Preços 2026',
    metaTitle: 'Reparar Telhado: Preços Portugal 2026, Tipos de Reparação | VITFIX',
    metaDesc: 'Quanto custa reparar um telhado em Portugal em 2026? Preços por tipo de reparação, materiais e quando substituir. Guia completo com custos detalhados.',
    category: 'impermeabilizacao',
    icon: '🏠',
    datePublished: '2026-03-10',
    intro: 'O telhado é a primeira linha de defesa da sua casa contra as intempéries. Quando começa a falhar — goteiras, telhas partidas, caleiras entupidas — os danos podem escalar rapidamente se não forem tratados a tempo. Mas quanto custa reparar um telhado em Portugal? Este guia apresenta os preços reais praticados em 2026.',
    sections: [
      {
        heading: 'Preços de reparação de telhado por tipo',
        content: 'O custo depende do tipo e extensão da reparação necessária. Substituição pontual de telhas partidas ou deslocadas: 150€ a 400€ (incluindo material, mão de obra e andaime para áreas pequenas). Reparação de rufos (peças metálicas nas junções): 100€ a 300€ por rufo. Limpeza e desentupimento de caleiras: 100€ a 250€ para uma casa completa. Substituição de caleiras: 15€ a 30€ por metro linear. Reparação de sub-telha danificada: 20€ a 40€ por m². Retelhamento completo (substituir todas as telhas mantendo a estrutura): 30€ a 50€ por m². Substituição completa de telhado (estrutura + sub-telha + telhas + isolamento): 80€ a 150€ por m². Para um telhado médio de 100m², uma reparação completa pode custar entre 8 000€ e 15 000€.',
      },
      {
        heading: 'Tipos de telha e custos',
        content: 'Em Portugal, existem vários tipos de telha utilizados. A telha cerâmica (Lusa, Marselha, canudo) é a mais tradicional e comum. Custa entre 0,50€ e 1,50€ por unidade conforme o modelo. É durável (30-50 anos), disponível em várias cores e com excelente relação qualidade-preço. A telha de betão é mais pesada mas mais resistente a impactos. Custa entre 0,40€ e 1€ por unidade. A sua principal desvantagem é o peso, que pode exigir uma estrutura mais robusta. A telha metálica (painel sandwich) custa entre 15€ e 30€ por m² e é ideal para coberturas de garagens, armazéns e anexos — instalação rápida e boa impermeabilização. A telha fotovoltaica é a novidade — integra painéis solares no próprio telhado, mas o custo é significativamente mais alto (150€-300€ por m²). Para a maioria das casas na região do Tâmega e Sousa, a telha cerâmica continua a ser a melhor escolha.',
      },
      {
        heading: 'Sinais de que o telhado precisa de reparação',
        content: 'Alguns sinais indicam que o seu telhado precisa de atenção. Manchas de humidade no teto interior, especialmente após chuva, são o sinal mais óbvio de uma infiltração ativa. Telhas visíveis partidas, deslocadas ou em falta — podem ser vistas do chão ou, melhor, com binóculos. Caleiras com vegetação crescendo ou visivelmente desalinhadas — caleiras entupidas causam transbordo que danifica fachadas e fundações. Bolor ou manchas escuras na face interior do telhado (visíveis do sótão) indicam humidade persistente. Luz visível através do telhado quando se está no sótão significa telhas partidas ou deslocadas. Acumulação de pequenos fragmentos de telha nas caleiras indica deterioração. Aumento inexplicável da fatura de aquecimento pode indicar perda de isolamento no telhado.',
      },
      {
        heading: 'Reparar vs. substituir: quando vale a pena',
        content: 'A decisão entre reparar ou substituir o telhado depende de vários fatores. Se o telhado tem menos de 20 anos e os problemas são pontuais (telhas partidas, rufos danificados), a reparação é quase sempre a melhor opção. Se tem entre 20 e 40 anos com problemas recorrentes (infiltrações em vários pontos, várias reparações nos últimos anos), considere o retelhamento — substituir as telhas mantendo a estrutura de madeira se esta estiver em bom estado. Se tem mais de 40 anos, especialmente com estrutura de madeira deteriorada, a substituição completa pode ser a opção mais económica a longo prazo. Como referência, se o custo acumulado de reparações nos últimos 5 anos ultrapassa 30% do custo de um telhado novo, a substituição é provavelmente a decisão mais inteligente.',
      },
      {
        heading: 'Manutenção preventiva do telhado',
        content: 'A manutenção regular é a melhor forma de prolongar a vida do telhado e evitar reparações caras. Limpe as caleiras e ralos pelo menos duas vezes por ano — no outono (após a queda das folhas) e na primavera. Inspecione visualmente o telhado após tempestades ou ventos fortes, procurando telhas deslocadas ou partidas. Corte ramos de árvores que toquem ou se aproximem do telhado — podem deslocar telhas e acumular folhas. Verifique os rufos e vedações à volta de chaminés, claraboias e ventilações. No sótão (se acessível), verifique a estrutura de madeira à procura de sinais de humidade, bolor ou insetos xilófagos (caruncho). Considere uma inspeção profissional a cada 5 anos, especialmente em telhados com mais de 20 anos. O custo de uma inspeção (100€-200€) é insignificante comparado com o custo de danos de infiltração não detetados a tempo.',
      },
    ],
    ctaText: 'Precisa de reparar o telhado? Na VITFIX, fazemos diagnóstico gratuito e orçamento sem compromisso.',
    relatedServices: ['impermeabilizacao'],
    searchVolume: '500-1500/mois, stable',
  },
  {
    slug: 'microcimento-casa-de-banho-preco',
    title: 'Microcimento na Casa de Banho: Preço, Vantagens e Aplicação',
    metaTitle: 'Microcimento na Casa de Banho: Preço Portugal 2026 e Guia | VITFIX',
    metaDesc: 'Quanto custa aplicar microcimento na casa de banho? Preços por m², vantagens vs. azulejo, manutenção e processo de aplicação. Guia completo 2026.',
    category: 'obras',
    icon: '✨',
    datePublished: '2026-03-12',
    intro: 'O microcimento tornou-se uma das tendências mais populares em remodelação de casas de banho em Portugal. Este revestimento contínuo, sem juntas, oferece um visual moderno e minimalista que transforma completamente o espaço. Mas será que é a escolha certa para a sua casa de banho? E quanto custa realmente?',
    sections: [
      {
        heading: 'Preços de microcimento em 2026',
        content: 'O custo de aplicação de microcimento em casa de banho varia conforme a área, a marca e a complexidade. O preço médio de aplicação situa-se entre 60€ e 120€ por m², incluindo material e mão de obra. Para uma casa de banho típica de 5-6m² (paredes e chão), o custo total varia entre 1 500€ e 3 500€. A aplicação apenas no chão custa menos (800€-1 500€ para a mesma área). A aplicação sobre azulejos existentes (sem demolição) é possível e poupa significativamente no custo de preparação. As marcas premium como Topciment, Luxury Concrete ou Sika podem custar até 150€ por m², mas oferecem melhor durabilidade e acabamento.',
      },
      {
        heading: 'Microcimento vs. azulejo: comparação',
        content: 'A decisão entre microcimento e azulejo depende das suas prioridades. Em estética, o microcimento oferece um visual contínuo sem juntas, moderno e minimalista. O azulejo oferece maior variedade de padrões e cores, incluindo opções decorativas tradicionais. Em durabilidade, o azulejo de boa qualidade dura décadas sem manutenção. O microcimento dura 15-20 anos com manutenção adequada. Em impermeabilidade, o azulejo é naturalmente impermeável. O microcimento necessita de selante protetor que deve ser reaplicado a cada 2-3 anos para manter a impermeabilidade. Em preço, o azulejo de qualidade média custa entre 30€ e 60€/m² instalado. O microcimento custa entre 60€ e 120€/m² — significativamente mais caro. Em manutenção, o azulejo exige limpeza das juntas. O microcimento exige reaplicação periódica de selante.',
      },
      {
        heading: 'Processo de aplicação',
        content: 'A aplicação de microcimento é um trabalho especializado que exige experiência. O processo demora geralmente 5 a 7 dias para uma casa de banho completa, incluindo tempos de secagem. Primeiro, prepara-se a superfície — sobre azulejos existentes, aplica-se um primário de aderência. Sobre reboco, verifica-se a planimetria e corrige-se irregularidades. Depois aplicam-se duas camadas de microcimento base, com secagem entre camadas. Seguem-se duas camadas de microcimento de acabamento, lixadas entre si para obter a textura desejada. Finalmente, aplicam-se duas a três camadas de selante impermeabilizante. É fundamental que a aplicação seja feita por um profissional experiente — um aplicador inexperiente pode resultar em fissuras, descolamento ou problemas de impermeabilidade. Peça sempre para ver trabalhos anteriores antes de contratar.',
      },
      {
        heading: 'Manutenção e cuidados',
        content: 'O microcimento requer cuidados específicos para manter o seu aspeto e impermeabilidade. A limpeza diária deve ser feita com produtos neutros — evite produtos abrasivos, lixívia concentrada ou ácidos. O selante protetor deve ser reaplicado a cada 2 a 3 anos (custo de manutenção: 10€-20€ por m²). Evite deixar água parada sobre o microcimento durante longos períodos. Limpe imediatamente manchas de produtos corados (vinho, café, tinta de cabelo). Não arraste objetos pesados sobre o pavimento em microcimento. Com manutenção adequada, o microcimento mantém o seu aspeto durante 15 a 20 anos. Sem manutenção, pode começar a apresentar manchas e perda de impermeabilidade após 3 a 5 anos.',
      },
      {
        heading: 'É adequado para todas as casas de banho?',
        content: 'O microcimento é versátil mas não é ideal para todas as situações. É uma excelente escolha para casas de banho modernas onde se pretende um visual contínuo e minimalista, para remodelações onde se quer evitar demolição de azulejos (pode ser aplicado por cima), e para quem valoriza a estética acima de tudo. Pode não ser a melhor escolha para casas de banho muito húmidas sem ventilação adequada (a manutenção será mais frequente), para quem não quer preocupar-se com manutenção periódica (o azulejo é mais prático), para orçamentos reduzidos (o azulejo oferece melhor relação custo-durabilidade), e para zonas com muito uso e desgaste (chão de duche walk-in, por exemplo). Na região do Tâmega e Sousa, o microcimento está a tornar-se cada vez mais popular em remodelações, com vários aplicadores locais especializados.',
      },
    ],
    ctaText: 'Quer aplicar microcimento na sua casa de banho? Peça orçamento gratuito na VITFIX.',
    relatedServices: ['obras-remodelacao', 'pintor'],
    searchVolume: '500-2000/mois, forte hausse',
  },

  // ── Problem-specific articles (low competition, high conversion) ──

  {
    slug: 'torneira-a-pingar-como-reparar',
    title: 'Torneira a Pingar — Causas e Como Reparar (Guia 2026)',
    metaTitle: 'Torneira a Pingar — Causas e Como Reparar | VITFIX',
    metaDesc: 'A sua torneira pinga constantemente? Descubra as causas mais comuns (vedante, cartucho, pressão) e quando chamar um canalizador. Guia prático.',
    category: 'canalizacao',
    icon: '💧',
    datePublished: '2026-03-15',
    intro: 'Uma torneira a pingar é um dos problemas domésticos mais comuns — e mais ignorados. Para além do ruído irritante, uma torneira a pingar desperdiça em média 15 a 20 litros de água por dia, o que representa mais de 5 000 litros por ano e um acréscimo significativo na conta de água. Neste guia, explicamos as causas mais frequentes, como diagnosticar o problema e quando vale a pena reparar ou substituir.',
    sections: [
      {
        heading: 'Porque é que a torneira pinga?',
        content: 'As causas mais comuns de uma torneira a pingar são: vedante (O-ring) desgastado — é a causa mais frequente, especialmente em torneiras com mais de 5 anos. O vedante de borracha que sela a passagem de água perde elasticidade e começa a deixar passar água. Cartucho cerâmico danificado — nas torneiras monocomando (as mais comuns hoje em dia), o cartucho cerâmico interior controla o fluxo de água. Com o tempo, depósitos de calcário ou desgaste natural fazem com que o cartucho perca vedação. Sede da válvula corroída — a superfície metálica onde o vedante assenta pode ficar corroída ou irregular, impedindo uma vedação correta. Pressão de água excessiva — se a pressão na rede for superior a 4 bar, as torneiras podem começar a pingar, especialmente durante a noite quando a pressão tende a aumentar. Instalação incorreta — torneiras mal instaladas ou com peças incompatíveis podem apresentar fugas desde o início.'
      },
      {
        heading: 'Torneira da cozinha vs. casa de banho',
        content: 'Na cozinha, as torneiras sofrem mais desgaste porque são usadas dezenas de vezes por dia e frequentemente com movimentos bruscos. O contacto com resíduos alimentares e produtos de limpeza também acelera a deterioração dos vedantes. As torneiras de cozinha com chuveiro extensível têm peças adicionais (mangueira, ligações) que são pontos frequentes de fuga. Na casa de banho, o problema mais comum é o calcário — a água quente do duche deposita calcário no cartucho cerâmico, reduzindo a sua capacidade de vedação ao longo do tempo. Torneiras de bidé e lavatório antigas (tipo torneira de cruzeta) usam vedantes de borracha que se desgastam facilmente. A torneira do duche ou banheira pode pingar pelo manípulo, pela saída de água ou pela ligação à mangueira do chuveiro — cada caso tem uma causa diferente.'
      },
      {
        heading: 'Reparar ou substituir?',
        content: 'A regra geral é: se a torneira tem menos de 8-10 anos e é de qualidade razoável, vale a pena reparar. A substituição do vedante ou cartucho custa entre 5€ e 30€ em peças, mais a mão de obra do canalizador (40€ a 80€ pela intervenção). Se a torneira tem mais de 10-12 anos, é de gama baixa, ou se o problema requer peças difíceis de encontrar, geralmente compensa substituir a torneira completa. Uma torneira monocomando de qualidade média custa entre 40€ e 100€ para lavatório e 80€ a 200€ para cozinha. A instalação por um canalizador acrescenta 40€ a 80€ ao custo. Portanto, o custo total de substituição ronda 80€ a 280€ dependendo do modelo escolhido.'
      },
      {
        heading: 'Posso reparar a torneira sozinho?',
        content: 'Algumas reparações simples podem ser feitas sem chamar um profissional, se tiver alguma habilidade manual. Para trocar um vedante de torneira clássica (de cruzeta): feche a água, desmonte o manípulo, retire o vedante antigo e substitua por um novo do mesmo tamanho (encontram-se em qualquer loja de bricolage por 1€ a 3€). Para trocar o cartucho de uma torneira monocomando: feche a água, retire a tampa decorativa do manípulo, desaperte o parafuso de fixação, retire o manípulo e desaperte o cartucho com uma chave adequada. Leve o cartucho antigo à loja para garantir que compra o modelo correto (custam entre 10€ e 30€). Atenção: se não conseguir identificar o problema, se a torneira tem ligações complexas, ou se ao desmontar verificar corrosão na sede da válvula, é melhor chamar um canalizador profissional para evitar danos maiores.'
      },
      {
        heading: 'Quanto desperdiça uma torneira a pingar?',
        content: 'O desperdício é maior do que parece. Uma torneira que pinga uma gota por segundo desperdiça cerca de 20 litros por dia, ou seja, mais de 7 000 litros por ano. Em termos de custo, com o preço médio da água em Portugal (cerca de 2€ por m³), isto representa um desperdício de 14€ a 20€ por ano — apenas para uma torneira. Se tiver várias torneiras a pingar, o custo multiplica-se rapidamente. Para além do desperdício financeiro, há o impacto ambiental. Em Portugal, onde a escassez de água é uma preocupação crescente, cada litro conta. Reparar uma torneira a pingar é um gesto simples com impacto real na sustentabilidade.'
      },
      {
        heading: 'Prevenção: como evitar que as torneiras pinguem',
        content: 'Para prolongar a vida das suas torneiras e evitar fugas: não force as torneiras ao fechar — feche com suavidade, sem apertar com força. Instale um redutor de pressão se a pressão da rede for superior a 4 bar. Limpe periodicamente o filtro (arejador) na ponta da torneira — acumula calcário e impurezas. Use um descalcificador de água se viver numa zona com água muito calcária (comum na região do Tâmega e Sousa). Escolha torneiras de qualidade de marcas reconhecidas (Grohe, Roca, Hansgrohe) — custam mais mas duram muito mais tempo. Faça uma revisão anual da canalização com um profissional — previne problemas maiores.'
      },
      {
        heading: 'Quando chamar um canalizador',
        content: 'Deve chamar um canalizador profissional quando: a torneira pinga mesmo completamente fechada e não consegue identificar a causa. A fuga é na base da torneira ou na ligação à parede (pode indicar problemas na canalização). Ao desmontar a torneira, verificou corrosão ou danos na sede da válvula. A torneira é embutida (encastrada na parede) — a reparação requer acesso à canalização interior. A fuga está a causar danos (humidade, manchas na parede ou armário inferior). Não consegue encontrar peças de substituição compatíveis. Na VITFIX, os nossos canalizadores na região do Tâmega e Sousa diagnosticam e reparam torneiras a pingar no próprio dia. Orçamento gratuito e sem compromisso.'
      },
    ],
    ctaText: 'Tem uma torneira a pingar? Peça orçamento gratuito a um canalizador VITFIX.',
    relatedServices: ['canalizador', 'desentupimento'],
    searchVolume: '200-500/mois, très faible concurrence',
  },
  {
    slug: 'autoclismo-nao-enche-causas',
    title: 'Autoclismo Não Enche — Causas, Diagnóstico e Soluções',
    metaTitle: 'Autoclismo Não Enche — Causas e Soluções | VITFIX',
    metaDesc: 'O autoclismo não enche ou enche muito devagar? Descubra as causas mais comuns (boia, válvula, pressão) e como resolver. Guia prático com preços.',
    category: 'canalizacao',
    icon: '🚽',
    datePublished: '2026-03-15',
    intro: 'Um autoclismo que não enche é um problema frustrante que afeta o conforto diário de toda a família. Pode manifestar-se de várias formas: o autoclismo não enche de todo, enche muito devagar, ou enche mas perde água constantemente. Neste guia, explicamos as causas mais comuns, como diagnosticar o problema e quando vale a pena reparar ou substituir o mecanismo.',
    sections: [
      {
        heading: 'Causas mais comuns',
        content: 'Os problemas de autoclismo dividem-se em duas categorias: o autoclismo não enche (ou enche devagar) e o autoclismo perde água. No primeiro caso, as causas mais frequentes são: torneira de esquadria fechada ou parcialmente fechada — é a causa mais simples e mais esquecida. Verifique se a torneira que alimenta o autoclismo está completamente aberta. Boia desajustada ou avariada — a boia controla o nível de água no autoclismo. Se estiver mal regulada (demasiado baixa), o autoclismo enche pouco. Se estiver presa ou avariada, pode não deixar entrar água. Válvula de entrada obstruída — depósitos de calcário ou detritos podem bloquear parcial ou totalmente a entrada de água. Problema de pressão na rede — se a pressão de água for baixa (comum em andares altos ou zonas rurais), o autoclismo pode demorar muito a encher.'
      },
      {
        heading: 'Autoclismo que perde água',
        content: 'Se o autoclismo enche mas perde água constantemente (ouve-se a água a correr), as causas mais comuns são: válvula de descarga (flapper) deteriorada — a borracha que sela o fundo do autoclismo desgasta-se com o tempo e começa a deixar passar água. É a reparação mais comum e mais simples — a peça custa 5€ a 15€. Boia ajustada demasiado alta — se a boia estiver regulada para um nível de água acima do tubo de ladrão (overflow), a água escorre constantemente pelo ladrão para a sanita. Mecanismo de descarga partido — nos autoclismos mais modernos com botão duplo, o mecanismo central pode partir-se ou desalinhar-se. Calcário acumulado — depósitos de calcário na sede da válvula impedem uma vedação correta. Um autoclismo a perder água pode desperdiçar 100 a 400 litros por dia — muito mais do que uma torneira a pingar.'
      },
      {
        heading: 'Diagnóstico rápido em casa',
        content: 'Pode fazer um diagnóstico básico antes de chamar um canalizador. Para verificar se o autoclismo perde água: coloque algumas gotas de corante alimentar (ou café) na água do autoclismo. Espere 15 a 20 minutos sem dar descarga. Se a água na sanita ficar corada, significa que o autoclismo está a perder água pela válvula de descarga. Para verificar problemas na boia: retire a tampa do autoclismo e observe. Se a boia não sobe com o nível de água, pode estar furada ou presa. Se sobe mas não corta a entrada de água, a válvula de entrada pode estar avariada. Para verificar a pressão: se outros pontos de água (torneiras, chuveiro) também têm pressão baixa, o problema pode ser na rede e não no autoclismo.'
      },
      {
        heading: 'Reparação vs. substituição do mecanismo',
        content: 'A boa notícia é que a maioria dos problemas de autoclismo são reparáveis a baixo custo. Substituir a válvula de descarga (flapper): peça custa 5€-15€, pode ser feito sem canalizador em muitos casos. Substituir a boia ou válvula de entrada: peça custa 10€-25€, requer alguma habilidade manual. Substituir o mecanismo completo: o kit completo (entrada + descarga) custa 25€-60€, a instalação por um canalizador custa 30€-70€ de mão de obra. Substituir o autoclismo inteiro: se o autoclismo estiver fissurado ou for muito antigo, a substituição completa custa entre 80€ e 200€ (peça + instalação). Os autoclismos embutidos (de parede) são mais caros de reparar — o acesso ao mecanismo requer abertura do painel, e os mecanismos de marcas como Geberit custam entre 30€ e 80€.'
      },
      {
        heading: 'Autoclismos embutidos vs. exteriores',
        content: 'Os autoclismos embutidos (de parede, marca Geberit ou OLI) são cada vez mais populares em casas modernas e remodelações. No entanto, quando avaria, o acesso ao mecanismo é mais complicado: é necessário abrir o painel de inspeção (se existir) ou, em alguns casos, partir azulejos para aceder ao mecanismo. Por isso, recomendamos sempre instalar autoclismos embutidos com painel de inspeção acessível. Os mecanismos Geberit são de alta qualidade e raramente avaria, mas quando o fazem, as peças são específicas e mais caras. Os autoclismos exteriores (de cerâmica, montados sobre a sanita) são mais fáceis de reparar — a tampa retira-se facilmente e todas as peças são acessíveis. Os mecanismos são mais universais e mais baratos.'
      },
      {
        heading: 'Prevenção e manutenção',
        content: 'Para evitar problemas no autoclismo: não use pastilhas de limpeza dentro do autoclismo — os químicos deterioram as borrachas mais rapidamente. Faça uma limpeza anual do mecanismo — retire a tampa e limpe os depósitos de calcário com vinagre branco. Verifique periodicamente se há fugas (teste do corante). Se notar que o autoclismo demora cada vez mais a encher, verifique a válvula de entrada antes que bloqueie completamente. Em zonas com água muito calcária (como partes da região do Tâmega e Sousa), considere instalar um filtro na entrada de água do autoclismo.'
      },
      {
        heading: 'Quando chamar um canalizador',
        content: 'Chame um canalizador profissional quando: não consegue identificar a causa do problema após o diagnóstico básico. O autoclismo é embutido (de parede) e não tem painel de inspeção fácil. O problema persiste após substituir a válvula de descarga. Há sinais de fuga de água na parede ou no chão à volta da sanita. Precisa de substituir o autoclismo completo. Na VITFIX, os nossos canalizadores na região do Tâmega e Sousa reparam autoclismos de todas as marcas e modelos. A deslocação e diagnóstico custam entre 30€ e 50€, valor que é geralmente incluído no orçamento final se aceitar a reparação.'
      },
    ],
    ctaText: 'Autoclismo avariado? Peça orçamento gratuito a um canalizador VITFIX.',
    relatedServices: ['canalizador', 'desentupimento'],
    searchVolume: '200-600/mois, très faible concurrence',
  },
  {
    slug: 'teto-a-pingar-o-que-fazer',
    title: 'Teto a Pingar — O Que Fazer e Como Resolver (Guia Urgente)',
    metaTitle: 'Teto a Pingar — O Que Fazer e Como Resolver | VITFIX',
    metaDesc: 'Tem o teto a pingar? Saiba o que fazer imediatamente, as causas possíveis (infiltração, fuga, condensação) e como resolver. Guia urgente.',
    category: 'canalizacao',
    icon: '🏠',
    datePublished: '2026-03-15',
    intro: 'Um teto a pingar é uma situação urgente que exige ação imediata. Quanto mais tempo se espera, maiores são os danos — a água pode danificar a estrutura, mobiliário, equipamentos elétricos e favorecer o aparecimento de bolores prejudiciais à saúde. Neste guia urgente, explicamos o que fazer nos primeiros minutos, como identificar a causa e como resolver definitivamente o problema.',
    sections: [
      {
        heading: 'O que fazer imediatamente',
        content: 'Se o teto está a pingar, aja nos primeiros minutos: coloque um balde ou recipiente sob o ponto de fuga para conter a água. Proteja o mobiliário e equipamentos elétricos que estejam por baixo — afaste-os ou cubra-os com plástico. Se houver uma bolha de água no teto (barriga), NÃO a rebente — pode libertar uma grande quantidade de água de uma vez. Em vez disso, fure a bolha com um prego fino sobre o balde para deixar a água escorrer de forma controlada. Desligue a eletricidade do circuito correspondente a essa divisão — água e eletricidade são uma combinação perigosa. Verifique se há algum vizinho de cima (em apartamentos) que possa ter uma fuga — muitas vezes o problema vem do andar superior. Contacte um profissional o mais rapidamente possível — cada hora conta.'
      },
      {
        heading: 'Causas mais comuns de teto a pingar',
        content: 'As causas dividem-se em três categorias principais. Fuga de água na canalização: é a causa mais comum em apartamentos. Um cano furado, uma junta deteriorada, ou um autoclismo a perder água no andar de cima podem provocar pingos no teto de baixo. A água pode percorrer vários metros pela laje antes de aparecer — o ponto de fuga no teto pode não ser diretamente abaixo do cano danificado. Infiltração pelo telhado ou terraço: em moradias ou últimos andares, a causa mais provável é infiltração de água da chuva. Telhas partidas, membrana de impermeabilização danificada, ou caleiras entupidas são as origens mais frequentes. A infiltração intensifica-se nos dias de chuva forte. Condensação: em casos menos graves, o "pingar" pode ser condensação — especialmente em divisões húmidas (cozinha, casa de banho) mal ventiladas, durante o inverno. A condensação forma gotículas que pingam do teto, mas não é uma fuga.'
      },
      {
        heading: 'Teto a pingar em apartamento',
        content: 'Em apartamentos, o problema mais frequente é uma fuga de água na canalização do andar superior. Os passos a seguir são: contacte imediatamente o vizinho de cima — peça-lhe para verificar se tem alguma fuga visível na casa de banho, cozinha ou lavandaria. Contacte a administração do condomínio — se a fuga vem de partes comuns (coluna de esgoto, canalização geral), a reparação é responsabilidade do condomínio. Documente os danos com fotografias e vídeos — serão necessários para o seguro e para eventual responsabilização. Se o vizinho não está em casa ou não colabora, o condomínio pode autorizar a intervenção com acesso ao apartamento de cima. Em termos legais, o proprietário do apartamento de onde provém a fuga é responsável pelos danos causados ao vizinho (artigo 493.º do Código Civil).'
      },
      {
        heading: 'Teto a pingar em moradia',
        content: 'Numa moradia, o teto a pingar pode ter origens diferentes. Se pinga de um teto interior (não é o último piso): provavelmente é uma fuga na canalização do piso superior. Verifique a casa de banho, cozinha, ou qualquer ponto de água que fique acima da zona da fuga. Se pinga do teto do último piso ou sótão: a causa mais provável é infiltração pelo telhado. Verifique (sem subir ao telhado em dias de chuva) se há telhas partidas ou deslocadas visíveis do chão. Verifique se as caleiras estão limpas e a drenar corretamente. Se a casa tem terraço ou cobertura plana, a membrana de impermeabilização pode estar danificada — normalmente dura 10 a 15 anos antes de precisar de ser refeita. A reparação do telhado deve ser feita por um profissional — trabalhos em altura são perigosos e requerem equipamento adequado.'
      },
      {
        heading: 'Custos de reparação',
        content: 'O custo depende da causa e da extensão do dano. Reparação de fuga na canalização: 80€ a 250€ (diagnóstico + reparação do cano ou junta). Reparação de telhas partidas: 100€ a 300€ (inclui acesso ao telhado e substituição de telhas). Impermeabilização de terraço (por m²): 15€ a 35€/m². Reparação de caleiras entupidas: 50€ a 120€. Reparação do teto danificado pela água (após resolver a causa): pintura anti-humidade 15€-25€/m², substituição de pladur danificado 20€-40€/m². Importante: resolva SEMPRE a causa antes de reparar os danos estéticos. Pintar sobre manchas de humidade sem resolver a origem é deitar dinheiro fora — o problema reaparece sempre.'
      },
      {
        heading: 'Seguro cobre danos de água?',
        content: 'A maioria dos seguros multirriscos habitação cobre danos causados por água, incluindo fugas de canalização e infiltrações. No entanto, há condições a cumprir: o seguro geralmente cobre os danos causados pela água (pintura, mobiliário, equipamentos danificados) mas NÃO cobre a reparação da causa (o cano ou telha que provocou a fuga). Deve comunicar o sinistro à seguradora o mais rapidamente possível — muitas exigem comunicação nas primeiras 48 a 72 horas. Documente tudo com fotografias, vídeos e, se possível, um relatório do profissional que fez a reparação. Se o dano é causado por falta de manutenção (caleiras nunca limpas, telhado em mau estado evidente), a seguradora pode recusar a cobertura. Guarde todas as faturas de reparação — são necessárias para a reclamação ao seguro.'
      },
      {
        heading: 'Como prevenir futuros problemas',
        content: 'Para evitar que o teto volte a pingar: faça uma revisão anual da canalização com um canalizador profissional. Limpe as caleiras pelo menos duas vezes por ano (primavera e outono). Inspecione o telhado visualmente uma vez por ano (após o inverno é o momento ideal). Em terraços e coberturas planas, verifique o estado da impermeabilização a cada 2-3 anos. Mantenha boa ventilação nas divisões húmidas para evitar condensação. Em apartamentos, mantenha contacto com os vizinhos e o condomínio para resolver problemas rapidamente. Na região do Tâmega e Sousa, os invernos chuvosos são particularmente exigentes para telhados e impermeabilizações — a manutenção preventiva é ainda mais importante.'
      },
    ],
    ctaText: 'Teto a pingar? Contacte a VITFIX para diagnóstico e reparação urgente.',
    relatedServices: ['canalizador', 'impermeabilizacao', 'pintor'],
    searchVolume: '100-300/mois, très faible concurrence, urgence',
  },
  {
    slug: 'cano-entupido-como-resolver',
    title: 'Cano Entupido — Como Resolver e Quando Chamar Profissional',
    metaTitle: 'Cano Entupido — Como Resolver e Quando Chamar | VITFIX',
    metaDesc: 'Cano entupido? Descubra métodos caseiros seguros, o que NÃO fazer, e quando chamar um profissional de desentupimento. Preços e dicas.',
    category: 'desentupimento',
    icon: '🔧',
    datePublished: '2026-03-15',
    intro: 'Um cano entupido é um dos problemas domésticos mais frequentes e desagradáveis. Pode manifestar-se como água que escorre devagar, água estagnada no lavatório ou banheira, ou no pior dos casos, esgoto a transbordar. Neste guia, explicamos os métodos caseiros que realmente funcionam, os que deve evitar, e quando é necessário chamar um profissional de desentupimento.',
    sections: [
      {
        heading: 'Tipos de entupimento e causas',
        content: 'Os entupimentos dividem-se por localização e causa. Na cozinha, a causa número um é a gordura — ao despejar gordura pelo ralo, esta solidifica ao arrefecer e acumula-se nas paredes interiores dos canos, apanhando restos de comida e formando uma obstrução cada vez maior. Na casa de banho, os culpados habituais são cabelos (no lavatório e ralo do duche), restos de sabão que se acumulam com os cabelos formando uma pasta densa, e toalhitas húmidas deitadas pela sanita. No esgoto exterior, as causas mais comuns são raízes de árvores que penetram nas juntas dos tubos, acumulação de terra e detritos, e colapso parcial de tubos antigos em cerâmica ou fibrocimento. Na sanita, os entupimentos são geralmente causados por objetos estranhos (toalhitas, pensos, brinquedos de crianças) ou excesso de papel higiénico.'
      },
      {
        heading: 'Métodos caseiros que funcionam',
        content: 'Antes de chamar um profissional, pode tentar resolver o entupimento com métodos simples. Água a ferver: eficaz para entupimentos parciais causados por gordura (apenas na cozinha). Ferva um litro de água e despeje diretamente pelo ralo. Repita 2-3 vezes com intervalos de 30 segundos. Não use em tubos de PVC se a água estiver a mais de 80°C. Desentupidor de borracha (ventosa): o método mecânico mais simples e eficaz. Tape o orifício de transbordo com um pano húmido, encha o lavatório com 5cm de água, coloque o desentupidor sobre o ralo e faça movimentos vigorosos de cima a baixo durante 30 segundos. Repita 3-4 vezes. Bicarbonato + vinagre: despeje meio copo de bicarbonato de sódio pelo ralo, seguido de meio copo de vinagre branco. Tape o ralo e espere 30 minutos. Depois despeje água quente. Funciona para obstruções parciais e como manutenção preventiva. Mola de desentupimento manual: uma mola flexível de 3-5 metros que se introduz pelo ralo e desobstrui mecanicamente. Custa 10€-20€ e é útil para ter em casa.'
      },
      {
        heading: 'O que NÃO fazer',
        content: 'Atenção — alguns métodos populares podem piorar a situação ou causar danos. NÃO use produtos químicos de desentupimento: contêm ácido sulfúrico ou soda cáustica concentrada. Podem corroer tubos antigos (especialmente metálicos), danificar juntas de borracha, e são perigosos para a saúde e ambiente. Se já usou e não funcionou, avise o canalizador — o contacto com estes produtos durante a reparação pode causar queimaduras. NÃO use arames ou objetos improvisados: podem perfurar tubos de PVC, ficar presos nos canos, ou empurrar a obstrução para mais fundo. NÃO despeje mais água: se o cano está completamente entupido, adicionar água só vai causar transbordo. NÃO misture produtos químicos: a combinação de diferentes produtos de desentupimento pode criar gases tóxicos. NÃO tente desmontar sifões ou tubos sem experiência — pode causar inundações se não souber remontar corretamente.'
      },
      {
        heading: 'Quando chamar um profissional',
        content: 'Chame um profissional de desentupimento quando: os métodos caseiros não funcionaram após 2-3 tentativas. A água está completamente estagnada (não escorre de todo). Vários pontos de água da casa estão com escoamento lento ao mesmo tempo — indica um entupimento na coluna de esgoto ou no coletor. Há cheiro forte a esgoto na casa — pode indicar obstrução no tubo de ventilação ou na fossa séptica. A sanita transborda ao dar descarga. Há água a sair por ralos de chão ou de outros pontos inesperados. O profissional de desentupimento dispõe de equipamento que os métodos caseiros não podem substituir: máquinas de alta pressão (hidrojato) que desobstruem qualquer tipo de entupimento, molas elétricas profissionais que alcançam obstruções a dezenas de metros, e câmaras de inspeção vídeo que permitem ver o interior dos canos e identificar a causa exata.'
      },
      {
        heading: 'Preços de desentupimento profissional',
        content: 'Na região do Tâmega e Sousa, os preços de referência para desentupimento são: desentupimento de lavatório ou banheira: 60€ a 100€. Desentupimento de sanita: 60€ a 120€. Desentupimento de esgoto de cozinha (com gordura): 80€ a 150€. Desentupimento de coluna de esgoto: 120€ a 250€. Desentupimento com hidrojato (alta pressão): 150€ a 300€. Inspeção vídeo da canalização: 100€ a 200€. Limpeza de fossa séptica: 150€ a 350€. Os preços incluem deslocação e mão de obra. O material (jatos, molas) está incluído. Se for necessário substituir tubos ou reparar a canalização, o custo adicional é orçamentado separadamente.'
      },
      {
        heading: 'Prevenção de entupimentos',
        content: 'A prevenção é sempre mais barata do que a reparação. Na cozinha: nunca deite gordura ou óleo pelo ralo — guarde num frasco e deposite no oleão. Use um filtro de ralo para apanhar restos de comida. Despeje água quente pelo ralo uma vez por semana para dissolver acumulações de gordura. Na casa de banho: instale um filtro de cabelos no ralo do duche e do lavatório (custam 2€-5€ e evitam a maioria dos entupimentos). Não deite toalhitas húmidas pela sanita — mesmo as que dizem ser "biodegradáveis" não se dissolvem na canalização. Na sanita: ensine as crianças que a sanita não é caixote do lixo — apenas papel higiénico e necessidades fisiológicas. No exterior: limpe as sarjetas e caleiras duas vezes por ano. Se tem árvores perto da canalização, faça uma inspeção a cada 2-3 anos para detetar intrusão de raízes.'
      },
    ],
    ctaText: 'Cano entupido que não consegue resolver? Peça desentupimento profissional VITFIX.',
    relatedServices: ['desentupimento', 'canalizador'],
    searchVolume: '200-500/mois, très faible concurrence',
  },
  {
    slug: 'cheiro-a-esgoto-em-casa',
    title: 'Cheiro a Esgoto em Casa — Causas e Como Eliminar',
    metaTitle: 'Cheiro a Esgoto em Casa — Causas e Soluções | VITFIX',
    metaDesc: 'Cheiro a esgoto em casa? Descubra as 6 causas mais comuns (sifão seco, fuga, ventilação) e como eliminar o mau cheiro definitivamente.',
    category: 'desentupimento',
    icon: '🏠',
    datePublished: '2026-03-15',
    intro: 'Um cheiro a esgoto em casa é mais do que desagradável — pode indicar um problema na canalização que afeta a saúde e o conforto da família. Os gases de esgoto contêm metano, sulfeto de hidrogénio e outros compostos que, em concentrações elevadas, podem causar dores de cabeça, náuseas e irritação das vias respiratórias. Neste guia, explicamos as causas mais comuns e como resolver cada uma.',
    sections: [
      {
        heading: 'As 6 causas mais comuns',
        content: 'O cheiro a esgoto dentro de casa tem quase sempre uma destas origens. Sifão seco — a causa mais frequente e mais fácil de resolver. Cada ralo (lavatório, banheira, duche, máquina de lavar) tem um sifão em forma de U que mantém uma pequena quantidade de água que bloqueia a passagem dos gases do esgoto. Se um ponto de água não é usado durante semanas, a água do sifão evapora e os gases sobem. Sifão obstruído ou sujo — mesmo com água, um sifão muito sujo (acumulação de cabelos, gordura, detritos) pode não bloquear eficazmente os odores. Tampa de ralo danificada ou ausente — ralos de chão sem tampa adequada permitem a passagem direta dos gases. Falha no sistema de ventilação — a canalização de esgoto tem tubos de ventilação que saem pelo telhado. Se estão obstruídos (por ninhos, detritos, folhas), a pressão negativa pode aspirar a água dos sifões. Fuga ou fissura no tubo de esgoto — um tubo rachado ou uma junta deteriorada permite a fuga de gases para dentro de casa. Fossa séptica cheia — em casas com fossa séptica (sem ligação à rede pública), uma fossa cheia provoca mau cheiro e pode causar refluxo.'
      },
      {
        heading: 'Diagnóstico: como identificar a origem',
        content: 'Para encontrar a fonte do cheiro, siga estes passos. Identifique a divisão — o cheiro é mais forte na casa de banho, cozinha, lavandaria ou zona exterior? Isso ajuda a localizar o problema. Verifique os sifões — abra todas as torneiras e ralos que não são usados regularmente. Deixe correr água durante 30 segundos em cada um para encher os sifões. Se o cheiro desaparece, o problema era um sifão seco. Inspecione as tampas de ralo — verifique se todos os ralos de chão têm tampa e se estão bem encaixadas. Verifique a máquina de lavar — a mangueira de descarga da máquina de lavar roupa ou loiça deve estar ligada ao esgoto com um sifão adequado. Uma ligação direta (sem sifão) permite a passagem de odores. Procure manchas de humidade — uma fuga no tubo de esgoto geralmente acompanha-se de manchas de humidade na parede ou chão. Se sente cheiro na zona exterior, verifique tampas de caixas de visita, sarjetas e o estado da fossa séptica.'
      },
      {
        heading: 'Soluções para cada causa',
        content: 'Sifão seco: simplesmente abra a torneira e deixe correr água durante 30 segundos. Em pontos de água raramente usados (casa de banho de hóspedes, por exemplo), despeje meio copo de óleo mineral pelo ralo — o óleo flutua sobre a água e retarda a evaporação. Sifão sujo: desmonte o sifão (a maioria desenrosca-se à mão), limpe-o bem e volte a montar. Em ralos de chão, retire a grelha e limpe o sifão com uma escova. Tampa de ralo: substitua tampas danificadas ou ausentes. As tampas com vedação são as mais eficazes — encontram-se em lojas de bricolage por 5€-15€. Ventilação: a desobstrução do tubo de ventilação requer acesso ao telhado — chame um profissional. Fuga ou fissura: a reparação exige um canalizador profissional. Dependendo da localização e gravidade, pode ser necessário abrir paredes ou pavimentos. Custo: 100€-400€ dependendo da complexidade. Fossa séptica: necessita de limpeza profissional (150€-350€) e deve ser esvaziada periodicamente (cada 2-4 anos dependendo do uso).'
      },
      {
        heading: 'Cheiro a esgoto na casa de banho',
        content: 'A casa de banho é o local mais frequente para cheiro a esgoto. As causas específicas incluem: base do duche ou banheira com sifão inadequado — muitos ralos de duche modernos têm sifões muito rasos que secam rapidamente. Considere substituir por um modelo com sifão mais profundo. Ligação da sanita à coluna de esgoto com fuga — se o cheiro vem da base da sanita, o anel de vedação (anel de cera ou borracha) pode estar deteriorado. A substituição custa 30€-80€ por um canalizador. Silicone degradado à volta da base da sanita ou duche — o silicone antigo pode criar espaços por onde passam os odores. A reaplicação de silicone é simples e económica (5€-10€ de material). Ventilação insuficiente — uma casa de banho sem janela e sem extrator gera condensação e potencia odores. Instalar um extrator custa entre 80€ e 200€.'
      },
      {
        heading: 'Cheiro a esgoto na cozinha',
        content: 'Na cozinha, o cheiro a esgoto tem causas específicas. Sifão do lava-loiça com acumulação de gordura — a gordura acumula-se no sifão e nas paredes dos canos, decompõe-se e produz mau cheiro. Limpeza: desmonte o sifão, limpe com água quente e detergente desengordurante, e volte a montar. Faça isto a cada 3-6 meses. Máquina de lavar loiça mal ligada — se a mangueira de descarga está ligada diretamente ao esgoto sem sifão, os gases sobem pela mangueira. Solução: instalar um sifão anti-retorno na ligação. Ralo de chão da cozinha seco — em cozinhas com ralo de chão (comum em cozinhas mais antigas), o sifão seca se não é usado regularmente. Trituradores de resíduos alimentares — se mal mantidos, acumulam restos de comida que se decompõem e produzem odores. Corra água fria durante 30 segundos após cada uso.'
      },
      {
        heading: 'Prevenção e manutenção',
        content: 'Para prevenir o cheiro a esgoto: mantenha todos os sifões com água — se tem pontos de água que não usa regularmente, abra a torneira uma vez por semana durante 30 segundos. Limpe os sifões a cada 6 meses — especialmente na cozinha (gordura) e na casa de banho (cabelos). Não deite gordura pelo ralo — guarde num frasco e deposite no oleão. Use bicarbonato + vinagre mensalmente como manutenção — despeje um copo de bicarbonato seguido de um copo de vinagre em cada ralo. Espere 15 minutos e enxague com água quente. Verifique as juntas e silicones anualmente. Limpe as caleiras e verifique os tubos de ventilação no telhado. Em casas com fossa séptica, programe a limpeza a cada 2-4 anos.'
      },
      {
        heading: 'Quando é urgente chamar um profissional',
        content: 'Chame um profissional imediatamente se: o cheiro é muito forte e persistente (mesmo com todos os sifões cheios). Há sinais de fuga de esgoto — manchas de humidade escuras no chão ou paredes, pavimento que incha. Vários pontos de água borbulham ao dar descarga na sanita — indica problema na ventilação ou obstrução parcial da coluna de esgoto. Há refluxo de água pelo ralo de chão. A fossa séptica está a transbordar. O cheiro surge após obras ou remodelação — pode ter sido danificado um tubo durante as obras. Na VITFIX, os nossos canalizadores na região do Tâmega e Sousa diagnosticam e resolvem problemas de mau cheiro de esgoto rapidamente. O diagnóstico inclui inspeção de sifões, ventilação e, se necessário, inspeção vídeo da canalização.'
      },
    ],
    ctaText: 'Cheiro a esgoto persistente? Contacte a VITFIX para diagnóstico profissional.',
    relatedServices: ['desentupimento', 'canalizador'],
    searchVolume: '50-150/mois, très faible concurrence, forte intention',
  },
  {
    slug: 'manutencao-alojamento-local-airbnb-portugal',
    title: 'Manutenção de Alojamento Local e Airbnb no Porto — Guia para Proprietários 2026',
    metaTitle: 'Manutenção Alojamento Local e Airbnb no Porto | Guia Completo 2026 | VITFIX',
    metaDesc: 'Guia completo: como gerir manutenção do teu Airbnb ou alojamento local no Porto. Profissionais verificados, reparações rápidas. Vitfix.io',
    category: 'manutencao',
    icon: '🏘️',
    datePublished: '2026-03-18',
    intro: 'Tens um Airbnb no Porto e acordaste com uma fuga de água na cozinha às 3 da manhã. A manutenção de alojamento local é um desafio constante em Portugal, especialmente numa cidade como o Porto com tanta rotação de hóspedes. Este guia foi criado especificamente para proprietários de alojamentos locais em Portugal que gerem a manutenção dos seus imóveis.',
    sections: [
      {
        heading: 'O Boom do Alojamento Local no Porto em 2026',
        content: 'O mercado de alojamento local em Portugal cresceu 33% entre 2024 e 2025. O Porto lidera com mais de 15.000 imóveis registados. A média de ocupação é 65-75% por ano, com preço médio por noite entre €65-€120. Mas cada reservação significa contactos de hóspedes, reviews a gerir, limpezas entre stays, e reparações urgentes. A qualidade da manutenção diferencia um imóvel com 4,8 estrelas de um com 3,5 estrelas no Airbnb.'
      },
      {
        heading: 'Os 10 Problemas de Manutenção Mais Comuns em Alojamentos Locais',
        content: 'Canalização sofre 3-5 vezes mais uso: fugas (€100-250), torneiras (€40-80), autoclismos (€30-60). Eletricidade: tomadas (€25-50), interruptores (€20-40), disjuntores (€80-150). Pintura desgasta em 18-24 meses: quarto (€200-400), sala (€300-600). Eletrodomésticos usados intensamente: máquina lavar (€120-300), esquentador (€150-400), frigorífico (€100-250). Fechaduras sofrem com rotação: cilindro (€30-70), smart lock (€80-200). Humidade é problema em Porto: infiltração (€200-500), mofo (€150-300). Ar condicionado crítico: limpeza (€60-120), recarga (€100-200). Mobiliário: colchão (€200-500), limpeza sofá (€80-150). Limpeza profunda (€150-300). Renovações para competir.'
      },
      {
        heading: 'Como Garantir Manutenção Rápida Entre Hóspedes',
        content: 'Ter profissionais "on call" é essencial: 1-2 encanadores, 1-2 eletricistas, reparador de eletrodomésticos, pintor/renovador, serralheiro. Manutenção preventiva entre temporadas: inspecionar tomadas, torneiras, paredes, filtros AC, aquecimento. Sistema de alerta rápido: treinar hóspedes a reportar problemas imediatamente. Buffer de tempo entre reservas: 4 horas entre check-out e check-in permite resolver problemas calmamente.'
      },
      {
        heading: 'Quanto Custa a Manutenção de um Alojamento Local no Porto?',
        content: 'Manutenção custa 15-25% da receita mensal bruta. Para imóvel que gera €2.200/mês, espera gastar €300-500. Anualmente: limpeza profunda (€1.200), reparações urgentes (€1.500), preventiva (€800), eletrodomésticos (€600), pintura/renovação (€800) = €4.900/ano (18,6% de €26.400 receita anual). Boa gestão evita reparações de emergência que custam 3-5x mais.'
      },
      {
        heading: 'Como a Vitfix.io Resolve a Manutenção do Teu Airbnb',
        content: 'Profissionais verificados 24h com alvará atualizado, seguro RC, histórico comprovado, avaliações reais. Resposta rápida para urgências: menos de 2 horas no Porto e arredores. Gestão de múltiplos imóveis num dashboard: histórico reparações, custos comparados, contactos. Orçamentos rápidos por telemóvel. Mensalidade previsível sem comissão por obra.'
      },
    ],
    ctaText: 'Gerir Airbnb no Porto? A Vitfix.io simplifica toda a manutenção. Contacta-nos para saber como.',
    relatedServices: ['canalizador', 'eletricista', 'pintor', 'obras-remodelacao'],
    searchVolume: '100-200/mois, crescimento forte',
  },
  {
    slug: 'empreiteiro-certificado-portugal-alvara-verificar',
    title: 'Empreiteiro Certificado em Portugal — Como Verificar o Alvará e a Documentação',
    metaTitle: 'Empreiteiro Certificado Portugal | Verificar Alvará e Documentação | VITFIX',
    metaDesc: 'Como verificar se um empreiteiro é certificado em Portugal. Alvará InCI, seguro RC, registos obrigatórios. Guia completo de segurança. Vitfix.io',
    category: 'obras',
    icon: '✅',
    datePublished: '2026-03-18',
    intro: 'Contrataste um empreiteiro para fazer obras no apartamento. Trabalha bem, o preço é bom. Mas uma semana depois, há um problema na eletricidade instalada. O responsável desaparece. Descobres que não tem alvará de construção civil registado. Este cenário acontece demasiado em Portugal. Este guia foi criado para particulares que querem contratar empreiteiro de forma segura.',
    sections: [
      {
        heading: 'O Que é um Alvará de Construção Civil em Portugal?',
        content: 'Um alvará é um documento oficial do Instituto da Qualidade na Construção (IQC) que certifica que um profissional pode executar trabalhos de construção civil. Qualquer pessoa que execute trabalhos de construção deve ter alvará — sem exceções (Decretos-Lei 80/2006 e 258/92). Multas de não cumprimento: €1.000 a €10.000. Se algo corre mal, empresa sem alvará não tem cobertura de seguro. Em 2025, o novo sistema IQC continua emitir alvarás com plataforma online para verificação em tempo real.'
      },
      {
        heading: 'As 9 Classes de Alvará em Portugal',
        content: 'Classe 1: trabalhos muito simples (pintura, limpeza). Classe 2: trabalhos simples (azulejaria). Classe 3: trabalhos correntes (renovação cozinhas, banheiros). Classe 4: especializados (estruturas). Classe 5: complexos (edifícios inteiros). Classe 6: instalações especiais (AVAC, energia solar). Classe 7: conservação (estruturas históricas). Classe 8: escavação. Classe 9: subaquáticos. Se contrata empreiteiro Classe 1 para renovação banheiro (Classe 3) — o trabalho é ilegal. Verifica sempre classe contra tipo de trabalho.'
      },
      {
        heading: 'Como Verificar se um Empreiteiro Tem Alvará Válido',
        content: 'Forma 1 (Mais rápida): vai para https://www.construcao.iqc.pt/, clica "Pesquisar Alvarás", introduz nome, número alvará ou NIF. Resultado mostra: status (VÁLIDO/CADUCADO), classes, datas, histórico disciplina. Forma 2: pede documentação diretamente — cópia alvará, screenshot portal IQC, certificado seguro RC, NIF. Recusa = bandeira vermelha. Forma 3: contacta câmara municipal — confirma alvará válido em 10 minutos.'
      },
      {
        heading: 'O Alvará Não É o Único Documento',
        content: 'Seguro de Responsabilidade Civil (obrigatório): mínimo legal €250.000, recomendado €500.000-€1.000.000. Pede cópia apólice, confirma validade, montante, tipo (responsabilidade civil profissional). Declaração de Imposto: certidão negativa de débito (sem dívidas). Registo Acidentes/Multas: pede referências de clientes anteriores. Contacta-os diretamente.'
      },
      {
        heading: 'Sinais de Alerta — Quando NÃO Contratar',
        content: 'Recusa mostrar alvará. Alvará caducado (>1 ano). Sem seguro RC. Preço 30%+ abaixo mercado. Trabalha só com dinheiro vivo (sem recibos). Sem contacto permanente. Trabalha como "amigo" sem empresa constituída. Promete acabar muito mais depressa que realista.'
      },
    ],
    ctaText: 'Vai contratar um empreiteiro? Verifica sempre o alvará e documentação antes. A Vitfix.io já faz isto por ti.',
    relatedServices: ['obras-remodelacao'],
    searchVolume: '50-100/mois, crescimento médio',
  },
  {
    slug: 'programa-gestao-obras-empreiteiro-portugal',
    title: 'Programa de Gestão de Obras para Empreiteiros em Portugal — Comparação 2026',
    metaTitle: 'Programa Gestão Obras Empreiteiro Portugal 2026 | Comparação | VITFIX',
    metaDesc: 'Compara os melhores programas de gestão de obras para empreiteiros em Portugal. Faturação, agenda, orçamentos. Qual escolher? Vitfix.io',
    category: 'obras',
    icon: '📋',
    datePublished: '2026-03-18',
    intro: 'Tens 5 obras em curso. Três clientes ligam perguntando pelo estado. Uma fatura ficou perdida num email. O orçamento que enviaste há 2 meses sumiu. Sem sistema de gestão, a administração come metade do tempo que deveria estar a cobrar. Este guia compara as principais opções disponíveis em 2026.',
    sections: [
      {
        heading: 'O Problema: Por Que Precisas de Um Programa de Gestão',
        content: 'Sem sistema, estás a perder dinheiro diariamente. Obras perdidas: 15-20% dos trabalhos ficam perdidos em emails. Tempo desperdiçado: se 2 horas de 8 são de administração, perdes 25% de receita. Pagamentos atrasados: facturas perdidas, clientes que não recebem aviso. Má reputação: cliente não sabe quando trabalho começa. Erros e retrabalho: orçamentos errados, datas confundidas.'
      },
      {
        heading: 'Opção 1: Excel / Google Sheets (Grátis, Mas Limitado)',
        content: 'Vantagens: grátis, simples, controlo total. Desvantagens: sem acesso telemóvel real, sem avisos, sem integração pagamentos, fácil perder dados, sem histórico seguro, não gere múltiplas obras com eficiência, cliente não vê estado. Recomendação: OK se tens 1-2 obras/mês. Se mais que 5, falha rapidamente.'
      },
      {
        heading: 'Opção 2: Software Genérico Faturação (€30-80/mês)',
        content: 'Vantagens: fácil usar, cumpre obrigações fiscais, integra com Finanças. Desvantagens: não foi desenhado para construção, sem gestão equipas canteiro, sem rastreamento materiais, sem avaliação progresso, sem integração subcontratados. Recomendação: bom contabilidade, insuficiente para gestão obras. Usas isto + Excel (pior dos dois mundos).'
      },
      {
        heading: 'Opção 3: Software Especializado Construção (€80-250/mês)',
        content: 'Vantagens: desenhado para construção, gestão equipas, rastreamento materiais, fotos integradas, comunicação cliente, relatórios profissionais, integração subcontratados. Desvantagens: caro, complexo (leva tempo), overkill para pequenas obras, suporte PT fraco, muitas funcionalidades não usadas, contrato longo. Recomendação: bom para grandes obras com múltiplas equipas. Para individual/pequena empresa, exagero.'
      },
      {
        heading: 'Opção 4: Vitfix.io — Plataforma de Ligação + Gestão Integrada',
        content: 'Receber encomendas: clientes publicam "preciso empreiteiro", tu recebas notificação real-time, respondes com orçamento em minutos. Gerir orçamentos: criar em 5 minutos, cliente vê online, aceita confirmado. Gestão obras: data confirmada, contacto direto cliente, fotos integradas, alertas automáticas. Faturação: gera automaticamente quando termina. Histórico: todas obras registadas, avaliações públicas. Vantagens: completo, simples (desenhado para quem não é tech), mensalidade previsível, telemóvel funciona bem, suporte PT, integrado Portugal, sem comissão obra. Desvantagens: novo em PT mas crescendo, precisas estar plataforma.'
      },
      {
        heading: 'ROI de um Programa de Gestão',
        content: 'Cenário: 5 obras/mês. Sem programa: 2h de gestão/obra = 10h/mês = 25% tempo. Valor: €500/mês. Obras perdidas (comunicação): 10% = €2.000 perdidos. Sem programa custa €2.500/mês. Com Vitfix.io: 20min/obra = 1,5h/mês = €425 poupado. Obras não perdidas: €1.500. Pagamentos rápidos: €300-500. Custo: €30/mês. ROI: €2.225/mês vs €30 = 74x retorno.'
      },
    ],
    ctaText: 'Gere melhor as tuas obras com um programa dedicado. Vitfix.io foi construído para o mercado português.',
    relatedServices: ['obras-remodelacao'],
    searchVolume: '50-100/mois, crescimento médio',
  },
]

export function getBlogArticle(slug: string): BlogArticle | undefined {
  return BLOG_ARTICLES.find(a => a.slug === slug)
}

export function getCityBySlug(slug: string): CityData | undefined {
  return CITIES.find(c => c.slug === slug)
}
