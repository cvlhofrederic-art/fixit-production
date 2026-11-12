// tests/lib/aj-signalement-droits-diffusion.test.ts
//
// AJ Signalement, PR 3, partie gestionnaire (décision H11 de Hugo du 11/11/2026, cahier § 4.3) — règles pures :
//   - droit « diffuser » d'un profil sur une copropriété (lib/aj-signalement/droits-diffusion.ts) : super admin, toujours ;
//     gestionnaire, seulement sur une copropriété de SON cabinet qui lui est attribuée NOMMÉMENT et qui n'est pas
//     « attribuée à tous » (la copropriété de test ne diffuse que par le super admin, même si elle lui est aussi attribuée
//     nommément) ; hors portée → « hors_portee » (404 de la route) ; visible mais non diffusable → « lecture_seule » (403) ;
//   - historique et détail vus par un gestionnaire (lib/aj-signalement/diffusion-formes.ts) : auteur « vous » /
//     « collegue » / « cabinet », jamais un nom ni un identifiant (RG-23) ; l'instruction écrite reçue par le super admin
//     (texte libre, qui peut nommer une personne) n'est pas rendue.
// Aucune donnée réelle.

import { describe, expect, it } from 'vitest'
import { porteeGestionnaireQr, porteeVideQr } from '@/lib/aj-signalement/acces-espace'
import { droitDiffuserQr } from '@/lib/aj-signalement/droits-diffusion'
import {
  auteurDiffusionVuGestionnaireQr, detailDiffusionDepuisLigneQr, nombresDiffusionDepuisLigneQr, resumeDiffusionDepuisLigneQr,
} from '@/lib/aj-signalement/diffusion-formes'
import type { CoproDroitsQr, FicheDroitsQr } from '@/lib/aj-signalement/types'

const CAB = 'ca000000-0000-4000-8000-000000000001'
const CAB_AUTRE = 'ca000000-0000-4000-8000-000000000002'
const G1 = 'a0000000-0000-4000-8000-000000000001'
const G2 = 'a0000000-0000-4000-8000-000000000002'

const copro = (id: string, sur: Partial<CoproDroitsQr> = {}): CoproDroitsQr => ({ id, cabinetId: CAB, attribueeATous: false, ...sur })
const NOMMEE = copro('c0000000-0000-4000-8000-000000000001')
const COLLEGUE = copro('c0000000-0000-4000-8000-000000000002')
const TOUS = copro('c0000000-0000-4000-8000-000000000003', { attribueeATous: true })
const TOUS_ET_NOMMEE = copro('c0000000-0000-4000-8000-000000000004', { attribueeATous: true })
const AUTRE_CABINET = copro('c0000000-0000-4000-8000-000000000005', { cabinetId: CAB_AUTRE })
const SANS_CABINET = copro('c0000000-0000-4000-8000-000000000006', { cabinetId: null })
const COPROS = [NOMMEE, COLLEGUE, TOUS, TOUS_ET_NOMMEE, AUTRE_CABINET, SANS_CABINET]

const fiche = (sur: Partial<FicheDroitsQr> = {}): FicheDroitsQr => ({ id: G1, cabinetId: CAB, actif: true, ...sur })
/** Attributions nommées de G1 : sa copropriété, la « à tous » qui lui est aussi attribuée, et deux attributions hors cabinet. */
const ATTRIBUTIONS = new Set([NOMMEE.id, TOUS_ET_NOMMEE.id, AUTRE_CABINET.id, SANS_CABINET.id])
const porteeG1 = (f: FicheDroitsQr = fiche()) => porteeGestionnaireQr(f, COPROS, ATTRIBUTIONS)

describe('droitDiffuserQr (H11)', () => {
  it('super admin : autorisé sur toute copropriété, « à tous » comprise, sans portée', () => {
    for (const c of COPROS) expect(droitDiffuserQr('super_admin', c, porteeVideQr()), c.id).toBe('autorise')
  })

  it('gestionnaire : autorisé sur la copropriété attribuée nommément, de son cabinet, non « à tous »', () => {
    expect(droitDiffuserQr('gestionnaire', NOMMEE, porteeG1())).toBe('autorise')
  })

  it('« attribuée à tous » : lecture_seule, même si elle lui est AUSSI attribuée nommément (copropriété de test)', () => {
    expect(droitDiffuserQr('gestionnaire', TOUS, porteeG1())).toBe('lecture_seule')
    expect(droitDiffuserQr('gestionnaire', TOUS_ET_NOMMEE, porteeG1())).toBe('lecture_seule')
  })

  it('copropriété d’un collègue, d’un autre cabinet ou sans cabinet : hors_portee (la route répond 404, jamais 403)', () => {
    for (const c of [COLLEGUE, AUTRE_CABINET, SANS_CABINET]) expect(droitDiffuserQr('gestionnaire', c, porteeG1()), c.id).toBe('hors_portee')
  })

  it('fiche inactive (départ) : hors_portee partout, même sur sa copropriété', () => {
    for (const c of COPROS) expect(droitDiffuserQr('gestionnaire', c, porteeG1(fiche({ actif: false }))), c.id).toBe('hors_portee')
  })

  it('fiche d’un autre cabinet : rien du premier cabinet, même avec des attributions nommées', () => {
    const portee = porteeG1(fiche({ cabinetId: CAB_AUTRE }))
    expect(droitDiffuserQr('gestionnaire', NOMMEE, portee)).toBe('hors_portee')
    expect(droitDiffuserQr('gestionnaire', AUTRE_CABINET, portee)).toBe('autorise')
  })

  it('copropriété inconnue (null), profil « aucun » : hors_portee', () => {
    expect(droitDiffuserQr('gestionnaire', null, porteeG1())).toBe('hors_portee')
    expect(droitDiffuserQr('aucun', NOMMEE, porteeG1())).toBe('hors_portee')
  })

  it('portée incohérente (visible sans être nommée ni « à tous ») : lecture_seule, jamais autorisé', () => {
    expect(droitDiffuserQr('gestionnaire', NOMMEE, { visibles: new Set([NOMMEE.id]), modifiables: new Set() })).toBe('lecture_seule')
  })

  it('copropriété annoncée « nommée » par une portée qui ne la rend pas visible : hors_portee', () => {
    expect(droitDiffuserQr('gestionnaire', NOMMEE, { visibles: new Set(), modifiables: new Set([NOMMEE.id]) })).toBe('hors_portee')
  })
})

describe('historique et détail vus par un gestionnaire (RG-23)', () => {
  const ligne = (sur: Record<string, unknown> = {}) => ({
    id: 'df000000-0000-4000-8000-000000000001', cree_le: '2026-11-12T10:00:00+00:00', created_at: '2026-11-12T10:00:00+00:00',
    copropriete_id: NOMMEE.id, acteur_profil: 'gestionnaire', acteur_id: '0b000000-0000-4000-8000-000000000002',
    acteur_gestionnaire_id: G2, modele: 'coupure_eau', objet: 'Coupure d’eau', texte: 'L’eau sera coupée demain.', portee: 'copropriete',
    libelle_perimetre: 'Toute la copropriété', nb_destinataires: 3, nb_exclus_opposition: 0, langue: 'fr',
    instruction_reference: null, instruction_recue_le: null, copie_cabinet_le: null, ...sur,
  })

  it('auteurDiffusionVuGestionnaireQr : vous (sa fiche), collègue (autre fiche), cabinet (super admin)', () => {
    expect(auteurDiffusionVuGestionnaireQr({ acteur_profil: 'gestionnaire', acteur_gestionnaire_id: G1 }, G1)).toBe('vous')
    expect(auteurDiffusionVuGestionnaireQr({ acteur_profil: 'gestionnaire', acteur_gestionnaire_id: G2 }, G1)).toBe('collegue')
    expect(auteurDiffusionVuGestionnaireQr({ acteur_profil: 'gestionnaire', acteur_gestionnaire_id: null }, G1)).toBe('collegue')
    expect(auteurDiffusionVuGestionnaireQr({ acteur_profil: 'super_admin', acteur_gestionnaire_id: null }, G1)).toBe('cabinet')
    expect(auteurDiffusionVuGestionnaireQr({ acteur_profil: 'inconnu' }, G1)).toBe('cabinet')
  })

  it('résumé : auteur minimisé pour un gestionnaire ; le super admin garde « administrateur » / « gestionnaire »', () => {
    expect(resumeDiffusionDepuisLigneQr(ligne()).auteur).toBe('gestionnaire')
    expect(resumeDiffusionDepuisLigneQr(ligne(), { gestionnaireId: G1 }).auteur).toBe('collegue')
    expect(resumeDiffusionDepuisLigneQr(ligne({ acteur_gestionnaire_id: G1 }), { gestionnaireId: G1 }).auteur).toBe('vous')
    expect(resumeDiffusionDepuisLigneQr(ligne({ acteur_profil: 'super_admin', acteur_gestionnaire_id: null }), { gestionnaireId: G1 }).auteur).toBe('cabinet')
  })

  it('détail d’une diffusion du super admin vu par un gestionnaire : auteur « cabinet », instruction écrite NON rendue', () => {
    const l = ligne({ acteur_profil: 'super_admin', acteur_gestionnaire_id: null, instruction_reference: 'Courriel de Paul Collègue du 12/11/2026', instruction_recue_le: '2026-11-12' })
    const nombres = nombresDiffusionDepuisLigneQr({ nb_envoyes: 3 })
    expect(detailDiffusionDepuisLigneQr(l, nombres).instruction).toEqual({ reference: 'Courriel de Paul Collègue du 12/11/2026', recueLe: '2026-11-12' })
    const vu = detailDiffusionDepuisLigneQr(l, nombres, { gestionnaireId: G1 })
    expect(vu).toMatchObject({ auteur: 'cabinet', instruction: null, texte: 'L’eau sera coupée demain.', nombres: expect.objectContaining({ envoyes: 3 }) })
    expect(JSON.stringify(vu)).not.toMatch(/Paul|Collègue|0b000000/)
  })

  it('aucune forme ne rend l’identifiant du compte ni de la fiche de l’auteur', () => {
    const texte = JSON.stringify([
      resumeDiffusionDepuisLigneQr(ligne(), { gestionnaireId: G1 }),
      detailDiffusionDepuisLigneQr(ligne(), nombresDiffusionDepuisLigneQr(null), { gestionnaireId: G1 }),
    ])
    expect(texte).not.toContain(G2)
    expect(texte).not.toContain('0b000000-0000-4000-8000-000000000002')
  })
})
