'use client'

import { LienFiche } from '@/components/administrateur-judiciaire/modules/patrimoine/FicheCompteCoproprietaire'
import { Alert } from '@/components/administrateur-judiciaire/ui/Alert'
import { Champ, Grille, GrilleFiche, Section, Tableau } from '@/components/administrateur-judiciaire/ui/FicheBlocs'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/administrateur-judiciaire/ui/Modal'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import type { CoproprieteVue } from '@/lib/administrateur-judiciaire/domain/coproprietes'
import { dateIsoVersFr } from '@/lib/administrateur-judiciaire/domain/dates'
import type { FicheAssemblee } from '@/lib/administrateur-judiciaire/domain/fiche-assemblee'
import { finConseilSyndical, nouvelleFicheCopropriete } from '@/lib/administrateur-judiciaire/domain/fiche-copropriete'
import { formatDateFr, formatEuros } from '@/lib/administrateur-judiciaire/domain/format'

/** Entreprise intervenant dans l'immeuble (prestataire et, s'il existe, son contrat). */
export interface EntrepriseImmeuble {
  nom: string
  domaine: string
  contrat: string
}

export interface FicheCoproprieteDetailProps {
  copro: CoproprieteVue | null
  entreprises: EntrepriseImmeuble[]
  onClose: () => void
  onModifier: (copro: CoproprieteVue) => void
  onFiche360: (copro: CoproprieteVue) => void
  /** Assemblées de la copropriété ; chacune ouvre sa fiche. */
  assemblees?: FicheAssemblee[]
  onOuvrirAssemblee?: (id: string) => void
}

const dateOuTiret = (date: string | null) => (date ? dateIsoVersFr(date) : '—')
const ouiNon = (valeur: boolean) => (valeur ? 'Oui' : 'Non')

/**
 * Fiche d'une copropriété sur le modèle de la fiche Mandat de Gestéam : mandat et ordonnance, syndicat et
 * immatriculation, lots, équipe, entreprises de l'immeuble, clés, exercices, conseil syndical et assemblées (chaque
 * assemblée ouvre sa fiche), finances et honoraires, notes et avertissement (affiché en tête). Sans fiche détaillée, les
 * blocs propres à la fiche sont vides.
 */
export function FicheCoproprieteDetail({
  copro,
  entreprises,
  onClose,
  onModifier,
  onFiche360,
  assemblees = [],
  onOuvrirAssemblee,
}: FicheCoproprieteDetailProps) {
  const fiche = copro?.fiche ?? nouvelleFicheCopropriete()
  const finCs = finConseilSyndical(fiche.conseilSyndical)
  return (
    <Modal open={!!copro} onClose={onClose} size="lg" labelledBy="fy-t">
      {copro && (
        <>
          <ModalHeader id="fy-t" icon="building" title={copro.nom} onClose={onClose} />
          <ModalBody>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <span className="muted" style={{ fontSize: 12.5, flex: '1 1 260px' }}>
                {fiche.numeroMandat ? `Mandat ${fiche.numeroMandat} · ` : ''}
                {fiche.typeMandat || copro.fondement} · Mandant : {fiche.mandant.toLowerCase()}
              </span>
              <Pill kind={fiche.statutGestion === 'En gestion' ? 'sage' : 'amber'}>{fiche.statutGestion}</Pill>
              <Pill kind={copro.pill}>Échéance {formatDateFr(copro.echeance)}</Pill>
            </div>
            {fiche.avertissement && (
              <Alert kind="warn" icon="alert" title="Avertissement">
                {fiche.avertissement}
              </Alert>
            )}
            <GrilleFiche>
              <Section titre="Mandat et ordonnance" icone="scale">
                <Grille>
                  <Champ k="Fondement" v={copro.fondement} />
                  <Champ k="Tribunal" v={copro.tribunal} />
                  <Champ k="Ordonnance du" v={`${formatDateFr(copro.ordonnance)} · RG ${copro.rg || '—'}`} />
                  <Champ k="Date d'effet" v={dateOuTiret(fiche.dateEffet)} />
                  <Champ k="Durée" v={copro.dureeMois ? `${copro.dureeMois} mois` : ''} />
                  <Champ k="Terme" v={formatDateFr(copro.echeance)} />
                  <Champ k="Notification de l'ordonnance" v={copro.notifOrdonnance} full />
                  <Champ k="Motif" v={copro.motif} full />
                </Grille>
              </Section>
              <Section titre="Syndicat et immatriculation" icone="fact">
                <Grille>
                  <Champ k="Adresse" v={copro.adresse} full />
                  <Champ k="N° d'immatriculation" v={fiche.immatriculation} />
                  <Champ k="SIRET" v={fiche.siret} />
                  <Champ k="ICS (prélèvements)" v={fiche.ics} />
                  <Champ k="Employeur (URSSAF)" v={ouiNon(fiche.employeur)} />
                </Grille>
              </Section>
              <Section titre="Lots" icone="home">
                <Grille>
                  <Champ k="Lots principaux" v={copro.lots} />
                  <Champ k="Habitation" v={fiche.lots.habitation} />
                  <Champ k="Commerce" v={fiche.lots.commerce} />
                  <Champ k="Stationnements" v={fiche.lots.stationnements} />
                  <Champ k="Usage des locaux" v={fiche.lots.usage} full />
                </Grille>
              </Section>
              <Section titre="Équipe du mandat" icone="users">
                <Tableau
                  entetes={['Rôle', 'Collaborateur']}
                  largeurs={[45, 55]}
                  lignes={fiche.equipe.map((membre) => [membre.role, membre.collaborateur])}
                  vide="Aucun collaborateur affecté."
                />
              </Section>
              <Section titre="Entreprises de l'immeuble" icone="wrench" large>
                <Tableau
                  entetes={['Entreprise', 'Domaine', 'Contrat']}
                  largeurs={[40, 35, 25]}
                  lignes={entreprises.map((entreprise) => [entreprise.nom, entreprise.domaine, entreprise.contrat])}
                  vide="Aucune entreprise rattachée à l'immeuble."
                />
              </Section>
              <Section titre="Clés de répartition" icone="key">
                <Tableau
                  entetes={['Code', 'Libellé', 'Tantièmes']}
                  largeurs={[16, 58, 26]}
                  lignes={fiche.cles.map((cle) => [
                    cle.code,
                    cle.principale ? `${cle.libelle} (principale)` : cle.libelle,
                    <span className="mono" key={cle.code}>
                      {cle.tantiemes}
                    </span>,
                  ])}
                  vide="Aucune clé enregistrée."
                />
              </Section>
              <Section titre="Exercices" icone="calendar">
                <Tableau
                  entetes={['Exercice', 'Assemblée', 'Budget', 'Statut']}
                  largeurs={[20, 28, 28, 24]}
                  lignes={fiche.exercices.map((exercice) => [
                    exercice.annee,
                    dateOuTiret(exercice.assemblee),
                    formatEuros(exercice.budgetEuros),
                    exercice.statut,
                  ])}
                  vide="Aucun exercice enregistré."
                />
              </Section>
              <Section titre="Conseil syndical et assemblées" icone="team">
                <Grille>
                  <Champ k="CS élu le" v={dateOuTiret(fiche.conseilSyndical.eluLe)} />
                  <Champ
                    k="Pour / fin"
                    v={finCs ? `${fiche.conseilSyndical.dureeMois} mois · ${dateIsoVersFr(finCs)}` : ''}
                  />
                  <Champ k="AG en visioconférence" v={fiche.agVisio ? 'Acceptée' : 'Non'} />
                  <Champ k="Soumis à l'art. 22" v={ouiNon(fiche.soumisArt22)} />
                </Grille>
              </Section>
              <Section titre="Assemblées" icone="team" large>
                <Tableau
                  entetes={['Date', 'Nature', 'N°', 'Statut']}
                  largeurs={[26, 22, 28, 24]}
                  lignes={assemblees.map((assemblee) => [
                    onOuvrirAssemblee ? (
                      <LienFiche
                        key={assemblee.id}
                        libelle={`AG du ${dateIsoVersFr(assemblee.date)}`}
                        onClick={() => onOuvrirAssemblee(assemblee.id)}
                      />
                    ) : (
                      dateIsoVersFr(assemblee.date)
                    ),
                    assemblee.nature,
                    assemblee.numero,
                    assemblee.statut,
                  ])}
                  vide="Aucune assemblée enregistrée."
                />
              </Section>
              <Section titre="Finances et honoraires" icone="coin">
                <Grille>
                  <Champ k="Budget voté" v={formatEuros(copro.budget)} />
                  <Champ k="Charges engagées" v={formatEuros(copro.depense)} />
                  <Champ
                    k="Impayés"
                    v={<span style={{ color: copro.impayes > 0 ? 'var(--rust-700)' : undefined }}>{formatEuros(copro.impayes)}</span>}
                  />
                  <Champ k="Fonds de travaux" v={formatEuros(copro.fondsTravaux)} />
                  <Champ
                    k="Alerte trésorerie sous"
                    v={fiche.alerteTresorerieEuros === null ? '' : formatEuros(fiche.alerteTresorerieEuros)}
                  />
                  <Champ
                    k="Forfait"
                    v={`${fiche.forfait.visites} visites · AGO ${fiche.forfait.heuresAgo} h · CS ${fiche.forfait.heuresCs} h`}
                  />
                </Grille>
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
            <button className="btn" onClick={() => onFiche360(copro)}>
              Fiche 360
            </button>
            <button className="btn gold" onClick={() => onModifier(copro)}>
              <Icon name="pencil" />
              Modifier la fiche
            </button>
          </ModalFooter>
        </>
      )}
    </Modal>
  )
}
