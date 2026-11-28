'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import type { ChantierOutillage, ContexteOutillage, LigneVerifieeSaisie, OutilEcran } from '@/lib/btp/outillage-regles'
import { LIMITES_VERIFICATION, correspondRecherche, groupeDe, parGroupe } from '@/lib/btp/outillage-regles'
import type { EnvoyerOutillage } from './useOutillage'
import { badgeVerification, dateEtHeure, iconeGroupe, jourEtDate, libelleGroupe, messageErreurOutillage, resumeVerification } from './textes'

// Onglet « Vérification du vendredi » : chaque chantier en cours du compte (tous pour la gestion, ses chantiers
// affectés pour le responsable), son état pour la semaine, et la liste à cocher — présent ou manquant, combien, en
// panne — avec ce qu'il veut signaler en plus. La liste est rangée par catégorie ; au-delà de quelques éléments, une
// recherche par nom aide à en retrouver un (elle ne fait que masquer : la validation porte toujours sur toute la liste).
// La validation est envoyée à /api/btp/outillage, qui vérifie que la liste est bien celle du chantier à cet instant.

const GRIS = '#555'
/** Au-delà de ce nombre d'éléments sur le chantier, le champ de recherche apparaît. */
const SEUIL_RECHERCHE = 8

interface Reponse { presents: number | null; enPanne: boolean; remarque: string }

interface Props {
  contexte: ContexteOutillage
  isPt: boolean
  envoyer: EnvoyerOutillage
  recharger: () => Promise<void>
}

function Formulaire({ chantier, outils, isPt, envoyer, onFini }: Readonly<{
  chantier: ChantierOutillage
  outils: OutilEcran[]
  isPt: boolean
  envoyer: EnvoyerOutillage
  onFini: (rechargerSeulement: boolean) => void
}>) {
  const [reponses, setReponses] = useState<Record<string, Reponse>>({})
  const [observations, setObservations] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [recherche, setRecherche] = useState('')
  // Rangée par catégorie ; la recherche ne fait que masquer (réponses gardées, validation sur toute la liste). Sans
  // champ de recherche (liste rechargée plus courte après un « liste changée »), plus rien n'est masqué.
  const filtre = outils.length > SEUIL_RECHERCHE ? recherche : ''
  const visibles = outils.filter(o => correspondRecherche(filtre, [o.nom, o.reference, libelleGroupe(groupeDe(o), isPt)]))
  const groupes = parGroupe(visibles)
  const avecTitres = parGroupe(outils).length > 1
  const rechercheActive = filtre.trim() !== ''

  const reponse = (id: string): Reponse => reponses[id] ?? { presents: null, enPanne: false, remarque: '' }
  const changer = (id: string, valeur: Partial<Reponse>) => setReponses(r => ({ ...r, [id]: { ...reponse(id), ...valeur } }))
  const restants = outils.filter(o => reponse(o.id).presents === null).length
  // Chantier sans outil : la vérification ne part qu'avec une observation (sinon elle ne dirait rien).
  const observationManquante = outils.length === 0 && !observations.trim()
  const bloque = restants > 0 || observationManquante

  // Pendant une recherche, seuls les éléments affichés : jamais un élément que le responsable n'a pas sous les yeux.
  const toutPresent = () => setReponses(r => ({
    ...r,
    ...Object.fromEntries(visibles.map(o => [o.id, { ...(r[o.id] ?? { enPanne: false, remarque: '' }), presents: o.quantite }])),
  }))
  let libelleToutPresent = isPt ? 'Marcar tudo presente' : 'Tout marquer présent'
  if (rechercheActive) libelleToutPresent = isPt ? `Marcar os ${visibles.length} visíveis como presentes` : `Marquer les ${visibles.length} affichés présents`

  async function valider() {
    if (bloque || envoi) return
    setEnvoi(true)
    const lignes: LigneVerifieeSaisie[] = outils.map(o => {
      const r = reponse(o.id)
      const presents = r.presents ?? 0
      // La remarque n'est visible (et n'a de sens) que pour un élément incomplet ou en panne.
      const aSignaler = presents < o.quantite || r.enPanne
      return { outilId: o.id, presents, enPanne: r.enPanne, remarque: aSignaler ? r.remarque.trim() || null : null }
    })
    const resultat = await envoyer({ action: 'valider', chantierId: chantier.id, lignes, observations: observations.trim() || null })
    setEnvoi(false)
    if (resultat.ok) {
      toast.success(isPt ? `Verificação de « ${chantier.titre} » registada.` : `Vérification de « ${chantier.titre} » enregistrée.`)
      onFini(false)
      return
    }
    toast.error(messageErreurOutillage(resultat.code, isPt))
    // La liste du chantier a changé (outil ajouté, déplacé ou retiré entre-temps) : la recharger, cocher de nouveau.
    if (resultat.code === 'liste_changee' || resultat.code === 'chantier_non_affecte') onFini(true)
  }

  return (
    <div style={{ marginTop: 10, borderTop: '1px solid #eee', paddingTop: 10 }}>
      {outils.length === 0 ? (
        <p style={{ fontSize: 13, color: GRIS, margin: '0 0 8px' }}>
          {isPt
            ? 'Nenhuma ferramenta ou viatura está registada nesta obra. Pode mesmo assim enviar uma observação (o que falta, o que está a mais).'
            : 'Aucun outil ni véhicule n’est enregistré sur ce chantier. Vous pouvez tout de même envoyer une remarque (ce qui manque, ce qui est en trop).'}
        </p>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: GRIS }}>
            {isPt ? 'Para cada elemento: está na obra, ou falta?' : 'Pour chaque élément : est-il sur le chantier, ou manque-t-il ?'}
          </span>
          <button type="button" className="v5-btn v5-btn-sm" disabled={visibles.length === 0} onClick={toutPresent}>{libelleToutPresent}</button>
        </div>
      )}

      {outils.length > SEUIL_RECHERCHE && (
        <input
          type="search" className="v5-fi" style={{ width: '100%', marginBottom: 8 }} value={recherche} onChange={e => setRecherche(e.target.value)}
          placeholder={isPt ? 'Procurar nesta obra (nome, categoria, referência)' : 'Rechercher sur ce chantier (nom, catégorie, référence)'}
          aria-label={isPt ? 'Procurar nesta obra' : 'Rechercher sur ce chantier'}
        />
      )}
      {outils.length > 0 && groupes.length === 0 && (
        <p style={{ fontSize: 13, color: GRIS, margin: '0 0 8px' }}>{isPt ? 'Nenhum elemento corresponde à pesquisa.' : 'Aucun élément ne correspond à la recherche.'}</p>
      )}

      {groupes.map(g => (
        <fieldset key={g.groupe} style={{ border: 0, margin: '0 0 8px', padding: 0, minWidth: 0 }}>
          <legend className={avecTitres ? undefined : 'sr-only'} style={{ padding: 0, fontSize: 12, fontWeight: 700, color: GRIS, margin: '4px 0 6px' }}>
            <span aria-hidden="true">{iconeGroupe(g.groupe)} </span>{`${libelleGroupe(g.groupe, isPt)} (${g.outils.length})`}
          </legend>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
            {g.outils.map(o => {
              const r = reponse(o.id)
              const incomplet = r.presents !== null && r.presents < o.quantite
              return (
                <li key={o.id} style={{ border: '1px solid #e5e5e5', borderRadius: 8, padding: 8, background: incomplet || r.enPanne ? '#fff7ed' : '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ minWidth: 160 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>
                        <span aria-hidden="true">{iconeGroupe(g.groupe)} </span>{o.nom}
                        {o.quantite > 1 && <span style={{ color: GRIS, fontWeight: 400 }}> × {o.quantite}</span>}
                      </div>
                      {o.reference && <div style={{ fontSize: 12, color: GRIS }}>{o.reference}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      {o.quantite === 1 ? (
                        <>
                          <button type="button" className={`v5-btn v5-btn-sm${r.presents === 1 ? ' v5-btn-p' : ''}`} aria-pressed={r.presents === 1} onClick={() => changer(o.id, { presents: 1 })}>
                            {isPt ? '✔ Presente' : '✔ Présent'}
                          </button>
                          <button type="button" className={`v5-btn v5-btn-sm${r.presents === 0 ? ' v5-btn-d' : ''}`} aria-pressed={r.presents === 0} onClick={() => changer(o.id, { presents: 0 })}>
                            {isPt ? '✖ Em falta' : '✖ Manquant'}
                          </button>
                        </>
                      ) : (
                        <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
                          {isPt ? 'Presentes' : 'Présents'}
                          <input
                            type="number" inputMode="numeric" min={0} max={o.quantite} className="v5-fi" style={{ width: 70 }}
                            value={r.presents ?? ''}
                            onChange={e => {
                              const n = e.target.value === '' ? null : Math.max(0, Math.min(o.quantite, Math.floor(Number(e.target.value))))
                              changer(o.id, { presents: n !== null && Number.isFinite(n) ? n : null })
                            }}
                          />
                          / {o.quantite}
                        </label>
                      )}
                      <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <input type="checkbox" checked={r.enPanne} onChange={e => changer(o.id, { enPanne: e.target.checked })} />
                        {isPt ? 'Avariada' : 'En panne'}
                      </label>
                    </div>
                  </div>
                  {(incomplet || r.enPanne) && (
                    <input
                      type="text" className="v5-fi" style={{ marginTop: 6, width: '100%' }} maxLength={LIMITES_VERIFICATION.remarque}
                      aria-label={isPt ? `Observação sobre ${o.nom}` : `Remarque sur ${o.nom}`}
                      placeholder={isPt ? 'O que aconteceu? (opcional)' : 'Que s’est-il passé ? (facultatif)'}
                      value={r.remarque} onChange={e => changer(o.id, { remarque: e.target.value })}
                    />
                  )}
                </li>
              )
            })}
          </ul>
        </fieldset>
      ))}

      <label className="v5-fl" style={{ display: 'block', marginTop: 10 }}>
        {isPt ? 'Observações (ferramentas a mais, o que faz falta na obra…)' : 'Remarques (outils en trop, ce qui manque au chantier…)'}
        <textarea
          className="v5-fi" rows={3} style={{ width: '100%', marginTop: 4 }} maxLength={LIMITES_VERIFICATION.observations}
          value={observations} onChange={e => setObservations(e.target.value)}
        />
      </label>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
        <button type="button" className="v5-btn v5-btn-p" disabled={bloque || envoi} onClick={() => { void valider() }}>
          {envoi ? (isPt ? 'A enviar…' : 'Envoi…') : (isPt ? 'Validar a verificação' : 'Valider la vérification')}
        </button>
        <button type="button" className="v5-btn" disabled={envoi} onClick={() => onFini(false)}>{isPt ? 'Cancelar' : 'Annuler'}</button>
        {restants > 0 && (
          <span style={{ fontSize: 13, color: GRIS }} aria-live="polite">
            {isPt ? `Falta marcar ${restants} elemento${restants > 1 ? 's' : ''}.` : `Encore ${restants} élément${restants > 1 ? 's' : ''} à marquer.`}
          </span>
        )}
        {observationManquante && (
          <span style={{ fontSize: 13, color: GRIS }} aria-live="polite">
            {isPt ? 'Escreva uma observação para enviar.' : 'Écrivez une remarque pour l’envoyer.'}
          </span>
        )}
      </div>
    </div>
  )
}

export function OngletVerification({ contexte, isPt, envoyer, recharger }: Readonly<Props>) {
  const [ouvert, setOuvert] = useState<string | null>(null)
  const outilsPar = useMemo(() => {
    const carte = new Map<string, OutilEcran[]>()
    for (const o of contexte.outils) {
      if (!o.chantierId) continue
      carte.set(o.chantierId, [...(carte.get(o.chantierId) ?? []), o])
    }
    // Même ordre que l'écran (catégories, puis nom) : la liste envoyée suit celle que le responsable a sous les yeux.
    for (const [id, liste] of carte) carte.set(id, parGroupe(liste).flatMap(g => g.outils))
    return carte
  }, [contexte.outils])

  const faites = contexte.chantiers.filter(c => c.etat === 'faite')
  const manquantsSemaine = faites.reduce((total, c) => total + (c.derniere?.manquants ?? 0), 0)

  if (!contexte.gestion && contexte.rattachement !== 'relie') {
    return <div className="v5-al warn">{messageErreurOutillage(contexte.rattachement === 'ambigu' ? 'fiche_ambigue' : 'fiche_absente', isPt)}</div>
  }

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div className="v5-al info">
        {isPt
          ? `Semana de ${jourEtDate(contexte.vendredi, true)}. Todas as sextas-feiras, o responsável de cada obra confirma as ferramentas e viaturas que lá estão e assinala o que falta.`
          : `Semaine du ${jourEtDate(contexte.vendredi, false)}. Chaque vendredi, le responsable de chaque chantier confirme les outils et véhicules qui s’y trouvent et signale ce qui manque.`}
        {contexte.gestion && contexte.chantiers.length > 0 && (
          <div style={{ marginTop: 4, fontWeight: 600 }}>
            {isPt
              ? `${faites.length}/${contexte.chantiers.length} obras verificadas esta semana · ${manquantsSemaine} elemento${manquantsSemaine > 1 ? 's' : ''} em falta`
              : `${faites.length}/${contexte.chantiers.length} chantiers vérifiés cette semaine · ${manquantsSemaine} élément${manquantsSemaine > 1 ? 's' : ''} manquant${manquantsSemaine > 1 ? 's' : ''}`}
          </div>
        )}
      </div>

      {contexte.chantiers.length === 0 && (
        <div className="v5-card" style={{ fontSize: 13, color: GRIS }}>
          {contexte.gestion
            ? (isPt ? 'Nenhuma obra em curso.' : 'Aucun chantier en cours.')
            : (isPt ? 'Não lhe está atribuída nenhuma obra em curso. Se pensa que é um erro, avise o seu responsável.' : 'Aucun chantier en cours ne vous est affecté. Si vous pensez que c’est une erreur, prévenez votre responsable.')}
        </div>
      )}

      {contexte.chantiers.map(c => {
        const badge = badgeVerification(c.etat, contexte.vendredi, isPt)
        const outils = outilsPar.get(c.id) ?? []
        return (
          <div key={c.id} className="v5-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 700 }}>{c.titre || (isPt ? 'Obra sem nome' : 'Chantier sans nom')}</div>
                {c.adresse && <div style={{ fontSize: 12, color: GRIS }}>{c.adresse}</div>}
                <div style={{ fontSize: 12, color: GRIS, marginTop: 2 }}>
                  {isPt ? `${outils.length} elemento${outils.length > 1 ? 's' : ''} registado${outils.length > 1 ? 's' : ''}` : `${outils.length} élément${outils.length > 1 ? 's' : ''} enregistré${outils.length > 1 ? 's' : ''}`}
                </div>
              </div>
              <span className={`v5-badge v5-badge-${badge.couleur}`}>{badge.texte}</span>
            </div>
            {c.derniere && (
              <div style={{ fontSize: 13, marginTop: 6 }}>
                {isPt
                  ? `Verificada por ${c.derniere.par || '—'}, ${dateEtHeure(c.derniere.le, true)}: `
                  : `Vérifiée par ${c.derniere.par || '—'}, le ${dateEtHeure(c.derniere.le, false)} : `}
                <strong style={{ color: c.derniere.manquants > 0 || c.derniere.enPanne > 0 ? '#b91c1c' : '#15803d' }}>
                  {resumeVerification(c.derniere.manquants, c.derniere.enPanne, isPt)}
                </strong>
              </div>
            )}
            {ouvert === c.id ? (
              <Formulaire
                chantier={c} outils={outils} isPt={isPt} envoyer={envoyer}
                onFini={(rechargerSeulement) => {
                  if (!rechargerSeulement) setOuvert(null)
                  void recharger()
                }}
              />
            ) : (
              <div style={{ marginTop: 8 }}>
                <button type="button" className={`v5-btn v5-btn-sm${c.etat === 'faite' ? '' : ' v5-btn-p'}`} onClick={() => setOuvert(c.id)}>
                  {c.etat === 'faite' ? (isPt ? 'Verificar de novo' : 'Vérifier de nouveau') : (isPt ? 'Verificar agora' : 'Vérifier maintenant')}
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
