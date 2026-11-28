'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  CATEGORIES_OUTIL, LIMITES_OUTIL, ORDRE_GROUPES, correspondRecherche, groupeDe, parGroupe,
  type CategorieOutil, type ContexteOutillage, type EtatOutil, type GroupeOutil, type OutilEcran, type OutilSaisi,
  type TypeOutil, type VerificationEcran,
} from '@/lib/btp/outillage-regles'
import type { EnvoyerOutillage } from './useOutillage'
import { iconeGroupe, jourEtDate, libelleGroupe, libelleType, messageErreurOutillage } from './textes'

// Onglet « Répertoire » (gestion) : les outils et véhicules de la société, rangés par catégorie (ferramentas de mão,
// andaimes…, puis les véhicules), où ils sont (un chantier ou le dépôt), leur état, et ce qu'en dit la dernière
// vérification du vendredi. Recherche par nom (sans tenir compte des accents), filtre par catégorie et par lieu.
// Ajout, modification (déplacement compris) et retrait : un élément retiré quitte la liste mais reste cité par les
// vérifications passées.

const GRIS = '#555'
const STATUTS_FERMES = new Set(['Terminé', 'Annulé'])

interface Brouillon {
  type: TypeOutil; categorie: CategorieOutil | null; nom: string; reference: string; quantite: string; chantierId: string
  etat: EtatOutil; notes: string
}

const VIDE: Brouillon = { type: 'outil', categorie: null, nom: '', reference: '', quantite: '1', chantierId: '', etat: 'ok', notes: '' }

const versBrouillon = (o: OutilEcran): Brouillon => ({
  type: o.type, categorie: o.categorie, nom: o.nom, reference: o.reference ?? '', quantite: String(o.quantite),
  chantierId: o.chantierId ?? '', etat: o.etat, notes: o.notes ?? '',
})

/** Brouillon prêt à envoyer, ou null si le nom ou la quantité ne vont pas. */
function versSaisie(b: Brouillon): OutilSaisi | null {
  const quantite = Number(b.quantite)
  if (!b.nom.trim() || !Number.isInteger(quantite) || quantite < 1 || quantite > LIMITES_OUTIL.quantiteMax) return null
  return {
    type: b.type, categorie: b.type === 'vehicule' ? null : b.categorie, nom: b.nom.trim(), reference: b.reference.trim() || null,
    quantite, chantierId: b.chantierId || null, etat: b.etat, notes: b.notes.trim() || null,
  }
}

/** Nouvel élément : dans la catégorie et sur le chantier que montre le filtre, s'il y en a un. */
function nouveauBrouillon(filtreGroupe: '' | GroupeOutil, filtreLieu: string): Brouillon {
  const chantierId = filtreLieu && filtreLieu !== 'depot' ? filtreLieu : ''
  if (filtreGroupe === 'vehicule') return { ...VIDE, type: 'vehicule', chantierId }
  const categorie = (CATEGORIES_OUTIL as readonly string[]).includes(filtreGroupe) ? filtreGroupe as CategorieOutil : null
  return { ...VIDE, categorie, chantierId }
}

/** Ce que dit de cet outil la vérification la plus récente qui le cite (les vérifications arrivent de la plus récente). */
function derniereMention(outilId: string, verifications: readonly VerificationEcran[]): { vendredi: string; manque: boolean; enPanne: boolean; compte: string } | null {
  for (const v of verifications) {
    const ligne = v.lignes.find(l => l.outilId === outilId)
    // « 3/4 » pour un lot dont une partie seulement manque.
    const compte = ligne && ligne.attendus > 1 && ligne.presents < ligne.attendus ? ` ${ligne.presents}/${ligne.attendus}` : ''
    if (ligne) return { vendredi: v.vendredi, manque: ligne.presents < ligne.attendus, enPanne: ligne.enPanne, compte }
  }
  return null
}

type Mention = NonNullable<ReturnType<typeof derniereMention>>

/** Badge de la dernière vérification : manquant (rouge), en panne (orange), présent (vert). */
function badgeMention(mention: Mention, isPt: boolean): { couleur: string; texte: string } {
  if (mention.manque) return { couleur: 'red', texte: `${isPt ? 'Em falta' : 'Manquant'}${mention.compte}` }
  if (mention.enPanne) return { couleur: 'orange', texte: isPt ? 'Avariada' : 'En panne' }
  return { couleur: 'green', texte: isPt ? 'Presente' : 'Présent' }
}

interface Props {
  contexte: ContexteOutillage
  isPt: boolean
  envoyer: EnvoyerOutillage
  recharger: () => Promise<void>
}

export function OngletRepertoire({ contexte, isPt, envoyer, recharger }: Readonly<Props>) {
  const [recherche, setRecherche] = useState('')
  const [filtreGroupe, setFiltreGroupe] = useState<'' | GroupeOutil>('')
  const [filtreLieu, setFiltreLieu] = useState('')
  const [edition, setEdition] = useState<{ id: string | null; brouillon: Brouillon } | null>(null)
  const [aRetirer, setARetirer] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)

  const lieux = useMemo(() => new Map(contexte.lieux.map(l => [l.id, l])), [contexte.lieux])
  const nomDuLieu = (chantierId: string | null) => {
    if (!chantierId) return isPt ? 'Armazém' : 'Dépôt'
    return lieux.get(chantierId)?.titre || (isPt ? 'Obra apagada' : 'Chantier supprimé')
  }
  // Où envoyer un outil : le dépôt et les chantiers ni terminés ni annulés, plus son chantier actuel quel qu'il soit.
  const destinations = (actuel: string) => contexte.lieux.filter(l => !STATUTS_FERMES.has(l.statut) || l.id === actuel)

  // Lieu et recherche d'abord (le nombre de chaque catégorie en dépend), puis la catégorie choisie.
  const trouves = useMemo(() => contexte.outils
    .filter(o => !filtreLieu || (filtreLieu === 'depot' ? !o.chantierId : o.chantierId === filtreLieu))
    .filter(o => correspondRecherche(recherche, [o.nom, o.reference, o.notes, libelleGroupe(groupeDe(o), isPt)])),
  [contexte.outils, filtreLieu, recherche, isPt])
  // Boutons de catégorie : celles qui ont au moins un élément au répertoire. Une catégorie choisie qui s'est vidée
  // (dernier outil « Sem categoria » classé, dernier andaime retiré) ne filtre plus : l'écran revient à « Tudo ».
  const groupesDuRepertoire = ORDRE_GROUPES.filter(g => contexte.outils.some(o => groupeDe(o) === g))
  const groupeActif: '' | GroupeOutil = filtreGroupe && groupesDuRepertoire.includes(filtreGroupe) ? filtreGroupe : ''
  const groupes = useMemo(() => parGroupe(trouves.filter(o => !groupeActif || groupeDe(o) === groupeActif)), [trouves, groupeActif])
  const affiches = groupes.reduce((n, g) => n + g.outils.length, 0)
  const nombreDans = (g: GroupeOutil) => trouves.filter(o => groupeDe(o) === g).length
  const sansCategorie = contexte.outils.filter(o => groupeDe(o) === 'sans').length

  async function enregistrer() {
    if (!edition || envoi) return
    // Obligatoire pour une ferramenta nouvelle ; un outil saisi avant les catégories se modifie (déplacement, panne)
    // sans être forcé de la choisir.
    if (edition.id === null && edition.brouillon.type === 'outil' && !edition.brouillon.categorie) {
      toast.error(isPt ? 'Escolha a categoria da ferramenta.' : 'Choisissez la catégorie de l’outil.')
      return
    }
    const outil = versSaisie(edition.brouillon)
    if (!outil) {
      toast.error(isPt ? 'Indique um nome e uma quantidade entre 1 e 999.' : 'Indiquez un nom et une quantité entre 1 et 999.')
      return
    }
    setEnvoi(true)
    const resultat = await envoyer(edition.id ? { action: 'modifier', id: edition.id, outil } : { action: 'creer', outil })
    setEnvoi(false)
    if (!resultat.ok) {
      toast.error(messageErreurOutillage(resultat.code, isPt))
      return
    }
    toast.success(isPt ? `« ${outil.nom} » guardado.` : `« ${outil.nom} » enregistré.`)
    setEdition(null)
    await recharger()
  }

  async function retirer(o: OutilEcran) {
    if (envoi) return
    setEnvoi(true)
    const resultat = await envoyer({ action: 'retirer', id: o.id })
    setEnvoi(false)
    setARetirer(null)
    if (!resultat.ok) {
      toast.error(messageErreurOutillage(resultat.code, isPt))
      return
    }
    toast.success(isPt ? `« ${o.nom} » retirado do inventário.` : `« ${o.nom} » retiré du répertoire.`)
    await recharger()
  }

  const b = edition?.brouillon
  const modifier = (valeur: Partial<Brouillon>) => setEdition(e => (e ? { ...e, brouillon: { ...e.brouillon, ...valeur } } : e))
  // Une seule liste : les catégories d'outils, puis « Viatura » (le type suit le choix).
  const choisirCategorie = (valeur: string) => {
    if (valeur === 'vehicule') modifier({ type: 'vehicule', categorie: null })
    else if ((CATEGORIES_OUTIL as readonly string[]).includes(valeur)) modifier({ type: 'outil', categorie: valeur as CategorieOutil })
  }

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="search" className="v5-fi" style={{ flex: '1 1 180px' }} value={recherche} onChange={e => setRecherche(e.target.value)}
          placeholder={isPt ? 'Procurar (nome, categoria, referência, matrícula)' : 'Rechercher (nom, catégorie, référence, immatriculation)'}
          aria-label={isPt ? 'Procurar no inventário' : 'Rechercher dans le répertoire'}
        />
        <select className="v5-filter-sel" value={filtreLieu} onChange={e => setFiltreLieu(e.target.value)} aria-label={isPt ? 'Filtrar por localização' : 'Filtrer par emplacement'}>
          <option value="">{isPt ? 'Todas as localizações' : 'Tous les emplacements'}</option>
          <option value="depot">{isPt ? 'Armazém' : 'Dépôt'}</option>
          {contexte.lieux.map(l => <option key={l.id} value={l.id}>{l.titre || '—'}</option>)}
        </select>
        <button type="button" className="v5-btn v5-btn-p" disabled={edition !== null} onClick={() => setEdition({ id: null, brouillon: nouveauBrouillon(groupeActif, filtreLieu) })}>
          {isPt ? '+ Adicionar' : '+ Ajouter'}
        </button>
      </div>

      {contexte.outils.length > 0 && (
        <fieldset style={{ border: 0, margin: 0, padding: 0, minWidth: 0, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <legend className="sr-only">{isPt ? 'Filtrar por categoria' : 'Filtrer par catégorie'}</legend>
          <button type="button" className={`v5-btn v5-btn-sm${groupeActif === '' ? ' v5-btn-p' : ''}`} aria-pressed={groupeActif === ''} onClick={() => setFiltreGroupe('')}>
            {isPt ? `Tudo (${trouves.length})` : `Tout (${trouves.length})`}
          </button>
          {groupesDuRepertoire.map(g => (
            <button
              key={g} type="button" className={`v5-btn v5-btn-sm${groupeActif === g ? ' v5-btn-p' : ''}`} aria-pressed={groupeActif === g}
              onClick={() => setFiltreGroupe(groupeActif === g ? '' : g)}
            >
              <span aria-hidden="true">{iconeGroupe(g)} </span>{`${libelleGroupe(g, isPt)} (${nombreDans(g)})`}
            </button>
          ))}
        </fieldset>
      )}
      {sansCategorie > 0 && (
        <div style={{ fontSize: 12, color: GRIS }}>
          {isPt
            ? `${sansCategorie} ferramenta${sansCategorie > 1 ? 's' : ''} ainda sem categoria: escolha-a em « Editar ».`
            : `${sansCategorie} outil${sansCategorie > 1 ? 's' : ''} encore sans catégorie : choisissez-la dans « Modifier ».`}
        </div>
      )}

      {edition && b && (
        <div className="v5-card">
          <div className="v5-st">{edition.id ? (isPt ? 'Editar' : 'Modifier') : (isPt ? 'Novo elemento' : 'Nouvel élément')}</div>
          <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            <label className="v5-fl">{isPt ? 'Categoria' : 'Catégorie'} *
              <select className="v5-fi" value={b.type === 'vehicule' ? 'vehicule' : b.categorie ?? ''} onChange={e => choisirCategorie(e.target.value)}>
                {b.type === 'outil' && !b.categorie && <option value="" disabled>{isPt ? 'Escolher a categoria' : 'Choisir la catégorie'}</option>}
                <optgroup label={libelleType('outil', isPt, true)}>
                  {CATEGORIES_OUTIL.map(c => <option key={c} value={c}>{libelleGroupe(c, isPt)}</option>)}
                </optgroup>
                <optgroup label={libelleType('vehicule', isPt, true)}>
                  <option value="vehicule">{libelleType('vehicule', isPt)}</option>
                </optgroup>
              </select>
            </label>
            <label className="v5-fl">{isPt ? 'Nome' : 'Nom'} *
              <input className="v5-fi" value={b.nom} maxLength={LIMITES_OUTIL.nom} onChange={e => modifier({ nom: e.target.value })}
                placeholder={b.type === 'vehicule' ? (isPt ? 'Ex.: Carrinha Renault Master' : 'Ex. : Camionnette Renault Master') : (isPt ? 'Ex.: Martelo perfurador Hilti' : 'Ex. : Perforateur Hilti')} />
            </label>
            <label className="v5-fl">{b.type === 'vehicule' ? (isPt ? 'Matrícula' : 'Immatriculation') : (isPt ? 'Referência / n.º de série' : 'Référence / n° de série')}
              <input className="v5-fi" value={b.reference} maxLength={LIMITES_OUTIL.reference} onChange={e => modifier({ reference: e.target.value })} />
            </label>
            <label className="v5-fl">{isPt ? 'Quantidade' : 'Quantité'}
              <input className="v5-fi" type="number" inputMode="numeric" min={1} max={LIMITES_OUTIL.quantiteMax} value={b.quantite} onChange={e => modifier({ quantite: e.target.value })} />
            </label>
            <label className="v5-fl">{isPt ? 'Localização' : 'Emplacement'}
              <select className="v5-fi" value={b.chantierId} onChange={e => modifier({ chantierId: e.target.value })}>
                <option value="">{isPt ? 'Armazém' : 'Dépôt'}</option>
                {destinations(b.chantierId).map(l => <option key={l.id} value={l.id}>{l.titre || '—'}</option>)}
              </select>
            </label>
            <label className="v5-fl">{isPt ? 'Estado' : 'État'}
              <select className="v5-fi" value={b.etat} onChange={e => modifier({ etat: e.target.value as EtatOutil })}>
                <option value="ok">{isPt ? 'Operacional' : 'En état'}</option>
                <option value="en_panne">{isPt ? 'Avariada' : 'En panne'}</option>
              </select>
            </label>
          </div>
          <label className="v5-fl" style={{ display: 'block', marginTop: 8 }}>{isPt ? 'Notas' : 'Notes'}
            <textarea className="v5-fi" rows={2} style={{ width: '100%' }} value={b.notes} maxLength={LIMITES_OUTIL.notes} onChange={e => modifier({ notes: e.target.value })} />
          </label>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button type="button" className="v5-btn v5-btn-p" disabled={envoi} onClick={() => { void enregistrer() }}>{isPt ? 'Guardar' : 'Enregistrer'}</button>
            <button type="button" className="v5-btn" disabled={envoi} onClick={() => setEdition(null)}>{isPt ? 'Cancelar' : 'Annuler'}</button>
          </div>
        </div>
      )}

      {contexte.outils.length === 0 && !edition && (
        <div className="v5-card" style={{ fontSize: 13, color: GRIS }}>
          {isPt
            ? 'O inventário está vazio. Adicione as ferramentas e viaturas da empresa e indique em que obra estão: o encarregado de cada obra verifica-as à sexta-feira.'
            : 'Le répertoire est vide. Ajoutez les outils et véhicules de la société et indiquez sur quel chantier ils sont : le chef de chaque chantier les vérifie le vendredi.'}
        </div>
      )}

      {affiches > 0 && (
        <div className="v5-card" style={{ overflowX: 'auto', padding: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #eee' }}>
                <th style={{ padding: 8 }}>{isPt ? 'Elemento' : 'Élément'}</th>
                <th style={{ padding: 8 }}>{isPt ? 'Qtd.' : 'Qté'}</th>
                <th style={{ padding: 8 }}>{isPt ? 'Localização' : 'Emplacement'}</th>
                <th style={{ padding: 8 }}>{isPt ? 'Última verificação' : 'Dernière vérification'}</th>
                <th style={{ padding: 8 }}><span className="sr-only">{isPt ? 'Ações' : 'Actions'}</span></th>
              </tr>
            </thead>
            {groupes.map(g => (
              <tbody key={g.groupe}>
                <tr style={{ background: '#fafafa', borderBottom: '1px solid #eee' }}>
                  <th colSpan={5} scope="rowgroup" style={{ padding: '6px 8px', textAlign: 'left', fontSize: 12 }}>
                    <span aria-hidden="true">{iconeGroupe(g.groupe)} </span>{libelleGroupe(g.groupe, isPt)}
                    <span style={{ color: GRIS, fontWeight: 400 }}>{` (${g.outils.length})`}</span>
                  </th>
                </tr>
                {g.outils.map(o => {
                  const mention = derniereMention(o.id, contexte.verifications)
                  return (
                    <tr key={o.id} style={{ borderBottom: '1px solid #f3f3f3' }}>
                      <td style={{ padding: 8 }}>
                        <div style={{ fontWeight: 600 }}><span aria-hidden="true">{iconeGroupe(g.groupe)} </span>{o.nom}</div>
                        {(o.reference || o.etat === 'en_panne') && (
                          <div style={{ fontSize: 12, color: GRIS }}>
                            {o.reference}
                            {o.etat === 'en_panne' && <span className="v5-badge v5-badge-red" style={{ marginLeft: o.reference ? 6 : 0 }}>{isPt ? 'Avariada' : 'En panne'}</span>}
                          </div>
                        )}
                        {o.notes && <div style={{ fontSize: 12, color: GRIS }}>{o.notes}</div>}
                      </td>
                      <td style={{ padding: 8 }}>{o.quantite}</td>
                      <td style={{ padding: 8 }}>{nomDuLieu(o.chantierId)}</td>
                      <td style={{ padding: 8 }}>
                        {mention === null && <span style={{ color: GRIS }}>—</span>}
                        {mention && (
                          <span className={`v5-badge v5-badge-${badgeMention(mention, isPt).couleur}`}>
                            {`${badgeMention(mention, isPt).texte} · ${jourEtDate(mention.vendredi, isPt)}`}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: 8, whiteSpace: 'nowrap' }}>
                        {aRetirer === o.id ? (
                          <>
                            <span style={{ marginRight: 6 }}>{isPt ? 'Retirar?' : 'Retirer ?'}</span>
                            <button type="button" className="v5-btn v5-btn-sm v5-btn-d" disabled={envoi} onClick={() => { void retirer(o) }}>{isPt ? 'Sim' : 'Oui'}</button>{' '}
                            <button type="button" className="v5-btn v5-btn-sm" disabled={envoi} onClick={() => setARetirer(null)}>{isPt ? 'Não' : 'Non'}</button>
                          </>
                        ) : (
                          <>
                            <button type="button" className="v5-btn v5-btn-sm" disabled={edition !== null} onClick={() => setEdition({ id: o.id, brouillon: versBrouillon(o) })}>{isPt ? 'Editar' : 'Modifier'}</button>{' '}
                            <button type="button" className="v5-btn v5-btn-sm" onClick={() => setARetirer(o.id)}>{isPt ? 'Retirar' : 'Retirer'}</button>
                          </>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            ))}
          </table>
        </div>
      )}
      {contexte.outils.length > 0 && affiches === 0 && (
        <div className="v5-card" style={{ fontSize: 13, color: GRIS }}>{isPt ? 'Nenhum elemento corresponde à pesquisa.' : 'Aucun élément ne correspond à la recherche.'}</div>
      )}
    </div>
  )
}
