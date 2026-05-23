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
      insurance_name: 'Fidelidade',
      insurance_number: 'RC-2026-PT',
      insurance_coverage: 'Portugal continental',
      insurance_type: 'rc_pro',
      tva_mention: 'IVA aplicável',
      mode_paiement: 'Transferência bancária faseada',
      condition_paiement: 'IBAN : PT50 0033 0000 4576 3682 866 05 — BIC : BCOMPTPL',
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
      delai_execution: 'No próprio dia',
      date_prestation: new Date('2026-06-02'),
      docType: 'devis',
    },
    mode_affichage: 'bloc',
    lignes: [
      {
        designation: 'Deslocação e entrega de materiais',
        lineDetail: 'Deslocação ao local de obra e entrega dos materiais necessários à execução dos trabalhos.',
        quantite: 1, unite: 'Serviço', prix_unitaire: 120, total: 120,
        etapes: [
          { ordre: 1, designation: 'Carregamento e transporte dos materiais para o local' },
          { ordre: 2, designation: 'Descarregamento e organização em obra' },
          { ordre: 3, designation: 'Deslocação da equipa para execução dos trabalhos' },
        ],
      },
      {
        designation: 'Afinação do vão e criação de pontos de ancoragem',
        lineDetail: 'Afinação do vão existente para acolhimento do novo portão e chapa zincada. Criação de pontos de fixação ao longo de aproximadamente 3,50 m.',
        quantite: 1, unite: 'Serviço', prix_unitaire: 150, total: 150,
        etapes: [
          { ordre: 1, designation: 'Afinação e ajuste do vão existente' },
          { ordre: 2, designation: 'Furação e instalação dos pontos de ancoragem' },
          { ordre: 3, designation: 'Preparação do vão para receber os elementos de fechamento' },
        ],
      },
      {
        designation: 'Reparação do vão e regularização',
        lineDetail: 'Reparação das faces do vão e regularização com argamassa de cimento, de forma a obter um acabamento rectilíneo e nivelado.',
        quantite: 1, unite: 'Serviço', prix_unitaire: 150, total: 150,
        etapes: [
          { ordre: 1, designation: 'Limpeza e preparação das superfícies do vão' },
          { ordre: 2, designation: 'Aplicação de argamassa de cimento e regularização' },
          { ordre: 3, designation: 'Controlo de planeza e acabamento' },
        ],
      },
      {
        designation: 'Corte, montagem de chapa e portão de entrada',
        lineDetail: 'Corte e colocação da chapa zincada ao nível do portão de entrada, com fixação nos pontos de ancoragem previamente criados.',
        quantite: 1, unite: 'Serviço', prix_unitaire: 290, total: 290,
        etapes: [
          { ordre: 1, designation: 'Corte e ajuste da chapa zincada ao nível do portão' },
          { ordre: 2, designation: 'Posicionamento e alinhamento do portão e chapa' },
          { ordre: 3, designation: 'Fixação nos pontos de ancoragem e verificação do funcionamento' },
        ],
      },
      {
        designation: 'Limpeza do local e evacuação de entulhos',
        lineDetail: 'Limpeza geral da zona de obra e evacuação de todos os entulhos e resíduos gerados, com deposição em centro de resíduos profissional.',
        quantite: 1, unite: 'Serviço', prix_unitaire: 100, total: 100,
        etapes: [
          { ordre: 1, designation: 'Recolha e ensacamento dos entulhos e resíduos de obra' },
          { ordre: 2, designation: 'Carregamento e transporte para ecocentro profissional' },
          { ordre: 3, designation: 'Limpeza final do local de intervenção' },
        ],
      },
    ],
    // IVA 23% Portugal continental — un seul taux, breakdown = subtotal × 23%
    tvaBreakdown: [{ rate: 23, base: 810, amount: 186.30 }],
    isHorsEtablissement: true,
  }

  const pdf = await generateDevisPdfV2(input)
  const buf = Buffer.from(pdf.output('arraybuffer'))
  const out = path.join(process.cwd(), 'Orcamento-V2-Artisan-PT.pdf')
  fs.writeFileSync(out, buf)
  console.log('OK →', out, '(', buf.length, 'bytes )')
})().catch(e => { console.error(e); process.exit(1) })
