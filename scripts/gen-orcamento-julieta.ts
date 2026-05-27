/**
 * Script Node.js — Génère le PDF Orçamento Julieta via le générateur V2 artisan PT.
 * Usage: npx tsx scripts/gen-orcamento-julieta.ts
 */
import { writeFileSync } from 'fs'
import { generateDevisPdfV2 } from '../lib/pdf/devis-generator-v2'
import type { DevisGeneratorInput } from '../lib/pdf/devis-generator-v2'

async function main() {
  const input: DevisGeneratorInput = {
    locale: 'pt',
    artisan: {
      logo_url: null,
      nom: 'Frédéric Neiva Carvalho',
      siret: '276 873 297',
      rm: null,
      company_name: 'Vitfix',
      adresse: '109 Av. Dr. Artur Melo e Castro\n4630-204 Marco de Canaveses',
      telephone: '912 014 971',
      email: 'cvlho.frederic@gmail.com',
      rc_pro: null,
      insurance_name: 'Fidelidade',
      insurance_number: 'RC-2026-041892',
      insurance_coverage: 'Portugal continental',
      insurance_type: 'rc_pro',
      tva_mention: 'IVA incluído à taxa legal em vigor (23%)',
      mode_paiement: 'Transferência bancária.\nIBAN: PT50 0033 0000 4576 3682 866 05 — BIC: BCOMPTPL\nTitular: Frederic Neiva Carvalho — Banco: Millennium BCP',
      condition_paiement: 'Adiantamento de 30% na aceitação, restante após conclusão',
      cae: '81210, 38112',
    },
    client: {
      nom: 'Julieta Isabel Santos Rocha Peixoto Vieira',
      siret: '202 481 891',
      adresse: 'Rua Freixieiro, 215-C, 2.º Esq.\n4430-319 Vila Nova de Gaia',
      telephone: null,
      email: null,
      intervention_adresse: 'Rua da Praia, 29, 4150-623 Porto - Foz do Douro',
    },
    devis: {
      numero: 'ORC-2026-036',
      titre: 'ORÇAMENTO — Montagem portão pedonal e chapa zincada',
      date_emission: new Date('2026-05-23'),
      validite_jours: 30,
      delai_execution: '2 dias',
      date_prestation: new Date('2026-06-02'),
      docType: 'devis',
    },
    mode_affichage: 'sections',
    lignes: [
      // ── MÃO DE OBRA (530 €) ──
      {
        designation: 'Deslocação e entrega de materiais',
        lineDetail: 'Deslocação ao local de obra e entrega dos materiais necessários à execução dos trabalhos.',
        quantite: 1,
        unite: 'f',
        prix_unitaire: 80,
        total: 80,
        section: 'main_oeuvre',
        etapes: [
          { ordre: 1, designation: 'Carregamento e transporte dos materiais para o local' },
          { ordre: 2, designation: 'Descarregamento e organização em obra' },
          { ordre: 3, designation: 'Deslocação da equipa para execução dos trabalhos' },
        ],
      },
      {
        designation: 'Afinação do vão, corte de pedra e preparação das fixações',
        lineDetail: 'Afinação do vão existente, corte limpo da pedra e criação dos pontos de fixação para acolhimento do portão e chapa zincada.',
        quantite: 1,
        unite: 'f',
        prix_unitaire: 70,
        total: 70,
        section: 'main_oeuvre',
        etapes: [
          { ordre: 1, designation: 'Afinação e ajuste do vão existente' },
          { ordre: 2, designation: 'Corte da pedra com disco diamantado' },
          { ordre: 3, designation: 'Furação e instalação dos pontos de ancoragem' },
        ],
      },
      {
        designation: 'Corte, montagem de chapa e portão pedonal de entrada',
        lineDetail: 'Corte e colocação da chapa zincada e montagem do portão pedonal (1,80 m alt. × 1,00 m larg.), com fixação nos pontos de ancoragem previamente criados.',
        quantite: 1,
        unite: 'f',
        prix_unitaire: 350,
        total: 350,
        section: 'main_oeuvre',
        etapes: [
          { ordre: 1, designation: 'Corte e ajuste da chapa zincada ao nível do portão' },
          { ordre: 2, designation: 'Posicionamento e alinhamento do portão pedonal (1,80 × 1,00 m) e chapa' },
          { ordre: 3, designation: 'Fixação nos pontos de ancoragem e verificação do funcionamento' },
        ],
      },
      {
        designation: 'Limpeza do local e evacuação de entulhos',
        lineDetail: 'Limpeza geral da zona de obra e evacuação de todos os entulhos e resíduos gerados, com deposição em centro de resíduos profissional.',
        quantite: 1,
        unite: 'f',
        prix_unitaire: 30,
        total: 30,
        section: 'main_oeuvre',
        etapes: [
          { ordre: 1, designation: 'Recolha e ensacamento dos entulhos e resíduos de obra' },
          { ordre: 2, designation: 'Carregamento e transporte para ecocentro profissional' },
          { ordre: 3, designation: 'Limpeza final do local de intervenção' },
        ],
      },
      // ── MATERIAIS (341,93 €) ──
      {
        designation: 'Bucha química Fischer VS 300ml',
        quantite: 2,
        unite: 'u',
        prix_unitaire: 26.76,
        total: 53.52,
        section: 'materiaux',
      },
      {
        designation: 'Bucha rosca M8 zincada (caixa)',
        quantite: 1,
        unite: 'u',
        prix_unitaire: 14.85,
        total: 14.85,
        section: 'materiaux',
      },
      {
        designation: 'Parafusaria inox M8/M10 sortida (kit)',
        quantite: 1,
        unite: 'u',
        prix_unitaire: 11.90,
        total: 11.90,
        section: 'materiaux',
      },
      {
        designation: 'Pé de prumo',
        quantite: 6,
        unite: 'u',
        prix_unitaire: 25.78,
        total: 154.68,
        section: 'materiaux',
      },
      {
        designation: 'Prumo para chapa',
        quantite: 6,
        unite: 'u',
        prix_unitaire: 17.83,
        total: 106.98,
        section: 'materiaux',
      },
    ],
    // Subtotal: 871,93 €, IVA 23%: 200,54 €, Total: 1072,47 €
    tvaBreakdown: [{ rate: 23, base: 871.93, amount: 200.54 }],
    acomptes: [
      {
        label: 'Adiantamento 30%',
        montant: 321.74,
        pourcentage: 30,
        declencheur: 'Na aceitação do orçamento',
        statut: 'en attente',
      },
      {
        label: 'Restante 70%',
        montant: 750.73,
        pourcentage: 70,
        declencheur: 'Após conclusão dos trabalhos',
        statut: 'en attente',
      },
    ],
    notes: 'Materiais fornecidos pelo cliente: portão Maurice (já no local) e 4 chapas galvanizadas 2000x1000x0.8mm.\nEm caso de necessidade de furação em pedra ou betão armado não prevista, será apresentado orçamento adicional.',
    isHorsEtablissement: true,
    penalite_retard: 'taxa de juro legal em vigor',
  }

  console.log('Generating PDF via V2 artisan PT generator...')
  const pdf = await generateDevisPdfV2(input)
  const buffer = pdf.output('arraybuffer') as ArrayBuffer
  const outPath = '/Users/elgato_fofo/Downloads/Orcamento-V2-Julieta-Portao-Chapa.pdf'
  writeFileSync(outPath, Buffer.from(buffer))
  console.log(`OK: ${outPath} (${(buffer.byteLength / 1024).toFixed(1)} KB)`)
}

main().catch(err => {
  console.error('FAILED:', err)
  process.exit(1)
})
