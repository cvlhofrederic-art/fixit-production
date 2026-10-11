'use client'

import { useState } from 'react'
import MarkdownIA from '@/components/common/MarkdownIA'
import { DEMO_ANALYSES_DEVIS_FACTURES } from '@/components/administrateur-judiciaire/data/analyses-devis-factures'
import {
  STYLE_BOUTON_ATTENTE,
  demanderTexteOutilIA,
  messageErreurOutilIA,
} from '@/components/administrateur-judiciaire/modules/outils-ia/appelOutilIA'
import { Field, FieldRow } from '@/components/administrateur-judiciaire/ui/Field'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'
import { TAILLE_MAX_TEXTE_DEVIS } from '@/lib/administrateur-judiciaire/ia/outils'
import { dateLocaleIso } from '@/lib/administrateur-judiciaire/mode'

/**
 * Analyse de devis & factures (Technique & travaux, surtitre « Assistant · IA »). « Analyser » envoie le texte collé
 * à l'assistant IA (Claude, via /api/administrateur-judiciaire/outils) : cohérence des prix, TVA, mentions légales,
 * points à négocier et verdict, affichés sous le formulaire. Champ vide : toast d'invite ; échec : toast, aucun
 * résultat fictif. « Analyses récentes » reste la liste de démonstration de la maquette.
 */
export function AnalyseDevisFacturesModule() {
  const { push } = useToast()
  const [contenu, setContenu] = useState('')
  const [analyse, setAnalyse] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)

  const analyser = async () => {
    if (enCours) return
    const texte = contenu.trim()
    if (!texte) {
      push({
        kind: 'info',
        title: 'Aucun document à analyser',
        desc: 'Collez le texte du devis ou de la facture, puis cliquez sur « Analyser ».',
      })
      return
    }
    if (texte.length > TAILLE_MAX_TEXTE_DEVIS) {
      push({
        kind: 'warning',
        title: 'Document trop long',
        desc: `Collez au plus ${TAILLE_MAX_TEXTE_DEVIS.toLocaleString('fr-FR')} caractères (le détail des postes et les totaux suffisent).`,
      })
      return
    }
    setEnCours(true)
    setAnalyse(null)
    try {
      // Date réelle (pas la date figée de la démonstration) : un devis collé est daté d'aujourd'hui.
      setAnalyse(await demanderTexteOutilIA({ tache: 'analyse-devis', texte, dateDuJour: dateLocaleIso(new Date()) }))
    } catch (erreur) {
      push({ kind: 'error', title: 'Analyse impossible', desc: messageErreurOutilIA(erreur) })
    } finally {
      setEnCours(false)
    }
  }

  return (
    <>
      <PageHead
        eyebrow="Assistant · IA"
        title="Analyse de devis & factures"
        lede="Contrôle des devis et factures : cohérence des prix, TVA, mentions légales (outil d'aide à la décision)."
      />
      <Panel title="Analyser un document" icon="sparkle">
        <FieldRow>
          <Field label="Coller le contenu du devis / de la facture" full>
            <textarea
              aria-label="Contenu du devis ou de la facture"
              rows={4}
              value={contenu}
              onChange={(evenement) => setContenu(evenement.target.value)}
              placeholder="Coller ici le texte du devis ou de la facture…"
              style={{
                width: '100%',
                resize: 'vertical',
              }}
            />
          </Field>
        </FieldRow>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            className="btn gold"
            onClick={() => void analyser()}
            disabled={enCours}
            aria-busy={enCours || undefined}
            style={enCours ? STYLE_BOUTON_ATTENTE : undefined}
          >
            <Icon name="sparkle" />
            Analyser
          </button>
        </div>
        {enCours && (
          <div
            role="status"
            style={{
              marginTop: 12,
              fontSize: 13,
              color: 'var(--navy-500)',
            }}
          >
            Analyse du document en cours…
          </div>
        )}
        {analyse && (
          <section
            aria-label="Résultat de l'analyse"
            style={{
              marginTop: 14,
              padding: 16,
              border: '1px solid var(--line)',
              borderRadius: 10,
              fontSize: 13.5,
              lineHeight: 1.6,
              color: 'var(--navy-700)',
            }}
          >
            <MarkdownIA texte={analyse} />
          </section>
        )}
      </Panel>
      <div
        style={{
          height: 14,
        }}
      />
      <Panel title="Analyses récentes" icon="coin">
        <div className="card-grid cols-2">
          {DEMO_ANALYSES_DEVIS_FACTURES.map(([document, montant, verdict, commentaire, teinte], index) => (
            <div
              style={{
                padding: 16,
                border: '1px solid var(--line)',
                borderRadius: 10,
                background: `var(--${teinte}-50)`,
                borderLeft: `3px solid var(--${teinte}-500)`,
              }}
              key={index}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 8,
                  marginBottom: 4,
                }}
              >
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: 13.5,
                  }}
                >
                  {document}
                </div>
                <Pill kind={teinte} noDot>
                  {verdict}
                </Pill>
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontFamily: 'JetBrains Mono, monospace',
                  color: 'var(--navy-600)',
                  marginBottom: 6,
                }}
              >
                {montant}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--navy-500)',
                }}
              >
                {commentaire}
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </>
  )
}
