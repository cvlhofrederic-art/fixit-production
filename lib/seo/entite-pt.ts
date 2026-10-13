// Entité légale VITFIX au Portugal : source unique pour le JSON-LD (nœud `#business`),
// les pages légales et les pages de contact. Phase 1 du plan SEO PT (13/10/2026).
//
// Adresse postale fournie par le propriétaire le 13/10/2026. NIF : lib/constants.ts.
// Aucun établissement dans les 22 concelhos couverts : les pages métier x ville décrivent
// un `Service` avec `areaServed`, jamais un `LocalBusiness` par ville.

import { CONTACT_EMAIL, PHONE_PT, PT_NIF_EMPRESA } from '@/lib/constants'

export const ENTITE_PT = {
  /** Identifiant du nœud entreprise commun à tout le site (app/layout.tsx). */
  id: 'https://vitfix.io/#business',
  nome: 'VITFIX',
  legalName: 'VITFIX — Empresário em Nome Individual',
  nif: PT_NIF_EMPRESA,
  taxID: `PT${PT_NIF_EMPRESA}`,
  telephone: PHONE_PT,
  email: CONTACT_EMAIL,
  url: 'https://vitfix.io',
  adresse: {
    '@type': 'PostalAddress',
    streetAddress: 'Av. Dr. Artur Melo e Castro 109',
    postalCode: '4630-204',
    addressLocality: 'Marco de Canaveses',
    addressRegion: 'Porto',
    addressCountry: 'PT',
  },
} as const

/** Adresse sur une ligne, pour les pages légales et de contact. */
export const ADRESSE_PT_TEXTE = `${ENTITE_PT.adresse.streetAddress}, ${ENTITE_PT.adresse.postalCode} ${ENTITE_PT.adresse.addressLocality}`

/** Numéro affiché (+351 912 014 971). */
export const TELEFONE_PT_TEXTE = PHONE_PT.replace(/^\+351(\d{3})(\d{3})(\d{3})$/, '+351 $1 $2 $3')
