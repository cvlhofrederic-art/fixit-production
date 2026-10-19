'use client'

// ── Portail copropriétaire — coquille ─────────────────────────────────────────
//
// Huit écrans (components/coproprietaire-dashboard/ecrans/*), un seul chargement de l'espace
// (lib/coproprietaire/etat.ts : données réelles du syndic ou démonstration), une navigation simple :
// barre latérale sur ordinateur, barre d'onglets en bas sur téléphone, « Signaler un problème »
// toujours visible dans l'en-tête. L'écran courant est dans l'ancre de l'URL (#demandes) : le bouton
// « retour » du navigateur fonctionne. Aucune donnée servie n'est écrite dans le navigateur.

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocale } from '@/lib/i18n/context'
import { lienPanneauAdmin } from '@/lib/auth/panneau-admin'
import { createDynamicSection as d } from '@/lib/dashboard-section-loader'
import { seDeconnecter, useEspaceCopro, type EtatEspace } from '@/lib/coproprietaire/etat'
import { heureCourte, langueCopro, remplir, textesCopro, type EcranCopro, type TextesCopro } from '@/lib/coproprietaire/textes'
import { Bouton, Encadre, Icone, Modale, type NomIcone } from '@/components/coproprietaire-dashboard/ui'
import type { PropsEcran } from '@/components/coproprietaire-dashboard/contrat'
import type { EspaceCopro } from '@/lib/coproprietaire/types'

const ECRANS = {
  accueil: d(() => import('@/components/coproprietaire-dashboard/ecrans/EcranAccueil')),
  demandes: d(() => import('@/components/coproprietaire-dashboard/ecrans/EcranDemandes')),
  charges: d(() => import('@/components/coproprietaire-dashboard/ecrans/EcranCharges')),
  documents: d(() => import('@/components/coproprietaire-dashboard/ecrans/EcranDocuments')),
  assemblees: d(() => import('@/components/coproprietaire-dashboard/ecrans/EcranAssemblees')),
  annonces: d(() => import('@/components/coproprietaire-dashboard/ecrans/EcranAnnonces')),
  informations: d(() => import('@/components/coproprietaire-dashboard/ecrans/EcranInformations')),
  question: d(() => import('@/components/coproprietaire-dashboard/ecrans/EcranQuestion')),
} satisfies Record<EcranCopro, unknown>

const ORDRE_ECRANS: EcranCopro[] = ['accueil', 'demandes', 'charges', 'documents', 'assemblees', 'annonces', 'informations', 'question']
const ICONES: Record<EcranCopro, NomIcone> = {
  accueil: 'accueil', demandes: 'demandes', charges: 'charges', documents: 'documents',
  assemblees: 'assemblees', annonces: 'annonces', informations: 'informations', question: 'question',
}
/** Écrans réservés au propriétaire (un locataire n'est pas membre du syndicat). */
const ECRANS_PROPRIETAIRE: ReadonlySet<EcranCopro> = new Set(['charges', 'assemblees'])
/** Onglets de la barre du bas sur téléphone ; les autres écrans sont sous « Plus ». */
const ONGLETS_MOBILE: EcranCopro[] = ['accueil', 'demandes', 'charges', 'documents']

function estEcran(v: string): v is EcranCopro {
  return (ORDRE_ECRANS as string[]).includes(v)
}

/** Écran et cible lus dans l'ancre de l'URL : « #demandes » ou « #demandes/nouvelle ». */
function lireAncre(): { ecran: EcranCopro; cible?: string } {
  if (typeof window === 'undefined') return { ecran: 'accueil' }
  const [brut, ...reste] = window.location.hash.replace(/^#/, '').split('/')
  const ecran = estEcran(brut) ? brut : 'accueil'
  const cible = reste.length > 0 ? decodeURIComponent(reste.join('/')) : undefined
  return { ecran, cible }
}

// ── Pages hors espace (chargement, erreurs, accès) ───────────────────────────

function PagePleine({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7F4EE] px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border border-[#E4DDD0] bg-white p-6 shadow-sm md:p-8">{children}</div>
    </div>
  )
}

function Chargement({ t }: { t: TextesCopro }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7F4EE]" role="status">
      <div className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-[#C9A84C] border-t-transparent" />
        <p className="text-base font-medium text-[#4A5E78]">{t.commun.chargement}</p>
      </div>
    </div>
  )
}

function PageAcces({ etat, t, langue }: { etat: Exclude<EtatEspace, { statut: 'chargement' | 'pret' }>; t: TextesCopro; langue: 'fr' | 'pt' }) {
  const connexion = langue === 'pt' ? '/pt/auth/login' : '/auth/login'
  if (etat.statut === 'non_authentifie') {
    return (
      <PagePleine>
        <h1 className="text-2xl font-bold text-[#0D1B2E]">{t.shell.sessionExpiree}</h1>
        <div className="mt-6"><Bouton variante="principal" href={connexion} icone="utilisateur" pleineLargeur>{t.shell.meReconnecter}</Bouton></div>
      </PagePleine>
    )
  }
  if (etat.statut === 'role_interdit') {
    return (
      <PagePleine>
        <h1 className="text-2xl font-bold text-[#0D1B2E]">{t.shell.roleInterdit}</h1>
        <div className="mt-6"><Bouton variante="secondaire" href="/" icone="retour" pleineLargeur>{t.commun.fermer}</Bouton></div>
      </PagePleine>
    )
  }
  if (etat.statut === 'erreur') {
    return (
      <PagePleine>
        <Encadre ton="erreur">{etat.code === 'trop_de_demandes' ? t.shell.tropDeDemandes : t.shell.erreurReseau}</Encadre>
        <div className="mt-6"><Bouton variante="principal" icone="actualiser" pleineLargeur onClick={() => window.location.reload()}>{t.commun.reessayer}</Bouton></div>
      </PagePleine>
    )
  }
  // Vrai compte sans fiche activée : aucune donnée de démonstration.
  return (
    <PagePleine>
      <h1 className="text-2xl font-bold text-[#0D1B2E]">{t.shell.espaceNonActiveTitre}</h1>
      <p className="mt-3 text-base text-[#4A5E78]">{remplir(t.shell.espaceNonActive, { email: etat.email })}</p>
      <div className="mt-6 space-y-3">
        <Bouton variante="principal" href="/coproprietaire/portail" icone="demandes" pleineLargeur>{t.commun.signalerProbleme}</Bouton>
        <Bouton variante="danger" icone="deconnexion" pleineLargeur onClick={() => { void seDeconnecter() }}>{t.menu.deconnexion}</Bouton>
      </div>
    </PagePleine>
  )
}

// ── Navigation ───────────────────────────────────────────────────────────────

function BarreLaterale({
  t, espace, ecran, visibles, allerA, lienAdmin, onDeconnexion,
}: { t: TextesCopro; espace: EspaceCopro; ecran: EcranCopro; visibles: EcranCopro[]; allerA: (e: EcranCopro) => void; lienAdmin: string | null; onDeconnexion: () => void }) {
  const initiales = `${espace.profil.prenom.charAt(0)}${espace.profil.nom.charAt(0)}`.toUpperCase() || '·'
  return (
    <aside className="hidden md:flex w-[260px] shrink-0 flex-col bg-[#0D1B2E] text-white" aria-label={t.menu.menu}>
      <div className="flex h-20 items-center gap-3 border-b border-white/10 px-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[#C9A84C] to-[#A8842A] font-serif text-lg font-semibold text-[#0D1B2E]">V</div>
        <div className="min-w-0">
          <div className="font-serif text-lg leading-tight">VitFix Copro</div>
          <div className="truncate text-sm font-semibold uppercase tracking-[1.5px] text-[#C9A84C]">{espace.immeuble.nom}</div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-3" aria-label={t.menu.menu}>
        <ul className="space-y-1">
          {visibles.map(e => {
            const actif = e === ecran
            return (
              <li key={e}>
                <button
                  type="button"
                  onClick={() => allerA(e)}
                  aria-current={actif ? 'page' : undefined}
                  className={`flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C9A84C] ${
                    actif ? 'bg-[#C9A84C]/20 text-[#F0D898] border border-[#C9A84C]/40' : 'text-white/80 hover:bg-white/10 hover:text-white border border-transparent'
                  }`}
                >
                  <Icone nom={ICONES[e]} taille={20} />
                  <span>{t.menu[e]}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#C9A84C] to-[#A8842A] text-sm font-bold text-[#0D1B2E]">{initiales}</div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-white">{espace.profil.prenom} {espace.profil.nom}</div>
            <div className="truncate text-sm text-[#C9A84C]">{t.commun.lot} {espace.profil.numLot}{espace.profil.batiment ? ` · ${t.commun.batiment} ${espace.profil.batiment}` : ''}</div>
          </div>
        </div>
        {lienAdmin && (
          <a href={lienAdmin} className="flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm text-white/80 hover:bg-white/10 hover:text-white">
            <Icone nom="cadenas" taille={18} /><span>{t.menu.panneauAdmin}</span>
          </a>
        )}
        <button type="button" onClick={onDeconnexion} className="flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 text-sm text-white/80 hover:bg-[#C0392B]/30 hover:text-white">
          <Icone nom="deconnexion" taille={18} /><span>{t.menu.deconnexion}</span>
        </button>
      </div>
    </aside>
  )
}

function BarreMobile({ t, ecran, visibles, allerA, onPlus }: { t: TextesCopro; ecran: EcranCopro; visibles: EcranCopro[]; allerA: (e: EcranCopro) => void; onPlus: () => void }) {
  const onglets = ONGLETS_MOBILE.filter(e => visibles.includes(e))
  const dansPlus = !onglets.includes(ecran)
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex h-16 border-t border-[#E4DDD0] bg-white md:hidden" aria-label={t.menu.menu}>
      {onglets.map(e => {
        const actif = e === ecran
        return (
          <button
            key={e} type="button" onClick={() => allerA(e)} aria-current={actif ? 'page' : undefined}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-sm font-semibold ${actif ? 'text-[#6F5313]' : 'text-[#4A5E78]'}`}
          >
            <Icone nom={ICONES[e]} taille={22} />
            <span className="leading-tight">{(t.menu.court as Record<string, string>)[e] ?? t.menu[e]}</span>
          </button>
        )
      })}
      <button type="button" onClick={onPlus} aria-haspopup="dialog" className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-sm font-semibold ${dansPlus ? 'text-[#6F5313]' : 'text-[#4A5E78]'}`}>
        <Icone nom="plus" taille={22} />
        <span>{t.menu.plus}</span>
      </button>
    </nav>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CoproprietaireDashboard() {
  const locale = useLocale()
  const langue = langueCopro(locale)
  const t = useMemo(() => textesCopro(locale), [locale])
  const { etat, rafraichir, changerLot, jeton, metadonnees } = useEspaceCopro()

  const [navigation, setNavigation] = useState<{ ecran: EcranCopro; cible?: string }>({ ecran: 'accueil' })
  // Incrémenté à chaque navigation volontaire : l'écran est remonté, donc une cible identique
  // (ex. « nouvelle » deux fois de suite) rouvre bien le formulaire.
  const [cleNavigation, setCleNavigation] = useState(0)
  const [menuPlus, setMenuPlus] = useState(false)
  const [confirmerDeconnexion, setConfirmerDeconnexion] = useState(false)

  // Écran courant ↔ ancre de l'URL (retour du navigateur).
  useEffect(() => {
    setNavigation(lireAncre())
    const surRetour = () => setNavigation(lireAncre())
    window.addEventListener('popstate', surRetour)
    return () => window.removeEventListener('popstate', surRetour)
  }, [])

  const allerA = useCallback((ecran: EcranCopro, cible?: string) => {
    if (cible?.startsWith('lot:')) {
      void changerLot(cible.slice(4))
      return
    }
    setNavigation({ ecran, cible })
    setCleNavigation(c => c + 1)
    setMenuPlus(false)
    const ancre = `#${ecran}${cible ? `/${encodeURIComponent(cible)}` : ''}`
    if (window.location.hash !== ancre) window.history.pushState(null, '', ancre)
    window.scrollTo({ top: 0 })
  }, [changerLot])

  if (etat.statut === 'chargement') return <Chargement t={t} />
  if (etat.statut !== 'pret') return <PageAcces etat={etat} t={t} langue={langue} />

  const { espace } = etat
  const locataire = espace.profil.role === 'locataire'
  const visibles = ORDRE_ECRANS.filter(e => !locataire || !ECRANS_PROPRIETAIRE.has(e))
  const ecran: EcranCopro = visibles.includes(navigation.ecran) ? navigation.ecran : 'accueil'
  const Ecran = ECRANS[ecran]
  const lienAdmin = lienPanneauAdmin(metadonnees ?? undefined)
  const heure = heureCourte(etat.miseAJourLe, langue)

  const propsEcran: PropsEcran = {
    espace, t, langue, jeton, allerA, cible: navigation.cible, rafraichir, miseAJourLe: etat.miseAJourLe,
  }

  const bandeauDemo = espace.source === 'demo'
    ? (espace.vueSuperAdmin ? remplir(t.shell.demoSuperAdmin, { nom: `${espace.profil.prenom} ${espace.profil.nom}` }) : t.shell.demoVisiteur)
    : espace.vueSuperAdmin ? remplir(t.shell.vueSuperAdminReelle, { nom: `${espace.profil.prenom} ${espace.profil.nom}` }) : null

  return (
    <div id="copro-dashboard" className="flex min-h-screen bg-[#F7F4EE]">
      <BarreLaterale t={t} espace={espace} ecran={ecran} visibles={visibles} allerA={allerA} lienAdmin={lienAdmin} onDeconnexion={() => setConfirmerDeconnexion(true)} />

      <div className="flex min-w-0 flex-1 flex-col">
        {bandeauDemo && (
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-[#FFF1D6] px-4 py-2 text-center text-[15px] font-medium text-[#5C3A00]" role="status">
            <span>{bandeauDemo}</span>
            {!jeton && <a href={langue === 'pt' ? '/pt/auth/login' : '/auth/login'} className="font-bold underline underline-offset-4">{t.shell.seConnecter}</a>}
          </div>
        )}

        <header className="sticky top-0 z-30 border-b border-[#E4DDD0] bg-white px-4 py-3 md:px-9">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate font-serif text-xl text-[#0D1B2E] md:text-2xl">{t.menu[ecran]}</h1>
              <p className="truncate text-sm text-[#4A5E78]">{t.sousTitres[ecran]}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {espace.autresLots.length > 0 && (
                <label className="hidden items-center gap-2 text-sm text-[#4A5E78] lg:flex">
                  <span>{t.commun.lotAffiche}</span>
                  <select
                    value={espace.profil.id}
                    onChange={e => { void changerLot(e.target.value) }}
                    className="min-h-[44px] rounded-xl border-2 border-[#E4DDD0] bg-white px-3 text-base text-[#0D1B2E]"
                  >
                    <option value={espace.profil.id}>{espace.profil.immeuble} · {t.commun.lot} {espace.profil.numLot}</option>
                    {espace.autresLots.map(l => <option key={l.id} value={l.id}>{l.immeuble} · {t.commun.lot} {l.numLot}</option>)}
                  </select>
                </label>
              )}
              <Bouton variante="or" icone="demandes" onClick={() => allerA('demandes', 'nouvelle')} className="whitespace-nowrap">
                <span className="hidden sm:inline">{t.commun.signalerProbleme}</span>
                <span className="sm:hidden">{t.commun.signalerProbleme.split(' ')[0]}</span>
              </Bouton>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-40 pt-5 md:px-9 md:pb-12">
          {etat.miseAJourImpossible && (
            <Encadre ton="avertissement" className="mb-4">{remplir(t.commun.miseAJourImpossible, { heure })}</Encadre>
          )}
          <Ecran key={`${ecran}-${cleNavigation}`} {...propsEcran} />
          <p className="mt-8 flex flex-wrap items-center justify-between gap-3 text-sm text-[#4A5E78]">
            <span>{remplir(t.commun.derniereMiseAJour, { heure })}</span>
            <Bouton variante="discret" petit icone="actualiser" onClick={() => { void rafraichir() }}>{t.commun.mettreAJour}</Bouton>
          </p>
        </main>

        {ecran !== 'question' && !(ecran === 'demandes' || ecran === 'assemblees') && (
          <button
            type="button"
            onClick={() => allerA('question')}
            className="fixed bottom-20 right-4 z-30 flex min-h-[48px] items-center gap-2 rounded-full bg-[#C9A84C] px-5 text-base font-bold text-[#0D1B2E] shadow-xl hover:bg-[#D9BC6A] md:bottom-6 md:right-6"
          >
            <Icone nom="question" taille={22} />
            <span>{t.commun.besoinAide}</span>
          </button>
        )}
        {(ecran === 'demandes' || ecran === 'assemblees') && (
          <button
            type="button"
            onClick={() => allerA('question')}
            className="fixed bottom-6 right-6 z-30 hidden min-h-[48px] items-center gap-2 rounded-full bg-[#C9A84C] px-5 text-base font-bold text-[#0D1B2E] shadow-xl hover:bg-[#D9BC6A] md:flex"
          >
            <Icone nom="question" taille={22} />
            <span>{t.commun.besoinAide}</span>
          </button>
        )}

        <BarreMobile t={t} ecran={ecran} visibles={visibles} allerA={allerA} onPlus={() => setMenuPlus(true)} />
      </div>

      {menuPlus && (
        <Modale titre={t.menu.plus} onFermer={() => setMenuPlus(false)} labelFermer={t.menu.fermerMenu}>
          <ul className="space-y-2">
            {visibles.filter(e => !ONGLETS_MOBILE.includes(e)).map(e => (
              <li key={e}>
                <button type="button" onClick={() => allerA(e)} className="flex min-h-[48px] w-full items-center gap-3 rounded-xl border border-[#E4DDD0] px-4 text-base font-medium text-[#0D1B2E] hover:bg-[#F7F4EE]">
                  <Icone nom={ICONES[e]} taille={22} /><span>{t.menu[e]}</span>
                </button>
              </li>
            ))}
            {espace.autresLots.length > 0 && (
              <li>
                <label className="block text-sm text-[#4A5E78]">
                  {t.commun.lotAffiche}
                  <select value={espace.profil.id} onChange={e => { void changerLot(e.target.value) }} className="mt-1 min-h-[44px] w-full rounded-xl border-2 border-[#E4DDD0] bg-white px-3 text-base text-[#0D1B2E]">
                    <option value={espace.profil.id}>{espace.profil.immeuble} · {t.commun.lot} {espace.profil.numLot}</option>
                    {espace.autresLots.map(l => <option key={l.id} value={l.id}>{l.immeuble} · {t.commun.lot} {l.numLot}</option>)}
                  </select>
                </label>
              </li>
            )}
            {lienAdmin && (
              <li><a href={lienAdmin} className="flex min-h-[48px] items-center gap-3 rounded-xl border border-[#E4DDD0] px-4 text-base font-medium text-[#0D1B2E]"><Icone nom="cadenas" taille={22} /><span>{t.menu.panneauAdmin}</span></a></li>
            )}
            <li>
              <button type="button" onClick={() => { setMenuPlus(false); setConfirmerDeconnexion(true) }} className="flex min-h-[48px] w-full items-center gap-3 rounded-xl border border-[#D98B82] px-4 text-base font-medium text-[#9B2C20]">
                <Icone nom="deconnexion" taille={22} /><span>{t.menu.deconnexion}</span>
              </button>
            </li>
          </ul>
        </Modale>
      )}

      {confirmerDeconnexion && (
        <Modale titre={t.informations.confirmationDeconnexion} onFermer={() => setConfirmerDeconnexion(false)} labelFermer={t.commun.fermer}>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Bouton variante="danger" icone="deconnexion" onClick={() => { void seDeconnecter() }} className="flex-1">{t.informations.meDeconnecter}</Bouton>
            <Bouton variante="secondaire" onClick={() => setConfirmerDeconnexion(false)} className="flex-1">{t.informations.rester}</Bouton>
          </div>
        </Modale>
      )}
    </div>
  )
}
