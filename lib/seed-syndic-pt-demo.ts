// ─── Seed démo PT pour dashboard syndic ───────────────────────────────────────
// Injecte un set cohérent de fausses données en portugais européen quand un
// utilisateur PT se connecte avec un localStorage vide.
//
// 4 edifícios à Porto, 40 condóminos, 6 profissionais, 15 missões, 3 atas,
// 20 eventos planning, 30 quotas, 12 faturas fournisseurs, 5 alertas,
// 8 mensagens canal, 10 documentos GED.
//
// Cohérence : NIF 9 chiffres, NIPC, IVA 23%, dates récentes alignées,
// liens entre entités (mission ↔ artisan ↔ edifício ↔ condómino).

import type { Mission, Immeuble, Artisan, Alerte, PlanningEvent, Coproprio, CanalInterneMsg, GEDDocument, EcheanceReglementaire } from '@/components/syndic-dashboard/types'

// ─── Edifícios (4) ──────────────────────────────────────────────────────────

export const SEED_PT_EDIFICIOS: Immeuble[] = [
  {
    id: 'pt-edif-atlantico',
    nom: 'Edifício Atlântico',
    adresse: 'Avenida da Boavista, 1247',
    ville: 'Porto',
    codePostal: '4100-130',
    nbLots: 12,
    anneeConstruction: 2008,
    typeImmeuble: 'Residencial',
    gestionnaire: 'Cabinet Vitfix Pro',
    prochainControle: '2026-09-15',
    nbInterventions: 8,
    budgetAnnuel: 48000,
    depensesAnnee: 28450,
    latitude: 41.1571,
    longitude: -8.6488,
    reglementMajoriteAG: '2/3 quotientes',
    reglementFondsTravaux: true,
    reglementFondsRoulementPct: 10,
  },
  {
    id: 'pt-edif-boavista',
    nom: 'Condomínio Boavista Center',
    adresse: 'Avenida da Boavista, 3265',
    ville: 'Porto',
    codePostal: '4100-138',
    nbLots: 8,
    anneeConstruction: 2015,
    typeImmeuble: 'Misto (Hab. + Comércio)',
    gestionnaire: 'Cabinet Vitfix Pro',
    prochainControle: '2026-06-30',
    nbInterventions: 4,
    budgetAnnuel: 36000,
    depensesAnnee: 18700,
    latitude: 41.1610,
    longitude: -8.6603,
    reglementMajoriteAG: 'Simples',
    reglementFondsTravaux: true,
    reglementFondsRoulementPct: 12,
  },
  {
    id: 'pt-edif-cedofeita',
    nom: 'Residencial Cedofeita',
    adresse: 'Rua de Cedofeita, 421',
    ville: 'Porto',
    codePostal: '4050-180',
    nbLots: 10,
    anneeConstruction: 1998,
    typeImmeuble: 'Residencial',
    gestionnaire: 'Cabinet Vitfix Pro',
    prochainControle: '2026-04-22',
    nbInterventions: 11,
    budgetAnnuel: 42000,
    depensesAnnee: 33820,
    latitude: 41.1525,
    longitude: -8.6189,
    reglementMajoriteAG: '2/3 quotientes',
    reglementFondsTravaux: true,
    reglementFondsRoulementPct: 10,
  },
  {
    id: 'pt-edif-foz',
    nom: 'Edifício Foz Douro',
    adresse: 'Rua do Passeio Alegre, 78',
    ville: 'Porto',
    codePostal: '4150-573',
    nbLots: 10,
    anneeConstruction: 2020,
    typeImmeuble: 'Residencial Premium',
    gestionnaire: 'Cabinet Vitfix Pro',
    prochainControle: '2027-01-10',
    nbInterventions: 2,
    budgetAnnuel: 62000,
    depensesAnnee: 21500,
    latitude: 41.1473,
    longitude: -8.6783,
    reglementMajoriteAG: 'Unanimidade para obras > 10k€',
    reglementFondsTravaux: true,
    reglementFondsRoulementPct: 15,
  },
]

// ─── Profissionais (6) ───────────────────────────────────────────────────────

export const SEED_PT_PROFISSIONAIS: Artisan[] = [
  {
    id: 'pt-prof-001',
    nom: 'Silva',
    prenom: 'João',
    nom_famille: 'Silva',
    metier: 'Canalizador',
    telephone: '912 345 678',
    email: 'joao.silva@canaliz-norte.pt',
    siret: '503214687',
    rcProValide: true,
    rcProExpiration: '2026-12-31',
    decennaleValide: true,
    decennaleExpiration: '2027-06-30',
    note: 4.7,
    nbInterventions: 23,
    statut: 'actif',
    vitfixCertifie: true,
  },
  {
    id: 'pt-prof-002',
    nom: 'Ferreira',
    prenom: 'Carlos',
    nom_famille: 'Ferreira',
    metier: 'Eletricista',
    telephone: '935 421 098',
    email: 'carlos.ferreira@eletro-porto.pt',
    siret: '509876213',
    rcProValide: true,
    rcProExpiration: '2026-08-15',
    decennaleValide: true,
    decennaleExpiration: '2026-11-20',
    note: 4.5,
    nbInterventions: 17,
    statut: 'actif',
    vitfixCertifie: true,
  },
  {
    id: 'pt-prof-003',
    nom: 'Santos',
    prenom: 'Miguel',
    nom_famille: 'Santos',
    metier: 'Pedreiro',
    telephone: '928 765 432',
    email: 'miguel.santos@construsantos.pt',
    siret: '507123498',
    rcProValide: true,
    rcProExpiration: '2026-10-01',
    decennaleValide: true,
    decennaleExpiration: '2028-03-15',
    note: 4.3,
    nbInterventions: 12,
    statut: 'actif',
    vitfixCertifie: false,
  },
  {
    id: 'pt-prof-004',
    nom: 'Pereira',
    prenom: 'Ana',
    nom_famille: 'Pereira',
    metier: 'Pintor',
    telephone: '917 654 321',
    email: 'ana.pereira@pinturas-portugal.pt',
    siret: '510456789',
    rcProValide: true,
    rcProExpiration: '2027-02-28',
    decennaleValide: true,
    decennaleExpiration: '2027-09-30',
    note: 4.8,
    nbInterventions: 9,
    statut: 'actif',
    vitfixCertifie: true,
  },
  {
    id: 'pt-prof-005',
    nom: 'Costa',
    prenom: 'Rui',
    nom_famille: 'Costa',
    metier: 'Jardineiro',
    telephone: '961 234 567',
    email: 'rui.costa@espacos-verdes.pt',
    siret: '511987456',
    rcProValide: true,
    rcProExpiration: '2026-07-31',
    decennaleValide: false,
    decennaleExpiration: '2026-01-15',
    note: 4.2,
    nbInterventions: 6,
    statut: 'actif',
    vitfixCertifie: false,
  },
  {
    id: 'pt-prof-006',
    nom: 'Martins',
    prenom: 'Pedro',
    nom_famille: 'Martins',
    metier: 'Serralheiro',
    telephone: '942 876 543',
    email: 'pedro.martins@serralharia-douro.pt',
    siret: '512345876',
    rcProValide: true,
    rcProExpiration: '2026-11-30',
    decennaleValide: true,
    decennaleExpiration: '2027-04-22',
    note: 4.6,
    nbInterventions: 8,
    statut: 'actif',
    vitfixCertifie: true,
  },
]

// ─── Condóminos (40) — répartis sur les 4 edifícios ─────────────────────────

const PT_FIRST_NAMES = ['Ana', 'João', 'Maria', 'Pedro', 'Sofia', 'Carlos', 'Isabel', 'Miguel', 'Teresa', 'Rui', 'Catarina', 'André', 'Beatriz', 'Nuno', 'Luísa', 'Tiago', 'Margarida', 'Bruno', 'Inês', 'Ricardo', 'Filipa', 'Hugo', 'Mariana', 'Diogo', 'Patrícia', 'Vasco', 'Joana', 'Francisco', 'Helena', 'Tomás', 'Cristina', 'Gonçalo', 'Raquel', 'Vítor', 'Susana', 'Daniel', 'Madalena', 'Fernando', 'Constança', 'Henrique']
const PT_LAST_NAMES = ['Silva', 'Santos', 'Ferreira', 'Pereira', 'Oliveira', 'Costa', 'Rodrigues', 'Martins', 'Sousa', 'Fernandes', 'Gonçalves', 'Gomes', 'Lopes', 'Marques', 'Almeida', 'Alves', 'Ribeiro', 'Pinto', 'Carvalho', 'Teixeira', 'Moreira', 'Correia', 'Mendes', 'Nunes', 'Soares', 'Vieira', 'Monteiro', 'Cardoso', 'Rocha', 'Neves', 'Coelho', 'Cruz', 'Cunha', 'Reis', 'Pires', 'Ramos', 'Castro', 'Tavares', 'Cabral', 'Pacheco']
const FLOORS = ['R/C', '1.º', '2.º', '3.º']
const SIDES = ['Esq.', 'Dto.', 'Frt.']

function genNif(seed: number): string {
  // NIF démo réaliste (9 chiffres, commence par 1, 2 ou 5 pour personne singular)
  const base = (123456789 + seed * 17).toString().padStart(9, '0').slice(0, 9)
  return base[0] === '0' ? '2' + base.slice(1) : base
}

function genCondomino(idx: number, edificio: Immeuble, fracIdx: number): Coproprio {
  const firstName = PT_FIRST_NAMES[idx % PT_FIRST_NAMES.length]
  const lastName = PT_LAST_NAMES[(idx * 7) % PT_LAST_NAMES.length]
  const floor = FLOORS[fracIdx % FLOORS.length]
  const side = SIDES[Math.floor(fracIdx / FLOORS.length) % SIDES.length]
  const numeroPorte = `Fração ${String.fromCharCode(65 + fracIdx)} — ${floor} ${side}`
  const estOccupe = idx % 3 === 0
  return {
    id: `pt-cond-${idx.toString().padStart(3, '0')}`,
    immeuble: edificio.nom,
    batiment: 'A',
    etage: floor === 'R/C' ? 0 : parseInt(floor, 10),
    numeroPorte,
    nomProprietaire: lastName,
    prenomProprietaire: firstName,
    emailProprietaire: `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(/[áéíóú]/g, c => 'aeiou'['áéíóú'.indexOf(c)])}@mail.pt`,
    telephoneProprietaire: `91${(2 + idx % 8)} ${(100 + idx * 7) % 900 + 100} ${(200 + idx * 11) % 900 + 100}`,
    ...(estOccupe ? {} : {
      nomLocataire: PT_LAST_NAMES[(idx * 13) % PT_LAST_NAMES.length],
      prenomLocataire: PT_FIRST_NAMES[(idx * 5 + 3) % PT_FIRST_NAMES.length],
      emailLocataire: `inquilino${idx}@mail.pt`,
      telephoneLocataire: `92${(1 + idx % 9)} ${(300 + idx * 9) % 900 + 100} ${(400 + idx * 13) % 900 + 100}`,
    }),
    estOccupe,
    notes: idx % 7 === 0 ? `NIF: ${genNif(idx)}` : undefined,
  }
}

export const SEED_PT_CONDOMINOS: Coproprio[] = (() => {
  const result: Coproprio[] = []
  let idx = 0
  SEED_PT_EDIFICIOS.forEach(edif => {
    for (let f = 0; f < edif.nbLots; f++) {
      result.push(genCondomino(idx, edif, f))
      idx++
    }
  })
  return result
})()

// ─── Missões (15) ────────────────────────────────────────────────────────────

const HOJE = new Date()
function daysAgo(d: number): string {
  const date = new Date(HOJE)
  date.setDate(date.getDate() - d)
  return date.toISOString()
}
function daysAgoDate(d: number): string {
  return daysAgo(d).slice(0, 10)
}
function daysAhead(d: number): string {
  return daysAgo(-d).slice(0, 10)
}

export const SEED_PT_MISSOES: Mission[] = [
  {
    id: 'pt-mis-001',
    immeuble: 'Edifício Atlântico',
    artisan: 'Silva João',
    type: 'Canalização',
    description: 'Fuga de água na coluna principal — 2.º Esq. Necessita inspeção urgente.',
    priorite: 'urgente',
    statut: 'en_cours',
    dateCreation: daysAgo(3),
    dateIntervention: daysAhead(1),
    montantDevis: 480,
    batiment: 'A',
    etage: '2.º',
    numLot: 'B',
    locataire: 'Maria Costa',
    telephoneLocataire: '917 234 567',
    accesLogement: 'Chave com o porteiro',
    demandeurNom: 'Maria Costa',
    demandeurRole: 'locataire',
  },
  {
    id: 'pt-mis-002',
    immeuble: 'Edifício Atlântico',
    artisan: 'Ferreira Carlos',
    type: 'Eletricidade',
    description: 'Substituição quadro elétrico zonas comuns piso 0.',
    priorite: 'normale',
    statut: 'acceptee',
    dateCreation: daysAgo(8),
    dateIntervention: daysAhead(5),
    montantDevis: 1250,
    batiment: 'A',
    etage: 'R/C',
  },
  {
    id: 'pt-mis-003',
    immeuble: 'Condomínio Boavista Center',
    artisan: 'Pereira Ana',
    type: 'Pintura',
    description: 'Pintura completa hall de entrada e corredores (rés-do-chão).',
    priorite: 'planifiee',
    statut: 'terminee',
    dateCreation: daysAgo(45),
    dateIntervention: daysAgo(30),
    montantDevis: 3200,
    montantFacture: 3200,
    travailEffectue: 'Pintura efetuada conforme orçamento. Aplicadas 2 demãos.',
    materiauxUtilises: '40L tinta CIN profissional, primário, pincéis e rolos',
    dureeIntervention: '24 horas',
    dateRapport: daysAgo(29),
  },
  {
    id: 'pt-mis-004',
    immeuble: 'Residencial Cedofeita',
    artisan: 'Santos Miguel',
    type: 'Construção',
    description: 'Reparação fissura na fachada lateral, lado norte.',
    priorite: 'normale',
    statut: 'en_cours',
    dateCreation: daysAgo(12),
    dateIntervention: daysAgo(2),
    montantDevis: 2800,
    batiment: 'A',
  },
  {
    id: 'pt-mis-005',
    immeuble: 'Residencial Cedofeita',
    artisan: 'Silva João',
    type: 'Canalização',
    description: 'Substituição autoclismo — fração 3.º Esq.',
    priorite: 'normale',
    statut: 'terminee',
    dateCreation: daysAgo(20),
    dateIntervention: daysAgo(15),
    montantDevis: 180,
    montantFacture: 180,
    travailEffectue: 'Autoclismo substituído. Testes ok.',
    dureeIntervention: '1h30',
    dateRapport: daysAgo(15),
    etage: '3.º',
    numLot: 'D',
    locataire: 'André Marques',
  },
  {
    id: 'pt-mis-006',
    immeuble: 'Edifício Foz Douro',
    artisan: 'Costa Rui',
    type: 'Espaços verdes',
    description: 'Manutenção jardim trimestral + poda árvores.',
    priorite: 'planifiee',
    statut: 'terminee',
    dateCreation: daysAgo(60),
    dateIntervention: daysAgo(55),
    montantDevis: 420,
    montantFacture: 420,
    travailEffectue: 'Manutenção completa, poda 4 árvores.',
    dureeIntervention: '6 horas',
    dateRapport: daysAgo(54),
  },
  {
    id: 'pt-mis-007',
    immeuble: 'Condomínio Boavista Center',
    artisan: 'Martins Pedro',
    type: 'Serralharia',
    description: 'Reparação portão automático garagem — motor com falhas.',
    priorite: 'urgente',
    statut: 'terminee',
    dateCreation: daysAgo(25),
    dateIntervention: daysAgo(23),
    montantDevis: 750,
    montantFacture: 820,
    travailEffectue: 'Motor substituído + revisão completa do mecanismo.',
    materiauxUtilises: '1 motor Came BX-243, 1 condensador, parafusos',
    dureeIntervention: '4 horas',
    dateRapport: daysAgo(22),
  },
  {
    id: 'pt-mis-008',
    immeuble: 'Edifício Atlântico',
    artisan: 'Pereira Ana',
    type: 'Pintura',
    description: 'Repintura corredores piso 1.',
    priorite: 'planifiee',
    statut: 'en_attente',
    dateCreation: daysAgo(2),
    montantDevis: 1800,
    batiment: 'A',
    etage: '1.º',
  },
  {
    id: 'pt-mis-009',
    immeuble: 'Edifício Foz Douro',
    artisan: 'Ferreira Carlos',
    type: 'Eletricidade',
    description: 'Inspeção elevador — relatório periódico obrigatório.',
    priorite: 'normale',
    statut: 'terminee',
    dateCreation: daysAgo(90),
    dateIntervention: daysAgo(85),
    montantDevis: 350,
    montantFacture: 350,
    travailEffectue: 'Inspeção ok. Próxima inspeção em 6 anos.',
    dureeIntervention: '2 horas',
    dateRapport: daysAgo(84),
  },
  {
    id: 'pt-mis-010',
    immeuble: 'Residencial Cedofeita',
    artisan: 'Costa Rui',
    type: 'Espaços verdes',
    description: 'Plantação primavera + manutenção sistema rega.',
    priorite: 'planifiee',
    statut: 'en_attente',
    dateCreation: daysAgo(1),
    dateIntervention: daysAhead(10),
    montantDevis: 280,
  },
  {
    id: 'pt-mis-011',
    immeuble: 'Edifício Atlântico',
    artisan: 'Santos Miguel',
    type: 'Construção',
    description: 'Reparação muro lateral exterior — caída de azulejos.',
    priorite: 'normale',
    statut: 'annulee',
    dateCreation: daysAgo(40),
    montantDevis: 950,
  },
  {
    id: 'pt-mis-012',
    immeuble: 'Condomínio Boavista Center',
    artisan: 'Silva João',
    type: 'Canalização',
    description: 'Desentupimento canalização cave + limpeza.',
    priorite: 'urgente',
    statut: 'terminee',
    dateCreation: daysAgo(15),
    dateIntervention: daysAgo(14),
    montantDevis: 220,
    montantFacture: 280,
    travailEffectue: 'Desentupimento concluído. Limpeza preventiva efetuada.',
    dureeIntervention: '2h',
    dateRapport: daysAgo(13),
  },
  {
    id: 'pt-mis-013',
    immeuble: 'Edifício Foz Douro',
    artisan: 'Martins Pedro',
    type: 'Serralharia',
    description: 'Instalação 2 cancelas novas zona piscina.',
    priorite: 'planifiee',
    statut: 'acceptee',
    dateCreation: daysAgo(5),
    dateIntervention: daysAhead(15),
    montantDevis: 1450,
  },
  {
    id: 'pt-mis-014',
    immeuble: 'Residencial Cedofeita',
    artisan: 'Ferreira Carlos',
    type: 'Eletricidade',
    description: 'Substituição lâmpadas LED escadas comuns (todos os pisos).',
    priorite: 'normale',
    statut: 'terminee',
    dateCreation: daysAgo(70),
    dateIntervention: daysAgo(68),
    montantDevis: 320,
    montantFacture: 320,
    travailEffectue: 'Todas as lâmpadas substituídas por LED 12W.',
    materiauxUtilises: '24 lâmpadas LED Philips 12W',
    dureeIntervention: '3 horas',
    dateRapport: daysAgo(67),
  },
  {
    id: 'pt-mis-015',
    immeuble: 'Edifício Atlântico',
    artisan: 'Costa Rui',
    type: 'Espaços verdes',
    description: 'Corte relva jardim comum + manutenção.',
    priorite: 'normale',
    statut: 'en_attente',
    dateCreation: daysAgo(1),
    montantDevis: 150,
  },
]

// ─── Alertas (5) ─────────────────────────────────────────────────────────────

export const SEED_PT_ALERTAS: Alerte[] = [
  {
    id: 'pt-alert-001',
    type: 'controle',
    message: 'Inspeção 6 anos do elevador — Edifício Foz Douro (vence 30/04/2026)',
    urgence: 'haute',
    date: daysAgoDate(0),
  },
  {
    id: 'pt-alert-002',
    type: 'rc_pro',
    message: 'Seguro RC do profissional Costa Rui expira em 31/07/2026',
    urgence: 'moyenne',
    date: daysAgoDate(0),
  },
  {
    id: 'pt-alert-003',
    type: 'budget',
    message: 'Edifício Atlântico — 59% do orçamento anual já consumido',
    urgence: 'moyenne',
    date: daysAgoDate(2),
  },
  {
    id: 'pt-alert-004',
    type: 'document',
    message: 'Declaração de Encargos 2025 — prazo até 31/01/2026',
    urgence: 'haute',
    date: daysAgoDate(5),
  },
  {
    id: 'pt-alert-005',
    type: 'mission',
    message: 'Missão urgente em curso — Fuga de água Edifício Atlântico (3 dias)',
    urgence: 'haute',
    date: daysAgoDate(1),
  },
]

// ─── Eventos planning (20) ──────────────────────────────────────────────────

export const SEED_PT_EVENTOS: PlanningEvent[] = [
  { id: 'pt-evt-001', titre: 'Assembleia Geral Anual — Edifício Atlântico', date: daysAgoDate(0), heure: '19:00', dureeMin: 120, type: 'reunion', assigneA: 'Administração', assigneRole: 'syndic_admin', description: 'Aprovação contas 2025 + orçamento 2026', creePar: 'Administração', statut: 'planifie' },
  { id: 'pt-evt-002', titre: 'Visita técnica — Residencial Cedofeita', date: daysAhead(2), heure: '10:00', dureeMin: 60, type: 'visite', assigneA: 'Gestor Técnico', assigneRole: 'syndic_tech', description: 'Inspeção fissura fachada', creePar: 'Administração', statut: 'planifie' },
  { id: 'pt-evt-003', titre: 'Reunião comissão revisora — Boavista Center', date: daysAhead(5), heure: '18:30', dureeMin: 90, type: 'reunion', assigneA: 'Administração', assigneRole: 'syndic_admin', creePar: 'Administração', statut: 'planifie' },
  { id: 'pt-evt-004', titre: 'Inspeção elevador — Foz Douro', date: daysAhead(7), heure: '14:00', dureeMin: 90, type: 'visite', assigneA: 'Ferreira Carlos', assigneRole: 'artisan', creePar: 'Gestor Técnico', statut: 'planifie' },
  { id: 'pt-evt-005', titre: 'Reunião condóminos atrasados', date: daysAhead(10), heure: '20:00', dureeMin: 60, type: 'reunion', assigneA: 'Contabilista', assigneRole: 'syndic_comptable', creePar: 'Administração', statut: 'planifie' },
  { id: 'pt-evt-006', titre: 'Limpeza trimestral Atlântico', date: daysAhead(14), heure: '09:00', dureeMin: 240, type: 'tache', assigneA: 'Equipa limpeza', assigneRole: 'externe', creePar: 'Administração', statut: 'planifie' },
  { id: 'pt-evt-007', titre: 'Vistoria técnica gás — Cedofeita', date: daysAhead(21), heure: '11:00', dureeMin: 120, type: 'visite', assigneA: 'Inspetor gás', assigneRole: 'externe', description: 'Inspeção 5 anos obrigatória', creePar: 'Gestor Técnico', statut: 'planifie' },
  { id: 'pt-evt-008', titre: 'Renovação seguro condomínio', date: daysAhead(28), heure: '15:00', dureeMin: 60, type: 'rdv', assigneA: 'Administração', assigneRole: 'syndic_admin', creePar: 'Administração', statut: 'planifie' },
  { id: 'pt-evt-009', titre: 'Assembleia extraordinária Boavista', date: daysAhead(35), heure: '19:00', dureeMin: 90, type: 'reunion', assigneA: 'Administração', assigneRole: 'syndic_admin', description: 'Voto obras impermeabilização cobertura', creePar: 'Administração', statut: 'planifie' },
  { id: 'pt-evt-010', titre: 'Revisão pinturas — Atlântico', date: daysAhead(42), heure: '10:00', dureeMin: 180, type: 'tache', assigneA: 'Pereira Ana', assigneRole: 'artisan', creePar: 'Gestor Técnico', statut: 'planifie' },
  { id: 'pt-evt-011', titre: 'AG Anual concluída — Cedofeita', date: daysAgoDate(60), heure: '19:00', dureeMin: 150, type: 'reunion', assigneA: 'Administração', assigneRole: 'syndic_admin', creePar: 'Administração', statut: 'termine' },
  { id: 'pt-evt-012', titre: 'Inspeção fachada Atlântico (concluída)', date: daysAgoDate(45), heure: '14:00', dureeMin: 60, type: 'visite', assigneA: 'Santos Miguel', assigneRole: 'artisan', creePar: 'Gestor Técnico', statut: 'termine' },
  { id: 'pt-evt-013', titre: 'Reunião contas trimestre Q4', date: daysAgoDate(30), heure: '17:00', dureeMin: 120, type: 'reunion', assigneA: 'Contabilista', assigneRole: 'syndic_comptable', creePar: 'Administração', statut: 'termine' },
  { id: 'pt-evt-014', titre: 'Análise orçamentos obras Boavista', date: daysAgoDate(20), heure: '16:00', dureeMin: 90, type: 'rdv', assigneA: 'Administração', assigneRole: 'syndic_admin', creePar: 'Administração', statut: 'termine' },
  { id: 'pt-evt-015', titre: 'Visita Foz Douro — checklist', date: daysAhead(3), heure: '11:30', dureeMin: 90, type: 'visite', assigneA: 'Gestor Técnico', assigneRole: 'syndic_tech', creePar: 'Administração', statut: 'planifie' },
  { id: 'pt-evt-016', titre: 'Recolha de quotas Q1 2026', date: daysAhead(15), heure: '09:00', dureeMin: 60, type: 'tache', assigneA: 'Contabilista', assigneRole: 'syndic_comptable', creePar: 'Administração', statut: 'planifie' },
  { id: 'pt-evt-017', titre: 'Reunião marketing/comunicação digital', date: daysAhead(45), heure: '14:00', dureeMin: 60, type: 'reunion', assigneA: 'Administração', assigneRole: 'syndic_admin', creePar: 'Administração', statut: 'planifie' },
  { id: 'pt-evt-018', titre: 'Auditoria SCE certificação energética', date: daysAhead(60), heure: '10:00', dureeMin: 240, type: 'visite', assigneA: 'Auditor externo', assigneRole: 'externe', creePar: 'Administração', statut: 'planifie' },
  { id: 'pt-evt-019', titre: 'Visita Cedofeita — instalação rega', date: daysAhead(10), heure: '15:00', dureeMin: 120, type: 'visite', assigneA: 'Costa Rui', assigneRole: 'artisan', creePar: 'Gestor Técnico', statut: 'planifie' },
  { id: 'pt-evt-020', titre: 'Reunião comissão obras', date: daysAhead(20), heure: '18:00', dureeMin: 90, type: 'reunion', assigneA: 'Administração', assigneRole: 'syndic_admin', creePar: 'Administração', statut: 'planifie' },
]

// ─── Mensagens canal interne (8) ─────────────────────────────────────────────

export const SEED_PT_CANAL: CanalInterneMsg[] = [
  { id: 'pt-canal-001', de: 'Administração', deRole: 'syndic_admin', type: 'message', contenu: 'Lembrete: AG Anual do Edifício Atlântico esta noite às 19h.', date: daysAgo(0), lu: false },
  { id: 'pt-canal-002', de: 'Gestor Técnico', deRole: 'syndic_tech', type: 'tache', contenu: 'Verificar relatório de inspeção fissura Cedofeita até sexta-feira.', date: daysAgo(1), lu: false, tacheAssignee: 'Administração', tachePriorite: 'normale', tacheStatut: 'en_cours' },
  { id: 'pt-canal-003', de: 'Contabilista', deRole: 'syndic_comptable', type: 'message', contenu: '5 condóminos com quotas em atraso há mais de 60 dias. Iniciar procedimento de cobrança?', date: daysAgo(2), lu: true },
  { id: 'pt-canal-004', de: 'Administração', deRole: 'syndic_admin', type: 'planning', contenu: 'Adicionado evento: Renovação seguro condomínio.', date: daysAgo(3), lu: true, planningDate: daysAhead(28), planningHeure: '15:00', planningResident: '—', planningResidence: 'Todos' },
  { id: 'pt-canal-005', de: 'Gestor Técnico', deRole: 'syndic_tech', type: 'message', contenu: 'Solicitar 3 orçamentos para impermeabilização cobertura Boavista (Lei 8/2022).', date: daysAgo(4), lu: true },
  { id: 'pt-canal-006', de: 'Secretária', deRole: 'syndic_secretaire', type: 'tache', contenu: 'Preparar convocatória para AG extraordinária Boavista.', date: daysAgo(5), lu: true, tacheAssignee: 'Secretária', tachePriorite: 'urgente', tacheStatut: 'en_cours' },
  { id: 'pt-canal-007', de: 'Jurista', deRole: 'syndic_juriste', type: 'message', contenu: 'Análise jurídica do regulamento Foz Douro concluída. Conforme com Lei 8/2022.', date: daysAgo(7), lu: true },
  { id: 'pt-canal-008', de: 'Administração', deRole: 'syndic_admin', type: 'message', contenu: 'Reunião com comissão revisora marcada para 5 dias. Documentos enviados por email.', date: daysAgo(10), lu: true },
]

// ─── Documentos GED (10) ─────────────────────────────────────────────────────

export const SEED_PT_DOCUMENTOS: GEDDocument[] = [
  { id: 'pt-doc-001', nom: 'Ata AG Anual 2026 - Edifício Atlântico.pdf', type: 'ag', immeuble: 'Edifício Atlântico', artisan: '', locataire: '', dateDocument: daysAgoDate(0), dateAjout: daysAgoDate(0), taille: '485 KB', tags: ['AG', '2026', 'aprovação contas'] },
  { id: 'pt-doc-002', nom: 'Ata AG Anual 2025 - Residencial Cedofeita.pdf', type: 'ag', immeuble: 'Residencial Cedofeita', artisan: '', locataire: '', dateDocument: daysAgoDate(60), dateAjout: daysAgoDate(60), taille: '512 KB', tags: ['AG', '2025'] },
  { id: 'pt-doc-003', nom: 'Fatura EDP Comercial Janeiro.pdf', type: 'facture', immeuble: 'Edifício Atlântico', artisan: 'EDP Comercial', locataire: '', dateDocument: daysAgoDate(15), dateAjout: daysAgoDate(15), taille: '85 KB', tags: ['energia', 'EDP'] },
  { id: 'pt-doc-004', nom: 'Contrato Seguro Fidelidade 2026.pdf', type: 'contrat', immeuble: 'Condomínio Boavista Center', artisan: 'Fidelidade', locataire: '', dateDocument: daysAgoDate(90), dateAjout: daysAgoDate(90), taille: '1.2 MB', tags: ['seguro', 'Fidelidade'] },
  { id: 'pt-doc-005', nom: 'Orçamento Impermeabilização Cobertura.pdf', type: 'devis', immeuble: 'Condomínio Boavista Center', artisan: 'TelhaViva Lda.', locataire: '', dateDocument: daysAgoDate(20), dateAjout: daysAgoDate(20), taille: '230 KB', tags: ['orçamento', 'cobertura'] },
  { id: 'pt-doc-006', nom: 'Relatório intervenção fuga água.pdf', type: 'rapport', immeuble: 'Edifício Atlântico', artisan: 'Silva João', locataire: 'Maria Costa', dateDocument: daysAgoDate(1), dateAjout: daysAgoDate(0), taille: '95 KB', tags: ['canalização', 'urgente'] },
  { id: 'pt-doc-007', nom: 'Certificado Energético Foz Douro.pdf', type: 'diagnostic', immeuble: 'Edifício Foz Douro', artisan: '', locataire: '', dateDocument: daysAgoDate(180), dateAjout: daysAgoDate(180), taille: '320 KB', tags: ['SCE', 'A+'] },
  { id: 'pt-doc-008', nom: 'Inspeção Elevador 2026 - Atlântico.pdf', type: 'controle', immeuble: 'Edifício Atlântico', artisan: 'OTIS Portugal', locataire: '', dateDocument: daysAgoDate(85), dateAjout: daysAgoDate(85), taille: '180 KB', tags: ['elevador', 'inspeção'] },
  { id: 'pt-doc-009', nom: 'Apólice RC Profissional Pereira Ana.pdf', type: 'assurance', immeuble: '', artisan: 'Pereira Ana', locataire: '', dateDocument: daysAgoDate(200), dateAjout: daysAgoDate(200), taille: '210 KB', tags: ['RC', 'pintor'] },
  { id: 'pt-doc-010', nom: 'Plano de Manutenção 2026.pdf', type: 'plan', immeuble: 'Edifício Foz Douro', artisan: '', locataire: '', dateDocument: daysAgoDate(120), dateAjout: daysAgoDate(120), taille: '760 KB', tags: ['plano', 'manutenção', '8 anos'] },
]

// ─── Prazos legais / Échéances (8) ───────────────────────────────────────────

export const SEED_PT_ECHEANCES: EcheanceReglementaire[] = [
  { id: 'pt-ech-001', immeuble: 'Edifício Atlântico', type: 'ascenseur', label: 'Inspeção 6 anos elevador', dateEcheance: '2026-09-15', periodicite: 2190, notes: 'Inspeção obrigatória DL 320/2002' },
  { id: 'pt-ech-002', immeuble: 'Edifício Atlântico', type: 'ag', label: 'AG Anual obrigatória', dateEcheance: '2027-03-31', periodicite: 365, notes: 'Art.º 1432.º CC — antes 31 março' },
  { id: 'pt-ech-003', immeuble: 'Condomínio Boavista Center', type: 'gaz', label: 'Inspeção 5 anos gás', dateEcheance: '2026-07-20', periodicite: 1825, notes: 'DL 97/2017' },
  { id: 'pt-ech-004', immeuble: 'Residencial Cedofeita', type: 'assurance', label: 'Renovação seguro condomínio', dateEcheance: '2026-06-30', periodicite: 365, notes: 'Art.º 1429.º CC' },
  { id: 'pt-ech-005', immeuble: 'Edifício Foz Douro', type: 'ag', label: 'AG Anual', dateEcheance: '2026-04-15', periodicite: 365 },
  { id: 'pt-ech-006', immeuble: 'Edifício Foz Douro', type: 'ascenseur', label: 'Inspeção 2 anos elevador', dateEcheance: '2026-04-30', periodicite: 730 },
  { id: 'pt-ech-007', immeuble: 'Residencial Cedofeita', type: 'electricite', label: 'Verificação instalação elétrica', dateEcheance: '2026-08-10', periodicite: 1825 },
  { id: 'pt-ech-008', immeuble: 'Condomínio Boavista Center', type: 'ravalement', label: 'Manutenção fachada (8 anos)', dateEcheance: '2027-05-30', periodicite: 2920, notes: 'DL 555/99 art. 89.º' },
]

// ─── API publique : seedSyndicPtDemoIfEmpty ──────────────────────────────────

const SEED_VERSION = 'pt-v1'

interface SeedResult {
  seeded: boolean
  reason?: string
  data?: typeof SYNDIC_PT_DEMO_DATA
}

export const SYNDIC_PT_DEMO_DATA = {
  imoveis: SEED_PT_EDIFICIOS,
  condominos: SEED_PT_CONDOMINOS,
  profissionais: SEED_PT_PROFISSIONAIS,
  missoes: SEED_PT_MISSOES,
  alertas: SEED_PT_ALERTAS,
  eventos: SEED_PT_EVENTOS,
  canal: SEED_PT_CANAL,
  documentos: SEED_PT_DOCUMENTOS,
  echeances: SEED_PT_ECHEANCES,
}

/**
 * Injecte le set démo PT dans localStorage si :
 * - locale est 'pt'
 * - le flag fixit_seed_pt_v1_${uid} n'existe pas (seed jamais fait)
 * - les états existants sont vides ou minimaux
 *
 * Idempotent : appeler plusieurs fois ne réinjecte pas.
 * Retourne le résultat pour permettre au caller de re-hydrater les states.
 */
export function seedSyndicPtDemoIfEmpty(userId: string, locale: string): SeedResult {
  if (typeof window === 'undefined') return { seeded: false, reason: 'ssr' }
  if (locale !== 'pt') return { seeded: false, reason: 'not-pt' }
  if (!userId) return { seeded: false, reason: 'no-user' }

  const flagKey = `fixit_seed_${SEED_VERSION}_${userId}`
  if (localStorage.getItem(flagKey)) return { seeded: false, reason: 'already-seeded' }

  // Vérification minimale : si l'utilisateur a déjà des données réelles, skip
  const existingImmeubles = localStorage.getItem(`fixit_syndic_immeubles_${userId}`)
  if (existingImmeubles) {
    try {
      const parsed = JSON.parse(existingImmeubles)
      if (Array.isArray(parsed) && parsed.length > 0) {
        localStorage.setItem(flagKey, '1')
        return { seeded: false, reason: 'user-has-data' }
      }
    } catch {}
  }

  try {
    localStorage.setItem(`fixit_syndic_immeubles_${userId}`, JSON.stringify(SEED_PT_EDIFICIOS))
    localStorage.setItem(`fixit_syndic_missions_${userId}`, JSON.stringify(SEED_PT_MISSOES))
    localStorage.setItem(`fixit_copros_${userId}`, JSON.stringify(SEED_PT_CONDOMINOS))
    localStorage.setItem(`fixit_planning_events_${userId}`, JSON.stringify(SEED_PT_EVENTOS))
    localStorage.setItem(`fixit_canal_interne_${userId}`, JSON.stringify(SEED_PT_CANAL))
    localStorage.setItem(`fixit_ged_${userId}`, JSON.stringify(SEED_PT_DOCUMENTOS))
    localStorage.setItem(`fixit_cal_regl_${userId}`, JSON.stringify(SEED_PT_ECHEANCES))
    localStorage.setItem(`fixit_artisans_pt_${userId}`, JSON.stringify(SEED_PT_PROFISSIONAIS))
    localStorage.setItem(`fixit_alertes_${userId}`, JSON.stringify(SEED_PT_ALERTAS))

    // Liste des bâtiments connus (utilisé par le formulaire mission)
    const batiments = SEED_PT_EDIFICIOS.map(e => e.nom)
    localStorage.setItem(`fixit_syndic_batiments_${userId}`, JSON.stringify(batiments))

    localStorage.setItem(flagKey, '1')
    return { seeded: true, data: SYNDIC_PT_DEMO_DATA }
  } catch (e) {
    console.warn('[seed-syndic-pt] failed:', e)
    return { seeded: false, reason: 'localStorage-error' }
  }
}

/**
 * Force le re-seed (utilisé par un bouton "Réinitialiser démo")
 */
export function forceSeedSyndicPt(userId: string): SeedResult {
  if (typeof window === 'undefined') return { seeded: false, reason: 'ssr' }
  const flagKey = `fixit_seed_${SEED_VERSION}_${userId}`
  localStorage.removeItem(flagKey)
  return seedSyndicPtDemoIfEmpty(userId, 'pt')
}
