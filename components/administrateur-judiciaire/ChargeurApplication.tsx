'use client'

import dynamic from 'next/dynamic'

/**
 * Charge l'application uniquement dans le navigateur : elle s'appuie sur IndexedDB,
 * localStorage et l'ancre d'URL, comme la maquette d'origine.
 */
const AdministrateurJudiciaireApp = dynamic(() => import('./AdministrateurJudiciaireApp'), {
  ssr: false,
})

export default function ChargeurApplication() {
  return <AdministrateurJudiciaireApp />
}
