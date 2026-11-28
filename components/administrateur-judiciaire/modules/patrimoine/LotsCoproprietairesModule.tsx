'use client'

import { useState } from 'react'
import {
  DEMO_COPROPRIETAIRES,
  ficheLotDemo,
  type CoproprietaireDemo,
  type LocataireDemo,
} from '@/components/administrateur-judiciaire/data/coproprietaires'
import { DEMO_NOMS_COPROPRIETES, DEMO_TOTAL_LOTS } from '@/components/administrateur-judiciaire/data/coproprietes'
import { DOCUMENT_EXPORT_DONNEES } from '@/components/administrateur-judiciaire/data/elements-communs'
import {
  FicheCompteCoproprietaire,
  LienFiche,
} from '@/components/administrateur-judiciaire/modules/patrimoine/FicheCompteCoproprietaire'
import { FicheLotDetail } from '@/components/administrateur-judiciaire/modules/patrimoine/FicheLotDetail'
import { DataTable } from '@/components/administrateur-judiciaire/ui/DataTable'
import { EmptyState } from '@/components/administrateur-judiciaire/ui/EmptyState'
import { FormModal, type ChampFormModal, type ValeursFormModal } from '@/components/administrateur-judiciaire/ui/FormModal'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'
import { formatEurosCentimes } from '@/lib/administrateur-judiciaire/domain/format'
import { champCoproprieteChoisie, titreListeVide, useCoproChoisie } from '@/components/administrateur-judiciaire/ui/copro-choisie'
import { codeDeNomCopro, filtrerParCopro } from '@/lib/administrateur-judiciaire/domain/selection-copropriete'
import { useCoproCourante } from '@/lib/administrateur-judiciaire/selection'

/** Champs du locataire, communs à l'ajout d'un copropriétaire et à la modification de la fiche. */
const CHAMPS_LOCATAIRE: (ChampFormModal & { cle: keyof LocataireDemo })[] = [
  { cle: 'nom', name: 'locNom', label: 'Nom du locataire', hint: 'Vide si le lot n’est pas loué.' },
  { cle: 'prenom', name: 'locPrenom', label: 'Prénom du locataire' },
  { cle: 'tel', name: 'locTel', label: 'Téléphone du locataire', type: 'tel', placeholder: 'ex. 06 12 34 56 78' },
  { cle: 'mail', name: 'locMail', label: 'Courriel du locataire', type: 'email', placeholder: 'nom@email.fr' },
]

/** Champs modifiables de la fiche lot (situation, caractéristiques, assurance PNO). */
const CHAMPS_LOT = [
  { name: 'batiment', label: 'Bâtiment' },
  { name: 'escalier', label: 'Escalier' },
  { name: 'etage', label: 'Étage' },
  { name: 'porte', label: 'Porte' },
  { name: 'interphone', label: 'Interphone' },
  { name: 'boiteAuxLettres', label: 'Boîte aux lettres' },
  { name: 'surfaceM2', label: 'Surface (m²)', type: 'number' },
  { name: 'carrezM2', label: 'Loi Carrez (m²)', type: 'number' },
  { name: 'dpe', label: 'DPE (classe)' },
  { name: 'echeancePno', label: 'Échéance assurance PNO', type: 'date' },
] as const

/** Lot modifié (situation, caractéristiques, PNO) : la modification est rangée dans le détail du lot. */
function appliquerModificationLot(coproprietaire: CoproprietaireDemo, index: number, valeurs: ValeursFormModal): CoproprietaireDemo {
  const lire = (cle: string) => (valeurs[cle] ?? '').trim()
  const surface = (cle: string) => {
    const valeur = Number.parseFloat(lire(cle).replace(',', '.'))
    return Number.isFinite(valeur) && valeur > 0 ? valeur : null
  }
  const detail = {
    batiment: lire('batiment'),
    escalier: lire('escalier'),
    etage: lire('etage'),
    porte: lire('porte'),
    interphone: lire('interphone'),
    boiteAuxLettres: lire('boiteAuxLettres'),
    surfaceM2: surface('surfaceM2'),
    carrezM2: surface('carrezM2'),
    dpe: lire('dpe').toUpperCase(),
    echeancePno: /^\d{4}-\d{2}-\d{2}$/.test(lire('echeancePno')) ? lire('echeancePno') : null,
  }
  const lots = coproprietaire.fiche.lots.map((lot, rang) => (rang === index ? { ...lot, detail: { ...lot.detail, ...detail } } : lot))
  return { ...coproprietaire, fiche: { ...coproprietaire.fiche, lots } }
}

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
 * l'écran Copropriétés), affiché selon la copropriété choisie dans le sélecteur du haut de page : registre filtré,
 * indicateurs calculés sur lui (lots de la copropriété), copropriété du formulaire d'ajout préremplie. Sans copropriété
 * choisie (écran rendu seul) : tout l'échantillon. L'indicateur « 10 000 » tantièmes est en dur. Solde en rouge s'il
 * est négatif, en vert sinon. Un clic sur une ligne ouvre la fiche du compte (modèle Gestéam, avec le locataire du
 * lot) ; « Modifier la fiche » change la démonstration le temps de la session, sans rien enregistrer. « Exporter »
 * ouvre un récapitulatif simulé ; « Ajouter un copropriétaire » ouvre une FormModal sans validation suivie d'un toast
 * « Simulation ».
 */
export function LotsCoproprietairesModule() {
  const { push } = useToast()
  const [ajoutOuvert, setAjoutOuvert] = useState(false)
  const [modifies, setModifies] = useState<Record<string, CoproprietaireDemo>>({})
  const [ficheId, setFicheId] = useState<string | null>(null)
  const [editionId, setEditionId] = useState<string | null>(null)
  const [lotOuvert, setLotOuvert] = useState<{ id: string; index: number } | null>(null)
  const [lotEdite, setLotEdite] = useState<{ id: string; index: number } | null>(null)
  const { code, nom: nomCopro } = useCoproChoisie()
  const copro = useCoproCourante()
  const coproprietaires = DEMO_COPROPRIETAIRES.map((coproprietaire) => modifies[coproprietaire.id] ?? coproprietaire)
  const registre = filtrerParCopro(coproprietaires, code, (coproprietaire) => codeDeNomCopro(coproprietaire.copro))
  const trouver = (id: string | undefined) => coproprietaires.find((coproprietaire) => coproprietaire.id === id) ?? null
  const fiche = trouver(ficheId ?? undefined)
  const edition = trouver(editionId ?? undefined)
  const compteDuLot = trouver(lotOuvert?.id)
  const compteDuLotEdite = trouver(lotEdite?.id)
  const ouvrirLot = (coproprietaire: CoproprietaireDemo, index: number) => {
    setFicheId(null)
    setLotOuvert({ id: coproprietaire.id, index })
  }

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
            num: registre.length,
            lbl: 'Copropriétaires (échantillon)',
            sub: `${code ? copro.lots : DEMO_TOTAL_LOTS} lots au total`,
          },
          {
            icon: 'check',
            num: registre.filter((coproprietaire) => coproprietaire.statut === 'À jour').length,
            lbl: 'À jour',
            sub: 'charges réglées',
            accent: 'sage',
          },
          {
            icon: 'alert',
            num: registre.filter((coproprietaire) => coproprietaire.solde < 0).length,
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
        {registre.length === 0 ? (
          <EmptyState icon="users" title={titreListeVide('Aucun copropriétaire', nomCopro)} />
        ) : (
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
                render: (coproprietaire) => (
                  <LienFiche libelle={coproprietaire.lot} onClick={() => ouvrirLot(coproprietaire, 0)} />
                ),
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
            rows={registre}
            onRow={(coproprietaire) => setFicheId(coproprietaire.id)}
          />
        )}
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
          champCoproprieteChoisie(nomCopro, {
              label: 'Copropriété',
              type: 'select',
              options: DEMO_NOMS_COPROPRIETES,
          }),
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
        onOuvrirLot={ouvrirLot}
      />
      <FicheLotDetail
        lot={compteDuLot && lotOuvert ? { coproprietaire: compteDuLot, index: lotOuvert.index } : null}
        onClose={() => setLotOuvert(null)}
        onFicheCoproprietaire={(coproprietaire) => {
          setLotOuvert(null)
          setFicheId(coproprietaire.id)
        }}
        onModifier={(coproprietaire, index) => {
          setLotOuvert(null)
          setLotEdite({ id: coproprietaire.id, index })
        }}
      />
      <FormModal
        open={!!compteDuLotEdite && !!lotEdite}
        onClose={() => {
          setLotOuvert(lotEdite)
          setLotEdite(null)
        }}
        title={
          compteDuLotEdite && lotEdite
            ? `Modifier la fiche — ${compteDuLotEdite.fiche.lots[lotEdite.index].lot}`
            : undefined
        }
        icon="pencil"
        fields={
          compteDuLotEdite && lotEdite
            ? CHAMPS_LOT.map((champ) => {
                const valeur = ficheLotDemo(compteDuLotEdite, lotEdite.index)[champ.name]
                return { ...champ, value: valeur === null ? '' : String(valeur) }
              })
            : []
        }
        submitLabel="Enregistrer"
        onDone={(valeurs) => {
          if (!compteDuLotEdite || !lotEdite) return
          setModifies((precedents) => ({
            ...precedents,
            [compteDuLotEdite.id]: appliquerModificationLot(compteDuLotEdite, lotEdite.index, valeurs),
          }))
          push({
            kind: 'success',
            title: 'Fiche du lot mise à jour',
            desc: 'Démonstration : la modification disparaît au rechargement de la page.',
          })
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
