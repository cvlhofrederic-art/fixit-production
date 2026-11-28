'use client'

import { useRef, useState, type ChangeEvent } from 'react'
import {
  DEMO_FACTURES_SAISIE_IA,
  PILL_PAR_STATUT_FACTURE_SAISIE,
  type FactureSaisieDemo,
  type StatutFactureSaisie,
} from '@/components/administrateur-judiciaire/data/saisie-factures'
import {
  STYLE_BOUTON_ATTENTE,
  lireFactureIA,
  lireFichierDataUrl,
  messageErreurOutilIA,
} from '@/components/administrateur-judiciaire/modules/outils-ia/appelOutilIA'
import { DataTable } from '@/components/administrateur-judiciaire/ui/DataTable'
import { DetailModal, type ChampDetail } from '@/components/administrateur-judiciaire/ui/DetailModal'
import { EmptyState } from '@/components/administrateur-judiciaire/ui/EmptyState'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { Tabs } from '@/components/administrateur-judiciaire/ui/Tabs'
import { titreListeVide, useCoproChoisie } from '@/components/administrateur-judiciaire/ui/copro-choisie'
import { useToast, type ValeursFormulaireToast } from '@/components/administrateur-judiciaire/ui/toast'
import { useDonneesLocales } from '@/lib/administrateur-judiciaire/db/hooks'
import { dateIsoVersFr } from '@/lib/administrateur-judiciaire/domain/dates'
import { formatEurosCentimes } from '@/lib/administrateur-judiciaire/domain/format'
import { codeDeNomCopro, filtrerParCopro } from '@/lib/administrateur-judiciaire/domain/selection-copropriete'
import {
  TAILLE_MAX_FICHIER_FACTURE,
  TYPES_FICHIER_FACTURE,
  lireMontant,
  montantsIncoherents,
  typeFichierFacture,
  type FactureExtraite,
} from '@/lib/administrateur-judiciaire/ia/outils'

/** Choix « copropriété non reconnue » du formulaire de vérification. */
const COPROPRIETE_A_PRECISER = 'À préciser'

/**
 * Copropriété des factures de démonstration, par numéro (reprise des documents d'intervention et des contrats de
 * démonstration : plomberie, ascenseur et multirisque au Méridien, électricité au Clos des Vignes).
 */
const CODES_COPRO_FACTURES_DEMO: Readonly<Record<string, string>> = {
  'FAC-2026-051': 'LM',
  'FAC-2026-044': 'LM',
  'FAC-2026-038': 'LM',
  'FAC-2026-029': 'CV',
}

/** Détail d'une facture importée, affiché dans sa fiche (les factures de démonstration n'en ont pas). */
interface DetailFactureImportee {
  fichier: string
  copropriete: string
  siret: string
  date: string
  montantHt: string
  tva: string
  libelle: string
}

/** Montant éditable dans le formulaire : « 1234,56 » (virgule décimale, sans séparateur de milliers). */
const montantSaisi = (montant: number | null): string => (montant === null ? '' : montant.toFixed(2).replace('.', ','))

/** Montant affiché : « 1 234,56 € » (Intl fr-FR), ou « — » si illisible. */
const montantAffiche = (montant: number | null): string => (montant === null ? '—' : formatEurosCentimes(montant))

/**
 * Copropriété d'une facture : celle choisie à l'import (`detail`, retrouvée parmi `copros` de la base), sinon celle
 * de la facture de démonstration ; null pour une facture « À préciser » ou sans copropriété connue.
 */
function codeCoproFacture(
  facture: FactureSaisieDemo,
  detail: DetailFactureImportee | undefined,
  copros: readonly { code: string; nom: string }[],
): string | null {
  if (detail) return codeDeNomCopro(detail.copropriete, copros)
  return CODES_COPRO_FACTURES_DEMO[facture[0]] ?? null
}

/** Date AAAA-MM-JJ lue par l'IA → « JJ/MM/AAAA » ; toute autre forme est reprise telle quelle. */
const dateSaisie = (date: string | null): string => (date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? dateIsoVersFr(date) : (date ?? ''))

/**
 * Saisie de factures (barre latérale : section Outils IA, « Saisie IA factures » ; surtitre « Comptabilité &
 * finances »). « Importer des factures » ouvre le choix d'un fichier (PDF, PNG, JPEG ou WebP, 4 Mo au plus) que
 * l'assistant IA lit (Claude, vision, via /api/administrateur-judiciaire/outils) ; les informations lues
 * pré-remplissent le formulaire d'import, à vérifier, puis la facture rejoint la liste « à valider » (« anomalie » si
 * HT + TVA ≠ TTC). Indicateurs et pastilles suivent la liste. Onglets autonomes (« Importer » par défaut).
 * Affiché selon la copropriété choisie dans le sélecteur du haut de page : factures de cette copropriété et factures
 * encore « À préciser » (visibles partout, pour être rattachées) ; la liste complète reste en mémoire. Le formulaire
 * propose la copropriété choisie quand l'IA n'en reconnaît aucune ; toutes les copropriétés restent envoyées à l'IA.
 */
export function SaisieFacturesModule() {
  const { push } = useToast()
  const { copros } = useDonneesLocales()
  const { code, nom } = useCoproChoisie()
  const [factures, setFactures] = useState<FactureSaisieDemo[]>(DEMO_FACTURES_SAISIE_IA)
  const [factureOuverte, setFactureOuverte] = useState<FactureSaisieDemo | null>(null)
  const [lecture, setLecture] = useState(false)
  const champFichier = useRef<HTMLInputElement>(null)
  const details = useRef(new WeakMap<FactureSaisieDemo, DetailFactureImportee>())

  // Une facture sans copropriété (« À préciser ») reste visible quelle que soit la copropriété choisie.
  const facturesAffichees = filtrerParCopro(
    factures,
    code,
    (facture) => codeCoproFacture(facture, details.current.get(facture), copros) ?? code,
  )

  const compter = (statut: StatutFactureSaisie) =>
    facturesAffichees.filter((facture) => facture[4] === statut).length

  /** Ajoute la facture vérifiée dans le formulaire ; renvoie son statut (message du toast). */
  const ajouterFacture = (valeurs: ValeursFormulaireToast, fichier: string): StatutFactureSaisie => {
    const valeur = (cle: string) => (valeurs[cle] ?? '').trim()
    const ht = lireMontant(valeur('montant_ht'))
    const tva = lireMontant(valeur('tva'))
    const ttc = lireMontant(valeur('montant_ttc')) ?? (ht !== null && tva !== null ? Math.round((ht + tva) * 100) / 100 : null)
    const statut: StatutFactureSaisie = montantsIncoherents({ montant_ht: ht, tva, montant_ttc: ttc }) ? 'anomalie' : 'à valider'
    const ligne: FactureSaisieDemo = [
      valeur('numero') || '—',
      valeur('fournisseur') || '—',
      montantAffiche(ttc),
      valeur('compte_charge_suggere') || '—',
      statut,
    ]
    details.current.set(ligne, {
      fichier,
      copropriete: valeur('copropriete') || COPROPRIETE_A_PRECISER,
      siret: valeur('siret') || '—',
      date: valeur('date') || '—',
      montantHt: montantAffiche(ht),
      tva: montantAffiche(tva),
      libelle: valeur('libelle') || '—',
    })
    setFactures((liste) => [ligne, ...liste])
    return statut
  }

  /**
   * Formulaire d'import pré-rempli avec les informations lues par l'IA ; copropriété : celle reconnue par l'IA, sinon
   * celle choisie dans le sélecteur du haut de page, sinon « À préciser ».
   */
  const verifierFacture = (facture: FactureExtraite, fichier: string) => {
    const noms = copros.map((copro) => copro.nom)
    const coproprieteReconnue =
      [facture.copropriete_probable, nom].find(
        (candidate): candidate is string => typeof candidate === 'string' && noms.includes(candidate),
      ) ?? COPROPRIETE_A_PRECISER
    const alerte = montantsIncoherents(facture) ? ' Attention : HT + TVA ne correspond pas au TTC.' : ''
    push({
      kind: 'form',
      icon: 'folder',
      title: 'Importer des factures',
      lede: `Informations lues par l’IA dans « ${fichier} » : vérifiez-les avant d’ajouter la facture.${alerte}`,
      fields: [
        { name: 'copropriete', label: 'Copropriété', type: 'select', options: [COPROPRIETE_A_PRECISER, ...noms], value: coproprieteReconnue },
        { name: 'fournisseur', label: 'Fournisseur', value: facture.fournisseur },
        { name: 'siret', label: 'SIRET', value: facture.siret },
        { name: 'numero', label: 'N° facture', value: facture.numero },
        { name: 'date', label: 'Date', value: dateSaisie(facture.date) },
        { name: 'montant_ht', label: 'Montant HT (€)', value: montantSaisi(facture.montant_ht) },
        { name: 'tva', label: 'TVA (€)', value: montantSaisi(facture.tva) },
        { name: 'montant_ttc', label: 'Montant TTC (€)', value: montantSaisi(facture.montant_ttc) },
        { name: 'compte_charge_suggere', label: 'Compte de charge suggéré', value: facture.compte_charge_suggere },
        { name: 'libelle', label: 'Libellé', value: facture.libelle },
      ],
      submitLabel: 'Importer',
      onSubmit: (valeurs) => ajouterFacture(valeurs, fichier),
      toast: {
        title: 'Facture importée',
        desc: (statut) =>
          statut === 'anomalie'
            ? 'Montants incohérents : la facture est classée en anomalie.'
            : 'La facture est à valider dans la liste.',
      },
    })
  }

  /** Fichier choisi : contrôles locaux (format, taille), lecture par l'IA, puis formulaire de vérification. */
  const importerFichier = async (fichier: File) => {
    const type = typeFichierFacture(fichier.type, fichier.name)
    if (!type) {
      push({ kind: 'warning', title: 'Format non pris en charge', desc: 'Importez une facture en PDF, PNG, JPEG ou WebP.' })
      return
    }
    if (fichier.size === 0) {
      push({ kind: 'warning', title: 'Fichier vide', desc: `« ${fichier.name} » ne contient aucune donnée.` })
      return
    }
    if (fichier.size > TAILLE_MAX_FICHIER_FACTURE) {
      push({
        kind: 'warning',
        title: 'Fichier trop volumineux',
        desc: `La facture doit faire ${TAILLE_MAX_FICHIER_FACTURE / (1024 * 1024)} Mo au plus.`,
      })
      return
    }
    setLecture(true)
    try {
      const facture = await lireFactureIA({
        tache: 'saisie-facture',
        fichier: await lireFichierDataUrl(fichier, type),
        nomFichier: fichier.name,
        coproprietes: copros
          .filter((copro) => copro.nom.trim())
          .slice(0, 50)
          .map((copro) => ({ nom: copro.nom.slice(0, 200), adresse: copro.adresse?.slice(0, 300) || undefined })),
      })
      verifierFacture(facture, fichier.name)
    } catch (erreur) {
      push({ kind: 'error', title: 'Lecture impossible', desc: messageErreurOutilIA(erreur) })
    } finally {
      setLecture(false)
    }
  }

  const surChoixFichier = (evenement: ChangeEvent<HTMLInputElement>) => {
    const fichier = evenement.target.files?.[0]
    // Réinitialisé : choisir de nouveau le même fichier relance la lecture.
    evenement.target.value = ''
    if (fichier) void importerFichier(fichier)
  }

  const detailOuvert = factureOuverte ? details.current.get(factureOuverte) : undefined
  const champsDetail: ChampDetail[] = factureOuverte
    ? [
        {
          k: 'N° facture',
          v: factureOuverte[0],
        },
        {
          k: 'Montant',
          v: factureOuverte[2],
        },
        {
          k: 'Poste comptable',
          v: factureOuverte[3],
        },
        {
          k: 'Statut',
          v: factureOuverte[4],
        },
        ...(detailOuvert
          ? [
              { k: 'Copropriété', v: detailOuvert.copropriete },
              { k: 'SIRET', v: detailOuvert.siret },
              { k: 'Date', v: detailOuvert.date },
              { k: 'Montant HT', v: detailOuvert.montantHt },
              { k: 'TVA', v: detailOuvert.tva },
              { k: 'Libellé', v: detailOuvert.libelle, full: true },
              { k: 'Fichier lu par l’IA', v: detailOuvert.fichier, full: true },
            ]
          : []),
      ]
    : []

  return (
    <>
      <PageHead
        eyebrow="Comptabilité & finances"
        title="Saisie de factures"
        lede="Import, ventilation comptable et validation des factures fournisseurs."
        actions={
          <>
            <input
              ref={champFichier}
              type="file"
              hidden
              accept={TYPES_FICHIER_FACTURE.join(',')}
              aria-label="Facture fournisseur à importer (PDF, PNG, JPEG ou WebP)"
              onChange={surChoixFichier}
            />
            <button
              className="btn gold"
              onClick={() => champFichier.current?.click()}
              disabled={lecture}
              aria-busy={lecture || undefined}
              style={lecture ? STYLE_BOUTON_ATTENTE : undefined}
            >
              <Icon name="plus" />
              {lecture ? 'Lecture de la facture…' : 'Importer des factures'}
            </button>
          </>
        }
      />
      <Kpis
        items={[
          {
            icon: 'doc',
            num: facturesAffichees.length,
            lbl: 'Total factures',
          },
          {
            icon: 'clock',
            num: compter('à valider'),
            lbl: 'À valider',
            accent: 'amber',
          },
          {
            icon: 'check',
            num: compter('validée'),
            lbl: 'Validées',
            accent: 'sage',
          },
          {
            icon: 'alert',
            num: compter('anomalie'),
            lbl: 'Anomalies',
            accent: 'rust',
          },
        ]}
      />
      <Tabs
        defaultActive="imp"
        tabs={[
          {
            id: 'imp',
            icon: 'plus',
            label: 'Importer',
          },
          {
            id: 'att',
            icon: 'clock',
            label: 'À valider',
            badge: compter('à valider') || undefined,
          },
          {
            id: 'trt',
            icon: 'check',
            label: 'Traitées',
          },
          {
            id: 'ano',
            icon: 'alert',
            label: 'Anomalies',
            badge: compter('anomalie') || undefined,
          },
        ]}
      />
      <Panel title="Factures" icon="doc" flush>
        {facturesAffichees.length === 0 ? (
          <EmptyState icon="doc" title={titreListeVide('Aucune facture', nom)} />
        ) : (
          <DataTable
            columns={[
              {
                h: 'Facture',
                render: (facture) => <span className="mono">{facture[0]}</span>,
              },
              {
                h: 'Fournisseur',
                render: (facture) => <b>{facture[1]}</b>,
              },
              {
                h: 'Montant',
                render: (facture) => <span className="mono">{facture[2]}</span>,
              },
              {
                h: 'Poste',
                render: (facture) => <Pill noDot>{facture[3]}</Pill>,
              },
              {
                h: 'Statut',
                render: (facture) => (
                  <Pill kind={PILL_PAR_STATUT_FACTURE_SAISIE[facture[4]]} noDot>
                    {facture[4]}
                  </Pill>
                ),
              },
            ]}
            rows={facturesAffichees}
            onRow={setFactureOuverte}
          />
        )}
      </Panel>
      <DetailModal
        open={!!factureOuverte}
        onClose={() => setFactureOuverte(null)}
        title={factureOuverte ? factureOuverte[1] : ''}
        icon="doc"
        fields={champsDetail}
      />
    </>
  )
}
