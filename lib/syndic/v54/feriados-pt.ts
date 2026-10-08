/**
 * Feriados obrigatórios portugais — art. 234.º, n.º 1, du Código do Trabalho (Lei n.º 7/2009,
 * liste rétablie par la Lei n.º 8/2016) : 1 janvier, Sexta-feira Santa, Domingo de Páscoa,
 * 25 avril, 1er mai, Corpo de Deus, 10 juin, 15 août, 5 octobre, 1er novembre, 1er, 8 et
 * 25 décembre. Liste en vigueur depuis le 2 avril 2016, appliquée à toute année : la
 * declaração de encargos (art. 1424.º-A CC, Lei n.º 8/2022) est bien postérieure.
 *
 * Règle portugaise uniquement : sert au report du terme des délais légaux (art. 279.º, e), CC),
 * jamais à un calcul français.
 *
 * Non inclus, volontairement :
 * - les feriados facultativos de l'art. 235.º CT : Terça-feira de Carnaval et feriado municipal
 *   (propre à chaque commune, inconnu ici) ;
 * - l'observation de la Sexta-feira Santa « noutro dia com significado local no período da
 *   Páscoa » (art. 234.º, n.º 2) : variante locale, la date nationale est retenue ;
 * - les feriados régionaux des Açores et de Madère.
 *
 * Jours civils « AAAA-MM-JJ », arithmétique en UTC : indépendante du fuseau du serveur.
 */

const ISO_JOUR = /^(\d{4})-(\d{2})-(\d{2})$/

/** Feriados à date fixe (MM-JJ). */
const FERIADOS_FIXOS = ['01-01', '04-25', '05-01', '06-10', '08-15', '10-05', '11-01', '12-01', '12-08', '12-25'] as const

/** Écart, en jours, des feriados mobiles par rapport au Domingo de Páscoa. */
const FERIADOS_MOVEIS = [
  -2, // Sexta-feira Santa
  0, // Domingo de Páscoa
  60, // Corpo de Deus (jeudi qui suit le dimanche de la Trinité)
] as const

const jourIso = (d: Date): string => d.toISOString().slice(0, 10)

/** Dimanche de Pâques du calendrier grégorien (algorithme « anonyme » de Meeus/Jones/Butcher). */
export function dimancheDePaques(annee: number): string {
  const a = annee % 19
  const b = Math.floor(annee / 100)
  const c = annee % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mois = Math.floor((h + l - 7 * m + 114) / 31)
  const jour = ((h + l - 7 * m + 114) % 31) + 1
  return jourIso(new Date(Date.UTC(annee, mois - 1, jour)))
}

/**
 * Les feriados obrigatórios de l'année, « AAAA-MM-JJ », dans l'ordre du calendrier, sans doublon :
 * 13 jours, ou 12 quand une fête mobile tombe sur une fête fixe (2038 : Pâques le 25 avril).
 */
export function feriadosObrigatorios(annee: number): string[] {
  const paques = new Date(`${dimancheDePaques(annee)}T00:00:00Z`)
  const moveis = FERIADOS_MOVEIS.map((ecart) => {
    const d = new Date(paques)
    d.setUTCDate(d.getUTCDate() + ecart)
    return jourIso(d)
  })
  const fixos = FERIADOS_FIXOS.map((mmjj) => `${String(annee).padStart(4, '0')}-${mmjj}`)
  return [...new Set([...fixos, ...moveis])].sort()
}

/** Jour civil « AAAA-MM-JJ » qui est un feriado obrigatório ; false pour toute autre valeur. */
export function estFeriadoObrigatorio(jour: string | null | undefined): boolean {
  const m = jour ? ISO_JOUR.exec(jour) : null
  if (!m) return false
  const annee = Number(m[1])
  const civil = new Date(Date.UTC(annee, Number(m[2]) - 1, Number(m[3])))
  if (jourIso(civil) !== jour) return false
  return feriadosObrigatorios(annee).includes(jour)
}
