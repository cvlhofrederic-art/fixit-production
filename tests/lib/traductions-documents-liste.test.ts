// @vitest-environment node
// Textes des listes Devis et Factures (proDash.documentsListe) : chaque clé existe en français ET en portugais,
// non vide, et toutes les clés que les écrans demandent existent — sinon l'écran afficherait la clé brute
// (« proDash.documentsListe.filtresFactures.emises ») à un compte portugais.
import { describe, it, expect } from 'vitest'
import fr from '@/locales/fr.json'
import pt from '@/locales/pt.json'

type Arbre = { [cle: string]: string | Arbre }

function feuilles(arbre: Arbre, prefixe = ''): Map<string, string> {
  const resultat = new Map<string, string>()
  for (const [cle, valeur] of Object.entries(arbre)) {
    const chemin = prefixe ? `${prefixe}.${cle}` : cle
    if (typeof valeur === 'string') resultat.set(chemin, valeur)
    else for (const [c, v] of feuilles(valeur, chemin)) resultat.set(c, v)
  }
  return resultat
}

const FR = feuilles((fr as unknown as { proDash: { documentsListe: Arbre } }).proDash.documentsListe)
const PT = feuilles((pt as unknown as { proDash: { documentsListe: Arbre } }).proDash.documentsListe)

// Clés demandées par OutilsListeDocuments, DevisSection et FacturesSection (listes V5).
const CLES_UTILISEES = [
  'toutTelecharger', 'telechargerSelection', 'titreToutTelecharger', 'titreSelection', 'deselectionner',
  'preparation', 'toutSelectionner', 'selectionner', 'telecharges', 'unTelecharge', 'echecsPartiels', 'aucunPdf',
  'reessayez', 'etUnAutre', 'etAutres', 'annuler', 'annulationEnCours', 'annule', 'erreurArchive', 'archiveDevis',
  'archiveFactures',
  ...['tous', 'horsBrouillons', 'brouillons', 'envoyes', 'acceptes', 'refuses'].map(c => `filtresDevis.${c}`),
  ...['toutes', 'horsBrouillons', 'emises', 'payees', 'brouillons'].map(c => `filtresFactures.${c}`),
  ...['tous', 'factures', 'acomptes', 'avoirs'].map(c => `filtresTypeFactures.${c}`),
  ...['numero', 'client', 'intitule', 'chantier', 'adresseClient', 'contact', 'maitreOuvrage', 'documentLie',
    'lignes', 'notes', 'date', 'montant'].map(c => `champs.${c}`),
]

describe('traductions des listes Devis et Factures', () => {
  it('mêmes clés en français et en portugais, aucune vide', () => {
    expect([...PT.keys()].sort((a, b) => a.localeCompare(b))).toEqual([...FR.keys()].sort((a, b) => a.localeCompare(b)))
    for (const [cle, valeur] of [...FR, ...PT]) expect(valeur.trim(), cle).not.toBe('')
  })

  it('toutes les clés demandées par les écrans existent dans les deux langues', () => {
    for (const cle of CLES_UTILISEES) {
      expect(FR.has(cle), `fr : ${cle}`).toBe(true)
      expect(PT.has(cle), `pt : ${cle}`).toBe(true)
    }
  })

  it('les puces des factures restent en français pour les comptes français, et sont traduites en portugais', () => {
    expect(['toutes', 'emises', 'payees', 'brouillons'].map(c => FR.get(`filtresFactures.${c}`))).toEqual(['Toutes', 'Émises', 'Payées', 'Brouillons'])
    expect(['tous', 'factures', 'acomptes', 'avoirs'].map(c => FR.get(`filtresTypeFactures.${c}`))).toEqual(['Tous', 'Factures', 'Acomptes', 'Avoirs'])
    expect(PT.get('filtresFactures.emises')).toBe('Emitidas')
    expect(PT.get('filtresTypeFactures.acomptes')).toBe('Adiantamentos')
  })

  it('« {n} » présent là où le nombre est remplacé', () => {
    expect(FR.get('etAutres')).toContain('{n}')
    expect(PT.get('etAutres')).toContain('{n}')
  })
})
