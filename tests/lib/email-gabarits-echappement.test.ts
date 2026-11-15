// @vitest-environment node
// tests/lib/email-gabarits-echappement.test.ts
//
// Gabarits d'e-mail partagés (lib/email.ts) : ils reçoivent des valeurs saisies par des comptes (nom d'un invité,
// d'une société, d'un client, intitulé, description…). Chaque valeur est échappée par la fonction commune
// echapperHtmlEmail (lib/sanitize.ts) avant d'entrer dans le HTML : elle s'affiche telle qu'elle a été saisie et ne
// devient jamais du balisage. L'objet d'un e-mail est du texte brut : il n'est pas échappé (des entités s'y
// afficheraient), mais il tient sur une seule ligne. Le gabarit de la demande de prix aux fournisseurs
// (lib/email-rfq.ts) est couvert par tests/api/rfq-demande-fournisseurs.test.ts.
// Données fictives.

import { describe, expect, it } from 'vitest'
import * as gabarits from '@/lib/email'
import { echapperHtmlEmail, texteSurUneLigne } from '@/lib/sanitize'

/** Valeur témoin d'un champ : du balisage, une esperluette, des guillemets et une apostrophe. */
const balise = (champ: string) => `<b data-champ="${champ}">&'</b>`
/** La même valeur une fois échappée : c'est elle, et elle seule, que le HTML doit contenir. */
const echappee = (champ: string) => `&lt;b data-champ=&quot;${champ}&quot;&gt;&amp;&#039;&lt;/b&gt;`
const BALISE_BRUTE = /<b data-champ=/

interface Rendu { subject: string; html: string }
interface Cas {
  nom: string
  /** Champs de texte du gabarit, tous remplis avec la valeur témoin. */
  champs: string[]
  rendre: (valeurs: Record<string, string>, locale: string) => Rendu
}

const CAS: Cas[] = [
  {
    nom: 'templateUnpaidReminder',
    champs: ['ownerName', 'dueDate', 'buildingName', 'unit', 'cabinetName', 'paymentLink'],
    rendre: (v, locale) => gabarits.templateUnpaidReminder({
      ownerName: v.ownerName, amount: 120.5, dueDate: v.dueDate, buildingName: v.buildingName, unit: v.unit,
      cabinetName: v.cabinetName, paymentLink: v.paymentLink, locale,
    }),
  },
  {
    nom: 'templateAGInvitation',
    champs: ['ownerName', 'buildingName', 'date', 'time', 'location', 'cabinetName', 'agendaItems', 'proxyLink'],
    rendre: (v, locale) => gabarits.templateAGInvitation({
      ownerName: v.ownerName, buildingName: v.buildingName, date: v.date, time: v.time, location: v.location,
      cabinetName: v.cabinetName, agendaItems: [v.agendaItems], proxyLink: v.proxyLink, locale,
    }),
  },
  {
    nom: 'templateInterventionNotif',
    champs: ['recipientName', 'buildingName', 'type', 'date', 'artisanName', 'description', 'cabinetName'],
    rendre: (v, locale) => gabarits.templateInterventionNotif({
      recipientName: v.recipientName, buildingName: v.buildingName, type: v.type, date: v.date,
      artisanName: v.artisanName, description: v.description, cabinetName: v.cabinetName, locale,
    }),
  },
  {
    nom: 'templateTeamInvite',
    champs: ['memberName', 'roleName', 'cabinetName', 'inviteUrl'],
    rendre: (v, locale) => gabarits.templateTeamInvite({
      memberName: v.memberName, roleName: v.roleName, cabinetName: v.cabinetName, inviteUrl: v.inviteUrl, locale,
    }),
  },
  {
    nom: 'templateProTeamInvite',
    champs: ['memberName', 'roleName', 'companyName', 'inviteUrl'],
    rendre: (v, locale) => gabarits.templateProTeamInvite({
      memberName: v.memberName, roleName: v.roleName, companyName: v.companyName, inviteUrl: v.inviteUrl, locale,
    }),
  },
  {
    nom: 'templateGenericNotif',
    champs: ['recipientName', 'title', 'body', 'ctaLabel', 'ctaUrl', 'cabinetName'],
    rendre: (v, locale) => gabarits.templateGenericNotif({
      recipientName: v.recipientName, title: v.title, body: v.body, ctaLabel: v.ctaLabel, ctaUrl: v.ctaUrl,
      cabinetName: v.cabinetName, locale,
    }),
  },
  {
    nom: 'templateBookingCreated',
    champs: ['artisanName', 'clientName', 'serviceName', 'bookingDate', 'bookingTime'],
    rendre: (v, locale) => gabarits.templateBookingCreated({
      artisanName: v.artisanName, clientName: v.clientName, serviceName: v.serviceName, bookingDate: v.bookingDate,
      bookingTime: v.bookingTime, locale,
    }),
  },
  {
    nom: 'templateBookingConfirmed',
    champs: ['clientName', 'artisanName', 'companyName', 'serviceName', 'bookingDate', 'bookingTime'],
    rendre: (v, locale) => gabarits.templateBookingConfirmed({
      clientName: v.clientName, artisanName: v.artisanName, companyName: v.companyName, serviceName: v.serviceName,
      bookingDate: v.bookingDate, bookingTime: v.bookingTime, locale,
    }),
  },
  {
    nom: 'templateBookingReminder',
    champs: ['clientName', 'artisanName', 'companyName', 'serviceName', 'bookingDate', 'bookingTime'],
    rendre: (v, locale) => gabarits.templateBookingReminder({
      clientName: v.clientName, artisanName: v.artisanName, companyName: v.companyName, serviceName: v.serviceName,
      bookingDate: v.bookingDate, bookingTime: v.bookingTime, locale,
    }),
  },
  {
    nom: 'templateBookingCompleted',
    champs: ['clientName', 'artisanName', 'companyName', 'serviceName'],
    rendre: (v, locale) => gabarits.templateBookingCompleted({
      clientName: v.clientName, artisanName: v.artisanName, companyName: v.companyName, serviceName: v.serviceName, locale,
    }),
  },
  {
    nom: 'templateDevisReminder',
    champs: ['clientName', 'artisanName', 'companyName', 'docNumber', 'totalStr'],
    rendre: (v, locale) => gabarits.templateDevisReminder({
      clientName: v.clientName, artisanName: v.artisanName, companyName: v.companyName, docNumber: v.docNumber,
      totalStr: v.totalStr, locale,
    }),
  },
]

const valeursTemoins = (champs: string[]) => Object.fromEntries(champs.map((c) => [c, balise(c)]))

describe('fonction commune', () => {
  it('echapperHtmlEmail échappe & < > " \' et rend une valeur absente en chaîne vide', () => {
    expect(echapperHtmlEmail(`<a href="x">L'Atelier & Fils</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;L&#039;Atelier &amp; Fils&lt;/a&gt;')
    expect(echapperHtmlEmail(undefined)).toBe('')
    expect(echapperHtmlEmail(null)).toBe('')
  })

  it('echapperHtmlEmail convertit comme un gabarit littéral ce qui n\'est pas une chaîne', () => {
    expect(echapperHtmlEmail(12.5)).toBe('12.5')
    expect(echapperHtmlEmail(['a', '<b>'])).toBe('a,&lt;b&gt;')
  })

  it('texteSurUneLigne remplace sauts de ligne et caractères de contrôle par une espace, sans rien échapper', () => {
    expect(texteSurUneLigne('L\'Atelier & Fils\r\nSuite fin\t.')).toBe('L\'Atelier & Fils Suite fin .')
    expect(texteSurUneLigne(undefined)).toBe('')
  })

  it('texteSurUneLigne borne la longueur quand une borne est donnée', () => {
    expect(texteSurUneLigne('a'.repeat(500), 200)).toHaveLength(200)
    expect(texteSurUneLigne('court', 200)).toBe('court')
  })
})

describe.each(['fr', 'pt'])('gabarits de lib/email.ts, langue %s', (locale) => {
  it.each(CAS)('$nom : chaque valeur est échappée, aucune ne devient du balisage', ({ champs, rendre }) => {
    const { html } = rendre(valeursTemoins(champs), locale)
    expect(html).not.toMatch(BALISE_BRUTE)
    for (const champ of champs) expect(html, champ).toContain(echappee(champ))
  })

  it.each(CAS)('$nom : objet sur une seule ligne, sans entité HTML', ({ champs, rendre }) => {
    const valeurs = Object.fromEntries(champs.map((c) => [c, `Ligne 1\r\nLigne 2 de l'Atelier & Fils`]))
    const { subject } = rendre(valeurs, locale)
    expect(subject).not.toMatch(/[\r\n]/)
    expect(subject).not.toMatch(/&amp;|&#039;/)
  })
})

// Phrases complètes de chaque gabarit pour des valeurs ordinaires : le texte, les espaces autour des valeurs et l'objet
// sont ceux d'avant la correction (relevés sur la version précédente, comparés octet pour octet le 15/11/2026).
const ORDINAIRES: Array<{ nom: string; rendre: (locale: string) => Rendu; objet: Record<string, string>; phrases: Record<string, string[]> }> = [
  {
    nom: 'templateUnpaidReminder',
    rendre: (locale) => gabarits.templateUnpaidReminder({
      ownerName: 'Claire Martin', amount: 1234.5, dueDate: '15/11/2026', buildingName: 'Résidence du Parc', unit: 'Lot 12',
      cabinetName: 'Cabinet Durand', paymentLink: 'https://vitfix.io/payer/abc123', locale,
    }),
    objet: {
      fr: '[Cabinet Durand] Rappel : Charges impayées — Résidence du Parc',
      pt: '[Cabinet Durand] Lembrete: Pagamento em atraso — Résidence du Parc',
    },
    phrases: {
      fr: [
        'Cher(e) <strong>Claire Martin</strong>,',
        'pour la copropriété <strong>Résidence du Parc</strong>, lot <strong>Lot 12</strong>.',
        '>1234.50 €</p>', 'Échéance : 15/11/2026</p>', '<a href="https://vitfix.io/payer/abc123" style=', '<strong>Cabinet Durand</strong>',
      ],
      pt: [
        'Caro(a) <strong>Claire Martin</strong>,',
        'relativo ao condomínio <strong>Résidence du Parc</strong>, fração <strong>Lot 12</strong>.',
        '>1234.50 €</p>', 'Data limite : 15/11/2026</p>',
      ],
    },
  },
  {
    nom: 'templateAGInvitation',
    rendre: (locale) => gabarits.templateAGInvitation({
      ownerName: 'Claire Martin', buildingName: 'Résidence du Parc', date: '12 décembre 2026', time: '18h30', location: 'Salle des fêtes',
      cabinetName: 'Cabinet Durand', agendaItems: ['Approbation des comptes', 'Travaux de toiture'], proxyLink: 'https://vitfix.io/procuration/xyz', locale,
    }),
    objet: {
      fr: '[Cabinet Durand] Convocation : Assemblée Générale — Résidence du Parc',
      pt: '[Cabinet Durand] Convocatória: Assembleia Geral — Résidence du Parc',
    },
    phrases: {
      fr: [
        'l\'Assemblée Générale de la copropriété <strong>Résidence du Parc</strong>.',
        '📅 <strong>12 décembre 2026</strong> à <strong>18h30</strong></p>', '📍 <strong>Salle des fêtes</strong></p>',
        '<li>Approbation des comptes</li><li>Travaux de toiture</li>', '<a href="https://vitfix.io/procuration/xyz" style=',
      ],
      pt: [
        'a Assembleia Geral do condomínio <strong>Résidence du Parc</strong>.',
        '📅 <strong>12 décembre 2026</strong> às <strong>18h30</strong></p>',
      ],
    },
  },
  {
    nom: 'templateInterventionNotif',
    rendre: (locale) => gabarits.templateInterventionNotif({
      recipientName: 'Claire Martin', buildingName: 'Résidence du Parc', type: 'Plomberie', date: '20/11/2026',
      artisanName: 'Plomberie Martin', description: 'Remplacement de la colonne montante.', cabinetName: 'Cabinet Durand', locale,
    }),
    objet: {
      fr: '[Cabinet Durand] Intervention programmée — Résidence du Parc',
      pt: '[Cabinet Durand] Intervenção programada — Résidence du Parc',
    },
    phrases: {
      fr: [
        'dans la copropriété <strong>Résidence du Parc</strong>.', '<strong>Type :</strong> Plomberie</p>', '<strong>Date :</strong> 20/11/2026</p>',
        '<strong>Artisan :</strong> Plomberie Martin</p>', 'color:#4A5E78;">Remplacement de la colonne montante.</p>',
      ],
      pt: [
        'no condomínio <strong>Résidence du Parc</strong>.', '<strong>Tipo :</strong> Plomberie</p>', '<strong>Data :</strong> 20/11/2026</p>',
        '<strong>Artesão :</strong> Plomberie Martin</p>',
      ],
    },
  },
  {
    nom: 'templateTeamInvite',
    rendre: (locale) => gabarits.templateTeamInvite({
      memberName: 'Claire Martin', roleName: 'Gestionnaire', cabinetName: 'Cabinet Durand', inviteUrl: 'https://vitfix.io/syndic/invite?token=a1b2c3.d4e5f6', locale, // gitleaks:allow — jeton factice (fixture de test, pas un secret)
    }),
    objet: { fr: 'Cabinet Durand vous invite à rejoindre l\'équipe VITFIX', pt: 'Cabinet Durand convida-o(a) para a equipa VITFIX' },
    phrases: {
      fr: [
        'Bonjour <strong>Claire Martin</strong>,',
        'Le cabinet <strong>Cabinet Durand</strong> vous invite à rejoindre son équipe en tant que <strong>Gestionnaire</strong> sur la plateforme VITFIX.',
        '<a href="https://vitfix.io/syndic/invite?token=a1b2c3.d4e5f6" style=', // gitleaks:allow — jeton factice (fixture de test, pas un secret)
      ],
      pt: [
        'Olá <strong>Claire Martin</strong>,',
        'O gabinete <strong>Cabinet Durand</strong> convida-o(a) a juntar-se à sua equipa como <strong>Gestionnaire</strong> na plataforma VITFIX.',
      ],
    },
  },
  {
    nom: 'templateProTeamInvite',
    rendre: (locale) => gabarits.templateProTeamInvite({
      memberName: 'Claire Martin', roleName: 'Conducteur de travaux', companyName: 'Bâtiment Durand SARL',
      inviteUrl: 'https://vitfix.io/pro/invite?token=a1b2c3.d4e5f6', locale, // gitleaks:allow — jeton factice (fixture de test, pas un secret)
    }),
    objet: { fr: 'Bâtiment Durand SARL vous invite à rejoindre l\'équipe VITFIX', pt: 'Bâtiment Durand SARL convida-o(a) para a equipa VITFIX' },
    phrases: {
      fr: [
        'Bonjour <strong>Claire Martin</strong>,',
        'L\'entreprise <strong>Bâtiment Durand SARL</strong> vous invite à rejoindre son équipe en tant que <strong>Conducteur de travaux</strong> sur la plateforme VITFIX.',
        '<a href="https://vitfix.io/pro/invite?token=a1b2c3.d4e5f6" style=', // gitleaks:allow — jeton factice (fixture de test, pas un secret)
      ],
      pt: [
        'Olá <strong>Claire Martin</strong>,',
        'A empresa <strong>Bâtiment Durand SARL</strong> convida-o(a) a juntar-se à sua equipa como <strong>Conducteur de travaux</strong> na plataforma VITFIX.',
      ],
    },
  },
  {
    nom: 'templateGenericNotif',
    rendre: (locale) => gabarits.templateGenericNotif({
      recipientName: 'Claire Martin', title: 'Information importante', body: 'Le ravalement commencera lundi.', ctaLabel: 'Voir le détail',
      ctaUrl: 'https://vitfix.io/detail/42', cabinetName: 'Cabinet Durand', locale,
    }),
    objet: { fr: '[Cabinet Durand] Information importante', pt: '[Cabinet Durand] Information importante' },
    phrases: {
      fr: [
        'font-size:20px;">Information importante</h2>', 'Cher(e) <strong>Claire Martin</strong>,', 'margin:0 0 20px;">Le ravalement commencera lundi.</div>',
        '<a href="https://vitfix.io/detail/42" style=', '        Voir le détail\n',
      ],
      pt: ['Caro(a) <strong>Claire Martin</strong>,', 'margin:0 0 20px;">Le ravalement commencera lundi.</div>'],
    },
  },
  {
    nom: 'templateBookingCreated',
    rendre: (locale) => gabarits.templateBookingCreated({
      artisanName: 'Plomberie Martin', clientName: 'Paul Petit', serviceName: 'Débouchage', bookingDate: 'lundi 16 novembre', bookingTime: '09:30', locale,
    }),
    objet: { fr: 'Nouvelle réservation de Paul Petit', pt: 'Nova marcação de Paul Petit' },
    phrases: {
      fr: [
        'Bonjour <strong>Plomberie Martin</strong>,', '<strong>Client :</strong> Paul Petit</p>', '<strong>Service :</strong> Débouchage</p>',
        '<strong>Date :</strong> lundi 16 novembre à 09:30</p>',
      ],
      pt: [
        'Olá <strong>Plomberie Martin</strong>,', '<strong>Cliente :</strong> Paul Petit</p>', '<strong>Serviço :</strong> Débouchage</p>',
        '<strong>Data :</strong> lundi 16 novembre às 09:30</p>',
      ],
    },
  },
  {
    nom: 'templateBookingConfirmed',
    rendre: (locale) => gabarits.templateBookingConfirmed({
      clientName: 'Paul Petit', artisanName: 'Jean Martin', companyName: 'Plomberie Martin', serviceName: 'Débouchage',
      bookingDate: 'lundi 16 novembre', bookingTime: '09:30', locale,
    }),
    objet: { fr: 'Réservation confirmée — Plomberie Martin', pt: 'Marcação confirmada — Plomberie Martin' },
    phrases: {
      fr: [
        'Bonjour <strong>Paul Petit</strong>,', '<strong>Artisan :</strong> Jean Martin (Plomberie Martin)</p>', '<strong>Service :</strong> Débouchage</p>',
        '<strong>Date :</strong> lundi 16 novembre à 09:30</p>',
      ],
      pt: ['<strong>Profissional :</strong> Jean Martin (Plomberie Martin)</p>', '<strong>Data :</strong> lundi 16 novembre às 09:30</p>'],
    },
  },
  {
    nom: 'templateBookingReminder',
    rendre: (locale) => gabarits.templateBookingReminder({
      clientName: 'Paul Petit', artisanName: 'Jean Martin', companyName: 'Plomberie Martin', serviceName: 'Débouchage',
      bookingDate: 'lundi 16 novembre', bookingTime: '09:30', locale,
    }),
    objet: { fr: 'Rappel : intervention demain avec Plomberie Martin', pt: 'Lembrete: marcação amanhã com Plomberie Martin' },
    phrases: {
      fr: [
        'Bonjour <strong>Paul Petit</strong>,', '<strong>Artisan :</strong> Jean Martin (Plomberie Martin)</p>', '<strong>Service :</strong> Débouchage</p>',
        '<strong>Date :</strong> lundi 16 novembre à 09:30</p>',
      ],
      pt: ['<strong>Profissional :</strong> Jean Martin (Plomberie Martin)</p>', '<strong>Data :</strong> lundi 16 novembre às 09:30</p>'],
    },
  },
  {
    nom: 'templateBookingCompleted',
    rendre: (locale) => gabarits.templateBookingCompleted({
      clientName: 'Paul Petit', artisanName: 'Jean Martin', companyName: 'Plomberie Martin', serviceName: 'Débouchage', locale,
    }),
    objet: { fr: 'Intervention terminée — donnez votre avis', pt: 'Intervenção concluída — deixe a sua opinião' },
    phrases: {
      fr: ['L\'intervention de <strong>Jean Martin</strong> (Plomberie Martin) pour <strong>Débouchage</strong> est terminée.'],
      pt: ['A intervenção de <strong>Jean Martin</strong> (Plomberie Martin) para <strong>Débouchage</strong> foi concluída.'],
    },
  },
  {
    nom: 'templateDevisReminder',
    rendre: (locale) => gabarits.templateDevisReminder({
      clientName: 'Paul Petit', artisanName: 'Jean Martin', companyName: 'Plomberie Martin', docNumber: 'DEV-2026-012', totalStr: '1 234,50 € TTC', locale,
    }),
    objet: { fr: 'Rappel : devis N.DEV-2026-012 en attente de signature', pt: 'Lembrete: orçamento N.DEV-2026-012 aguarda a sua assinatura' },
    phrases: {
      fr: ['Le devis N.DEV-2026-012 de <strong>Jean Martin</strong> (Plomberie Martin) d\'un montant de <strong>1 234,50 € TTC</strong> est en attente de votre signature.'],
      pt: ['O orçamento N.DEV-2026-012 de <strong>Jean Martin</strong> (Plomberie Martin) no valor de <strong>1 234,50 € TTC</strong> aguarda a sua assinatura.'],
    },
  },
]

describe.each(['fr', 'pt'])('gabarits de lib/email.ts : valeurs ordinaires, langue %s', (locale) => {
  it.each(ORDINAIRES)('$nom : objet et phrases complètes inchangés', ({ rendre, objet, phrases }) => {
    const { subject, html } = rendre(locale)
    expect(subject).toBe(objet[locale])
    for (const phrase of phrases[locale]) expect(html).toContain(phrase)
    expect(html).toContain(`<html lang="${locale}">`)
  })
})

describe('gabarits de lib/email.ts : rendu des valeurs ordinaires', () => {
  it('une invitation ordinaire garde son texte, son lien et son objet', () => {
    const lien = 'https://vitfix.io/pro/invite?token=a1b2c3d4.e5f6a7b8' // gitleaks:allow — jeton factice (fixture de test, pas un secret)
    const { subject, html } = gabarits.templateProTeamInvite({
      memberName: 'Claire Martin', roleName: 'Conducteur de travaux', companyName: 'Bâtiment Durand SARL', inviteUrl: lien, locale: 'fr',
    })
    expect(subject).toBe('Bâtiment Durand SARL vous invite à rejoindre l\'équipe VITFIX')
    expect(html).toContain('Bonjour <strong>Claire Martin</strong>,')
    expect(html).toContain('L\'entreprise <strong>Bâtiment Durand SARL</strong> vous invite à rejoindre son équipe en tant que <strong>Conducteur de travaux</strong>')
    expect(html).toContain(`<a href="${lien}"`)
  })

  it('un nom avec apostrophe et esperluette : entités dans le HTML, texte tel quel dans l\'objet', () => {
    const { subject, html } = gabarits.templateBookingConfirmed({
      clientName: 'Paul Petit', artisanName: 'Jean Martin', companyName: 'L\'Atelier & Fils', serviceName: 'Débouchage',
      bookingDate: 'lundi 16 novembre', bookingTime: '09:30', locale: 'fr',
    })
    expect(subject).toBe('Réservation confirmée — L\'Atelier & Fils')
    expect(html).toContain('Jean Martin (L&#039;Atelier &amp; Fils)')
  })

  it('la langue du gabarit ne sort pas de son attribut', () => {
    const { html } = gabarits.templateGenericNotif({ recipientName: 'Claire', title: 'Titre', body: 'Texte', cabinetName: 'Cabinet', locale: 'x"y' })
    expect(html).toContain('<html lang="x&quot;y">')
  })
})
