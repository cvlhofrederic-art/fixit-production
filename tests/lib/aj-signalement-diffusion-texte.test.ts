// tests/lib/aj-signalement-diffusion-texte.test.ts
//
// PR 3 (diffusion aux déclarants), lot 2 — garantie technique « pas de promotion » (cahier § 5.3, § 10.1, décision H2
// de Hugo du 11/11/2026) et modèles (§ 5.4, H3 ; message d'annonce figé, H1 option C) :
//   - refusés : liens (schémas, « www. », nom de domaine pour TOUS les domaines de premier niveau de l'IANA, y compris
//     écrits en pleine chasse ou avec un point idéographique), adresses e-mail, caractères des catégories Unicode Cc,
//     Cf, Zl et Zp (contrôles, invisibles), champ de modèle non rempli, termes commerciaux (dont « VitFix », « offre »,
//     « devis »), numéros de téléphone non déclarés par le cabinet ;
//   - acceptés : « remise en eau », « nous vous recommandons », « bât.B », un numéro déclaré, dates et heures ;
//   - bornes (objet 3-120, texte 10-2000 et 30 lignes, libellé 1-50), forme NFC ;
//   - la liste IANA du dépôt contient immo, paris, bzh, fr.

import { describe, it, expect } from 'vitest'
import {
  BORNES_TEXTE_DIFFUSION_QR, controlerTexteDiffusionQr, estTldIanaQr, normaliserTelephoneDeclareQr,
  type MotifRefusTexteDiffusionQr,
} from '@/lib/aj-signalement/diffusion-texte'
import {
  DATE_TELECHARGEMENT_TLD_IANA, SOURCE_TLD_IANA, TLD_IANA, TLD_IANA_UNICODE, VERSION_TLD_IANA,
} from '@/lib/aj-signalement/tld-iana'
import {
  DELAI_ANNONCE_DIFFUSION_JOURS, MESSAGES_REFUS_TEXTE_DIFFUSION_QR, MODELES_DIFFUSION_QR, MODELES_SELECTEUR_DIFFUSION_QR,
  NOMS_MODELES_DIFFUSION_QR, TEXTES_MODELES_DIFFUSION_QR, annonceDiffusionQr, estAnnonceFigeeQr,
} from '@/lib/aj-signalement/affichage-diffusion'

const motif = (texte: string, telephonesAutorises: readonly string[] = []): MotifRefusTexteDiffusionQr | 'ok' => {
  const r = controlerTexteDiffusionQr(texte, { telephonesAutorises })
  return r.ok ? 'ok' : r.motif
}

describe('liens refusés', () => {
  it.each([
    'Voir https://exemple.test/page', 'Voir http:exemple', 'Voir ftp://depot', 'Écrire mailto:x', 'Appeler tel:0612345678',
    'Voir www.exemple', 'Voir WWW.exemple', 'Voir exemple.fr ce soir', 'Voir exemple.immo ce soir',
    'Voir exemple。fr ce soir', 'Voir ＥＸＥＭＰＬＥ．ＦＲ ce soir', 'Voir exemple．fr ce soir', 'Voir exemple｡fr ce soir',
    'Voir exemple.paris ce soir', 'Voir exemple.bzh ce soir', 'Voir sous.exemple.fr.', 'Voir exemple.fr.Merci',
    'Voir пример.рф ce soir', 'Voir exemple.xn--p1ai ce soir', 'Voir exemple.FR ce soir', 'Voir exemple\uFE0F.fr ce soir',
  ])('« %s » → lien', (texte) => {
    expect(motif(texte)).toBe('lien')
  })
  it('« demain.Total » (un mot accolé après un point est un domaine) : refusé avec le conseil d’espace', () => {
    const r = controlerTexteDiffusionQr('Coupure demain.Total des logements concernés.')
    expect(r).toMatchObject({ ok: false, motif: 'lien', conseil: 'espace_apres_point' })
    expect(controlerTexteDiffusionQr('Coupure demain. Total des logements concernés.').ok).toBe(true)
  })
  it('« bât.B » passe (une lettre n’est pas un domaine), comme les heures et abréviations courantes', () => {
    for (const texte of ['Accès par le bât.B ce matin.', 'Rendez-vous à 10.30 dans le hall.', 'Rez-de-chaussée, esc.A, n.º 3, etc.'])
      expect(motif(texte)).toBe('ok')
  })
})

describe('adresses e-mail, caractères, champs à compléter', () => {
  it.each(['Écrire à gardien@exemple', 'Écrire à gardien＠exemple', 'Un @ seul suffit'])('« %s » → adresse_email', (texte) => {
    expect(motif(texte)).toBe('adresse_email')
  })
  it.each([
    ['U+200B (Cf)', 'Voir exem\u200Bple.fr ce soir'], ['U+00AD (Cf)', 'Voir exem\u00ADple.fr ce soir'],
    ['U+2028 (Zl)', 'Première ligne\u2028seconde'], ['U+2029 (Zp)', 'Premier paragraphe\u2029second'],
    ['U+061C (Cf)', 'Texte \u061C avec marque'], ['U+0085 (Cc, C1)', 'Texte \u0085 avec contrôle'],
    ['U+009B (Cc, C1)', 'Texte \u009b avec contrôle'], ['U+0007 (Cc, C0)', 'Texte \u0007 avec contrôle'],
    ['tabulation (Cc)', 'Texte\tavec tabulation'], ['U+FEFF (Cf)', '\uFEFFTexte avec marque'], ['U+202E (Cf)', 'Texte \u202E inversé'],
    ['U+3164 (invisible)', 'Texte \u3164 avec remplissage'],
  ])('%s → caractere', (_nom, texte) => {
    expect(motif(texte)).toBe('caractere')
  })
  it('le texte garde les retours à la ligne ; l’objet et le libellé n’en ont aucun', () => {
    expect(motif('Première ligne\nseconde ligne')).toBe('ok')
    expect(controlerTexteDiffusionQr('Objet\nsur deux lignes', { nature: 'objet' })).toMatchObject({ ok: false, motif: 'caractere' })
    expect(controlerTexteDiffusionQr('B\nC', { nature: 'libelle' })).toMatchObject({ ok: false, motif: 'caractere' })
  })
  it.each(['Coupure le [date] à 9h', 'Coupure le ［date］ à 9h', 'Coupure le 12/11 [heure de début]'])('« %s » → a_completer', (texte) => {
    expect(motif(texte)).toBe('a_completer')
  })
})

describe('termes commerciaux (liste H2, mots entiers, sans accents ni casse)', () => {
  it.each([
    'Grande promo ce mois', 'Entretien Gratuit demain', 'Participation de 20 € par lot', 'Remise de -30 % sur la pose',
    'Remise de −30% sur la pose', 'Rendez-vous sur VitFix', 'Demandez un devis au gardien', 'Découvrez notre offre',
    'Profitez des soldes', 'Un bon plan pour vous', 'Nos services sont là', 'Un code promo existe', 'Notre partenaire passe',
    'Service payant à 10 euros', 'Nouvel abonnement proposé', 'Peça um orçamento hoje', 'Aproveite o desconto',
    'Serviço grátis amanhã', 'Uma oferta especial', 'Os nossos serviços estão aqui', 'O nosso parceiro passa',
    'Réduction pour les résidents', 'Parrainage des voisins',
  ])('« %s » → terme_commercial', (texte) => {
    expect(motif(texte)).toBe('terme_commercial')
  })
  it.each([
    'Remise en eau à 10h.', 'Nous vous recommandons de fermer vos robinets.', 'Le solde des travaux reste à voter.',
    'Taux d’humidité relevé : 80 %.', 'L’ascenseur est remis en service.', 'Merci de laisser l’accès aux compteurs.',
    'Desligue o quadro elétrico antes das 9h.',
  ])('« %s » → accepté', (texte) => {
    expect(motif(texte)).toBe('ok')
  })
})

describe('numéros de téléphone : seulement ceux déclarés par le cabinet (H2)', () => {
  const DECLARES = ['0612345678', '351912345678']
  it('« Pour un plombier, appelez Dupont au 06 12 34 56 78 » (numéro non déclaré) → telephone', () => {
    expect(motif('Pour un plombier, appelez Dupont au 06 12 34 56 78', ['0145454545'])).toBe('telephone')
    expect(motif('Pour un plombier, appelez Dupont au 06 12 34 56 78')).toBe('telephone')
  })
  it.each([
    'Astreinte : 06 12 34 56 78.', 'Astreinte : 0612345678.', 'Astreinte : 06.12.34.56.78.', 'Astreinte : 06-12-34-56-78.',
    'Astreinte : +33 6 12 34 56 78.', 'Astreinte : +33 (0)6 12 34 56 78.', 'Astreinte : 0033 6 12 34 56 78.',
    'Tél : 06 12 34 56 78', 'Tél: 06 12 34 56 78', 'Tél:06 12 34 56 78', 'Linha de piquete: 912 345 678', 'Linha de piquete: +351 912 345 678',
    'Astreinte au 06 12 34 56 78 24 h sur 24.', 'Code 1234 puis 06 12 34 56 78.',
  ])('numéro déclaré accepté sous toutes ses écritures : « %s »', (texte) => {
    expect(motif(texte, DECLARES)).toBe('ok')
  })
  it.each([
    'Appelez le 06 98 76 54 32.', 'Appelez le 0698765432.', 'Ligue 913 345 678.', 'Appelez le +44 20 7946 0958.',
    'Appelez le ０６ ９８ ７６ ５４ ３２.', 'Appelez le ٠٦٩٨٧٦٥٤٣٢.', 'Appelez le 123456.',
  ])('numéro non déclaré refusé : « %s »', (texte) => {
    expect(motif(texte, DECLARES)).toBe('telephone')
  })
  it.each([
    'Coupure le 12/11/2026 de 9h à 10h30.', 'Coupure le 12.11.2026 de 9h30 à 10h.', 'Coupure le 12-11-2026, de 14:30 à 16:00.',
    'Le 2026-11-12 à 14:30.', 'Saison de chauffe 2026-2027.', 'Le 12.11.2026 10.30 dans le hall.', 'Entre 10.30 et 11.45.',
    'Coupure de 9 h à 10 h le 12 novembre 2026.', 'Code du local : 1234.', 'Il reste 15 jours.',
  ])('dates, heures et petits nombres acceptés : « %s »', (texte) => {
    expect(motif(texte)).toBe('ok')
  })
})

describe('normaliserTelephoneDeclareQr : forme gardée sur le cabinet (chiffres seuls, 6 à 15)', () => {
  it.each([
    ['06 12 34 56 78', '0612345678'], ['06.12.34.56.78', '0612345678'], ['+33 6 12 34 56 78', '33612345678'],
    ['+33 (0)6 12 34 56 78', '33612345678'], ['0033 6 12 34 56 78', '33612345678'], ['+351 912 345 678', '351912345678'],
    ['912-345-678', '912345678'],
  ])('« %s » → %s', (saisie, forme) => {
    expect(normaliserTelephoneDeclareQr(saisie)).toBe(forme)
  })
  it.each(['12345', 'abc', '+33', '1234567890123456', '06 12 34 56 78 ou 01'])('« %s » → null', (saisie) => {
    expect(normaliserTelephoneDeclareQr(saisie)).toBeNull()
  })
  it('un numéro déclaré sous une forme est reconnu sous les autres dans le texte', () => {
    const declare = normaliserTelephoneDeclareQr('+33 6 12 34 56 78') ?? ''
    expect(motif('Astreinte : 06 12 34 56 78.', [declare])).toBe('ok')
  })
})

describe('bornes et forme', () => {
  const { objet, texte, libelle } = BORNES_TEXTE_DIFFUSION_QR
  it('bornes du cahier (§ 5.3) et du schéma de la route', () => {
    expect(objet).toEqual({ min: 3, max: 120, lignes: 1 })
    expect(texte).toEqual({ min: 10, max: 2000, lignes: 30 })
    expect(libelle).toEqual({ min: 1, max: 50, lignes: 1 })
  })
  it('texte : 10 à 2 000 caractères, 30 lignes au plus', () => {
    expect(motif('a'.repeat(9))).toBe('longueur')
    expect(motif('a'.repeat(10))).toBe('ok')
    expect(motif('a'.repeat(2000))).toBe('ok')
    expect(motif('a'.repeat(2001))).toBe('longueur')
    expect(motif(Array.from({ length: 30 }, () => 'ligne').join('\n'))).toBe('ok')
    expect(motif(Array.from({ length: 31 }, () => 'ligne').join('\n'))).toBe('lignes')
  })
  it('objet : 3 à 120 caractères ; libellé : 1 à 50', () => {
    const o = (t: string) => controlerTexteDiffusionQr(t, { nature: 'objet' })
    expect(o('ab')).toMatchObject({ ok: false, motif: 'longueur' })
    expect(o('abc').ok).toBe(true)
    expect(o('a'.repeat(120)).ok).toBe(true)
    expect(o('a'.repeat(121))).toMatchObject({ ok: false, motif: 'longueur' })
    const l = (t: string) => controlerTexteDiffusionQr(t, { nature: 'libelle' })
    expect(l('B').ok).toBe(true)
    expect(l('b'.repeat(51))).toMatchObject({ ok: false, motif: 'longueur' })
  })
  it('libellé : lettres, chiffres et ponctuation simple seulement (« B !!! » refusé)', () => {
    const l = (t: string) => controlerTexteDiffusionQr(t, { nature: 'libelle' })
    for (const ok of ['Bât. B', 'Bloco 2-A', 'Résidence l’Orée (est)', '3e étage', '4.º andar']) expect(l(ok).ok).toBe(true)
    for (const non of ['B !!!', 'B ⚠ URGENT', 'B *', 'B #1', 'B ?']) expect(l(non)).toMatchObject({ ok: false, motif: 'caractere' })
  })
  it('les longueurs se comptent en caractères (points de code), comme char_length en base', () => {
    expect(motif('😀'.repeat(10))).toBe('ok')
    expect(motif('😀'.repeat(9))).toBe('longueur')
  })
  it('NFC : un texte décomposé est accepté et rendu composé ; les bornes valent sur la forme NFC', () => {
    const r = controlerTexteDiffusionQr('Le café du hall est fermé ce matin.')
    expect(r).toEqual({ ok: true, texte: 'Le café du hall est fermé ce matin.' })
    expect(motif('é'.repeat(2000))).toBe('ok')
  })
  it('retours « \\r\\n » ramenés à « \\n », blancs de tête et de fin retirés', () => {
    expect(controlerTexteDiffusionQr('  Première ligne\r\nseconde ligne  ')).toEqual({ ok: true, texte: 'Première ligne\nseconde ligne' })
  })
})

describe('liste des domaines de premier niveau de l’IANA (fichier de données du dépôt)', () => {
  it('source, version et date de téléchargement', () => {
    expect(SOURCE_TLD_IANA).toBe('https://data.iana.org/TLD/tlds-alpha-by-domain.txt')
    expect(VERSION_TLD_IANA).toMatch(/^\d{10}$/)
    expect(DATE_TELECHARGEMENT_TLD_IANA).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
  it('contient immo, paris, bzh, fr, et la liste complète (plus de 1 400 domaines), sans doublon', () => {
    for (const tld of ['immo', 'paris', 'bzh', 'fr', 'total', 'xn--p1ai']) expect(TLD_IANA).toContain(tld)
    expect(TLD_IANA.length).toBeGreaterThan(1400)
    expect(new Set(TLD_IANA).size).toBe(TLD_IANA.length)
    expect(TLD_IANA.every((t) => /^[a-z0-9-]+$/.test(t))).toBe(true)
  })
  it('chaque domaine internationalisé a sa forme Unicode', () => {
    const idn = TLD_IANA.filter((t) => t.startsWith('xn--'))
    expect(Object.keys(TLD_IANA_UNICODE).sort()).toEqual([...idn].sort())
    expect(TLD_IANA_UNICODE['xn--p1ai']).toBe('рф')
  })
  it('estTldIanaQr : forme ASCII ou Unicode, sans casse ; une lettre seule n’en est jamais un', () => {
    expect(estTldIanaQr('fr')).toBe(true)
    expect(estTldIanaQr('IMMO')).toBe(true)
    expect(estTldIanaQr('рф')).toBe(true)
    expect(estTldIanaQr('b')).toBe(false)
    expect(estTldIanaQr('batiment')).toBe(false)
  })
})

describe('modèles (§ 5.4, décision H3)', () => {
  const remplir = (t: string) => t.replace(/\[[^\]]*\]/g, 'x')

  it('liste fermée des modèles, dont « ascenseur à l’arrêt » (H3) et l’annonce (H1)', () => {
    expect(MODELES_DIFFUSION_QR).toEqual(['libre', 'fuite', 'coupure_eau', 'coupure_electricite', 'intervention', 'fin_incident', 'ascenseur_arret', 'annonce'])
    // L'annonce n'est pas dans le sélecteur ordinaire (bouton dédié sur la carte, § 5.4).
    expect(MODELES_SELECTEUR_DIFFUSION_QR).toEqual(['fuite', 'coupure_eau', 'coupure_electricite', 'intervention', 'ascenseur_arret', 'fin_incident', 'libre'])
    expect(NOMS_MODELES_DIFFUSION_QR).toMatchObject({
      fuite: 'Fuite en cours', coupure_eau: 'Coupure d’eau', coupure_electricite: 'Coupure d’électricité',
      intervention: 'Intervention programmée', fin_incident: 'Fin d’incident', ascenseur_arret: 'Ascenseur à l’arrêt', libre: 'Message libre',
    })
  })
  it('textes FR du cahier', () => {
    expect(TEXTES_MODELES_DIFFUSION_QR.fuite.fr).toEqual({
      objet: 'Fuite en cours — [lieu]',
      texte: 'Une fuite d’eau est en cours [lieu : bâtiment, étage, parties communes]. Une intervention est organisée. [Consigne : merci de ne pas utiliser…, de laisser l’accès…]. Nous vous informerons de la fin de l’incident.',
    })
    expect(TEXTES_MODELES_DIFFUSION_QR.coupure_eau.fr).toEqual({
      objet: 'Coupure d’eau le [date] de [heure] à [heure]',
      texte: 'L’eau sera coupée le [date], de [heure de début] à [heure de fin], [périmètre], pour [motif]. Pensez à faire une réserve d’eau et à fermer vos robinets pendant la coupure.',
    })
    expect(TEXTES_MODELES_DIFFUSION_QR.coupure_electricite.fr).toEqual({
      objet: 'Coupure d’électricité le [date] de [heure] à [heure]',
      texte: 'L’électricité sera coupée le [date], de [heure de début] à [heure de fin], [périmètre], pour [motif]. L’ascenseur et l’éclairage des parties communes ne fonctionneront pas pendant la coupure.',
    })
    expect(TEXTES_MODELES_DIFFUSION_QR.intervention.fr).toEqual({
      objet: 'Intervention le [date] — [objet de l’intervention]',
      texte: 'Une intervention [objet : entretien de l’ascenseur, ramonage…] aura lieu le [date], de [heure de début] à [heure de fin], [lieu]. [Consigne : accès aux logements nécessaire / aucune démarche de votre part.]',
    })
    expect(TEXTES_MODELES_DIFFUSION_QR.fin_incident.fr).toEqual({
      objet: 'Fin de l’incident — [objet]',
      texte: 'L’incident [objet] est terminé. [Précision éventuelle.] Merci de votre patience.',
    })
    expect(TEXTES_MODELES_DIFFUSION_QR.ascenseur_arret.fr.objet).toBe('Ascenseur à l’arrêt — [bâtiment]')
  })
  it('chaque modèle FR et PT : des champs à remplir, refusés tels quels, acceptés une fois remplis', () => {
    for (const [nom, bilingue] of Object.entries(TEXTES_MODELES_DIFFUSION_QR)) {
      for (const langue of ['fr', 'pt'] as const) {
        const { objet, texte } = bilingue[langue]
        expect(texte, `${nom} ${langue}`).toMatch(/\[[^\]]+\]/)
        expect(controlerTexteDiffusionQr(texte)).toMatchObject({ ok: false, motif: 'a_completer' })
        expect(controlerTexteDiffusionQr(remplir(objet), { nature: 'objet' }).ok, `${nom} ${langue} objet`).toBe(true)
        expect(controlerTexteDiffusionQr(remplir(texte)).ok, `${nom} ${langue} texte`).toBe(true)
        expect(`${objet} ${texte}`.toLowerCase()).not.toContain('vitfix')
      }
    }
  })
})

describe('message d’annonce figé (H1, option C)', () => {
  it('délai de 15 jours avant l’inclusion, écrit dans le texte', () => {
    expect(DELAI_ANNONCE_DIFFUSION_JOURS).toBe(15)
    expect(annonceDiffusionQr('fr', 'Cabinet Exemple').texte).toContain('pendant les 15 jours qui suivent ce message')
    expect(annonceDiffusionQr('pt', 'Cabinet Exemple').texte).toContain('nos 15 dias seguintes a esta mensagem')
  })
  it('texte FR exact : qui écrit, pourquoi, ce qui suivra, comment refuser ; aucune information d’exploitation', () => {
    expect(annonceDiffusionQr('fr', 'Cabinet Exemple')).toEqual({
      objet: 'Informations sur votre immeuble par e-mail',
      texte: 'Vous avez signalé un problème dans cette copropriété. Désormais, Cabinet Exemple pourra vous informer par e-mail des incidents qui concernent votre immeuble : fuite, coupure, intervention. Aucune de ces informations ne vous sera envoyée pendant les 15 jours qui suivent ce message.\n\n'
        + 'Si vous ne souhaitez pas les recevoir, utilisez le bouton ci-dessous : votre choix prend effet immédiatement. Vous continuerez à recevoir la confirmation de vos propres signalements.',
    })
  })
  it('texte PT (à relire par Hugo, H4)', () => {
    expect(annonceDiffusionQr('pt', 'Cabinet Exemple')).toEqual({
      objet: 'Informações sobre o seu prédio por e-mail',
      texte: 'Comunicou um problema neste condomínio. A partir de agora, Cabinet Exemple poderá enviar-lhe por e-mail informações sobre os incidentes que dizem respeito ao seu prédio: fuga, corte, intervenção. Nenhuma destas informações lhe será enviada nos 15 dias seguintes a esta mensagem.\n\n'
        + 'Se não pretender recebê-las, utilize o botão abaixo: a sua escolha produz efeito imediato. Continuará a receber a confirmação das suas próprias ocorrências.',
    })
  })
  it('passe le contrôle du texte ; nom du cabinet nettoyé (retours et invisibles)', () => {
    for (const langue of ['fr', 'pt'] as const) {
      const { objet, texte } = annonceDiffusionQr(langue, 'Cabinet Exemple')
      expect(controlerTexteDiffusionQr(objet, { nature: 'objet' }).ok).toBe(true)
      expect(controlerTexteDiffusionQr(texte).ok).toBe(true)
    }
    expect(annonceDiffusionQr('fr', ' Cabinet\n\u200BExemple ').texte).toContain('Désormais, Cabinet Exemple pourra')
  })
  it('estAnnonceFigeeQr : seulement l’objet et le texte exacts de la langue et du cabinet', () => {
    const fr = annonceDiffusionQr('fr', 'Cabinet Exemple')
    expect(estAnnonceFigeeQr('fr', 'Cabinet Exemple', fr)).toBe(true)
    expect(estAnnonceFigeeQr('fr', 'Cabinet Exemple', { objet: fr.objet, texte: fr.texte.replace('\n\n', '\r\n\r\n') })).toBe(true)
    expect(estAnnonceFigeeQr('fr', 'Cabinet Exemple', { objet: fr.objet, texte: `${fr.texte} Fuite en cours.` })).toBe(false)
    expect(estAnnonceFigeeQr('fr', 'Autre cabinet', fr)).toBe(false)
    expect(estAnnonceFigeeQr('pt', 'Cabinet Exemple', fr)).toBe(false)
    expect(estAnnonceFigeeQr('fr', 'Cabinet Exemple', { objet: 'Autre objet', texte: fr.texte })).toBe(false)
  })
})

describe('messages de refus affichés sous le champ', () => {
  it('un message pour chaque motif, et le conseil d’espace', () => {
    const motifs: MotifRefusTexteDiffusionQr[] = ['lien', 'adresse_email', 'caractere', 'a_completer', 'telephone', 'terme_commercial', 'longueur', 'lignes']
    for (const m of motifs) expect(MESSAGES_REFUS_TEXTE_DIFFUSION_QR[m].length).toBeGreaterThan(10)
    expect(MESSAGES_REFUS_TEXTE_DIFFUSION_QR.conseilEspaceApresPoint).toContain('espace après le point')
  })
})
