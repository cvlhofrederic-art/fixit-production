// Champs de saisie de la remise commerciale (components/devis/RemiseCommerciale.tsx), partagés par
// les formulaires artisan et BTP : saisie en € TTC convertie en HT, abandon du mode TTC quand la
// remise change hors du champ (mode « Acompte » du formulaire BTP), conversion de la valeur au
// changement d'unité.
import React from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ChampRemiseGlobale, ChampRemiseLigne } from '@/components/devis/RemiseCommerciale'
import { remiseHTDepuisTTC, type LigneRemisable, type Remise } from '@/lib/remise-commerciale'

afterEach(cleanup)

const euros = (n: number) => `${n.toFixed(2)} €`
const UN_TAUX: LigneRemisable[] = [{ totalHT: 1000, tvaRate: 20 }]
const DEUX_TAUX: LigneRemisable[] = [{ totalHT: 1000, tvaRate: 20 }, { totalHT: 1000, tvaRate: 10 }]

/** Hôte qui tient la remise et les lignes comme un formulaire, avec deux actions extérieures. */
function HoteGlobal({ depart, avecTva = true, remiseDepart }: { depart: LigneRemisable[]; avecTva?: boolean; remiseDepart?: Remise }) {
  const [remise, setRemise] = React.useState<Remise | undefined>(remiseDepart)
  const [lignes, setLignes] = React.useState(depart)
  const [tva, setTva] = React.useState(avecTva)
  return (
    <>
      <ChampRemiseGlobale remise={remise} onChange={setRemise} lignes={lignes} avecTva={tva} formaterMontant={euros} />
      {/* Sortie du mode « Acompte » (restoreAcompteOriginal du formulaire BTP) : lignes et remise d'origine. */}
      <button onClick={() => { setLignes(depart); setRemise(remiseDepart) }}>retour standard</button>
      {/* Régime sans TVA facturée (franchise, autoliquidation) choisi après coup. */}
      <button onClick={() => setTva(false)}>retirer la TVA</button>
      <output data-testid="remise">{JSON.stringify(remise ?? null)}</output>
      {/* Mode « Acompte » du formulaire BTP : lignes et remise en euros mises à 30 % d'un coup. */}
      <button onClick={() => {
        setLignes(depart.map((l) => ({ ...l, totalHT: Math.round(l.totalHT * 30) / 100 })))
        setRemise((r) => (r && r.type === 'montant' ? { ...r, valeur: Math.round(r.valeur * 30) / 100 } : r))
      }}>acompte</button>
      <button onClick={() => setLignes(DEUX_TAUX)}>ajouter une ligne</button>
      {/* Retour en facture standard : le formulaire remet la remise d'origine (300 € HT). */}
      <button onClick={() => setRemise({ type: 'montant', valeur: 300 })}>remettre 300 €</button>
    </>
  )
}

const remiseAffichee = (): Remise | null => JSON.parse(screen.getByTestId('remise').textContent || 'null')
const champ = () => screen.getByTitle('Remise commerciale sur le total') as HTMLInputElement
const unite = () => screen.getByLabelText('Unité de la remise commerciale') as HTMLSelectElement

describe('ChampRemiseGlobale', () => {
  it('saisie en € TTC : le HT équivalent est enregistré et affiché', () => {
    render(<HoteGlobal depart={UN_TAUX} />)
    fireEvent.change(unite(), { target: { value: 'ttc' } })
    fireEvent.change(champ(), { target: { value: '120' } })
    expect(remiseAffichee()).toEqual({ type: 'montant', valeur: 100 })
    expect(screen.getByText('soit 100.00 € HT')).toBeTruthy()
  })

  it('en € TTC, la remise HT suit les lignes', () => {
    render(<HoteGlobal depart={UN_TAUX} />)
    fireEvent.change(unite(), { target: { value: 'ttc' } })
    fireEvent.change(champ(), { target: { value: '230' } })
    fireEvent.click(screen.getByText('ajouter une ligne'))
    expect(remiseAffichee()).toEqual({ type: 'montant', valeur: remiseHTDepuisTTC(DEUX_TAUX, 230, true) })
    expect(remiseAffichee()?.valeur).toBe(200)
  })

  it('une remise changée hors du champ (mode Acompte) fait quitter le mode TTC sans être écrasée', () => {
    render(<HoteGlobal depart={UN_TAUX} />)
    fireEvent.change(unite(), { target: { value: 'ttc' } })
    fireEvent.change(champ(), { target: { value: '120' } })
    fireEvent.click(screen.getByText('acompte'))
    expect(remiseAffichee()).toEqual({ type: 'montant', valeur: 30 })
    expect(unite().value).toBe('ht')
  })

  it('changer d unité convertit la valeur : 10 % de 1 000 € deviennent 100 € HT, et inversement', () => {
    render(<HoteGlobal depart={UN_TAUX} remiseDepart={{ type: 'pourcentage', valeur: 10 }} />)
    fireEvent.change(unite(), { target: { value: 'ht' } })
    expect(remiseAffichee()).toEqual({ type: 'montant', valeur: 100 })
    fireEvent.change(unite(), { target: { value: 'pourcentage' } })
    expect(remiseAffichee()).toEqual({ type: 'pourcentage', valeur: 10 })
  })

  it('choisir seulement l unité € TTC ne change pas la remise enregistrée (trois taux de TVA)', () => {
    // 292,57 € et 292,56 € HT donnent la même baisse TTC (319,92 €), la TVA étant arrondie par taux.
    const TROIS_TAUX: LigneRemisable[] = [{ totalHT: 24.84, tvaRate: 20 }, { totalHT: 629.53, tvaRate: 10 }, { totalHT: 174.76, tvaRate: 5.5 }]
    render(<HoteGlobal depart={TROIS_TAUX} remiseDepart={{ type: 'montant', valeur: 292.57 }} />)
    fireEvent.change(unite(), { target: { value: 'ttc' } })
    expect(champ().value).toBe('319,92')
    expect(remiseAffichee()).toEqual({ type: 'montant', valeur: 292.57 })
    fireEvent.change(unite(), { target: { value: 'ht' } })
    expect(remiseAffichee()).toEqual({ type: 'montant', valeur: 292.57 })
  })

  it('retaper touche par touche la valeur € TTC affichée redonne la remise d avant la saisie', () => {
    const TROIS_TAUX: LigneRemisable[] = [{ totalHT: 24.84, tvaRate: 20 }, { totalHT: 629.53, tvaRate: 10 }, { totalHT: 174.76, tvaRate: 5.5 }]
    render(<HoteGlobal depart={TROIS_TAUX} remiseDepart={{ type: 'montant', valeur: 292.57 }} />)
    fireEvent.change(unite(), { target: { value: 'ttc' } })
    fireEvent.focus(champ())
    for (const frappe of ['3', '31', '319', '319,9', '319,92']) fireEvent.change(champ(), { target: { value: frappe } })
    expect(remiseAffichee()).toEqual({ type: 'montant', valeur: 292.57 })
    expect(unite().value).toBe('ttc')
  })

  it('remise en % affichée en € TTC : enregistrée telle quelle, équivalent HT indiqué', () => {
    render(<HoteGlobal depart={UN_TAUX} remiseDepart={{ type: 'pourcentage', valeur: 10 }} />)
    fireEvent.change(unite(), { target: { value: 'ttc' } })
    expect(champ().value).toBe('120')
    expect(remiseAffichee()).toEqual({ type: 'pourcentage', valeur: 10 })
    expect(screen.getByText('soit 100.00 € HT')).toBeTruthy()
  })

  it('remise en % seulement affichée en € TTC : le mode Acompte et le retour la gardent en %', () => {
    render(<HoteGlobal depart={UN_TAUX} remiseDepart={{ type: 'pourcentage', valeur: 10 }} />)
    fireEvent.change(unite(), { target: { value: 'ttc' } })
    fireEvent.click(screen.getByText('acompte'))
    expect(remiseAffichee()).toEqual({ type: 'pourcentage', valeur: 10 })
    expect(champ().value).toBe('36') // 10 % de 300 € HT, TVA de 20 % comprise
    fireEvent.click(screen.getByText('retour standard'))
    expect(remiseAffichee()).toEqual({ type: 'pourcentage', valeur: 10 })
    expect(champ().value).toBe('120')
  })

  it('€ TTC choisi pendant l Acompte puis retour en facture standard : remise d origine', () => {
    render(<HoteGlobal depart={UN_TAUX} remiseDepart={{ type: 'pourcentage', valeur: 10 }} />)
    fireEvent.click(screen.getByText('acompte'))
    fireEvent.change(unite(), { target: { value: 'ttc' } })
    fireEvent.click(screen.getByText('retour standard'))
    expect(remiseAffichee()).toEqual({ type: 'pourcentage', valeur: 10 })
  })

  it('remise seulement affichée en € TTC : une ligne ajoutée ne la change pas', () => {
    render(<HoteGlobal depart={UN_TAUX} remiseDepart={{ type: 'pourcentage', valeur: 10 }} />)
    fireEvent.change(unite(), { target: { value: 'ttc' } })
    fireEvent.click(screen.getByText('ajouter une ligne'))
    expect(remiseAffichee()).toEqual({ type: 'pourcentage', valeur: 10 })
    expect(champ().value).toBe('230') // 10 % de 2 000 € : 100 € à 20 % et 100 € à 10 %
  })

  it('€ TTC choisi puis TVA retirée : l unité redevient celle de la remise enregistrée', () => {
    render(<HoteGlobal depart={UN_TAUX} remiseDepart={{ type: 'pourcentage', valeur: 10 }} />)
    fireEvent.change(unite(), { target: { value: 'ttc' } })
    fireEvent.click(screen.getByText('retirer la TVA'))
    expect(unite().value).toBe('pourcentage')
    expect(champ().value).toBe('10')
  })

  it('passer en € TTC affiche l effet TTC de la remise en cours', () => {
    render(<HoteGlobal depart={UN_TAUX} remiseDepart={{ type: 'montant', valeur: 100 }} />)
    fireEvent.change(unite(), { target: { value: 'ttc' } })
    expect(champ().value).toBe('120')
    expect(remiseAffichee()).toEqual({ type: 'montant', valeur: 100 })
  })

  it('remise remise par le formulaire dans une autre unité : l unité affichée suit la remise enregistrée', () => {
    render(<HoteGlobal depart={UN_TAUX} remiseDepart={{ type: 'montant', valeur: 300 }} />)
    fireEvent.change(unite(), { target: { value: 'pourcentage' } })
    expect(remiseAffichee()).toEqual({ type: 'pourcentage', valeur: 30 })
    fireEvent.click(screen.getByText('remettre 300 €'))
    expect(unite().value).toBe('ht')
    expect(champ().value).toBe('300')
  })

  it('sans TVA facturée : pas de saisie en € TTC', () => {
    render(<HoteGlobal depart={UN_TAUX} avecTva={false} />)
    expect([...unite().options].map((o) => o.value)).toEqual(['pourcentage', 'ht'])
    expect(unite().options[1].textContent).toBe('€')
  })

  it('vider le champ retire la remise', () => {
    render(<HoteGlobal depart={UN_TAUX} remiseDepart={{ type: 'pourcentage', valeur: 10 }} />)
    fireEvent.change(champ(), { target: { value: '' } })
    expect(remiseAffichee()).toBeNull()
  })
})

function HoteLigne({ depart, base }: { depart?: Remise; base: number }) {
  const [remise, setRemise] = React.useState<Remise | undefined>(depart)
  return (
    <>
      <ChampRemiseLigne remise={remise} onChange={setRemise} base={base} />
      <output data-testid="remise">{JSON.stringify(remise ?? null)}</output>
    </>
  )
}

describe('ChampRemiseLigne', () => {
  it('saisie en % par défaut', () => {
    render(<HoteLigne base={1000} />)
    fireEvent.change(screen.getByTitle('Remise sur la ligne, en %'), { target: { value: '10' } })
    expect(remiseAffichee()).toEqual({ type: 'pourcentage', valeur: 10 })
  })

  it('le bouton change d unité en convertissant sur le montant de la ligne', () => {
    render(<HoteLigne base={1000} depart={{ type: 'montant', valeur: 150 }} />)
    fireEvent.click(screen.getByLabelText('Remise en euros, passer en pourcentage'))
    expect(remiseAffichee()).toEqual({ type: 'pourcentage', valeur: 15 })
    fireEvent.click(screen.getByLabelText('Remise en pourcentage, passer en euros'))
    expect(remiseAffichee()).toEqual({ type: 'montant', valeur: 150 })
  })

  it('sans valeur, le bouton change seulement l unité de saisie', () => {
    render(<HoteLigne base={1000} />)
    fireEvent.click(screen.getByLabelText('Remise en pourcentage, passer en euros'))
    expect(remiseAffichee()).toBeNull()
    fireEvent.change(screen.getByTitle('Remise sur la ligne, en € HT'), { target: { value: '50' } })
    expect(remiseAffichee()).toEqual({ type: 'montant', valeur: 50 })
  })
})
