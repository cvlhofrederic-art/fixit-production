import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(price: number) {
  // Chiffres ronds : pas de décimales si le prix est entier (ex: 60 € au lieu de 60,00 €)
  const isRound = price === Math.floor(price)
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: isRound ? 0 : 2,
    maximumFractionDigits: isRound ? 0 : 2,
  }).format(price)
}

export function formatDate(date: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'long'
  }).format(new Date(date))
}

/**
 * Génère un slug URL-safe depuis un nom (company_name)
 * "Lepore Sebastien" → "leporesebastien"
 * "Électricité Martin & Fils" → "electricitemartinfils"
 */
export function generateSlug(name: string): string {
  return name
    .normalize('NFD')                     // décompose les accents
    .replace(/[\u0300-\u036f]/g, '')      // supprime les diacritiques
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')            // garde uniquement alphanumérique
    .substring(0, 50)                     // max 50 chars
}
