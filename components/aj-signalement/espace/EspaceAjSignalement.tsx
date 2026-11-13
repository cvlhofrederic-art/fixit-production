'use client'

// ── Espace « AJ Signalement » (/fr/aj-signalement/) ───────────────────────────
//
// Espace indépendant du portail copropriétaire et de l'Administrateur judiciaire (demande de Hugo du 10/11/2026) : son
// adresse, son menu, sa page de connexion professionnelle (/fr/aj-signalement/connexion/, 11/11/2026). La garde
// (useAccesEspaceQr) passe avant tout : aucune donnée n'est chargée tant que le rôle n'est pas vérifié ; sans session
// ou sans accès, renvoi vers la page de connexion de l'espace (message neutre là-bas pour un compte sans accès).
// Puis la coquille : en-tête « AJ Signalement », menu (barre latérale sur ordinateur,
// barre du bas sur téléphone) construit depuis entreesMenuQr(role), une vue par ancre (#signalements : le bouton
// « retour » du navigateur fonctionne), un h1 par vue qui reçoit le focus à chaque changement, le titre d'onglet.
// Le contenu (TableauSignalementsQr) reste monté d'une vue à l'autre : un seul chargement. Socle visuel du portail
// copropriétaire (components/coproprietaire-dashboard/ui), comme les composants de components/aj-signalement/.
// Pas de <main> ici : la coquille racine en pose déjà un (#main-content).
// Depuis le 11/11/2026 (demandes de Hugo du 10/11) : vues Gestionnaires (liste, puis page profil à l'ancre
// #gestionnaire/<uuid>), Cabinets et Journal. Le tableau, chargé une fois par TableauSignalementsQr (caché hors de ses
// trois vues), leur est partagé ; cabinets et fiches sont chargés une fois, à la première vue qui en a besoin.
// PR 2, lot 4 : la même coquille sert l'espace de chaque cabinet (vitfix.io/<identifiant>/suivi/), avec le cabinet de la
// page passé à la garde. Le gestionnaire y a ses trois vues (Tableau de bord, Copropriétés, Signalements) ; cabinets et
// fiches (routes du super admin) ne sont jamais chargés pour lui.
// PR 2, lot 5 : après la garde, GET /moi relit sa fiche (nom, cabinet, domaines) : accès retiré → « Votre accès a été
// retiré par le cabinet. » et « Se déconnecter » ; fiche d'un autre cabinet → message neutre ; migration, serveur ou
// réseau → message et « Réessayer ». Puis la coquille, avec le nom du cabinet sous « AJ Signalement » et ses écrans
// (TableauSignalementsQr en vue gestionnaire : cartes, fenêtre de copropriété, détail).
// PR 3, relecture 3 (cahier § 7.1) : la fenêtre de diffusion ouverte depuis le suivi d'un gestionnaire (page profil,
// démontée à chaque changement de vue) est portée ici, par la coquille, qui reste montée. Un changement de vue lui
// demande de fermer, avec sa protection (saisie : « Abandonner ce message ? » ; envoi : aucune fermeture, la reprise
// automatique continue), comme TableauSignalementsQr pour les fenêtres de ses cartes ; rien à protéger : fermée.
// Correctif du 13/11/2026 (Hugo : « les listes ne se rafraîchissent pas » ; ≈ 2,4 s par appel en production) : le
// rechargement demandé après une modification rend une promesse, tenue quand cabinets, fiches ET tableau sont à jour
// (ou leur échec affiché) ; chaque action l'attend avant de fermer sa fenêtre et d'annoncer son succès.

import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react'
import { Bouton, Encadre, Icone, type NomIcone } from '@/components/coproprietaire-dashboard/ui'
import TableauSignalementsQr from '@/components/aj-signalement/TableauSignalementsQr'
import ListeGestionnairesQr from '@/components/aj-signalement/ListeGestionnairesQr'
import FicheGestionnaireQr from '@/components/aj-signalement/FicheGestionnaireQr'
import FenetreDiffusionQr from '@/components/aj-signalement/FenetreDiffusionQr'
import type { DemandeDiffusionSuiviQr } from '@/components/aj-signalement/SuiviGestionnaireQr'
import type { GardeDiffusionQr } from '@/lib/aj-signalement/affichage-ecran-diffusion'
import PagePleineQr from '@/components/aj-signalement/espace/PagePleineQr'
import CabinetsQr from '@/components/aj-signalement/CabinetsQr'
import JournalQr from '@/components/aj-signalement/JournalQr'
import { useAccesEspaceQr, type CabinetEspaceQr } from '@/components/aj-signalement/espace/useAccesEspaceQr'
import { useReferentielsQr } from '@/components/aj-signalement/espace/useReferentielsQr'
import { useProfilCabinetQr } from '@/components/aj-signalement/espace/useProfilCabinetQr'
import type { VueGestionnaireTableauQr } from '@/components/aj-signalement/TableauSignalementsQr'
import { TEXTES_ESPACE_CABINET_QR as EC, messageErreurGestionnaireQr } from '@/lib/aj-signalement/affichage-gestionnaire'
import {
  TEXTES_ESPACE_QR as E, VUES_TABLEAU_QR, VUE_PAR_DEFAUT_QR, ancreEspaceQr, entreesBarreDuBasQr, entreesMenuQr, texteAncreQr,
  type AncreEspaceQr, type EntreeMenuQr, type RoleEspaceQr, type VueEspaceQr,
} from '@/lib/aj-signalement/acces-espace'
import type { TableauQr } from '@/lib/aj-signalement/types'

const ICONES_VUES: Record<VueEspaceQr, NomIcone> = {
  'tableau-de-bord': 'accueil',
  coproprietes: 'immeuble',
  signalements: 'demandes',
  gestionnaires: 'assemblees',
  cabinets: 'documents',
  journal: 'horloge',
}

/** Vues qui ont besoin des cabinets et des fiches (fenêtre de copropriété comprise). */
const VUES_REFERENTIELS_QR: readonly VueEspaceQr[] = ['coproprietes', 'gestionnaires', 'cabinets', 'journal']

const ANCRE_PAR_DEFAUT_QR: AncreEspaceQr = { vue: VUE_PAR_DEFAUT_QR, gestionnaireId: null }

export interface PropsEspaceAjSignalement {
  /** Cabinet de la page (espace d'un cabinet, PR 2) ; absent : espace global du super admin. */
  cabinet?: CabinetEspaceQr
}

export default function EspaceAjSignalement({ cabinet }: Readonly<PropsEspaceAjSignalement> = {}) {
  const { etat, connexion, reessayer, seDeconnecter } = useAccesEspaceQr(cabinet?.identifiant)

  if (etat.statut === 'autorise' && etat.role === 'gestionnaire') {
    return <EspaceGestionnaireQr identifiantCabinet={cabinet?.identifiant ?? null} onDeconnexion={() => { void seDeconnecter() }} />
  }
  if (etat.statut === 'autorise') {
    return <CoquilleEspaceQr role={etat.role} lienAdmin={etat.lienAdmin} onDeconnexion={() => { void seDeconnecter() }} />
  }
  if (etat.statut === 'indisponible') {
    return (
      <PagePleineQr>
        <Encadre ton="avertissement">{E.indisponible}</Encadre>
        <div className="mt-6"><Bouton variante="principal" icone="actualiser" pleineLargeur onClick={reessayer}>{E.reessayer}</Bouton></div>
      </PagePleineQr>
    )
  }
  return (
    <PagePleineQr>
      {/* Zone d'état native (rôle status) ; <output> n'admet que du contenu phrasé : span en block, même rendu que div et p. */}
      <output className="block text-center">
        <span className="mx-auto mb-4 block h-12 w-12 animate-spin rounded-full border-4 border-[#C9A84C] border-t-transparent" />
        <span className="block text-base font-medium text-[#4A5E78]">{etat.statut === 'connexion' ? E.redirectionConnexion : E.verification}</span>
      </output>
      {etat.statut === 'connexion' && (
        <div className="mt-6"><Bouton variante="principal" href={connexion} icone="utilisateur" pleineLargeur>{E.seConnecter}</Bouton></div>
      )}
    </PagePleineQr>
  )
}

// ── Gestionnaire : sa fiche relue (GET /moi), puis la coquille (PR 2, lot 5) ──

function EspaceGestionnaireQr({ identifiantCabinet, onDeconnexion }: Readonly<{ identifiantCabinet: string | null; onDeconnexion: () => void }>) {
  const { etat, reessayer } = useProfilCabinetQr(identifiantCabinet, true)

  if (etat.statut === 'pret') {
    return (
      <CoquilleEspaceQr
        role="gestionnaire" lienAdmin={null} onDeconnexion={onDeconnexion}
        cabinetNom={etat.profil.cabinet.nom} vueGestionnaire={{ domaines: etat.profil.cabinet.domaines }}
      />
    )
  }
  if (etat.statut === 'chargement') {
    return (
      <PagePleineQr titre={E.nom}>
        <output className="block text-center">
          <span className="mx-auto mb-4 block h-12 w-12 animate-spin rounded-full border-4 border-[#C9A84C] border-t-transparent" />
          <span className="block text-base font-medium text-[#4A5E78]">{EC.chargement}</span>
        </output>
      </PagePleineQr>
    )
  }
  const sortie = <Bouton variante="secondaire" icone="deconnexion" pleineLargeur onClick={onDeconnexion}>{E.seDeconnecter}</Bouton>
  if (etat.statut === 'retire' || etat.statut === 'autre_espace') {
    return (
      <PagePleineQr titre={E.nom}>
        <Encadre ton="avertissement">{etat.statut === 'retire' ? EC.accesRetire : E.sansAcces}</Encadre>
        <div className="mt-6">{sortie}</div>
      </PagePleineQr>
    )
  }
  return (
    <PagePleineQr titre={E.nom}>
      <Encadre ton={etat.code === 'base_absente' ? 'avertissement' : 'erreur'}>{messageErreurGestionnaireQr(etat.code)}</Encadre>
      <div className="mt-6 space-y-3">
        <Bouton variante="principal" icone="actualiser" pleineLargeur onClick={reessayer}>{E.reessayer}</Bouton>
        {sortie}
      </div>
    </PagePleineQr>
  )
}

// ── Coquille (rôle vérifié) ──────────────────────────────────────────────────

interface PropsCoquille {
  role: RoleEspaceQr
  lienAdmin: string | null
  onDeconnexion: () => void
  /** PR 2 : nom du cabinet (espace d'un cabinet), sous « AJ Signalement ». */
  cabinetNom?: string
  /** PR 2 : vue d'un gestionnaire connecté (domaines de son cabinet). */
  vueGestionnaire?: VueGestionnaireTableauQr
}

function CoquilleEspaceQr({ role, lienAdmin, onDeconnexion, cabinetNom, vueGestionnaire }: Readonly<PropsCoquille>) {
  const entrees = entreesMenuQr(role)
  const [ancre, setAncre] = useState<AncreEspaceQr>(() => ancreEspaceQr(window.location.hash, role) ?? ANCRE_PAR_DEFAUT_QR)
  const vue = ancre.vue
  const titre = useRef<HTMLHeadingElement>(null)
  // Le focus ne va au titre qu'après une navigation de l'utilisateur, jamais à l'ouverture.
  const focusAPoser = useRef(false)
  const entree = entrees.find((e) => e.vue === vue) ?? entrees[0]
  // Gestionnaire : sous-titres de ses vues (il ne voit ni les gestionnaires ni les cabinets).
  const sousTitre = (vueGestionnaire ? EC.sousTitres[entree.vue] : undefined) ?? entree.sousTitre
  // Tableau chargé par TableauSignalementsQr, partagé avec les autres vues ; actualisation : rechargement demandé.
  const [tableau, setTableau] = useState<TableauQr | null>(null)
  const [actualisation, setActualisation] = useState(0)
  // Cabinets et fiches : routes du super admin seulement (un gestionnaire y recevrait 403).
  const superAdmin = role === 'super_admin'
  const referentiels = useReferentielsQr(superAdmin && VUES_REFERENTIELS_QR.includes(vue))
  const { recharger } = referentiels

  // Fenêtre de diffusion du suivi d'un gestionnaire (voir l'en-tête) et sa protection, remontée par elle.
  const [diffusionSuivi, setDiffusionSuivi] = useState<DemandeDiffusionSuiviQr | null>(null)
  const [gardeSuivi, setGardeSuivi] = useState<GardeDiffusionQr>('libre')
  const [demandeFermetureSuivi, setDemandeFermetureSuivi] = useState(0)
  const fermerDiffusionSuivi = useCallback(() => setDiffusionSuivi(null), [])
  // Changement de vue (menu, Retour du navigateur, autre page profil) : état ajusté au rendu, sans effet.
  const texteAncre = texteAncreQr(ancre)
  const [ancreDiffusion, setAncreDiffusion] = useState(texteAncre)
  if (texteAncre !== ancreDiffusion) {
    setAncreDiffusion(texteAncre)
    if (diffusionSuivi && gardeSuivi !== 'libre') setDemandeFermetureSuivi((n) => n + 1)
    else if (diffusionSuivi) setDiffusionSuivi(null)
  }

  // Retour du navigateur (ou ancre modifiée à la main) : la vue suit l'ancre ; une ancre qui ne désigne aucune vue
  // (lien d'évitement « Aller au contenu principal », #main-content) laisse la vue en cours.
  useEffect(() => {
    const surRetour = () => {
      const brute = window.location.hash
      const cible = brute.replace(/^#/, '') === '' ? ANCRE_PAR_DEFAUT_QR : ancreEspaceQr(brute, role)
      if (!cible) return
      focusAPoser.current = true
      setAncre(cible)
    }
    window.addEventListener('popstate', surRetour)
    return () => window.removeEventListener('popstate', surRetour)
  }, [role])

  useEffect(() => {
    document.title = `${entree.libelle} — ${E.nom}`
    if (focusAPoser.current) titre.current?.focus()
    focusAPoser.current = false
  }, [entree, ancre.gestionnaireId])

  const allerA = (cible: AncreEspaceQr) => {
    focusAPoser.current = true
    setAncre(cible)
    const texte = `#${texteAncreQr(cible)}`
    if (window.location.hash !== texte) window.history.pushState(null, '', texte)
    window.scrollTo({ top: 0 })
  }
  /** Entrée du menu : la vue elle-même (la liste des gestionnaires, jamais une page profil). */
  const allerAVue = (cible: VueEspaceQr) => allerA({ vue: cible, gestionnaireId: null })

  // Rechargements du tableau demandés et pas encore finis : numéro d'actualisation → fin de leur attente.
  const derniereActualisation = useRef(0)
  const attentesTableau = useRef(new Map<number, () => void>())
  /** Rechargement du tableau fini : il sert toutes les demandes faites jusqu'à lui (numéros croissants). */
  const surTableauActualise = useCallback((numero: number) => {
    for (const [demande, finir] of attentesTableau.current) {
      if (demande > numero) continue
      attentesTableau.current.delete(demande)
      finir()
    }
  }, [])

  /**
   * Une fiche, un cabinet ou des attributions ont changé : cabinets, fiches et tableau rechargés ensemble. La promesse
   * est tenue quand les trois sont à jour (ou leur échec affiché : encadré, toast) ; jamais rejetée (les chargements
   * rendent leurs échecs). L'action l'attend avant d'annoncer son succès.
   */
  const rafraichir = useCallback(async (): Promise<void> => {
    derniereActualisation.current += 1
    const numero = derniereActualisation.current
    const tableauRecharge = new Promise<void>((finir) => { attentesTableau.current.set(numero, finir) })
    setActualisation(numero)
    await Promise.all([recharger(), tableauRecharge])
  }, [recharger])
  /** « Réessayer » d'une vue en erreur : le même rechargement, sans rien à attendre. */
  const reessayerReferentiels = useCallback(() => { void rafraichir() }, [rafraichir])

  const coproprietes = tableau?.coproprietes ?? []
  const contenu = (() => {
    if (vue === 'gestionnaires' && ancre.gestionnaireId) {
      return (
        <FicheGestionnaireQr
          key={ancre.gestionnaireId} id={ancre.gestionnaireId} coproprietes={coproprietes} gestionnaires={referentiels.gestionnaires}
          onRetour={() => allerA({ vue: 'gestionnaires', gestionnaireId: null })} onModifie={rafraichir} onInformer={setDiffusionSuivi}
        />
      )
    }
    if (vue === 'gestionnaires') {
      return (
        <ListeGestionnairesQr
          gestionnaires={referentiels.gestionnaires} cabinets={referentiels.cabinets} erreur={referentiels.erreur} coproprietes={coproprietes}
          onOuvrir={(id) => allerA({ vue: 'gestionnaires', gestionnaireId: id })} onModifie={rafraichir} onReessayer={reessayerReferentiels}
          onCabinets={() => allerA({ vue: 'cabinets', gestionnaireId: null })}
        />
      )
    }
    if (vue === 'cabinets') {
      return (
        <CabinetsQr
          cabinets={referentiels.cabinets} erreur={referentiels.erreur} coproprietes={coproprietes} onModifie={rafraichir}
          onReessayer={reessayerReferentiels} onJournal={() => allerA({ vue: 'journal', gestionnaireId: null })}
        />
      )
    }
    if (vue === 'journal') return <JournalQr coproprietes={coproprietes} gestionnaires={referentiels.gestionnaires} />
    return null
  })()

  return (
    <div id="aj-signalement" lang="fr" className="flex min-h-screen bg-[#F7F4EE]">
      <aside className="hidden w-[260px] shrink-0 flex-col bg-[#0D1B2E] text-white md:flex" aria-label={E.nom}>
        <div className="flex h-20 items-center gap-3 border-b border-white/10 px-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[#C9A84C] to-[#A8842A] text-[#0D1B2E]">
            <Icone nom="qr" taille={22} />
          </div>
          <div className="min-w-0">
            <div className="font-serif text-lg leading-tight">{E.nom}</div>
            <div className="truncate text-sm font-semibold uppercase tracking-[1.5px] text-[#C9A84C]">{cabinetNom || E.marque}</div>
          </div>
        </div>
        <MenuEspaceQr entrees={entrees} vue={vue} allerA={allerAVue} disposition="lateral" />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-[#E4DDD0] bg-white px-4 py-3 md:px-9">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold uppercase tracking-[1.5px] text-[#6F5313]">{cabinetNom ? `${E.nom} · ${cabinetNom}` : E.nom}</p>
              <h1 ref={titre} tabIndex={-1} className="truncate font-serif text-xl text-[#0D1B2E] outline-none md:text-2xl">{entree.libelle}</h1>
              <p className="truncate text-sm text-[#4A5E78]">{sousTitre}</p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              {lienAdmin && <Bouton variante="discret" petit href={lienAdmin} icone="cadenas">{E.panneauAdmin}</Bouton>}
              <Bouton variante="secondaire" petit icone="deconnexion" onClick={onDeconnexion}>{E.seDeconnecter}</Bouton>
            </div>
          </div>
        </header>

        <div className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-5 md:px-9 md:pb-12">
          <div hidden={!VUES_TABLEAU_QR.includes(vue)}>
            <TableauSignalementsQr
              jeton={null} vue={vue} onTableau={setTableau} actualisation={actualisation} onActualise={surTableauActualise}
              gestion={superAdmin ? { cabinets: referentiels.cabinets, gestionnaires: referentiels.gestionnaires } : undefined}
              gestionnaire={vueGestionnaire}
            />
          </div>
          {contenu}
        </div>

        <MenuEspaceQr entrees={entreesBarreDuBasQr(role)} vue={vue} allerA={allerAVue} disposition="bas" />
      </div>
      {diffusionSuivi && (
        <FenetreDiffusionQr
          copropriete={diffusionSuivi.copropriete} profil="super_admin" contenu="message" signalementId={diffusionSuivi.signalementId}
          onFermer={fermerDiffusionSuivi} demandeFermeture={demandeFermetureSuivi} onGarde={setGardeSuivi}
        />
      )}
    </div>
  )
}

// ── Menu (barre latérale sur ordinateur, barre du bas sur téléphone) ─────────

interface PropsMenu {
  entrees: readonly EntreeMenuQr[]
  vue: VueEspaceQr
  allerA: (vue: VueEspaceQr) => void
  disposition: 'lateral' | 'bas'
}

const CLASSES_MENU = {
  lateral: {
    nav: 'flex-1 overflow-y-auto px-3 py-3',
    liste: 'space-y-1',
    lien: 'flex min-h-[44px] w-full items-center gap-3 rounded-xl border px-3 text-[15px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C9A84C]',
    actif: 'border-[#C9A84C]/40 bg-[#C9A84C]/20 text-[#F0D898]',
    inactif: 'border-transparent text-white/80 hover:bg-white/10 hover:text-white',
  },
  bas: {
    nav: 'fixed inset-x-0 bottom-0 z-40 h-16 border-t border-[#E4DDD0] bg-white md:hidden',
    liste: 'flex h-full',
    lien: 'flex h-full flex-col items-center justify-center gap-0.5 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C9A84C]',
    actif: 'text-[#6F5313]',
    inactif: 'text-[#4A5E78]',
  },
} as const

/** Entrées en liens d'ancre (clic du milieu, copie du lien) ; le clic simple change de vue sans recharger. */
function MenuEspaceQr({ entrees, vue, allerA, disposition }: Readonly<PropsMenu>) {
  const c = CLASSES_MENU[disposition]
  const surClic = (evenement: MouseEvent<HTMLAnchorElement>, cible: VueEspaceQr) => {
    if (evenement.metaKey || evenement.ctrlKey || evenement.shiftKey || evenement.button !== 0) return
    evenement.preventDefault()
    allerA(cible)
  }
  return (
    <nav className={c.nav} aria-label={E.menu}>
      <ul className={c.liste}>
        {entrees.map((e) => {
          const actif = e.vue === vue
          return (
            <li key={e.vue} className={disposition === 'bas' ? 'flex-1' : undefined}>
              <a
                href={`#${e.vue}`}
                onClick={(evenement) => surClic(evenement, e.vue)}
                aria-current={actif ? 'page' : undefined}
                className={`${c.lien} ${actif ? c.actif : c.inactif}`}
              >
                <Icone nom={ICONES_VUES[e.vue]} taille={disposition === 'bas' ? 22 : 20} />
                <span>{e.libelle}</span>
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
