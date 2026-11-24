// tests/lib/btp-lieu-devis.test.ts — lieu d'intervention d'un devis BTP (lib/btp/lieu-devis.ts, 24/11/2026), repris
// sans rien retaper dans la fiche chantier et dans la Météo chantiers. Le formulaire de devis BTP écrit le lieu en une
// ligne de texte libre ; la fiche chantier a trois champs (rue, code postal, ville). Adresses fictives.

import { describe, expect, it } from 'vitest'
import {
  LIEUX_METEO_MAX, ajouterLieuMeteo, champsAdresseDuLieu, cleLieuxMeteo, libelleChoixDevis, lieuAbrege,
  lieuDuDevis, lieuxMeteoValides, messageAdresseImportee, type LieuMeteoDevis,
} from '@/lib/btp/lieu-devis'

describe('lieuDuDevis', () => {
  it('le lieu d’intervention prime sur l’adresse du client', () => {
    expect(lieuDuDevis({ lieu_intervention: '15 rue des Lilas, 13001 Marseille', adresse_client_devis: '3 av. du Prado, 13008 Marseille' }))
      .toEqual({ texte: '15 rue des Lilas, 13001 Marseille', source: 'intervention' })
  })

  it('sans lieu d’intervention : l’adresse du client du contenu du devis, puis l’ancienne colonne client_address', () => {
    expect(lieuDuDevis({ lieu_intervention: '  ', adresse_client_devis: '3 av. du Prado, 13008 Marseille', client_address: 'autre' }))
      .toEqual({ texte: '3 av. du Prado, 13008 Marseille', source: 'client' })
    expect(lieuDuDevis({ lieu_intervention: null, adresse_client_devis: null, client_address: '8 rue Neuve, 69003 Lyon' }))
      .toEqual({ texte: '8 rue Neuve, 69003 Lyon', source: 'client' })
  })

  it('espaces et retours à la ligne réduits ; rien d’utilisable : null', () => {
    expect(lieuDuDevis({ lieu_intervention: ' 15 rue des Lilas,\n 13001   Marseille ' })?.texte).toBe('15 rue des Lilas, 13001 Marseille')
    expect(lieuDuDevis({})).toBeNull()
    expect(lieuDuDevis({ lieu_intervention: 42, adresse_client_devis: { rue: 'x' } })).toBeNull()
  })

  it('un nom de pays seul n’est pas une adresse (le formulaire compose « Portugal » quand rue, code postal et ville sont vides)', () => {
    expect(lieuDuDevis({ lieu_intervention: null, adresse_client_devis: 'Portugal' })).toBeNull()
    expect(lieuDuDevis({ lieu_intervention: ' , France', adresse_client_devis: 'Portugal', client_address: '8 rue Neuve, 69003 Lyon' }))
      .toEqual({ texte: '8 rue Neuve, 69003 Lyon', source: 'client' })
  })
})

describe('champsAdresseDuLieu', () => {
  it('France : rue (résidence comprise), code postal, ville', () => {
    expect(champsAdresseDuLieu('Résidence Le Mail, 15 rue des Lilas, 13001 Marseille', 'FR'))
      .toEqual({ adresse: 'Résidence Le Mail, 15 rue des Lilas', codePostal: '13001', ville: 'Marseille' })
  })

  it('le pays écrit en fin d’adresse n’est pas la ville', () => {
    expect(champsAdresseDuLieu('15 rue des Lilas, 13001 Marseille, France', 'FR'))
      .toEqual({ adresse: '15 rue des Lilas', codePostal: '13001', ville: 'Marseille' })
    expect(champsAdresseDuLieu('Rua de Santa Catarina 123, 4000-447 Porto, Portugal', 'PT'))
      .toEqual({ adresse: 'Rua de Santa Catarina 123', codePostal: '4000-447', ville: 'Porto' })
  })

  it('chantier de l’autre pays : le code postal de l’autre pays est reconnu', () => {
    expect(champsAdresseDuLieu('15 rue des Lilas 13001 Marseille', 'PT'))
      .toEqual({ adresse: '15 rue des Lilas', codePostal: '13001', ville: 'Marseille' })
    expect(champsAdresseDuLieu('Rua de Santa Catarina 123, 4000-447 Porto', 'FR'))
      .toEqual({ adresse: 'Rua de Santa Catarina 123', codePostal: '4000-447', ville: 'Porto' })
  })

  it('sans code postal : la dernière partie après une virgule est la ville (une année n’est pas un code postal)', () => {
    expect(champsAdresseDuLieu('Rua 25 de Abril 1974, Porto', 'PT')).toEqual({ adresse: 'Rua 25 de Abril 1974', codePostal: '', ville: 'Porto' })
    expect(champsAdresseDuLieu('12 rue Neuve, Lyon', 'FR')).toEqual({ adresse: '12 rue Neuve', codePostal: '', ville: 'Lyon' })
  })

  it('une seule partie, ou une dernière partie chiffrée : tout reste dans la rue, la ville est à saisir', () => {
    expect(champsAdresseDuLieu('Quinta do Lago', 'PT')).toEqual({ adresse: 'Quinta do Lago', codePostal: '', ville: '' })
    expect(champsAdresseDuLieu('Lotissement Les Pins, lot 12', 'FR')).toEqual({ adresse: 'Lotissement Les Pins, lot 12', codePostal: '', ville: '' })
  })

  it('code postal et ville seuls : pas de rue', () => {
    expect(champsAdresseDuLieu('13001 Marseille', 'FR')).toEqual({ adresse: '', codePostal: '13001', ville: 'Marseille' })
  })

  it('rien ne se perd : bâtiment, étage ou rue écrits après la ville vont dans l’adresse', () => {
    expect(champsAdresseDuLieu('15 rue des Lilas, 13001 Marseille, Bât. B, 2e étage', 'FR'))
      .toEqual({ adresse: '15 rue des Lilas, Bât. B, 2e étage', codePostal: '13001', ville: 'Marseille' })
    expect(champsAdresseDuLieu('Rua do Almada 10, 4050-036 Porto, 2.º Esq.', 'PT'))
      .toEqual({ adresse: 'Rua do Almada 10, 2.º Esq.', codePostal: '4050-036', ville: 'Porto' })
    expect(champsAdresseDuLieu('13001 Marseille, 15 rue des Lilas', 'FR'))
      .toEqual({ adresse: '15 rue des Lilas', codePostal: '13001', ville: 'Marseille' })
    expect(champsAdresseDuLieu('4050-036 Porto, Rua do Almada 10', 'PT'))
      .toEqual({ adresse: 'Rua do Almada 10', codePostal: '4050-036', ville: 'Porto' })
  })

  it('« - » entre espaces sépare aussi (une ville à tirets reste entière)', () => {
    expect(champsAdresseDuLieu('15 rue des Lilas 13001 Marseille - Bâtiment B, 3e étage', 'FR'))
      .toEqual({ adresse: '15 rue des Lilas, Bâtiment B, 3e étage', codePostal: '13001', ville: 'Marseille' })
    expect(champsAdresseDuLieu('Rua X 5, 4000-123 Porto - Portugal', 'PT')).toEqual({ adresse: 'Rua X 5', codePostal: '4000-123', ville: 'Porto' })
    expect(champsAdresseDuLieu('2 cours Mirabeau, 13100 Aix-en-Provence', 'FR')).toEqual({ adresse: '2 cours Mirabeau', codePostal: '13100', ville: 'Aix-en-Provence' })
  })

  it('un nombre suivi d’une virgule n’est pas un code postal (boîte postale, route nationale)', () => {
    expect(champsAdresseDuLieu('BP 50012, 13001 Marseille', 'FR')).toEqual({ adresse: 'BP 50012', codePostal: '13001', ville: 'Marseille' })
    expect(champsAdresseDuLieu('Estrada Nacional 12345, Braga', 'PT')).toEqual({ adresse: 'Estrada Nacional 12345', codePostal: '', ville: 'Braga' })
  })
})

describe('libellés', () => {
  const lieu = { texte: '15 rue des Lilas, 13001 Marseille', source: 'intervention' as const }

  it('ligne de choix : numéro, client, lieu ; brouillon sans numéro ; adresse du client signalée', () => {
    expect(libelleChoixDevis({ numero: 'DEV-2026-001', client_name: 'Mme Durand' }, lieu, false))
      .toBe('DEV-2026-001 · Mme Durand · 15 rue des Lilas, 13001 Marseille')
    expect(libelleChoixDevis({ numero: null, client_name: null }, { ...lieu, source: 'client' }, false))
      .toBe('Brouillon · 15 rue des Lilas, 13001 Marseille (adresse du client)')
    expect(libelleChoixDevis({ numero: '', client_name: 'Sr. Silva' }, { ...lieu, source: 'client' }, true))
      .toBe('Rascunho · Sr. Silva · 15 rue des Lilas, 13001 Marseille (morada do cliente)')
  })

  it('lieu long abrégé', () => {
    const long = 'Résidence Les Jardins du Parc, bâtiment C, escalier 2, 145 boulevard de la Libération, 13004 Marseille'
    // Coupé à 59 caractères puis « … », sans espace avant les points de suspension.
    expect(lieuAbrege(long)).toBe('Résidence Les Jardins du Parc, bâtiment C, escalier 2, 145…')
    expect(lieuAbrege(long).length).toBeLessThanOrEqual(60)
    expect(lieuAbrege('court')).toBe('court')
  })

  it('message après import : origine de l’adresse et ville à compléter', () => {
    const complet = { adresse: '15 rue des Lilas', codePostal: '13001', ville: 'Marseille' }
    expect(messageAdresseImportee('DEV-1', lieu, complet, false)).toBe('Adresse reprise du devis DEV-1.')
    expect(messageAdresseImportee('DEV-1', { ...lieu, source: 'client' }, { ...complet, ville: '' }, false))
      .toBe('Adresse reprise du devis DEV-1. Pas de lieu d’intervention sur ce devis : c’est l’adresse du client. Vérifiez-la, puis utilisez le bouton GPS. Indiquez la ville.')
    expect(messageAdresseImportee(null, lieu, { ...complet, ville: '' }, true)).toBe('Morada importada do orçamento rascunho. Indique a cidade.')
  })
})

describe('lieux de devis suivis par la Météo chantiers', () => {
  const lieuMeteo = (devisId: string): LieuMeteoDevis => ({ devisId, numero: `DEV-${devisId}`, client: 'Client', lieu: '1 rue A, 13001 Marseille', source: 'intervention' })

  it('clé propre à l’appareil (hors préfixe fixit_, jamais recopiée sur le serveur)', () => {
    expect(cleLieuxMeteo('art-1')).toBe('vitfix_btp_meteo_devis_art-1')
    expect(cleLieuxMeteo('art-1').startsWith('fixit_')).toBe(false)
  })

  it('relecture : entrées incomplètes, en double ou d’un autre type écartées ; source inconnue = lieu d’intervention', () => {
    expect(lieuxMeteoValides('pas une liste')).toEqual([])
    expect(lieuxMeteoValides([
      null, 'texte', { devisId: '', lieu: 'x' }, { devisId: 'a', lieu: '  ' }, { devisId: 'b', lieu: ' 2 rue B ', numero: 7, source: 'autre' },
      { devisId: 'b', lieu: 'doublon' }, lieuMeteo('c'),
    ])).toEqual([
      { devisId: 'b', numero: '', client: '', lieu: '2 rue B', source: 'intervention' },
      lieuMeteo('c'),
    ])
  })

  it('ajout : un devis déjà suivi est remplacé et passe en dernier ; au plus vingt lieux, les plus anciens partent', () => {
    const lieux = [lieuMeteo('a'), lieuMeteo('b')]
    const remplace = { ...lieuMeteo('a'), lieu: '9 rue Z, 13002 Marseille' }
    expect(ajouterLieuMeteo(lieux, remplace)).toEqual([lieuMeteo('b'), remplace])

    const pleins = Array.from({ length: LIEUX_METEO_MAX }, (_, i) => lieuMeteo(String(i)))
    const apres = ajouterLieuMeteo(pleins, lieuMeteo('nouveau'))
    expect(apres).toHaveLength(LIEUX_METEO_MAX)
    expect(apres[0].devisId).toBe('1')
    expect(apres.at(-1)?.devisId).toBe('nouveau')
    expect(lieuxMeteoValides([...pleins, lieuMeteo('x')])).toHaveLength(LIEUX_METEO_MAX)
  })
})
