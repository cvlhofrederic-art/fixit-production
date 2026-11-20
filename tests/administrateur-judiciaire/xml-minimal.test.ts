import { describe, expect, it } from 'vitest'
import { enfant, enfantsNommes, lireXml, suivre, texteSuivi } from '@/lib/administrateur-judiciaire/domain/import/xml-minimal'

/**
 * Lecteur XML minimal des relevés camt.053 (aucune dépendance, pas de DOMParser côté serveur) : arbre d'éléments, espaces
 * de noms résolus, entités prédéfinies et références numériques seulement, toute DTD refusée (pas d'entité externe).
 */

describe('lecteur XML minimal', () => {
  it('rend l’arbre des éléments, leurs attributs, leur texte et l’espace de noms résolu', () => {
    const [racine] = lireXml(
      '﻿<?xml version="1.0" encoding="UTF-8"?>\n<!-- commentaire -->\n<Document xmlns="urn:essai:a" xmlns:x="urn:essai:x"><Amt Ccy="EUR">12.50</Amt><x:Note a=\'1\' b="deux"/><Vide></Vide></Document>\n',
    )
    expect(racine.nom).toBe('Document')
    expect(racine.espaceDeNoms).toBe('urn:essai:a')
    expect(racine.enfants.map((e) => e.nom)).toEqual(['Amt', 'Note', 'Vide'])
    const montant = enfant(racine, 'Amt')
    expect(montant?.texte).toBe('12.50')
    expect(montant?.attributs).toEqual({ Ccy: 'EUR' })
    expect(montant?.espaceDeNoms).toBe('urn:essai:a')
    const note = enfant(racine, 'Note')
    expect(note?.espaceDeNoms).toBe('urn:essai:x')
    expect(note?.attributs).toEqual({ a: '1', b: 'deux' })
    expect(enfant(racine, 'Vide')?.texte).toBe('')
  })

  it('décode les cinq entités prédéfinies, les références numériques et les sections CDATA', () => {
    const [racine] = lireXml('<a t="&quot;x&quot; &amp; &apos;y&apos;">&lt;b&gt; &amp; &#233;t&#xE9; <![CDATA[<brut> & ]]>fin</a>')
    expect(racine.attributs.t).toBe('"x" & \'y\'')
    expect(racine.texte).toBe('<b> & été <brut> & fin')
  })

  it('suit un chemin d’éléments et lit le texte rogné', () => {
    const [racine] = lireXml('<A><B><C> un </C><C>deux</C></B><B><C>trois</C></B></A>')
    expect(enfantsNommes(racine, 'B')).toHaveLength(2)
    expect(suivre(racine, 'B', 'C')?.texte).toBe(' un ')
    expect(texteSuivi(racine, 'B', 'C')).toBe('un')
    expect(texteSuivi(racine, 'B', 'D')).toBeNull()
    expect(suivre(null, 'B')).toBeNull()
  })

  it('normalise les fins de ligne et accepte plusieurs racines successives (plusieurs messages dans un fichier)', () => {
    const racines = lireXml('<?xml version="1.0"?>\r\n<a>x\r\ny</a>\r\n<?xml version="1.0"?>\r\n<b/>')
    expect(racines.map((r) => r.nom)).toEqual(['a', 'b'])
    expect(racines[0].texte).toBe('x\ny')
  })

  it('refuse toute DTD : aucune entité interne ni externe (XXE, expansion)', () => {
    expect(() => lireXml('<?xml version="1.0"?><!DOCTYPE a [<!ENTITY x SYSTEM "file:///etc/passwd">]><a>&x;</a>')).toThrow(/DTD/)
    expect(() => lireXml('<!DOCTYPE a><a/>')).toThrow(/DTD/)
  })

  it('refuse une entité inconnue, un « & » nu et une référence numérique hors des caractères XML', () => {
    expect(() => lireXml('<a>&nbsp;</a>')).toThrow(/entité inconnue/i)
    expect(() => lireXml('<a>Père & Fils</a>')).toThrow(/«\s?&\s?»/)
    expect(() => lireXml('<a>&#0;</a>')).toThrow(/caractère/i)
    expect(() => lireXml('<a>&#xD800;</a>')).toThrow(/caractère/i)
  })

  it('refuse un document mal formé ou tronqué, avec la ligne en cause', () => {
    expect(() => lireXml('<a>\n<b></a>')).toThrow(/ligne 2/)
    expect(() => lireXml('<a><b>texte</b>')).toThrow(/tronqué.*<a>/)
    expect(() => lireXml('<a><b>tex')).toThrow(/tronqué/)
    expect(() => lireXml('<a><b att="x></b></a>')).toThrow()
    expect(() => lireXml('<a><!-- non fermé </a>')).toThrow(/commentaire/)
    expect(() => lireXml('<a><![CDATA[ non fermé </a>')).toThrow(/CDATA/)
    expect(() => lireXml('<a b="1" b="2"/>')).toThrow(/attribut/)
    expect(() => lireXml('<a b="1"c="2"/>')).toThrow()
    expect(() => lireXml('<a b="<"/>')).toThrow()
    expect(() => lireXml('texte <a/>')).toThrow(/hors/)
    expect(() => lireXml('<a/> texte')).toThrow(/hors/)
    expect(() => lireXml('')).toThrow(/aucun élément/)
    expect(() => lireXml('<p:a/>')).toThrow(/préfixe/)
    expect(() => lireXml('<a><?xml version="1.0"?></a>')).toThrow(/déclaration/)
  })

  it('refuse une imbrication excessive', () => {
    expect(() => lireXml('<a>'.repeat(300) + '</a>'.repeat(300))).toThrow(/profondeur/)
    expect(lireXml('<a>'.repeat(20) + '</a>'.repeat(20))).toHaveLength(1)
  })
})
