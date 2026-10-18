'use client'

// ── Socle visuel du portail copropriétaire ────────────────────────────────────
//
// Identité du tableau de bord (navy #0D1B2E, or #C9A84C, crème #F7F4EE, bordure #E4DDD0),
// mais lisible par tous : texte courant 16 px, secondaire 14 px minimum, cibles tactiles 44 px,
// contrastes ≥ 4,5:1, icônes SVG au trait toujours accompagnées d'un libellé, jamais d'emoji.
// Les cartes cliquables sont des <button> ; les choix sont des boutons radio ou aria-pressed.

import React, { useEffect, useId, useRef, type ReactNode } from 'react'

export const COULEURS = {
  navy: '#0D1B2E',
  or: '#C9A84C',
  orFonce: '#A8842A',
  creme: '#F7F4EE',
  bordure: '#E4DDD0',
  encre: '#1F2D3D',
  encre2: '#4A5E78',
  encre3: '#4A5E78',
} as const

// ── Icônes (trait 1.8, 24 × 24) ──────────────────────────────────────────────

export type NomIcone =
  | 'accueil' | 'demandes' | 'charges' | 'documents' | 'assemblees' | 'annonces' | 'informations' | 'question' | 'plus'
  | 'alerte' | 'check' | 'chevron-bas' | 'chevron-droite' | 'fermer' | 'copier' | 'ouvrir' | 'retour' | 'actualiser'
  | 'deconnexion' | 'menu' | 'envoyer' | 'telephone' | 'mail' | 'adresse' | 'calendrier' | 'outil' | 'immeuble'
  | 'euro' | 'info' | 'cadenas' | 'utilisateur' | 'horloge'

const TRACES: Record<NomIcone, ReactNode> = {
  accueil: <><path d="M3 11.5 12 4l9 7.5" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></>,
  demandes: <><path d="M4 5h16v11H9l-5 4z" /><path d="M8 9h8M8 12.5h5" /></>,
  charges: <><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 10h18" /><path d="M7 14.5h4" /></>,
  documents: <><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5" /><path d="M10 13h6M10 16.5h6" /></>,
  assemblees: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3 20a6 6 0 0 1 12 0" /><path d="M15.5 20a4.5 4.5 0 0 1 6.5-4" /></>,
  annonces: <><path d="M4 10v4h3l7 4V6l-7 4z" /><path d="M17 9.5a3.5 3.5 0 0 1 0 5" /><path d="M19.5 7a7 7 0 0 1 0 10" /></>,
  informations: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  question: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7" /><path d="M12 17h.01" /></>,
  plus: <><circle cx="6" cy="12" r="1.3" /><circle cx="12" cy="12" r="1.3" /><circle cx="18" cy="12" r="1.3" /></>,
  alerte: <><path d="M12 3 2.5 20h19z" /><path d="M12 9v5" /><path d="M12 17.5h.01" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  'chevron-bas': <path d="m6 9 6 6 6-6" />,
  'chevron-droite': <path d="m9 6 6 6-6 6" />,
  fermer: <path d="M6 6l12 12M18 6 6 18" />,
  copier: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a1 1 0 0 1 1-1h10" /></>,
  ouvrir: <><path d="M14 4h6v6" /><path d="M20 4 11 13" /><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" /></>,
  retour: <><path d="M19 12H5" /><path d="m11 6-6 6 6 6" /></>,
  actualiser: <><path d="M20 12a8 8 0 1 1-2.3-5.7" /><path d="M20 4v5h-5" /></>,
  deconnexion: <><path d="M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h5" /><path d="M15 8l4 4-4 4" /><path d="M19 12H9" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  envoyer: <><path d="M21 3 10.5 13.5" /><path d="M21 3 14 21l-3.5-7.5L3 10z" /></>,
  telephone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
  adresse: <><path d="M12 21s-7-6.5-7-11.5a7 7 0 0 1 14 0C19 14.5 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></>,
  calendrier: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18" /><path d="M8 3v4M16 3v4" /></>,
  outil: <path d="M14.5 6.5a4 4 0 0 0 5 5L9 22l-3-3L16.5 8.5A4 4 0 0 0 14.5 6.5z" />,
  immeuble: <><rect x="4" y="3" width="16" height="18" rx="1" /><path d="M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2" /><path d="M10 21v-3h4v3" /></>,
  euro: <><path d="M17 6.5A6 6 0 0 0 7.5 9M17 17.5A6 6 0 0 1 7.5 15" /><path d="M4 10.5h9M4 13.5h9" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 8h.01" /></>,
  cadenas: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  utilisateur: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  horloge: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
}

export function Icone({ nom, taille = 20, className = '' }: { nom: NomIcone; taille?: number; className?: string }) {
  return (
    <svg
      width={taille} height={taille} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" className={`shrink-0 ${className}`}
    >
      {TRACES[nom]}
    </svg>
  )
}

// ── Cartes et mise en page ───────────────────────────────────────────────────

export type TonCarte = 'neutre' | 'or' | 'vert' | 'rouge' | 'gris' | 'ambre'

const FONDS_CARTE: Record<TonCarte, string> = {
  neutre: 'bg-white border-[#E4DDD0]',
  or: 'bg-[#FBF6E9] border-[#C9A84C]',
  vert: 'bg-[#EEF7F0] border-[#7FB08A]',
  rouge: 'bg-[#FDEEEC] border-[#D98B82]',
  gris: 'bg-[#F7F4EE] border-[#E4DDD0]',
  ambre: 'bg-[#FFF6E5] border-[#E2B15A]',
}

export function Carte({
  titre, sousTitre, actions, ton = 'neutre', children, className = '', id,
}: {
  titre?: ReactNode
  sousTitre?: ReactNode
  actions?: ReactNode
  ton?: TonCarte
  children?: ReactNode
  className?: string
  id?: string
}) {
  return (
    <section id={id} className={`rounded-2xl border shadow-sm ${FONDS_CARTE[ton]} ${className}`}>
      {(titre || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 pb-3">
          <div className="min-w-0">
            {titre && <h2 className="text-lg font-bold text-[#0D1B2E] leading-snug">{titre}</h2>}
            {sousTitre && <p className="text-sm text-[#4A5E78] mt-1">{sousTitre}</p>}
          </div>
          {actions && <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>}
        </header>
      )}
      <div className={titre || actions ? 'px-5 pb-5' : 'p-5'}>{children}</div>
    </section>
  )
}

/** Ligne « étiquette : valeur » lisible, pour les détails. */
export function Ligne({ etiquette, children }: { etiquette: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-4 py-2 border-b border-[#E4DDD0] last:border-b-0">
      <dt className="text-sm text-[#4A5E78] sm:w-48 shrink-0">{etiquette}</dt>
      <dd className="text-base text-[#0D1B2E] break-words">{children}</dd>
    </div>
  )
}

// ── Boutons ──────────────────────────────────────────────────────────────────

export type VarianteBouton = 'principal' | 'or' | 'secondaire' | 'discret' | 'danger'

const STYLES_BOUTON: Record<VarianteBouton, string> = {
  principal: 'bg-[#0D1B2E] text-white hover:bg-[#152338] border border-transparent',
  or: 'bg-[#C9A84C] text-[#0D1B2E] hover:bg-[#D9BC6A] border border-transparent',
  secondaire: 'bg-white text-[#0D1B2E] border border-[#C9B99A] hover:bg-[#F7F4EE]',
  discret: 'bg-transparent text-[#0D1B2E] border border-transparent hover:bg-[#F7F4EE] underline-offset-4',
  danger: 'bg-white text-[#9B2C20] border border-[#D98B82] hover:bg-[#FDEEEC]',
}

type PropsBouton = {
  variante?: VarianteBouton
  icone?: NomIcone
  pleineLargeur?: boolean
  petit?: boolean
  children: ReactNode
  className?: string
} & (
  | ({ href: string; cible?: '_blank' } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'className' | 'children'>)
  | ({ href?: undefined } & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'>)
)

/** Bouton (ou lien stylé) de 44 px minimum, texte 16 px, focus doré visible. */
export function Bouton(props: PropsBouton) {
  const { variante = 'secondaire', icone, pleineLargeur = false, petit = false, children, className = '' } = props
  const classes = [
    'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors',
    petit ? 'min-h-[44px] px-3 text-sm' : 'min-h-[44px] px-4 text-base',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C9A84C]',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    pleineLargeur ? 'w-full' : '',
    STYLES_BOUTON[variante],
    className,
  ].join(' ')
  if (props.href !== undefined) {
    const { href, cible, variante: _v, icone: _i, pleineLargeur: _p, petit: _s, children: _c, className: _cl, ...reste } = props
    return (
      <a href={href} target={cible} rel={cible === '_blank' ? 'noopener noreferrer' : undefined} className={classes} {...reste}>
        {icone && <Icone nom={icone} taille={18} />}
        <span>{children}</span>
      </a>
    )
  }
  const { variante: _v, icone: _i, pleineLargeur: _p, petit: _s, children: _c, className: _cl, href: _h, ...reste } = props
  return (
    <button type={reste.type ?? 'button'} className={classes} {...reste}>
      {icone && <Icone nom={icone} taille={18} />}
      <span>{children}</span>
    </button>
  )
}

// ── Pastilles, encadrés, états ───────────────────────────────────────────────

export type TonBadge = 'vert' | 'ambre' | 'rouge' | 'gris' | 'bleu' | 'or'

const STYLES_BADGE: Record<TonBadge, string> = {
  vert: 'bg-[#E3F2E7] text-[#1E6B3A] border-[#9FD0AB]',
  ambre: 'bg-[#FFF1D6] text-[#7A4D00] border-[#E8C27A]',
  rouge: 'bg-[#FBE4E1] text-[#8F2419] border-[#E6A099]',
  gris: 'bg-[#EEEAE2] text-[#3F4F63] border-[#D5CCBB]',
  bleu: 'bg-[#E4EEF9] text-[#1F4E86] border-[#A8C4E6]',
  or: 'bg-[#F6ECD2] text-[#6F5313] border-[#D9BC6A]',
}

/** Statut en mots sur fond coloré, avec un repère de forme pour les daltoniens. */
export function Badge({ ton, children, className = '' }: { ton: TonBadge; children: ReactNode; className?: string }) {
  const repere = ton === 'vert' ? '✓' : ton === 'rouge' ? '!' : ton === 'ambre' ? '•' : ''
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold leading-tight ${STYLES_BADGE[ton]} ${className}`}>
      {repere && <span aria-hidden="true">{repere}</span>}
      <span>{children}</span>
    </span>
  )
}

export type TonEncadre = 'info' | 'succes' | 'erreur' | 'avertissement'

const STYLES_ENCADRE: Record<TonEncadre, { fond: string; icone: NomIcone }> = {
  info: { fond: 'bg-[#E4EEF9] border-[#A8C4E6] text-[#1F3A5F]', icone: 'info' },
  succes: { fond: 'bg-[#E3F2E7] border-[#9FD0AB] text-[#1E4D2E]', icone: 'check' },
  erreur: { fond: 'bg-[#FBE4E1] border-[#E6A099] text-[#6E1C13]', icone: 'alerte' },
  avertissement: { fond: 'bg-[#FFF1D6] border-[#E8C27A] text-[#5C3A00]', icone: 'alerte' },
}

/** Message persistant (jamais une simple notification qui s'efface). */
export function Encadre({ ton, children, role, className = '' }: { ton: TonEncadre; children: ReactNode; role?: 'alert' | 'status'; className?: string }) {
  const s = STYLES_ENCADRE[ton]
  return (
    <div role={role ?? (ton === 'erreur' ? 'alert' : 'status')} className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-base ${s.fond} ${className}`}>
      <Icone nom={s.icone} taille={22} className="mt-0.5" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

export function EtatVide({ texte, action, icone = 'info' }: { texte: ReactNode; action?: ReactNode; icone?: NomIcone }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#C9B99A] bg-[#FBF9F4] px-6 py-10 text-center">
      <Icone nom={icone} taille={32} className="mx-auto text-[#8A7B5C]" />
      <p className="mt-3 text-base text-[#4A5E78]">{texte}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  )
}

/** Montant mis en valeur. */
export function Montant({ valeur, grand = false, className = '' }: { valeur: string; grand?: boolean; className?: string }) {
  return <span className={`${grand ? 'text-2xl md:text-3xl' : 'text-xl'} font-bold tabular-nums text-[#0D1B2E] ${className}`}>{valeur}</span>
}

// ── Frise d'étapes (demandes) ────────────────────────────────────────────────

export interface EtapeFrise {
  nom: string
  etat: 'faite' | 'courante' | 'a_venir'
}

export function Frise({ etapes, label }: { etapes: EtapeFrise[]; label: string }) {
  return (
    <ol className="flex items-start gap-1" aria-label={label}>
      {etapes.map((e, i) => (
        <li key={e.nom} className="flex-1 min-w-0" aria-current={e.etat === 'courante' ? 'step' : undefined}>
          <div className="flex items-center">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold ${
                e.etat === 'faite' ? 'border-[#1E6B3A] bg-[#1E6B3A] text-white'
                  : e.etat === 'courante' ? 'border-[#C9A84C] bg-[#FBF6E9] text-[#6F5313]'
                    : 'border-[#D5CCBB] bg-white text-[#4A5E78]'
              }`}
            >
              {e.etat === 'faite' ? <Icone nom="check" taille={14} /> : i + 1}
            </span>
            {i < etapes.length - 1 && <span className={`h-0.5 flex-1 ${e.etat === 'faite' ? 'bg-[#1E6B3A]' : 'bg-[#E4DDD0]'}`} aria-hidden="true" />}
          </div>
          <span className={`mt-1 block pr-1 text-sm leading-tight ${e.etat === 'courante' ? 'font-bold text-[#0D1B2E]' : 'text-[#4A5E78]'}`}>{e.nom}</span>
        </li>
      ))}
    </ol>
  )
}

// ── Dépliant et modale ───────────────────────────────────────────────────────

/** Bloc repliable natif (details/summary), accessible au clavier. */
export function Deplie({ titre, titreOuvert, children, ouvert = false, className = '' }: { titre: ReactNode; titreOuvert?: ReactNode; children: ReactNode; ouvert?: boolean; className?: string }) {
  return (
    <details open={ouvert} className={`group rounded-xl border border-[#E4DDD0] bg-white ${className}`}>
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 px-4 py-2 text-base font-semibold text-[#0D1B2E] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C9A84C] rounded-xl">
        <span className={titreOuvert ? 'group-open:hidden' : undefined}>{titre}</span>
        {titreOuvert && <span className="hidden group-open:inline">{titreOuvert}</span>}
        <Icone nom="chevron-bas" taille={20} className="transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-4 pb-4 pt-1">{children}</div>
    </details>
  )
}

/** Fenêtre de confirmation : Échap ferme, le focus arrive sur le titre, le fond est inerte. */
export function Modale({ titre, onFermer, children, labelFermer }: { titre: ReactNode; onFermer: () => void; children: ReactNode; labelFermer: string }) {
  const idTitre = useId()
  const refTitre = useRef<HTMLHeadingElement>(null)
  const refDialogue = useRef<HTMLDivElement>(null)
  useEffect(() => {
    // Focus dans la fenêtre, piégé par Tab, rendu à l'élément d'origine à la fermeture ; fond figé.
    const origine = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const defilement = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    refTitre.current?.focus()
    const touche = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onFermer(); return }
      if (e.key !== 'Tab' || !refDialogue.current) return
      const focalisables = Array.from(refDialogue.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
      if (focalisables.length === 0) return
      const premier = focalisables[0]
      const dernier = focalisables[focalisables.length - 1]
      if (e.shiftKey && document.activeElement === premier) { e.preventDefault(); dernier.focus() }
      else if (!e.shiftKey && document.activeElement === dernier) { e.preventDefault(); premier.focus() }
    }
    // Clic sur le fond (en dehors de la fenêtre) : fermeture, sans gestionnaire sur un élément non interactif.
    const clicDehors = (e: MouseEvent) => {
      if (refDialogue.current && e.target instanceof Node && !refDialogue.current.contains(e.target)) onFermer()
    }
    document.addEventListener('keydown', touche)
    document.addEventListener('mousedown', clicDehors)
    return () => {
      document.removeEventListener('keydown', touche)
      document.removeEventListener('mousedown', clicDehors)
      document.body.style.overflow = defilement
      origine?.focus()
    }
  }, [onFermer])
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div
        ref={refDialogue}
        role="dialog" aria-modal="true" aria-labelledby={idTitre}
        className="w-full max-w-lg rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={idTitre} ref={refTitre} tabIndex={-1} className="text-xl font-bold text-[#0D1B2E] outline-none">{titre}</h2>
          <button type="button" onClick={onFermer} aria-label={labelFermer} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#4A5E78] hover:bg-[#F7F4EE]">
            <Icone nom="fermer" taille={22} />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  )
}

// ── Choix (cartes radio) ─────────────────────────────────────────────────────

export interface OptionChoix<T extends string> {
  valeur: T
  libelle: ReactNode
  description?: ReactNode
}

/** Groupe de cartes radio pleine largeur : une question, des réponses lisibles. */
export function ChoixCartes<T extends string>({
  nom, legende, options, valeur, onChange,
}: { nom: string; legende: ReactNode; options: OptionChoix<T>[]; valeur: T | ''; onChange: (v: T) => void }) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-base font-semibold text-[#0D1B2E]">{legende}</legend>
      {options.map(o => {
        const actif = o.valeur === valeur
        return (
          <label
            key={o.valeur}
            className={`flex min-h-[44px] cursor-pointer items-start gap-3 rounded-xl border-2 px-4 py-3 transition-colors ${actif ? 'border-[#C9A84C] bg-[#FBF6E9]' : 'border-[#E4DDD0] bg-white hover:border-[#C9B99A]'}`}
          >
            <input
              type="radio" name={nom} value={o.valeur} checked={actif} onChange={() => onChange(o.valeur)}
              className="mt-1 h-5 w-5 accent-[#C9A84C]"
            />
            <span className="min-w-0">
              <span className="block text-base font-medium text-[#0D1B2E]">{o.libelle}</span>
              {o.description && <span className="block text-sm text-[#4A5E78]">{o.description}</span>}
            </span>
          </label>
        )
      })}
    </fieldset>
  )
}

/** Champ de formulaire avec étiquette visible et aide. */
export function Champ({ id, etiquette, aide, erreur, children }: { id: string; etiquette: ReactNode; aide?: ReactNode; erreur?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-base font-semibold text-[#0D1B2E]">{etiquette}</label>
      {children}
      {erreur ? <p id={`${id}-aide`} role="status" className="mt-1.5 text-sm text-[#8F2419]">{erreur}</p>
        : aide ? <p id={`${id}-aide`} className="mt-1.5 text-sm text-[#4A5E78]">{aide}</p> : null}
    </div>
  )
}

export const CLASSES_SAISIE = 'w-full rounded-xl border-2 border-[#E4DDD0] bg-white px-4 py-3 text-base text-[#0D1B2E] focus:border-[#C9A84C] focus:outline-none min-h-[44px]'

/** Bouton « Copier » avec retour visible pendant deux secondes. */
export function BoutonCopier({ texte, libelle, libelleCopie }: { texte: string; libelle: string; libelleCopie: string }) {
  const [copie, setCopie] = React.useState(false)
  const copier = async () => {
    try {
      await navigator.clipboard.writeText(texte)
      setCopie(true)
      setTimeout(() => setCopie(false), 2000)
    } catch (e) {
      console.warn('[copro] copie impossible', e)
    }
  }
  return (
    <Bouton variante="secondaire" petit icone={copie ? 'check' : 'copier'} onClick={copier} aria-live="polite">
      {copie ? libelleCopie : libelle}
    </Bouton>
  )
}
