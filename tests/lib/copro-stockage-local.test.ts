import { describe, it, expect, beforeEach } from 'vitest'
import { PROFILE_DEMO } from '@/lib/copro-demo-data'
import { oublierDonneesDemoPerimees, VERSION_DONNEES_COPRO } from '@/lib/copro-stockage-local'

/**
 * Espace copropriétaire : les données de démo ont été redatées (octobre 2026). Les copies locales d'une version
 * antérieure sont oubliées une fois, profil et paramètres conservés.
 */
describe('oublierDonneesDemoPerimees', () => {
  beforeEach(() => localStorage.clear())

  it('supprime les données datées d’une version antérieure, garde profil et paramètres', () => {
    localStorage.setItem('fixit_copro_ags_u1', '[{"date":"2026-04-15"}]')
    localStorage.setItem('fixit_copro_echeances_u1', '[]')
    localStorage.setItem('fixit_copro_profile_u1', JSON.stringify({ ...PROFILE_DEMO, id: 'profil-u1' }))
    localStorage.setItem('fixit_copro_params_u1', '{"theme":"clair"}')
    localStorage.setItem('fixit_interventions_copro_profil-u1', '[]')

    oublierDonneesDemoPerimees('u1')

    expect(localStorage.getItem('fixit_copro_ags_u1')).toBeNull()
    expect(localStorage.getItem('fixit_copro_echeances_u1')).toBeNull()
    expect(localStorage.getItem('fixit_interventions_copro_profil-u1')).toBeNull()
    expect(localStorage.getItem('fixit_copro_profile_u1')).not.toBeNull()
    expect(localStorage.getItem('fixit_copro_params_u1')).toBe('{"theme":"clair"}')
    expect(localStorage.getItem('fixit_copro_version_u1')).toBe(VERSION_DONNEES_COPRO)
  })

  it('une seule purge : les données enregistrées ensuite sont conservées', () => {
    oublierDonneesDemoPerimees('u1')
    localStorage.setItem('fixit_copro_ags_u1', '[{"vote":"pour"}]')
    oublierDonneesDemoPerimees('u1')
    expect(localStorage.getItem('fixit_copro_ags_u1')).toBe('[{"vote":"pour"}]')
  })

  it('version « -b » déjà notée : nouvelle purge, avec le nouvel immeuble de démo', () => {
    expect(VERSION_DONNEES_COPRO).toBe('2026-10-c')
    localStorage.setItem('fixit_copro_version_u3', '2026-10-b')
    localStorage.setItem('fixit_copro_ags_u3', '[{"lieu":"Salle polyvalente, 12 rue des Acacias, Marseille 8e"}]')
    oublierDonneesDemoPerimees('u3')
    expect(localStorage.getItem('fixit_copro_ags_u3')).toBeNull()
    expect(localStorage.getItem('fixit_copro_version_u3')).toBe('2026-10-c')
  })

  it('profil local encore sur la Résidence Les Acacias : remplacé par le profil de démo (Résidence Le Prado)', () => {
    expect(PROFILE_DEMO.immeuble).toBe('Résidence Le Prado')
    localStorage.setItem('fixit_copro_version_u4', '2026-10-b')
    localStorage.setItem('fixit_copro_profile_u4', JSON.stringify({ ...PROFILE_DEMO, id: 'profil-u4', immeuble: 'Résidence Les Acacias' }))
    localStorage.setItem('fixit_interventions_copro_profil-u4', '[]')
    localStorage.setItem('fixit_copro_params_u4', '{"notifEmail":false}')

    oublierDonneesDemoPerimees('u4')

    expect(localStorage.getItem('fixit_copro_profile_u4')).toBeNull()
    expect(localStorage.getItem('fixit_interventions_copro_profil-u4')).toBeNull()
    expect(localStorage.getItem('fixit_copro_params_u4')).toBe('{"notifEmail":false}')
  })

  it('profil local sur un autre immeuble (saisi par l’utilisateur) : conservé', () => {
    const profil = JSON.stringify({ ...PROFILE_DEMO, id: 'profil-u5', immeuble: 'Résidence Castellane' })
    localStorage.setItem('fixit_copro_profile_u5', profil)
    oublierDonneesDemoPerimees('u5')
    expect(localStorage.getItem('fixit_copro_profile_u5')).toBe(profil)
  })

  it('profil local illisible : purge quand même, avec l’identifiant du profil de démo', () => {
    localStorage.setItem('fixit_copro_profile_u2', '{illisible')
    localStorage.setItem(`fixit_interventions_copro_${PROFILE_DEMO.id}`, '[]')
    oublierDonneesDemoPerimees('u2')
    expect(localStorage.getItem(`fixit_interventions_copro_${PROFILE_DEMO.id}`)).toBeNull()
  })
})
