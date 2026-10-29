'use client'

import type { CoproprietaireDemo, TelecomDemo } from '@/components/administrateur-judiciaire/data/coproprietaires'
import { Alert } from '@/components/administrateur-judiciaire/ui/Alert'
import { Case, Champ, Grille, GrilleFiche, Section, Tableau } from '@/components/administrateur-judiciaire/ui/FicheBlocs'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/administrateur-judiciaire/ui/Modal'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { formatEurosCentimes } from '@/lib/administrateur-judiciaire/domain/format'

/** Téléphones et courriels : le courriel et le téléphone principaux du compte, puis les autres. */
export function telecomsDuCompte(coproprietaire: CoproprietaireDemo): TelecomDemo[] {
  const principaux: TelecomDemo[] = [
    { type: 'Courriel', nature: 'Principal', prefere: true, valeur: coproprietaire.mail },
    {
      type: /^0[67]/.test(coproprietaire.tel) ? 'Mobile' : 'Téléphone',
      nature: 'Principal',
      prefere: true,
      valeur: coproprietaire.tel,
    },
  ]
  return [...principaux.filter((telecom) => telecom.valeur.trim() !== ''), ...coproprietaire.fiche.autresTelecoms]
}

export interface FicheCompteCoproprietaireProps {
  coproprietaire: CoproprietaireDemo | null
  onClose: () => void
  onModifier: (coproprietaire: CoproprietaireDemo) => void
}

/**
 * Fiche du compte copropriétaire, sur le modèle de la fiche client de Gestéam : identité et adresse, personnes du
 * compte (relation et part), télécoms, rattachement, lots et tantièmes par clé, locataire du lot, voie de
 * notification, conseil syndical, extranet, notes et avertissement (affiché en tête s'il existe).
 */
export function FicheCompteCoproprietaire({ coproprietaire, onClose, onModifier }: FicheCompteCoproprietaireProps) {
  const fiche = coproprietaire?.fiche
  return (
    <Modal open={!!coproprietaire} onClose={onClose} size="lg" labelledBy="fc-t">
      {coproprietaire && fiche && (
        <>
          <ModalHeader id="fc-t" icon="users" title={coproprietaire.nom} onClose={onClose} />
          <ModalBody>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <span className="muted" style={{ fontSize: 12.5, flex: '1 1 260px' }}>
                Compte copropriétaire n° {fiche.numeroCompte} · {coproprietaire.copro}
              </span>
              <Pill kind={fiche.statutCompte === 'En place' ? 'sage' : 'amber'}>{fiche.statutCompte}</Pill>
              <Pill kind={coproprietaire.pill}>Solde {formatEurosCentimes(coproprietaire.solde)}</Pill>
            </div>
            {fiche.avertissement && (
              <Alert kind="warn" icon="alert" title="Avertissement">
                {fiche.avertissement}
              </Alert>
            )}
            <GrilleFiche>
              <Section titre="Identité et adresse" icone="users">
                <Grille>
                  <Champ k="Civilité" v={fiche.civilite} />
                  <Champ k="Coordonnées" v="Principale" />
                  <Champ k="Nom" v={fiche.nomFamille} />
                  <Champ k="Prénom" v={fiche.prenom} />
                  <Champ
                    k="Adresse"
                    v={`${fiche.adresse}, ${fiche.codePostal} ${fiche.ville}, ${fiche.pays}`}
                    full
                  />
                </Grille>
              </Section>
              <Section titre="Personnes du compte" icone="team">
                <Tableau
                  entetes={['Identité', 'Relation', 'Part']}
                  largeurs={[46, 36, 18]}
                  lignes={fiche.personnes.map((personne) => [personne.identite, personne.relation, personne.part])}
                />
              </Section>
              <Section titre="Téléphones et courriels" icone="phone" large>
                <Tableau
                  entetes={['Type', 'Nature', 'Préféré', 'Numéro ou adresse']}
                  largeurs={[18, 22, 12, 48]}
                  lignes={telecomsDuCompte(coproprietaire).map((telecom) => [
                    telecom.type,
                    telecom.nature,
                    telecom.prefere ? 'Oui' : 'Non',
                    telecom.valeur,
                  ])}
                />
              </Section>
              <Section titre="Compte et rattachement" icone="building">
                <Grille>
                  <Champ k="Type de compte" v="Copropriétaire" />
                  <Champ k="Statut" v={fiche.statutCompte} />
                  <Champ k="Immeuble" v={coproprietaire.copro} />
                  <Champ k="Mandat" v={fiche.mandat} />
                  <Champ k="Situation" v={fiche.situation} />
                  <Champ k="Forme de propriété" v={fiche.formePropriete} />
                </Grille>
              </Section>
              <Section titre="Lots et tantièmes" icone="home">
                <Tableau
                  entetes={['Lot', 'Occupation', 'Nature']}
                  largeurs={[40, 26, 34]}
                  lignes={fiche.lots.map((lot) => [lot.lot, lot.occupation, lot.nature])}
                />
                <div style={{ height: 8 }} />
                <Tableau
                  entetes={['Clé de répartition', 'Tantièmes']}
                  largeurs={[64, 36]}
                  lignes={fiche.cles.map((cle) => [cle.cle, <span className="mono" key={cle.cle}>{cle.tantiemes}</span>])}
                />
              </Section>
              <Section titre="Locataire du lot" icone="key" large>
                {coproprietaire.locataire ? (
                  <Grille colonnes={4}>
                    <Champ k="Nom du locataire" v={coproprietaire.locataire.nom} />
                    <Champ k="Prénom du locataire" v={coproprietaire.locataire.prenom} />
                    <Champ k="Téléphone du locataire" v={coproprietaire.locataire.tel} />
                    <Champ k="Courriel du locataire" v={coproprietaire.locataire.mail} />
                  </Grille>
                ) : (
                  <Champ k="Locataire" v="Aucun locataire déclaré" />
                )}
              </Section>
              <Section titre="Notifications et diffusion" icone="mail">
                <Grille>
                  <Champ k="Voie de notification" v={fiche.voiePostaleDemandee ? 'Postale (demandée)' : 'Électronique'} />
                  <Champ k="Envoi recommandé" v={fiche.voiePostaleDemandee ? 'Papier (LRAR)' : 'Électronique (LRE)'} />
                  <Champ k="Copie des envois" v={fiche.copieEnvois ? 'Oui' : 'Non'} />
                </Grille>
              </Section>
              <Section titre="Conseil syndical et extranet" icone="scale">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}>
                  <Case libelle="Membre du conseil syndical" cochee={fiche.conseilSyndical.membre} />
                  <Case libelle="Président" cochee={fiche.conseilSyndical.president} />
                  <Case libelle="Correspondant" cochee={fiche.conseilSyndical.correspondant} />
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', marginTop: 10 }}>
                  <Case libelle="Extranet publié" cochee={fiche.extranet.publie} />
                  <Case libelle="Accès ouvert" cochee={fiche.extranet.acces} />
                  <Case libelle="Téléphone visible" cochee={fiche.extranet.telephoneVisible} />
                </div>
              </Section>
              <Section titre="Notes et avertissement" icone="doc" large>
                <Grille>
                  <Champ k="Notes" v={fiche.notes} />
                  <Champ k="Avertissement (affiché à l'ouverture)" v={fiche.avertissement ?? 'Aucun'} />
                </Grille>
              </Section>
            </GrilleFiche>
          </ModalBody>
          <ModalFooter>
            <button className="btn" onClick={onClose}>
              Fermer
            </button>
            <button className="btn gold" onClick={() => onModifier(coproprietaire)}>
              <Icon name="pencil" />
              Modifier la fiche
            </button>
          </ModalFooter>
        </>
      )}
    </Modal>
  )
}
