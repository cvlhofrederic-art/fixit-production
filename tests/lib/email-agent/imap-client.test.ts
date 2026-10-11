// @vitest-environment node
// Client IMAP minimal d'Alfredo (lib/email-agent/imap/client.ts) contre un serveur simulé :
// littéraux {n} (y compris coupés en plein caractère UTF-8), AUTHENTICATE PLAIN / LOGIN,
// lecture seule (EXAMINE + BODY.PEEK), refus d'identifiants, délai, 20 e-mails au plus.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { logger } from '@/lib/logger'
import {
  ErreurImap,
  analyserFetch,
  analyserInternalDate,
  dateImap,
  hoteImapValide,
  ouvrirSocketTls,
  releverBoiteImap,
  testerConnexionImap,
  type TransportImap,
} from '@/lib/email-agent/imap/client'

const enc = new TextEncoder()
const dec = new TextDecoder()

type Repondre = (ligne: string, envoyer: (s: string) => void) => void

/**
 * Serveur IMAP simulé : accueil, puis une réponse par ligne reçue (repondre). Les octets
 * sont livrés par paquets de `paquet` octets pour éprouver la lecture des littéraux.
 */
function serveur(accueil: string | null, repondre: Repondre, paquet = 0) {
  const recues: string[] = []
  let controleur!: ReadableStreamDefaultController<Uint8Array>
  let ferme = false
  const envoyer = (s: string) => {
    if (ferme) return
    const octets = enc.encode(s)
    if (!paquet) return controleur.enqueue(octets)
    for (let i = 0; i < octets.length; i += paquet) controleur.enqueue(octets.slice(i, i + paquet))
  }
  let tampon = ''
  const transport: TransportImap = {
    readable: new ReadableStream<Uint8Array>({
      start(c) {
        controleur = c
        if (accueil !== null) envoyer(accueil)
      },
    }),
    writable: new WritableStream<Uint8Array>({
      write(chunk) {
        tampon += dec.decode(chunk)
        let i = tampon.indexOf('\r\n')
        while (i >= 0) {
          const ligne = tampon.slice(0, i)
          tampon = tampon.slice(i + 2)
          recues.push(ligne)
          repondre(ligne, envoyer)
          i = tampon.indexOf('\r\n')
        }
      },
    }),
    close: vi.fn(async () => {
      if (!ferme) {
        ferme = true
        controleur.close()
      }
    }),
  }
  return { transport, recues, ouvrir: vi.fn(async () => transport) }
}

const PARAMS = { hote: 'ssl0.ovh.net', port: 993, utilisateur: 'gestion@cabinet-exemple.fr', motDePasse: 'S3cret"\\pass' }

/** Littéral IMAP : {n} + CRLF + octets (n compté en octets UTF-8). */
const lit = (s: string) => `{${enc.encode(s).length}}\r\n${s}`

const ENTETES_7 = 'From: =?ISO-8859-1?Q?Mme_B=E9atrice_Rou=E9?= <beatrice.roue@example.fr>\r\nSubject: =?UTF-8?B?RnVpdGUgZCdlYXUg?= =?UTF-8?B?w6AgbGEgY2F2ZQ==?=\r\nMessage-ID: <abc123@mail.example.fr>\r\nContent-Type: text/plain; charset=iso-8859-1\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\n'
const CORPS_7 = 'Bonjour,\r\nIl y a une fuite d=E9j=E0 signal=E9e au sous-sol, merci d\'interven=\r\nir.\r\n'
const ENTETES_9 = 'From: "Syndic, Conseil" <conseil@residence.fr>\r\nSubject: Assemblée générale — ordre du jour\r\nMessage-ID: <ag-2026@residence.fr>\r\nContent-Type: multipart/alternative; boundary="b1"\r\n\r\n'
const CORPS_9 = `--b1\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${btoa(String.fromCharCode(...enc.encode('Voici l\'ordre du jour : élection du conseil syndical.')))}\r\n--b1\r\nContent-Type: text/html; charset=utf-8\r\n\r\n<p>HTML</p>\r\n--b1--\r\n`
const ENTETES_12 = 'From: alerte@ascenseurs.fr\r\nSubject: Panne ascenseur\r\nContent-Type: text/html; charset=utf-8\r\n\r\n'
const CORPS_12 = '<html><head><style>p{color:red}</style></head><body><p>L&#39;ascenseur du b&acirc;timent&nbsp;B est <b>bloqué</b>.</p></body></html>'

function serveurComplet(paquet = 0, capacites = 'IMAP4rev1 SASL-IR AUTH=PLAIN') {
  return serveur(`* OK [CAPABILITY ${capacites}] Dovecot ready.\r\n`, (ligne, envoyer) => {
    const [tag, ...reste] = ligne.split(' ')
    const cmd = reste.join(' ')
    if (cmd.startsWith('AUTHENTICATE PLAIN ')) return envoyer(`${tag} OK [CAPABILITY IMAP4rev1] Logged in\r\n`)
    if (cmd === 'EXAMINE INBOX') {
      return envoyer(`* FLAGS (\\Answered \\Seen)\r\n* 3 EXISTS\r\n* OK [UIDVALIDITY 42] UIDs valid\r\n${tag} OK [READ-ONLY] Examine completed\r\n`)
    }
    if (cmd.startsWith('UID SEARCH SINCE ')) return envoyer(`* SEARCH 7 9 12\r\n${tag} OK Search completed\r\n`)
    if (cmd.startsWith('UID FETCH ')) {
      return envoyer(
        `* 1 FETCH (UID 7 INTERNALDATE "09-Oct-2026 08:15:00 +0200" BODY[HEADER.FIELDS (FROM SUBJECT MESSAGE-ID CONTENT-TYPE CONTENT-TRANSFER-ENCODING)] ${lit(ENTETES_7)} BODY[TEXT]<0> ${lit(CORPS_7)})\r\n`
        + `* 2 FETCH (UID 9 INTERNALDATE "10-Oct-2026 18:00:00 +0000" BODY[HEADER.FIELDS ("FROM" "SUBJECT" "MESSAGE-ID" "CONTENT-TYPE" "CONTENT-TRANSFER-ENCODING")] ${lit(ENTETES_9)})\r\n`
        + `* 2 FETCH (BODY[TEXT]<0> ${lit(CORPS_9)} FLAGS (\\Seen))\r\n`
        + `* 3 FETCH (UID 12 INTERNALDATE " 1-Oct-2026 07:00:00 +0000" BODY[HEADER.FIELDS (FROM SUBJECT MESSAGE-ID CONTENT-TYPE CONTENT-TRANSFER-ENCODING)] ${lit(ENTETES_12)} BODY[TEXT]<0> "${CORPS_12.replace(/"/g, '\\"')}")\r\n`
        + `${tag} OK Fetch completed\r\n`,
      )
    }
    if (cmd === 'LOGOUT') return envoyer(`* BYE Logging out\r\n${tag} OK Logout completed\r\n`)
    envoyer(`${tag} BAD Commande inconnue\r\n`)
  }, paquet)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('releverBoiteImap', () => {
  it.each([0, 1, 5])('relève et décode les e-mails (paquets de %i octets)', async (paquet) => {
    const s = serveurComplet(paquet)
    const messages = await releverBoiteImap(
      PARAMS,
      { depuis: new Date('2026-09-11T10:00:00Z'), max: 20, longueurCorps: 1000 },
      { ouvrir: s.ouvrir },
    )

    expect(s.ouvrir).toHaveBeenCalledWith('ssl0.ovh.net', 993)
    expect(messages.map(m => m.id)).toEqual(['ag-2026@residence.fr', 'abc123@mail.example.fr', 'imap-42-12'])

    const [ag, fuite, ascenseur] = messages
    expect(fuite).toEqual({
      id: 'abc123@mail.example.fr',
      threadId: null,
      from: 'Mme Béatrice Roué <beatrice.roue@example.fr>',
      subject: 'Fuite d\'eau à la cave',
      bodyText: 'Bonjour,\nIl y a une fuite déjà signalée au sous-sol, merci d\'intervenir.',
      receivedAt: '2026-10-09T06:15:00.000Z',
    })
    expect(ag.from).toBe('"Syndic, Conseil" <conseil@residence.fr>')
    expect(ag.subject).toBe('Assemblée générale — ordre du jour')
    expect(ag.bodyText).toBe('Voici l\'ordre du jour : élection du conseil syndical.')
    expect(ag.receivedAt).toBe('2026-10-10T18:00:00.000Z')
    expect(ascenseur.from).toBe('alerte@ascenseurs.fr')
    expect(ascenseur.bodyText).toBe('L\'ascenseur du bâtiment B est bloqué.')

    // Lecture seule : EXAMINE (pas SELECT), BODY.PEEK (pas d'indicateur \Seen posé), aucun STORE.
    const commandes = s.recues.map(l => l.split(' ').slice(1).join(' '))
    expect(commandes[0]).toMatch(/^AUTHENTICATE PLAIN /)
    expect(commandes.slice(1)).toEqual([
      'EXAMINE INBOX',
      'UID SEARCH SINCE 11-Sep-2026',
      'UID FETCH 7,9,12 (UID INTERNALDATE BODY.PEEK[HEADER.FIELDS (FROM SUBJECT MESSAGE-ID CONTENT-TYPE CONTENT-TRANSFER-ENCODING)] BODY.PEEK[TEXT]<0.4000>)',
      'LOGOUT',
    ])
    expect(s.recues.some(l => /\b(SELECT|STORE|EXPUNGE|COPY|MOVE)\b/.test(l))).toBe(false)
    expect(s.transport.close).toHaveBeenCalled()
  })

  it('AUTHENTICATE PLAIN porte « \\0utilisateur\\0mot de passe » en base64 (UTF-8)', async () => {
    const s = serveurComplet()
    await releverBoiteImap({ ...PARAMS, motDePasse: 'pàss€' }, { depuis: new Date(), max: 20, longueurCorps: 1000 }, { ouvrir: s.ouvrir })
    const jeton = s.recues[0].split(' ')[3]
    const octets = Uint8Array.from(atob(jeton), c => c.charCodeAt(0))
    expect(dec.decode(octets)).toBe('\u0000gestion@cabinet-exemple.fr\u0000pàss€')
  })

  it('ne demande que les 20 e-mails les plus récents (UID les plus hauts)', async () => {
    const uids = Array.from({ length: 25 }, (_, i) => i + 100)
    let fetch = ''
    const s = serveur('* OK [CAPABILITY IMAP4rev1 SASL-IR AUTH=PLAIN] pret\r\n', (ligne, envoyer) => {
      const [tag, cmd] = [ligne.split(' ')[0], ligne.split(' ').slice(1).join(' ')]
      if (cmd.startsWith('UID SEARCH')) return envoyer(`* SEARCH ${uids.join(' ')}\r\n${tag} OK\r\n`)
      if (cmd.startsWith('UID FETCH')) fetch = cmd
      envoyer(`${tag} OK\r\n`)
    })
    const messages = await releverBoiteImap(PARAMS, { depuis: new Date(), max: 20, longueurCorps: 1000 }, { ouvrir: s.ouvrir })
    expect(messages).toEqual([])
    expect(fetch.split(' ')[2]).toBe(uids.slice(-20).join(','))
  })

  it('boîte vide depuis la date : pas de FETCH', async () => {
    const s = serveur('* OK [CAPABILITY IMAP4rev1 SASL-IR AUTH=PLAIN] pret\r\n', (ligne, envoyer) => {
      const tag = ligne.split(' ')[0]
      if (ligne.includes('UID SEARCH')) return envoyer(`* SEARCH\r\n${tag} OK\r\n`)
      envoyer(`${tag} OK\r\n`)
    })
    expect(await releverBoiteImap(PARAMS, { depuis: new Date(), max: 20, longueurCorps: 1000 }, { ouvrir: s.ouvrir })).toEqual([])
    expect(s.recues.some(l => l.includes('FETCH'))).toBe(false)
  })
})

describe('authentification', () => {
  it('identifiants refusés → ErreurImap identifiants_refuses, connexion fermée, mot de passe jamais journalisé', async () => {
    const s = serveur('* OK [CAPABILITY IMAP4rev1 SASL-IR AUTH=PLAIN] pret\r\n', (ligne, envoyer) => {
      envoyer(`${ligne.split(' ')[0]} NO [AUTHENTICATIONFAILED] Authentication failed.\r\n`)
    })
    const err = await testerConnexionImap(PARAMS, { ouvrir: s.ouvrir }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ErreurImap)
    expect((err as ErreurImap).code).toBe('identifiants_refuses')
    expect((err as ErreurImap).message).not.toContain(PARAMS.motDePasse)
    expect((err as ErreurImap).detail).toContain('AUTHENTICATIONFAILED')
    expect(s.recues).toHaveLength(1) // ni EXAMINE ni rien d'autre après le refus
    expect(s.transport.close).toHaveBeenCalled()
    const journaux = JSON.stringify([vi.mocked(logger.debug).mock.calls, vi.mocked(logger.warn).mock.calls, vi.mocked(logger.error).mock.calls])
    expect(journaux).not.toContain('S3cret')
  })

  it('Gmail sans mot de passe d\'application → mot_de_passe_application', async () => {
    const s = serveur('* OK Gimap ready\r\n', (ligne, envoyer) => {
      const tag = ligne.split(' ')[0]
      if (ligne.endsWith('CAPABILITY')) return envoyer(`* CAPABILITY IMAP4rev1 AUTH=PLAIN AUTH=XOAUTH2 SASL-IR\r\n${tag} OK\r\n`)
      envoyer(`${tag} NO [ALERT] Application-specific password required: https://support.google.com/accounts/answer/185833 (Failure)\r\n`)
    })
    const err = await testerConnexionImap({ ...PARAMS, hote: 'imap.gmail.com' }, { ouvrir: s.ouvrir }).catch((e: unknown) => e)
    expect((err as ErreurImap).code).toBe('mot_de_passe_application')
    expect(s.recues[0]).toBe('A1 CAPABILITY')
  })

  it('Microsoft 365 en IMAP → microsoft_oauth (utiliser le bouton Outlook)', async () => {
    const s = serveur('* OK [CAPABILITY IMAP4rev1 AUTH=PLAIN AUTH=XOAUTH2 SASL-IR] Microsoft Exchange ready\r\n', (ligne, envoyer) => {
      envoyer(`${ligne.split(' ')[0]} NO AUTHENTICATE failed.\r\n`)
    })
    const err = await testerConnexionImap({ ...PARAMS, hote: 'outlook.office365.com' }, { ouvrir: s.ouvrir }).catch((e: unknown) => e)
    expect((err as ErreurImap).code).toBe('microsoft_oauth')
  })

  it('AUTHENTICATE PLAIN sans SASL-IR : jeton envoyé sur la demande de suite « + »', async () => {
    let attenteJeton = false
    const s = serveur('* OK [CAPABILITY IMAP4rev1 AUTH=PLAIN] pret\r\n', (ligne, envoyer) => {
      if (ligne === 'A1 AUTHENTICATE PLAIN') {
        attenteJeton = true
        return envoyer('+ \r\n')
      }
      if (attenteJeton) {
        attenteJeton = false
        return envoyer('A1 OK connecte\r\n')
      }
      envoyer(`${ligne.split(' ')[0]} OK\r\n`)
    })
    await testerConnexionImap(PARAMS, { ouvrir: s.ouvrir })
    expect(s.recues[0]).toBe('A1 AUTHENTICATE PLAIN')
    expect(dec.decode(Uint8Array.from(atob(s.recues[1]), c => c.charCodeAt(0)))).toBe('\u0000gestion@cabinet-exemple.fr\u0000S3cret"\\pass')
    expect(s.recues[2]).toBe('A2 EXAMINE INBOX')
  })

  it('sans AUTH=PLAIN : LOGIN avec chaînes échappées', async () => {
    const s = serveur('* OK [CAPABILITY IMAP4rev1] pret\r\n', (ligne, envoyer) => envoyer(`${ligne.split(' ')[0]} OK\r\n`))
    await testerConnexionImap(PARAMS, { ouvrir: s.ouvrir })
    expect(s.recues[0]).toBe('A1 LOGIN "gestion@cabinet-exemple.fr" "S3cret\\"\\\\pass"')
  })

  it('LOGIN avec un mot de passe accentué : littéral synchronisé (attente du « + »)', async () => {
    let attenteLitteral = false
    const s = serveur('* OK [CAPABILITY IMAP4rev1] pret\r\n', (ligne, envoyer) => {
      if (ligne.endsWith('}')) {
        attenteLitteral = true
        return envoyer('+ Ready for literal data\r\n')
      }
      if (attenteLitteral) {
        attenteLitteral = false
        return envoyer('A1 OK connecte\r\n')
      }
      envoyer(`${ligne.split(' ')[0]} OK\r\n`)
    })
    await testerConnexionImap({ ...PARAMS, motDePasse: 'été2026' }, { ouvrir: s.ouvrir })
    expect(s.recues[0]).toBe(`A1 LOGIN "gestion@cabinet-exemple.fr" {${enc.encode('été2026').length}}`)
    expect(s.recues[1]).toBe('été2026')
  })

  it('serveur sans authentification par mot de passe (LOGINDISABLED) → erreur explicite, rien envoyé', async () => {
    const s = serveur('* OK [CAPABILITY IMAP4rev1 LOGINDISABLED AUTH=XOAUTH2] pret\r\n', (ligne, envoyer) => envoyer(`${ligne.split(' ')[0]} OK\r\n`))
    const err = await testerConnexionImap(PARAMS, { ouvrir: s.ouvrir }).catch((e: unknown) => e)
    expect((err as ErreurImap).code).toBe('authentification_non_prise_en_charge')
    expect(s.recues).toEqual([])
  })

  it('outlook.office365.com (capacités relevées le 11/10/2026 : OAuth seulement) → microsoft_oauth', async () => {
    const s = serveur('* OK The Microsoft Exchange IMAP4 service is ready.\r\n', (ligne, envoyer) => {
      const tag = ligne.split(' ')[0]
      envoyer(`* CAPABILITY IMAP4 IMAP4rev1 AUTH=XOAUTH2 LOGINDISABLED SASL-IR UIDPLUS MOVE ID UNSELECT CHILDREN IDLE NAMESPACE LITERAL+\r\n${tag} OK CAPABILITY completed.\r\n`)
    })
    const err = await testerConnexionImap({ ...PARAMS, hote: 'outlook.office365.com' }, { ouvrir: s.ouvrir }).catch((e: unknown) => e)
    expect((err as ErreurImap).code).toBe('microsoft_oauth')
    expect(s.recues).toEqual(['A1 CAPABILITY'])
  })

  it('boîte de réception refusée → boite_inaccessible', async () => {
    const s = serveur('* OK [CAPABILITY IMAP4rev1 SASL-IR AUTH=PLAIN] pret\r\n', (ligne, envoyer) => {
      const tag = ligne.split(' ')[0]
      envoyer(ligne.includes('EXAMINE') ? `${tag} NO Mailbox doesn't exist\r\n` : `${tag} OK\r\n`)
    })
    const err = await testerConnexionImap(PARAMS, { ouvrir: s.ouvrir }).catch((e: unknown) => e)
    expect((err as ErreurImap).code).toBe('boite_inaccessible')
  })
})

describe('connexion', () => {
  it('accueil BYE → serveur_injoignable', async () => {
    const s = serveur('* BYE Too many connections\r\n', () => undefined)
    const err = await testerConnexionImap(PARAMS, { ouvrir: s.ouvrir }).catch((e: unknown) => e)
    expect((err as ErreurImap).code).toBe('serveur_injoignable')
  })

  it('serveur muet → delai_depasse, connexion fermée', async () => {
    const s = serveur(null, () => undefined)
    const err = await testerConnexionImap(PARAMS, { ouvrir: s.ouvrir, delaiMs: 50 }).catch((e: unknown) => e)
    expect((err as ErreurImap).code).toBe('delai_depasse')
    expect(s.transport.close).toHaveBeenCalled()
  })

  it('connexion TLS refusée (opened rejeté) → serveur_injoignable', async () => {
    const s = serveur(null, () => undefined)
    const opened = Promise.reject(new Error('connection refused'))
    const err = await testerConnexionImap(PARAMS, { ouvrir: async () => ({ ...s.transport, opened }) }).catch((e: unknown) => e)
    expect((err as ErreurImap).code).toBe('serveur_injoignable')
    expect((err as ErreurImap).detail).toBe('connection refused')
  })

  it('hors Worker (Node) : sockets indisponibles → imap_indisponible', async () => {
    const err = await ouvrirSocketTls('ssl0.ovh.net', 993).catch((e: unknown) => e)
    expect((err as ErreurImap).code).toBe('imap_indisponible')
  })
})

describe('utilitaires', () => {
  it('analyserFetch : littéraux, chaînes, NIL, sections entre crochets', () => {
    const corps = enc.encode('Café ☕')
    const f = analyserFetch(['* 4 FETCH (UID 99 FLAGS (\\Seen) BODY[HEADER.FIELDS (SUBJECT)] ', enc.encode('Subject: x\r\n\r\n'), ' BODY[TEXT]<0> ', corps, ' INTERNALDATE NIL)'])
    expect(f?.seq).toBe(4)
    expect(f?.donnees.uid).toBe(99)
    expect(dec.decode(f?.donnees.entetes)).toBe('Subject: x\r\n\r\n')
    expect(f?.donnees.corps).toBe(corps)
    expect(f?.donnees.internalDate).toBeUndefined()
    expect(analyserFetch(['* 3 EXISTS'])).toBeNull()
  })

  it('dates IMAP', () => {
    expect(dateImap(new Date('2026-10-01T23:30:00Z'))).toBe('1-Oct-2026')
    expect(analyserInternalDate('17-Jul-1996 02:44:25 -0700')?.toISOString()).toBe('1996-07-17T09:44:25.000Z')
    expect(analyserInternalDate('n importe quoi')).toBeNull()
  })

  it('hôtes acceptés : noms DNS complets seulement', () => {
    for (const h of ['ssl0.ovh.net', 'mail.infomaniak.com', 'imap.mail.me.com', 'mail.cabinet-exemple.fr']) expect(hoteImapValide(h)).toBe(true)
    for (const h of ['localhost', '127.0.0.1', '10.0.0.1', '[::1]', 'imap', 'a b.fr', 'mail.exemple.fr:993', '-x.fr', 'x.1']) expect(hoteImapValide(h)).toBe(false)
  })
})
