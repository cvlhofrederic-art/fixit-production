'use client'

// ── Écran « Poser une question » (Fixy) ──────────────────────────────────────
//
// Conversation avec l'assistant du portail (SPECIFICATION-ECRANS.md, section 8).
// - Accord explicite à la première ouverture, mémorisé dans CLES_PREFERENCES.accordAssistant :
//   tant qu'il n'est pas donné, le champ et les questions sont désactivés.
// - Quatre questions prêtes à l'emploi (t.question.questions), toujours visibles.
// - Appel POST /api/copro-ai avec le jeton, réponse en flux SSE (même logique que
//   pages/CoproAssistantSection.tsx) ou JSON { reply } ; erreur → bulle grise persistante
//   + « Réessayer ».
// - Démonstration (jeton null) : aucune requête, les réponses sont produites ici à partir
//   de l'espace par `reponseDemo` (jamais un montant absent de l'espace).

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import MarkdownIA from '@/components/common/MarkdownIA'
import { CLES_PREFERENCES, type PropsEcran } from '@/components/coproprietaire-dashboard/contrat'
import { contexteApi } from '@/lib/coproprietaire/api'
import { Bouton, Carte, CLASSES_SAISIE, Encadre } from '@/components/coproprietaire-dashboard/ui'
import {
  dateHeure, dateLongue, euros, libelleStatutDemande, remplir, type LangueCopro, type TextesCopro,
} from '@/lib/coproprietaire/textes'
import type { AppelDeCharges, AssembleeCopro, DemandeCopro, EspaceCopro } from '@/lib/coproprietaire/types'

// ── Textes propres à l'écran (FR / PT) ───────────────────────────────────────

const TEXTES_FR = {
  accord: 'Les informations de votre espace (lot, charges, demandes) sont transmises à l’assistant pour répondre ; jamais votre IBAN, votre téléphone ni votre e-mail.',
  jaiCompris: 'J’ai compris',
  ecrit: 'Fixy écrit…',
  conversation: 'Conversation avec Fixy',
  votreQuestion: 'Votre question',
  // Réponses de démonstration
  ouLire: 'Vous trouverez le détail dans « {ecran} ».',
  chargesIban: 'L’IBAN de votre syndic et la référence à indiquer sont dans « {ecran} ».',
  locataireCharges: 'Les charges de copropriété sont réglées par le propriétaire de votre logement : votre espace ne contient pas d’information de paiement.',
  derniereDemande: 'Votre dernière demande ({type}, {envoyeeLe}) : **{statut}**.',
  signalerDepuis: 'Vous pouvez signaler un problème depuis « {ecran} ».',
  prochaineAssemblee: '{prochaine} : {titre}, **{date}**, {lieu}.',
  voterDepuis: 'Vous pouvez voter par correspondance dans « {ecran} ».',
  locataireAssemblees: 'Les assemblées générales réunissent les propriétaires : votre espace ne contient pas de convocation.',
  syndic: '{votreSyndic} : **{nom}**',
  adresse: 'Adresse',
  documents: '{n} document(s) publié(s) par votre syndic (règlement, procès-verbaux, contrats). Ils sont dans « {ecran} ».',
  annonces: 'Dernière annonce de votre syndic : « {titre} » ({date}). Toutes les annonces sont dans « {ecran} ».',
  travaux: '{n} intervention(s) en cours dans l’immeuble. Le détail est dans « {ecran} », onglet « {onglet} ».',
  orientation: 'Je réponds seulement avec les informations de votre espace. Charges : « {charges} » · Demandes : « {demandes} » · Assemblées : « {assemblees} » · Documents : « {documents} » · Annonces : « {annonces} ». Pour toute autre question, contactez votre syndic.',
}

type TextesLocaux = typeof TEXTES_FR

const TEXTES_PT: TextesLocaux = {
  accord: 'As informações do seu espaço (fração, quotas, pedidos) são transmitidas ao assistente para responder; nunca o seu IBAN, o seu telefone nem o seu e-mail.',
  jaiCompris: 'Compreendi',
  ecrit: 'O Fixy está a escrever…',
  conversation: 'Conversa com o Fixy',
  votreQuestion: 'A sua pergunta',
  ouLire: 'Encontra o detalhe em « {ecran} ».',
  chargesIban: 'O IBAN do seu administrador e a referência a indicar estão em « {ecran} ».',
  locataireCharges: 'As quotas do condomínio são pagas pelo proprietário da sua habitação: o seu espaço não contém informações de pagamento.',
  derniereDemande: 'O seu último pedido ({type}, {envoyeeLe}): **{statut}**.',
  signalerDepuis: 'Pode comunicar um problema em « {ecran} ».',
  prochaineAssemblee: '{prochaine}: {titre}, **{date}**, {lieu}.',
  voterDepuis: 'Pode votar por correspondência em « {ecran} ».',
  locataireAssemblees: 'As assembleias gerais reúnem os proprietários: o seu espaço não contém convocatórias.',
  syndic: '{votreSyndic}: **{nom}**',
  adresse: 'Morada',
  documents: '{n} documento(s) publicado(s) pelo seu administrador (regulamento, atas, contratos). Estão em « {ecran} ».',
  annonces: 'Último aviso do seu administrador: « {titre} » ({date}). Todos os avisos estão em « {ecran} ».',
  travaux: '{n} intervenção(ões) em curso no edifício. O detalhe está em « {ecran} », separador « {onglet} ».',
  orientation: 'Respondo apenas com as informações do seu espaço. Quotas: « {charges} » · Pedidos: « {demandes} » · Assembleias: « {assemblees} » · Documentos: « {documents} » · Avisos: « {annonces} ». Para qualquer outra questão, contacte o seu administrador.',
}

const TEXTES_LOCAUX: Record<LangueCopro, TextesLocaux> = { fr: TEXTES_FR, pt: TEXTES_PT }

// ── Réponses de démonstration (sans réseau, à partir de l'espace) ────────────

type Sujet = 'charges' | 'demande' | 'assemblee' | 'syndic' | 'travaux' | 'documents' | 'annonces'

/** Débuts de mots (FR et PT, sans accent) qui orientent une question vers un sujet ; le premier sujet trouvé l'emporte. */
const SUJETS: ReadonlyArray<readonly [Sujet, readonly string[]]> = [
  ['charges', ['combien', 'pay', 'paiement', 'charge', 'regler', 'montant', 'solde', 'factur', 'virement', 'iban', 'echeance', 'retard', 'fonds', 'dette',
    'pagar', 'pagamento', 'quanto', 'encargo', 'devo', 'deve', 'saldo', 'fatura', 'quota', 'prazo', 'atraso', 'divida']],
  ['demande', ['demand', 'signal', 'problem', 'intervention', 'repar', 'fuite', 'panne', 'suivi', 'pedido', 'reclama', 'avaria', 'ponto']],
  ['assemblee', ['assembl', 'ag', 'vot', 'resolu', 'convoc', 'reunion', 'reuniao']],
  ['syndic', ['syndic', 'contact', 'joindre', 'telephon', 'gestionnaire', 'coordonn', 'mail', 'adresse', 'administra', 'telefon', 'gestor', 'sindico', 'morada']],
  ['travaux', ['travaux', 'chantier', 'ascenseur', 'peinture', 'obra', 'elevador', 'pintura']],
  ['documents', ['document', 'reglement', 'proces', 'pv', 'contrat', 'assurance', 'devis', 'diagnostic', 'carnet', 'budget', 'compte', 'regulamento', 'ata', 'seguro', 'orcamento']],
  ['annonces', ['annonce', 'coupure', 'actualite', 'nouvelle', 'gardien', 'information', 'anuncio', 'aviso', 'corte', 'novidade', 'porteiro']],
]

function motsDe(question: string): string[] {
  return question.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean)
}

function sujetDe(question: string): Sujet | null {
  const mots = motsDe(question)
  const correspond = (debut: string) => mots.some(m => m === debut || (debut.length >= 3 && m.startsWith(debut)))
  for (const [sujet, debuts] of SUJETS) if (debuts.some(correspond)) return sujet
  return null
}

function prochainAppel(appels: AppelDeCharges[]): AppelDeCharges | null {
  return appels
    .filter(a => a.statut !== 'annule' && a.resteAPayer > 0)
    .sort((a, b) => (a.echeance || '9999').localeCompare(b.echeance || '9999'))[0] ?? null
}

function derniereDemande(demandes: DemandeCopro[]): DemandeCopro | null {
  return [...demandes].sort((a, b) => b.creeLe.localeCompare(a.creeLe))[0] ?? null
}

function prochaineAssemblee(assemblees: AssembleeCopro[]): AssembleeCopro | null {
  return assemblees.filter(a => a.statut === 'convoquee').sort((a, b) => a.date.localeCompare(b.date))[0] ?? null
}

function reponseCharges(espace: EspaceCopro, t: TextesCopro, l: TextesLocaux, langue: LangueCopro): string {
  if (espace.profil.role === 'locataire') return l.locataireCharges
  const { appels } = espace.finances
  if (appels.length === 0) return t.charges.aucunAppel
  const appel = prochainAppel(appels)
  if (!appel) return `${t.charges.aJour}.`
  const montant = `**${euros(appel.resteAPayer, langue)}**`
  const echeance = appel.echeance ? dateLongue(appel.echeance, langue) : ''
  // La date de référence est celle du chargement de l'espace (fonction pure, jamais « maintenant »).
  const enRetard = appel.statut === 'en_retard' || (appel.echeance !== '' && appel.echeance.slice(0, 10) < espace.chargeLe.slice(0, 10))
  const phrase = !echeance ? remplir(t.charges.aRegler, { montant })
    : enRetard ? remplir(t.charges.retard, { montant, date: echeance })
      : remplir(t.charges.aReglerAvant, { montant, date: echeance })
  const periode = appel.periodeDebut && appel.periodeFin
    ? remplir(t.charges.chargesDu, { debut: dateLongue(appel.periodeDebut, langue), fin: dateLongue(appel.periodeFin, langue) })
    : appel.exercice
  const lignes = [`${phrase}.`]
  if (periode) lignes.push(`${periode}.`)
  if (appel.referencePaiement) lignes.push(`${t.charges.reference} : ${appel.referencePaiement}.`)
  lignes.push(remplir(l.chargesIban, { ecran: t.menu.charges }))
  return lignes.join('\n')
}

function reponseDemande(espace: EspaceCopro, t: TextesCopro, l: TextesLocaux, langue: LangueCopro): string {
  const d = derniereDemande(espace.interventions.mesDemandes)
  if (!d) return `${t.demandes.aucuneDemande} ${remplir(l.signalerDepuis, { ecran: t.menu.demandes })}`
  const lignes = [remplir(l.derniereDemande, {
    type: d.type,
    envoyeeLe: remplir(t.demandes.envoyeeLe, { date: dateLongue(d.creeLe, langue) }),
    statut: libelleStatutDemande(d.statut, d.prestataire, t),
  })]
  if (d.intervention?.datePrevue && (d.statut === 'acceptee' || d.statut === 'en_cours')) {
    lignes.push(`${remplir(t.demandes.passagePrevu, { date: dateLongue(d.intervention.datePrevue, langue) })}.`)
  }
  lignes.push(remplir(l.ouLire, { ecran: t.menu.demandes }))
  return lignes.join('\n')
}

function reponseAssemblee(espace: EspaceCopro, t: TextesCopro, l: TextesLocaux, langue: LangueCopro): string {
  if (espace.profil.role === 'locataire') return l.locataireAssemblees
  const ag = prochaineAssemblee(espace.assemblees)
  if (!ag) return t.assemblees.aucune
  const lignes = [remplir(l.prochaineAssemblee, { prochaine: t.assemblees.prochaine, titre: ag.titre, date: dateHeure(ag.date, langue), lieu: ag.lieu })]
  const sansVote = ag.resolutions.filter(r => !r.monVote).length
  if (sansVote > 0) lignes.push(`${remplir(t.assemblees.resolutionsAttendent, { n: sansVote, total: ag.resolutions.length })}.`)
  lignes.push(remplir(l.voterDepuis, { ecran: t.menu.assemblees }))
  return lignes.join('\n')
}

function reponseSyndic(espace: EspaceCopro, t: TextesCopro, l: TextesLocaux): string {
  const s = espace.syndic
  if (!s.nom) return t.informations.syndicInconnu
  const lignes = [remplir(l.syndic, { votreSyndic: t.informations.votreSyndic, nom: s.nom })]
  if (espace.immeuble.gestionnaire) lignes.push(remplir(t.informations.gestionnaire, { nom: espace.immeuble.gestionnaire }))
  lignes.push(`- ${t.informations.telephone} : ${s.telephone || t.informations.nonRenseigne}`)
  lignes.push(`- ${t.informations.email} : ${s.email || t.informations.nonRenseigne}`)
  const adresse = [s.adresse, [s.codePostal, s.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  if (adresse) lignes.push(`- ${l.adresse} : ${adresse}`)
  return lignes.join('\n')
}

function reponseTravaux(espace: EspaceCopro, t: TextesCopro, l: TextesLocaux): string {
  const enCours = espace.interventions.immeuble.filter(i => i.statut === 'acceptee' || i.statut === 'en_cours').length
  if (enCours === 0) return `${t.demandes.aucunTravaux} ${remplir(l.ouLire, { ecran: t.menu.demandes })}`
  return remplir(l.travaux, { n: enCours, ecran: t.menu.demandes, onglet: t.demandes.ongletTravaux })
}

function reponseDocuments(espace: EspaceCopro, t: TextesCopro, l: TextesLocaux): string {
  const n = espace.documents.fichiers.length
  if (n === 0) return t.documents.aucunDocument
  return remplir(l.documents, { n, ecran: t.menu.documents })
}

function reponseAnnonces(espace: EspaceCopro, t: TextesCopro, l: TextesLocaux, langue: LangueCopro): string {
  const derniere = [...espace.annonces].sort((a, b) => b.date.localeCompare(a.date))[0]
  if (!derniere) return t.annonces.aucune
  return remplir(l.annonces, { titre: derniere.titre, date: dateLongue(derniere.date, langue), ecran: t.menu.annonces })
}

/**
 * Réponse locale de Fixy en démonstration (jeton null) : construite uniquement à partir de
 * `espace`, jamais un montant ou une date qui n'y figure pas. Fonction pure, FR ou PT.
 */
export function reponseDemo(question: string, espace: EspaceCopro, t: TextesCopro, langue: LangueCopro): string {
  const l = TEXTES_LOCAUX[langue]
  switch (sujetDe(question)) {
    case 'charges': return reponseCharges(espace, t, l, langue)
    case 'demande': return reponseDemande(espace, t, l, langue)
    case 'assemblee': return reponseAssemblee(espace, t, l, langue)
    case 'syndic': return reponseSyndic(espace, t, l)
    case 'travaux': return reponseTravaux(espace, t, l)
    case 'documents': return reponseDocuments(espace, t, l)
    case 'annonces': return reponseAnnonces(espace, t, l, langue)
    default:
      return remplir(l.orientation, {
        charges: t.menu.charges, demandes: t.menu.demandes, assemblees: t.menu.assemblees, documents: t.menu.documents, annonces: t.menu.annonces,
      })
  }
}

// ── Préférence « accord donné » (localStorage, toujours sous try/catch) ──────

const CLE_ACCORD = CLES_PREFERENCES.accordAssistant

function lireAccord(): boolean {
  try {
    return localStorage.getItem(CLE_ACCORD) === '1'
  } catch {
    return false
  }
}

function memoriserAccord(): void {
  try {
    localStorage.setItem(CLE_ACCORD, '1')
  } catch (e) {
    console.warn('[copro] accord assistant non mémorisé', e)
  }
}

// ── Requête vers /api/copro-ai ───────────────────────────────────────────────

type MessageFixy = { id: number; role: 'user' | 'assistant'; content: string; erreur?: boolean }

// coproAiSchema (lib/validation.ts) refuse plus de 30 messages et plus de 10 000 caractères
// par message : on n'envoie que la fin de la conversation.
const MAX_MESSAGES_ENVOYES = 20
const MAX_CARACTERES_MESSAGE = 10_000

/** Texte d'une réponse JSON { reply } (ou { response }), sinon chaîne vide. */
function texteReponse(data: unknown): string {
  if (typeof data !== 'object' || data === null) return ''
  const d = data as Record<string, unknown>
  for (const cle of ['reply', 'response']) {
    const v = d[cle]
    if (typeof v === 'string' && v.trim()) return v
  }
  return ''
}

/** Texte d'un fragment SSE `data: {"text": "…"}`, sinon chaîne vide. */
function morceauDe(payload: string): string {
  const obj: unknown = JSON.parse(payload)
  if (typeof obj !== 'object' || obj === null) return ''
  const texte = (obj as Record<string, unknown>).text
  return typeof texte === 'string' ? texte : ''
}

// ── Bulles ───────────────────────────────────────────────────────────────────

const CLASSES_BULLE = {
  moi: 'bg-[#0D1B2E] text-white rounded-tr-sm whitespace-pre-wrap',
  fixy: 'bg-white border border-[#E4DDD0] text-[#0D1B2E] rounded-tl-sm',
  erreur: 'bg-[#EEEAE2] border border-[#D5CCBB] text-[#3F4F63] rounded-tl-sm',
} as const

function Bulle({ de, nom, children }: { de: keyof typeof CLASSES_BULLE; nom: string; children: ReactNode }) {
  return (
    <div className={`flex ${de === 'moi' ? 'justify-end' : 'justify-start'}`}>
      <div
        data-bulle={de}
        role={de === 'erreur' ? 'alert' : undefined}
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-base leading-relaxed ${CLASSES_BULLE[de]}`}
      >
        <p className={`mb-1 text-sm font-semibold ${de === 'moi' ? 'text-white/80' : 'text-[#4A5E78]'}`}>{nom}</p>
        {children}
      </div>
    </div>
  )
}

// ── Écran ────────────────────────────────────────────────────────────────────

export default function EcranQuestion({ espace, t, langue, jeton }: PropsEcran) {
  const l = TEXTES_LOCAUX[langue]
  const demo = jeton === null
  // Les écrans sont chargés sans rendu serveur (next/dynamic ssr:false) : lecture directe de la préférence.
  const [accord, setAccord] = useState<boolean>(lireAccord)
  const [messages, setMessages] = useState<MessageFixy[]>([])
  const [saisie, setSaisie] = useState('')
  // Attente du premier mot : indicateur de saisie affiché, champ bloqué.
  const [chargement, setChargement] = useState(false)
  // Réponse en cours d'écriture : on peut taper la question suivante, mais elle ne part qu'après.
  const [enFlux, setEnFlux] = useState(false)
  const idChamp = useId()
  const refChamp = useRef<HTMLInputElement>(null)
  const refFin = useRef<HTMLDivElement>(null)
  const refRequete = useRef<AbortController | null>(null)
  const refProchainId = useRef(1)

  useEffect(() => () => refRequete.current?.abort(), [])

  const occupe = chargement || enFlux
  const nouvelId = () => refProchainId.current++
  const defiler = () => refFin.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' })

  const donnerAccord = () => {
    memoriserAccord()
    setAccord(true)
    setTimeout(() => refChamp.current?.focus(), 0)
  }

  const nouvelleConversation = () => {
    refRequete.current?.abort()
    refRequete.current = null
    setMessages([])
    setSaisie('')
    setChargement(false)
    setEnFlux(false)
  }

  /** Affiche l'historique donné (dernier message : la question) et obtient la réponse de Fixy. */
  const lancer = async (historique: MessageFixy[]) => {
    setMessages(historique)
    setTimeout(defiler, 50)
    const ajouter = (content: string, erreur = false) =>
      setMessages(prev => [...prev, { id: nouvelId(), role: 'assistant', content, erreur }])

    if (demo) {
      const question = historique[historique.length - 1]?.content ?? ''
      ajouter(reponseDemo(question, espace, t, langue))
      setTimeout(defiler, 50)
      return
    }

    setChargement(true)
    const controleur = new AbortController()
    refRequete.current = controleur
    try {
      const res = await fetch('/api/copro-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jeton}` },
        // Pas de prompt : le serveur fournit lui-même à Fixy les données de l'espace.
        body: JSON.stringify({
          messages: historique
            .slice(-MAX_MESSAGES_ENVOYES)
            .map(m => ({ role: m.role, content: m.content.slice(0, MAX_CARACTERES_MESSAGE) })),
          stream: true,
          locale: langue,
          // Fiche affichée (plusieurs lots) et, pour le super admin, fiche de démonstration.
          ...(contexteApi().lot ? { lot: contexteApi().lot } : {}),
          ...(contexteApi().email ? { email: contexteApi().email } : {}),
        }),
        signal: controleur.signal,
      })

      if (!res.ok) {
        console.warn('[copro-ai] réponse en erreur', res.status)
        ajouter(t.question.erreur, true)
        return
      }

      // Réponse JSON { reply } au lieu d'un flux (aucune clé IA côté serveur, par exemple).
      const enSse = (res.headers.get('content-type') || '').includes('text/event-stream')
      if (!res.body || !enSse) {
        const data: unknown = await res.json().catch((e: unknown) => {
          console.warn('[copro-ai] réponse illisible', e)
          return null
        })
        ajouter(texteReponse(data) || t.question.pasDeReponse)
        return
      }

      setEnFlux(true)
      const lecteur = res.body.getReader()
      const decodeur = new TextDecoder()
      let texteComplet = ''
      let tampon = ''
      let termine = false
      while (!termine) {
        const { done, value } = await lecteur.read()
        if (done) break
        tampon += decodeur.decode(value, { stream: true })
        const lignes = tampon.split('\n')
        tampon = lignes.pop() || ''

        for (const ligne of lignes) {
          const nette = ligne.trim()
          if (!nette.startsWith('data: ')) continue
          const charge = nette.slice(6)
          if (charge === '[DONE]') { termine = true; break }
          let morceau = ''
          try {
            morceau = morceauDe(charge)
          } catch (e) {
            console.warn('[copro-ai] fragment de flux illisible ignoré', e)
          }
          if (!morceau) continue
          // Le premier mot peut arriver après quelques secondes : la bulle n'apparaît qu'avec lui.
          const premier = !texteComplet
          texteComplet += morceau
          const texteCourant = texteComplet
          const idBulle = premier ? nouvelId() : 0
          setMessages(prev => premier
            ? [...prev, { id: idBulle, role: 'assistant', content: texteCourant }]
            : [...prev.slice(0, -1), { ...prev[prev.length - 1], content: texteCourant }])
          if (premier) setChargement(false)
          defiler()
        }
      }

      if (!texteComplet) ajouter(t.question.pasDeReponse)
    } catch (err) {
      // Conversation effacée pendant la réponse : rien à afficher.
      if (controleur.signal.aborted) return
      console.warn('[copro-ai] échec de la requête', err)
      ajouter(t.question.erreur, true)
    } finally {
      if (refRequete.current === controleur) refRequete.current = null
      setChargement(false)
      setEnFlux(false)
      setTimeout(defiler, 100)
    }
  }

  const envoyer = (texte: string) => {
    const contenu = texte.trim()
    if (!contenu || !accord || occupe) return
    setSaisie('')
    void lancer([...messages.filter(m => !m.erreur), { id: nouvelId(), role: 'user', content: contenu }])
  }

  /** Après une erreur : renvoie la conversation telle quelle (la dernière question reste la même). */
  const reessayer = () => {
    if (occupe) return
    const base = messages.filter(m => !m.erreur)
    if (base.length === 0 || base[base.length - 1].role !== 'user') return
    void lancer(base)
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-[#0D1B2E] md:text-3xl">{t.question.titre}</h2>
        <p className="mt-1 text-base text-[#4A5E78]">{t.question.intro}</p>
      </div>

      {!accord && (
        <Encadre ton="info">
          <p>{l.accord}</p>
          <div className="mt-3">
            <Bouton variante="principal" icone="check" onClick={donnerAccord}>{l.jaiCompris}</Bouton>
          </div>
        </Encadre>
      )}

      <Carte>
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {t.question.questions.map(q => (
              <Bouton
                key={q} variante="secondaire" pleineLargeur icone="question" disabled={!accord || occupe}
                onClick={() => envoyer(q)} className="justify-start text-left"
              >
                {q}
              </Bouton>
            ))}
          </div>

          <section role="log" aria-live="polite" aria-label={l.conversation} className="max-h-[55vh] space-y-3 overflow-y-auto rounded-xl border border-[#E4DDD0] bg-[#FBF9F4] p-3">
            {demo && <Bulle de="fixy" nom={t.question.fixy}><p>{t.question.demo}</p></Bulle>}
            {messages.map(m => (
              m.role === 'user' ? (
                <Bulle key={m.id} de="moi" nom={t.demandes.vous}>{m.content}</Bulle>
              ) : m.erreur ? (
                <Bulle key={m.id} de="erreur" nom={t.question.fixy}>
                  <p>{m.content}</p>
                  <div className="mt-2">
                    <Bouton variante="secondaire" petit icone="actualiser" onClick={reessayer} disabled={occupe}>{t.commun.reessayer}</Bouton>
                  </div>
                </Bulle>
              ) : (
                <Bulle key={m.id} de="fixy" nom={t.question.fixy}><MarkdownIA texte={m.content} /></Bulle>
              )
            ))}
            {chargement && (
              <div className="flex justify-start" role="status">
                <div className="rounded-2xl rounded-tl-sm border border-[#E4DDD0] bg-white px-4 py-3">
                  <div className="flex items-center gap-1" aria-hidden="true">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-[#8A9BB0]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-[#8A9BB0] [animation-delay:150ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-[#8A9BB0] [animation-delay:300ms]" />
                  </div>
                  <span className="sr-only">{l.ecrit}</span>
                </div>
              </div>
            )}
            <div ref={refFin} />
          </section>

          <form onSubmit={e => { e.preventDefault(); envoyer(saisie) }} className="flex flex-col gap-2 sm:flex-row">
            <label htmlFor={idChamp} className="sr-only">{l.votreQuestion}</label>
            <input
              id={idChamp} ref={refChamp} type="text" value={saisie} onChange={e => setSaisie(e.target.value)}
              placeholder={t.question.placeholder} disabled={!accord || chargement} autoComplete="off"
              maxLength={MAX_CARACTERES_MESSAGE} className={`${CLASSES_SAISIE} flex-1 disabled:opacity-60`}
            />
            <Bouton type="submit" variante="principal" icone="envoyer" disabled={!accord || occupe || !saisie.trim()}>
              {t.question.envoyer}
            </Bouton>
          </form>

          <div className="flex justify-end">
            <Bouton variante="secondaire" icone="actualiser" onClick={nouvelleConversation}>{t.question.nouvelleConversation}</Bouton>
          </div>
        </div>
      </Carte>
    </div>
  )
}
