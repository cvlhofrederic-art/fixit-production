'use client'

import { Alert } from '@/components/administrateur-judiciaire/ui/Alert'
import { Champ, Grille, GrilleFiche, Section, Tableau } from '@/components/administrateur-judiciaire/ui/FicheBlocs'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/administrateur-judiciaire/ui/Modal'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { dateIsoVersFr } from '@/lib/administrateur-judiciaire/domain/dates'
import {
  comptagePresence,
  echeanceContestation,
  limitePresentationConvocation,
  resultatsResolutions,
  type FicheAssemblee,
} from '@/lib/administrateur-judiciaire/domain/fiche-assemblee'
import { formatEuros } from '@/lib/administrateur-judiciaire/domain/format'
import { MAJORITES_AG } from '@/lib/administrateur-judiciaire/domain/majorites-ag'
import { controlerConvocation, controlerPouvoirs } from '@/lib/administrateur-judiciaire/domain/votes-ag'

const nombre = (valeur: number) => valeur.toLocaleString('fr-FR')
const date = (valeur: string | null) => (valeur ? dateIsoVersFr(valeur) : '')
const ouiNon = (valeur: boolean) => (valeur ? 'Oui' : 'Non')
const JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
const jourDeLaSemaine = (iso: string) => JOURS[new Date(`${iso}T12:00:00Z`).getUTCDay()]
const TENUE = new Set(['Tenue', 'PV signé', 'Notifiée'])
const KIND_STATUT: Record<FicheAssemblee['statut'], string> = {
  Projet: 'navy',
  Convoquée: 'amber',
  Tenue: 'gold',
  'PV signé': 'gold',
  Notifiée: 'sage',
}
const COULEUR_RESULTAT = (libelle: string) => {
  if (libelle.startsWith('Adoptée')) return 'var(--sage-700)'
  if (libelle.startsWith('Rejetée')) return 'var(--rust-700)'
  return 'var(--navy-500)'
}

export interface FicheAssembleeDetailProps {
  assemblee: FicheAssemblee | null
  nomCopro: string
  onClose: () => void
  onFicheCopropriete: () => void
  onModifier: (assemblee: FicheAssemblee) => void
}

/** Bloc « Convocation » : limite de présentation (D. 1967 art. 9) et contrôle du délai de 21 jours. */
function BlocConvocation({ assemblee }: { assemblee: FicheAssemblee }) {
  const controle = controlerConvocation({ datePremierePresentation: assemblee.convocationPresenteeLe, dateAssemblee: assemblee.date })
  let etat = 'Non vérifiable'
  if (controle.conforme === true) etat = 'Respecté'
  if (controle.conforme === false) etat = 'Non respecté'
  return (
    <Section titre="Convocation" icone="mail">
      <Grille>
        <Champ k="Présentation au plus tard" v={dateIsoVersFr(limitePresentationConvocation(assemblee.date))} />
        <Champ k="Envoyée le" v={date(assemblee.convocationEnvoyeeLe)} />
        <Champ k="Première présentation" v={date(assemblee.convocationPresenteeLe)} />
        <Champ
          k="Délai de 21 jours"
          v={
            <span title={controle.message} style={{ color: controle.conforme === false ? 'var(--rust-700)' : undefined }}>
              {etat}
            </span>
          }
        />
        <Champ k="Clé de la feuille de présence" v={assemblee.clePresence} full />
      </Grille>
    </Section>
  )
}

/** Bloc « Procès-verbal » : signature, notification et échéance de contestation (L. 1965 art. 42, J1). */
function BlocProcesVerbal({ assemblee }: { assemblee: FicheAssemblee }) {
  const contestation = assemblee.pvPresenteLe ? echeanceContestation(assemblee.pvPresenteLe) : null
  return (
    <Section titre="Procès-verbal" icone="stamp">
      <Grille>
        <Champ k="Signé le" v={date(assemblee.pvSigneLe)} />
        <Champ k="Notification présentée le" v={date(assemblee.pvPresenteLe)} />
        <Champ
          k="Contestation possible jusqu'au"
          v={contestation ? `${dateIsoVersFr(contestation.echeance)} (art. 42, sans report)` : 'Calculée à la notification'}
          full
        />
      </Grille>
    </Section>
  )
}

/**
 * Fiche d'une assemblée sur le modèle de la fiche assemblée de Gestéam : date et tenue, convocation (délai contrôlé),
 * ordre du jour et résultats (majorité et second vote calculés), présence, bureau et pouvoirs (art. 22 contrôlé),
 * décisions de l'exercice, procès-verbal (échéance de contestation), notes et équipe.
 */
export function FicheAssembleeDetail({ assemblee, nomCopro, onClose, onFicheCopropriete, onModifier }: FicheAssembleeDetailProps) {
  if (!assemblee) return <Modal open={false} onClose={onClose} size="lg" labelledBy="fa-t" />
  const titre = `Assemblée générale du ${dateIsoVersFr(assemblee.date)}`
  const tenue = TENUE.has(assemblee.statut)
  const resultats = resultatsResolutions(assemblee)
  const comptage = comptagePresence(assemblee.feuille)
  const anomaliesPouvoirs = controlerPouvoirs(assemblee.feuille)
  const nomDe = (compteId: string | null) => (compteId ? (assemblee.noms[compteId] ?? compteId) : '')
  const pouvoirs = assemblee.feuille.filter((ligne) => ligne.etat === 'represente')
  return (
    <Modal open onClose={onClose} size="lg" labelledBy="fa-t">
      <ModalHeader id="fa-t" icon="team" title={titre} onClose={onClose} />
      <ModalBody>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <span className="muted" style={{ fontSize: 12.5, flex: '1 1 260px' }}>
            {nomCopro} · {assemblee.nature} · N° {assemblee.numero}
          </span>
          <Pill kind={KIND_STATUT[assemblee.statut]}>{assemblee.statut}</Pill>
        </div>
        {anomaliesPouvoirs.length > 0 && (
          <Alert kind="warn" icon="alert" title="Pouvoirs à vérifier">
            {anomaliesPouvoirs.map((anomalie) => anomalie.message).join(' ')}
          </Alert>
        )}
        <GrilleFiche>
          <Section titre="Date et tenue" icone="calendar">
            <Grille>
              <Champ k="Date" v={`${jourDeLaSemaine(assemblee.date)} ${dateIsoVersFr(assemblee.date)}`} />
              <Champ k="Horaires" v={`${assemblee.heureDebut} – ${assemblee.heureFin}`} />
              <Champ k="Lieu" v={assemblee.lieu} full />
              <Champ k="Visioconférence" v={ouiNon(assemblee.visio)} />
              <Champ k="Vote par correspondance" v={ouiNon(assemblee.voteCorrespondance)} />
            </Grille>
          </Section>
          <BlocConvocation assemblee={assemblee} />
          <Section titre="Ordre du jour et résultats" icone="clipboard" large>
            <Tableau
              entetes={['N°', 'Résolution', 'Majorité', 'Pour', 'Contre', 'Résultat']}
              largeurs={[6, 36, 14, 11, 11, 22]}
              lignes={resultats.map(({ resolution, vote, libelle }) => [
                resolution.numero,
                resolution.intitule,
                MAJORITES_AG[resolution.majorite].base.replace('L. 1965 ', ''),
                vote ? nombre(vote.pour) : '—',
                vote ? nombre(vote.contre) : '—',
                <span key="resultat" title={libelle} style={{ color: COULEUR_RESULTAT(libelle), fontWeight: 600 }}>
                  {libelle}
                </span>,
              ])}
              vide="Aucune résolution inscrite."
            />
          </Section>
          <Section titre="Présence" icone="users">
            {tenue ? (
              <Tableau
                entetes={['Situation', 'Copropriétaires', 'Tantièmes']}
                largeurs={[44, 28, 28]}
                lignes={[
                  ['Présents', comptage.present.nombre, nombre(comptage.present.tantiemes)],
                  ['Représentés', comptage.represente.nombre, nombre(comptage.represente.tantiemes)],
                  [
                    'Correspondance / visio',
                    comptage.correspondance.nombre + comptage.visio.nombre,
                    nombre(comptage.correspondance.tantiemes + comptage.visio.tantiemes),
                  ],
                  ['Absents', comptage.absent.nombre, nombre(comptage.absent.tantiemes)],
                ]}
              />
            ) : (
              <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>
                Feuille de présence établie le jour de l&apos;assemblée ({assemblee.feuille.length} copropriétaires convoqués).
              </p>
            )}
          </Section>
          <Section titre="Bureau et pouvoirs" icone="scale">
            <Grille>
              <Champ k="Président de séance" v={assemblee.bureau.president} />
              <Champ k="Secrétaire" v={assemblee.bureau.secretaire} />
              <Champ k="Scrutateurs" v={assemblee.bureau.scrutateurs.join(', ')} full />
              <Champ
                k="Pouvoirs"
                v={`${pouvoirs.length} · ${anomaliesPouvoirs.length === 0 ? 'conformes (art. 22)' : 'à vérifier'}`}
              />
              <Champ
                k="Mandataires"
                v={[...new Set(pouvoirs.map((ligne) => nomDe(ligne.mandataire)))].filter(Boolean).join(', ')}
              />
            </Grille>
          </Section>
          <Section titre="Décisions de l'exercice" icone="chart">
            <Grille>
              <Champ k="Exercice approuvé" v={assemblee.decisions.exerciceApprouve ?? ''} />
              <Champ
                k={assemblee.decisions.budgetAnnee ? `Budget ${assemblee.decisions.budgetAnnee}` : 'Budget voté'}
                v={assemblee.decisions.budgetVoteEuros === null ? '' : formatEuros(assemblee.decisions.budgetVoteEuros)}
              />
              <Champ k="Mandat du CS" v={assemblee.decisions.mandatCsMois ? `${assemblee.decisions.mandatCsMois} mois` : ''} />
              <Champ
                k="Seuil de consultation du CS"
                v={
                  assemblee.decisions.seuilConsultationCsEuros === null
                    ? ''
                    : formatEuros(assemblee.decisions.seuilConsultationCsEuros)
                }
              />
            </Grille>
          </Section>
          <BlocProcesVerbal assemblee={assemblee} />
          <Section titre="Notes et équipe" icone="doc" large>
            <Grille>
              <Champ k="Notes" v={assemblee.notes} />
              <Champ k="Responsable · assistant" v={`${assemblee.responsable} · ${assemblee.assistant}`} />
            </Grille>
          </Section>
        </GrilleFiche>
      </ModalBody>
      <ModalFooter>
        <button className="btn" onClick={onClose}>
          Fermer
        </button>
        <button className="btn" onClick={onFicheCopropriete}>
          Fiche copropriété
        </button>
        <button className="btn gold" onClick={() => onModifier(assemblee)}>
          <Icon name="pencil" />
          Modifier la fiche
        </button>
      </ModalFooter>
    </Modal>
  )
}
