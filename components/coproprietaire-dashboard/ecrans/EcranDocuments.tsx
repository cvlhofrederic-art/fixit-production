'use client'

// ── Écran « Documents » du portail copropriétaire ─────────────────────────────
//
// Sections à titres pleins, dans l'ordre : règlement de copropriété (carte structurée),
// procès-verbaux, contrats et assurances, devis, autres documents. Les fichiers publiés par
// le syndic sont répartis d'abord selon la rubrique qu'il a choisie (`categorie`), à défaut
// selon leur `type`. Chaque fichier s'ouvre par un seul bouton : l'URL signée est demandée
// au clic (jamais servie dans la liste). Sans jeton (démonstration visiteur), le bouton
// explique que les documents sont fictifs. Un locataire ne voit que le règlement.

import { useState } from 'react'
import type { PropsEcran } from '@/components/coproprietaire-dashboard/contrat'
import { Badge, Bouton, Carte, Deplie, Encadre, EtatVide, Ligne, type TonBadge } from '@/components/coproprietaire-dashboard/ui'
import { ouvrirDocument } from '@/lib/coproprietaire/api'
import {
  dateLongue, euros, libelleCategorieContrat, libelleStatutContrat, libelleTypeAssurance, pourcentage,
  remplir, tailleLisible, type LangueCopro, type TextesCopro,
} from '@/lib/coproprietaire/textes'
import type {
  AssuranceImmeuble, CategorieExtranet, ContratImmeuble, DocumentImmeuble, ReglementImmeuble, TypeDocumentImmeuble,
} from '@/lib/coproprietaire/types'

// ── Répartition des fichiers ──────────────────────────────────────────────────

type SectionFichiers = 'pv' | 'contrats' | 'devis' | 'autres'

export interface DocumentsRepartis {
  pv: DocumentImmeuble[]
  contrats: DocumentImmeuble[]
  devis: DocumentImmeuble[]
  autres: DocumentImmeuble[]
}

/** Rubriques de l'extranet qui ont leur propre section ; les autres rubriques vont dans « autres ». */
const SECTION_PAR_CATEGORIE: Partial<Record<CategorieExtranet, SectionFichiers>> = {
  pv_ag: 'pv',
  assurance: 'contrats',
  contrat_marche: 'contrats',
  contrat_entretien: 'contrats',
  contrat_syndic: 'contrats',
  devis_approuve: 'devis',
}

const SECTION_PAR_TYPE: Record<TypeDocumentImmeuble, SectionFichiers> = {
  pv_assemblee: 'pv',
  ata_ag: 'pv',
  contrat: 'contrats',
  devis: 'devis',
  autre: 'autres',
}

function sectionDuFichier(fichier: DocumentImmeuble): SectionFichiers {
  if (fichier.categorie !== null) return SECTION_PAR_CATEGORIE[fichier.categorie] ?? 'autres'
  return SECTION_PAR_TYPE[fichier.type] ?? 'autres'
}

/**
 * Répartit les fichiers publiés dans les sections de l'écran : la rubrique choisie par le syndic
 * (`categorie`) l'emporte ; sans rubrique, le `type` du document décide. Chaque section est triée
 * du plus récent au plus ancien. Fonction pure : le tableau reçu n'est pas modifié.
 */
export function repartirDocuments(fichiers: DocumentImmeuble[]): DocumentsRepartis {
  const sections: DocumentsRepartis = { pv: [], contrats: [], devis: [], autres: [] }
  for (const fichier of fichiers) sections[sectionDuFichier(fichier)].push(fichier)
  const plusRecentDAbord = (a: DocumentImmeuble, b: DocumentImmeuble) => b.ajouteLe.localeCompare(a.ajouteLe)
  for (const cle of Object.keys(sections) as SectionFichiers[]) sections[cle].sort(plusRecentDAbord)
  return sections
}

// ── Libellés locaux (absents de textes.ts) ────────────────────────────────────

const LIBELLE_PERSONNEL: Record<LangueCopro, string> = { fr: 'Personnel', pt: 'Pessoal' }

function tonStatutContrat(statut: string): TonBadge {
  if (statut === 'ativo' || statut === 'ativa') return 'vert'
  if (statut === 'renovacao') return 'ambre'
  return 'gris'
}

// ── Ligne de fichier ──────────────────────────────────────────────────────────

type EtatOuverture = 'repos' | 'ouverture' | 'erreur' | 'demo'

function LigneFichier({ fichier, jeton, demo, t, langue }: { fichier: DocumentImmeuble; jeton: string | null; demo: boolean; t: TextesCopro; langue: LangueCopro }) {
  const [etat, setEtat] = useState<EtatOuverture>('repos')
  const enCours = etat === 'ouverture'

  const ouvrir = async () => {
    if (demo || jeton === null) {
      setEtat('demo')
      return
    }
    setEtat('ouverture')
    const resultat = await ouvrirDocument(jeton, fichier.id)
    if (!resultat.ok) {
      setEtat('erreur')
      return
    }
    window.open(resultat.url, '_blank', 'noopener')
    setEtat('repos')
  }

  const details = [remplir(t.documents.ajouteLe, { date: dateLongue(fichier.ajouteLe, langue) }), tailleLisible(fichier.tailleOctets, langue)]
    .filter(Boolean)
    .join(' · ')

  return (
    <li className="border-b border-[#E4DDD0] py-3 last:border-b-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-base font-medium text-[#0D1B2E]">
            <span className="break-words">{fichier.nom}</span>
            {fichier.personnel && <Badge ton="or">{LIBELLE_PERSONNEL[langue]}</Badge>}
          </p>
          {details && <p className="mt-0.5 text-sm text-[#4A5E78]">{details}</p>}
        </div>
        <Bouton variante="secondaire" icone="ouvrir" onClick={ouvrir} disabled={enCours} aria-busy={enCours} className="shrink-0">
          {enCours ? t.documents.ouvertureEnCours : t.commun.ouvrir}
        </Bouton>
      </div>
      {etat === 'erreur' && <Encadre ton="erreur" className="mt-3">{t.documents.erreurOuverture}</Encadre>}
      {etat === 'demo' && <Encadre ton="info" className="mt-3">{t.shell.demoVisiteur}</Encadre>}
    </li>
  )
}

function ListeFichiers({ fichiers, jeton, demo, t, langue }: { fichiers: DocumentImmeuble[]; jeton: string | null; demo: boolean; t: TextesCopro; langue: LangueCopro }) {
  if (fichiers.length === 0) return null
  return (
    <ul className="divide-y-0">
      {fichiers.map(f => <LigneFichier demo={demo} key={f.id} fichier={f} jeton={jeton} t={t} langue={langue} />)}
    </ul>
  )
}

// ── Règlement de copropriété ──────────────────────────────────────────────────

function CarteReglement({
  reglement, fichierReglement, jeton, demo, t, langue,
}: { reglement: ReglementImmeuble; fichierReglement: DocumentImmeuble | null; jeton: string | null; demo: boolean; t: TextesCopro; langue: LangueCopro }) {
  const dateMaj = dateLongue(reglement.dateMaj, langue)
  return (
    <Carte titre={t.documents.reglement} sousTitre={dateMaj ? remplir(t.documents.misAJourLe, { date: dateMaj }) : undefined}>
      <dl>
        {reglement.chargesRepartition && <Ligne etiquette={t.documents.repartition}>{reglement.chargesRepartition}</Ligne>}
        {reglement.majoriteAg && <Ligne etiquette={t.documents.majorite}>{reglement.majoriteAg}</Ligne>}
        <Ligne etiquette={t.documents.fondsTravaux}>{reglement.fondsTravaux ? t.documents.oui : t.documents.non}</Ligne>
        <Ligne etiquette={t.documents.fondsRoulement}>
          {reglement.fondsRoulementPct > 0 ? pourcentage(reglement.fondsRoulementPct, langue) : t.documents.non}
        </Ligne>
      </dl>
      {reglement.texte && (
        <Deplie titre={t.documents.reglementTexte} className="mt-4">
          <p className="whitespace-pre-line text-base text-[#1F2D3D]">{reglement.texte}</p>
        </Deplie>
      )}
      {fichierReglement ? (
        <ul className="mt-4 border-t border-[#E4DDD0]">
          <LigneFichier demo={demo} fichier={fichierReglement} jeton={jeton} t={t} langue={langue} />
        </ul>
      ) : reglement.pdfNom ? (
        <p className="mt-4 text-sm text-[#4A5E78]">{reglement.pdfNom}</p>
      ) : null}
    </Carte>
  )
}

// ── Contrats et assurances ────────────────────────────────────────────────────

function LigneContrat({ contrat, t, langue }: { contrat: ContratImmeuble; t: TextesCopro; langue: LangueCopro }) {
  const fin = dateLongue(contrat.fin, langue)
  const titre = [libelleCategorieContrat(contrat.categorie, t), contrat.fournisseur, fin ? remplir(t.documents.jusquAu, { date: fin }) : '']
    .filter(Boolean)
    .join(' — ')
  const cout = contrat.coutMensuel > 0
    ? remplir(t.documents.parMois, { montant: euros(contrat.coutMensuel, langue) })
    : contrat.coutAnnuel > 0 ? remplir(t.documents.parAn, { montant: euros(contrat.coutAnnuel, langue) }) : ''
  return (
    <li className="border-b border-[#E4DDD0] py-3 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-base font-medium text-[#0D1B2E]">{titre}</p>
        {contrat.statut && <Badge ton={tonStatutContrat(contrat.statut)}>{libelleStatutContrat(contrat.statut, t)}</Badge>}
      </div>
      {cout && <p className="mt-0.5 text-sm text-[#4A5E78]">{cout}</p>}
    </li>
  )
}

function LigneAssurance({ assurance, t, langue }: { assurance: AssuranceImmeuble; t: TextesCopro; langue: LangueCopro }) {
  const fin = dateLongue(assurance.fin, langue)
  const titre = [
    libelleTypeAssurance(assurance.type, t),
    assurance.assureur,
    assurance.police ? remplir(t.documents.police, { numero: assurance.police }) : '',
    fin ? remplir(t.documents.jusquAu, { date: fin }) : '',
  ].filter(Boolean).join(' — ')
  const prime = assurance.primeAnnuelle > 0 ? remplir(t.documents.parAn, { montant: euros(assurance.primeAnnuelle, langue) }) : ''
  return (
    <li className="border-b border-[#E4DDD0] py-3 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-base font-medium text-[#0D1B2E]">{titre}</p>
        {assurance.statut && <Badge ton={tonStatutContrat(assurance.statut)}>{libelleStatutContrat(assurance.statut, t)}</Badge>}
      </div>
      {prime && <p className="mt-0.5 text-sm text-[#4A5E78]">{prime}</p>}
    </li>
  )
}

// ── Écran ─────────────────────────────────────────────────────────────────────

export default function EcranDocuments(props: PropsEcran) {
  const demo = props.jeton === null || props.espace.source === 'demo'
  const { espace, t, langue, jeton } = props
  const { fichiers, contrats, assurances } = espace.documents
  const reglement = espace.immeuble.reglement
  const locataire = espace.profil.role === 'locataire'

  const repartis = repartirDocuments(fichiers)
  const fichierReglement = reglement
    ? fichiers.find(f => f.categorie === 'reglement' || (reglement.pdfNom !== '' && f.nom === reglement.pdfNom)) ?? null
    : null
  const autres = fichierReglement ? repartis.autres.filter(f => f.id !== fichierReglement.id) : repartis.autres

  const avecContrats = !locataire && (contrats.length > 0 || assurances.length > 0 || repartis.contrats.length > 0)
  const sectionsVides = locataire
    || (repartis.pv.length === 0 && !avecContrats && repartis.devis.length === 0 && autres.length === 0)

  return (
    <div className="space-y-5">
      {reglement && <CarteReglement demo={demo} reglement={reglement} fichierReglement={fichierReglement} jeton={jeton} t={t} langue={langue} />}

      {sectionsVides && !(locataire && reglement) && <EtatVide texte={t.documents.aucunDocument} icone="documents" />}

      {!locataire && repartis.pv.length > 0 && (
        <Carte titre={t.documents.pv}>
          <ListeFichiers demo={demo} fichiers={repartis.pv} jeton={jeton} t={t} langue={langue} />
        </Carte>
      )}

      {avecContrats && (
        <Carte titre={t.documents.contrats}>
          {(contrats.length > 0 || assurances.length > 0) && (
            <ul>
              {contrats.map(c => <LigneContrat key={c.id} contrat={c} t={t} langue={langue} />)}
              {assurances.map(a => <LigneAssurance key={a.id} assurance={a} t={t} langue={langue} />)}
            </ul>
          )}
          {repartis.contrats.length > 0 && (
            <div className={contrats.length > 0 || assurances.length > 0 ? 'mt-3 border-t border-[#E4DDD0]' : ''}>
              <ListeFichiers demo={demo} fichiers={repartis.contrats} jeton={jeton} t={t} langue={langue} />
            </div>
          )}
        </Carte>
      )}

      {!locataire && repartis.devis.length > 0 && (
        <Carte titre={t.documents.devis}>
          <ListeFichiers demo={demo} fichiers={repartis.devis} jeton={jeton} t={t} langue={langue} />
        </Carte>
      )}

      {!locataire && autres.length > 0 && (
        <Carte titre={t.documents.autres}>
          <ListeFichiers demo={demo} fichiers={autres} jeton={jeton} t={t} langue={langue} />
        </Carte>
      )}
    </div>
  )
}
