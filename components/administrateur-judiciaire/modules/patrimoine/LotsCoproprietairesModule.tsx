'use client'

import { useState } from 'react'
import {
  DEMO_COPROPRIETAIRES,
  type CoproprietaireDemo,
  type LocataireDemo,
} from '@/components/administrateur-judiciaire/data/coproprietaires'
import { DEMO_NOMS_COPROPRIETES, DEMO_TOTAL_LOTS } from '@/components/administrateur-judiciaire/data/coproprietes'
import { DOCUMENT_EXPORT_DONNEES } from '@/components/administrateur-judiciaire/data/elements-communs'
import { FicheCompteCoproprietaire } from '@/components/administrateur-judiciaire/modules/patrimoine/FicheCompteCoproprietaire'
import { DataTable } from '@/components/administrateur-judiciaire/ui/DataTable'
import { FormModal, type ChampFormModal, type ValeursFormModal } from '@/components/administrateur-judiciaire/ui/FormModal'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'
import { formatEurosCentimes } from '@/lib/administrateur-judiciaire/domain/format'

/** Champs du locataire, communs à l'ajout d'un copropriétaire et à la modification de la fiche. */
const CHAMPS_LOCATAIRE: (ChampFormModal & { cle: keyof LocataireDemo })[] = [
  { cle: 'nom', name: 'locNom', label: 'Nom du locataire', hint: 'Vide si le lot n’est pas loué.' },
  { cle: 'prenom', name: 'locPrenom', label: 'Prénom du locataire' },
  { cle: 'tel', name: 'locTel', label: 'Téléphone du locataire', type: 'tel', placeholder: 'ex. 06 12 34 56 78' },
  { cle: 'mail', name: 'locMail', label: 'Courriel du locataire', type: 'email', placeholder: 'nom@email.fr' },
]

/** Fiche modifiée (téléphone, courriel, adresse, locataire, notes, avertissement) ; locataire null si tout est vide. */
function appliquerModification(coproprietaire: CoproprietaireDemo, valeurs: ValeursFormModal): CoproprietaireDemo {
  const lire = (cle: string) => (valeurs[cle] ?? '').trim()
  const locataire = {
    nom: lire('locNom'),
    prenom: lire('locPrenom'),
    tel: lire('locTel'),
    mail: lire('locMail'),
  }
  return {
    ...coproprietaire,
    tel: lire('tel'),
    mail: lire('mail'),
    locataire: Object.values(locataire).some((valeur) => valeur !== '') ? locataire : null,
    fiche: {
      ...coproprietaire.fiche,
      adresse: lire('adresse'),
      codePostal: lire('codePostal'),
      ville: lire('ville'),
      notes: lire('notes'),
      avertissement: lire('avertissement') || null,
    },
  }
}

/** Formulaire de modification, prérempli avec la fiche. */
function champsModification(coproprietaire: CoproprietaireDemo): ChampFormModal[] {
  const { fiche, locataire } = coproprietaire
  return [
    { name: 'tel', label: 'Téléphone', type: 'tel', value: coproprietaire.tel },
    { name: 'mail', label: 'Courriel', type: 'email', value: coproprietaire.mail },
    { name: 'adresse', label: 'Adresse', value: fiche.adresse, full: true },
    { name: 'codePostal', label: 'Code postal', value: fiche.codePostal },
    { name: 'ville', label: 'Ville', value: fiche.ville },
    ...CHAMPS_LOCATAIRE.map(({ cle, ...champ }) => ({ ...champ, value: locataire?.[cle] ?? '' })),
    { name: 'notes', label: 'Notes', type: 'textarea', value: fiche.notes, full: true },
    { name: 'avertissement', label: 'Avertissement (affiché à l’ouverture)', value: fiche.avertissement ?? '', full: true },
  ]
}

/**
 * Lots & copropriétaires. Registre de démonstration (échantillon statique, et non la base locale contrairement à
 * l'écran Copropriétés) ; l'indicateur « 10 000 » tantièmes est en dur. Solde en rouge s'il est négatif, en vert
 * sinon. Un clic sur une ligne ouvre la fiche du compte (modèle Gestéam, avec le locataire du lot) ; « Modifier la
 * fiche » change la démonstration le temps de la session, sans rien enregistrer. « Exporter » ouvre un récapitulatif
 * simulé ; « Ajouter un copropriétaire » ouvre une FormModal sans validation suivie d'un toast « Simulation ».
 */
export function LotsCoproprietairesModule() {
  const { push } = useToast()
  const [ajoutOuvert, setAjoutOuvert] = useState(false)
  const [modifies, setModifies] = useState<Record<string, CoproprietaireDemo>>({})
  const [ficheId, setFicheId] = useState<string | null>(null)
  const [editionId, setEditionId] = useState<string | null>(null)
  const coproprietaires = DEMO_COPROPRIETAIRES.map((coproprietaire) => modifies[coproprietaire.id] ?? coproprietaire)
  const fiche = coproprietaires.find((coproprietaire) => coproprietaire.id === ficheId) ?? null
  const edition = coproprietaires.find((coproprietaire) => coproprietaire.id === editionId) ?? null

  return (
    <>
      <PageHead
        eyebrow="Patrimoine"
        title="Lots & copropriétaires"
        lede="Registre des copropriétaires, lots et tantièmes — base de la convocation des assemblées et de la répartition des charges."
        actions={
          <>
            <button className="btn" onClick={() => push(DOCUMENT_EXPORT_DONNEES)}>
              <Icon name="download" />
              Exporter
            </button>
            <button className="btn gold" onClick={() => setAjoutOuvert(true)}>
              <Icon name="plus" />
              Ajouter un copropriétaire
            </button>
          </>
        }
      />
      <Kpis
        items={[
          {
            icon: 'users',
            num: DEMO_COPROPRIETAIRES.length,
            lbl: 'Copropriétaires (échantillon)',
            sub: `${DEMO_TOTAL_LOTS} lots au total`,
          },
          {
            icon: 'check',
            num: DEMO_COPROPRIETAIRES.filter((coproprietaire) => coproprietaire.statut === 'À jour').length,
            lbl: 'À jour',
            sub: 'charges réglées',
            accent: 'sage',
          },
          {
            icon: 'alert',
            num: DEMO_COPROPRIETAIRES.filter((coproprietaire) => coproprietaire.solde < 0).length,
            lbl: 'En retard / impayé',
            sub: 'à relancer',
            accent: 'rust',
          },
          {
            icon: 'doc',
            num: '10 000',
            lbl: 'Tantièmes (total)',
            sub: 'clé de répartition générale',
          },
        ]}
      />
      <Panel
        title="Registre des copropriétaires"
        sub="Lots, tantièmes et situation de compte"
        icon="users"
        flush
      >
        <DataTable
          rowKey="id"
          columns={[
            {
              h: 'Copropriétaire',
              render: (coproprietaire) => (
                <b
                  style={{
                    fontWeight: 600,
                  }}
                >
                  {coproprietaire.nom}
                </b>
              ),
            },
            {
              h: 'Copropriété',
              render: (coproprietaire) => coproprietaire.copro,
            },
            {
              h: 'Lot',
              render: (coproprietaire) => coproprietaire.lot,
            },
            {
              h: 'Tantièmes',
              render: (coproprietaire) => (
                <span
                  className="mono"
                  style={{
                    fontSize: 12,
                  }}
                >
                  {coproprietaire.tantiemes}
                </span>
              ),
            },
            {
              h: 'Solde',
              render: (coproprietaire) => (
                <span
                  style={{
                    color: coproprietaire.solde < 0 ? 'var(--rust-700)' : 'var(--sage-700)',
                    fontWeight: 600,
                  }}
                >
                  {formatEurosCentimes(coproprietaire.solde)}
                </span>
              ),
            },
            {
              h: 'Statut',
              render: (coproprietaire) => <Pill kind={coproprietaire.pill}>{coproprietaire.statut}</Pill>,
            },
          ]}
          rows={coproprietaires}
          onRow={(coproprietaire) => setFicheId(coproprietaire.id)}
        />
      </Panel>
      <FormModal
        open={ajoutOuvert}
        onClose={() => setAjoutOuvert(false)}
        title="Ajouter un copropriétaire"
        icon="users"
        fields={[
          {
            label: 'Civilité',
            type: 'select',
            options: ['Monsieur', 'Madame', 'Indivision', 'S.C.I.', 'Société'],
          },
          {
            label: 'Nom / Raison sociale',
            required: true,
          },
          {
            label: 'Prénom',
          },
          {
            label: 'Copropriété',
            type: 'select',
            options: DEMO_NOMS_COPROPRIETES,
          },
          {
            label: 'Lot',
            placeholder: 'ex. Lot 12 — Apt B3',
          },
          {
            label: 'Tantièmes',
            placeholder: 'ex. 350/10000',
          },
          {
            label: 'Téléphone',
            type: 'tel',
            placeholder: 'ex. 06 12 34 56 78',
          },
          {
            label: 'Courriel',
            type: 'email',
            placeholder: 'nom@email.fr',
          },
          ...CHAMPS_LOCATAIRE.map(({ cle: _cle, ...champ }) => champ),
        ]}
        submitLabel="Ajouter"
        onDone={() =>
          push({
            kind: 'success',
            title: 'Simulation',
            desc: "Le copropriétaire n'a pas été enregistré.",
          })
        }
      />
      <FicheCompteCoproprietaire
        coproprietaire={fiche}
        onClose={() => setFicheId(null)}
        onModifier={(coproprietaire) => {
          setFicheId(null)
          setEditionId(coproprietaire.id)
        }}
      />
      <FormModal
        open={!!edition}
        onClose={() => {
          setFicheId(editionId)
          setEditionId(null)
        }}
        title={edition ? `Modifier la fiche — ${edition.nom}` : undefined}
        icon="pencil"
        fields={edition ? champsModification(edition) : []}
        submitLabel="Enregistrer"
        onDone={(valeurs) => {
          if (!edition) return
          setModifies((precedents) => ({ ...precedents, [edition.id]: appliquerModification(edition, valeurs) }))
          push({
            kind: 'success',
            title: 'Fiche mise à jour',
            desc: 'Démonstration : la modification disparaît au rechargement de la page.',
          })
        }}
      />
    </>
  )
}
