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
