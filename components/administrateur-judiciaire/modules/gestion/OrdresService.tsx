'use client'

import { useState } from 'react'
import { DEMO_NOMS_COPROPRIETES } from '@/components/administrateur-judiciaire/data/coproprietes'
import { DEMO_ORDRES_DE_SERVICE } from '@/components/administrateur-judiciaire/data/ordres-de-service'
import { DEMO_PRESTATAIRES } from '@/components/administrateur-judiciaire/data/prestataires'
import { DetailModal, type ChampDetail } from '@/components/administrateur-judiciaire/ui/DetailModal'
import { FormModal, type ChampFormModal } from '@/components/administrateur-judiciaire/ui/FormModal'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'
import { formatEuros } from '@/lib/administrateur-judiciaire/domain/format'

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

/**
 * Ordres de service : interventions sur les parties communes (création, suivi, validation), dans la limite des
 * pouvoirs des articles 18 à 18-2. Données de démonstration, actions simulées. « Planifié » n'apparaît que dans « Tous ».
 */
export function OrdresServiceModule() {
  const { push } = useToast()
  const [filtre, setFiltre] = useState<FiltreOrdres>('tous')
  const [formulaireOuvert, setFormulaireOuvert] = useState(false)
  const [detail, setDetail] = useState<DetailOrdre | null>(null)
  const ordres = DEMO_ORDRES_DE_SERVICE
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
            sub: '4 copropriétés',
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
            sub: 'délai moyen 3,1 j',
            accent: 'sage',
          },
          {
            icon: 'coin',
            num: formatEuros(12840),
            lbl: 'Engagé (mois)',
            sub: 'hors travaux votés',
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
      <Panel flush>
        {ordresAffiches.map((ordre) => (
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
          </div>
        ))}
      </Panel>
      <FormModal
        open={formulaireOuvert}
        onClose={() => setFormulaireOuvert(false)}
        title="Nouvel ordre de service"
        icon="clipboard"
        fields={CHAMPS_NOUVEL_ORDRE}
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
