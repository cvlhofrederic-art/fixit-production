// tests/lib/chat-parsers-pt.test.ts
//
// Analyseurs du repli sans IA de Fixy (lib/chat-parsers.ts). Le message se lit dans la langue de l'interface :
// en portugais (rapport i18n PT-PT du 17/11/2026), ses propres règles ; en français, les résultats d'avant, sauf deux
// bugs corrigés (« après-demain » lu comme « demain », dates décalées d'un jour par toISOString). Les dates attendues
// sont écrites en clair : le test donne le même résultat quel que soit le fuseau horaire de la machine.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { detectIntent, parseAddress, parseClientName, parseDate, parseServiceMatch, parseTime } from '@/lib/chat-parsers'

// Mardi 17 novembre 2026, 10 h, heure locale.
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 10, 17, 10, 0, 0) }) })
afterEach(() => { vi.useRealTimers() })

describe('detectIntent', () => {
  it.each([
    ['Marcação terça 14h Sr. Silva', 'create_rdv'],
    ['Visita amanhã 10h casa do Sr. Costa', 'create_rdv'],
    ['Quero agendar uma visita sexta', 'create_rdv'],
    ['Orçamento poda 150€ para Carlos Silva', 'create_devis'],
    ['Cria orçamento motivo canalização preço 250€ cliente Ferreira', 'create_devis'],
    ['Fatura intervenção Sra. Santos 180€', 'create_facture'],
    ['As minhas próximas marcações', 'list_rdv'],
    ['A minha agenda', 'list_rdv'],
    ['ajuda', 'help'],
    ['Olá', 'help'],
    ['O que podes fazer?', 'help'],
    // « o que » n'est cherché qu'en mots entiers (« lavabo que ») : date, heure et nom font une marcação
    ['Trocar o lavabo que partiu sexta 14h Sr. Silva', 'create_rdv'],
    ['zzz', 'unknown'],
  ] as const)('portugais : « %s » → %s', (texte, attendu) => {
    expect(detectIntent(texte, 'pt')).toBe(attendu)
  })

  it.each([
    ['RDV mardi 15h Mme Dupont', 'create_rdv'],
    ['Changer le lavabo que Mme Durand a cassé jeudi 14h', 'create_rdv'],
    ['Devis plomberie 200€ M. Martin', 'create_devis'],
    ['Facture intervention Mme Legrand 180€', 'create_facture'],
    ['Mon agenda', 'list_rdv'],
    ['aide', 'help'],
    ['zzz', 'unknown'],
    // le portugais n'est jamais essayé sur un message français
    ['Marcação terça 14h Sr. Silva', 'unknown'],
  ] as const)('français (par défaut) : « %s » → %s', (texte, attendu) => {
    expect(detectIntent(texte)).toBe(attendu)
    expect(detectIntent(texte, 'fr')).toBe(attendu)
  })
})

describe('parseDate — portugais', () => {
  it('hoje, amanhã, depois de amanhã', () => {
    expect(parseDate('marcação hoje', 'pt')).toBe('2026-11-17')
    expect(parseDate('visita amanhã', 'pt')).toBe('2026-11-18')
    expect(parseDate('depois de amanhã às 9h', 'pt')).toBe('2026-11-19')
  })

  it('dias da semana : le prochain, jamais le jour même', () => {
    expect(parseDate('terça 14h', 'pt')).toBe('2026-11-24')
    expect(parseDate('quarta-feira', 'pt')).toBe('2026-11-18')
    expect(parseDate('sábado de manhã', 'pt')).toBe('2026-11-21')
    expect(parseDate('domingo', 'pt')).toBe('2026-11-22')
  })

  it('« 17 de julho », « 3 dezembro 2027 » ; une date passée sans année va à l\'année suivante, pas celle du jour', () => {
    expect(parseDate('visita 17 de julho', 'pt')).toBe('2027-07-17')
    expect(parseDate('dia 17 de março', 'pt')).toBe('2027-03-17')
    expect(parseDate('3 dezembro 2027', 'pt')).toBe('2027-12-03')
    expect(parseDate('17 de novembro às 15h', 'pt')).toBe('2026-11-17')
    expect(parseDate('20/11', 'pt')).toBe('2026-11-20')
    expect(parseDate('17/03/2026', 'pt')).toBe('2026-03-17')
    expect(parseDate('31/04', 'pt')).toBeNull()
  })

  it('une date chiffrée l\'emporte sur un lieu qui ressemble à un jour (« Quinta do Lago »)', () => {
    expect(parseDate('Marcação 17/03 às 15h, Quinta do Lago', 'pt')).toBe('2027-03-17')
  })

  it('une rue nommée d\'après une date n\'est pas une date (« Avenida 25 de Abril »)', () => {
    expect(parseDate('Visita sexta na Avenida 25 de Abril', 'pt')).toBe('2026-11-20')
    expect(parseDate('Visita 3 de maio na Rua 5 de Outubro', 'pt')).toBe('2027-05-03')
  })
})

describe('parseDate — français', () => {
  it('résultats d\'avant, à la date locale', () => {
    expect(parseDate("aujourd'hui")).toBe('2026-11-17')
    expect(parseDate('demain 10h')).toBe('2026-11-18')
    expect(parseDate('jeudi')).toBe('2026-11-19')
    expect(parseDate('mardi')).toBe('2026-11-24')
    expect(parseDate('le 17 mars')).toBe('2027-03-17')
    // « 17/12 » : le jour dit, et non la veille comme avec toISOString en France
    expect(parseDate('le 17/12')).toBe('2026-12-17')
    expect(parseDate('le 17/03')).toBe('2026-03-17')
  })

  it('« après-demain » n\'est plus lu comme « demain »', () => {
    expect(parseDate('après-demain')).toBe('2026-11-19')
  })

  it('« RDV M. Domingo 17/03 14h » : 17/03, pas un dimanche', () => {
    expect(parseDate('RDV M. Domingo 17/03 14h')).toBe('2026-03-17')
  })
})

describe('parseTime', () => {
  it('portugais', () => {
    expect(parseTime('às 15h30', 'pt')).toBe('15:30')
    expect(parseTime('às 9:45', 'pt')).toBe('09:45')
    expect(parseTime('ao meio-dia', 'pt')).toBe('12:00')
    expect(parseTime('de manhã', 'pt')).toBe('09:00')
    expect(parseTime('à tarde', 'pt')).toBe('14:00')
    expect(parseTime('à noite', 'pt')).toBe('18:00')
    // « amanhã » n'est pas « de manhã » : pas d'heure inventée
    expect(parseTime('Marcação amanhã Sr. Silva', 'pt')).toBeNull()
  })

  it('français inchangé : « Mme Tarde » n\'est pas une heure', () => {
    expect(parseTime('RDV 14h30')).toBe('14:30')
    expect(parseTime('le matin')).toBe('09:00')
    expect(parseTime('ce soir')).toBe('18:00')
    expect(parseTime('RDV demain Mme Tarde')).toBeNull()
  })
})

describe('parseClientName', () => {
  it('portugais', () => {
    expect(parseClientName('Marcação terça 14h Sr. Silva', 'pt')).toBe('Silva')
    expect(parseClientName('Marcação terça 14h Sr. Domingos', 'pt')).toBe('Domingos')
    expect(parseClientName('Fatura intervenção Sra. Santos 180€', 'pt')).toBe('Santos')
    expect(parseClientName('Orçamento poda 150€ para Carlos Silva', 'pt')).toBe('Carlos Silva')
    expect(parseClientName('Orçamento para o João Pereira', 'pt')).toBe('João Pereira')
    expect(parseClientName('Visita para a cliente Maria da Silva amanhã', 'pt')).toBe('Maria da Silva')
    expect(parseClientName('Sr. Silva de manhã', 'pt')).toBe('Silva')
    expect(parseClientName('Sr. Costa na Rua das Flores 12', 'pt')).toBe('Costa')
    expect(parseClientName('Orçamento para amanhã', 'pt')).toBeNull()
  })

  it('français inchangé', () => {
    expect(parseClientName('RDV mardi 15h Mme Dupont')).toBe('Dupont')
    expect(parseClientName('RDV M. Domingo 17/03 14h')).toBe('Domingo')
    expect(parseClientName('RDV demain Mme Tarde')).toBe('Tarde')
    expect(parseClientName('Devis pour le client Jean Pierre Martin')).toBe('Jean Pierre Martin')
  })
})

describe('parseAddress', () => {
  it('portugais : la morada s\'arrête avant l\'heure, le nom ou un jour qui suit le numéro', () => {
    expect(parseAddress('Visita amanhã na Rua das Flores 12 às 10h', 'pt')).toBe('Rua das Flores 12')
    expect(parseAddress('Visita amanhã na Rua da Quinta 5 às 10h', 'pt')).toBe('Rua da Quinta 5')
    expect(parseAddress('Visita na Rua das Flores 12 sexta às 10h', 'pt')).toBe('Rua das Flores 12')
    expect(parseAddress('Marcação na Avenida 25 de Abril, sexta', 'pt')).toBe('Avenida 25 de Abril')
    expect(parseAddress('Visita na Travessa do Carmo 3 Sr. Costa', 'pt')).toBe('Travessa do Carmo 3')
  })

  it('français inchangé', () => {
    expect(parseAddress('RDV au 12 rue Victor Hugo, demain')).toBe('12 rue Victor Hugo')
    expect(parseAddress('Visita amanhã na Rua das Flores 12 às 10h')).toBeNull()
  })
})

describe('parseServiceMatch', () => {
  it('« motivo X » en portugais, « motif X » en français', () => {
    const servicos = [{ id: 's1', name: 'Canalização' }]
    expect(parseServiceMatch('Cria orçamento motivo canalização preço 250€', servicos, 'pt')?.id).toBe('s1')
    expect(parseServiceMatch('motif plomberie prix 250€', [{ id: 'f1', name: 'Plomberie' }])?.id).toBe('f1')
  })

  it('motivo sans service enregistré : service virtuel au nom dicté', () => {
    const svc = parseServiceMatch('Orçamento motivo limpeza de telhado preço 300€', [], 'pt')
    expect(svc?.virtual).toBe(true)
    expect(svc?.name).toBe('Limpeza de telhado')
  })
})
