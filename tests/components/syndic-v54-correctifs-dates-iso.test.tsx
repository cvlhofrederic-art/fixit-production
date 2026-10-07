import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import type { ComponentType } from 'react'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'
import { V54LocaleProvider, type V54Locale } from '@/lib/syndic/v54/i18n'
import { ToastProvider } from '@/components/syndic-dashboard/v54/primitives/toast'
import { downloadReportPdf } from '@/lib/syndic/v54/report-pdf'
import type { Mission, Immeuble } from '@/components/syndic-dashboard/types'
import type {
  PrazoLegal, Contrato, Obra, Enquete, Obrigacao, CertEnergetico, Recouvrement, ContabChamada, ContabDiario,
  Elevador, FaturaCopro, ProcessoJud, Procuracao, Reembolso, Reserva, SegEdificio, Seguro, Deliberacao,
  Vistoria, Votacao, Caderneta, Impaye,
} from '@/lib/syndic/v54/api'
import ModObrigPrazos from '@/components/syndic-dashboard/v54/modules/ModObrigPrazos'
import ModPrazosLegais from '@/components/syndic-dashboard/v54/modules/ModPrazosLegais'
import ModContratos from '@/components/syndic-dashboard/v54/modules/ModContratos'
import ModMod3Orcamentos from '@/components/syndic-dashboard/v54/modules/ModMod3Orcamentos'
import ModEnquetes from '@/components/syndic-dashboard/v54/modules/ModEnquetes'
import ModCalReg from '@/components/syndic-dashboard/v54/modules/ModCalReg'
import ModCertEnerg from '@/components/syndic-dashboard/v54/modules/ModCertEnerg'
import ModCobrJud from '@/components/syndic-dashboard/v54/modules/ModCobrJud'
import ModContabCond from '@/components/syndic-dashboard/v54/modules/ModContabCond'
import ModContabTec from '@/components/syndic-dashboard/v54/modules/ModContabTec'
import ModDashboard from '@/components/syndic-dashboard/v54/modules/ModDashboard'
import ModElevadores from '@/components/syndic-dashboard/v54/modules/ModElevadores'
import ModFaturacao from '@/components/syndic-dashboard/v54/modules/ModFaturacao'
import ModHistEdificio from '@/components/syndic-dashboard/v54/modules/ModHistEdificio'
import ModNotificJud from '@/components/syndic-dashboard/v54/modules/ModNotificJud'
import ModOrdens from '@/components/syndic-dashboard/v54/modules/ModOrdens'
import ModProcuracoes from '@/components/syndic-dashboard/v54/modules/ModProcuracoes'
import ModReembolsos from '@/components/syndic-dashboard/v54/modules/ModReembolsos'
import ModReservaEsp from '@/components/syndic-dashboard/v54/modules/ModReservaEsp'
import ModSegEdificio from '@/components/syndic-dashboard/v54/modules/ModSegEdificio'
import ModSeguroObr from '@/components/syndic-dashboard/v54/modules/ModSeguroObr'
import ModSeguros from '@/components/syndic-dashboard/v54/modules/ModSeguros'
import ModTrackerDelibs from '@/components/syndic-dashboard/v54/modules/ModTrackerDelibs'
import ModVistoria from '@/components/syndic-dashboard/v54/modules/ModVistoria'
import ModVotacaoOnline from '@/components/syndic-dashboard/v54/modules/ModVotacaoOnline'
import ModCadernetaMan from '@/components/syndic-dashboard/v54/modules/ModCadernetaMan'
import ModCobrAuto from '@/components/syndic-dashboard/v54/modules/ModCobrAuto'
import ModValoresDivida from '@/components/syndic-dashboard/v54/modules/ModValoresDivida'
import { CONTAB_COND_MESSAGES } from '@/components/syndic-dashboard/v54/modules/i18n/ModContabCond.messages'
import { CADERNETA_MESSAGES } from '@/components/syndic-dashboard/v54/modules/i18n/ModCadernetaMan.messages'
import { PROCURACOES_MESSAGES } from '@/components/syndic-dashboard/v54/modules/i18n/ModProcuracoes.messages'
import { VALORES_DIVIDA_MESSAGES } from '@/components/syndic-dashboard/v54/modules/i18n/ModValoresDivida.messages'

/**
 * Correctif : les dates renvoyées par l'API (colonnes DATE « AAAA-MM-JJ ») s'affichaient brutes,
 * en PT comme en FR (« Échéance : 2031-03-17 »). Elles s'affichent désormais en JJ/MM/AAAA via
 * dateApi (lib/syndic/v54/i18n/dates.ts) ; les dates de démonstration déjà rédigées restent telles quelles.
 */

vi.mock('@/lib/syndic/v54/report-pdf', () => ({ downloadReportPdf: vi.fn() }))
const pdf = vi.mocked(downloadReportPdf)

afterEach(() => { cleanup(); vi.clearAllMocks() })

const LANGUES: V54Locale[] = ['pt-PT', 'fr-FR']
const D1 = '2031-03-17'
const F1 = '17/03/2031'
const D2 = '2032-11-04'
const F2 = '04/11/2032'

const donnees = (over: Partial<SyndicData>): SyndicData => ({
  authenticated: true, loading: false, token: 't', refresh: vi.fn(), missions: [], immeubles: [], artisans: [], team: [], coproprios: [], ...over,
})

function rendre(locale: V54Locale, Module: ComponentType, data?: SyndicData) {
  const ecran = <Module />
  return render(
    <V54LocaleProvider locale={locale}>
      <ToastProvider>
        {data ? <SyndicDataContext.Provider value={data}>{ecran}</SyndicDataContext.Provider> : ecran}
      </ToastProvider>
    </V54LocaleProvider>,
  )
}

const texte = () => document.body.textContent ?? ''

// ── Fabriques (formes de l'API) ──
const mission = (over: Partial<Mission>): Mission => ({ id: 'm1', immeuble: 'IMM-TEST', artisan: 'Pro Test', type: 'Intervention', description: '', priorite: 'normale', statut: 'en_cours', dateCreation: '2030-01-01', ...over })
const immeuble: Immeuble = { id: 'b1', nom: 'IMM-TEST', adresse: 'Rua X', ville: 'Porto', codePostal: '4000', nbLots: 10, anneeConstruction: 2000, typeImmeuble: 'habitacional', gestionnaire: '', nbInterventions: 0, budgetAnnuel: 10000, depensesAnnee: 5000 }
const prazo = (over: Partial<PrazoLegal>): PrazoLegal => ({ id: 'p1', immeuble: 'IMM-TEST', titulo: 'Obligation test', tipo: 'conservacao', dataLimite: D1, statut: 'pendente', notes: '', ...over })
const contrato = (over: Partial<Contrato>): Contrato => ({ id: 'c1', immeuble: 'IMM-TEST', fornecedor: 'Fournisseur', categoria: 'limpezas', custoMensal: 100, custoAnual: 1200, dataInicio: '2030-01-01', dataFim: D1, statut: 'ativo', notes: '', ...over })
const obra = (over: Partial<Obra>): Obra => ({ id: 'o1', titulo: 'Travaux test', tipo: 'Réparation', descricao: '', local: 'IMM-TEST', prazo: D1, estado: 'orcamentacao', orcamento: 0, empresa: '', numOrcamentos: 0, ...over })
const enquete = (over: Partial<Enquete>): Enquete => ({ id: 'e1', titulo: 'Sondage test', descricao: '', estado: 'ativa', tipo: 'Sim / Não', edificio: '', prazo: D1, total: 10, options: [], anonima: false, ...over })
const obrigacao = (over: Partial<Obrigacao>): Obrigacao => ({ id: 'ob1', edificio: 'IMM-TEST', tipo: 'Inspection', descricao: '', prazo: D1, concluido: false, ...over })
const certificat = (over: Partial<CertEnergetico>): CertEnergetico => ({ id: 'ce1', numero: 'CE-1', edificio: 'IMM-TEST', perito: '', classe: 'B', dataEmissao: D1, dataValidade: D2, notas: '', ...over })
const recouvrement = (over: Partial<Recouvrement>): Recouvrement => ({ id: 'r1', immeubleId: '', coproprioId: '', impayeId: '', procedure: 'amiable', statut: 'en_cours', montantInitial: 1000, montantRecouvre: 0, dateOuverture: '2030-01-01', dateCloture: '', avocatHuissier: '', prochaineEcheance: D1, notes: '', ...over })
const chamada = (over: Partial<ContabChamada>): ContabChamada => ({ id: 'ch1', titulo: 'Appel T1', edificio: 'IMM-TEST', dataEmissao: D1, dataVencimento: D2, montante: 1000, distribuicao: '', notas: '', liquidadas: 0, ...over })
const ecriture = (over: Partial<ContabDiario>): ContabDiario => ({ id: 'di1', data: D1, tipo: 'credito', conta: '701', montante: 50, descricao: 'Écriture test', ...over })
const elevador = (over: Partial<Elevador>): Elevador => ({ id: 'el1', immeuble: 'IMM-TEST', marca: 'OTIS', categoria: 'habitacional', ema: '', ultimaInspecao: D1, proximaInspecao: D2, estado: 'conforme', notes: '', ...over })
const fatura = (over: Partial<FaturaCopro>): FaturaCopro => ({ id: 'f1', coproprioId: '', immeubleId: '', numeroFatura: 'FT-1', emiseLe: D1, echeance: D2, montantHt: 100, tvaTaux: 0, montantTtc: 100, description: '', statut: 'a_regler', pdfUrl: '', ...over })
const processo = (over: Partial<ProcessoJud>): ProcessoJud => ({ id: 'j1', tipo: 'Assignation', contraparte: 'X', processo: '1/31', data: D1, prazo: '', estado: 'ativo', valor: 0, descricao: '', ...over })
const procuracao = (over: Partial<Procuracao>): Procuracao => ({ id: 'pr1', immeuble: 'IMM-TEST', condomino: 'Mandant', procurador: 'Mandataire', fracao: 'A', dataValidade: D1, agRef: '', statut: 'valida', notes: '', ...over })
const reembolso = (over: Partial<Reembolso>): Reembolso => ({ id: 're1', immeuble: 'IMM-TEST', antigoProprietario: 'Vendeur', fracao: 'A', dataVenda: D1, quotasPagas: 100, montanteReembolso: 50, metodo: '', statut: 'pendente', notes: '', ...over })
const reserva = (over: Partial<Reserva>): Reserva => ({ id: 'rs1', espaco: 'Salle commune', quem: 'Lot A', data: D1, hora: '10:00', estado: 'confirmada', notes: '', ...over })
const segEdificio = (over: Partial<SegEdificio>): SegEdificio => ({ id: 's1', immeuble: 'IMM-TEST', categoria: '1', encarregado: '', planoEmergencia: true, ultimoExercicio: D1, notes: '', ...over })
const seguro = (over: Partial<Seguro>): Seguro => ({ id: 'sg1', immeuble: 'IMM-TEST', seguradora: 'Assureur', tipo: 'incendio', apolice: 'AP-1', premioAnual: 500, capital: 100000, dataInicio: D1, dataFim: D2, statut: 'ativa', notes: '', ...over })
const deliberacao = (over: Partial<Deliberacao>): Deliberacao => ({ id: 'd1', deliberacao: 'Résolution test', ag: 'AG', responsavel: '', prazo: D1, estado: 'em_curso', origem: 'manual', ...over })
const vistoria = (over: Partial<Vistoria>): Vistoria => ({ id: 'v1', immeuble: 'IMM-TEST', titulo: 'Visite test', statut: 'concluida', pontosVigiar: 0, pontosDeficientes: 0, dataVistoria: D1, notes: '', ...over })
const votacao = (over: Partial<Votacao>): Votacao => ({ id: 'vo1', titulo: 'Vote test', descricao: '', edificio: '', estado: 'aberta', maioria: 'simples', artigo: '', prazo: D1, permTotal: 1000, options: [], ...over })
const caderneta = (over: Partial<Caderneta>): Caderneta => ({ id: 'ca1', data: D1, estado: 'realizado', natureza: 'reparacao', edificio: 'IMM-TEST', localizacao: '', prestador: '', custo: 100, garantia: '', cee: 'na', notas: '', ...over })
const impaye = (over: Partial<Impaye>): Impaye => ({ id: 'i1', immeubleId: '', coproprioId: '', montant: 300, nature: 'charges_courantes', depuis: D1, derniereRelanceAt: '', nbRelances: 0, statut: 'ouvert', notes: '', ...over })

type Cas = { nom: string; Module: ComponentType; data: SyndicData; attendues: string[]; avant?: (locale: V54Locale) => void }

const CAS: Cas[] = [
  { nom: 'ModObrigPrazos — échéance', Module: ModObrigPrazos, data: donnees({ prazos: [prazo({})] }), attendues: [F1] },
  { nom: 'ModPrazosLegais — date limite', Module: ModPrazosLegais, data: donnees({ prazos: [prazo({})] }), attendues: [F1] },
  { nom: 'ModContratos — fin du contrat', Module: ModContratos, data: donnees({ contratos: [contrato({})] }), attendues: [F1] },
  { nom: 'ModMod3Orcamentos — échéance des travaux', Module: ModMod3Orcamentos, data: donnees({ obras: [obra({})] }), attendues: [F1] },
  { nom: 'ModEnquetes — date limite du sondage', Module: ModEnquetes, data: donnees({ enquetes: [enquete({})] }), attendues: [F1] },
  { nom: 'ModCalReg — échéance réglementaire', Module: ModCalReg, data: donnees({ obrigacoes: [obrigacao({})] }), attendues: [F1] },
  { nom: 'ModCertEnerg — émission et validité', Module: ModCertEnerg, data: donnees({ certificados: [certificat({})] }), attendues: [F1, F2] },
  { nom: 'ModCobrJud — prochaine échéance', Module: ModCobrJud, data: donnees({ recouvrements: [recouvrement({})] }), attendues: [F1] },
  {
    nom: 'ModContabCond — appels de fonds (émission, échéance)', Module: ModContabCond,
    data: donnees({ contab: { fracoes: [], chamadas: [chamada({})], diario: [], orcamentos: [] } }), attendues: [F1, F2],
    avant: (locale) => fireEvent.click(screen.getByRole('tab', { name: CONTAB_COND_MESSAGES[locale].onglets.cq(1) })),
  },
  {
    nom: 'ModContabCond — journal comptable', Module: ModContabCond,
    data: donnees({ contab: { fracoes: [], chamadas: [], diario: [ecriture({})], orcamentos: [] } }), attendues: [F1],
    avant: (locale) => fireEvent.click(screen.getByRole('tab', { name: CONTAB_COND_MESSAGES[locale].onglets.diar(1) })),
  },
  { nom: 'ModContabTec — date d\'intervention', Module: ModContabTec, data: donnees({ missions: [mission({ dateIntervention: D1 })] }), attendues: [F1] },
  { nom: 'ModDashboard — missions récentes', Module: ModDashboard, data: donnees({ missions: [mission({ dateIntervention: D1 })] }), attendues: [F1] },
  { nom: 'ModElevadores — dernier et prochain contrôle', Module: ModElevadores, data: donnees({ elevadores: [elevador({})] }), attendues: [F1, F2] },
  { nom: 'ModFaturacao — émission et échéance', Module: ModFaturacao, data: donnees({ faturas: [fatura({})] }), attendues: [F1, F2] },
  {
    nom: 'ModHistEdificio — interventions, ascenseurs, contrats', Module: ModHistEdificio,
    data: donnees({ immeubles: [immeuble], missions: [mission({ dateCreation: D1 })], elevadores: [elevador({ ultimaInspecao: D1, proximaInspecao: D2 })], contratos: [contrato({ dataFim: D2 })] }),
    attendues: [F1, F2],
  },
  { nom: 'ModNotificJud — date de la pièce', Module: ModNotificJud, data: donnees({ processosJud: [processo({})] }), attendues: [F1] },
  { nom: 'ModOrdens — date de l\'ordre de service', Module: ModOrdens, data: donnees({ missions: [mission({ dateIntervention: D1 })] }), attendues: [F1] },
  { nom: 'ModProcuracoes — validité du pouvoir', Module: ModProcuracoes, data: donnees({ procuracoes: [procuracao({})] }), attendues: [F1] },
  { nom: 'ModReembolsos — date de vente', Module: ModReembolsos, data: donnees({ reembolsos: [reembolso({})] }), attendues: [F1] },
  { nom: 'ModReservaEsp — date de réservation', Module: ModReservaEsp, data: donnees({ reservas: [reserva({})] }), attendues: [F1] },
  { nom: 'ModSegEdificio — dernier exercice', Module: ModSegEdificio, data: donnees({ segEdificios: [segEdificio({})] }), attendues: [F1] },
  { nom: 'ModSeguroObr — début et fin de police', Module: ModSeguroObr, data: donnees({ seguros: [seguro({})] }), attendues: [F1, F2] },
  { nom: 'ModSeguros — fin de police', Module: ModSeguros, data: donnees({ seguros: [seguro({ dataFim: D1 })] }), attendues: [F1] },
  { nom: 'ModTrackerDelibs — échéance', Module: ModTrackerDelibs, data: donnees({ deliberacoes: [deliberacao({})] }), attendues: [F1] },
  { nom: 'ModVistoria — date de visite', Module: ModVistoria, data: donnees({ vistorias: [vistoria({})] }), attendues: [F1] },
  { nom: 'ModVotacaoOnline — date limite du vote', Module: ModVotacaoOnline, data: donnees({ votacoes: [votacao({})] }), attendues: [F1] },
  { nom: 'ModCadernetaMan — date d\'intervention', Module: ModCadernetaMan, data: donnees({ caderneta: [caderneta({})] }), attendues: [F1] },
  { nom: 'ModCobrAuto — impayé depuis', Module: ModCobrAuto, data: donnees({ impayes: [impaye({})] }), attendues: [F1] },
]

describe('Dates API affichées en JJ/MM/AAAA (données réelles)', () => {
  for (const cas of CAS) {
    it.each(LANGUES)(`${cas.nom} — %s`, (locale) => {
      rendre(locale, cas.Module, cas.data)
      cas.avant?.(locale)
      for (const date of cas.attendues) expect(texte()).toContain(date)
      expect(texte()).not.toContain(D1)
      expect(texte()).not.toContain(D2)
    })
  }

  it.each(LANGUES)('ModOrdens : date absente → repli « — » inchangé (%s)', (locale) => {
    rendre(locale, ModOrdens, donnees({ missions: [mission({ dateCreation: '', dateIntervention: undefined })] }))
    expect(texte()).toContain('—')
    expect(texte()).not.toMatch(/\d{2}\/\d{2}\/\d{4}/)
  })

  it.each(LANGUES)('valeur non ISO saisie en texte libre : affichée telle quelle (%s)', (locale) => {
    rendre(locale, ModElevadores, donnees({ elevadores: [elevador({ ultimaInspecao: '05/2031', proximaInspecao: 'a definir' })] }))
    expect(texte()).toContain('05/2031')
    expect(texte()).toContain('a definir')
  })
})

describe('PDF générés : dates en JJ/MM/AAAA', () => {
  it.each(LANGUES)('ModCadernetaMan — export PDF (%s)', (locale) => {
    rendre(locale, ModCadernetaMan, donnees({ caderneta: [caderneta({})] }))
    fireEvent.click(screen.getByRole('button', { name: new RegExp(CADERNETA_MESSAGES[locale].exporterPdf) }))
    expect(pdf).toHaveBeenCalledTimes(1)
    expect(pdf.mock.calls[0][1].tables?.[0]?.rows[0]?.[0]).toBe(F1)
  })

  it.each(LANGUES)('ModProcuracoes — feuille de présence (%s)', (locale) => {
    rendre(locale, ModProcuracoes, donnees({ procuracoes: [procuracao({})] }))
    fireEvent.click(screen.getByRole('button', { name: new RegExp(PROCURACOES_MESSAGES[locale].genererFeuille) }))
    expect(pdf).toHaveBeenCalledTimes(1)
    expect(pdf.mock.calls[0][1].tables?.[0]?.rows[0]?.[3]).toBe(F1)
  })
})

describe('Démonstration (non connecté)', () => {
  it.each(LANGUES)('dates de démonstration ISO formatées comme les vraies (%s)', (locale) => {
    rendre(locale, ModMod3Orcamentos)
    expect(texte()).toContain('30/06/2026')
    expect(texte()).not.toContain('2026-06-30')
    cleanup()
    rendre(locale, ModCalReg)
    expect(texte()).toContain('15/04/2026')
    expect(texte()).not.toContain('2026-04-15')
    cleanup()
    rendre(locale, ModVotacaoOnline)
    expect(texte()).toContain('23/05/2026')
    expect(texte()).not.toContain('2026-05-23')
  })

  it('dates de démonstration déjà rédigées : inchangées', () => {
    rendre('pt-PT', ModPrazosLegais)
    expect(texte()).toContain('21 de novembro de 2026')
    cleanup()
    rendre('fr-FR', ModPrazosLegais)
    expect(texte()).toContain('21 novembre 2026')
    cleanup()
    rendre('pt-PT', ModEnquetes)
    expect(texte()).toContain('8 dias restantes')
    cleanup()
    rendre('fr-FR', ModEnquetes)
    expect(texte()).toContain('8 jours restants')
    cleanup()
    rendre('fr-FR', ModOrdens)
    expect(texte()).toContain('22/05/2026')
  })

  it.each(LANGUES)('ModValoresDivida : échéance saisie dans l\'aperçu affichée en JJ/MM/AAAA (%s)', (locale) => {
    const t = VALORES_DIVIDA_MESSAGES[locale]
    const f = t.formulaire
    rendre(locale, ModValoresDivida)
    const ouvrir = screen.getAllByRole('button').find((b) => b.textContent?.includes(t.nouvelImpaye))
    if (!ouvrir) throw new Error('bouton introuvable')
    fireEvent.click(ouvrir)
    fireEvent.change(screen.getByLabelText(new RegExp(f.condomino)), { target: { value: 'Débiteur test' } })
    fireEvent.change(screen.getByLabelText(new RegExp(f.montante)), { target: { value: '120' } })
    fireEvent.change(screen.getByLabelText(new RegExp(f.vencimento)), { target: { value: D1 } })
    fireEvent.click(screen.getByRole('button', { name: f.enregistrer }))
    expect(texte()).toContain(F1)
    expect(texte()).not.toContain(D1)
  })
})
