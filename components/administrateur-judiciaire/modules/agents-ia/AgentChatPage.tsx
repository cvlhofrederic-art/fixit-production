'use client'

/* eslint-disable @next/next/no-img-element -- fidélité DOM : mascottes en <img> simples, comme dans la maquette */

import { useRef, useState, type FormEvent } from 'react'
import { Alert } from '@/components/administrateur-judiciaire/ui/Alert'
import { AVATARS_AGENTS, type IdAgentAvatar } from '@/components/administrateur-judiciaire/ui/avatars'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'

/** Domaine des réponses simulées (« ops » : onglet Assistant de Fixy, repris de la maquette 13_M1). */
export type DomaineAgent = 'juridique' | 'compta' | 'ops' | 'echeances'

/** Tranche de l'historique des conversations. */
export type TrancheConversation = 'hier' | 'cette-semaine' | 'plus-anciennes'

export interface ConversationAgent {
  id: string
  title: string
  bucket: TrancheConversation
}

export interface AlerteAgent {
  kind: string
  icon: string
  title: string
}

/** Sélecteur de contexte (ex. copropriété) : sa valeur n'a aucun effet sur les réponses. */
export interface SelecteurContexteAgent {
  label: string
  options: readonly string[]
}

export interface MessageAgent {
  role: 'me' | 'bot'
  text: string
}

export interface AgentChatPageProps {
  mascot: IdAgentAvatar
  name: string
  title: string
  intro: string
  introDetail?: string
  suggestions?: readonly string[]
  conversations?: readonly ConversationAgent[]
  alert?: AlerteAgent
  contextSelector?: SelecteurContexteAgent
  showDocsBtn?: boolean
  inputPlaceholder?: string
  domain?: DomaineAgent
}

const TRANCHES_CONVERSATIONS: TrancheConversation[] = ['hier', 'cette-semaine', 'plus-anciennes']

const LIBELLES_TRANCHES: Record<TrancheConversation, string> = {
  hier: 'HIER',
  'cette-semaine': 'CETTE SEMAINE',
  'plus-anciennes': 'PLUS ANCIENNES',
}

/**
 * Réponse simulée d'un agent : mots-clés cherchés dans la question en minuscules, dans l'ordre (le premier trouvé
 * l'emporte), avec une réponse par défaut par domaine. `prenom` n'apparaît que dans la réponse juridique par défaut.
 */
export function repondreAgentSimule(domaine: DomaineAgent, question: string, prenom: string): string {
  const q = question.toLowerCase()
  if (domaine === 'compta') {
    if (q.includes('anomal'))
      return "J'ai relevé 3 points ce mois : un prélèvement EDF de 412 € sans facture rattachée (Le Méridien), un double encaissement de 340 € à régulariser (M. Bernard) et un écart de 1 800 € sur le poste chauffage. Je propose les écritures de correction."
    if (q.includes('reddition'))
      return 'Pour la reddition des Tilleuls : annexes 1 à 5 (décret du 14 mars 2005) générées depuis le compte séparé. Solde rapproché au 31/05, charges réparties par tantièmes, fonds travaux isolé. Reste 2 factures à valider.'
    if (q.includes('fonds'))
      return 'Fonds de travaux (ALUR, 5 % du budget) : Le Méridien 14 200 €, Le Clos des Vignes 31 400 €, Les Tilleuls 2 100 € (insuffisant), Villa Montaigne 6 300 €. Total 54 000 €.'
    if (q.includes('rapproch') || q.includes('appel') || q.includes('encaiss'))
      return 'Rapprochement T2 : 142 000 € appelés, 133 540 € encaissés sur le compte séparé (94 %). 4 copropriétaires en retard pour 8 460 €. Je prépare les relances.'
    return "Côté comptabilité, je m'appuie sur le compte bancaire séparé et le plan comptable du syndicat (décret du 14 mars 2005). Je contrôle les écritures, prépare la reddition et détecte les anomalies."
  }
  if (domaine === 'ops') {
    if (q.includes('attente') || q.includes('validation'))
      return '3 interventions en attente de validation : étanchéité toiture des Tilleuls (Couverture ÎdF, 18 400 €), dépannage ascenseur du Méridien (OTIS), éclairage du hall de Villa Montaigne (devis ELEC92 attendu).'
    if (q.includes('ordre') || q.includes('fuite') || q.includes('service'))
      return "Je prépare l'ordre de mission : copropriété, métier, localisation (étage), gardien à contacter, code d'accès et description. Il part au prestataire référencé et l'échange est tracé dans le Canal jusqu'à validation par l'artisan."
    if (q.includes('prestataire') || q.includes('plomb') || q.includes('référenc'))
      return 'Plomberie/chauffage : Atlantic Plomberie SARL (4,8, décennale à jour). Électricité : ELEC92 Services. Ascenseur : OTIS (contrat cadre). Couverture : Couverture Île-de-France.'
    if (q.includes('point') || q.includes('clos'))
      return 'Point opérationnel du Clos des Vignes : 48 lots, budget 198 000 €, 2 interventions en cours, fonds travaux 31 400 €. Aucune urgence technique ; AG à préparer pour juillet.'
    return 'Assistant opérationnel, je coordonne interventions, ordres de mission et prestataires. Que souhaitez-vous lancer ?'
  }
  if (domaine === 'echeances') {
    if (q.includes('automatis') || q.includes('active') || q.includes('cours'))
      return '7 automatisations configurées, 6 actives : sauvegarde hebdomadaire, relance des impayés (lundi 10 h), alerte échéance J-90, rapport mensuel au tribunal, notification des ordonnances, relance de taxation. La convocation AG est en pause.'
    if (q.includes('échou') || q.includes('echou') || q.includes('échec') || q.includes('echec'))
      return 'Une exécution a échoué cette semaine : relance des quotas du 21 mai (e-mail invalide). Je peux la rejouer après correction du contact.'
    if (q.includes('rappel') || q.includes('programme') || q.includes('mensuel'))
      return "Je programme un rappel mensuel des échéances légales (le 1er à 8 h) : reddition, convocation AG, taxation, obligations. Confirmez-vous l'activation ?"
    if (q.includes('pause') || q.includes('impay'))
      return "J'ai mis en pause les relances automatiques d'impayés. Les relances manuelles restent possibles depuis le module Impayés & recouvrement."
    return 'Je surveille vos échéances : fin de mission, convocation AG, reddition, taxation, obligations. 6 automatisations actives, 90 exécutions ce mois.'
  }
  if (q.includes('majorit'))
    return "Pour désigner le syndic en AG, la majorité de l'article 25 s'applique ; à défaut, un second vote à la majorité de l'article 25-1 puis 24 est possible. Le syndic judiciaire (art. 46 décret 1967) intervient quand l'AG n'a pu réunir cette majorité."
  if (q.includes('notif') || q.includes('ordonnance'))
    return "L'ordonnance de désignation doit être notifiée à tous les copropriétaires dans le mois suivant son prononcé, dans les formes de l'article 64 du décret du 17 mars 1967."
  if (q.includes('honorair') || q.includes('taxation'))
    return "En qualité d'auxiliaire de justice, vos honoraires suivent les articles 704 à 718 du CPC : un état de frais est soumis au juge taxateur (président du TJ)."
  if (q.includes('délai') || q.includes('duree') || q.includes('durée') || q.includes('mission'))
    return "La durée de la mission est fixée par l'ordonnance, sans excéder trois ans. Vous devez convoquer l'AG élective au plus tard deux mois avant la fin de votre mission."
  return "Bonne question. En tant qu'assistant " + prenom + ", je m'appuie sur la loi du 10 juillet 1965 et le décret du 17 mars 1967."
}

/**
 * Page de conversation d'un agent IA (Fixy, Max, Léa, Tempo) : historique par tranche (masquable), en-tête, sélecteur de
 * contexte, suggestions (remplissent le champ sans envoyer) et réponses simulées. La recherche de conversation
 * n'est pas branchée (champ non contrôlé).
 */
export function AgentChatPage({
  mascot,
  name,
  title,
  intro,
  introDetail,
  suggestions = [],
  conversations = [],
  alert,
  contextSelector,
  showDocsBtn,
  inputPlaceholder = 'Posez une question…',
  domain = 'juridique',
}: AgentChatPageProps) {
  const [question, setQuestion] = useState('')
  const [contexte, setContexte] = useState(contextSelector?.options?.[0] || '')
  const [messages, setMessages] = useState<MessageAgent[]>([])
  const [panneauVisible, setPanneauVisible] = useState(true)
  const { push } = useToast()
  const champRef = useRef<HTMLInputElement>(null)
  const prenom = name.split('—')[0].trim().split(' ')[0]

  const envoyer = (evenement: FormEvent<HTMLFormElement>) => {
    evenement.preventDefault()
    const texte = question.trim()
    if (!texte) return
    setMessages((precedents) => [
      ...precedents,
      {
        role: 'me',
        text: texte,
      },
      {
        role: 'bot',
        text: repondreAgentSimule(domain, texte, prenom),
      },
    ])
    setQuestion('')
  }

  const choisirSuggestion = (suggestion: string) => {
    setQuestion(suggestion)
    champRef.current?.focus()
  }

  const ouvrirDocuments = () =>
    push({
      kind: 'info',
      title: 'Documents de la copropriété',
      desc: 'Ouverture du coffre-fort documentaire',
    })

  const nouvelleConversation = () => {
    setMessages([])
    push({
      kind: 'success',
      title: 'Nouvelle conversation',
      desc: `Conversation démarrée avec ${prenom}`,
    })
  }

  const conversationsParTranche: Record<TrancheConversation, ConversationAgent[]> = {
    hier: [],
    'cette-semaine': [],
    'plus-anciennes': [],
  }
  conversations.forEach((conversation) =>
    (conversationsParTranche[conversation.bucket] || conversationsParTranche['plus-anciennes']).push(conversation),
  )

  return (
    <div
      className="agent-page"
      style={
        panneauVisible
          ? undefined
          : {
              gridTemplateColumns: 'minmax(0, 1fr)',
            }
      }
    >
      <aside
        className="agent-conv-side"
        aria-label="Historique des conversations"
        style={
          panneauVisible
            ? undefined
            : {
                display: 'none',
              }
        }
      >
        <div className="agent-conv-head">
          <h3>CONVERSATIONS</h3>
          <button
            type="button"
            className="btn-icon-only"
            aria-label="Masquer le panneau"
            title="Masquer"
            onClick={() => setPanneauVisible(false)}
          >
            <Icon name="chevron" />
          </button>
        </div>
        <button type="button" className="btn gold agent-newconv" onClick={nouvelleConversation}>
          + Nouvelle conversation
        </button>
        <div className="agent-conv-search">
          <Icon name="search" />
          <input type="text" aria-label="Rechercher une conversation" placeholder="Rechercher une conversation…" />
        </div>
        <div className="agent-conv-list">
          {conversations.length === 0 ? (
            <p
              style={{
                fontSize: 12,
                color: 'var(--navy-300)',
                textAlign: 'center',
                padding: '24px 12px',
                margin: 0,
              }}
            >
              Aucune conversation. Lancez-en une pour commencer.
            </p>
          ) : (
            TRANCHES_CONVERSATIONS.map(
              (tranche) =>
                conversationsParTranche[tranche].length > 0 && (
                  <section key={tranche}>
                    <div className="agent-conv-bucket">{LIBELLES_TRANCHES[tranche]}</div>
                    {conversationsParTranche[tranche].map((conversation) => (
                      <button
                        type="button"
                        className="agent-conv-item"
                        onClick={() =>
                          push({
                            kind: 'info',
                            title: 'Conversation chargée',
                            desc: conversation.title,
                          })
                        }
                        key={conversation.id}
                      >
                        <Icon name="chat" />
                        <span>{conversation.title}</span>
                      </button>
                    ))}
                  </section>
                ),
            )
          )}
        </div>
      </aside>
      <main className="agent-main">
        {!panneauVisible && (
          <button
            type="button"
            className="btn ghost sm"
            style={{
              alignSelf: 'flex-start',
            }}
            onClick={() => setPanneauVisible(true)}
          >
            <Icon name="chat" />
            Conversations
          </button>
        )}
        <div className="agent-head">
          <img className="agent-mascot-sm" src={AVATARS_AGENTS[mascot]} alt="" />
          <div
            style={{
              flex: 1,
              minWidth: 0,
            }}
          >
            <h2 className="agent-name">
              {name}
              <span className="agent-ia-badge">IA</span>
            </h2>
            <p className="agent-title">{title}</p>
          </div>
        </div>
        {(contextSelector || showDocsBtn) && (
          <div className="agent-context-row">
            {contextSelector && (
              <div className="agent-ctx-field">
                <label htmlFor="agent-ctx-sel">
                  {contextSelector.label}
                  {' :'}
                </label>
                <select
                  id="agent-ctx-sel"
                  aria-label="Contexte"
                  value={contexte}
                  onChange={(evenement) => setContexte(evenement.target.value)}
                >
                  {contextSelector.options.map((option) => (
                    <option value={option} key={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {showDocsBtn && (
              <button type="button" className="btn" onClick={ouvrirDocuments}>
                <Icon name="doc" />
                Documents
              </button>
            )}
          </div>
        )}
        {alert && <Alert kind={alert.kind} icon={alert.icon} title={alert.title} />}
        {messages.length === 0 ? (
          <>
            <div className="agent-welcome">
              <img className="agent-mascot-lg" src={AVATARS_AGENTS[mascot]} alt="" />
              <h3 className="agent-intro">{intro}</h3>
              {introDetail && <p className="agent-intro-detail">{introDetail}</p>}
            </div>
            {suggestions.length > 0 && (
              <div className="agent-suggestions">
                {suggestions.map((suggestion, index) => (
                  <button
                    type="button"
                    className="agent-suggestion"
                    onClick={() => choisirSuggestion(suggestion)}
                    key={index}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <div
            className="chat-box"
            style={{
              margin: '8px 0 16px',
            }}
          >
            {messages.map((message, index) => (
              <div
                className={`chat-msg ${message.role === 'me' ? 'me' : ''}`}
                style={{
                  display: 'flex',
                  gap: 10,
                  marginBottom: 12,
                  flexDirection: message.role === 'me' ? 'row-reverse' : 'row',
                }}
                key={index}
              >
                {message.role === 'bot' && (
                  <img
                    src={AVATARS_AGENTS[mascot]}
                    alt=""
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      flexShrink: 0,
                    }}
                  />
                )}
                <div
                  style={{
                    background: message.role === 'me' ? 'var(--navy-700)' : '#fff',
                    color: message.role === 'me' ? '#fff' : 'var(--ink)',
                    border: message.role === 'me' ? 'none' : '1px solid var(--line)',
                    borderRadius: 12,
                    padding: '10px 14px',
                    fontSize: 13,
                    maxWidth: '78%',
                    lineHeight: 1.5,
                  }}
                >
                  {message.text}
                </div>
              </div>
            ))}
          </div>
        )}
        <form className="agent-input-row" onSubmit={envoyer}>
          <input
            ref={champRef}
            type="text"
            className="agent-input"
            placeholder={inputPlaceholder}
            value={question}
            onChange={(evenement) => setQuestion(evenement.target.value)}
            aria-label={`Question à ${name}`}
          />
          <button type="submit" className="btn gold agent-send" disabled={!question.trim()}>
            Envoyer
          </button>
        </form>
      </main>
    </div>
  )
}
