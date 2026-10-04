'use client'

import { useRef, useState, type ChangeEvent } from 'react'
import type { Fixy } from '@/components/administrateur-judiciaire/modules/agents-ia/fixy/useFixy'
import { Alert } from '@/components/administrateur-judiciaire/ui/Alert'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import type { CoproprieteVue } from '@/lib/administrateur-judiciaire/domain/coproprietes'
import {
  ajouterMois,
  dateIsoVersFr,
  dateVersIso,
  decomposerDateIso,
} from '@/lib/administrateur-judiciaire/domain/dates'
import type { LectureOrdonnance } from '@/lib/administrateur-judiciaire/domain/fixy/lecture-ordonnance'
import { AUJOURDHUI_ISO } from '@/lib/administrateur-judiciaire/mode'

/** Ordonnance d'exemple (bouton « Exemple »). */
const ORDONNANCE_EXEMPLE =
  "TRIBUNAL JUDICIAIRE DE NANTERRE. Ordonnance sur requête rendue le 12 mars 2026, RG : 26/01234. Vu l'article 46 du décret du 17 mars 1967 ; Nous désignons le Cabinet Delaunay en qualité de syndic judiciaire de la copropriété Résidence du Parc, sise 14 avenue des Tilleuls, 92100 Boulogne-Billancourt, 36 lots, pour une durée de 12 mois. Motif : carence de l'assemblée générale dans la désignation d'un syndic."

/** Lecture sans champ obligatoire manquant : les champs obligatoires sont alors tous renseignés. */
type LectureOrdonnanceComplete = LectureOrdonnance & {
  nom: string
  adresse: string
  tribunal: string
  rg: string
  date: string
  fondement: string
  dureeMois: number
}

const estLectureComplete = (lecture: LectureOrdonnance): lecture is LectureOrdonnanceComplete =>
  lecture.manquants.length === 0

/** Ligne « libellé / valeur » du résultat de lecture ; valeur absente → « à compléter » en rouille. */
function LigneChampOrdonnance({ libelle, valeur }: { libelle: string; valeur: string | null }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 12,
        padding: '6px 0',
        borderBottom: '1px solid var(--line)',
        fontSize: 13,
      }}
    >
      <span
        style={{
          color: 'var(--navy-500)',
        }}
      >
        {libelle}
      </span>
      <span
        style={{
          fontWeight: 600,
          textAlign: 'right',
          color: valeur ? 'inherit' : 'var(--rust-500)',
        }}
      >
        {valeur || 'à compléter'}
      </span>
    </div>
  )
}

export interface FixyOrdonnanceProps {
  fixy: Fixy
}

/**
 * Nouveau mandat depuis une ordonnance : texte collé ou fichier .txt déposé, lecture des champs, puis création de la
 * copropriété et de son mandat (un clic vaut confirmation) avec le texte conservé comme source.
 *
 * Deux défauts de la maquette sont corrigés dans `creerMandat`, sans rien changer au rendu :
 * - un clic pendant une création déjà en cours (double clic, base lente) est ignoré : il créait une seconde
 *   copropriété, un second mandat et une seconde source sous le même code ;
 * - une ordonnance dont l'échéance du mandat tomberait au-delà de l'an 9999 (ordonnance datée de 9999) est refusée
 *   par le chemin d'erreur existant (toast « Création impossible ») : enregistrée, cette échéance à cinq chiffres
 *   faisait lever le formatage des dates sur tous les écrans, à chaque chargement.
 */
export function FixyOrdonnance({ fixy }: FixyOrdonnanceProps) {
  const [texte, setTexte] = useState('')
  const [lecture, setLecture] = useState<LectureOrdonnance | null>(null)
  const [mandatCree, setMandatCree] = useState<CoproprieteVue | null>(null)
  // Verrou de création : une référence (et non un état) pour ne rien changer au bouton (ni `disabled`, ni rendu).
  const creationEnCoursRef = useRef(false)

  const deposerFichier = (evenement: ChangeEvent<HTMLInputElement>) => {
    const fichier = evenement.target.files && evenement.target.files[0]
    if (!fichier) return
    const lecteur = new FileReader()
    lecteur.onload = () => {
      setTexte(String(lecteur.result || ''))
      setLecture(null)
    }
    lecteur.readAsText(fichier, 'utf-8')
  }

  const creerMandat = async () => {
    if (!lecture || !estLectureComplete(lecture)) return
    if (creationEnCoursRef.current) return
    creationEnCoursRef.current = true
    try {
      const [annee, mois, jour] = lecture.date.split('-').map(Number)
      const ordonnance = new Date(annee, mois - 1, jour)
      // Échéance calculée comme createCopropriete : si elle sort des dates ISO à 4 chiffres (an 10000),
      // decomposerDateIso lève « Date ISO invalide » avant toute écriture en base.
      const ordonnanceIso = dateVersIso(ordonnance)
      if (ordonnanceIso) decomposerDateIso(ajouterMois(ordonnanceIso, lecture.dureeMois))
      const copro = await fixy.p.createCopropriete({
        nom: lecture.nom,
        adresse: lecture.adresse,
        nbLots: lecture.lots || 0,
        rg: lecture.rg,
        fondement: lecture.fondement,
        ordonnance,
        dureeMois: lecture.dureeMois,
        tribunal: lecture.tribunal,
        motif: lecture.motif || '',
        source: {
          nom: `Ordonnance déposée le ${dateIsoVersFr(AUJOURDHUI_ISO)} (texte)`,
        },
      })
      setMandatCree(copro)
      fixy.push({
        kind: 'success',
        title: 'Mandat créé',
        desc: `${copro.nom} · ${copro.code} · source conservée.`,
      })
    } catch (erreur) {
      fixy.push({
        kind: 'warn',
        title: 'Création impossible',
        desc: erreur instanceof Error ? erreur.message : String(erreur),
      })
    } finally {
      creationEnCoursRef.current = false
    }
  }

  return (
    <>
      <div
        style={{
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <input type="file" accept=".txt,text/plain" aria-label="Fichier d'ordonnance" onChange={deposerFichier} />
        <button
          className="btn"
          onClick={() => {
            setTexte(ORDONNANCE_EXEMPLE)
            setLecture(null)
          }}
        >
          Exemple
        </button>
        <button className="btn gold" onClick={() => setLecture(fixy.lireOrdonnance(texte))} disabled={!texte.trim()}>
          <Icon name="search" />
          {"Lire l'ordonnance"}
        </button>
      </div>
      <textarea
        aria-label="Texte de l'ordonnance"
        value={texte}
        onChange={(evenement) => {
          setTexte(evenement.target.value)
          setLecture(null)
        }}
        rows={5}
        style={{
          width: '100%',
          fontSize: 13,
        }}
        placeholder="Colle le texte de l'ordonnance (ou dépose un fichier .txt). Le PDF viendra avec un service de lecture (D3)."
      />
      {lecture && (
        <div
          style={{
            marginTop: 12,
          }}
        >
          <LigneChampOrdonnance libelle="Copropriété" valeur={lecture.nom} />
          <LigneChampOrdonnance libelle="Adresse" valeur={lecture.adresse} />
          <LigneChampOrdonnance libelle="Tribunal" valeur={lecture.tribunal} />
          <LigneChampOrdonnance libelle="RG" valeur={lecture.rg} />
          <LigneChampOrdonnance
            libelle="Date de l'ordonnance"
            valeur={lecture.date ? dateIsoVersFr(lecture.date) : null}
          />
          <LigneChampOrdonnance libelle="Fondement" valeur={lecture.fondement} />
          <LigneChampOrdonnance libelle="Durée" valeur={lecture.dureeMois ? `${lecture.dureeMois} mois` : null} />
          <LigneChampOrdonnance libelle="Lots" valeur={lecture.lots ? String(lecture.lots) : null} />
          <LigneChampOrdonnance libelle="Motif" valeur={lecture.motif} />
          {lecture.manquants.length > 0 && (
            <Alert kind="warn" icon="alert" title="Champs non trouvés dans le texte">
              {lecture.manquants.join(', ')}
              {" : complète-les dans le texte, ou crée le mandat depuis l'écran Copropriétés."}
            </Alert>
          )}
          {mandatCree ? (
            <Alert kind="ok" icon="check" title={`Mandat créé : ${mandatCree.nom} (${mandatCree.code})`}>
              {'Les échéances légales sont calculées ; la source est rattachée au mandat. '}
              <button
                className="btn"
                style={{
                  marginLeft: 8,
                }}
                onClick={() =>
                  fixy.executer({
                    type: 'naviguer',
                    params: {
                      route: 'fiche360',
                      code: mandatCree.code,
                    },
                  })
                }
              >
                Ouvrir la fiche 360
              </button>
            </Alert>
          ) : (
            <div
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                marginTop: 10,
                flexWrap: 'wrap',
              }}
            >
              <button className="btn gold" onClick={creerMandat} disabled={lecture.manquants.length > 0}>
                <Icon name="check" />
                Créer le mandat avec cette source
              </button>
              <span
                style={{
                  fontSize: 11.5,
                  color: 'var(--navy-300)',
                }}
              >
                {
                  'Crée la copropriété et son mandat, calcule les échéances, conserve le texte déposé comme source. Un clic vaut confirmation.'
                }
              </span>
            </div>
          )}
        </div>
      )}
    </>
  )
}
