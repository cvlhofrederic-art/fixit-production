// @vitest-environment node
// tests/lib/aj-signalement-diffusion-email.test.ts
//
// E-mail de diffusion aux déclarants (cahier PR 3 § 5.1, § 5.2, § 5.6, § 3.8 ; décisions H1 et H4) :
//   - enveloppe : un seul `to` (ni cc ni bcc), expéditeur « "Nom du cabinet nettoyé" <adresse> » figé, Reply-To = contact
//     du cabinet, objet « copropriété — objet » sur une ligne, en-têtes RFC 8058 avec le jeton UN CLIC seulement,
//     étiquettes type / diffusion / destinataire, version texte ;
//   - gabarit FR et PT : bandeau au nom du cabinet, périmètre, salutation, texte échappé (retours → <br/>), signature,
//     raison de l'envoi, encadré séparé avec le bouton « Ne plus recevoir les informations sur cet immeuble » (jeton de
//     PAGE, dans le fragment), pied (cabinet, politique, contact) ; exactement 2 href ; aucune image ; aucune mention de
//     VitFix ni d'AJ Signalement (le domaine vitfix.io n'apparaît que dans l'adresse technique du lien de la page) ;
//     même entrée → même sortie (aucune date de génération : condition de l'idempotence du lot) ;
//   - message d'annonce (H1, option C) : texte figé du lot 2, même gabarit ;
//   - copie au cabinet : sans lien, sans jeton, sans adresse de déclarant.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Lot = Array<{ to: string | string[]; subject: string; html: string; text?: string; from?: string; replyTo?: string; headers?: Record<string, string>; tags?: Array<{ name: string; value: string }> }>
const h = vi.hoisted(() => ({
  sendEmail: vi.fn(async () => ({ success: true })),
  sendBatchEmails: vi.fn<(lot: Lot) => Promise<{ sent: number; failed: number; errors: string[] }>>(async (lot) => ({ sent: lot.length, failed: 0, errors: [] })),
  warn: vi.fn(),
  error: vi.fn(),
}))
vi.mock('@/lib/email', () => ({ sendEmail: h.sendEmail, sendBatchEmails: h.sendBatchEmails }))
vi.mock('@/lib/logger', () => ({ logger: { warn: h.warn, error: h.error, info: vi.fn(), debug: vi.fn() } }))

import {
  DiffusionInvalideQr, TEXTES_DIFFUSION_QR, adresseDestinataireDiffusionValideQr, diffusionFigeeDepuisLigneQr, envoyerCopieCabinetDiffusionQr,
  expediteurDiffusionQr, messageCopieCabinetDiffusionQr, messageDiffusionQr, sujetDiffusionQr,
  templateConfirmationQr, templateCopieCabinetDiffusionQr, templateDiffusionQr, templateSignalementQr,
  type DiffusionFigeeQr,
} from '@/lib/aj-signalement/email'
import { annonceDiffusionQr } from '@/lib/aj-signalement/affichage-diffusion'
import type { SignalementQr } from '@/lib/aj-signalement/types'

const ID_DIFFUSION = '9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b6a'
const ID_DESTINATAIRE = '3f2b8c1d-4e5a-4b6c-9d7e-8f9a0b1c2d3e'
const HEX = ID_DESTINATAIRE.replaceAll('-', '')
const JETONS = { page: `${HEX}.${'a1'.repeat(32)}`, unClic: `${HEX}.${'b2'.repeat(32)}` }
const DESTINATAIRE = { id: ID_DESTINATAIRE, email: 'declarant@exemple.test' }
const URL_PAGE = `https://vitfix.io/cabinet-exemple/desinscription/#${JETONS.page}`
const URL_UN_CLIC = `https://vitfix.io/api/aj-signalement/desinscription/un-clic/${JETONS.unClic}`
const POLITIQUE = 'https://cabinet-exemple.test/confidentialite'

function diffusion(sur: Partial<DiffusionFigeeQr> = {}): DiffusionFigeeQr {
  return {
    id: ID_DIFFUSION,
    langue: 'fr',
    modele: 'coupure_eau',
    cabinetNom: 'Cabinet Exemple',
    cabinetIdentifiant: 'cabinet-exemple',
    coproprieteNom: 'Résidence Exemple',
    contactEmail: 'contact@cabinet-exemple.test',
    politiqueUrl: POLITIQUE,
    expediteur: '"Cabinet Exemple" <diffusion@envoi.exemple.test>',
    objet: 'Coupure d’eau le 14/11 de 9h à 10h',
    texte: 'L’eau sera coupée le 14/11, de 9h à 10h, bâtiment B, pour remplacer une vanne.\nPensez à faire une réserve d’eau.',
    portee: 'batiment',
    libellePerimetre: 'Bâtiment B',
    creeLe: '2026-11-13T09:00:00.000Z',
    nbDestinataires: 12,
    acteurProfil: 'super_admin',
    instructionReference: 'courriel de la gestionnaire du 12/11/2026 10:02',
    instructionRecueLe: '2026-11-12',
    ...sur,
  }
}

const message = (sur: Partial<DiffusionFigeeQr> = {}) => messageDiffusionQr(diffusion(sur), DESTINATAIRE, JETONS)
const hrefs = (html: string) => [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1])
/** HTML sans la valeur de ses attributs href (adresses techniques des liens). */
const sansHref = (html: string) => html.replace(/href="[^"]*"/g, 'href=""')
/** Texte sans les adresses (https://…) qu'il écrit en clair. */
const sansAdresses = (texte: string) => texte.replace(/https:\/\/\S+/g, '')

beforeEach(() => {
  h.sendBatchEmails.mockClear()
  h.sendBatchEmails.mockImplementation(async (lot) => ({ sent: lot.length, failed: 0, errors: [] }))
  h.sendEmail.mockClear()
  h.warn.mockClear()
  h.error.mockClear()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('enveloppe (§ 5.1)', () => {
  it('un seul destinataire, ni cc ni bcc ; expéditeur figé ; Reply-To = contact du cabinet', () => {
    const m = message()
    expect(m.to).toBe('declarant@exemple.test')
    expect(Object.keys(m).sort()).toEqual(['from', 'headers', 'html', 'replyTo', 'subject', 'tags', 'text', 'to'])
    expect(m).not.toHaveProperty('cc')
    expect(m).not.toHaveProperty('bcc')
    expect(m.from).toBe('"Cabinet Exemple" <diffusion@envoi.exemple.test>')
    expect(m.replyTo).toBe('contact@cabinet-exemple.test')
  })

  it('objet = « copropriété — objet »', () => {
    expect(message().subject).toBe('Résidence Exemple — Coupure d’eau le 14/11 de 9h à 10h')
    expect(sujetDiffusionQr('Résidence Exemple', 'Fuite en cours — cave')).toBe('Résidence Exemple — Fuite en cours — cave')
  })

  it('nom de copropriété avec retour à la ligne ou contrôle : objet sur une seule ligne, 80 caractères de nom au plus', () => {
    expect(message({ coproprieteNom: 'Résidence\r\nExemple\u0085\tNord' }).subject).toBe('Résidence Exemple Nord — Coupure d’eau le 14/11 de 9h à 10h')
    expect(message({ objet: 'Coupure\r\nBcc: x@exemple.test' }).subject).toBe('Résidence Exemple — Coupure Bcc: x@exemple.test')
    const long = sujetDiffusionQr(`Résidence ${'É'.repeat(100)}`, 'Fuite')
    expect(long).toBe(`Résidence ${'É'.repeat(70)} — Fuite`)
    for (const s of [message({ coproprieteNom: 'A\nB' }).subject, long]) expect(s).not.toMatch(/[\r\n\u0085\u2028\u2029]/)
  })

  it('en-têtes RFC 8058 exacts, avec le jeton UN CLIC (jamais celui de la page)', () => {
    const m = message()
    expect(m.headers).toEqual({
      'List-Unsubscribe': `<${URL_UN_CLIC}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    })
    expect(JSON.stringify(m.headers)).not.toContain(JETONS.page)
  })

  it('bouton du corps : jeton de PAGE, dans le fragment ; le jeton un clic n’est ni dans le HTML ni dans le texte', () => {
    const m = message()
    expect(hrefs(m.html)[0]).toBe(URL_PAGE)
    expect(m.text).toContain(URL_PAGE)
    expect(m.html).not.toContain(JETONS.unClic)
    expect(m.text).not.toContain(JETONS.unClic)
    expect(JETONS.page).not.toBe(JETONS.unClic)
  })

  it('étiquettes : type, diffusion, destinataire', () => {
    expect(message().tags).toEqual([
      { name: 'type', value: 'aj-diffusion' },
      { name: 'diffusion', value: ID_DIFFUSION },
      { name: 'destinataire', value: ID_DESTINATAIRE },
    ])
  })

  it('version texte du même contenu', () => {
    const { text } = message()
    expect(text).toBe([
      'Cabinet Exemple',
      'Information sur votre immeuble',
      'Copropriété Résidence Exemple · Bâtiment B',
      '',
      'Bonjour,',
      '',
      'L’eau sera coupée le 14/11, de 9h à 10h, bâtiment B, pour remplacer une vanne.',
      'Pensez à faire une réserve d’eau.',
      '',
      'Cabinet Exemple',
      '',
      'Vous recevez ce message parce que vous avez signalé un problème dans cette copropriété.',
      '',
      'Vous pouvez ne plus recevoir ces informations à tout moment, sans justification.',
      `Ne plus recevoir les informations sur cet immeuble : ${URL_PAGE}`,
      '',
      'Message envoyé par Cabinet Exemple, qui gère cette copropriété. Vos coordonnées sont traitées par Cabinet Exemple : '
        + `Politique de confidentialité (${POLITIQUE}) · Contact : contact@cabinet-exemple.test. Pour écrire au cabinet, répondez à ce message.`,
      '',
    ].join('\n'))
    expect(text).not.toMatch(/<[a-z/]/i)
  })
})

describe('gabarit HTML (§ 5.2)', () => {
  it('libellé exact du bouton, dans un lien', () => {
    expect(message().html).toContain(`>${TEXTES_DIFFUSION_QR.fr.bouton}</a>`)
    expect(TEXTES_DIFFUSION_QR.fr.bouton).toBe('Ne plus recevoir les informations sur cet immeuble')
  })

  it('phrase exacte de la raison (droit § 4.3)', () => {
    expect(TEXTES_DIFFUSION_QR.fr.raison).toBe('Vous recevez ce message parce que vous avez signalé un problème dans cette copropriété.')
    expect(message().html).toContain(TEXTES_DIFFUSION_QR.fr.raison)
  })

  it('encadré SÉPARÉ (art. 21.4) : la phrase et le bouton seuls, hors du texte et de la raison', () => {
    const { html } = message()
    const phrase = 'Vous pouvez ne plus recevoir ces informations à tout moment, sans justification.'
    const i = html.indexOf(phrase)
    expect(i).toBeGreaterThan(0)
    const debut = html.lastIndexOf('<table', i)
    const fin = html.indexOf('</table>', i)
    const encadre = html.slice(debut, fin)
    expect(encadre).toMatch(/border:1px solid/)
    expect(encadre).toContain(`href="${URL_PAGE}"`)
    expect(encadre).toContain(TEXTES_DIFFUSION_QR.fr.bouton)
    expect(encadre).not.toContain(TEXTES_DIFFUSION_QR.fr.raison)
    expect(encadre).not.toContain('Pensez à faire')
    expect(html.indexOf(TEXTES_DIFFUSION_QR.fr.raison)).toBeLessThan(debut)
  })

  it('exactement 2 href : le bouton (page) puis la politique du cabinet', () => {
    expect(hrefs(message().html)).toEqual([URL_PAGE, POLITIQUE])
  })

  it('aucune image, aucun pixel, aucun script', () => {
    const { html } = message()
    expect(html).not.toMatch(/<img|src=|<script|url\(|background-image/i)
  })

  it('aucune mention de VitFix ni d’AJ Signalement (hors adresse technique du lien de la page)', () => {
    for (const langue of ['fr', 'pt'] as const) {
      for (const modele of ['coupure_eau', 'annonce'] as const) {
        const m = message({ langue, modele })
        // L'adresse d'expédition peut être sur un domaine de VitFix (§ 5.1 : technique, pas l'auteur) : non vérifiée ici.
        for (const contenu of [sansHref(m.html), sansAdresses(m.text ?? ''), m.subject]) {
          expect(contenu).not.toMatch(/vitfix/i)
          expect(contenu).not.toMatch(/aj[\s_-]*signalement/i)
        }
        // vitfix.io n'apparaît que dans l'adresse du lien de la page (domaine technique, jamais l'auteur).
        expect(m.html.match(/vitfix/gi)).toHaveLength(1)
        expect((m.text ?? '').match(/vitfix/gi)).toHaveLength(1)
      }
    }
  })

  it('bandeau et signature au nom du cabinet (et non « AJ SIGNALEMENT »)', () => {
    const { html } = message()
    expect(html).not.toContain('AJ SIGNALEMENT')
    expect(html.match(/Cabinet Exemple/g)?.length).toBeGreaterThanOrEqual(3)
    const texte = html.indexOf('Pensez à faire une réserve d’eau.')
    const raison = html.indexOf(TEXTES_DIFFUSION_QR.fr.raison)
    expect(html.slice(texte, raison)).toContain('Cabinet Exemple')
  })

  it('titre, périmètre, salutation, langue du document', () => {
    const { html } = message()
    expect(html).toContain('<html lang="fr">')
    expect(html).toContain('Information sur votre immeuble')
    expect(html).toContain('Copropriété Résidence Exemple · Bâtiment B')
    expect(html).toContain('Bonjour,')
  })

  it('périmètre selon la portée', () => {
    const ligne = (d: Partial<DiffusionFigeeQr>) => (message(d).text ?? '').split('\n')[2]
    expect(ligne({ portee: 'copropriete', libellePerimetre: 'Toute la copropriété' })).toBe('Copropriété Résidence Exemple')
    expect(ligne({ portee: 'batiment', libellePerimetre: 'Bâtiment B' })).toBe('Copropriété Résidence Exemple · Bâtiment B')
    expect(ligne({ portee: 'etage', libellePerimetre: 'Bâtiment B · 3e étage' })).toBe('Copropriété Résidence Exemple · Bâtiment B · 3e étage')
    expect(ligne({ portee: 'signalement', libellePerimetre: 'Déclarants du signalement' }))
      .toBe('Copropriété Résidence Exemple · au sujet du problème que vous avez signalé')
    expect(ligne({ langue: 'pt', portee: 'signalement', libellePerimetre: 'Quem comunicou a ocorrência' }))
      .toBe('Condomínio Résidence Exemple · sobre o problema que comunicou')
    expect(ligne({ langue: 'pt', portee: 'etage', libellePerimetre: 'Bloco B · 1.º andar' })).toBe('Condomínio Résidence Exemple · Bloco B · 1.º andar')
  })

  it('texte <script> échappé ; retours à la ligne → <br/>', () => {
    const { html, text } = message({ texte: 'Ligne 1 <script>alert(1)</script>\nLigne 2 & "fin"' })
    expect(html).toContain('Ligne 1 &lt;script&gt;alert(1)&lt;/script&gt;<br/>Ligne 2 &amp; &quot;fin&quot;')
    expect(html).not.toContain('<script')
    expect(text).toContain('Ligne 1 <script>alert(1)</script>\nLigne 2 & "fin"')
  })

  it('toute valeur échappée : noms, libellé, contact, politique', () => {
    const { html } = message({
      cabinetNom: 'Cabinet <b>Exemple</b> & Fils', coproprieteNom: 'Résidence "Les <Pins>"',
      libellePerimetre: 'Bâtiment <i>B</i>', politiqueUrl: 'https://cabinet-exemple.test/confidentialite?a=1&b=2',
    })
    expect(html).toContain('Cabinet &lt;b&gt;Exemple&lt;/b&gt; &amp; Fils')
    expect(html).toContain('Résidence &quot;Les &lt;Pins&gt;&quot;')
    expect(html).toContain('Bâtiment &lt;i&gt;B&lt;/i&gt;')
    expect(html).toContain('href="https://cabinet-exemple.test/confidentialite?a=1&amp;b=2"')
    expect(html).not.toMatch(/<b>|<i>|<Pins>/)
  })

  it('même entrée → même sortie, quelle que soit l’heure (aucune date de génération)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-13T09:00:00Z'))
    const a = message()
    vi.setSystemTime(new Date('2027-03-01T18:30:00Z'))
    const b = message()
    expect(b).toEqual(a)
    expect(templateDiffusionQr(diffusion(), JETONS.page)).toEqual(templateDiffusionQr(diffusion(), JETONS.page))
  })

  it('portugais (proposé, H4) : textes du cahier', () => {
    const m = message({ langue: 'pt', libellePerimetre: 'Bloco B' })
    const t = TEXTES_DIFFUSION_QR.pt
    expect(m.html).toContain('<html lang="pt">')
    expect(t.titre).toBe('Informação sobre o seu prédio')
    expect(t.bouton).toBe('Deixar de receber as informações sobre este prédio')
    expect(t.raison).toBe('Recebe esta mensagem porque comunicou um problema neste condomínio.')
    expect(t.encadre).toBe('Pode deixar de receber estas informações a qualquer momento, sem justificação.')
    expect(t.bonjour).toBe('Olá,')
    for (const texte of [t.titre, t.bouton, t.raison, t.encadre, 'Condomínio Résidence Exemple · Bloco B']) expect(m.html).toContain(texte)
    expect(m.text).toContain('Mensagem enviada por Cabinet Exemple, que administra este condomínio. Os seus dados são tratados por Cabinet Exemple: '
      + `Política de privacidade (${POLITIQUE}) · Contacto: contact@cabinet-exemple.test. Para escrever ao administrador, responda a esta mensagem.`)
    expect(hrefs(m.html)).toEqual([URL_PAGE, POLITIQUE])
  })

  it('les gabarits existants gardent le bandeau AJ SIGNALEMENT (cadre commun inchangé)', () => {
    const s = {
      id: '5f2c9a1e-1111-4222-8333-444444444444', coproprieteId: 'c1', coproprieteNom: 'Résidence Exemple',
      prenom: 'Marie', nom: 'Durand', telephone: '06 12 34 56 78', email: 'marie@exemple.test',
      batiment: 'B', etage: '4', numLot: '12', estPartieCommune: false, zoneSignalee: '',
      typeIntervention: 'Plomberie', description: 'Fuite', priorite: 'normale', statut: 'en_attente', langue: 'fr',
      emailEnvoyeLe: null, emailErreur: null, confirmationEnvoyeeLe: null, confirmationErreur: null,
      qualiteDeclarant: null, adresseProposee: '', signalementLieId: null,
      creeLe: '2026-11-04T13:05:00.000Z', misAJourLe: '2026-11-04T13:05:00.000Z',
    } as SignalementQr
    expect(templateConfirmationQr({ copropriete: { nom: 'Résidence Exemple' }, signalement: s }).html).toContain('AJ SIGNALEMENT')
    expect(templateSignalementQr({ copropriete: { nom: 'Résidence Exemple', adresse: '' }, signalement: s }).html).toContain('AJ SIGNALEMENT')
  })
})

describe('message d’annonce (H1, option C)', () => {
  const annonce = annonceDiffusionQr('fr', 'Cabinet Exemple')
  const m = () => message({ modele: 'annonce', portee: 'copropriete', libellePerimetre: 'Toute la copropriété', ...annonce })

  it('objet « copropriété — informations sur votre immeuble par e-mail »', () => {
    expect(m().subject).toBe('Résidence Exemple — Informations sur votre immeuble par e-mail')
  })

  it('texte figé du lot 2, échappé, paragraphes gardés ; même encadré, même bouton, mêmes 2 liens', () => {
    const { html, text } = m()
    const [premier, second] = annonce.texte.split('\n\n')
    expect(html).toContain(`${premier}<br/><br/>${second}`)
    expect(text).toContain(annonce.texte)
    expect(html).toContain(TEXTES_DIFFUSION_QR.fr.bouton)
    expect(html).toContain(TEXTES_DIFFUSION_QR.fr.raison)
    expect(hrefs(html)).toEqual([URL_PAGE, POLITIQUE])
    expect(text?.split('\n')[2]).toBe('Copropriété Résidence Exemple')
  })
})

describe('gardes de l’enveloppe (défense en profondeur : valeurs déjà contrôlées par la base)', () => {
  const echec = (f: () => unknown, champ: string) => {
    let erreur: unknown
    try { f() } catch (e) { erreur = e }
    expect(erreur).toBeInstanceOf(DiffusionInvalideQr)
    expect((erreur as DiffusionInvalideQr).champ).toBe(champ)
    // Le message d'erreur ne recopie aucune valeur (adresse, texte).
    expect((erreur as Error).message).not.toContain('@')
  }

  it('destinataire : une seule adresse, sans séparateur ni espace', () => {
    for (const email of ['a@exemple.test, b@exemple.test', 'a@exemple.test;b@exemple.test', 'a b@exemple.test',
      '"x" <a@exemple.test>', 'a@exemple.test\r\nBcc: b@exemple.test', 'pas-une-adresse', '']) {
      echec(() => messageDiffusionQr(diffusion(), { ...DESTINATAIRE, email }, JETONS), 'destinataire')
    }
  })

  it('destinataire : les adresses admises au dépôt (strictEmail) restent envoyables (apostrophe, +, tiret)', () => {
    for (const email of ['o\'brien@exemple.test', 'marie+immeuble@exemple.test', 'jean-luc.d_2@sous.exemple.test']) {
      expect(adresseDestinataireDiffusionValideQr(email)).toBe(true)
      expect(messageDiffusionQr(diffusion(), { ...DESTINATAIRE, email }, JETONS).to).toBe(email)
    }
  })

  it('expéditeur figé hors forme « "Nom" <adresse> » ou « adresse »', () => {
    for (const expediteur of ['"Cabinet" <a@exemple.test>\r\nBcc: b@exemple.test', '"Ca"bi" <a@exemple.test>', 'Cabinet <a@exemple.test>',
      '"Cabinet" <a@exemple.test>, "X" <b@exemple.test>', 'rien']) {
      echec(() => message({ expediteur }), 'expediteur')
    }
    expect(message({ expediteur: 'diffusion@envoi.exemple.test' }).from).toBe('diffusion@envoi.exemple.test')
  })

  it('Reply-To, politique, identifiants, jetons', () => {
    echec(() => message({ contactEmail: 'contact@exemple.test\r\nBcc: x@exemple.test' }), 'contact')
    echec(() => message({ politiqueUrl: 'http://cabinet-exemple.test/confidentialite' }), 'politique')
    echec(() => message({ politiqueUrl: 'https://cabinet-exemple.test/"><script>' }), 'politique')
    echec(() => message({ cabinetIdentifiant: 'Cabinet Exemple' }), 'identifiant')
    echec(() => message({ id: 'pas-un-uuid' }), 'identifiant')
    echec(() => messageDiffusionQr(diffusion(), { ...DESTINATAIRE, id: 'x' }, JETONS), 'identifiant')
    echec(() => messageDiffusionQr(diffusion(), DESTINATAIRE, { ...JETONS, unClic: `${JETONS.unClic}>, <https://exemple.test` }), 'jeton')
    echec(() => messageDiffusionQr(diffusion(), DESTINATAIRE, { ...JETONS, page: 'abc' }), 'jeton')
    // Les deux jetons doivent porter l'identifiant de CE destinataire.
    const autre = `${'0'.repeat(32)}.${'a1'.repeat(32)}`
    echec(() => messageDiffusionQr(diffusion(), DESTINATAIRE, { ...JETONS, page: autre }), 'jeton')
  })
})

describe('expéditeur (fige_expediteur, calculé à la création)', () => {
  const ENV = { AJ_SIGNALEMENT_EXPEDITEUR_DIFFUSION: 'diffusion@envoi.exemple.test', RESEND_FROM_EMAIL: 'VITFIX <noreply@exemple.test>' }

  it('« "Nom du cabinet" <adresse dédiée> »', () => {
    expect(expediteurDiffusionQr('Cabinet Exemple', ENV)).toBe('"Cabinet Exemple" <diffusion@envoi.exemple.test>')
  })

  it('adresse dédiée écrite « Nom <adresse> » : seule la partie adresse sert, en minuscules', () => {
    expect(expediteurDiffusionQr('Cabinet Exemple', { AJ_SIGNALEMENT_EXPEDITEUR_DIFFUSION: 'Autre <Diffusion@Envoi.Exemple.test>' }))
      .toBe('"Cabinet Exemple" <diffusion@envoi.exemple.test>')
  })

  it('sans adresse dédiée valable : partie adresse de RESEND_FROM_EMAIL, nom du cabinet gardé', () => {
    expect(expediteurDiffusionQr('Cabinet Exemple', { RESEND_FROM_EMAIL: 'VITFIX <noreply@exemple.test>' }))
      .toBe('"Cabinet Exemple" <noreply@exemple.test>')
    expect(expediteurDiffusionQr('Cabinet Exemple', { ...ENV, AJ_SIGNALEMENT_EXPEDITEUR_DIFFUSION: 'pas une adresse' }))
      .toBe('"Cabinet Exemple" <noreply@exemple.test>')
    expect(expediteurDiffusionQr('Cabinet Exemple', { RESEND_FROM_EMAIL: 'noreply@exemple.test' })).toBe('"Cabinet Exemple" <noreply@exemple.test>')
  })

  it('aucune des deux : adresse sans réponse du service (celle de lib/email.ts)', () => {
    expect(expediteurDiffusionQr('Cabinet Exemple', {})).toBe('"Cabinet Exemple" <noreply@vitfix.io>')
  })

  it('nom d’affichage nettoyé : ni « " », ni « \\ », ni chevrons, virgule, point-virgule, retours, contrôles', () => {
    const e = expediteurDiffusionQr('Cabinet "Exemple" <x>, Fils; \\ Cie\r\nBcc: y\u0007\u200B', ENV)
    expect(e).toBe('"Cabinet Exemple x Fils Cie Bcc: y" <diffusion@envoi.exemple.test>')
    expect(e).not.toMatch(/[\r\n\u0007\u200B]/)
    expect(e.match(/"/g)).toHaveLength(2)
  })

  it('70 caractères de nom au plus ; nom vide une fois nettoyé : l’adresse seule', () => {
    expect(expediteurDiffusionQr(`Cabinet ${'É'.repeat(100)}`, ENV)).toBe(`"Cabinet ${'É'.repeat(62)}" <diffusion@envoi.exemple.test>`)
    expect(expediteurDiffusionQr('"<>";,', ENV)).toBe('diffusion@envoi.exemple.test')
  })

  it('accepté par la garde de l’enveloppe et par le CHECK de la base (3 à 400 caractères, aucun contrôle)', () => {
    for (const nom of ['Cabinet Exemple', `Cabinet ${'É'.repeat(100)}`, '"<>";,', 'Cabinet\r\nX']) {
      const expediteur = expediteurDiffusionQr(nom, ENV)
      expect(expediteur.length).toBeGreaterThanOrEqual(3)
      expect(expediteur.length).toBeLessThanOrEqual(400)
      expect(expediteur).not.toMatch(/\p{Cc}/u)
      expect(message({ expediteur }).from).toBe(expediteur)
    }
  })
})

describe('copie au cabinet (§ 5.6)', () => {
  it('auteur super admin : instruction écrite (date et référence), date d’envoi, nombre, périmètre ; objet et texte', () => {
    const { subject, html, text } = templateCopieCabinetDiffusionQr(diffusion())
    expect(subject).toBe('Copie — Résidence Exemple — Coupure d’eau le 14/11 de 9h à 10h')
    const phrase = 'Copie — message envoyé par l’administrateur VitFix, sur votre instruction du 12 novembre 2026 '
      + '(référence : courriel de la gestionnaire du 12/11/2026 10:02) le 13 novembre 2026 à 10:00 à 12 personnes (Bâtiment B).'
    expect(html).toContain(phrase)
    expect(text).toContain(phrase)
    expect(html).toContain('Coupure d’eau le 14/11 de 9h à 10h')
    expect(html).toContain('L’eau sera coupée le 14/11, de 9h à 10h, bâtiment B, pour remplacer une vanne.<br/>Pensez à faire une réserve d’eau.')
    expect(text).toContain(diffusion().texte)
  })

  it('auteur gestionnaire : « un gestionnaire » ; une seule personne : singulier', () => {
    const { html } = templateCopieCabinetDiffusionQr(diffusion({
      acteurProfil: 'gestionnaire', instructionReference: null, instructionRecueLe: null, nbDestinataires: 1,
      portee: 'copropriete', libellePerimetre: 'Toute la copropriété',
    }))
    expect(html).toContain('Copie — message envoyé par un gestionnaire le 13 novembre 2026 à 10:00 à 1 personne (Toute la copropriété).')
  })

  it('aucun lien, aucun jeton, aucune adresse de déclarant, aucun bouton de désinscription', () => {
    const d = diffusion({ texte: 'Texte avec <script>x</script>\nsur deux lignes.' })
    const { html, text } = templateCopieCabinetDiffusionQr(d)
    for (const contenu of [html, text]) {
      expect(contenu).not.toMatch(/href=|https?:|desinscription|[a-f0-9]{32}\.[a-f0-9]{64}/i)
      expect(contenu).not.toContain(JETONS.page.slice(0, 32))
      expect(contenu).not.toContain('declarant@exemple.test')
      expect(contenu).not.toContain(TEXTES_DIFFUSION_QR.fr.bouton)
    }
    expect(html).toContain('Texte avec &lt;script&gt;x&lt;/script&gt;<br/>sur deux lignes.')
    expect(html).not.toContain('<script')
  })

  it('portugais (proposé, H4)', () => {
    const { subject, html } = templateCopieCabinetDiffusionQr(diffusion({ langue: 'pt', libellePerimetre: 'Bloco B' }))
    expect(subject).toBe('Cópia — Résidence Exemple — Coupure d’eau le 14/11 de 9h à 10h')
    expect(html).toContain('<html lang="pt">')
    expect(html).toContain('Cópia — mensagem enviada pelo administrador VitFix, conforme a vossa instrução de 12 de novembro de 2026 '
      + '(referência: courriel de la gestionnaire du 12/11/2026 10:02) em 13 de novembro de 2026 às 10:00 a 12 pessoas (Bloco B).')
  })

  it('même entrée → même sortie', () => {
    expect(templateCopieCabinetDiffusionQr(diffusion())).toEqual(templateCopieCabinetDiffusionQr(diffusion()))
  })

  it('message : au seul contact du cabinet, expéditeur du service, sans Reply-To ni en-tête de désinscription', () => {
    const m = messageCopieCabinetDiffusionQr(diffusion())
    expect(m.to).toBe('contact@cabinet-exemple.test')
    expect(m).not.toHaveProperty('from')
    expect(m).not.toHaveProperty('replyTo')
    expect(m).not.toHaveProperty('headers')
    expect(m.text).toBeTruthy()
    expect(m.tags).toEqual([{ name: 'type', value: 'aj-diffusion-copie' }, { name: 'diffusion', value: ID_DIFFUSION }])
  })

  it('envoi : un message par lot ; vrai si accepté', async () => {
    expect(await envoyerCopieCabinetDiffusionQr(diffusion())).toBe(true)
    expect(h.sendBatchEmails).toHaveBeenCalledTimes(1)
    const lot = h.sendBatchEmails.mock.calls[0][0]
    expect(lot).toHaveLength(1)
    expect(lot[0].to).toBe('contact@cabinet-exemple.test')
    expect(h.warn).not.toHaveBeenCalled()
  })

  it('échec (refus ou exception) : faux, logger.warn avec l’identifiant de la diffusion seulement, jamais une exception', async () => {
    h.sendBatchEmails.mockImplementationOnce(async () => ({ sent: 0, failed: 1, errors: ['refus de contact@cabinet-exemple.test'] }))
    expect(await envoyerCopieCabinetDiffusionQr(diffusion())).toBe(false)
    h.sendBatchEmails.mockImplementationOnce(async () => { throw new Error('panne pour contact@cabinet-exemple.test') })
    expect(await envoyerCopieCabinetDiffusionQr(diffusion())).toBe(false)
    expect(h.warn).toHaveBeenCalled()
    for (const appel of h.warn.mock.calls) expect(JSON.stringify(appel)).not.toContain('@')
    expect(h.warn).toHaveBeenCalledWith(expect.stringContaining('copie'), { diffusionId: ID_DIFFUSION })
  })

  it('contact du cabinet invalide : aucun envoi, faux', async () => {
    expect(await envoyerCopieCabinetDiffusionQr(diffusion({ contactEmail: 'a@exemple.test, b@exemple.test' }))).toBe(false)
    expect(h.sendBatchEmails).not.toHaveBeenCalled()
  })
})

describe('lecture d’une ligne signalements_qr_diffusions', () => {
  const ligne = {
    id: ID_DIFFUSION, langue: 'fr', modele: 'coupure_eau', fige_cabinet_nom: 'Cabinet Exemple',
    fige_cabinet_identifiant: 'cabinet-exemple', fige_copropriete_nom: 'Résidence Exemple',
    fige_contact_email: 'contact@cabinet-exemple.test', fige_politique_url: POLITIQUE,
    fige_expediteur: '"Cabinet Exemple" <diffusion@envoi.exemple.test>', objet: diffusion().objet, texte: diffusion().texte,
    portee: 'batiment', libelle_perimetre: 'Bâtiment B', created_at: '2026-11-13T09:00:00.000Z', nb_destinataires: 12,
    acteur_profil: 'super_admin', instruction_reference: 'courriel de la gestionnaire du 12/11/2026 10:02',
    instruction_recue_le: '2026-11-12',
    // Colonnes non lues par le gabarit : ignorées.
    copropriete_id: '7c6b5a49-3827-4165-9504-a3b2c1d0e9f8', dernier_lot: 3,
  }

  it('ligne complète → valeurs figées du gabarit', () => {
    expect(diffusionFigeeDepuisLigneQr(ligne)).toEqual(diffusion())
  })

  it('ligne incomplète ou incohérente → null', () => {
    const { fige_expediteur: _sansExpediteur, ...sansExpediteur } = ligne
    for (const l of [null, 'x', {}, sansExpediteur, { ...ligne, langue: 'es' }, { ...ligne, modele: 'promo' },
      { ...ligne, portee: 'lot' }, { ...ligne, nb_destinataires: 0 }, { ...ligne, id: 'x' },
      { ...ligne, instruction_reference: null }, { ...ligne, instruction_recue_le: '12/11/2026' }]) {
      expect(diffusionFigeeDepuisLigneQr(l)).toBeNull()
    }
  })

  it('gestionnaire : instruction absente admise', () => {
    expect(diffusionFigeeDepuisLigneQr({ ...ligne, acteur_profil: 'gestionnaire', instruction_reference: null, instruction_recue_le: null }))
      .toEqual(diffusion({ acteurProfil: 'gestionnaire', instructionReference: null, instructionRecueLe: null }))
  })
})
