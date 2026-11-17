// @vitest-environment node
// La recherche du Dictionnaire matériaux passe par un index de vocabulaire (lib/dictionnaire-materiaux/recherche.ts).
// Ce test garde, comme référence, le classement fait sans index : chaque mot tapé comparé à chaque mot de chaque
// fiche, avec les mêmes champs pondérés et la même qualité de correspondance. Les deux doivent rendre exactement les
// mêmes fiches, dans le même ordre et avec le même score, sur des centaines de saisies tirées des vraies données
// (titres, mots-clés, noms, débuts de mot, fautes de frappe, mots combinés, tailles). Une recherche doit aussi rester
// rapide : elle tourne à chaque lettre tapée.

import { describe, expect, it } from 'vitest'
import { dictionnairePour, type Dictionnaire, type Materiau, type Situation } from '@/lib/dictionnaire-materiaux'
import {
  POINTS_MESURE_MAX,
  champsMateriau,
  champsSituation,
  motsDeLaSaisie,
  motsExiges,
  motsUtiles,
  qualite,
  rechercher,
  type ChampRecherche,
  type OptionsRecherche,
  type ResultatRecherche,
} from '@/lib/dictionnaire-materiaux/recherche'
import { DICO_ESSAI } from './dictionnaire-essai'

// ── Référence : le classement sans index ──
interface Fiche<T> { element: T; champs: ChampRecherche[]; titre: string; libelle: string }

function fichesDe(dico: Dictionnaire): { situations: Array<Fiche<Situation>>; materiaux: Array<Fiche<Materiau>> } {
  const materiauParId = new Map(dico.materiaux.map((m) => [m.id, m]))
  return {
    situations: dico.situations.map((s) => ({
      element: s, champs: champsSituation(dico, s, materiauParId), titre: motsUtiles(s.titre, dico.langue).join(' '), libelle: s.titre,
    })),
    materiaux: dico.materiaux.map((m) => ({
      element: m, champs: champsMateriau(dico, m), titre: motsUtiles(m.nom, dico.langue).join(' '), libelle: m.nom,
    })),
  }
}

function classerReference<T>(fiches: Array<Fiche<T>>, mots: string[], limite: number): Array<ResultatRecherche<T>> {
  const exiges = motsExiges(mots)
  const requete = mots.filter((_, rang) => exiges[rang]).join(' ')
  const nombreExiges = exiges.filter(Boolean).length
  const notes = fiches.map((fiche) => {
    let score = 0
    let trouves = 0
    mots.forEach((mot, rang) => {
      let meilleure = 0
      for (const c of fiche.champs) {
        for (const indexe of c.mots) {
          const valeur = c.poids * qualite(mot, indexe)
          if (valeur > meilleure) meilleure = valeur
        }
      }
      if (meilleure > 0 && exiges[rang]) trouves++
      // Une mesure non exigée départage seulement.
      score += exiges[rang] ? meilleure : Math.min(meilleure, POINTS_MESURE_MAX)
    })
    if (trouves > 0 && fiche.titre === requete) score += 30
    else if (trouves > 0 && fiche.titre.startsWith(requete)) score += 15
    return { fiche, score, trouves }
  })
  const trouvees = notes.filter((n) => n.trouves > 0)
  const completes = trouvees.filter((n) => n.trouves === nombreExiges)
  const retenues = completes.length > 0 ? completes : trouvees
  return retenues
    .sort((a, b) => b.trouves - a.trouves || b.score - a.score || a.fiche.libelle.localeCompare(b.fiche.libelle))
    .slice(0, limite)
    .map((n) => ({ element: n.fiche.element, score: n.score }))
}

const FICHES = new WeakMap<Dictionnaire, ReturnType<typeof fichesDe>>()
function rechercherReference(dico: Dictionnaire, saisie: string, options: OptionsRecherche = {}) {
  const mots = motsDeLaSaisie(dico, saisie)
  if (mots.length === 0) return { situations: [], materiaux: [] }
  const fiches = FICHES.get(dico) ?? fichesDe(dico)
  FICHES.set(dico, fiches)
  return {
    situations: classerReference(fiches.situations, mots, options.limiteSituations ?? 12),
    materiaux: classerReference(fiches.materiaux, mots, options.limiteMateriaux ?? 24),
  }
}

// ── Saisies d'essai tirées des données ──
function saisiesDe(dico: Dictionnaire, nombre: number): string[] {
  const textes = [
    ...dico.situations.flatMap((s) => [s.titre, ...s.motsCles]),
    ...dico.materiaux.flatMap((m) => [m.nom, m.recherche, ...m.aussiAppele.slice(0, 2)]),
    ...dico.familles.flatMap((f) => [f.nom, ...f.sousFamilles.map((sf) => sf.nom)]),
  ]
  // Tirage déterministe, régulier dans toute la liste.
  const pas = Math.max(1, Math.floor(textes.length / nombre))
  const choisis = textes.filter((_, i) => i % pas === 0).slice(0, nombre)
  const saisies = new Set<string>()
  choisis.forEach((texte, i) => {
    saisies.add(texte)
    const mots = texte.split(/\s+/).filter(Boolean)
    const premier = mots[0] ?? ''
    // Mot en cours de saisie.
    if (premier.length > 4) saisies.add(premier.slice(0, 3 + (i % 3)))
    // Faute de frappe : deux lettres inversées dans un mot long.
    const long = mots.find((m) => m.length >= 6)
    if (long) saisies.add(texte.replace(long, `${long.slice(0, 2)}${long[3]}${long[2]}${long.slice(4)}`))
    // Deux mots de deux textes différents (souvent aucune fiche ne réunit les deux : repli sur les correspondances partielles).
    const autre = choisis[(i * 7 + 3) % choisis.length]?.split(/\s+/)[0]
    if (autre && premier) saisies.add(`${premier} ${autre}`)
    // Une taille ajoutée (« … 6 mm »), qui départage sans écarter.
    if (i % 5 === 0) saisies.add(`${premier} ${(i % 3) * 4 + 6} mm`)
  })
  return [
    ...saisies,
    'silicone', 'espatula', 'infiltracao fachada', 'silicone 8', 'silicone 280ml', 'para', '8 mm', 'lã', 'lã de rocha',
    'tinta 15l', 'fita 50m', 'cabo 2,5mm2', 'brocas 6 mm', 'xyzzy inexistant',
  ]
}

const ids = (r: ReturnType<typeof rechercher>) => ({
  situations: r.situations.map((x) => [x.element.id, x.score]),
  materiaux: r.materiaux.map((x) => [x.element.id, x.score]),
})

describe('recherche du Dictionnaire matériaux — index de vocabulaire', () => {
  it('rend exactement les mêmes résultats que le classement sans index (dictionnaire d’essai)', () => {
    for (const saisie of saisiesDe(DICO_ESSAI, 60)) {
      expect(ids(rechercher(DICO_ESSAI, saisie)), saisie).toEqual(ids(rechercherReference(DICO_ESSAI, saisie)))
    }
  })

  it('rend exactement les mêmes résultats que le classement sans index (vraies données du Portugal)', () => {
    const dico = dictionnairePour('PT') as Dictionnaire
    const saisies = saisiesDe(dico, 120)
    expect(saisies.length).toBeGreaterThan(300)
    for (const saisie of saisies) {
      expect(ids(rechercher(dico, saisie)), saisie).toEqual(ids(rechercherReference(dico, saisie)))
    }
    // Limites passées en option : même découpe.
    for (const saisie of saisies.slice(0, 40)) {
      const options = { limiteSituations: 3, limiteMateriaux: 5 }
      expect(ids(rechercher(dico, saisie, options)), saisie).toEqual(ids(rechercherReference(dico, saisie, options)))
    }
  }, 300_000)

  it('reste rapide à chaque lettre tapée, même après un long texte collé', () => {
    const dico = dictionnairePour('PT') as Dictionnaire
    rechercher(dico, 'x') // construit l'index
    const frappe = 'infiltracao em fachada com fissuras'
    const debut = performance.now()
    let n = 0
    for (let essai = 0; essai < 3; essai++) {
      // Chaque préfixe de la phrase, comme pendant la saisie, plus des saisies variées.
      for (let i = 1; i <= frappe.length; i++, n++) rechercher(dico, frappe.slice(0, i))
      for (const m of dico.materiaux.slice(0, 100)) { rechercher(dico, `${m.nom} ${essai}`); n++ }
    }
    const moyenne = (performance.now() - debut) / n
    // Avant l'index : environ 100 ms par recherche sur un portable modeste. Seuil large, pour ne pas dépendre de la machine.
    expect(moyenne).toBeLessThan(25)

    // Un message de chantier collé dans la recherche (des centaines de mots) : seuls les premiers mots comptent.
    const colle = Array.from({ length: 800 }, (_, i) => `palavra${i}`).join(' ')
    const debutColle = performance.now()
    for (let i = 0; i < 5; i++) rechercher(dico, `${colle} x${i}`)
    expect((performance.now() - debutColle) / 5).toBeLessThan(200)
  }, 120_000)
})
