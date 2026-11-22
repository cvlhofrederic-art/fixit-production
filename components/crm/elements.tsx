// ── CRM du secrétariat : petits éléments partagés par les panneaux ──────────

import type { ReactNode } from 'react'
import { Mail, MessageCircle, Phone, PhoneMissed } from 'lucide-react'
import type { CanalCrm } from '@/lib/crm/types'

/** Pastille de choix (motif, canal, statut, priorité) : bouton à bascule, état lu par aria-pressed. */
export function Pastille({
  actif,
  onClick,
  children,
  ton = 'neutre',
}: Readonly<{
  actif: boolean
  onClick: () => void
  children: ReactNode
  ton?: 'neutre' | 'danger'
}>) {
  // Couleurs Vitfix : choix actif en jaune #FFD600 avec texte noir ; urgence en rouge.
  const couleurActive = ton === 'danger' ? 'border-red-500 bg-red-50 font-medium text-red-700' : 'border-yellow bg-yellow font-medium text-dark'
  return (
    <button
      type="button"
      aria-pressed={actif}
      onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${actif ? couleurActive : 'border-v22-border bg-white text-gray-700 hover:bg-warm-gray'}`}
    >
      {children}
    </button>
  )
}

export function Etiquette({ children, ton }: Readonly<{ children: ReactNode; ton: 'danger' | 'info' | 'attente' | 'neutre' }>) {
  const couleurs = {
    danger: 'bg-red-50 text-red-700',
    info: 'bg-blue-50 text-blue-700',
    attente: 'bg-amber-50 text-amber-800',
    neutre: 'bg-gray-100 text-gray-600',
  }
  return <span className={`inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-xs ${couleurs[ton]}`}>{children}</span>
}

export function IconeCanal({ canal }: Readonly<{ canal: CanalCrm }>) {
  const classe = 'h-3.5 w-3.5 shrink-0'
  if (canal === 'whatsapp') return <MessageCircle className={classe} aria-hidden="true" />
  if (canal === 'appel_manque') return <PhoneMissed className={classe} aria-hidden="true" />
  if (canal === 'email') return <Mail className={classe} aria-hidden="true" />
  return <Phone className={classe} aria-hidden="true" />
}

// Charte Vitfix (app/globals.css, @theme) : jaune #FFD600 (yellow), noir #111110 (dark), fond #F7F7F5 (v22-bg),
// bordures #E8E8E4 (v22-border). Le contour de focus reste noir : le jaune sur blanc ne se voit pas assez.
export const CLASSE_CHAMP =
  'w-full rounded-lg border border-v22-border-dark bg-white px-3 py-2 text-sm text-dark placeholder:text-gray-400 focus:border-dark focus:outline-none focus:ring-1 focus:ring-dark'
export const CLASSE_BOUTON_PRINCIPAL =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-yellow px-4 py-2 text-sm font-semibold text-dark hover:bg-yellow-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dark focus-visible:ring-offset-2 disabled:opacity-60'
export const CLASSE_BOUTON_SECONDAIRE =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-v22-border-dark bg-white px-3 py-2 text-sm text-dark hover:bg-warm-gray disabled:opacity-60'
/** Bouton discret posé sur la barre noire du haut. */
export const CLASSE_BOUTON_SUR_SOMBRE =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-white/25 px-3 py-2 text-sm text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow'

/** Instant ISO → valeur d'un champ datetime-local (heure locale du navigateur), et retour. */
export function versChampDateHeure(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (!Number.isFinite(date.getTime())) return ''
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

export function depuisChampDateHeure(valeur: string): string | null {
  if (valeur === '') return null
  const date = new Date(valeur)
  return Number.isFinite(date.getTime()) ? date.toISOString() : null
}
