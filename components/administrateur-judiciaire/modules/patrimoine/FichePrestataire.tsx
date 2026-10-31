'use client'

import { Case, Champ, Grille, GrilleFiche, Section, Tableau } from '@/components/administrateur-judiciaire/ui/FicheBlocs'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/administrateur-judiciaire/ui/Modal'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import type { Prestataire } from '@/lib/administrateur-judiciaire/db/schema'
import { dateIsoVersFr } from '@/lib/administrateur-judiciaire/domain/dates'
import {
  etatAssurance,
  etatVigilance,
  masquerIban,
  type EtatAttestation,
  type FicheEntreprise,
} from '@/lib/administrateur-judiciaire/domain/fiche-entreprise'

/** Contrat de l'entreprise, déjà lu dans la base (copropriété résolue). */
export interface ContratFiche {
  date: string | null
  copropriete: string
  objet: string
}

const COULEUR_ETAT: Record<EtatAttestation['etat'], string> = {
  'À jour': 'var(--sage-700)',
  'Échoit bientôt': 'var(--amber-700)',
  'À renouveler': 'var(--rust-700)',
  Échue: 'var(--rust-700)',
  'Non fournie': 'var(--navy-300)',
}

const etatEnCouleur = ({ etat }: EtatAttestation) => <span style={{ color: COULEUR_ETAT[etat], fontWeight: 600 }}>{etat}</span>
const dateOuTiret = (date: string | null) => (date ? dateIsoVersFr(date) : '—')
const liste = (valeurs: string[]) => valeurs.join(', ')

/** Lignes du bloc « Assurances et vigilance ». */
function lignesAttestations(prestataire: Prestataire, fiche: FicheEntreprise, aujourdhui: string) {
  const decennale = etatAssurance(prestataire.rcDecennaleEcheance ?? null, aujourdhui)
  const rcp = etatAssurance(prestataire.rcpEcheance ?? null, aujourdhui)
  const vigilance = etatVigilance(fiche.vigilanceLe, aujourdhui)
  return [
    ['RC décennale', dateOuTiret(decennale.jusquAu), etatEnCouleur(decennale)],
    ['RC professionnelle', dateOuTiret(rcp.jusquAu), etatEnCouleur(rcp)],
    ['Vigilance URSSAF', vigilance.jusquAu ? `avant le ${dateIsoVersFr(vigilance.jusquAu)}` : '—', etatEnCouleur(vigilance)],
    ['Extrait Kbis', fiche.kbisLe ? `remis le ${dateIsoVersFr(fiche.kbisLe)}` : '—', fiche.kbisLe ? 'Fourni' : 'Non fourni'],
  ]
}

export interface FichePrestataireProps {
  prestataire: Prestataire | null
  contrats: ContratFiche[]
  /** Date du jour selon le mode (démonstration ou données réelles). */
  aujourdhui: string
  onClose: () => void
  onModifier: (prestataire: Prestataire) => void
  onNouvelOs: () => void
}

/**
 * Fiche du prestataire sur le modèle de la fiche Entreprise de Gestéam : identité et adresse, contacts, télécoms,
 * assurances et vigilance (états calculés à la date du jour), compétences et mandats, facturation et règlement (IBAN
 * masqué), réglages de relance, demandes et contrats, notes et extranet. Un prestataire sans fiche garde l'essentiel.
 */
export function FichePrestataire({ prestataire, contrats, aujourdhui, onClose, onModifier, onNouvelOs }: FichePrestataireProps) {
  const fiche = prestataire?.fiche
  const historique = [
    ...(fiche?.demandes ?? []).map((demande) => ({ ...demande })),
    ...contrats.map((contrat) => ({ ...contrat, nature: 'Contrat' })),
  ].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
  return (
    <Modal open={!!prestataire} onClose={onClose} size="lg" labelledBy="fp-t">
      {prestataire && (
        <>
          <ModalHeader id="fp-t" icon="wrench" title={prestataire.nom} onClose={onClose} />
          <ModalBody>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <span className="muted" style={{ fontSize: 12.5, flex: '1 1 260px' }}>
                {fiche ? `Entreprise n° ${fiche.numero} · ${fiche.type} · ` : ''}
                {prestataire.metier}
              </span>
              <Pill kind={fiche?.statut === 'Inactive' ? 'amber' : 'sage'}>{fiche?.statut ?? prestataire.statut}</Pill>
              <Pill kind="gold" noDot>
                Note {String(prestataire.note).replace('.', ',')} · {prestataire.interventions} interventions
              </Pill>
            </div>
            <GrilleFiche>
              <Section titre="Identité et adresse" icone="building">
                <Grille>
                  <Champ k="Forme juridique" v={fiche?.formeJuridique} />
                  <Champ k="Référence" v={fiche?.reference} />
                  <Champ
                    k="Adresse"
                    v={fiche ? `${fiche.adresse}, ${fiche.codePostal} ${prestataire.ville}, ${fiche.pays}` : prestataire.ville}
                    full
                  />
                  <Champ k="SIRET" v={prestataire.siret} />
                  <Champ k="TVA intracommunautaire" v={fiche?.tvaIntracommunautaire} />
                  <Champ k="RCS" v={fiche?.rcs} full />
                </Grille>
              </Section>
              <Section titre="Contacts" icone="users">
                <Tableau
                  entetes={['Contact, service, agence', 'Civilité', 'Fonction']}
                  largeurs={[46, 20, 34]}
                  lignes={(fiche?.contacts ?? []).map((contact) => [contact.nom, contact.civilite ?? '—', contact.fonction])}
                  vide="Aucun contact enregistré."
                />
              </Section>
              <Section titre="Téléphones et courriels" icone="phone" large>
                <Tableau
                  entetes={['Type', 'Nature', 'Préféré', 'Numéro ou adresse']}
                  largeurs={[18, 24, 12, 46]}
                  lignes={(fiche?.telecoms ?? []).map((telecom) => [
                    telecom.type,
                    telecom.nature,
                    telecom.prefere ? 'Oui' : 'Non',
                    telecom.valeur,
                  ])}
                  vide="Aucun téléphone ni courriel enregistré."
                />
              </Section>
              {fiche && (
                <Section titre="Assurances et vigilance" icone="shield">
                  <Tableau
                    entetes={['Attestation', 'Validité', 'État']}
                    largeurs={[36, 34, 30]}
                    lignes={lignesAttestations(prestataire, fiche, aujourdhui)}
                  />
                </Section>
              )}
              <Section titre="Compétences et mandats" icone="tools">
                <Grille colonnes={1}>
                  <Champ k="Domaines" v={liste(fiche?.domaines ?? [])} />
                  <Champ k="Intervient pour" v={liste(fiche?.intervientPour ?? [])} />
                  <Champ k="Exclu de" v={liste(fiche?.exclueDe ?? [])} />
                </Grille>
              </Section>
              {fiche && (
                <Section titre="Facturation et règlement" icone="coin">
                  <Grille>
                    <Champ k="Mode de règlement" v={fiche.reglement.mode} />
                    <Champ
                      k="Délai"
                      v={fiche.reglement.delaiJours === 0 ? 'À réception' : `${fiche.reglement.delaiJours} jours date de facture`}
                    />
                    <Champ k={fiche.reglement.mode === 'Chèque' ? 'Un chèque par' : 'Un virement par'} v={fiche.reglement.unVirementPar} />
                    <Champ k="Priorité" v={fiche.reglement.priorite} />
                    <Champ
                      k="IBAN"
                      v={fiche.reglement.iban ? `${masquerIban(fiche.reglement.iban)} · BIC ${fiche.reglement.bic ?? '—'}` : ''}
                      full
                    />
                  </Grille>
                </Section>
              )}
              {fiche && (
                <Section titre="Relances des demandes" icone="bell">
                  <Tableau
                    entetes={['Réglage', 'Devis', 'Interventions']}
                    largeurs={[52, 24, 24]}
                    lignes={[
                      ['Délai de relance (jours)', fiche.relances.devis.delaiRelanceJours, fiche.relances.interventions.delaiRelanceJours],
                      ['Demandes en cours (max.)', fiche.relances.devis.maxDemandesEnCours, fiche.relances.interventions.maxDemandesEnCours],
                      ['Alerte au-delà de', fiche.relances.devis.alerteAuDela, fiche.relances.interventions.alerteAuDela],
                    ]}
                  />
                </Section>
              )}
              <Section titre="Demandes, devis et contrats" icone="clipboard" large>
                <Tableau
                  entetes={['Date', 'Nature', 'Copropriété', 'Objet']}
                  largeurs={[16, 14, 30, 40]}
                  lignes={historique.map((ligne) => [dateOuTiret(ligne.date), ligne.nature, ligne.copropriete, ligne.objet])}
                  vide="Aucune demande, aucun devis ni contrat."
                />
              </Section>
              <Section titre="Notes et extranet" icone="doc" large>
                <Grille>
                  <Champ k="Notes" v={fiche?.notes} />
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', alignItems: 'flex-end' }}>
                    <Case libelle="Coordonnées publiées sur l'extranet" cochee={fiche?.extranet.publie ?? false} />
                    <Case libelle="Accès extranet ouvert" cochee={fiche?.extranet.acces ?? false} />
                  </div>
                </Grille>
              </Section>
            </GrilleFiche>
          </ModalBody>
          <ModalFooter>
            <button className="btn" onClick={onClose}>
              Fermer
            </button>
            <button className="btn" onClick={onNouvelOs}>
              Nouvel OS
            </button>
            <button className="btn gold" onClick={() => onModifier(prestataire)}>
              <Icon name="pencil" />
              Modifier la fiche
            </button>
          </ModalFooter>
        </>
      )}
    </Modal>
  )
}
