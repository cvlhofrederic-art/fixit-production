// tests/lib/aj-signalement-semblables.test.ts
//
// Signalements déjà faits au même endroit (demande de Hugo du 06/11/2026), fonctions pures :
//   - bâtiment comparé après normalisation (casse, accents, ponctuation, espaces, mots « bâtiment », « bât »,
//     « bat », « bloc », « bloco »), sans couper un nom qui commence par ces lettres (« Batignolles ») ;
//   - zones comparées par leur place dans la liste fixe (« Escalier » = « Escadas ») ;
//   - sélection : parties communes, statuts ouverts, 60 jours au plus, au plus 5, du plus récent au plus ancien ;
//   - numéro du bâtiment : « Bât n°2 » = « Bâtiment 2 » = « 2 » (marqueurs « n », « no », « num », « numéro »
//     écartés devant des chiffres dont ils sont séparés), mais « Bâtiment N » reste « n » et « N2 » reste « n2 » ;
//   - fiche publique : numéro, type, zone, date, statut, rien d'autre (type et zone pris dans la liste fixe) ; la
//     date est le jour civil de Paris (AAAA-MM-JJ), jamais l'heure du dépôt (minimisation, RGPD art. 5.1.c).

import { describe, it, expect } from 'vitest'
import {
  DELAI_SEMBLABLES_JOURS, SEMBLABLES_MAX, STATUTS_OUVERTS_QR, cleZoneQr, dateLimiteSemblablesQr, normaliserBatimentQr,
  selectionnerSemblablesQr, semblablePublicQr, typePublicQr, variantesZoneQr, zonePubliqueQr, type LigneSemblableQr,
} from '@/lib/aj-signalement/semblables'

const MAINTENANT = new Date('2026-11-06T12:00:00.000Z')

function ligne(sur: Partial<LigneSemblableQr> = {}): LigneSemblableQr {
  return {
    id: '1a2b3c4d-0000-4000-8000-000000000000', batiment: 'Bât. B', zone_signalee: 'Escalier',
    type_intervention: 'Éclairage des parties communes', statut: 'en_attente', est_partie_commune: true,
    created_at: '2026-11-05T10:00:00.000Z', ...sur,
  }
}

describe('règles de gestion', () => {
  it('60 jours, 5 signalements au plus, statuts ouverts (reçu, pris en charge, en cours)', () => {
    expect(DELAI_SEMBLABLES_JOURS).toBe(60)
    expect(SEMBLABLES_MAX).toBe(5)
    expect(STATUTS_OUVERTS_QR).toEqual(['en_attente', 'acceptee', 'en_cours'])
    expect(dateLimiteSemblablesQr(MAINTENANT)).toBe('2026-09-07T12:00:00.000Z')
  })
})

describe('normalisation du bâtiment', () => {
  it.each(['Bât. B', 'bat b', 'BÂTIMENT  B', 'Bloc B', 'b', ' B ', 'Bâtiment-B', 'bât.B', 'Bloco B', 'bâtiment b'])('« %s » → b', (saisie) => {
    expect(normaliserBatimentQr(saisie)).toBe('b')
  })

  it('chiffres : zéros de tête retirés, lettres et chiffres comparés sans séparateur', () => {
    expect(normaliserBatimentQr('B 2')).toBe('b2')
    expect(normaliserBatimentQr('b02')).toBe('b2')
    expect(normaliserBatimentQr('B-2')).toBe('b2')
    expect(normaliserBatimentQr('Bât. 02')).toBe('2')
    expect(normaliserBatimentQr('bat2')).toBe('2')
    expect(normaliserBatimentQr('0')).toBe('0')
  })

  it('noms : accents et espaces retirés ; « Batignolles » et « Blocus » ne sont pas coupés', () => {
    expect(normaliserBatimentQr('Les Pins')).toBe('lespins')
    expect(normaliserBatimentQr('les  pins')).toBe('lespins')
    expect(normaliserBatimentQr('Hélios')).toBe('helios')
    expect(normaliserBatimentQr('Batignolles')).toBe('batignolles')
    expect(normaliserBatimentQr('Bloc Batignolles')).toBe('batignolles')
    expect(normaliserBatimentQr('Blocus')).toBe('blocus')
  })

  it.each(['Bât n°2', 'Bâtiment 2', 'bât. n° 02', 'Bloco n.º 2', 'Bâtiment No 2', 'bat num. 2', 'Bâtiment numéro 2', 'nº2', '2'])('numéro : « %s » → 2', (saisie) => {
    expect(normaliserBatimentQr(saisie)).toBe('2')
  })

  it('le marqueur de numéro n’est écarté que devant des chiffres dont il est séparé : « Bâtiment N », « N2 », « B n°2 »', () => {
    expect(normaliserBatimentQr('Bâtiment N')).toBe('n')
    expect(normaliserBatimentQr('N')).toBe('n')
    expect(normaliserBatimentQr('N2')).toBe('n2')
    expect(normaliserBatimentQr('Bâtiment N2')).toBe('n2')
    expect(normaliserBatimentQr('B n°2')).toBe('b2')
    expect(normaliserBatimentQr('Nord')).toBe('nord')
  })

  it('saisie réduite au seul mot « bâtiment » : le mot est gardé ; saisie vide ou sans lettre ni chiffre → vide', () => {
    expect(normaliserBatimentQr('Bâtiment')).toBe('batiment')
    expect(normaliserBatimentQr('   ')).toBe('')
    expect(normaliserBatimentQr('--.')).toBe('')
  })
})

describe('zones', () => {
  it('une zone et sa traduction ont la même clé ; variantes FR et PT pour la requête', () => {
    expect(cleZoneQr('Escalier')).toBe(cleZoneQr('Escadas'))
    expect(cleZoneQr(' Escalier ')).toBe(cleZoneQr('Escalier'))
    expect(cleZoneQr('Escalier')).not.toBe(cleZoneQr('Ascenseur'))
    expect(variantesZoneQr('Escadas')).toEqual(['Escalier', 'Escadas'])
    expect(variantesZoneQr('Hall d’entrée')).toEqual(['Hall d’entrée', 'Entrada / hall'])
    expect(cleZoneQr('Autre')).toBe(cleZoneQr('Outra'))
    expect(variantesZoneQr('Outra')).toEqual(['Autre', 'Outra'])
    // Hors liste (POST direct) : comparée telle quelle.
    expect(variantesZoneQr(' Local à vélos ')).toEqual(['Local à vélos'])
    expect(cleZoneQr('Local à vélos')).not.toBe(cleZoneQr('Autre'))
  })

  it('valeurs publiques : la liste fixe dans la langue de la page, « Autre » pour tout texte hors liste', () => {
    expect(zonePubliqueQr('Escalier', 'pt')).toBe('Escadas')
    expect(zonePubliqueQr('Escadas', 'fr')).toBe('Escalier')
    expect(zonePubliqueQr('Outra', 'fr')).toBe('Autre')
    expect(zonePubliqueQr('<script>alert(1)</script>', 'fr')).toBe('Autre')
    expect(zonePubliqueQr('Chez M. Dupont', 'pt')).toBe('Outra')
    expect(typePublicQr('Ascenseur', 'pt')).toBe('Elevador')
    expect(typePublicQr('Canalização (fuga, coluna, torneira)', 'fr')).toBe('Plomberie (fuite, colonne, robinetterie)')
    expect(typePublicQr('Appelez Marie au 06 12 34 56 78', 'fr')).toBe('Autre')
    expect(typePublicQr('texte libre', 'pt')).toBe('Outro')
  })
})

describe('sélection des signalements semblables', () => {
  const recherche = { batiment: 'b', zone: 'Escalier' }

  it('au plus 5, du plus récent au plus ancien, même bâtiment normalisé et même zone (FR ou PT)', () => {
    const lignes = [
      ligne({ id: 'aaaaaaaa-0000-4000-8000-000000000001', created_at: '2026-11-01T10:00:00.000Z' }),
      ligne({ id: 'aaaaaaaa-0000-4000-8000-000000000002', created_at: '2026-11-04T10:00:00.000Z', zone_signalee: 'Escadas', batiment: 'bloco b' }),
      ligne({ id: 'aaaaaaaa-0000-4000-8000-000000000003', created_at: '2026-11-02T10:00:00.000Z', statut: 'acceptee' }),
      ligne({ id: 'aaaaaaaa-0000-4000-8000-000000000004', created_at: '2026-11-06T09:00:00.000Z', statut: 'en_cours', batiment: 'B' }),
      ligne({ id: 'aaaaaaaa-0000-4000-8000-000000000005', created_at: '2026-10-20T10:00:00.000Z' }),
      ligne({ id: 'aaaaaaaa-0000-4000-8000-000000000006', created_at: '2026-10-01T10:00:00.000Z' }),
      ligne({ id: 'aaaaaaaa-0000-4000-8000-000000000007', created_at: '2026-11-03T10:00:00.000Z' }),
    ]
    expect(selectionnerSemblablesQr(lignes, recherche, MAINTENANT).map((l) => l.id.slice(-1))).toEqual(['4', '2', '7', '3', '1'])
  })

  it('exclut : plus de 60 jours, résolus et classés, logements, autre bâtiment, autre zone ; 60 jours pile reste', () => {
    const lignes = [
      ligne({ id: 'garde-60-jours-pile', created_at: '2026-09-07T12:00:00.000Z' }),
      ligne({ id: 'trop-vieux', created_at: '2026-09-07T11:59:59.000Z' }),
      ligne({ id: 'resolu', statut: 'terminee' }),
      ligne({ id: 'classe', statut: 'annulee' }),
      ligne({ id: 'logement', est_partie_commune: false }),
      ligne({ id: 'autre-batiment', batiment: 'Bât. A' }),
      ligne({ id: 'batignolles', batiment: 'Batignolles' }),
      ligne({ id: 'autre-zone', zone_signalee: 'Ascenseur' }),
      ligne({ id: 'date-illisible', created_at: 'pas une date' }),
    ]
    expect(selectionnerSemblablesQr(lignes, recherche, MAINTENANT).map((l) => l.id)).toEqual(['garde-60-jours-pile'])
  })

  it('bâtiment de la recherche vide après normalisation : aucun semblable', () => {
    expect(selectionnerSemblablesQr([ligne({ batiment: '' })], { batiment: ' - ', zone: 'Escalier' }, MAINTENANT)).toEqual([])
  })
})

describe('fiche publique', () => {
  it('exactement numéro, type, zone, date et statut ; type et zone de la liste fixe, dans la langue de la page', () => {
    const fiche = semblablePublicQr(ligne({ type_intervention: 'Ascenseur', zone_signalee: 'Escalier', statut: 'acceptee' }), 'pt')
    expect(fiche).toEqual({ numero: '1A2B3C4D', typeIntervention: 'Elevador', zone: 'Escadas', creeLe: '2026-11-05', statut: 'acceptee' })
    expect(Object.keys(fiche).sort((a, b) => a.localeCompare(b))).toEqual(['creeLe', 'numero', 'statut', 'typeIntervention', 'zone'])
  })

  it('texte libre en base (type ou zone hors liste) : jamais rendu', () => {
    const fiche = semblablePublicQr(ligne({ type_intervention: 'Marie Durand 06 12 34 56 78', zone_signalee: 'Chez moi, 3e gauche' }), 'fr')
    expect(fiche.typeIntervention).toBe('Autre')
    expect(fiche.zone).toBe('Autre')
    expect(JSON.stringify(fiche)).not.toMatch(/Marie|06 12|gauche/)
  })

  it.each([
    ['horodatage PostgREST à la microseconde', '2026-11-05T13:32:07.123456+00:00', '2026-11-05'],
    ['23 h 30 UTC = lendemain à Paris (heure d’hiver)', '2026-11-05T23:30:00.000Z', '2026-11-06'],
    ['22 h 30 UTC = lendemain à Paris (heure d’été)', '2026-07-14T22:30:00.000Z', '2026-07-15'],
    ['décalage explicite', '2026-11-06T00:10:00+01:00', '2026-11-06'],
  ])('date = jour civil de Paris seulement (%s)', (_cas, createdAt, jour) => {
    const fiche = semblablePublicQr(ligne({ created_at: createdAt }), 'fr')
    expect(fiche.creeLe).toBe(jour)
    expect(fiche.creeLe).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('date absente ou illisible : vide, jamais la valeur brute', () => {
    expect(semblablePublicQr(ligne({ created_at: null }), 'fr').creeLe).toBe('')
    expect(semblablePublicQr(ligne({ created_at: 'pas une date' }), 'fr').creeLe).toBe('')
  })
})
