'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { V54_LOCALE_PAR_DEFAUT, type V54Locale } from './locale'

const V54LocaleContext = createContext<V54Locale>(V54_LOCALE_PAR_DEFAUT)

/** Fournit la langue du dashboard v54 à tous les écrans (posé par app/syndic/v54/layout.tsx). */
export function V54LocaleProvider({ locale, children }: Readonly<{ locale: V54Locale; children: ReactNode }>) {
  return <V54LocaleContext.Provider value={locale}>{children}</V54LocaleContext.Provider>
}

/** Langue courante du dashboard v54 ('pt-PT' sans fournisseur). */
export const useV54Locale = (): V54Locale => useContext(V54LocaleContext)
