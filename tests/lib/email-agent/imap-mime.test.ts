// @vitest-environment node
// Décodage des e-mails relevés en IMAP (lib/email-agent/imap/mime.ts) : mots encodés
// RFC 2047, quoted-printable, base64 tronqué, multipart imbriqué, HTML.

import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { analyserContentType, analyserEntetes, decoderCharset, decoderMotsEncodes, extraireCorpsTexte, htmlVersTexte } from '@/lib/email-agent/imap/mime'

const enc = new TextEncoder()
const b64 = (s: string) => btoa(String.fromCharCode(...enc.encode(s)))

describe('en-têtes', () => {
  it('mots encodés B et Q, jeux de caractères, mots adjacents réunis', () => {
    expect(decoderMotsEncodes('=?utf-8?q?R=C3=A9sidence_les_Pins?=')).toBe('Résidence les Pins')
    expect(decoderMotsEncodes('=?windows-1252?Q?Devis_=80_valider?=')).toBe('Devis € valider')
    expect(decoderMotsEncodes(`=?UTF-8?B?${b64('Relance ')}?=\r\n =?UTF-8?B?${b64('impayé')}?= (2e)`)).toBe('Relance impayé (2e)')
    expect(decoderMotsEncodes('Texte simple')).toBe('Texte simple')
  })

  it('lignes repliées, noms en minuscules, première occurrence gardée', () => {
    const e = analyserEntetes('Subject: une ligne\r\n  repliée\r\nFROM: a@b.fr\r\nSubject: autre\r\n')
    expect(e).toEqual({ subject: 'une ligne repliée', from: 'a@b.fr' })
  })

  it('Content-Type et paramètres', () => {
    expect(analyserContentType('Multipart/Mixed; boundary="=_abc"; charset=UTF-8')).toEqual({
      type: 'multipart/mixed', params: { boundary: '=_abc', charset: 'UTF-8' },
    })
    expect(analyserContentType(undefined).type).toBe('text/plain')
  })

  it('jeu de caractères inconnu → UTF-8', () => {
    expect(decoderCharset(enc.encode('été'), 'x-inconnu')).toBe('été')
  })
})

describe('corps', () => {
  it('base64 coupé en plein bloc (corps tronqué à 4000 octets) : début décodé', () => {
    const complet = b64('Bonjour, le chauffage est en panne depuis lundi.')
    const texte = extraireCorpsTexte({ 'content-type': 'text/plain; charset=utf-8', 'content-transfer-encoding': 'base64' }, enc.encode(complet.slice(0, 30)), 1000)
    expect('Bonjour, le chauffage est en panne depuis lundi.'.startsWith(texte)).toBe(true)
    expect(texte.length).toBeGreaterThan(15)
  })

  it('multipart/mixed > multipart/alternative : text/plain choisi, pièce jointe ignorée', () => {
    const corps = [
      'Ceci est un message MIME.',
      '--ext',
      'Content-Type: multipart/alternative; boundary="int"',
      '',
      '--int',
      'Content-Type: text/html; charset=utf-8',
      '',
      '<p>Version HTML</p>',
      '--int',
      'Content-Type: text/plain; charset="iso-8859-1"',
      'Content-Transfer-Encoding: quoted-printable',
      '',
      'Merci de r=E9gler l\'appel de fonds.',
      '--int--',
      '--ext',
      'Content-Type: application/pdf; name="appel.pdf"',
      'Content-Transfer-Encoding: base64',
      '',
      'JVBERi0xLjQK',
      '--ext--',
    ].join('\r\n')
    expect(extraireCorpsTexte({ 'content-type': 'multipart/mixed; boundary=ext' }, enc.encode(corps), 1000)).toBe('Merci de régler l\'appel de fonds.')
  })

  it('HTML seul : texte nettoyé ; longueur bornée', () => {
    const html = '<div>Bonjour&nbsp;Madame,</div><div>Le <a href="https://x.fr">devis</a> est joint.<br>Cordialement</div><script>alert(1)</script>&#128512;&#9999999;'
    expect(htmlVersTexte(html).replace(/\s+/g, ' ').trim()).toBe('Bonjour Madame, Le devis est joint. Cordialement 😀')
    expect(extraireCorpsTexte({ 'content-type': 'text/html' }, enc.encode(html), 10)).toBe('Bonjour Ma')
  })

  it('multipart sans partie texte → chaîne vide', () => {
    const corps = '--b\r\nContent-Type: image/png\r\n\r\niVBORw0KGgo=\r\n--b--'
    expect(extraireCorpsTexte({ 'content-type': 'multipart/mixed; boundary=b' }, enc.encode(corps), 1000)).toBe('')
  })
})
