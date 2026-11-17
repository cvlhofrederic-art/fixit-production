// @vitest-environment node
// tests/lib/email-parrainage-echappement.test.ts
//
// E-mails de parrainage (lib/email-referral.ts), communs à l'artisan et à la société : le nom du filleul et celui du
// parrain viennent de la fiche professionnelle (company_name, first_name), que chaque compte choisit lui-même, et
// partent vers l'autre compte depuis l'adresse d'envoi de la plateforme. Chaque valeur passe par la fonction commune
// echapperHtmlEmail (lib/sanitize.ts) avant d'entrer dans le HTML : elle s'affiche telle qu'elle a été saisie et ne
// devient jamais du balisage. L'objet est du texte brut : il n'est pas échappé (des entités s'y afficheraient), mais il
// tient sur une seule ligne. Pour des valeurs ordinaires, l'objet et le texte restent ceux d'avant. Données fictives.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ envois: [] as unknown[] }))

vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn(async (message: unknown) => { h.envois.push(message); return { success: true, id: 'id-envoi' } }),
}))

const parrainage = await import('@/lib/email-referral')

type Envoi = { to: string; subject: string; html: string; tags: Array<{ name: string; value: string }> }
const envoi = () => h.envois[0] as Envoi

/** Valeur témoin d'un champ : du balisage, une esperluette, des guillemets et une apostrophe. */
const balise = (champ: string) => `<b data-champ="${champ}">&'</b>`
/** La même valeur une fois échappée : c'est elle, et elle seule, que le HTML doit contenir. */
const echappee = (champ: string) => `&lt;b data-champ=&quot;${champ}&quot;&gt;&amp;&#039;&lt;/b&gt;`
const BALISE_BRUTE = /<b data-champ=/

const FILLEUL = 'filleul@exemple.test'
const PARRAIN = 'parrain@exemple.test'

interface Cas {
  nom: string
  /** Champs de texte de l'e-mail, tous remplis avec la valeur témoin. */
  champs: string[]
  envoyer: (valeurs: Record<string, string>) => Promise<unknown>
}

const CAS: Cas[] = [
  {
    nom: 'sendReferralWelcomeFilleul',
    champs: ['filleulName', 'parrainName'],
    envoyer: (v) => parrainage.sendReferralWelcomeFilleul({ filleulEmail: FILLEUL, filleulName: v.filleulName, parrainName: v.parrainName }),
  },
  {
    nom: 'sendReferralNotifParrain',
    champs: ['parrainName', 'filleulName', 'referralCode'],
    envoyer: (v) => parrainage.sendReferralNotifParrain({
      parrainEmail: PARRAIN, parrainName: v.parrainName, filleulName: v.filleulName, referralCode: v.referralCode,
    }),
  },
  {
    nom: 'sendReferralRewardConfirmed',
    champs: ['parrainName', 'filleulName', 'referralCode'],
    envoyer: (v) => parrainage.sendReferralRewardConfirmed({
      parrainEmail: PARRAIN, parrainName: v.parrainName, filleulName: v.filleulName, totalParrainages: 3, referralCode: v.referralCode,
    }),
  },
  {
    nom: 'sendReferralReminderFilleul',
    champs: ['parrainName', 'filleulName', 'referralCode'],
    envoyer: (v) => parrainage.sendReferralReminderFilleul({
      parrainEmail: PARRAIN, parrainName: v.parrainName, filleulName: v.filleulName, referralCode: v.referralCode,
    }),
  },
]

beforeEach(() => {
  h.envois = []
})

describe('e-mails de parrainage : valeurs saisies', () => {
  it.each(CAS)('$nom : chaque valeur est échappée dans le HTML, aucune ne devient du balisage', async ({ champs, envoyer }) => {
    await envoyer(Object.fromEntries(champs.map((c) => [c, balise(c)])))
    expect(h.envois).toHaveLength(1)
    expect(envoi().html).not.toMatch(BALISE_BRUTE)
    for (const champ of champs) expect(envoi().html, champ).toContain(echappee(champ))
  })

  it.each(CAS)('$nom : objet sur une seule ligne, sans entité HTML', async ({ champs, envoyer }) => {
    await envoyer(Object.fromEntries(champs.map((c) => [c, 'Ligne 1\r\nLigne 2 de l\'Atelier & Fils'])))
    expect(envoi().subject).not.toMatch(/[\r\n]/)
    expect(envoi().subject).not.toMatch(/&amp;|&#039;/)
  })

  it('un nom avec apostrophe et esperluette : entités dans le HTML, texte tel quel dans l\'objet', async () => {
    await parrainage.sendReferralNotifParrain({
      parrainEmail: PARRAIN, parrainName: 'Électricité Martin', filleulName: 'L\'Atelier & Fils', referralCode: 'ABCD2345',
    })
    expect(envoi().subject).toBe('🎉 L\'Atelier & Fils a rejoint VITFIX grâce à vous !')
    expect(envoi().html).toContain('<strong>L&#039;Atelier &amp; Fils</strong> vient de créer son compte sur VITFIX')
  })
})

describe('e-mails de parrainage : valeurs ordinaires, objet et texte d\'avant', () => {
  it('bienvenue du filleul', async () => {
    await parrainage.sendReferralWelcomeFilleul({ filleulEmail: FILLEUL, filleulName: 'Plomberie Durand', parrainName: 'Électricité Martin' })
    expect(envoi().to).toBe(FILLEUL)
    expect(envoi().subject).toBe('🎁 Votre 1er mois VITFIX est offert')
    expect(envoi().html).toContain('Bonjour <strong>Plomberie Durand</strong>,')
    expect(envoi().html).toContain('Grâce à <strong>Électricité Martin</strong>, votre premier mois d\'abonnement Pro est offert.')
    expect(envoi().html).toContain('<a href="https://vitfix.io/pro/dashboard" style=')
    expect(envoi().tags).toEqual([{ name: 'type', value: 'referral_welcome_filleul' }])
  })

  it('parrain prévenu de l\'inscription de son filleul', async () => {
    await parrainage.sendReferralNotifParrain({
      parrainEmail: PARRAIN, parrainName: 'Électricité Martin', filleulName: 'Plomberie Durand', referralCode: 'ABCD2345',
    })
    expect(envoi().to).toBe(PARRAIN)
    expect(envoi().subject).toBe('🎉 Plomberie Durand a rejoint VITFIX grâce à vous !')
    expect(envoi().html).toContain('🎉 Plomberie Durand a rejoint VITFIX grâce à vous !')
    expect(envoi().html).toContain('Bonjour <strong>Électricité Martin</strong>,')
    expect(envoi().html).toContain('<strong>Plomberie Durand</strong> vient de créer son compte sur VITFIX grâce à votre lien de parrainage.')
    expect(envoi().html).toContain('<strong>Prochaine étape :</strong> Plomberie Durand souscrit un abonnement Pro')
    expect(envoi().html).toContain('<a href="https://vitfix.io/rejoindre?ref=ABCD2345" style=')
    expect(envoi().tags).toEqual([{ name: 'type', value: 'referral_notif_parrain' }])
  })

  it('récompense du parrain confirmée', async () => {
    await parrainage.sendReferralRewardConfirmed({
      parrainEmail: PARRAIN, parrainName: 'Électricité Martin', filleulName: 'Plomberie Durand', totalParrainages: 3, referralCode: 'ABCD2345',
    })
    expect(envoi().subject).toBe('🎉 Plomberie Durand est abonné — 1 mois offert !')
    expect(envoi().html).toContain('Bonjour <strong>Électricité Martin</strong>,')
    expect(envoi().html).toContain('Votre parrainage de <strong>Plomberie Durand</strong> est validé.')
    expect(envoi().html).toContain('color:#0D1B2E;">3</p>')
    expect(envoi().html).toContain('artisans parrainés au total</p>')
    expect(envoi().html).toContain('<a href="https://vitfix.io/rejoindre?ref=ABCD2345" style=')
    expect(envoi().tags).toEqual([{ name: 'type', value: 'referral_reward_confirmed' }])
  })

  it('rappel au parrain d\'un filleul sans abonnement', async () => {
    await parrainage.sendReferralReminderFilleul({
      parrainEmail: PARRAIN, parrainName: 'Électricité Martin', filleulName: 'Plomberie Durand', referralCode: 'ABCD2345',
    })
    expect(envoi().subject).toBe('⏳ Plomberie Durand n\'a pas encore activé son abonnement')
    expect(envoi().html).toContain('⏳ Plomberie Durand n\'a pas encore activé son abonnement')
    expect(envoi().html).toContain('<strong>Plomberie Durand</strong> s\'est inscrit sur VITFIX grâce à votre lien,')
    expect(envoi().html).toContain('<a href="https://vitfix.io/rejoindre?ref=ABCD2345" style=')
    expect(envoi().tags).toEqual([{ name: 'type', value: 'referral_reminder_filleul' }])
  })
})
