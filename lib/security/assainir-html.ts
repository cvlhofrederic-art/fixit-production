import DOMPurify from 'dompurify'
import { purifyHTML } from '@/lib/sanitize'

/**
 * Assainit un fragment HTML (réponse d'un agent IA, texte venu de la base) juste avant
 * `dangerouslySetInnerHTML` (lot 3 du brief sécurité Aikido du 28/10/2026, issue 20).
 *
 * Dans le navigateur : DOMPurify, profil HTML — scripts, gestionnaires d'événements, URL
 * javascript:, balises et attributs style, formulaires retirés ; le reste (balises et classes du
 * Markdown) est conservé. Pendant le pré-rendu serveur d'un composant client, DOMPurify n'a pas de
 * DOM (`isSupported` est faux) : on garde le filet de `lib/sanitize` (liste blanche de balises) pour
 * que le HTML envoyé au navigateur ne contienne rien de plus que ce que le client afficherait.
 * À n'appeler que depuis un composant client.
 */
export function assainirHtml(html: string): string {
  if (!html) return ''
  if (typeof window === 'undefined' || !DOMPurify.isSupported) return purifyHTML(html)
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    // Ni feuille de style ni formulaire dans une bulle de conversation (superposition, hameçonnage).
    FORBID_TAGS: ['style', 'form', 'input', 'button', 'textarea', 'select'],
    FORBID_ATTR: ['style'],
  })
}
