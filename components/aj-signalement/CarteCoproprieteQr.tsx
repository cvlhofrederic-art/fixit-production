'use client'

// ── Carte d'une copropriété : QR code, lien, destinataires, affiche PDF, QR PNG ─────────────────────
//
// Le QR code encode le lien public de la copropriété (origine du site courant). Les fichiers sont
// préparés dans le navigateur à partir de la matrice du QR code (lib/aj-signalement/qr) : affiche A4 à
// poser sur place, ou QR seul pour une mise en page maison.
// Copropriété sans adresse : la dernière adresse proposée d'après la position d'un déclarant (avec sa date) et
// « Utiliser cette adresse », qui l'enregistre par la route de modification (super admin). Une adresse proposée
// vient du public : elle n'est appliquée que par ce clic.
// Depuis le 11/11/2026 : copropriété rattachée à un cabinet client → le QR code, le lien et l'affiche portent le chemin
// du cabinet (vitfix.io/<identifiant>/signalement/<jeton>/) ; cabinet, gestionnaires ou « Tous les gestionnaires »,
// créateur, CP, ville, immatriculation, et rappel des adresses de gestionnaires restées dans les destinataires.
// PR 2, lot 5 (vueGestionnaire : espace d'un cabinet, gestionnaire connecté, SPEC § 2.8) : copropriété telle que le
// serveur la lui rend (minimisée) ; « Créée par vous », « Commune à tous les gestionnaires » ; « Modifier » seulement si
// la fiche lui est attribuée nommément (modifiable), sinon « fiche modifiable par le cabinet seulement » ; désactivée :
// « QR code désactivé par le cabinet », sans QR code, lien ni affiche (le serveur ne rend pas son jeton) ; ni cabinet,
// ni gestionnaires, ni créateur nommé ; adresses d'autres fiches comptées, jamais montrées.
// PR 3, lot 8 (cahier § 7.1, BROUILLON pour Frédéric) : « Diffuser un message » et « Messages envoyés », seulement quand
// l'appelant les donne (super admin ; gestionnaire sur une copropriété qui lui est attribuée nommément, jamais « à
// tous », décision H11). Le nombre de messages n'est pas sur la carte : il est dans la fenêtre (rappel du mois).
// Logo du cabinet (demande de Hugo du 13/11/2026) : logoCabinet, les métadonnées du logo du cabinet de la copropriété
// (données déjà chargées par l'appelant) ; l'image est lue au clic sur « Affiche PDF » et posée sur l'affiche. Sans logo,
// l'affiche est celle d'avant ; logo illisible, ou que jsPDF ne sait pas poser : affiche sans logo et avertissement.

import { useState } from 'react'
import { remplir } from '@/lib/coproprietaire/textes'
import { Badge, Bouton, BoutonCopier, Carte, Encadre } from '@/components/coproprietaire-dashboard/ui'
import QrCodeSvg from '@/components/aj-signalement/QrCodeSvg'
import { urlSignalementQr, type CoproprieteQr } from '@/lib/aj-signalement/types'
import { TEXTES_TABLEAU_QR as T, dateHeureParis, destinatairesAffichesQr, resumeCompteursQr } from '@/lib/aj-signalement/affichage'
import { TEXTES_GESTION_QR as G, dateParisQr } from '@/lib/aj-signalement/affichage-gestion'
import { TEXTES_ESPACE_CABINET_QR as EC, idCarteCoproprieteQr } from '@/lib/aj-signalement/affichage-gestionnaire'
import { TEXTES_ECRAN_DIFFUSION_QR as TD } from '@/lib/aj-signalement/affichage-ecran-diffusion'
import { affichePdfQr, nomFichierQr, pngQr, telechargerFichier, type MatriceQr } from '@/lib/aj-signalement/qr'
import { affichesAvecRepliQr, logoPourAfficheQr } from '@/components/aj-signalement/logoAfficheQr'
import type { LogoCabinetQr } from '@/lib/aj-signalement/types'

export interface PropsCarteCoproprieteQr {
  copropriete: CoproprieteQr
  /** Origine des liens encodés (« https://vitfix.io »). */
  origine: string
  onModifier: () => void
  /** Enregistre l'adresse proposée comme adresse de la copropriété ; false si le serveur l'a refusée. */
  onUtiliserAdresse?: (adresse: string) => Promise<boolean>
  /** PR 2 : vue d'un gestionnaire connecté (espace de son cabinet) ; absent : vue du super admin, inchangée. */
  vueGestionnaire?: boolean
  /** PR 3 : « Diffuser un message » (absent : le profil n'a pas le droit « diffuser » sur cette copropriété). */
  onDiffuser?: () => void
  /** PR 3 : « Messages envoyés » (historique de la copropriété), même droit. */
  onHistoriqueDiffusion?: () => void
  /** Logo du cabinet de la copropriété (métadonnées) ; absent : affiche sans logo, comme avant. */
  logoCabinet?: LogoCabinetQr | null
}

type PropsDiffusion = Pick<PropsCarteCoproprieteQr, 'onDiffuser' | 'onHistoriqueDiffusion'>

export default function CarteCoproprieteQr({
  copropriete, origine, onModifier, onUtiliserAdresse, vueGestionnaire = false, onDiffuser, onHistoriqueDiffusion, logoCabinet = null,
}: Readonly<PropsCarteCoproprieteQr>) {
  const diffusion: PropsDiffusion = { onDiffuser, onHistoriqueDiffusion }
  if (vueGestionnaire) return <CarteGestionnaireQr copropriete={copropriete} origine={origine} onModifier={onModifier} logoCabinet={logoCabinet} {...diffusion} />
  return (
    <CarteSuperAdminQr
      copropriete={copropriete} origine={origine} onModifier={onModifier} onUtiliserAdresse={onUtiliserAdresse} logoCabinet={logoCabinet} {...diffusion}
    />
  )
}

/** Boutons de la diffusion (PR 3), rangés avec les actions de la carte. */
function ActionsDiffusionQr({ onDiffuser, onHistoriqueDiffusion }: Readonly<PropsDiffusion>) {
  return (
    <>
      {onDiffuser && <Bouton variante="secondaire" icone="annonces" petit onClick={onDiffuser}>{TD.carte.diffuser}</Bouton>}
      {onHistoriqueDiffusion && <Bouton variante="discret" icone="horloge" petit onClick={onHistoriqueDiffusion}>{TD.carte.historique}</Bouton>}
    </>
  )
}

/** QR code, lien public, affiche PDF (avec le logo du cabinet s'il en a un) et QR PNG d'une copropriété : communs aux deux vues. */
function useFichiersQr(copropriete: CoproprieteQr, url: string, setErreur: (erreur: string | null) => void, logoCabinet: LogoCabinetQr | null) {
  const [matrice, setMatrice] = useState<MatriceQr | null>(null)
  const [preparation, setPreparation] = useState(false)

  const telechargerPng = () => {
    if (!matrice) return
    const png = pngQr(matrice, 24, 4)
    if (!png) {
      setErreur(T.erreurFichier)
      return
    }
    telechargerFichier(`qr-${nomFichierQr(copropriete.nom)}.png`, png)
  }

  const telechargerPdf = async () => {
    if (!matrice || preparation) return
    setPreparation(true)
    setErreur(null)
    try {
      const affiche = { nom: copropriete.nom, adresse: copropriete.adresse, url, matrice }
      const sansLogo = G.cabinets.logo.afficheSansLogo
      const logo = await logoPourAfficheQr(copropriete.cabinet?.identifiant, logoCabinet, sansLogo)
      const pdf = await affichesAvecRepliQr(logo, (l) => (l ? affichePdfQr(affiche, { logo: l }) : affichePdfQr(affiche)), sansLogo)
      telechargerFichier(`affiche-qr-${nomFichierQr(copropriete.nom)}.pdf`, pdf)
    } catch (e) {
      console.warn('[aj-signalement] affiche non préparée', e)
      setErreur(T.erreurFichier)
    } finally {
      setPreparation(false)
    }
  }

  return { matrice, setMatrice, preparation, telechargerPng, telechargerPdf }
}

/** Carte vue par un gestionnaire connecté (PR 2, lot 5). */
function CarteGestionnaireQr({
  copropriete, origine, onModifier, onDiffuser, onHistoriqueDiffusion, logoCabinet,
}: Readonly<Pick<PropsCarteCoproprieteQr, 'copropriete' | 'origine' | 'onModifier' | 'onDiffuser' | 'onHistoriqueDiffusion'> & { logoCabinet: LogoCabinetQr | null }>) {
  const [erreur, setErreur] = useState<string | null>(null)
  // Désactivée par le cabinet : aucun jeton rendu, donc aucun QR code, lien ni affiche.
  const avecQr = copropriete.actif && copropriete.jeton !== ''
  const url = avecQr ? urlSignalementQr(copropriete.jeton, origine, copropriete.cabinet?.identifiant) : ''
  const { matrice, setMatrice, preparation, telechargerPng, telechargerPdf } = useFichiersQr(copropriete, url, setErreur, logoCabinet)
  const g = G.copropriete
  const localisation = `${copropriete.codePostal} ${copropriete.ville}`.trim()
  const masquees = copropriete.adressesMasquees ?? 0
  const modifiable = copropriete.actif && copropriete.modifiable === true

  return (
    <Carte
      id={idCarteCoproprieteQr(copropriete.id)}
      titre={copropriete.nom}
      sousTitre={copropriete.adresse || T.sansAdresse}
      actions={copropriete.actif ? undefined : <Badge ton="gris">{EC.copropriete.desactivee}</Badge>}
      ton={copropriete.actif ? 'neutre' : 'gris'}
    >
      <div className="flex flex-col gap-5 sm:flex-row">
        {avecQr && (
          <div className="shrink-0 self-center rounded-xl border border-[#E4DDD0] bg-white p-2 sm:self-start">
            <QrCodeSvg texte={url} libelle={remplir(T.libelleQr, { nom: copropriete.nom })} taille={176} onMatrice={setMatrice} />
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-3">
          {(copropriete.creeeParVous || copropriete.attribueeATous) && (
            <div className="flex flex-wrap gap-2">
              {copropriete.creeeParVous && <Badge ton="vert">{EC.copropriete.creeeParVous}</Badge>}
              {copropriete.attribueeATous && <Badge ton="or">{EC.copropriete.commune}</Badge>}
            </div>
          )}
          {avecQr && (
            <div>
              <p className="text-sm font-semibold text-[#4A5E78]">{T.lien}</p>
              <p className="break-all text-base text-[#0D1B2E]">{url}</p>
              <div className="mt-2">
                <BoutonCopier texte={url} libelle={T.copierLien} libelleCopie={T.lienCopie} />
              </div>
            </div>
          )}
          <p className="text-sm text-[#4A5E78]">
            <span className="font-semibold">{EC.copropriete.destinataires}</span>{' '}
            {copropriete.emailsDestinataires.length > 0 ? copropriete.emailsDestinataires.join(', ') : EC.copropriete.aucunDestinataire}
          </p>
          {masquees > 0 && <p className="text-sm text-[#4A5E78]">{remplir(EC.copropriete.adressesMasquees, { n: masquees })}</p>}
          <p className="text-sm text-[#4A5E78]">{resumeCompteursQr(copropriete)}</p>
          {(localisation || copropriete.immatriculation) && (
            <p className="text-sm text-[#4A5E78]">
              {[localisation, copropriete.immatriculation ? remplir(g.immatriculationLigne, { numero: copropriete.immatriculation }) : ''].filter(Boolean).join(' · ')}
            </p>
          )}
          {copropriete.actif && !modifiable && (
            <Encadre ton="info">{copropriete.attribueeATous ? EC.copropriete.communeLectureSeule : EC.copropriete.lectureSeule}</Encadre>
          )}
          {erreur && <Encadre ton="erreur">{erreur}</Encadre>}
          {(avecQr || modifiable || onDiffuser || onHistoriqueDiffusion) && (
            <div className="flex flex-wrap gap-2">
              {avecQr && (
                <>
                  <Bouton variante="principal" icone="documents" petit disabled={!matrice || preparation} onClick={() => { void telechargerPdf() }}>
                    {preparation ? T.preparation : T.affichePdf}
                  </Bouton>
                  <Bouton variante="secondaire" icone="qr" petit disabled={!matrice} onClick={telechargerPng}>{T.qrPng}</Bouton>
                </>
              )}
              {modifiable && <Bouton variante="secondaire" icone="outil" petit onClick={onModifier}>{T.modifier}</Bouton>}
              <ActionsDiffusionQr onDiffuser={onDiffuser} onHistoriqueDiffusion={onHistoriqueDiffusion} />
            </div>
          )}
        </div>
      </div>
    </Carte>
  )
}

/** Carte vue par le super admin (espace global) : inchangée, sauf les actions de la diffusion (PR 3) et le logo sur l'affiche. */
function CarteSuperAdminQr({
  copropriete, origine, onModifier, onUtiliserAdresse, onDiffuser, onHistoriqueDiffusion, logoCabinet,
}: Readonly<Omit<PropsCarteCoproprieteQr, 'vueGestionnaire' | 'logoCabinet'> & { logoCabinet: LogoCabinetQr | null }>) {
  const [enregistrement, setEnregistrement] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const url = urlSignalementQr(copropriete.jeton, origine, copropriete.cabinet?.identifiant)
  const { matrice, setMatrice, preparation, telechargerPng, telechargerPdf } = useFichiersQr(copropriete, url, setErreur, logoCabinet)
  const g = G.copropriete
  const createur = copropriete.creePar === 'administrateur'
    ? g.creeeParAdmin
    : remplir(g.creeePar, { nom: copropriete.creePar.nom ?? G.fiche.ancien })
  const localisation = `${copropriete.codePostal} ${copropriete.ville}`.trim()
  const proposee = copropriete.adresse.trim() ? null : copropriete.derniereAdresseProposee

  const utiliserAdresse = async () => {
    if (!proposee || !onUtiliserAdresse || enregistrement) return
    setEnregistrement(true)
    setErreur(null)
    const enregistree = await onUtiliserAdresse(proposee.adresse)
    setEnregistrement(false)
    if (!enregistree) setErreur(T.erreurAdresse)
  }

  return (
    <Carte
      titre={copropriete.nom}
      sousTitre={copropriete.adresse || T.sansAdresse}
      actions={copropriete.actif ? undefined : <Badge ton="gris">{T.qrDesactive}</Badge>}
      ton={copropriete.actif ? 'neutre' : 'gris'}
    >
      <div className="flex flex-col gap-5 sm:flex-row">
        <div className="shrink-0 self-center rounded-xl border border-[#E4DDD0] bg-white p-2 sm:self-start">
          <QrCodeSvg texte={url} libelle={remplir(T.libelleQr, { nom: copropriete.nom })} taille={176} onMatrice={setMatrice} />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="text-sm font-semibold text-[#4A5E78]">{T.lien}</p>
            <p className="break-all text-base text-[#0D1B2E]">{url}</p>
            <div className="mt-2">
              <BoutonCopier texte={url} libelle={T.copierLien} libelleCopie={T.lienCopie} />
            </div>
          </div>
          <p className="text-sm text-[#4A5E78]">
            <span className="font-semibold">{T.destinataires}</span> {destinatairesAffichesQr(copropriete)}
          </p>
          <p className="text-sm text-[#4A5E78]">{resumeCompteursQr(copropriete)}</p>
          {copropriete.cabinet && (
            <div className="space-y-1 text-sm text-[#4A5E78]">
              <p>{remplir(g.cabinetLigne, { nom: copropriete.cabinet.nom })}</p>
              {copropriete.attribueeATous ? <Badge ton="or">{g.tousGestionnaires}</Badge> : (
                <p>
                  {copropriete.gestionnaires.length > 0
                    ? remplir(g.gestionnairesLigne, { noms: copropriete.gestionnaires.map((x) => x.nom ?? G.fiche.ancien).join(', ') })
                    : g.sansGestionnaire}
                </p>
              )}
            </div>
          )}
          {(localisation || copropriete.immatriculation) && (
            <p className="text-sm text-[#4A5E78]">
              {[localisation, copropriete.immatriculation ? remplir(g.immatriculationLigne, { numero: copropriete.immatriculation }) : ''].filter(Boolean).join(' · ')}
            </p>
          )}
          <p className="text-sm text-[#4A5E78]">{createur} · {dateParisQr(copropriete.creeLe)}</p>
          {copropriete.adressesDeGestionnaires > 0 && (
            <Encadre ton="avertissement">{remplir(g.adressesGestionnaires, { n: copropriete.adressesDeGestionnaires })}</Encadre>
          )}
          {proposee && (
            <Encadre ton="info">
              <p>{remplir(T.derniereAdresseProposee, { date: dateHeureParis(proposee.le), adresse: proposee.adresse })}</p>
              {onUtiliserAdresse && (
                <div className="mt-2">
                  <Bouton variante="or" icone="adresse" petit disabled={enregistrement} onClick={() => { void utiliserAdresse() }}>
                    {enregistrement ? T.enregistrementAdresse : T.utiliserAdresse}
                  </Bouton>
                </div>
              )}
            </Encadre>
          )}
          {erreur && <Encadre ton="erreur">{erreur}</Encadre>}
          <div className="flex flex-wrap gap-2">
            <Bouton variante="principal" icone="documents" petit disabled={!matrice || preparation} onClick={() => { void telechargerPdf() }}>
              {preparation ? T.preparation : T.affichePdf}
            </Bouton>
            <Bouton variante="secondaire" icone="qr" petit disabled={!matrice} onClick={telechargerPng}>{T.qrPng}</Bouton>
            <Bouton variante="secondaire" icone="outil" petit onClick={onModifier}>{T.modifier}</Bouton>
            <ActionsDiffusionQr onDiffuser={onDiffuser} onHistoriqueDiffusion={onHistoriqueDiffusion} />
          </div>
        </div>
      </div>
    </Carte>
  )
}
