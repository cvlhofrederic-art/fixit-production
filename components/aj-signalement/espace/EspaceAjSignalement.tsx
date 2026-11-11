'use client'

// ── Espace « AJ Signalement » (/fr/aj-signalement/) ───────────────────────────
//
// Espace indépendant du portail copropriétaire et de l'Administrateur judiciaire (demande de Hugo du 10/11/2026) : son
// adresse, son menu, sa connexion. La garde (useAccesEspaceQr) passe avant tout : aucune donnée n'est chargée tant que
// le rôle n'est pas vérifié. Puis la coquille : en-tête « AJ Signalement », menu (barre latérale sur ordinateur,
// barre du bas sur téléphone) construit depuis entreesMenuQr(role), une vue par ancre (#signalements : le bouton
// « retour » du navigateur fonctionne), un h1 par vue qui reçoit le focus à chaque changement, le titre d'onglet.
// Le contenu (TableauSignalementsQr) reste monté d'une vue à l'autre : un seul chargement. Socle visuel du portail
// copropriétaire (components/coproprietaire-dashboard/ui), comme les composants de components/aj-signalement/.
// Pas de <main> ici : la coquille racine en pose déjà un (#main-content).

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { Bouton, Encadre, Icone, type NomIcone } from '@/components/coproprietaire-dashboard/ui'
import TableauSignalementsQr from '@/components/aj-signalement/TableauSignalementsQr'
import { useAccesEspaceQr } from '@/components/aj-signalement/espace/useAccesEspaceQr'
import {
  TEXTES_ESPACE_QR as E, entreesMenuQr, vueApresRetourQr, vueDepuisAncreQr, type EntreeMenuQr, type RoleEspaceQr, type VueEspaceQr,
} from '@/lib/aj-signalement/acces-espace'

const ICONES_VUES: Record<VueEspaceQr, NomIcone> = {
  'tableau-de-bord': 'accueil',
  coproprietes: 'immeuble',
  signalements: 'demandes',
}

/** Page pleine des états hors espace (vérification, connexion, refus, session indisponible). */
function PagePleine({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7F4EE] px-4 py-10" lang="fr">
      <div className="w-full max-w-lg rounded-2xl border border-[#E4DDD0] bg-white p-6 shadow-sm md:p-8">{children}</div>
    </div>
  )
}

export default function EspaceAjSignalement() {
  const { etat, connexion, reessayer, seDeconnecter } = useAccesEspaceQr()

  if (etat.statut === 'autorise') {
    return <CoquilleEspaceQr role={etat.role} lienAdmin={etat.lienAdmin} onDeconnexion={() => { void seDeconnecter() }} />
  }
  if (etat.statut === 'refuse') {
    return (
      <PagePleine>
        <h1 className="text-2xl font-bold text-[#0D1B2E]">{E.refus.titre}</h1>
        <p className="mt-3 text-base text-[#4A5E78]">{E.refus.texte}</p>
        <div className="mt-6"><Bouton variante="secondaire" href="/" icone="retour" pleineLargeur>{E.refus.retour}</Bouton></div>
      </PagePleine>
    )
  }
  if (etat.statut === 'indisponible') {
    return (
      <PagePleine>
        <Encadre ton="avertissement">{E.indisponible}</Encadre>
        <div className="mt-6"><Bouton variante="principal" icone="actualiser" pleineLargeur onClick={reessayer}>{E.reessayer}</Bouton></div>
      </PagePleine>
    )
  }
  return (
    <PagePleine>
      {/* Zone d'état native (rôle status) ; <output> n'admet que du contenu phrasé : span en block, même rendu que div et p. */}
      <output className="block text-center">
        <span className="mx-auto mb-4 block h-12 w-12 animate-spin rounded-full border-4 border-[#C9A84C] border-t-transparent" />
        <span className="block text-base font-medium text-[#4A5E78]">{etat.statut === 'connexion' ? E.redirectionConnexion : E.verification}</span>
      </output>
      {etat.statut === 'connexion' && (
        <div className="mt-6"><Bouton variante="principal" href={connexion} icone="utilisateur" pleineLargeur>{E.seConnecter}</Bouton></div>
      )}
    </PagePleine>
  )
}

// ── Coquille (rôle vérifié) ──────────────────────────────────────────────────

interface PropsCoquille {
  role: RoleEspaceQr
  lienAdmin: string | null
  onDeconnexion: () => void
}

function CoquilleEspaceQr({ role, lienAdmin, onDeconnexion }: Readonly<PropsCoquille>) {
  const entrees = entreesMenuQr(role)
  const [vue, setVue] = useState<VueEspaceQr>(() => vueDepuisAncreQr(window.location.hash, role))
  const titre = useRef<HTMLHeadingElement>(null)
  // Le focus ne va au titre qu'après une navigation de l'utilisateur, jamais à l'ouverture.
  const focusAPoser = useRef(false)
  const entree = entrees.find((e) => e.vue === vue) ?? entrees[0]

  // Retour du navigateur (ou ancre modifiée à la main) : la vue suit l'ancre ; une ancre qui ne désigne aucune vue
  // (lien d'évitement « Aller au contenu principal », #main-content) laisse la vue en cours.
  useEffect(() => {
    const surRetour = () => {
      const cible = vueApresRetourQr(window.location.hash, role)
      if (!cible) return
      focusAPoser.current = true
      setVue(cible)
    }
    window.addEventListener('popstate', surRetour)
    return () => window.removeEventListener('popstate', surRetour)
  }, [role])

  useEffect(() => {
    document.title = `${entree.libelle} — ${E.nom}`
    if (focusAPoser.current) titre.current?.focus()
    focusAPoser.current = false
  }, [entree])

  const allerA = (cible: VueEspaceQr) => {
    focusAPoser.current = true
    setVue(cible)
    if (window.location.hash !== `#${cible}`) window.history.pushState(null, '', `#${cible}`)
    window.scrollTo({ top: 0 })
  }

  return (
    <div id="aj-signalement" lang="fr" className="flex min-h-screen bg-[#F7F4EE]">
      <aside className="hidden w-[260px] shrink-0 flex-col bg-[#0D1B2E] text-white md:flex" aria-label={E.nom}>
        <div className="flex h-20 items-center gap-3 border-b border-white/10 px-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[#C9A84C] to-[#A8842A] text-[#0D1B2E]">
            <Icone nom="qr" taille={22} />
          </div>
          <div className="min-w-0">
            <div className="font-serif text-lg leading-tight">{E.nom}</div>
            <div className="truncate text-sm font-semibold uppercase tracking-[1.5px] text-[#C9A84C]">{E.marque}</div>
          </div>
        </div>
        <MenuEspaceQr entrees={entrees} vue={vue} allerA={allerA} disposition="lateral" />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-[#E4DDD0] bg-white px-4 py-3 md:px-9">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold uppercase tracking-[1.5px] text-[#6F5313]">{E.nom}</p>
              <h1 ref={titre} tabIndex={-1} className="truncate font-serif text-xl text-[#0D1B2E] outline-none md:text-2xl">{entree.libelle}</h1>
              <p className="truncate text-sm text-[#4A5E78]">{entree.sousTitre}</p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              {lienAdmin && <Bouton variante="discret" petit href={lienAdmin} icone="cadenas">{E.panneauAdmin}</Bouton>}
              <Bouton variante="secondaire" petit icone="deconnexion" onClick={onDeconnexion}>{E.seDeconnecter}</Bouton>
            </div>
          </div>
        </header>

        <div className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-5 md:px-9 md:pb-12">
          <TableauSignalementsQr jeton={null} vue={vue} />
        </div>

        <MenuEspaceQr entrees={entrees} vue={vue} allerA={allerA} disposition="bas" />
      </div>
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
