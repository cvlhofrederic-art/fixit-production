import { defineMessages } from '@/lib/syndic/v54/i18n'

/** Type d'envoi (code interne : la teinte de la pastille en dépend, pas le libellé). */
export type TypeEnvoi = 'urgence' | 'relance' | 'convocation' | 'information'

/** Teinte de la pastille de statut d'un envoi. */
export type TeinteStatut = 'sage' | 'amber' | 'navy'

/** Envoi de démonstration : destinataire, lot, type, objet, canal, date, statut affiché, teinte du statut. */
export interface EnvoiDemo {
  nom: string
  lot: string
  type: TypeEnvoi
  objet: string
  canal: string
  date: string
  statut: string
  teinte: TeinteStatut
}

interface ComunicDigitalTextes {
  titre: string
  chapeau: string
  onglets: { msg: string; mod: string; gp: string; def: string }
  kpi: { total: string; attente: string; distribues: string; lus: string }
  filtres: { typeAria: string; tousLesTypes: string; rechercheAria: string; recherchePlaceholder: string; debut: string; fin: string }
  colonnes: { destinataire: string; lot: string; type: string; objet: string; canal: string; date: string; statut: string }
  types: Record<TypeEnvoi, string>
  demo: EnvoiDemo[]
}

export const COMUNIC_DIGITAL_MESSAGES = defineMessages<ComunicDigitalTextes>({
  'pt-PT': {
    titre: 'Comunicação Digital',
    chapeau: 'Mensagens internas e comunicação com profissionais',
    onglets: { msg: 'Mensagens', mod: 'Modelos', gp: 'Envio em grupo', def: 'Definições' },
    kpi: { total: 'Total enviados', attente: 'Em espera', distribues: 'Distribuídos', lus: 'Lidos' },
    filtres: {
      typeAria: 'Filtrar por tipo',
      tousLesTypes: 'Todos os tipos',
      rechercheAria: 'Pesquisar condómino',
      recherchePlaceholder: 'Pesquisar condómino…',
      debut: 'Data de início',
      fin: 'Data de fim',
    },
    colonnes: { destinataire: 'Condómino', lot: 'Fração', type: 'Tipo', objet: 'Assunto', canal: 'Canal', date: 'Data', statut: 'Status' },
    types: { urgence: 'Urgência', relance: 'Cobrança', convocation: 'Convocatória AG', information: 'Informação' },
    demo: [
      { nom: 'Ana Silva', lot: 'A-102', type: 'urgence', objet: 'Corte de água 14/03 das 9h às 14h', canal: 'Email', date: '16 mai. 2026', statut: 'Lido', teinte: 'sage' },
      { nom: 'João Pereira', lot: 'B-205', type: 'relance', objet: 'Lembrete de quotas em atraso — 950 €', canal: 'Email', date: '15 mai. 2026', statut: 'Entregue', teinte: 'amber' },
      { nom: 'Manuel Costa', lot: 'B-102', type: 'relance', objet: 'Lembrete de quotas em atraso — 1 280 €', canal: 'Carta', date: '14 mai. 2026', statut: 'Enviado', teinte: 'navy' },
      { nom: 'Carlos Rodrigues', lot: 'A-101', type: 'convocation', objet: 'Convocatória AG Ordinária — 15 mar. 2026', canal: 'Email', date: '11 mai. 2026', statut: 'Lido', teinte: 'sage' },
      { nom: 'Sofia Marques', lot: 'A-203', type: 'convocation', objet: 'Convocatória AG Ordinária — 15 mar. 2026', canal: 'Email', date: '11 mai. 2026', statut: 'Entregue', teinte: 'amber' },
      { nom: 'Beatriz Oliveira', lot: 'A-301', type: 'information', objet: 'Obras de reabilitação da fachada', canal: 'Email', date: '06 mai. 2026', statut: 'Lido', teinte: 'sage' },
    ],
  },
  'fr-FR': {
    titre: 'Communication numérique',
    // Notifications électroniques par défaut : art. 42-1 de la loi du 10 juillet 1965 (loi n° 2024-322
    // du 9 avril 2024) et art. 64 et s. du décret du 17 mars 1967 (décret n° 2025-1292) ; envoi postal
    // si le copropriétaire le demande.
    chapeau: "Notifications et envois électroniques aux copropriétaires (art. 42-1 de la loi du 10 juillet 1965) — envoi postal sur demande",
    onglets: { msg: 'Messages', mod: 'Modèles', gp: 'Envoi groupé', def: 'Paramètres' },
    kpi: { total: 'Total des envois', attente: 'En attente', distribues: 'Distribués', lus: 'Lus' },
    filtres: {
      typeAria: 'Filtrer par type',
      tousLesTypes: 'Tous les types',
      rechercheAria: 'Rechercher un copropriétaire',
      recherchePlaceholder: 'Rechercher un copropriétaire…',
      debut: 'Date de début',
      fin: 'Date de fin',
    },
    colonnes: { destinataire: 'Copropriétaire', lot: 'Lot', type: 'Type', objet: 'Objet', canal: 'Canal', date: 'Date', statut: 'Statut' },
    types: { urgence: 'Urgence', relance: 'Relance', convocation: 'Convocation AG', information: 'Information' },
    demo: [
      { nom: 'Anne Simon', lot: 'A-102', type: 'urgence', objet: "Coupure d'eau le 14/03 de 9 h à 14 h", canal: 'E-mail', date: '16 mai 2026', statut: 'Lu', teinte: 'sage' },
      { nom: 'Julien Perrin', lot: 'B-205', type: 'relance', objet: 'Rappel de charges impayées — 950 €', canal: 'E-mail', date: '15 mai 2026', statut: 'Distribué', teinte: 'amber' },
      { nom: 'Michel Costes', lot: 'B-102', type: 'relance', objet: 'Rappel de charges impayées — 1 280 €', canal: 'Courrier', date: '14 mai 2026', statut: 'Envoyé', teinte: 'navy' },
      // Convocation d'AG notifiée par lettre recommandée électronique (art. 64 et s. du décret de 1967).
      { nom: 'Charles Rodier', lot: 'A-101', type: 'convocation', objet: "Convocation à l'AG ordinaire — 15 mars 2026", canal: 'LRE', date: '11 mai 2026', statut: 'Lu', teinte: 'sage' },
      { nom: 'Sophie Marquet', lot: 'A-203', type: 'convocation', objet: "Convocation à l'AG ordinaire — 15 mars 2026", canal: 'LRE', date: '11 mai 2026', statut: 'Distribué', teinte: 'amber' },
      { nom: 'Béatrice Olivier', lot: 'A-301', type: 'information', objet: 'Travaux de ravalement de la façade', canal: 'E-mail', date: '6 mai 2026', statut: 'Lu', teinte: 'sage' },
    ],
  },
})
