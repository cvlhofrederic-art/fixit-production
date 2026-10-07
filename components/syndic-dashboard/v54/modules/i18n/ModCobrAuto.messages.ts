import { defineMessages } from '@/lib/syndic/v54/i18n'

/** Natures d'un impayé (codes de la table syndic_impayes, inchangés dans les deux langues). */
export type NatureImpaye = 'charges_courantes' | 'travaux' | 'fonds_reserve' | 'interets_retard' | 'frais_relance' | 'autre'

/** Statuts d'un impayé (codes de l'API). */
type StatutImpaye = 'ouvert' | 'en_recouvrement' | 'solde' | 'passe_perte'

/**
 * Textes de l'écran « Cobrança Automática · Juros & Sanções » / « Relances automatiques ».
 * Droit français : relances amiables puis mise en demeure ; après 30 jours sans effet, les
 * provisions non échues deviennent exigibles (loi du 10 juillet 1965, art. 19-2) ; intérêts au
 * taux légal à compter de la mise en demeure (décret du 17 mars 1967, art. 36) ; frais de
 * recouvrement imputables au seul copropriétaire défaillant (loi de 1965, art. 10-1 a).
 * Aucune « sanction » n'est reprise en français.
 */
interface CobrAutoTextes {
  titre: string
  chapeau: string
  nouveau: string
  kpi: { enCours: string; actifs: string; recouvres: string }
  onglets: { proc: string; js: string }
  vide: { titre: string; desc: string }
  colonnes: { coproprietaire: string; immeuble: string; nature: string; montant: string; depuis: string; relances: string; statut: string }
  /** Libellés des natures (codes de l'API) ; repli sur la valeur brute si inconnue. */
  natures: Record<NatureImpaye, string>
  /** Libellés des statuts (codes de l'API) ; repli sur la valeur brute si inconnue. */
  statuts: Record<StatutImpaye, string>
  relancer: string
  formulaire: {
    titre: string
    immeuble: string
    choisir: string
    coproprietaire: string
    montant: string
    nature: string
    depuis: string
    notes: string
    annuler: string
    ouvrir: string
  }
  erreurs: { montant: string; date: string }
  toasts: {
    ouvert: string
    erreurOuverture: string
    reessayerPlusTard: string
    ouvertDemo: string
    connexionRequise: string
    relanceDemo: string
    connexionSyndic: string
    relanceEnvoyee: string
    relanceNumero: (n: number) => string
    erreurRelance: string
  }
}

export const COBR_AUTO_MESSAGES = defineMessages<CobrAutoTextes>({
  'pt-PT': {
    titre: 'Cobrança Automática · Juros & Sanções',
    chapeau: 'Pipeline de escalada · Cobrança IA · Juros legais Banco de Portugal · Sanções regulamentares',
    nouveau: '+ Novo processo',
    kpi: { enCours: 'Em curso de cobrança', actifs: 'Processos ativos', recouvres: 'Recuperados' },
    onglets: { proc: 'Processos cobrança', js: 'Juros & Sanções' },
    vide: { titre: 'Nenhum processo', desc: 'Adicione um processo de dívida para acompanhar a sua escalada automaticamente' },
    colonnes: { coproprietaire: 'Condómino', immeuble: 'Edifício', nature: 'Natureza', montant: 'Montante', depuis: 'Desde', relances: 'Relances', statut: 'Estado' },
    natures: {
      charges_courantes: 'Encargos correntes',
      travaux: 'Obras',
      fonds_reserve: 'Fundo de reserva',
      interets_retard: 'Juros de mora',
      frais_relance: 'Custos de cobrança',
      autre: 'Outro',
    },
    statuts: { ouvert: 'Em aberto', en_recouvrement: 'Em recuperação', solde: 'Liquidado', passe_perte: 'Incobrável' },
    relancer: 'Relançar',
    formulaire: {
      titre: 'Novo processo de cobrança',
      immeuble: 'Edifício',
      choisir: '— escolher —',
      coproprietaire: 'Condómino',
      montant: 'Montante',
      nature: 'Natureza',
      depuis: 'Em dívida desde',
      notes: 'Notas',
      annuler: 'Cancelar',
      ouvrir: 'Abrir processo',
    },
    erreurs: { montant: 'Indique o montante (> 0).', date: 'A data é obrigatória.' },
    toasts: {
      ouvert: 'Processo aberto',
      erreurOuverture: 'Erro ao abrir',
      reessayerPlusTard: 'Tente novamente mais tarde',
      ouvertDemo: 'Processo aberto (demo)',
      connexionRequise: 'Conecte-se como síndico para gravar a sério',
      relanceDemo: 'Relance (demo)',
      connexionSyndic: 'Conecte-se como síndico',
      relanceEnvoyee: 'Relance enviada',
      relanceNumero: (n) => `${n}.ª relance registada`,
      erreurRelance: 'Erro na relance',
    },
  },
  'fr-FR': {
    titre: 'Relances automatiques · Intérêts & frais',
    chapeau: "Relances amiables graduées · Rédaction par l'IA · Mise en demeure (loi de 1965, art. 19-2) · Intérêts au taux légal (décret de 1967, art. 36) · Frais imputables au débiteur (loi de 1965, art. 10-1)",
    nouveau: '+ Nouveau dossier',
    kpi: { enCours: 'En cours de recouvrement', actifs: 'Dossiers actifs', recouvres: 'Recouvrés' },
    onglets: { proc: 'Dossiers de relance', js: 'Intérêts & frais' },
    vide: { titre: 'Aucun dossier', desc: "Ajoutez un dossier d'impayé pour suivre automatiquement ses relances successives" },
    colonnes: { coproprietaire: 'Copropriétaire', immeuble: 'Immeuble', nature: 'Nature', montant: 'Montant', depuis: 'Depuis le', relances: 'Relances', statut: 'Statut' },
    natures: {
      charges_courantes: 'Charges courantes',
      travaux: 'Travaux',
      fonds_reserve: 'Fonds de travaux',
      interets_retard: 'Intérêts de retard',
      frais_relance: 'Frais de recouvrement',
      autre: 'Autre',
    },
    statuts: { ouvert: 'Ouvert', en_recouvrement: 'En recouvrement', solde: 'Soldé', passe_perte: 'Irrécouvrable' },
    relancer: 'Relancer',
    formulaire: {
      titre: 'Nouveau dossier de relance',
      immeuble: 'Immeuble',
      choisir: '— choisir —',
      coproprietaire: 'Copropriétaire',
      montant: 'Montant',
      nature: 'Nature',
      depuis: 'Impayé depuis le',
      notes: 'Notes',
      annuler: 'Annuler',
      ouvrir: 'Ouvrir le dossier',
    },
    erreurs: { montant: 'Indiquez un montant supérieur à 0.', date: 'La date est obligatoire.' },
    toasts: {
      ouvert: 'Dossier ouvert',
      erreurOuverture: "Erreur lors de l'ouverture du dossier",
      reessayerPlusTard: 'Veuillez réessayer plus tard',
      ouvertDemo: 'Dossier ouvert (démonstration)',
      connexionRequise: 'Connectez-vous en tant que syndic pour enregistrer réellement',
      relanceDemo: 'Relance (démonstration)',
      connexionSyndic: 'Connectez-vous en tant que syndic',
      relanceEnvoyee: 'Relance envoyée',
      relanceNumero: (n) => `${n === 1 ? '1re' : `${n}e`} relance enregistrée`,
      erreurRelance: 'Erreur lors de la relance',
    },
  },
})
