'use client'

import { useState } from 'react'
import { Alert } from '@/components/administrateur-judiciaire/ui/Alert'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'
import {
  LIBELLES_OBJECTIFS_ACTE_JUGE,
  TYPES_ACTES_JUGE,
  genererActeJuge,
  type ActeJugeRedige,
  type DefinitionActeJuge,
  type DossierImpayeActe,
  type ObjectifActeJuge,
  type TypeActeJuge,
} from '@/lib/administrateur-judiciaire/domain/actes/actes-juge'
import {
  proposerDocumentJuge,
  type PropositionDocumentJuge,
} from '@/lib/administrateur-judiciaire/domain/actes/dossier-juge'
import type { Fiche360Copropriete } from '@/lib/administrateur-judiciaire/domain/fiche-360'
import { regimeDepuisFondement } from '@/lib/administrateur-judiciaire/domain/fondements'
import { AUJOURDHUI_ISO } from '@/lib/administrateur-judiciaire/mode'

export interface RedactionAutomatiqueJugeProps {
  /** Fiche 360 de la copropriété (null : boutons de rédaction désactivés). */
  fiche: Fiche360Copropriete | null
  /** Dossiers de recouvrement de la base locale. */
  impayes: readonly DossierImpayeActe[]
}

/**
 * Mode IA de l'écran Dossier du juge : analyse du dossier (document et demandes proposés), rédaction automatique du
 * texte, puis relecture, copie dans le presse-papiers ou téléchargement en .txt. Rien n'est envoyé.
 * L'état n'est pas réinitialisé quand la fiche change (le parent ne passe pas de key), comme dans la maquette.
 */
export function RedactionAutomatiqueJuge({ fiche, impayes }: RedactionAutomatiqueJugeProps) {
  const { push } = useToast(),
    regime = fiche ? regimeDepuisFondement(fiche.vue.fondement) : null,
    [typeActe, setTypeActe] = useState<TypeActeJuge>(regime === 'ap291' ? 'rapport_intermediaire' : 'rapport_etape'),
    [objectifs, setObjectifs] = useState<ObjectifActeJuge[]>([]),
    [duree, setDuree] = useState('12'),
    [observations, setObservations] = useState(''),
    [signataire, setSignataire] = useState(''),
    [redaction, setRedaction] = useState<ActeJugeRedige | null>(null),
    [texte, setTexte] = useState(''),
    [analyse, setAnalyse] = useState<PropositionDocumentJuge | null>(null),
    basculerObjectif = (objectif: ObjectifActeJuge) =>
      setObjectifs((precedents) =>
        precedents.includes(objectif) ? precedents.filter((existant) => existant !== objectif) : [...precedents, objectif],
      ),
    rediger = (
      typeRedige: TypeActeJuge = typeActe,
      objectifsRediges: ObjectifActeJuge[] = objectifs,
      dureeRedigee: string | number = duree,
    ) => {
      if (!fiche) return
      const acte = genererActeJuge(
        fiche,
        impayes,
        {
          type: typeRedige,
          objectifs:
            typeRedige === 'requete_prorogation' && !objectifsRediges.includes('prorogation')
              ? [...objectifsRediges, 'prorogation']
              : objectifsRediges,
          dureeProrogation: Number(dureeRedigee) || 12,
          observations,
          signataire: signataire.trim() || undefined,
        },
        AUJOURDHUI_ISO,
      )
      setRedaction(acte)
      setTexte(acte.texte)
    },
    analyserEtRediger = () => {
      if (!fiche) return
      const proposition = proposerDocumentJuge(fiche, impayes, AUJOURDHUI_ISO)
      setAnalyse(proposition)
      setTypeActe(proposition.type)
      setObjectifs(proposition.objectifs)
      if (proposition.dureeProrogation) setDuree(String(proposition.dureeProrogation))
      rediger(proposition.type, proposition.objectifs, proposition.dureeProrogation || duree)
    },
    copier = async () => {
      try {
        await navigator.clipboard.writeText(texte)
        push({
          kind: 'success',
          title: 'Copié',
          desc: 'Le texte est dans le presse-papiers.',
        })
      } catch {
        push({
          kind: 'warn',
          title: 'Copie impossible',
          desc: 'Sélectionne le texte et copie-le à la main.',
        })
      }
    },
    telecharger = () => {
      try {
        const fichier = new Blob([texte], {
            type: 'text/plain;charset=utf-8',
          }),
          lien = document.createElement('a')
        lien.href = URL.createObjectURL(fichier)
        lien.download = `${(redaction?.titre || 'document').replace(/[^\wÀ-ÿ]+/g, '_')}_${AUJOURDHUI_ISO}.txt`
        lien.click()
        URL.revokeObjectURL(lien.href)
      } catch {
        push({
          kind: 'warn',
          title: 'Téléchargement impossible',
          desc: 'Copie le texte à la main.',
        })
      }
    },
    pointsACompleter = (texte.match(/\[À COMPLÉTER/g) || []).length
  return (
    <Panel
      title="Mode IA · rédaction automatique"
      sub="Un clic : Fixy analyse le dossier, choisit le document et les demandes, rédige tout ; tu relis, tu corriges, tu envoies"
      icon="sparkle"
      right={
        redaction ? (
          <Pill kind={pointsACompleter ? 'amber' : 'sage'} noDot>
            {pointsACompleter
              ? `${pointsACompleter} point${pointsACompleter > 1 ? 's' : ''} à compléter`
              : 'Prêt à relire'}
          </Pill>
        ) : null
      }
    >
      <div
        style={{
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          flexWrap: 'wrap',
          marginBottom: 12,
        }}
      >
        <button className="btn gold" onClick={analyserEtRediger} disabled={!fiche}>
          <Icon name="sparkle" />
          Analyser la situation et rédiger
        </button>
        <span
          style={{
            fontSize: 12,
            color: 'var(--navy-500)',
          }}
        >
          ou choisis toi-même ci-dessous, puis « Rédiger le texte ».
        </span>
      </div>
      {analyse && (
        <Alert
          kind="info"
          icon="search"
          title={`Analyse du dossier : ${TYPES_ACTES_JUGE[analyse.type].libelle.toLowerCase()}${analyse.objectifs.length ? ' · ' + analyse.objectifs.map((objectif) => LIBELLES_OBJECTIFS_ACTE_JUGE[objectif].toLowerCase()).join(' · ') : ''}`}
        >
          <ul
            style={{
              margin: '4px 0 0',
              paddingLeft: 18,
            }}
          >
            {analyse.motifs.map((motif, index) => (
              <li key={index}>{motif}</li>
            ))}
          </ul>
        </Alert>
      )}
      <div
        style={{
          display: 'grid',
          gap: 10,
          gridTemplateColumns: 'minmax(220px, 1fr) minmax(220px, 1fr)',
        }}
      >
        <label
          style={{
            display: 'grid',
            gap: 4,
            fontSize: 12,
          }}
        >
          Document
          <select
            aria-label="Type de document"
            value={typeActe}
            onChange={(evenement) => setTypeActe(evenement.target.value as TypeActeJuge)}
          >
            {(Object.entries(TYPES_ACTES_JUGE) as [TypeActeJuge, DefinitionActeJuge][]).map(([cle, definition]) => (
              <option value={cle} key={cle}>
                {definition.libelle}
                {' · '}
                {definition.base}
              </option>
            ))}
          </select>
          <span
            style={{
              color: 'var(--navy-300)',
            }}
          >
            {TYPES_ACTES_JUGE[typeActe].quand}
          </span>
        </label>
        <label
          style={{
            display: 'grid',
            gap: 4,
            fontSize: 12,
          }}
        >
          Signataire (facultatif)
          <input
            type="text"
            aria-label="Signataire"
            value={signataire}
            onChange={(evenement) => setSignataire(evenement.target.value)}
            placeholder="Nom et qualité"
          />
        </label>
      </div>
      <div
        style={{
          marginTop: 10,
          fontSize: 12,
        }}
      >
        Ce que tu veux dire au juge :
      </div>
      <div
        style={{
          display: 'flex',
          gap: 6,
          flexWrap: 'wrap',
          marginTop: 6,
        }}
      >
        {(Object.entries(LIBELLES_OBJECTIFS_ACTE_JUGE) as [ObjectifActeJuge, string][]).map(([cle, libelle]) => (
          <button
            className={`btn ${objectifs.includes(cle) || (cle === 'prorogation' && typeActe === 'requete_prorogation') ? 'gold' : ''}`}
            style={{
              fontSize: 12,
            }}
            aria-pressed={objectifs.includes(cle)}
            onClick={() => basculerObjectif(cle)}
            key={cle}
          >
            {libelle}
          </button>
        ))}
      </div>
      {(objectifs.includes('prorogation') || typeActe === 'requete_prorogation') && (
        <label
          style={{
            display: 'inline-grid',
            gap: 4,
            fontSize: 12,
            marginTop: 8,
          }}
        >
          Durée de prorogation demandée (mois)
          <input
            type="number"
            min="1"
            aria-label="Durée de prorogation"
            value={duree}
            onChange={(evenement) => setDuree(evenement.target.value)}
            style={{
              maxWidth: 120,
            }}
          />
        </label>
      )}
      <textarea
        aria-label="Observations complémentaires"
        value={observations}
        onChange={(evenement) => setObservations(evenement.target.value)}
        rows={2}
        style={{
          width: '100%',
          fontSize: 13,
          marginTop: 8,
        }}
        placeholder="Observations complémentaires, reprises telles quelles dans le texte (facultatif)"
      />
      <div
        style={{
          marginTop: 10,
        }}
      >
        <button className="btn" onClick={() => rediger()} disabled={!fiche}>
          <Icon name="pencil" />
          Rédiger le texte
        </button>
      </div>
      {redaction && (
        <div
          style={{
            marginTop: 14,
          }}
        >
          {redaction.signalements.length > 0 && (
            <Alert
              kind="warn"
              icon="alert"
              title={`${redaction.signalements.length} point${redaction.signalements.length > 1 ? 's' : ''} à vérifier avant envoi`}
            >
              {redaction.signalements.join(' · ')}
            </Alert>
          )}
          <textarea
            aria-label="Texte rédigé"
            value={texte}
            onChange={(evenement) => setTexte(evenement.target.value)}
            rows={28}
            style={{
              width: '100%',
              fontSize: 13,
              lineHeight: 1.55,
              fontFamily: 'Manrope, system-ui, sans-serif',
            }}
          />
          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              marginTop: 8,
              alignItems: 'center',
            }}
          >
            <button className="btn" onClick={copier}>
              <Icon name="doc" />
              Copier
            </button>
            <button className="btn" onClick={telecharger}>
              <Icon name="download" />
              Télécharger (.txt)
            </button>
            <span
              style={{
                fontSize: 11.5,
                color: 'var(--navy-300)',
              }}
            >
              {texte.split(/\s+/).filter(Boolean).length}
              {
                " mots · les mentions [À COMPLÉTER] sont à remplacer avant envoi · rien n'est envoyé depuis cet écran."
              }
            </span>
          </div>
        </div>
      )}
    </Panel>
  )
}
