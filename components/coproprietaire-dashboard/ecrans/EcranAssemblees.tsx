'use client'

// ── Assemblées & votes ────────────────────────────────────────────────────────
//
// Écran 5 du portail copropriétaire (SPECIFICATION-ECRANS.md, section 5). Le vote en ligne
// est une intention de vote transmise au syndic, qui la reporte sur le formulaire officiel ;
// elle reste modifiable jusqu'à trois jours francs avant la séance (lib/coproprietaire/api.ts :
// dateLimiteVote, voteOuvert). Compteurs et résultats ne sont montrés que pour les assemblées
// en cours ou clôturées. En démonstration (jeton null ou source 'demo'), le vote est simulé
// localement, sans appel réseau. L'encart de contestation est un texte fixe : la date de
// notification du procès-verbal n'est pas connue, aucun délai n'est calculé.

import { useCallback, useId, useState } from 'react'
import { toast } from 'sonner'
import type { PropsEcran } from '@/components/coproprietaire-dashboard/contrat'
import { Badge, Bouton, Carte, Deplie, Encadre, EtatVide, Modale, type TonBadge } from '@/components/coproprietaire-dashboard/ui'
import { dateLimiteVote, voteOuvert, voterResolution } from '@/lib/coproprietaire/api'
import {
  dateHeure, dateLongue, libelleChoixVote, libelleMajorite, libelleStatutAssemblee, pourcentage, remplir,
  type LangueCopro, type TextesCopro,
} from '@/lib/coproprietaire/textes'
import type { AssembleeCopro, ChoixVote, EspaceCopro, ResolutionCopro, StatutAssemblee } from '@/lib/coproprietaire/types'

// ── Libellés propres à cet écran (FR / PT) ───────────────────────────────────

interface LibellesLocaux {
  pourInformation: string
  contestation: string
  lireModele: string
  copieImpossible: string
  demoVote: string
}

const LIBELLES_LOCAUX: Record<LangueCopro, LibellesLocaux> = {
  fr: {
    pourInformation: 'Pour information — la convocation officielle vous est adressée séparément.',
    contestation: 'Vous n’êtes pas d’accord avec une décision ? Les copropriétaires opposants ou défaillants ont deux mois à compter de la notification du procès-verbal pour la contester par lettre recommandée au syndic (art. 42 de la loi du 10 juillet 1965).',
    lireModele: 'Lire le modèle de lettre',
    copieImpossible: 'La copie n’a pas fonctionné. Ouvrez « Lire le modèle de lettre » et sélectionnez le texte.',
    demoVote: 'Démonstration : votre vote est simulé ici, rien n’est transmis au syndic.',
  },
  pt: {
    pourInformation: 'Para informação — a convocatória oficial é-lhe enviada separadamente.',
    contestation: 'Não concorda com uma deliberação? Os condóminos que não a aprovaram dispõem de 60 dias para a impugnar (art. 1433.º do Código Civil). Informe o seu administrador por carta registada.',
    lireModele: 'Ler o modelo de carta',
    copieImpossible: 'A cópia não funcionou. Abra « Ler o modelo de carta » e selecione o texto.',
    demoVote: 'Demonstração: o seu voto é simulado aqui, nada é transmitido ao administrador.',
  },
}

const CHOIX: readonly ChoixVote[] = ['pour', 'contre', 'abstention']

const TON_STATUT: Record<StatutAssemblee, TonBadge> = { convoquee: 'or', en_cours: 'ambre', cloturee: 'gris', annulee: 'rouge' }

/** Modèle de lettre de contestation, pré-rempli avec ce que l'espace connaît (le reste entre crochets). */
export function modeleLettreContestation(langue: LangueCopro, espace: EspaceCopro): string {
  const { profil, immeuble, syndic } = espace
  const nom = `${profil.prenom} ${profil.nom}`.trim()
  const adresseSyndic = [syndic.nom, syndic.adresse, `${syndic.codePostal} ${syndic.ville}`.trim()].filter(Boolean).join('\n')
  if (langue === 'pt') {
    const fracao = profil.numLot || '[número da fração]'
    const edificio = immeuble.nom || '[nome do edifício]'
    return [
      nom || '[Nome e apelido]',
      '[A sua morada]',
      `Fração ${fracao} — ${edificio}`,
      '',
      adresseSyndic || '[Nome e morada do administrador]',
      '',
      'Carta registada com aviso de receção',
      '',
      'Assunto: impugnação de uma deliberação da assembleia de condóminos de [data da assembleia]',
      '',
      'Exmo.(a) Senhor(a) Administrador(a),',
      '',
      `Condómino(a) da fração ${fracao} do ${edificio}, votei contra a deliberação n.º [número] («[título da deliberação]») na assembleia de [data da assembleia] / não estive presente nem representado(a) nessa assembleia.`,
      '',
      'Impugno esta deliberação pelo seguinte motivo: [exponha o seu motivo].',
      '',
      'Nos termos do artigo 1433.º do Código Civil, informo que pretendo requerer a anulação desta deliberação no prazo legal de 60 dias.',
      '',
      'Com os melhores cumprimentos,',
      '',
      '[Localidade], [data]',
      '[Assinatura]',
    ].join('\n')
  }
  const lot = profil.numLot || '[numéro de lot]'
  const residence = immeuble.nom || '[nom de l’immeuble]'
  return [
    nom || '[Prénom et nom]',
    '[Votre adresse]',
    `Lot n° ${lot} — ${residence}`,
    '',
    adresseSyndic || '[Nom et adresse du syndic]',
    '',
    'Lettre recommandée avec accusé de réception',
    '',
    'Objet : contestation d’une décision de l’assemblée générale du [date de l’assemblée]',
    '',
    'Madame, Monsieur,',
    '',
    `Copropriétaire du lot n° ${lot} de ${residence}, j’ai voté contre la résolution n° [numéro] (« [intitulé de la résolution] ») lors de l’assemblée générale du [date de l’assemblée] / je n’étais ni présent(e) ni représenté(e) à cette assemblée.`,
    '',
    'Je conteste cette décision pour le motif suivant : [exposez votre motif].',
    '',
    'En application de l’article 42 de la loi n° 65-557 du 10 juillet 1965, je vous informe de mon intention de saisir le tribunal judiciaire dans le délai légal de deux mois suivant la notification du procès-verbal.',
    '',
    'Je vous prie d’agréer, Madame, Monsieur, l’expression de mes salutations distinguées.',
    '',
    'Fait à [ville], le [date]',
    '[Signature]',
  ].join('\n')
}

// ── Outils ───────────────────────────────────────────────────────────────────

interface VoteConnu {
  choix: ChoixVote
  enregistreLe: string
}

interface Confirmation {
  resolution: ResolutionCopro
  choix: ChoixVote
  dateLimite: string
}

function horodatage(iso: string): number {
  const n = new Date(iso).getTime()
  return Number.isNaN(n) ? 0 : n
}

function parDateCroissante(a: AssembleeCopro, b: AssembleeCopro): number {
  return horodatage(a.date) - horodatage(b.date)
}

function parNumero(a: ResolutionCopro, b: ResolutionCopro): number {
  return a.numero - b.numero
}

/** Date limite du vote par correspondance en toutes lettres (vide si la date de séance est illisible). */
function texteDateLimite(assemblee: AssembleeCopro, langue: LangueCopro): string {
  const limite = dateLimiteVote(assemblee.date)
  return limite ? dateLongue(limite.toISOString(), langue) : ''
}

function nombre(valeur: number, langue: LangueCopro): string {
  return new Intl.NumberFormat(langue === 'pt' ? 'pt-PT' : 'fr-FR', { maximumFractionDigits: 0 }).format(valeur)
}

// ── Sous-composants ──────────────────────────────────────────────────────────

function BadgeResolution({ statut, t }: { statut: ResolutionCopro['statut']; t: TextesCopro }) {
  if (statut === 'adoptee') return <Badge ton="vert">{t.assemblees.adoptee}</Badge>
  if (statut === 'rejetee') return <Badge ton="rouge">{t.assemblees.rejetee}</Badge>
  return <Badge ton="ambre">{t.assemblees.enCours}</Badge>
}

/** Barres pour / contre / abstention, en tantièmes, rapportées au total de l'immeuble. */
function BarresVotes({ resolution: r, totalTantiemes, t, langue }: { resolution: ResolutionCopro; totalTantiemes: number; t: TextesCopro; langue: LangueCopro }) {
  const somme = r.votePour + r.voteContre + r.voteAbstention
  const base = totalTantiemes > 0 ? totalTantiemes : somme
  const lignes: { cle: ChoixVote; valeur: number; couleur: string }[] = [
    { cle: 'pour', valeur: r.votePour, couleur: 'bg-[#1E6B3A]' },
    { cle: 'contre', valeur: r.voteContre, couleur: 'bg-[#9B2C20]' },
    { cle: 'abstention', valeur: r.voteAbstention, couleur: 'bg-[#8A9BB0]' },
  ]
  return (
    <div className="mt-3 space-y-2">
      {lignes.map(l => {
        const pct = base > 0 ? Math.round((l.valeur / base) * 1000) / 10 : 0
        return (
          <div key={l.cle}>
            <div className="flex items-baseline justify-between gap-3 text-sm text-[#1F2D3D]">
              <span className="font-semibold">{t.assemblees[l.cle]}</span>
              <span className="tabular-nums">{`${nombre(l.valeur, langue)} ${t.assemblees.tantiemes} · ${pourcentage(pct, langue)}`}</span>
            </div>
            <div className="mt-1 h-3 w-full overflow-hidden rounded-full bg-[#EEEAE2]" aria-hidden="true">
              <div className={`h-3 rounded-full ${l.couleur}`} style={{ width: `${Math.min(100, pct)}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Résolution d'une assemblée en cours ou clôturée : résultat, barres, mon vote. */
function ResolutionResultat({ resolution: r, totalTantiemes, t, langue }: { resolution: ResolutionCopro; totalTantiemes: number; t: TextesCopro; langue: LangueCopro }) {
  return (
    <article className="rounded-xl border border-[#E4DDD0] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-base font-bold text-[#0D1B2E]">{`${r.numero}. ${r.titre}`}</h3>
        <BadgeResolution statut={r.statut} t={t} />
      </div>
      {r.description && <p className="mt-1 text-base text-[#1F2D3D]">{r.description}</p>}
      <p className="mt-2 text-sm text-[#4A5E78]">{remplir(t.assemblees.majoriteRequise, { majorite: libelleMajorite(r.majorite, t) })}</p>
      <BarresVotes resolution={r} totalTantiemes={totalTantiemes} t={t} langue={langue} />
      {r.monVote && (
        <p className="mt-3 text-sm font-semibold text-[#0D1B2E]">{remplir(t.assemblees.votreVote, { choix: libelleChoixVote(r.monVote, t) })}</p>
      )}
    </article>
  )
}

interface PropsResolutionVote {
  resolution: ResolutionCopro
  vote: VoteConnu | null
  ouvert: boolean
  enModification: boolean
  erreur: boolean
  dateLimite: string
  t: TextesCopro
  langue: LangueCopro
  onChoisir: (choix: ChoixVote) => void
  onModifier: () => void
}

/** Résolution d'une assemblée convoquée : trois boutons égaux, encart de mon vote, erreur persistante. */
function ResolutionVote({ resolution: r, vote, ouvert, enModification, erreur, dateLimite, t, langue, onChoisir, onModifier }: PropsResolutionVote) {
  const idTitre = useId()
  const titre = `${r.numero}. ${r.titre}`
  const encartVote = vote && (
    <Encadre ton="succes" className="mt-3">
      <p className="font-semibold">{remplir(t.assemblees.votreVote, { choix: libelleChoixVote(vote.choix, t) })}</p>
      {vote.enregistreLe && <p className="text-sm">{remplir(t.assemblees.enregistreLe, { date: dateLongue(vote.enregistreLe, langue) })}</p>}
      {ouvert && (
        <div className="mt-2">
          <Bouton variante="secondaire" petit onClick={onModifier}>{t.assemblees.modifier}</Bouton>
        </div>
      )}
    </Encadre>
  )
  return (
    <article className="rounded-xl border border-[#E4DDD0] bg-white p-4" aria-labelledby={idTitre}>
      <h3 id={idTitre} className="text-base font-bold text-[#0D1B2E]">{titre}</h3>
      {r.description && <p className="mt-1 text-base text-[#1F2D3D]">{r.description}</p>}
      <p className="mt-2 text-sm text-[#4A5E78]">{remplir(t.assemblees.majoriteRequise, { majorite: libelleMajorite(r.majorite, t) })}</p>
      {!ouvert ? (
        <>
          {encartVote}
          <p className="mt-3 text-base font-semibold text-[#4A5E78]">{remplir(t.assemblees.voteClos, { date: dateLimite })}</p>
        </>
      ) : vote && !enModification ? (
        encartVote
      ) : (
        <div role="group" aria-label={titre} className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {CHOIX.map(c => {
            const actif = vote?.choix === c
            return (
              <Bouton key={c} pleineLargeur variante={actif ? 'principal' : 'secondaire'} aria-pressed={actif} onClick={() => onChoisir(c)}>
                {t.assemblees[c]}
              </Bouton>
            )
          })}
        </div>
      )}
      {erreur && <Encadre ton="erreur" className="mt-3">{t.assemblees.voteErreur}</Encadre>}
    </article>
  )
}

// ── Écran ────────────────────────────────────────────────────────────────────

export default function EcranAssemblees(props: PropsEcran) {
  const { espace, t, langue, jeton, rafraichir } = props
  const tl = LIBELLES_LOCAUX[langue]
  const [votesLocaux, setVotesLocaux] = useState<Record<string, VoteConnu>>({})
  const [modifications, setModifications] = useState<Record<string, boolean>>({})
  const [erreurs, setErreurs] = useState<Record<string, boolean>>({})
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const [envoiEnCours, setEnvoiEnCours] = useState(false)
  const [demoTentee, setDemoTentee] = useState(false)
  const [copie, setCopie] = useState<'aucune' | 'ok' | 'erreur'>('aucune')

  const maintenant = new Date()
  const convoquees = espace.assemblees.filter(a => a.statut === 'convoquee').sort(parDateCroissante)
  const enCours = espace.assemblees.filter(a => a.statut === 'en_cours').sort(parDateCroissante)
  const precedentes = espace.assemblees.filter(a => a.statut === 'cloturee' || a.statut === 'annulee').sort((a, b) => parDateCroissante(b, a))
  const avecCloturee = precedentes.some(a => a.statut === 'cloturee')

  const voteDe = (r: ResolutionCopro): VoteConnu | null => {
    const local = votesLocaux[r.id]
    if (local) return local
    return r.monVote ? { choix: r.monVote, enregistreLe: r.monVoteLe } : null
  }

  const fermerConfirmation = useCallback(() => {
    if (!envoiEnCours) setConfirmation(null)
  }, [envoiEnCours])

  const enregistrerLocalement = (resolutionId: string, vote: VoteConnu) => {
    setVotesLocaux(v => ({ ...v, [resolutionId]: vote }))
    setErreurs(e => ({ ...e, [resolutionId]: false }))
    setModifications(m => ({ ...m, [resolutionId]: false }))
  }

  const confirmerVote = async () => {
    if (!confirmation) return
    const { resolution, choix } = confirmation
    if (jeton === null || espace.source === 'demo') {
      enregistrerLocalement(resolution.id, { choix, enregistreLe: new Date().toISOString() })
      setDemoTentee(true)
      setConfirmation(null)
      return
    }
    setEnvoiEnCours(true)
    const resultat = await voterResolution(jeton, resolution.id, choix)
    setEnvoiEnCours(false)
    setConfirmation(null)
    if (!resultat.ok) {
      // Vote clos (date limite) ou assemblée qui n'est plus convoquée : l'espace rechargé le montre.
      if (resultat.code === 'vote_clos' || resultat.code === 'vote_ferme') {
        await rafraichir()
        return
      }
      setErreurs(e => ({ ...e, [resolution.id]: true }))
      return
    }
    enregistrerLocalement(resolution.id, { choix: resultat.choix, enregistreLe: resultat.enregistreLe })
    toast.success(t.assemblees.voteEnregistre)
    await rafraichir()
  }

  const copierModele = async () => {
    const texte = modeleLettreContestation(langue, espace)
    try {
      if (!navigator.clipboard) throw new Error('presse-papiers indisponible')
      await navigator.clipboard.writeText(texte)
      setCopie('ok')
      toast.success(t.assemblees.modeleCopie)
    } catch (e) {
      console.warn('[copro] copie du modèle de lettre impossible', e)
      setCopie('erreur')
      toast.error(tl.copieImpossible)
    }
  }

  if (espace.assemblees.length === 0) {
    return <EtatVide texte={t.assemblees.aucune} icone="assemblees" />
  }

  return (
    <div className="space-y-6">
      {convoquees.length === 0 && enCours.length === 0 && <EtatVide texte={t.assemblees.aucune} icone="assemblees" />}

      {convoquees.map((ag, index) => {
        const ouvert = voteOuvert(ag.date, maintenant)
        const dateLimite = texteDateLimite(ag, langue)
        const resolutions = [...ag.resolutions].sort(parNumero)
        const enAttente = resolutions.filter(r => !voteDe(r)).length
        return (
          <Carte
            key={ag.id}
            ton="or"
            titre={index === 0 ? t.assemblees.prochaine : ag.titre}
            sousTitre={index === 0 ? `${t.assemblees.types[ag.type]} — ${ag.titre}` : t.assemblees.types[ag.type]}
            actions={<Badge ton={TON_STATUT[ag.statut]}>{libelleStatutAssemblee(ag.statut, t)}</Badge>}
          >
            <p className="text-lg font-bold text-[#0D1B2E]">{dateHeure(ag.date, langue)}</p>
            {ag.lieu && <p className="mt-1 text-base text-[#1F2D3D]">{ag.lieu}</p>}
            {resolutions.length > 0 && (
              <p className="mt-3 text-base font-semibold text-[#0D1B2E]">{remplir(t.assemblees.resolutionsAttendent, { n: enAttente, total: resolutions.length })}</p>
            )}
            <p className="mt-1 text-base text-[#1F2D3D]">
              {ouvert ? remplir(t.assemblees.voterJusquAu, { date: dateLimite }) : remplir(t.assemblees.voteClos, { date: dateLimite })}
            </p>
            {ag.convocationEnvoyeeLe && (
              <p className="mt-1 text-sm text-[#4A5E78]">{remplir(t.assemblees.convocationEnvoyee, { date: dateLongue(ag.convocationEnvoyeeLe, langue) })}</p>
            )}

            {ag.ordreDuJour.length > 0 && (
              <section className="mt-5">
                <h3 className="text-base font-bold text-[#0D1B2E]">{t.assemblees.ordreDuJour}</h3>
                <ol className="mt-2 list-decimal space-y-1 pl-6 text-base text-[#1F2D3D]">
                  {ag.ordreDuJour.map((point, i) => <li key={i}>{point}</li>)}
                </ol>
              </section>
            )}
            <p className="mt-3 text-sm text-[#4A5E78]">{tl.pourInformation}</p>

            {demoTentee && <Encadre ton="info" className="mt-4">{tl.demoVote}</Encadre>}

            {resolutions.length > 0 && (
              <section className="mt-5">
                <h3 className="text-base font-bold text-[#0D1B2E]">{t.assemblees.resolutions}</h3>
                <div className="mt-2 space-y-3">
                  {resolutions.map(r => (
                    <ResolutionVote
                      key={r.id}
                      resolution={r}
                      vote={voteDe(r)}
                      ouvert={ouvert}
                      enModification={modifications[r.id] === true}
                      erreur={erreurs[r.id] === true}
                      dateLimite={dateLimite}
                      t={t}
                      langue={langue}
                      onChoisir={choix => setConfirmation({ resolution: r, choix, dateLimite })}
                      onModifier={() => setModifications(m => ({ ...m, [r.id]: true }))}
                    />
                  ))}
                </div>
              </section>
            )}
          </Carte>
        )
      })}

      {enCours.map(ag => (
        <Carte
          key={ag.id}
          ton="ambre"
          titre={ag.titre}
          sousTitre={`${t.assemblees.types[ag.type]} · ${dateHeure(ag.date, langue)}`}
          actions={<Badge ton={TON_STATUT[ag.statut]}>{libelleStatutAssemblee(ag.statut, t)}</Badge>}
        >
          {ag.lieu && <p className="text-base text-[#1F2D3D]">{ag.lieu}</p>}
          {ag.resolutions.length > 0 && (
            <section className="mt-4">
              <h3 className="text-base font-bold text-[#0D1B2E]">{t.assemblees.resultats}</h3>
              <div className="mt-2 space-y-3">
                {[...ag.resolutions].sort(parNumero).map(r => (
                  <ResolutionResultat key={r.id} resolution={r} totalTantiemes={ag.totalTantiemes} t={t} langue={langue} />
                ))}
              </div>
            </section>
          )}
        </Carte>
      ))}

      {precedentes.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-[#0D1B2E]">{t.assemblees.precedentes}</h2>
          {precedentes.map(ag => (
            <Carte
              key={ag.id}
              titre={ag.titre}
              sousTitre={`${t.assemblees.types[ag.type]} · ${dateHeure(ag.date, langue)}`}
              actions={<Badge ton={TON_STATUT[ag.statut]}>{libelleStatutAssemblee(ag.statut, t)}</Badge>}
            >
              {ag.lieu && <p className="text-base text-[#1F2D3D]">{ag.lieu}</p>}
              {ag.statut === 'cloturee' && ag.resolutions.length > 0 && (
                <Deplie titre={t.assemblees.resultats} className="mt-3">
                  <div className="space-y-3">
                    {[...ag.resolutions].sort(parNumero).map(r => (
                      <ResolutionResultat key={r.id} resolution={r} totalTantiemes={ag.totalTantiemes} t={t} langue={langue} />
                    ))}
                  </div>
                </Deplie>
              )}
              {ag.statut === 'cloturee' && ag.pv.trim() !== '' && (
                <Deplie titre={t.assemblees.pvTitre} className="mt-3">
                  <p className="whitespace-pre-line text-base text-[#1F2D3D]">{ag.pv}</p>
                </Deplie>
              )}
            </Carte>
          ))}

          {avecCloturee && (
            <>
              <Encadre ton="info">
                <p>{tl.contestation}</p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <Bouton variante="secondaire" petit icone="copier" onClick={copierModele}>{t.assemblees.copierModele}</Bouton>
                  {copie === 'ok' && <span role="status" className="text-sm font-semibold">{t.assemblees.modeleCopie}</span>}
                </div>
                <Deplie titre={tl.lireModele} className="mt-3">
                  <pre className="whitespace-pre-wrap font-sans text-base text-[#1F2D3D]">{modeleLettreContestation(langue, espace)}</pre>
                </Deplie>
              </Encadre>
              {copie === 'erreur' && <Encadre ton="erreur">{tl.copieImpossible}</Encadre>}
            </>
          )}
        </section>
      )}

      {confirmation && (
        <Modale
          titre={remplir(t.assemblees.confirmationTitre, { choix: libelleChoixVote(confirmation.choix, t), numero: confirmation.resolution.numero })}
          onFermer={fermerConfirmation}
          labelFermer={t.commun.fermer}
        >
          <p className="text-base text-[#1F2D3D]">{remplir(t.assemblees.confirmationTexte, { date: confirmation.dateLimite })}</p>
          <Encadre ton="avertissement" className="mt-4">{t.assemblees.confirmationNote}</Encadre>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Bouton variante="secondaire" onClick={fermerConfirmation} disabled={envoiEnCours}>{t.commun.annuler}</Bouton>
            <Bouton variante="or" onClick={confirmerVote} disabled={envoiEnCours}>{t.assemblees.confirmerVote}</Bouton>
          </div>
        </Modale>
      )}
    </div>
  )
}
