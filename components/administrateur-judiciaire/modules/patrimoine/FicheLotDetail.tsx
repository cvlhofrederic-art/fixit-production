'use client'

import { ficheLotDemo, type CoproprietaireDemo } from '@/components/administrateur-judiciaire/data/coproprietaires'
import { Champ, Grille, GrilleFiche, Section, Tableau } from '@/components/administrateur-judiciaire/ui/FicheBlocs'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/administrateur-judiciaire/ui/Modal'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { dateIsoVersFr } from '@/lib/administrateur-judiciaire/domain/dates'
import { quotePartPourcent } from '@/lib/administrateur-judiciaire/domain/fiche-lot'
import { formatEuros } from '@/lib/administrateur-judiciaire/domain/format'

const KIND_OCCUPATION = { Loué: 'amber', Résident: 'sage', Vacant: 'rust' } as const
const nombre = (valeur: number) => valeur.toLocaleString('fr-FR')
const date = (valeur: string | null) => (valeur ? dateIsoVersFr(valeur) : '')
const ouiNon = (valeur: boolean) => (valeur ? 'Oui' : 'Non')

export interface FicheLotDetailProps {
  /** Compte du copropriétaire et rang du lot dans ses lots ; null : fiche fermée. */
  lot: { coproprietaire: CoproprietaireDemo; index: number } | null
  onClose: () => void
  onFicheCoproprietaire: (coproprietaire: CoproprietaireDemo) => void
  onModifier: (coproprietaire: CoproprietaireDemo, index: number) => void
}

/**
 * Fiche d'un lot sur le modèle de la fiche lot de Gestéam : identification, situation, propriété (avec la part du
 * fonds de travaux attachée au lot), occupation (le locataire est celui du compte), tantièmes et quote-part par clé,
 * caractéristiques, charges et assurance, équipements, documents.
 */
export function FicheLotDetail({ lot, onClose, onFicheCoproprietaire, onModifier }: FicheLotDetailProps) {
  const ouvert = lot ? { ...lot, compte: lot.coproprietaire.fiche.lots[lot.index] } : null
  const fiche = ouvert ? ficheLotDemo(ouvert.coproprietaire, ouvert.index) : null
  const premiere = fiche?.tantiemes[0]
  return (
    <Modal open={!!ouvert} onClose={onClose} size="lg" labelledBy="fl-t">
      {ouvert && fiche && (
        <>
          <ModalHeader id="fl-t" icon="home" title={ouvert.compte.lot} onClose={onClose} />
          <ModalBody>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <span className="muted" style={{ fontSize: 12.5, flex: '1 1 260px' }}>
                {ouvert.coproprietaire.copro} · {ouvert.compte.nature} · {fiche.principal ? 'lot principal' : 'lot secondaire'}
              </span>
              <Pill kind={KIND_OCCUPATION[ouvert.compte.occupation]}>{ouvert.compte.occupation}</Pill>
              {premiere && (
                <Pill kind="gold" noDot>
                  {nombre(premiere.numerateur)} / {nombre(premiere.denominateur)} · {quotePartPourcent(premiere)}
                </Pill>
              )}
            </div>
            <GrilleFiche>
              <Section titre="Identification" icone="fact">
                <Grille>
                  <Champ k="N° de lot" v={fiche.numero} />
                  <Champ k="Référence" v={fiche.reference} />
                  <Champ k="Type" v={ouvert.compte.nature} />
                  <Champ k="Groupe" v={fiche.groupe} />
                  <Champ k="Lot principal" v={ouiNon(fiche.principal)} />
                  <Champ k="Hors règlement" v={ouiNon(fiche.horsReglement)} />
                </Grille>
              </Section>
              <Section titre="Situation" icone="pin">
                <Grille>
                  <Champ k="Bâtiment" v={fiche.batiment} />
                  <Champ k="Escalier" v={fiche.escalier} />
                  <Champ k="Étage" v={fiche.etage} />
                  <Champ k="Porte" v={fiche.porte} />
                  <Champ k="Interphone" v={fiche.interphone} />
                  <Champ k="Boîte aux lettres" v={fiche.boiteAuxLettres} />
                </Grille>
              </Section>
              <Section titre="Propriété" icone="users">
                <Grille>
                  <Champ
                    k="Copropriétaire"
                    v={`Compte n° ${ouvert.coproprietaire.fiche.numeroCompte} · ${ouvert.coproprietaire.nom}`}
                    full
                  />
                  <Champ k="Acquis le" v={date(fiche.acquisLe)} />
                  <Champ k="Ancien copropriétaire" v={fiche.ancienCoproprietaire} />
                  <Champ
                    k="Fonds de travaux attaché au lot"
                    v={
                      fiche.fondsTravauxAttacheEuros === null
                        ? 'Non calculé'
                        : `${formatEuros(fiche.fondsTravauxAttacheEuros)} (non remboursable à la vente)`
                    }
                    full
                  />
                </Grille>
              </Section>
              <Section titre="Occupation" icone="key">
                <Grille>
                  <Champ k="Occupé par" v={ouvert.compte.occupation === 'Loué' ? 'Locataire' : ouvert.compte.occupation} />
                  <Champ k="Depuis le" v={date(fiche.occupeDepuis)} />
                  {ouvert.compte.occupation === 'Loué' && ouvert.coproprietaire.locataire && (
                    <>
                      <Champ
                        k="Identité du locataire"
                        v={`${ouvert.coproprietaire.locataire.prenom} ${ouvert.coproprietaire.locataire.nom}`.trim()}
                      />
                      <Champ k="Téléphone du locataire" v={ouvert.coproprietaire.locataire.tel} />
                      <Champ k="Courriel du locataire" v={ouvert.coproprietaire.locataire.mail} full />
                    </>
                  )}
                </Grille>
              </Section>
              <Section titre="Tantièmes par clé" icone="chart" large>
                <Tableau
                  entetes={['Clé', 'Tantièmes', 'Total', 'Quote-part']}
                  largeurs={[44, 18, 18, 20]}
                  lignes={fiche.tantiemes.map((ligne) => [
                    ligne.cle,
                    nombre(ligne.numerateur),
                    nombre(ligne.denominateur),
                    quotePartPourcent(ligne),
                  ])}
                  vide="Aucun tantième enregistré pour ce lot."
                />
              </Section>
              <Section titre="Caractéristiques" icone="grid">
                <Grille>
                  <Champ k="Surface" v={fiche.surfaceM2 === null ? '' : `${nombre(fiche.surfaceM2)} m²`} />
                  <Champ k="Loi Carrez" v={fiche.carrezM2 === null ? '' : `${nombre(fiche.carrezM2)} m²`} />
                  <Champ
                    k="Pièces"
                    v={fiche.pieces === null ? '' : `${fiche.pieces}${fiche.chambres ? ` dont ${fiche.chambres} chambres` : ''}`}
                  />
                  <Champ k="DPE" v={fiche.dpe ? `${fiche.dpe}${fiche.dpeAnnee ? ` (${fiche.dpeAnnee})` : ''}` : ''} />
                </Grille>
              </Section>
              <Section titre="Charges et assurance" icone="coin">
                <Grille>
                  <Champ
                    k="Charges annuelles (budget)"
                    v={fiche.chargesAnnuellesEuros === null ? '' : formatEuros(fiche.chargesAnnuellesEuros)}
                  />
                  <Champ
                    k="Cotisation fonds de travaux"
                    v={fiche.cotisationFondsTravauxEuros === null ? '' : `${formatEuros(fiche.cotisationFondsTravauxEuros)} par an`}
                  />
                  <Champ k="Assurance PNO" v={fiche.echeancePno ? `Échéance ${dateIsoVersFr(fiche.echeancePno)}` : ''} />
                </Grille>
              </Section>
              <Section titre="Équipements du lot" icone="tools">
                <Tableau
                  entetes={['Équipement', 'Famille', 'Emploi']}
                  largeurs={[44, 28, 28]}
                  lignes={fiche.equipements.map((equipement) => [equipement.nom, equipement.famille, equipement.emploi])}
                  vide="Aucun équipement enregistré."
                />
              </Section>
              <Section titre="Documents du lot" icone="folder">
                <Tableau
                  entetes={['Date', 'Émetteur', 'Titre']}
                  largeurs={[24, 30, 46]}
                  lignes={fiche.documents.map((document) => [dateIsoVersFr(document.date), document.emetteur, document.titre])}
                  vide="Aucun document rattaché au lot."
                />
              </Section>
            </GrilleFiche>
          </ModalBody>
          <ModalFooter>
            <button className="btn" onClick={onClose}>
              Fermer
            </button>
            <button className="btn" onClick={() => onFicheCoproprietaire(ouvert.coproprietaire)}>
              Fiche du copropriétaire
            </button>
            <button className="btn gold" onClick={() => onModifier(ouvert.coproprietaire, ouvert.index)}>
              <Icon name="pencil" />
              Modifier la fiche
            </button>
          </ModalFooter>
        </>
      )}
    </Modal>
  )
}
