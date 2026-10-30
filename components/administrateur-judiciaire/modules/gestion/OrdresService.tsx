'use client'

import { useMemo, useState } from 'react'
import { DEMO_NOMS_COPROPRIETES } from '@/components/administrateur-judiciaire/data/coproprietes'
import { DEMO_ORDRES_DE_SERVICE, type OrdreDeServiceDemo } from '@/components/administrateur-judiciaire/data/ordres-de-service'
import { DEMO_PRESTATAIRES } from '@/components/administrateur-judiciaire/data/prestataires'
import { champCoproprieteChoisie, sousTitreFige, titreListeVide, useCoproChoisie } from '@/components/administrateur-judiciaire/ui/copro-choisie'
import { messageErreurOrdre } from '@/components/administrateur-judiciaire/modules/gestion/vitfix/api'
import {
  EnvoiPrestataireModal,
  type SourceEnvoi,
} from '@/components/administrateur-judiciaire/modules/gestion/vitfix/EnvoiPrestataireModal'
import { SuiviPrestataire, dateCourte } from '@/components/administrateur-judiciaire/modules/gestion/vitfix/SuiviPrestataire'
import { useOrdresPrestataire } from '@/components/administrateur-judiciaire/modules/gestion/vitfix/useOrdresPrestataire'
import { Alert } from '@/components/administrateur-judiciaire/ui/Alert'
import { DetailModal, type ChampDetail } from '@/components/administrateur-judiciaire/ui/DetailModal'
import { EmptyState } from '@/components/administrateur-judiciaire/ui/EmptyState'
import { FormModal, type ChampFormModal } from '@/components/administrateur-judiciaire/ui/FormModal'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'
import { useNomsCoproprietesSelonMode } from '@/lib/administrateur-judiciaire/db/hooks'
import { formatEuros } from '@/lib/administrateur-judiciaire/domain/format'
import { filtrerParCopro } from '@/lib/administrateur-judiciaire/domain/selection-copropriete'
import {
  LIBELLE_STATUT_ORDRE,
  TEINTE_STATUT_ORDRE,
  dernierOrdreParReference,
  libelleUrgenceOrdre,
  type DemandeEnvoiOrdre,
  type OrdrePrestataire,
} from '@/lib/administrateur-judiciaire/ordres-prestataire'

/** Filtre des ordres de service : tous, en cours, à valider, clôturés. */
type FiltreOrdres = 'tous' | 'curso' | 'valider' | 'clos'

/** Fiche détail d'un ordre de service ouverte par « Ouvrir ». */
interface DetailOrdre {
  title: string
  icon: string
  fields: ChampDetail[]
}

/** Teinte de la pastille de statut. */
const teinteStatut = (statut: string) =>
  statut === 'En cours' ? 'amber' : statut === 'À valider' ? 'rust' : statut === 'Planifié' ? 'gold' : 'sage'

/** Champs du formulaire « Nouvel ordre de service » (envoi simulé). */
const CHAMPS_NOUVEL_ORDRE: ChampFormModal[] = [
  {
    label: 'Copropriété',
    type: 'select',
    options: DEMO_NOMS_COPROPRIETES,
    full: true,
  },
  {
    label: 'Objet',
    required: true,
    full: true,
  },
  {
    label: 'Prestataire',
    type: 'select',
    options: DEMO_PRESTATAIRES.map((prestataire) => prestataire.nom),
  },
  {
    label: 'Urgence',
    type: 'select',
    options: ['Normale', 'Prioritaire', 'Urgence'],
  },
  {
    label: 'Description',
    type: 'textarea',
    full: true,
  },
]

/** Champs du formulaire, copropriété choisie préremplie (tels quels sans copropriété choisie). */
const champsNouvelOrdre = (nomCopro: string | null): ChampFormModal[] =>
  CHAMPS_NOUVEL_ORDRE.map((champ) => (champ.label === 'Copropriété' ? champCoproprieteChoisie(nomCopro, champ) : champ))

/** Copropriétés de la saisie libre, la copropriété choisie en tête (valeur par défaut) ; telles quelles sans choix. */
const coproprietesEnvoi = (noms: string[], nomCopro: string | null): string[] =>
  nomCopro ? [nomCopro, ...noms.filter((nom) => nom !== nomCopro)] : noms

/** Intervention de l'écran transmise au prestataire Vitfix (son numéro relie l'ordre envoyé à la carte). */
const sourceDepuisOrdreDemo = (ordre: OrdreDeServiceDemo): SourceEnvoi => ({
  reference: ordre.id,
  copropriete: ordre.copro,
  objet: ordre.objet,
  localisation: ordre.frac,
  urgence: ordre.urg,
})

/** Ordre envoyé en saisie libre, à renvoyer après un refus. */
const sourceDepuisOrdreVitfix = (ordre: OrdrePrestataire): SourceEnvoi => ({
  reference: ordre.referenceAj || undefined,
  copropriete: ordre.copropriete,
  objet: ordre.titre,
  localisation: ordre.localisation,
  urgence: libelleUrgenceOrdre(ordre.urgence),
})

/** Pastille « Vitfix · statut » d'un ordre transmis à un prestataire Vitfix. */
function PastilleVitfix({ ordre }: { ordre: OrdrePrestataire }) {
  return <Pill kind={TEINTE_STATUT_ORDRE[ordre.statut]}>{`Vitfix · ${LIBELLE_STATUT_ORDRE[ordre.statut]}`}</Pill>
}

/**
 * Ordres de service : interventions sur les parties communes (création, suivi, validation), dans la limite des
 * pouvoirs des articles 18 à 18-2. Données de démonstration, actions simulées. « Planifié » n'apparaît que dans « Tous ».
 * Interventions, saisies libres et compteurs de la copropriété choisie en haut de page (toutes sans choix) ; les
 * formulaires la proposent par défaut.
 * Seul circuit réel : « Envoyer au prestataire » transmet l'intervention à un prestataire Vitfix du cabinet (envoi
 * réel, même en démonstration) ; son suivi (statut, échanges, documents, réponse) s'affiche sous la carte.
 */
export function OrdresServiceModule() {
  const { push } = useToast()
  const [filtre, setFiltre] = useState<FiltreOrdres>('tous')
  const [formulaireOuvert, setFormulaireOuvert] = useState(false)
  const [detail, setDetail] = useState<DetailOrdre | null>(null)
  const vitfix = useOrdresPrestataire()
  const nomsCoproprietes = useNomsCoproprietesSelonMode()
  const { code, nom: nomCopro, codeDeNom } = useCoproChoisie()
  // Fenêtre d'envoi : intervention transmise (null = saisie libre), undefined = fermée.
  const [envoi, setEnvoi] = useState<SourceEnvoi | null | undefined>(undefined)
  // Suivis dépliés, par numéro d'ordre de service (ou identifiant de mission pour une saisie libre).
  const [suivisOuverts, setSuivisOuverts] = useState<Record<string, boolean>>({})
  const ordres = filtrerParCopro(DEMO_ORDRES_DE_SERVICE, code, (ordre) => codeDeNom(ordre.copro))
  const parReference = useMemo(() => dernierOrdreParReference(vitfix.ordres), [vitfix.ordres])
  // Ordres envoyés sans carte à l'écran (saisie libre) : affichés en tête de « Tous ».
  const ordresLibres = useMemo(() => {
    const references = new Set(DEMO_ORDRES_DE_SERVICE.map((ordre) => ordre.id))
    return vitfix.ordres.filter((ordre) => !ordre.referenceAj || !references.has(ordre.referenceAj))
  }, [vitfix.ordres])
  const ordresLibresAffiches = filtrerParCopro(ordresLibres, code, (ordre) => codeDeNom(ordre.copropriete))
  const aucunOrdreDeLaCopro = !!code && ordres.length + ordresLibresAffiches.length === 0
  const basculerSuivi = (cle: string) => setSuivisOuverts((ouverts) => ({ ...ouverts, [cle]: !ouverts[cle] }))

  const envoyerOrdre = async (demande: DemandeEnvoiOrdre) => {
    const resultat = await vitfix.envoyer(demande)
    setSuivisOuverts((ouverts) => ({ ...ouverts, [demande.reference_aj || resultat.mission_id]: true }))
    const prestataire = vitfix.prestataires.find((p) => p.id === demande.syndic_artisan_id)
    push({
      kind: 'success',
      title: 'Ordre transmis',
      desc: `${prestataire?.nom ?? 'Le prestataire'} l’a reçu dans sa messagerie Vitfix${resultat.notification ? ' (notification envoyée)' : ''}.`,
    })
  }

  const suivi = (cle: string, ordre: OrdrePrestataire) =>
    suivisOuverts[cle] ? (
      <SuiviPrestataire
        ordre={ordre}
        chargement={vitfix.chargement}
        misAJourLe={vitfix.misAJourLe}
        onRafraichir={() => void vitfix.rafraichir()}
        onRepondre={(contenu) => vitfix.repondre(ordre.missionId, contenu)}
      />
    ) : null

  const boutonSuivi = (cle: string) => (
    <button className="btn sm" onClick={() => basculerSuivi(cle)} aria-expanded={!!suivisOuverts[cle]}>
      <Icon name="chat" />
      {suivisOuverts[cle] ? 'Masquer le suivi' : 'Suivi prestataire'}
    </button>
  )

  const boutonEnvoi = (source: SourceEnvoi, renvoi: boolean) => (
    <button className="btn sm" onClick={() => setEnvoi(source)}>
      <Icon name="handshake" />
      {renvoi ? 'Renvoyer au prestataire' : 'Envoyer au prestataire'}
    </button>
  )
  const compteurs = {
    tous: ordres.length,
    curso: ordres.filter((ordre) => ordre.statut === 'En cours').length,
    valider: ordres.filter((ordre) => ordre.statut === 'À valider').length,
    clos: ordres.filter((ordre) => ordre.statut === 'Clôturé').length,
  }
  const ordresAffiches = ordres.filter((ordre) =>
    filtre === 'tous'
      ? true
      : filtre === 'curso'
        ? ordre.statut === 'En cours'
        : filtre === 'valider'
          ? ordre.statut === 'À valider'
          : ordre.statut === 'Clôturé',
  )
  const filtres: [cle: FiltreOrdres, libelle: string, nombre: number][] = [
    ['tous', 'Tous', compteurs.tous],
    ['curso', 'En cours', compteurs.curso],
    ['valider', 'À valider', compteurs.valider],
    ['clos', 'Clôturés', compteurs.clos],
  ]

  return (
    <>
      <PageHead
        eyebrow="Gestion courante"
        title="Ordres de service"
        lede="Interventions sur les parties communes — création, suivi et validation, dans la limite des pouvoirs des articles 18 à 18-2."
        actions={
          <>
            <button
              className="btn"
              onClick={() =>
                push({
                  kind: 'info',
                  title: 'Filtres',
                  desc: 'Filtres avancés des interventions',
                })
              }
            >
              <Icon name="search" />
              Filtres
            </button>
            <button className="btn" onClick={() => setEnvoi(null)}>
              <Icon name="handshake" />
              Envoyer au prestataire
            </button>
            <button className="btn gold" onClick={() => setFormulaireOuvert(true)}>
              <Icon name="plus" />
              Nouvel ordre de service
            </button>
          </>
        }
      />
      <Kpis
        items={[
          {
            icon: 'clipboard',
            num: ordres.filter((ordre) => ordre.statut === 'En cours').length,
            lbl: 'En cours',
            sub: nomCopro || '4 copropriétés',
            accent: 'amber',
          },
          {
            icon: 'clock',
            num: ordres.filter((ordre) => ordre.statut === 'À valider').length,
            lbl: 'En attente de validation',
            sub: '> 48 h',
            accent: 'rust',
          },
          {
            icon: 'check',
            num: 18,
            lbl: 'Clôturés (mois)',
            sub: sousTitreFige(code, 'délai moyen 3,1 j'),
            accent: 'sage',
          },
          {
            icon: 'coin',
            num: formatEuros(12840),
            lbl: 'Engagé (mois)',
            sub: sousTitreFige(code, 'hors travaux votés'),
          },
        ]}
      />
      <div
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 18,
          flexWrap: 'wrap',
        }}
      >
        {filtres.map(([cle, libelle, nombre]) => (
          <button className={`chip ${filtre === cle ? 'active' : ''}`} onClick={() => setFiltre(cle)} key={cle}>
            {libelle}{' '}
            <span
              style={{
                opacity: 0.6,
              }}
            >
              {nombre}
            </span>
          </button>
        ))}
      </div>
      {vitfix.erreur != null && (
        <div style={{ marginBottom: 14 }}>
          <Alert kind="warn" icon="alert" title="Suivi des prestataires Vitfix indisponible">
            {messageErreurOrdre(vitfix.erreur)}
          </Alert>
        </div>
      )}
      <Panel flush>
        {aucunOrdreDeLaCopro && <EmptyState icon="clipboard" title={titreListeVide('Aucun ordre de service', nomCopro)} />}
        {filtre === 'tous' &&
          ordresLibresAffiches.map((ordre) => (
            <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--line)' }} key={ordre.missionId}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                <Pill noDot kind={ordre.urgence === 'urgente' ? 'rust' : ordre.urgence === 'haute' ? 'amber' : ''}>
                  {libelleUrgenceOrdre(ordre.urgence)}
                </Pill>
                <PastilleVitfix ordre={ordre} />
                {ordre.referenceAj && (
                  <span className="mono" style={{ fontSize: 11, color: 'var(--navy-300)' }}>
                    {ordre.referenceAj}
                  </span>
                )}
                <span style={{ fontSize: 11.5, color: 'var(--navy-500)', marginLeft: 4 }}>{ordre.localisation}</span>
                <div style={{ flex: 1 }} />
                {(ordre.statut === 'refuse' || ordre.statut === 'termine') && boutonEnvoi(sourceDepuisOrdreVitfix(ordre), true)}
                {boutonSuivi(ordre.missionId)}
              </div>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, fontWeight: 500, marginBottom: 4 }}>
                {ordre.copropriete}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--navy-500)' }}>{ordre.titre}</div>
              <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 11.5, color: 'var(--navy-300)' }}>
                <span>{ordre.prestataire.nom}</span>
                <span>{ordre.dateIntervention ? dateCourte(ordre.dateIntervention) : ''}</span>
              </div>
              {suivi(ordre.missionId, ordre)}
            </div>
          ))}
        {ordresAffiches.map((ordre) => {
          const ordreVitfix = parReference.get(ordre.id)
          return (
            <div
              style={{
                padding: '18px 22px',
                borderBottom: '1px solid var(--line)',
              }}
              key={ordre.id}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  flexWrap: 'wrap',
                  marginBottom: 8,
                }}
              >
                <Pill noDot kind={ordre.urg === 'Urgence' ? 'rust' : ordre.urg === 'Prioritaire' ? 'amber' : ''}>
                  {ordre.urg}
                </Pill>
                <Pill noDot kind={teinteStatut(ordre.statut)}>
                  {ordre.statut}
                </Pill>
                {ordreVitfix && <PastilleVitfix ordre={ordreVitfix} />}
                <span
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: 'var(--navy-300)',
                  }}
                >
                  {ordre.id}
                </span>
                <span
                  style={{
                    fontSize: 11.5,
                    color: 'var(--navy-500)',
                    marginLeft: 4,
                  }}
                >
                  {ordre.frac}
                </span>
                <div
                  style={{
                    flex: 1,
                  }}
                />
                {ordre.statut === 'À valider' && (
                  <button
                    className="btn sm"
                    style={{
                      background: 'var(--sage-500)',
                      color: '#fff',
                      border: 'none',
                    }}
                    onClick={() =>
                      push({
                        kind: 'success',
                        title: 'Simulation',
                        desc: "L'intervention n'a pas été validée dans le dossier (" + ordre.id + ').',
                      })
                    }
                  >
                    Valider
                  </button>
                )}
                {/* Renvoi possible après un refus ou une intervention terminée (une répétition ne bloque pas la carte). */}
                {(!ordreVitfix || ordreVitfix.statut === 'refuse' || ordreVitfix.statut === 'termine') && boutonEnvoi(sourceDepuisOrdreDemo(ordre), !!ordreVitfix)}
                {ordreVitfix && boutonSuivi(ordre.id)}
                <button
                  className="btn sm ghost"
                  onClick={() =>
                    setDetail({
                      title: ordre.objet,
                      icon: 'clipboard',
                      fields: [
                        {
                          k: 'N°',
                          v: ordre.id,
                        },
                        {
                          k: 'Copropriété',
                          v: ordre.copro,
                        },
                        {
                          k: 'Localisation',
                          v: ordre.frac,
                        },
                        {
                          k: 'Prestataire',
                          v: ordre.presta,
                        },
                        {
                          k: 'Urgence',
                          v: ordre.urg,
                        },
                        {
                          k: 'Statut',
                          v: ordre.statut,
                        },
                        {
                          k: 'Date',
                          v: ordre.date,
                        },
                      ],
                    })
                  }
                >
                  Ouvrir
                </button>
              </div>
              <div
                style={{
                  fontFamily: 'Cormorant Garamond, serif',
                  fontSize: 18,
                  fontWeight: 500,
                  marginBottom: 4,
                }}
              >
                {ordre.copro}
              </div>
              <div
                style={{
                  fontSize: 12.5,
                  color: 'var(--navy-500)',
                }}
              >
                {ordre.objet}
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: 12,
                  marginTop: 8,
                  fontSize: 11.5,
                  color: 'var(--navy-300)',
                }}
              >
                <span>{ordre.presta}</span>
                <span>{ordre.date}</span>
              </div>
              {ordreVitfix && suivi(ordre.id, ordreVitfix)}
            </div>
          )
        })}
      </Panel>
      <EnvoiPrestataireModal
        open={envoi !== undefined}
        source={envoi ?? null}
        prestataires={vitfix.prestataires}
        prestatairesCharges={vitfix.charge}
        coproprietes={coproprietesEnvoi(nomsCoproprietes, nomCopro)}
        onClose={() => setEnvoi(undefined)}
        onEnvoyer={envoyerOrdre}
      />
      <FormModal
        open={formulaireOuvert}
        onClose={() => setFormulaireOuvert(false)}
        title="Nouvel ordre de service"
        icon="clipboard"
        fields={champsNouvelOrdre(nomCopro)}
        submitLabel="Créer"
        onDone={() =>
          push({
            kind: 'success',
            title: 'Simulation',
            desc: "Aucune donnée n'a été enregistrée.",
          })
        }
      />
      <DetailModal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.title}
        icon={detail?.icon}
        fields={detail?.fields || []}
      />
    </>
  )
}
