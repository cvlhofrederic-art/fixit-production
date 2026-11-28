// @vitest-environment node
// Recherche manuelle du Dictionnaire matériaux (lib/dictionnaire-materiaux/recherche.ts) : ce qu'un artisan tape
// réellement — sans accents, au pluriel, avec une faute, en cours de frappe — doit trouver la bonne fiche.

import { describe, expect, it } from 'vitest'
import {
  MOTS_RECHERCHE_MAX,
  estMesure,
  listeEnTexte,
  motsDeLaSaisie,
  motsExiges,
  motsUtiles,
  normaliser,
  qualite,
  racine,
  rechercher,
  resoudreEtapes,
  situationsUtilisant,
} from '@/lib/dictionnaire-materiaux/recherche'
import { DICO_ESSAI } from './dictionnaire-essai'

const titres = (saisie: string) => rechercher(DICO_ESSAI, saisie).situations.map((r) => r.element.titre)
const noms = (saisie: string) => rechercher(DICO_ESSAI, saisie).materiaux.map((r) => r.element.nom)

describe('normalisation', () => {
  it('retire la casse, les accents et la ponctuation', () => {
    expect(normaliser('  Infiltração  em FACHADA ! ')).toBe('infiltracao em fachada')
    expect(normaliser('Mástique (acrílico)')).toBe('mastique acrilico')
    expect(normaliser('cimento-cola C2')).toBe('cimento cola c2')
  })

  it('ramène les pluriels portugais et français au singulier', () => {
    expect(racine('fissuras')).toBe('fissura')
    expect(racine('infiltracoes')).toBe('infiltracao')
    expect(racine('pinceis')).toBe('pincel')
    expect(racine('metais')).toBe('metal')
    expect(racine('tuyaux')).toBe('tuyau')
    // Les mots courts ne sont pas touchés : « gas », « pvc », « wc ».
    expect(racine('gas')).toBe('gas')
    expect(racine('wc')).toBe('wc')
  })

  it('écarte les mots vides, sauf s’il ne reste qu’eux', () => {
    expect(motsUtiles('Infiltração em fachada')).toEqual(['infiltracao', 'fachada'])
    expect(motsUtiles('junta de silicone com bolor')).toEqual(['junta', 'silicone', 'bolor'])
    expect(motsUtiles('para')).toEqual(['para'])
    expect(motsUtiles('   ')).toEqual([])
    // Une lettre isolée ne dit rien, un chiffre seul si : « dentada 8 mm » n'est pas « dentada 10 mm ».
    expect(motsUtiles('espátula dentada 8 mm')).toEqual(['espatula', 'dentada', '8', 'mm'])
    expect(motsUtiles('tubo d 32')).toEqual(['tubo', '32'])
  })

  it('sépare une mesure collée à son unité', () => {
    expect(motsUtiles('silicone 280ml')).toEqual(['silicone', '280', 'ml'])
    expect(motsUtiles('broca 6mm')).toEqual(['broca', '6', 'mm'])
    expect(motsUtiles('cabo 2,5mm2')).toEqual(['cabo', '2', '5', 'mm2'])
    // Unités d'une lettre : le nombre reste, l'unité tombe avec les lettres isolées, comme dans « 15 L » des données.
    expect(motsUtiles('tinta 15l')).toEqual(['tinta', '15'])
    expect(motsUtiles('fita 50m')).toEqual(['fita', '50'])
    expect(motsUtiles('cola 750g')).toEqual(['cola', '750'])
    expect(motsUtiles('tinta 15l')).toEqual(motsUtiles('tinta 15 L'))
    // Un mot qui finit par des lettres d'unité sans nombre devant reste entier ; « 2k » (bicomponente) aussi.
    expect(motsUtiles('kgf c2')).toEqual(['kgf', 'c2'])
    expect(motsUtiles('verniz 2k')).toEqual(['verniz', '2k'])
  })

  it('écrit « m² » comme on le tape, « m2 »', () => {
    expect(normaliser('Cabo 2,5 mm²')).toBe('cabo 2 5 mm2')
    expect(motsUtiles('16 m²')).toEqual(motsUtiles('16m2'))
    expect(motsUtiles('betão 3 m³')).toEqual(['betao', '3', 'm3'])
  })

  it('n’écarte que les mots vides de la langue du dictionnaire', () => {
    // En portugais, « lã » (laine) se normalise en « la » : ce n'est pas un mot vide.
    expect(motsUtiles('lã de rocha', 'pt')).toEqual(['la', 'rocha'])
    expect(motsUtiles('la laine de roche', 'fr')).toEqual(['laine', 'roche'])
    expect(motsUtiles('lã de aço')).toEqual(['la', 'aco'])
  })

  it('reconnaît les mesures, qui départagent sans être exigées', () => {
    expect(['6', '280', 'mm', 'ml', 'm2'].every(estMesure)).toBe(true)
    expect(['broca', 'c2', 'pvc'].some(estMesure)).toBe(false)
    expect(motsExiges(['broca', '6', 'mm'])).toEqual([true, false, false])
    // Une saisie faite seulement de mesures les exige toutes.
    expect(motsExiges(['8', 'mm'])).toEqual([true, true])
  })

  it('ne compare un nombre qu’à l’identique', () => {
    expect(qualite('6', '6')).toBe(1)
    expect(qualite('6', '60')).toBe(0)
    expect(qualite('28', '280')).toBe(0)
    // Un mot en cours de saisie, lui, reconnaît le début d'un mot.
    expect(qualite('silic', 'silicone')).toBe(0.8)
  })

  it('borne le nombre de mots pris dans une saisie', () => {
    const longue = Array.from({ length: 40 }, (_, i) => `palavra${i}`).join(' ')
    expect(motsDeLaSaisie(DICO_ESSAI, longue)).toHaveLength(MOTS_RECHERCHE_MAX)
    expect(motsDeLaSaisie(DICO_ESSAI, longue)[0]).toBe('palavra0')
  })
})

describe('recherche de situations', () => {
  it('trouve « Infiltração em fachada » avec le mot-clé du propriétaire, sans accents', () => {
    expect(titres('Infiltracao fachada')[0]).toBe('Infiltração em fachada')
    expect(titres('infiltração fachada')[0]).toBe('Infiltração em fachada')
    expect(titres('INFILTRAÇÕES NAS FACHADAS')[0]).toBe('Infiltração em fachada')
  })

  it('tolère une faute de frappe et un mot en cours de saisie', () => {
    expect(titres('infiltraçao fachda')[0]).toBe('Infiltração em fachada')
    expect(titres('infiltr')[0]).toBe('Infiltração em fachada')
    expect(titres('silicne bolor')).toEqual(['Junta de silicone com bolor no duche'])
    // Un mot inconnu n'empêche pas de trouver par l'autre.
    expect(titres('zzzz duche')).toEqual(['Junta de silicone com bolor no duche'])
  })

  it('cherche aussi dans les formulations de l’artisan (mots-clés de la fiche)', () => {
    expect(titres('água entra pela parede')[0]).toBe('Infiltração em fachada')
    expect(titres('silicone preto')[0]).toBe('Junta de silicone com bolor no duche')
  })

  it('exige tous les mots quand une fiche les réunit, et classe le titre exact en tête', () => {
    // « fachada » seul : les deux fiches de façade ; « infiltração fachada » : la fiche d'infiltration d'abord.
    expect(titres('fachada')).toEqual(expect.arrayContaining(['Infiltração em fachada', 'Fissuras finas no reboco da fachada']))
    expect(titres('fissuras fachada')[0]).toBe('Fissuras finas no reboco da fachada')
    expect(titres('fachada bolor')).not.toHaveLength(0)
  })

  it('retrouve une situation par un matériau qu’elle emploie', () => {
    expect(titres('hidrofugante')).toContain('Infiltração em fachada')
  })

  it('ne renvoie rien pour une saisie vide ou sans rapport', () => {
    expect(rechercher(DICO_ESSAI, '')).toEqual({ situations: [], materiaux: [] })
    expect(rechercher(DICO_ESSAI, '   ')).toEqual({ situations: [], materiaux: [] })
    expect(titres('xyzw')).toEqual([])
    expect(noms('xyzw')).toEqual([])
  })
})

describe('recherche de matériaux', () => {
  it('« silicone » rend les silicones, le nom d’abord', () => {
    const resultats = noms('silicone')
    expect(resultats.slice(0, 2)).toEqual(
      expect.arrayContaining(['Silicone sanitário anti-fungos', 'Silicone neutro para caixilharia']),
    )
    expect(resultats).not.toContain('Espátula dentada')
  })

  it('trouve par sous-famille, par autre nom et par mot de la même famille', () => {
    expect(noms('espatulas')).toEqual(expect.arrayContaining(['Espátula dentada', 'Espátula de pintor']))
    expect(noms('pente de cola')[0]).toBe('Espátula dentada')
    expect(noms('casa de banho')[0]).toBe('Silicone sanitário anti-fungos')
    expect(noms('impermeabilizar')).toContain('Hidrofugante incolor para fachadas')
  })

  it('ne confond pas deux produits au début de nom voisin', () => {
    // « silicato » n'est pas « silicone » : cinq lettres communes ne suffisent pas.
    expect(noms('silicato')).toEqual([])
  })

  it('respecte les limites demandées', () => {
    const resultats = rechercher(DICO_ESSAI, 'fachada', { limiteSituations: 1, limiteMateriaux: 1 })
    expect(resultats.situations).toHaveLength(1)
    expect(resultats.materiaux).toHaveLength(1)
  })
})

describe('fiches', () => {
  const situation = DICO_ESSAI.situations[0]

  it('résout les étapes d’une situation et ignore un identifiant inconnu', () => {
    const etapes = resoudreEtapes(DICO_ESSAI, [
      ...situation.etapes,
      { titre: 'Fantôme', materiaux: [{ id: 'inexistant' }] },
    ])
    expect(etapes.map((e) => e.titre)).toEqual(['Reparação', 'Proteção', 'Ferramentas'])
    expect(etapes[1].lignes[0]).toMatchObject({ optionnel: true, note: 'Em suporte seco.' })
    expect(etapes[1].lignes[0].materiau.nom).toBe('Hidrofugante incolor para fachadas')
  })

  it('liste les situations qui emploient un matériau', () => {
    expect(situationsUtilisant(DICO_ESSAI, 'mastique-poliuretano-fachada').map((s) => s.id)).toEqual(['infiltracao-fachada', 'fissuras-fachada'])
    expect(situationsUtilisant(DICO_ESSAI, 'espatula-dentada')).toEqual([])
  })

  it('écrit la liste de courses en texte simple', () => {
    const texte = listeEnTexte(situation.titre, resoudreEtapes(DICO_ESSAI, situation.etapes), 'opcional')
    expect(texte.split('\n')).toEqual([
      'Infiltração em fachada',
      '',
      'Reparação :',
      '- Argamassa de reparação — Refazer o reboco solto.',
      '- Mástique de poliuretano para fachadas — Selar as fissuras abertas.',
      '',
      'Proteção :',
      '- Hidrofugante incolor para fachadas (opcional) — Em suporte seco.',
      '',
      'Ferramentas :',
      '- Espátula de pintor',
    ])
  })
})
