import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import ModObrigPrazos from '@/components/syndic-dashboard/v54/modules/ModObrigPrazos'

/**
 * Date du jour préremplie dans les formulaires v54 (date d'émission, d'ouverture, de début…).
 * Les modules la calculaient avec new Date().toISOString().slice(0, 10), c'est-à-dire le jour UTC :
 * entre 0 h et 1 h à Lisbonne en heure d'été (2 h à Paris), le champ affichait la veille.
 * Source unique : jourCivilLocal (lib/syndic/v54/i18n/dates.ts), jour civil du navigateur.
 */

const TZ_INITIAL = process.env.TZ
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  if (TZ_INITIAL === undefined) delete process.env.TZ
  else process.env.TZ = TZ_INITIAL
})

const DOSSIER_MODULES = join(process.cwd(), 'components/syndic-dashboard/v54/modules')

describe('date du jour des formulaires v54', () => {
  // Un horodatage complet envoyé à l'API (new Date().toISOString()) reste correct : seul le jour
  // ou le mois tiré de la chaîne UTC est visé.
  it('aucun module ne tire le jour ou le mois courant de la chaîne UTC', () => {
    const fautifs = readdirSync(DOSSIER_MODULES)
      .filter((f) => f.endsWith('.tsx'))
      .filter((f) => /new Date\(\)\.toISOString\(\)\.(slice|substring|substr|split)\(/.test(readFileSync(join(DOSSIER_MODULES, f), 'utf8')))
    expect(fautifs).toEqual([])
  })

  it('Lisbonne, 0 h 30 en heure d’été : le formulaire propose le jour local, pas la veille UTC', () => {
    process.env.TZ = 'Europe/Lisbon'
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-07-01T23:30:00Z')) // 2 juillet, 0 h 30 à Lisbonne
    const { container } = render(<ModObrigPrazos />)
    fireEvent.click(screen.getAllByRole('button', { name: /Adicionar/ })[0])
    const champ = container.ownerDocument.querySelector('input[type="date"]') as HTMLInputElement | null
    expect(champ).not.toBeNull()
    expect(champ!.value).toBe('2026-07-02')
  })
})
