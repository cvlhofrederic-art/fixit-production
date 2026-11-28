import { describe, expect, it } from 'vitest'
import { echeancesEquipement, effectuerEntretien, type FicheEquipement } from '@/lib/administrateur-judiciaire/domain/equipements'
import { enchainer, etatEtape, realiserEtape, validerEtape, type Etape } from '@/lib/administrateur-judiciaire/domain/etapes'

/**
 * Équipements et étapes (cartographie Gestéam, tranche 35).
 * - Équipement : garantie (début + durée), entretien périodique (dernier → prochain), remplacement (mise en service +
 *   périodicité) ; échéances classées dépassée / proche / à venir (seuil de gestion).
 * - Étape : demandeur, réalisateur, validateur ; limite ; alerte de sécurité ; validation « sans objet » possible ;
 *   enchaînement d'étapes types d'un processus.
 */

const equipement = (surcharge: Partial<FicheEquipement> = {}): FicheEquipement => ({
  nature: 'Ascenseur',
  famille: 'Accès',
  garantie: { debut: '2024-06-01', dureeMois: 24 },
  entretien: { periodiciteMois: 1, dernier: '2026-09-20' },
  remplacement: { miseEnService: '2001-03-01', periodiciteMois: 300 },
  ...surcharge,
})

describe('équipements — échéances', () => {
  it('garantie, entretien et remplacement, classés et triés', () => {
    expect(echeancesEquipement(equipement(), '2026-10-27').map((e) => [e.type, e.date, e.statut])).toEqual([
      ['garantie', '2026-06-01', 'depassee'],
      ['entretien', '2026-10-20', 'depassee'],
      ['remplacement', '2026-03-01', 'depassee'],
    ].sort((a, b) => a[1].localeCompare(b[1])))
  })

  it('échéance proche sous le seuil de 30 jours par défaut', () => {
    const e = echeancesEquipement(equipement({ entretien: { periodiciteMois: 1, dernier: '2026-10-15' } }), '2026-10-27').find((x) => x.type === 'entretien')
    expect(e).toMatchObject({ date: '2026-11-15', statut: 'proche', jours: 19 })
  })

  it('refuse une famille inconnue ; sans données, pas d’échéance', () => {
    expect(() => echeancesEquipement(equipement({ famille: 'Robotique' as never }), '2026-10-27')).toThrow(/famille/i)
    expect(echeancesEquipement(equipement({ garantie: null, entretien: null, remplacement: null }), '2026-10-27')).toEqual([])
  })

  it('effectuer l’entretien avance le dernier contrôle, sans modifier la fiche d’origine', () => {
    const fiche = equipement()
    expect(effectuerEntretien(fiche, '2026-10-27').entretien).toEqual({ periodiciteMois: 1, dernier: '2026-10-27' })
    expect(fiche.entretien?.dernier).toBe('2026-09-20')
    expect(() => effectuerEntretien(equipement({ entretien: null }), '2026-10-27')).toThrow(/entretien/i)
  })
})

const etape = (surcharge: Partial<Etape> = {}): Etape => ({
  id: 'e-1',
  titre: 'Envoyer la mise en demeure',
  etapeType: 'MED',
  demandeurId: 'collab-A',
  realisateurId: 'collab-B',
  validateurId: 'collab-A',
  limite: '2026-11-05',
  alerteSecurite: '2026-11-01',
  faitLe: null,
  valideeLe: null,
  validationSansObjet: false,
  compteRendu: '',
  ...surcharge,
})

describe('étapes — cycle et alertes', () => {
  it('à faire, puis à valider après réalisation, puis validée', () => {
    expect(etatEtape(etape(), '2026-10-27')).toMatchObject({ statut: 'a_faire', enRetard: false, alerte: false })
    const faite = realiserEtape(etape(), { date: '2026-10-28', compteRendu: 'Envoyée en AR' })
    expect(etatEtape(faite, '2026-10-29').statut).toBe('a_valider')
    expect(etatEtape(validerEtape(faite, '2026-10-30'), '2026-10-30').statut).toBe('validee')
  })

  it('sans validateur, ou validation sans objet : terminée dès la réalisation', () => {
    expect(etatEtape(realiserEtape(etape({ validateurId: null }), { date: '2026-10-28', compteRendu: '' }), '2026-10-28').statut).toBe('terminee')
    expect(etatEtape(realiserEtape(etape({ validationSansObjet: true }), { date: '2026-10-28', compteRendu: '' }), '2026-10-28').statut).toBe('terminee')
  })

  it('alerte de sécurité puis retard tant que l’étape n’est pas faite', () => {
    expect(etatEtape(etape(), '2026-11-02')).toMatchObject({ alerte: true, enRetard: false })
    expect(etatEtape(etape(), '2026-11-06')).toMatchObject({ alerte: true, enRetard: true })
  })

  it('refuse de valider une étape non réalisée, ou une réalisation avant la création logique (date invalide)', () => {
    expect(() => validerEtape(etape(), '2026-10-30')).toThrow(/réalis/i)
    expect(() => realiserEtape(etape(), { date: '28/10/2026', compteRendu: '' })).toThrow(/date/i)
  })

  it('enchaînement : l’étape suivante du processus, limite = réalisation + délai', () => {
    const processus = [
      { etapeType: 'MED', titre: 'Envoyer la mise en demeure', delaiJours: 0 },
      { etapeType: 'SUIVI', titre: 'Vérifier le paiement à 30 jours', delaiJours: 30 },
      { etapeType: 'AVOCAT', titre: 'Transmettre à l’avocat', delaiJours: 15 },
    ]
    const faite = realiserEtape(etape(), { date: '2026-10-28', compteRendu: '' })
    expect(enchainer(faite, processus, { id: 'e-2' })).toMatchObject({
      id: 'e-2',
      etapeType: 'SUIVI',
      titre: 'Vérifier le paiement à 30 jours',
      limite: '2026-11-27',
      demandeurId: 'collab-A',
      faitLe: null,
    })
    expect(enchainer(realiserEtape(etape({ etapeType: 'AVOCAT' }), { date: '2026-10-28', compteRendu: '' }), processus, { id: 'x' })).toBeNull()
    expect(() => enchainer(etape(), processus, { id: 'x' })).toThrow(/réalis/i)
  })
})
