// tests/api/syndic-supabase-memoire.ts
//
// Faux client Supabase en mémoire pour les routes syndic : chaque appel `from(table)` est journalisé
// (opération, données envoyées, filtres eq / in / gte), les SELECT lisent des lignes posées par le test et
// sont filtrés par les eq / in / gte comme en base, les INSERT renvoient un id `<table>-nouveau`.

import { vi } from 'vitest'

export interface AppelSupabase {
  table: string
  op: 'select' | 'insert' | 'update' | 'delete'
  donnees?: unknown
  eq: Array<[string, unknown]>
  in: Array<[string, unknown[]]>
  /** Filtres gte (comparaison de chaînes : dates ISO). */
  gte: Array<[string, unknown]>
  colonnes?: string
}

export interface BaseMemoire {
  appels: AppelSupabase[]
  lignes: Record<string, Array<Record<string, unknown>>>
  /** Erreur forcée par « table.op » (ex. 'syndic_missions.insert'). */
  erreurs: Record<string, { message: string }>
  /** Données renvoyées par un INSERT … select().single() (par défaut { id: '<table>-nouveau' }). */
  inserts: Record<string, Record<string, unknown>>
}

export function nouvelleBase(): BaseMemoire {
  return { appels: [], lignes: {}, erreurs: {}, inserts: {} }
}

export function clientMemoire(base: BaseMemoire) {
  const from = vi.fn((table: string) => {
    const appel: AppelSupabase = { table, op: 'select', eq: [], in: [], gte: [] }
    base.appels.push(appel)
    let tri: { col: string; asc: boolean } | null = null
    const lignesFiltrees = () => {
      const l = (base.lignes[table] ?? []).filter((r) =>
        appel.eq.every(([c, v]) => r[c] === v) && appel.in.every(([c, vs]) => vs.includes(r[c]))
        && appel.gte.every(([c, v]) => String(r[c] ?? '') >= String(v)))
      if (!tri) return l
      const { col, asc } = tri
      return [...l].sort((a, b) => String(a[col] ?? '').localeCompare(String(b[col] ?? '')) * (asc ? 1 : -1))
    }
    const resultat = (unique: boolean) => {
      const erreur = base.erreurs[`${table}.${appel.op}`]
      if (erreur) return { data: null, error: erreur }
      if (appel.op === 'insert') {
        const d = base.inserts[table] ?? { id: `${table}-nouveau` }
        return { data: unique ? d : [d], error: null }
      }
      if (appel.op === 'update' || appel.op === 'delete') return { data: null, error: null }
      const l = lignesFiltrees()
      return { data: unique ? l[0] ?? null : l, error: null }
    }
    const q: Record<string, unknown> = {}
    q.select = vi.fn((colonnes?: string) => { if (appel.op === 'select') appel.colonnes = colonnes; return q })
    for (const m of ['limit', 'is', 'neq']) q[m] = vi.fn(() => q)
    q.order = vi.fn((col: string, opts?: { ascending?: boolean }) => { tri = { col, asc: opts?.ascending !== false }; return q })
    q.eq = vi.fn((c: string, v: unknown) => { appel.eq.push([c, v]); return q })
    q.in = vi.fn((c: string, vs: unknown[]) => { appel.in.push([c, vs]); return q })
    q.gte = vi.fn((c: string, v: unknown) => { appel.gte.push([c, v]); return q })
    q.insert = vi.fn((d: unknown) => { appel.op = 'insert'; appel.donnees = d; return q })
    q.update = vi.fn((d: unknown) => { appel.op = 'update'; appel.donnees = d; return q })
    q.delete = vi.fn(() => { appel.op = 'delete'; return q })
    q.maybeSingle = vi.fn(async () => resultat(true))
    q.single = vi.fn(async () => resultat(true))
    q.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(resultat(false)).then(ok, ko)
    return q
  })
  return { from }
}

/** Appels d'une table / opération donnée. */
export const appelsDe = (base: BaseMemoire, table: string, op?: AppelSupabase['op']) =>
  base.appels.filter((a) => a.table === table && (!op || a.op === op))
