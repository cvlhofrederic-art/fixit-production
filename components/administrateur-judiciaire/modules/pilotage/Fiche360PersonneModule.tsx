'use client'

import { useState } from 'react'
import { titreListeVide, useCoproChoisie } from '@/components/administrateur-judiciaire/ui/copro-choisie'
import { naviguerVers } from '@/components/administrateur-judiciaire/shell/navigation'
import { Alert } from '@/components/administrateur-judiciaire/ui/Alert'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { LigneCleValeurPersonne } from '@/components/administrateur-judiciaire/ui/LigneCleValeur'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'
import { useDonneesLocales, type DonneesLocales } from '@/lib/administrateur-judiciaire/db/hooks'
import type { Coproprietaire, Lot } from '@/lib/administrateur-judiciaire/db/schema'
import {
  useFiche360Personne,
  type PersonneListee,
  type ResultatFiche360Personne,
} from '@/lib/administrateur-judiciaire/db/use-fiches-360'
import {
  dateFrVersIso,
  dateIsoVersFr,
  decomposerDateIso,
  estDateIsoValide,
} from '@/lib/administrateur-judiciaire/domain/dates'
import { appliquerDelai } from '@/lib/administrateur-judiciaire/domain/delais-legaux'
import { MESSAGES_ETAT_ECHEANCES } from '@/lib/administrateur-judiciaire/domain/echeances-mandat'
import { formatEuros } from '@/lib/administrateur-judiciaire/domain/format'
import { personneDeLaCopro } from '@/lib/administrateur-judiciaire/domain/selection-copropriete'
import { useSelectionDossier } from '@/lib/administrateur-judiciaire/selection'

/** Contenu du fichier JSON exporté au titre du droit d'accès (RGPD art. 15). */
export interface ExportDonneesPersonnelles {
  /** Horodatage ISO réel de l'export (pas la date de démonstration). */
  exporteLe: string
  personne: Coproprietaire
  lot: Lot | null
  copropriete: {
    nom: string
    adresse: string
  } | null
  tantiemes: string
  modeNotification: string
}

/**
 * Date limite d'opposition sur mutation (avis du notaire + quinze jours, L. 1965 art. 20), ISO, ou null.
 * Correctif d'un défaut hérité de la maquette : une date limite hors du calendrier affichable est traitée comme une
 * saisie invalide (message d'invite) au lieu d'être formatée. Deux cas : l'an 10000 (avis du 17/12/9999 ou après),
 * dont le formatage levait pendant le rendu et remplaçait toute l'application par l'écran d'erreur ; les années 0000 à
 * 0099, que Date.UTC ramène au XXe siècle (avis du 15/03/0026 → « 30/03/1926 »). Toute autre saisie est inchangée.
 */
function dateLimiteOppositionMutation(dateAvisIso: string | null): string | null {
  if (!dateAvisIso) return null
  const dateLimite = appliquerDelai(dateAvisIso, {
    valeur: 15,
    unite: 'jours',
  })
  return estDateIsoValide(dateLimite) && decomposerDateIso(dateLimite).a - decomposerDateIso(dateAvisIso).a <= 1
    ? dateLimite
    : null
}

/** Lots et copropriétaires lus pour rattacher une personne à la copropriété choisie. */
type DonneesPersonnes = Pick<DonneesLocales, 'lots' | 'coproprietaires'>

/**
 * Copropriétaire à afficher pour la copropriété `coproprieteId` : celui de la sélection s'il y a un lot, sinon le
 * premier de la copropriété par nom (ordre du sélecteur) ; null si la copropriété est inconnue ou sans copropriétaire.
 */
function idPersonneDeLaCopro(
  coproprietaireId: string | null,
  coproprieteId: string | undefined,
  donnees: DonneesPersonnes,
): string | null {
  if (!coproprieteId) return null
  if (coproprietaireId && personneDeLaCopro(coproprietaireId, coproprieteId, donnees)) return coproprietaireId
  const premiere = donnees.coproprietaires
    .filter((personne) => personneDeLaCopro(personne.id, coproprieteId, donnees))
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))[0]
  return premiere?.id ?? null
}

/** Entrées du sélecteur de personnes rattachées à la copropriété ; aucune si elle est inconnue. */
const personnesDeLaCopro = (
  personnes: readonly PersonneListee[],
  coproprieteId: string | undefined,
  donnees: DonneesPersonnes,
): PersonneListee[] =>
  personnes.filter((entree) => !!coproprieteId && personneDeLaCopro(entree.personne.id, coproprieteId, donnees))

/** Fiche 360 d'une personne vue depuis la copropriété choisie en haut de page. */
interface Fiche360PersonneDeLaCopro extends ResultatFiche360Personne {
  /** Nom de la copropriété choisie (null sans choix). */
  nomCopro: string | null
  /** Vrai quand la copropriété choisie n'a aucun copropriétaire (base chargée). */
  aucunePersonne: boolean
}

/**
 * Fiche et liste des personnes limitées à la copropriété choisie en haut de page ; sans copropriété choisie (écran
 * rendu seul), useFiche360Personne tel quel (toutes les personnes, repli sur le premier copropriétaire de la base).
 */
function useFiche360PersonneDeLaCopro(coproprietaireId: string | null): Fiche360PersonneDeLaCopro {
  const { code, nom: nomCopro } = useCoproChoisie()
  const donnees = useDonneesLocales()
  const coproprieteId = code ? donnees.copros.find((copro) => copro.code === code)?.id : undefined
  const idDeLaCopro = idPersonneDeLaCopro(coproprietaireId, coproprieteId, donnees)
  const resultat = useFiche360Personne(code ? idDeLaCopro : coproprietaireId)
  const personnes = code ? personnesDeLaCopro(resultat.personnes, coproprieteId, donnees) : resultat.personnes
  return { ...resultat, personnes, nomCopro, aucunePersonne: !!code && !resultat.loading && !idDeLaCopro }
}

/**
 * Fiche 360 d'un copropriétaire (données réelles de la base locale) : solde, tantièmes et quote-part, contact,
 * mode de notification, délai d'opposition sur mutation (L. 1965 art. 20), parcours de recouvrement, homonymes
 * et autres copropriétaires de la même copropriété. Export RGPD en JSON. Seuls les copropriétaires de la copropriété
 * choisie en haut de page sont proposés ; la fiche passe au premier d'entre eux quand la personne choisie n'y a pas de lot.
 */
export function Fiche360PersonneModule() {
  const { push } = useToast()
  const { coproprietaireId, choisirPersonne, choisirCopro } = useSelectionDossier()
  const { loading, erreur, fiche, personnes, nomCopro, aucunePersonne } = useFiche360PersonneDeLaCopro(coproprietaireId)
  const [dateAvisMutation, setDateAvisMutation] = useState('')
  const dateAvisIso = dateFrVersIso(dateAvisMutation)
  const dateLimiteOpposition = dateLimiteOppositionMutation(dateAvisIso)
  const exporterDonnees = () => {
    if (!fiche) return
    const donnees: ExportDonneesPersonnelles = {
      exporteLe: new Date().toISOString(),
      personne: fiche.personne,
      lot: fiche.lot,
      copropriete: fiche.copro
        ? {
            nom: fiche.copro.nom,
            adresse: fiche.copro.adresse,
          }
        : null,
      tantiemes: fiche.tantiemes,
      modeNotification: fiche.modeNotification,
    }
    try {
      const fichier = new Blob([JSON.stringify(donnees, null, 2)], {
          type: 'application/json',
        }),
        lien = document.createElement('a')
      lien.href = URL.createObjectURL(fichier)
      lien.download = `donnees_${fiche.personne.nom.replace(/\s+/g, '_')}.json`
      lien.click()
      URL.revokeObjectURL(lien.href)
      push({
        kind: 'success',
        title: 'Export des données personnelles',
        desc: "Fichier JSON généré (droit d'accès, RGPD art. 15).",
      })
    } catch {
      push({
        kind: 'warn',
        title: 'Export impossible',
        desc: 'Le navigateur a refusé le téléchargement.',
      })
    }
  }
  const selecteurPersonne = (
    <select
      aria-label="Personne"
      value={fiche ? fiche.personne.id : ''}
      onChange={(evenement) => choisirPersonne(evenement.target.value)}
      style={{
        maxWidth: 360,
      }}
    >
      {personnes.map((entree) => (
        <option value={entree.personne.id} key={entree.personne.id}>
          {entree.personne.nom}
          {' · '}
          {entree.copro}
        </option>
      ))}
    </select>
  )
  if (loading) return <PageHead eyebrow="Fiche 360 · personne" title="Personne" lede={MESSAGES_ETAT_ECHEANCES.chargement} />
  if (aucunePersonne)
    return <PageHead eyebrow="Fiche 360 · personne" title="Personne" lede={`${titreListeVide('Aucun copropriétaire', nomCopro)}.`} />
  if (!fiche)
    return (
      <PageHead
        eyebrow="Fiche 360 · personne"
        title="Personne"
        lede={erreur ? MESSAGES_ETAT_ECHEANCES.indisponible : 'Aucun copropriétaire enregistré dans la base.'}
        actions={selecteurPersonne}
      />
    )
  const {
    personne,
    lot,
    copro,
    tantiemes,
    quotePart,
    debiteur,
    parcours,
    homonymes,
    modeNotification,
    autresLotsMemeCopro,
  } = fiche
  const ouvrirFicheCopropriete = () => {
    if (copro) {
      choisirCopro(copro.code)
      naviguerVers('fiche360')
    }
  }
  return (
    <>
      <PageHead
        eyebrow="Fiche 360 · personne"
        title={personne.nom}
        lede={`${copro ? copro.nom : 'copropriété inconnue'} · ${lot ? lot.numero : 'lot inconnu'} · ${tantiemes} tantièmes`}
        actions={
          <>
            {selecteurPersonne}
            <button className="btn" onClick={ouvrirFicheCopropriete} disabled={!copro}>
              <Icon name="building" />
              Fiche copropriété
            </button>
            <button className="btn" onClick={exporterDonnees}>
              <Icon name="download" />
              Export RGPD
            </button>
          </>
        }
      />
      <Kpis
        items={[
          {
            icon: 'coin',
            num: formatEuros(personne.solde),
            lbl: 'Solde',
            sub: personne.statut,
            accent: debiteur ? 'rust' : 'sage',
          },
          {
            icon: 'home',
            num: tantiemes,
            lbl: 'Tantièmes',
            sub: quotePart != null ? `${(quotePart * 100).toFixed(2)} % des charges générales` : 'quote-part inconnue',
          },
          {
            icon: 'mail',
            num: personne.mail ? 'Oui' : 'Non',
            lbl: 'Adresse électronique connue',
            sub: personne.mail ? 'notification électronique possible' : 'LRAR nécessaire',
            accent: personne.mail ? 'sage' : 'amber',
          },
          {
            icon: 'users',
            num: homonymes.length,
            lbl: 'Homonymes dans le portefeuille',
            sub: homonymes.length ? 'rapprochement par le nom' : 'aucun',
            accent: homonymes.length ? 'amber' : undefined,
          },
        ]}
      />
      {debiteur && (
        <Alert kind="warn" icon="alert" title={`Débiteur de ${formatEuros(-personne.solde)}`}>
          {
            "Parcours de recouvrement ci-dessous, dans l'ordre. L'acte « Mise en demeure (impayés) » se génère depuis le Tableau de bord (Génération express d'actes)."
          }
        </Alert>
      )}
      <div className="card-grid cols-2">
        <Panel title="Identité et contact" icon="users">
          <LigneCleValeurPersonne k="Nom" v={personne.nom} />
          <LigneCleValeurPersonne k="Copropriété" v={copro ? copro.nom : '·'} />
          <LigneCleValeurPersonne k="Lot" v={lot ? lot.numero : '·'} />
          <LigneCleValeurPersonne k="Tantièmes" v={tantiemes} />
          <LigneCleValeurPersonne k="Téléphone" v={personne.tel || '·'} />
          <LigneCleValeurPersonne k="Courriel" v={personne.mail || '·'} />
          <LigneCleValeurPersonne
            k="Statut"
            v={
              <Pill kind={debiteur ? 'rust' : 'sage'} noDot>
                {personne.statut}
              </Pill>
            }
          />
          <p
            style={{
              fontSize: 11.5,
              color: 'var(--navy-300)',
              margin: '10px 0 0',
            }}
          >
            {
              'Situation particulière (indivision, usufruit, succession, tutelle, procédure collective), présences et pouvoirs en AG : non enregistrés dans la base à ce jour.'
            }
          </p>
        </Panel>
        <Panel
          title="Notification et mutation"
          sub="Mode de notification des actes · opposition sur le prix en cas de vente"
          icon="mail"
        >
          <p
            style={{
              fontSize: 13,
              margin: 0,
            }}
          >
            {modeNotification}
          </p>
          <div
            style={{
              marginTop: 12,
              paddingTop: 10,
              borderTop: '1px solid var(--line)',
            }}
          >
            <label
              style={{
                fontSize: 12,
                display: 'grid',
                gap: 4,
              }}
            >
              {'Avis de mutation reçu du notaire le (JJ/MM/AAAA)'}
              <input
                type="text"
                value={dateAvisMutation}
                onChange={(evenement) => setDateAvisMutation(evenement.target.value)}
                placeholder="JJ/MM/AAAA"
                aria-label="Date de l'avis de mutation"
                style={{
                  maxWidth: 160,
                }}
              />
            </label>
            <p
              style={{
                fontSize: 12,
                margin: '6px 0 0',
                color: dateLimiteOpposition ? 'var(--rust-500)' : 'var(--navy-300)',
              }}
            >
              {dateLimiteOpposition
                ? `Opposition à former au plus tard le ${dateIsoVersFr(dateLimiteOpposition)} (L. 1965 art. 20 : quinze jours de l'avis).`
                : "Saisir la date pour calculer le délai d'opposition (L. 1965 art. 20)."}
            </p>
          </div>
        </Panel>
      </div>
      {debiteur && (
        <Panel title="Parcours de recouvrement" sub="Dans l'ordre, avec le texte applicable" icon="scale" flush>
          {parcours.map((etape, index) => (
            <div
              style={{
                display: 'flex',
                gap: 14,
                padding: '12px 22px',
                borderBottom: '1px solid var(--line)',
                alignItems: 'flex-start',
              }}
              key={index}
            >
              <span
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 7,
                  background: 'var(--cream)',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {index + 1}
              </span>
              <div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  {etape.etape}{' '}
                  <span
                    style={{
                      fontWeight: 500,
                      color: 'var(--navy-500)',
                    }}
                  >
                    {'· '}
                    {etape.base}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--navy-300)',
                    marginTop: 2,
                  }}
                >
                  {etape.note}
                </div>
              </div>
            </div>
          ))}
        </Panel>
      )}
      <div className="card-grid cols-2">
        <Panel
          title={`Homonymes dans d'autres copropriétés (${homonymes.length})`}
          sub="Rapprochement par le nom seulement : l'identité stable attend la décision D2"
          icon="users"
          flush
        >
          {homonymes.length === 0 ? (
            <div
              style={{
                padding: '18px 22px',
                color: 'var(--navy-300)',
                fontSize: 13,
              }}
            >
              Aucun.
            </div>
          ) : (
            homonymes.map((homonyme) => (
              <button
                className="cmdk-item"
                // Maquette : borderBottom puis border « none », qui l'annule (ordre des clés conservé).
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '11px 22px',
                  borderBottom: '1px solid var(--line)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                }}
                onClick={() => choisirPersonne(homonyme.personne.id)}
                key={homonyme.personne.id}
              >
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  {homonyme.personne.nom}
                  {' · '}
                  {homonyme.copro ? homonyme.copro.nom : '·'}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--navy-300)',
                  }}
                >
                  {homonyme.lot}
                  {' · solde '}
                  {formatEuros(homonyme.personne.solde)}
                </div>
              </button>
            ))
          )}
        </Panel>
        <Panel
          title={`Autres copropriétaires de la même copropriété (${autresLotsMemeCopro.length})`}
          icon="building"
          flush
        >
          {autresLotsMemeCopro.length === 0 ? (
            <div
              style={{
                padding: '18px 22px',
                color: 'var(--navy-300)',
                fontSize: 13,
              }}
            >
              Aucun autre copropriétaire enregistré.
            </div>
          ) : (
            autresLotsMemeCopro.map((autre) => (
              <button
                // Même bizarrerie : border « none » annule le borderBottom qui le précède.
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '11px 22px',
                  borderBottom: '1px solid var(--line)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 13,
                }}
                onClick={() => choisirPersonne(autre.personne.id)}
                key={autre.personne.id}
              >
                <b>{autre.personne.nom}</b>
                {' · '}
                {autre.lot}
                {' · '}
                <span
                  style={{
                    color: autre.personne.solde < 0 ? 'var(--rust-500)' : 'var(--navy-500)',
                  }}
                >
                  {formatEuros(autre.personne.solde)}
                </span>
              </button>
            ))
          )}
        </Panel>
      </div>
    </>
  )
}
