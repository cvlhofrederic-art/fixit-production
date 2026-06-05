'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Mission, Immeuble, Artisan, TeamMember } from '@/components/syndic-dashboard/types'
import { useSyndicSession } from './session'
import { fetchMissions, fetchImmeubles, fetchArtisans, fetchCoproprios, fetchTeam, fetchContratos, fetchSeguros, fetchSignalements, fetchElevadores, fetchSinistros, fetchVistorias, fetchPrazos, fetchAvisos, fetchReembolsos, fetchProcuracoes, fetchSegEdificio, fetchCaderneta, fetchCertEnerg, fetchDeclEncargos, fetchFcrEdificios, fetchFcrMovimentos, fetchAgV54, fetchContab, fetchImpayes, fetchRecouvrement, fetchFaturas, fetchReservas, fetchInfracoes, fetchEnquetes, fetchChecklists, fetchPlanosMan, fetchDeliberacoes, fetchProcessosJud, fetchObrigacoes, fetchCampanhas, fetchVotacoes, fetchNps, fetchObras, type Coprop, type Contrato, type Seguro, type Signalement, type Elevador, type Sinistro, type Vistoria, type PrazoLegal, type Aviso, type Reembolso, type Procuracao, type SegEdificio, type Caderneta, type CertEnergetico, type DeclEncargo, type FcrEdificio, type FcrMovimento, type AgV54, type ContabData, type Impaye, type Recouvrement, type FaturaCopro, type Reserva, type Infracao, type Enquete, type Checklist, type PlanoMan, type Deliberacao, type ProcessoJud, type Obrigacao, type Campanha, type Votacao, type Nps, type Obra } from './api'

/**
 * Provider data du dashboard syndic v54 (Phase 2).
 *
 * Récupère UNE FOIS les datasets cœur du cabinet (missions, immeubles,
 * artisans) quand l'utilisateur est un syndic authentifié, et les expose à
 * tous les modules v54 via useSyndicData(). Anonyme → `authenticated:false`
 * + listes vides : chaque module retombe alors sur ses données mock (la
 * preview publique /syndic/v54 reste intacte).
 *
 * Pattern aligné sur l'ancien dashboard (fetch unique en haut, partagé aux
 * sections) — mais branché aux routes /api/syndic/* via Bearer token.
 */
export interface SyndicData {
  /** true = syndic connecté → données réelles ; false = mock/preview. */
  authenticated: boolean
  loading: boolean
  missions: Mission[]
  immeubles: Immeuble[]
  artisans: Artisan[]
  /** Optionnels : ajoutés en P2.2 ; les consommateurs utilisent `?? []`. */
  coproprios?: Coprop[]
  team?: TeamMember[]
  /** Contrats prestataires (Phase 3 — ModContratos). */
  contratos?: Contrato[]
  /** Apólices de seguro (Phase 3 — ModSeguros). */
  seguros?: Seguro[]
  /** Ocorrências / signalements (Phase 3 — ModOcorrencias, table existante). */
  signalements?: Signalement[]
  /** Ascenseurs (Phase 3 — ModElevadores). */
  elevadores?: Elevador[]
  /** Sinistres assurance (Phase 3 — ModSinistros). */
  sinistros?: Sinistro[]
  /** Vistorias techniques (Phase 3 — ModVistoria). */
  vistorias?: Vistoria[]
  /** Obligations légales / échéances (Phase 3 — ModPrazosLegais). */
  prazos?: PrazoLegal[]
  /** Quadro de avisos (Phase 3 — ModQuadroAvisos). */
  avisos?: Aviso[]
  /** Reembolsos pro-rata (Phase 3 — ModReembolsos). */
  reembolsos?: Reembolso[]
  /** Procurations AG (Phase 3 — ModProcuracoes). */
  procuracoes?: Procuracao[]
  /** Sécurité incendie SCIE (Phase 3 — ModSegEdificio). */
  segEdificios?: SegEdificio[]
  /** Caderneta de manutenção & técnica (Phase 3 — ModCadernetaMan). */
  caderneta?: Caderneta[]
  /** Certificados energéticos SCE (Phase 3 — ModCertEnerg). */
  certificados?: CertEnergetico[]
  /** Declarações de encargos (Phase 3 — ModDeclEncargos, Lei 8/2022). */
  declaracoes?: DeclEncargo[]
  /** FCR — édifices configurés au fundo comum de reserva (Phase 3 — ModFCR). */
  fcrEdificios?: FcrEdificio[]
  /** FCR — mouvements du fundo comum de reserva (Phase 3 — ModFCR). */
  fcrMovimentos?: FcrMovimento[]
  /** Assemblées générales v54 (Phase 3 — ModAGDigit, table syndic_assemblees). */
  assembleias?: AgV54[]
  /** Contabilidade Condomínio — 4 entités (Phase 3 — ModContabCond). */
  contab?: ContabData
  /** Impayés / cobrança (Phase 3 — ModCobrAuto, table syndic_impayes). */
  impayes?: Impaye[]
  /** Recouvrement / cobrança judicial (Phase 3 — ModCobrJud, table syndic_recouvrement). */
  recouvrements?: Recouvrement[]
  /** Factures condomínio (Phase 3 — ModFaturacao, table syndic_factures_copro). */
  faturas?: FaturaCopro[]
  /** Réservations d'espaces communs (lot net-new — ModReservaEsp). */
  reservas?: Reserva[]
  /** Infractions au règlement (lot net-new — ModInfracoes). */
  infracoes?: Infracao[]
  /** Enquêtes & sondages (lot net-new — ModEnquetes). */
  enquetes?: Enquete[]
  /** Checklists opérationnelles (lot net-new — ModChecklists). */
  checklists?: Checklist[]
  /** Plans de manutenção (lot 2 — ModPlanoMan). */
  planosMan?: PlanoMan[]
  /** Délibérations d'AG suivies (lot 2 — ModTrackerDelibs). */
  deliberacoes?: Deliberacao[]
  /** Processus / notifications judiciaires (lot 2 — ModNotificJud). */
  processosJud?: ProcessoJud[]
  /** Obrigações regulamentares / calendrier légal (lot 3 — ModCalReg). */
  obrigacoes?: Obrigacao[]
  /** Campanhas de contact proactif (lot 3 — ModContacto). */
  campanhas?: Campanha[]
  /** Votações online AG (lot 4 — ModVotacaoOnline). */
  votacoes?: Votacao[]
  /** Réponses NPS post-intervention (lot 7 — ModNPSPosIntervencao). */
  nps?: Nps[]
  /** Obras + comparaison 3 devis (lot 7 — ModMod3Orcamentos). */
  obras?: Obra[]
  /** Token Bearer pour les écritures POST (Phase 2 écritures). */
  token?: string
  /** Refetch des datasets après une écriture réussie. */
  refresh?: () => void
}

const EMPTY: SyndicData = { authenticated: false, loading: false, missions: [], immeubles: [], artisans: [], coproprios: [], team: [], contratos: [], seguros: [], signalements: [], elevadores: [], sinistros: [], vistorias: [], prazos: [], avisos: [], reembolsos: [], procuracoes: [], segEdificios: [], caderneta: [], certificados: [], declaracoes: [], fcrEdificios: [], fcrMovimentos: [], assembleias: [], contab: { fracoes: [], chamadas: [], diario: [], orcamentos: [] }, impayes: [], recouvrements: [], faturas: [], reservas: [], infracoes: [], enquetes: [], checklists: [], planosMan: [], deliberacoes: [], processosJud: [], obrigacoes: [], campanhas: [], votacoes: [], nps: [], obras: [] }

/** Exporté pour les tests (injection d'un value mock) — l'app utilise SyndicDataProvider. */
export const SyndicDataContext = createContext<SyndicData>(EMPTY)

/** Hook d'accès aux données syndic réelles (vide + authenticated:false hors auth). */
export const useSyndicData = (): SyndicData => useContext(SyndicDataContext)

export function SyndicDataProvider({ children }: { children: ReactNode }) {
  const session = useSyndicSession()
  const [data, setData] = useState<SyndicData>(EMPTY)

  const load = useCallback(() => {
    const token = session.token
    if (session.status !== 'authed' || !token) return
    setData((d) => ({ ...d, authenticated: true, loading: true }))
    Promise.allSettled([fetchMissions(token), fetchImmeubles(token), fetchArtisans(token), fetchCoproprios(token), fetchTeam(token), fetchContratos(token), fetchSeguros(token), fetchSignalements(token), fetchElevadores(token), fetchSinistros(token), fetchVistorias(token), fetchPrazos(token), fetchAvisos(token), fetchReembolsos(token), fetchProcuracoes(token), fetchSegEdificio(token), fetchCaderneta(token), fetchCertEnerg(token), fetchDeclEncargos(token), fetchFcrEdificios(token), fetchFcrMovimentos(token), fetchAgV54(token), fetchContab(token), fetchImpayes(token), fetchRecouvrement(token), fetchFaturas(token), fetchReservas(token), fetchInfracoes(token), fetchEnquetes(token), fetchChecklists(token), fetchPlanosMan(token), fetchDeliberacoes(token), fetchProcessosJud(token), fetchObrigacoes(token), fetchCampanhas(token), fetchVotacoes(token), fetchNps(token), fetchObras(token)]).then(
      ([m, i, a, c, t, k, g, sg, el, si, vi, pz, av, re, pr, se, cd, ce, de, fe, fm, ag, cc, ip, rc, ft, rs, inf, eq, ch, pm, dl, pj, ob, cp, vt, np, obr]) => {
        setData({
          authenticated: true,
          loading: false,
          missions: m.status === 'fulfilled' ? m.value : [],
          immeubles: i.status === 'fulfilled' ? i.value : [],
          artisans: a.status === 'fulfilled' ? a.value : [],
          coproprios: c.status === 'fulfilled' ? c.value : [],
          team: t.status === 'fulfilled' ? t.value : [],
          contratos: k.status === 'fulfilled' ? k.value : [],
          seguros: g.status === 'fulfilled' ? g.value : [],
          signalements: sg.status === 'fulfilled' ? sg.value : [],
          elevadores: el.status === 'fulfilled' ? el.value : [],
          sinistros: si.status === 'fulfilled' ? si.value : [],
          vistorias: vi.status === 'fulfilled' ? vi.value : [],
          prazos: pz.status === 'fulfilled' ? pz.value : [],
          avisos: av.status === 'fulfilled' ? av.value : [],
          reembolsos: re.status === 'fulfilled' ? re.value : [],
          procuracoes: pr.status === 'fulfilled' ? pr.value : [],
          segEdificios: se.status === 'fulfilled' ? se.value : [],
          caderneta: cd.status === 'fulfilled' ? cd.value : [],
          certificados: ce.status === 'fulfilled' ? ce.value : [],
          declaracoes: de.status === 'fulfilled' ? de.value : [],
          fcrEdificios: fe.status === 'fulfilled' ? fe.value : [],
          fcrMovimentos: fm.status === 'fulfilled' ? fm.value : [],
          assembleias: ag.status === 'fulfilled' ? ag.value : [],
          contab: cc.status === 'fulfilled' ? cc.value : { fracoes: [], chamadas: [], diario: [], orcamentos: [] },
          impayes: ip.status === 'fulfilled' ? ip.value : [],
          recouvrements: rc.status === 'fulfilled' ? rc.value : [],
          faturas: ft.status === 'fulfilled' ? ft.value : [],
          reservas: rs.status === 'fulfilled' ? rs.value : [],
          infracoes: inf.status === 'fulfilled' ? inf.value : [],
          enquetes: eq.status === 'fulfilled' ? eq.value : [],
          checklists: ch.status === 'fulfilled' ? ch.value : [],
          planosMan: pm.status === 'fulfilled' ? pm.value : [],
          deliberacoes: dl.status === 'fulfilled' ? dl.value : [],
          processosJud: pj.status === 'fulfilled' ? pj.value : [],
          obrigacoes: ob.status === 'fulfilled' ? ob.value : [],
          campanhas: cp.status === 'fulfilled' ? cp.value : [],
          votacoes: vt.status === 'fulfilled' ? vt.value : [],
          nps: np.status === 'fulfilled' ? np.value : [],
          obras: obr.status === 'fulfilled' ? obr.value : [],
        })
      },
    )
  }, [session.status, session.token])

  useEffect(() => {
    if (session.status === 'loading') {
      setData({ ...EMPTY, loading: true })
      return
    }
    if (session.status === 'anon' || !session.token) {
      setData(EMPTY)
      return
    }
    load()
  }, [session.status, session.token, load])

  // `token` + `refresh` exposés en plus des datasets pour les écritures Phase 2.
  const value = useMemo<SyndicData>(
    () => ({ ...data, token: session.token ?? undefined, refresh: load }),
    [data, session.token, load],
  )

  return <SyndicDataContext.Provider value={value}>{children}</SyndicDataContext.Provider>
}
