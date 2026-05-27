/**
 * One-off : génère le devis V2 Artisan (PT) pour Julieta Rocha Peixoto Vieira
 * (montagem portão + chapa zincada). Sortie : Orcamento-V2-Artisan-PT.pdf.
 *
 * Pourquoi un script standalone : le générateur V2 vit dans un module ESM qui
 * importe @/lib/money etc. (alias TS résolus à la compilation Next.js). En
 * Node direct on ne charge pas tout le pipeline ; on reproduit ici l'API
 * minimum du générateur (les helpers money) via require relatif vers la lib
 * transpilée à la volée par tsx.
 *
 * Lancement : npx tsx scripts/generate-pt-artisan-quote.cjs
 */

const path = require('path')
const fs = require('fs')

;(async () => {
  // tsx hook pour résoudre les alias @/ — fallback sur require relatif.
  process.env.TS_NODE_PROJECT = path.join(__dirname, '..', 'tsconfig.json')

  // Import dynamique du générateur V2 (TS) via tsx
  // (le tsconfig de prod gère les alias @/lib via baseUrl + paths).
  const { generateDevisPdfV2 } = await import('../lib/pdf/devis-generator-v2.ts')

  const input = {
    locale: 'pt',
    artisan: {
      logo_url: null,
      nom: 'Frédéric Neiva Carvalho',
      siret: '276873297',
      rm: null,
      adresse: '109 Av. Dr. Artur Melo e Castro, 4630-204 Marco de Canaveses',
      telephone: '912 014 971',
      email: 'cvlho.frederic@gmail.com',
      rc_pro: null,
      insurance_name: null,
      insurance_number: null,
      insurance_coverage: null,
      insurance_type: null,
      tva_mention: 'IVA aplicável',
      mode_paiement: 'Transferência bancária faseada',
      condition_paiement: 'IBAN : PT50 0033 0000 4576 3682 866 05 — BIC : BCOMPTPL',
      cae: '81210, 38112',
    },
    client: {
      nom: 'Julieta Isabel Santos Rocha Peixoto Vieira',
      siret: null,
      adresse: 'Rua Freixieiro, 215-C, 2.º Esq., 4430-319 Vila Nova de Gaia',
      telephone: null,
      email: null,
      intervention_adresse: 'Rua da Praia, 29, 4150-623 Porto - Foz do Douro',
      intervention_batiment: null,
      intervention_etage: null,
      intervention_espaces_communs: null,
      intervention_exterieur: null,
    },
    devis: {
      numero: 'ORC-2026-036',
      titre: 'Montagem portão e chapa zincada',
      date_emission: new Date('2026-05-23'),
      validite_jours: 30,
      delai_execution: '2 dias',
      date_prestation: new Date('2026-06-02'),
      docType: 'devis',
    },
    mode_affichage: 'sections',
    lignes: [
      // ── MÃO DE OBRA ──
      {
        designation: 'Deslocação e entrega de materiais',
        lineDetail: 'Deslocação ao local de obra e entrega dos materiais necessários à execução dos trabalhos.',
        quantite: 1, unite: 'Serviço', prix_unitaire: 80, total: 80,
        section: 'main_oeuvre',
        etapes: [
          { ordre: 1, designation: 'Carregamento e transporte dos materiais para o local' },
          { ordre: 2, designation: 'Descarregamento e organização em obra' },
          { ordre: 3, designation: 'Deslocação da equipa para execução dos trabalhos' },
        ],
      },
      {
        designation: 'Afinação do vão e criação de pontos de ancoragem',
        lineDetail: 'Afinação do vão existente para acolhimento do novo portão e chapa zincada. Criação de pontos de fixação ao longo de aproximadamente 3,50 m.',
        quantite: 1, unite: 'Serviço', prix_unitaire: 75, total: 75,
        section: 'main_oeuvre',
        etapes: [
          { ordre: 1, designation: 'Afinação e ajuste do vão existente' },
          { ordre: 2, designation: 'Furação e instalação dos pontos de ancoragem' },
          { ordre: 3, designation: 'Preparação do vão para receber os elementos de fechamento' },
        ],
      },
      {
        designation: 'Corte e montagem da chapa zincada + colocação do portão de entrada',
        lineDetail: 'Corte e colocação da chapa zincada ao nível do portão de entrada, com fixação nos pontos de ancoragem previamente criados. Inclui a colocação e instalação do portão de entrada, alinhamento e verificação do correto funcionamento.',
        quantite: 1, unite: 'Serviço', prix_unitaire: 300, total: 300,
        section: 'main_oeuvre',
        etapes: [
          { ordre: 1, designation: 'Corte e ajuste da chapa zincada ao nível do portão' },
          { ordre: 2, designation: 'Colocação e instalação do portão de entrada' },
          { ordre: 3, designation: 'Posicionamento e alinhamento do portão e chapa' },
          { ordre: 4, designation: 'Fixação nos pontos de ancoragem e verificação do funcionamento' },
        ],
      },
      {
        designation: 'Limpeza do local e evacuação de entulhos',
        lineDetail: 'Limpeza geral da zona de obra e evacuação de todos os entulhos e resíduos gerados, com deposição em centro de resíduos profissional.',
        quantite: 1, unite: 'Serviço', prix_unitaire: 80, total: 80,
        section: 'main_oeuvre',
        etapes: [
          { ordre: 1, designation: 'Recolha e ensacamento dos entulhos e resíduos de obra' },
          { ordre: 2, designation: 'Carregamento e transporte para ecocentro profissional' },
          { ordre: 3, designation: 'Limpeza final do local de intervenção' },
        ],
      },

      // ── MATERIAIS ──
      { designation: 'Bucha química Fischer VS 300ml',              quantite: 2, unite: 'un',  prix_unitaire: 26.76, total: 53.52, section: 'materiaux' },
      { designation: 'Bucha química c/ rosca interior M8 (cx 10)',  quantite: 1, unite: 'cx',  prix_unitaire: 15.00, total: 15.00, section: 'materiaux' },
      { designation: 'Tubo aço galv. retangular 6m',                quantite: 2, unite: 'un',  prix_unitaire: 24.84, total: 49.68, section: 'materiaux' },
      { designation: 'Parafusaria inox M8/M10 sortida',             quantite: 1, unite: 'kit', prix_unitaire: 12.00, total: 12.00, section: 'materiaux' },
    ],
    // IVA 23% Portugal continental — un seul taux, breakdown = subtotal × 23%
    // Mão de obra : 80 + 75 + 300 + 80                 = 535,00 €
    // Materiais   : 53,52 + 15 + 49,68 + 12            = 130,20 €
    // Subtotal    : 665,20 € s/IVA → IVA 23% = 152,996 → 153,00 € → Total c/IVA 818,20 €
    tvaBreakdown: [{ rate: 23, base: 665.20, amount: 153.00 }],
    // Plano de pagamento : 30% antes do início dos trabalhos, 70% na entrega.
    // 30% × 818,20 = 245,46 (ROUND_HALF_UP)
    // 70% × 818,20 = 572,74 — ajusté pour matcher exactement le total :
    //   818,20 − 245,46 = 572,74 €
    acomptes: [
      { label: 'Adiantamento',    pourcentage: 30, declencheur: 'Antes do início dos trabalhos', montant: 245.46, statut: 'en attente' },
      { label: 'Pagamento final', pourcentage: 70, declencheur: 'Na entrega',                     montant: 572.74, statut: 'en attente' },
    ],
    // Clauses adicionais — material fornecido pelo cliente + imprevistos em
    // furação. Renderizadas em itálico abaixo das CONDIÇÕES standard.
    notes: [
      'Materiais fornecidos pelo cliente: portão Maurice e 4 chapas zincadas. A responsabilidade por danos eventuais nestes elementos durante a montagem fica limitada a defeitos imputáveis à execução do prestador.',
      'Imprevistos durante a furação em pedra (fissuras, cavidades, armaduras ou estruturas ocultas): podem dar origem a aditamento ao orçamento mediante acordo prévio com o cliente.',
    ].join(' '),
    isHorsEtablissement: true,
  }

  const pdf = await generateDevisPdfV2(input)
  const buf = Buffer.from(pdf.output('arraybuffer'))
  const out = path.join(process.cwd(), 'Orcamento-V2-Artisan-PT.pdf')
  fs.writeFileSync(out, buf)
  console.log('OK →', out, '(', buf.length, 'bytes )')
})().catch(e => { console.error(e); process.exit(1) })
