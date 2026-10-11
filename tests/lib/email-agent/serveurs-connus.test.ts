// Pré-remplissage du serveur IMAP depuis le domaine de l'adresse (formulaire « Autre
// messagerie (IMAP) » du Syndic v54) et repérage des adresses Microsoft.

import { describe, it, expect } from 'vitest'
import { SERVEURS_HEBERGEURS, estAdresseMicrosoft, serveurImapSuggere } from '@/lib/email-agent/imap/serveurs-connus'
import { hoteImapValide } from '@/lib/email-agent/imap/hote'

describe('serveurs IMAP connus', () => {
  it.each([
    ['cabinet@gmail.com', 'imap.gmail.com'],
    ['Cabinet@ICLOUD.com', 'imap.mail.me.com'],
    ['x@yahoo.fr', 'imap.mail.yahoo.com'],
    ['x@orange.fr', 'imap.orange.fr'],
    ['x@free.fr', 'imap.free.fr'],
    ['h.carvalho@ajassocies.fr', null],
    ['pas-une-adresse', null],
  ])('%s → %s', (email, attendu) => {
    expect(serveurImapSuggere(email)).toBe(attendu)
  })

  it('adresses Microsoft grand public repérées (bouton Outlook)', () => {
    for (const e of ['a@outlook.fr', 'a@hotmail.com', 'a@live.fr', 'a@msn.com']) expect(estAdresseMicrosoft(e)).toBe(true)
    for (const e of ['a@gmail.com', 'a@ajassocies.fr', 'a@outlook-conseil.fr']) expect(estAdresseMicrosoft(e)).toBe(false)
  })

  it('suggestions d’hébergeurs : noms d’hôte valides pour la route', () => {
    for (const s of SERVEURS_HEBERGEURS) expect(hoteImapValide(s.hote)).toBe(true)
  })
})
