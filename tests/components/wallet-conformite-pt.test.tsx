// tests/components/wallet-conformite-pt.test.tsx
//
// Module « Conformidade » (components/dashboard/WalletConformiteSection.tsx, partagé artisan / société BTP) en
// portugais : documents portugais à la place du jeu français, documents déjà déposés toujours visibles, typographie
// portugaise, badge « OBRIGATÓRIO » (rapport i18n PT-PT du 17/11/2026). Le français reste inchangé, badge compris : il
// suit le nom sans espace dans le texte, la marge du badge les sépare à l'écran.

import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'

const etat = vi.hoisted(() => ({ locale: 'pt' as 'pt' | 'fr' }))

// Vraies traductions : le test voit ce que l'utilisateur lit.
vi.mock('@/lib/i18n/context', async () => {
  const pt = (await import('@/locales/pt.json')).default as Record<string, unknown>
  const fr = (await import('@/locales/fr.json')).default as Record<string, unknown>
  const lire = (dico: Record<string, unknown>, cle: string) => {
    const valeur = cle.split('.').reduce<unknown>((v, k) => (v && typeof v === 'object' ? (v as Record<string, unknown>)[k] : undefined), dico)
    return typeof valeur === 'string' ? valeur : cle
  }
  return {
    useTranslation: () => ({ t: (cle: string) => lire(etat.locale === 'pt' ? pt : fr, cle) }),
    useLocale: () => etat.locale,
  }
})
vi.mock('@/lib/supabase', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: null } }) } } }))

import WalletConformiteSection from '@/components/dashboard/WalletConformiteSection'
import type { Artisan } from '@/lib/types'

const societe = { id: 'soc-1', company_name: 'Obras Essai Lda', categories: ['maconnerie'], legal_form: 'Lda' } as unknown as Artisan
const artisanEni = { id: 'art-1', company_name: 'Rui Essai', categories: ['nettoyage'], legal_form: 'ENI' } as unknown as Artisan

const texte = () => (document.body.textContent ?? '').replace(/\s/g, ' ')

beforeEach(() => {
  localStorage.clear()
  etat.locale = 'pt'
})
afterEach(() => cleanup())

describe('Conformidade en portugais', () => {
  it('société BTP : documents portugais, validités, badge, rien de français', () => {
    render(<WalletConformiteSection artisan={societe} orgRole="pro_societe" />)
    const t = texte()
    expect(t).toContain('Conformidade regulamentar')
    expect(t).toContain('Certidão permanente do registo comercialOBRIGATÓRIO')
    expect(t).toContain('Declaração de situação contributiva (Segurança Social)')
    expect(t).toContain('Certidão de situação tributária regularizada (Finanças)')
    expect(t).toContain('Seguro de acidentes de trabalho')
    expect(t).toContain('Alvará ou certificado de empreiteiro (IMPIC)')
    expect(t).toContain('Pacto social (estatutos)')
    expect(t).toContain('Validade: 4 meses')
    expect(t).toContain('Enviar o dossier')
    expect(t).not.toMatch(/Kbis|URSSAF|Statuts|Attestation|Extrait|Validité|Validade :|dossiê|DGFiP|Décennale/)
    // Liens « Obter » : sites officiels portugais seulement.
    const liens = [...document.querySelectorAll('a[href]')].map(a => new URL(a.getAttribute('href') ?? '').hostname)
    expect(liens.length).toBeGreaterThan(0)
    for (const hote of liens) expect(hote).toMatch(/(^|\.)(gov\.pt|portaldasfinancas\.gov\.pt|impic\.pt)$/)
  })

  it('artisan en nom individuel (nettoyage) : déclaration de début d’activité, ni IMPIC ni pacte social', () => {
    render(<WalletConformiteSection artisan={artisanEni} orgRole="artisan" />)
    const t = texte()
    expect(t).toContain('Declaração de início de atividadeOBRIGATÓRIO')
    expect(t).not.toContain('Certidão permanente')
    expect(t).not.toContain('IMPIC')
    expect(t).not.toContain('Pacto social')
  })

  it('un document déjà déposé reste à sa place (case reprise) ou visible (case française absente de la liste)', () => {
    localStorage.setItem(`fixit_wallet_${societe.id}`, JSON.stringify({
      kbis: { url: 'https://exemple.supabase.co/storage/v1/object/public/a/certidao.pdf', name: 'certidao.pdf' },
      decennale: { url: 'https://exemple.supabase.co/storage/v1/object/public/a/apolice.pdf', name: 'apolice.pdf' },
    }))
    render(<WalletConformiteSection artisan={societe} orgRole="pro_societe" />)
    const lignes = [...document.querySelectorAll('.v5-w-doc')].map(l => (l.textContent ?? '').replace(/\s/g, ' '))
    expect(lignes.find(l => l.includes('Certidão permanente do registo comercial'))).toContain('Válido')
    expect(lignes.find(l => l.includes('Outro documento carregado: apolice.pdf'))).toContain('Válido')
  })
})

describe('Conformité en français (inchangée)', () => {
  it('jeu français, typographie française', () => {
    etat.locale = 'fr'
    render(<WalletConformiteSection artisan={societe} orgRole="pro_societe" />)
    const t = texte()
    expect(t).toContain('Conformité réglementaire')
    expect(t).toContain('Extrait Kbis / RNEOBLIGATOIRE')
    expect(t).toContain('Attestation de vigilance URSSAF')
    expect(t).toContain('Statuts de la société')
    expect(t).toContain('Validité : 3 mois')
    expect(t).not.toContain('Outro documento')
  })
})
