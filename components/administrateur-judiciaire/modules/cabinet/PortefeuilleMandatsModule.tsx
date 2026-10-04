'use client'

import { useState } from 'react'
import {
  DEMO_PORTEFEUILLE_MANDATS,
  PILL_REGIME_PORTEFEUILLE,
  type MandatPortefeuille,
} from '@/components/administrateur-judiciaire/data/portefeuille-mandats'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { useToast, type ToastApi } from '@/components/administrateur-judiciaire/ui/toast'
import { joursAvantDateFr } from '@/lib/administrateur-judiciaire/domain/dates'
import { FICHES_REGIMES } from '@/lib/administrateur-judiciaire/domain/fondements'

/** Filtre « tous tribunaux » (premier chip). */
const TOUS_TRIBUNAUX = 'Tous'

/**
 * Ligne cliquable d'un mandat. La maquette la définissait dans le rendu de l'écran ; hissée ici avec le même DOM.
 * Dans le style, `border: none` suit `borderBottom` et annule donc la bordure basse (ordre des clés conservé).
 */
function LigneMandat({ mandat, push }: { mandat: MandatPortefeuille; push: ToastApi['push'] }) {
  const jours = joursAvantDateFr(mandat.ech)
  return (
    <button
      onClick={() =>
        push({
          kind: 'info',
          title: mandat.nom,
          desc: `${mandat.tj} · ${FICHES_REGIMES[mandat.reg].label} · ${mandat.lots} lots · ${mandat.resp}`,
        })
      }
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '12px 20px',
        borderBottom: '1px solid var(--line)',
        width: '100%',
        textAlign: 'left',
        cursor: 'pointer',
        background: 'transparent',
        border: 'none',
      }}
    >
      <span
        style={{
          width: 30,
          height: 30,
          borderRadius: 8,
          background: 'var(--cream)',
          display: 'grid',
          placeItems: 'center',
          fontFamily: 'Cormorant Garamond,serif',
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        {mandat.code}
      </span>
      <div
        style={{
          flex: 1,
          minWidth: 0,
        }}
      >
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 600,
          }}
        >
          {mandat.nom}
        </div>
        <div
          style={{
            fontSize: 11,
            color: 'var(--navy-300)',
          }}
        >
          {mandat.tj}
          {' · '}
          {mandat.lots}
          {' lots · '}
          {mandat.resp}
        </div>
      </div>
      <Pill kind={PILL_REGIME_PORTEFEUILLE[mandat.reg]} noDot>
        {FICHES_REGIMES[mandat.reg].short}
      </Pill>
      <span
        style={{
          fontSize: 11.5,
          color: 'var(--navy-500)',
          width: 84,
          textAlign: 'right',
        }}
        className="mono"
      >
        {mandat.ech}
      </span>
      <Pill kind={jours == null ? 'sage' : jours < 0 ? 'rust' : jours <= 60 ? 'amber' : 'sage'} noDot>
        {jours == null ? '—' : jours < 0 ? 'expiré' : `J-${jours}`}
      </Pill>
    </button>
  )
}

/**
 * Portefeuille des mandats du cabinet, sur plusieurs tribunaux : recherche, filtre par juridiction, tri par échéance
 * et regroupement par tribunal (démo).
 */
export function PortefeuilleMandatsModule() {
  const { push } = useToast()
  const [recherche, setRecherche] = useState('')
  const [tribunal, setTribunal] = useState(TOUS_TRIBUNAUX)
  const [grouper, setGrouper] = useState(false)
  const tribunaux = [TOUS_TRIBUNAUX, ...Array.from(new Set(DEMO_PORTEFEUILLE_MANDATS.map((mandat) => mandat.tj)))]
  const mandatsFiltres = [
    ...DEMO_PORTEFEUILLE_MANDATS.filter(
      (mandat) =>
        (tribunal === TOUS_TRIBUNAUX || mandat.tj === tribunal) &&
        (recherche === '' ||
          (mandat.nom + ' ' + mandat.code + ' ' + mandat.resp).toLowerCase().includes(recherche.toLowerCase())),
    ),
  ].sort((a, b) => (joursAvantDateFr(a.ech) ?? 9999) - (joursAvantDateFr(b.ech) ?? 9999))
  const totalLots = DEMO_PORTEFEUILLE_MANDATS.reduce((total, mandat) => total + mandat.lots, 0)
  const echeancesProches = DEMO_PORTEFEUILLE_MANDATS.filter((mandat) => {
    const jours = joursAvantDateFr(mandat.ech)
    return jours != null && jours <= 60
  }).length

  return (
    <>
      <PageHead
        eyebrow="Cabinet & supervision"
        title="Portefeuille des mandats"
        lede="Tous les mandats du cabinet, sur plusieurs tribunaux. Recherche, filtre par juridiction et regroupement pour piloter un portefeuille à l'échelle."
        actions={
          <button
            className="btn gold"
            onClick={() =>
              push({
                kind: 'doc',
                icon: 'download',
                title: 'Export du portefeuille',
                eyebrow: 'Syndic judiciaire · Cabinet Delaunay',
                docTitle: 'Portefeuille de mandats',
                meta: 'Cabinet Delaunay',
                lines: [
                  {
                    h: 'Contenu',
                  },
                  {
                    k: 'Mandats actifs',
                    v: '14',
                  },
                  {
                    // Valeur en dur de la maquette, différente du total calculé (624 lots) : conservée.
                    k: 'Lots gérés',
                    v: '486',
                  },
                  {
                    k: 'Format',
                    v: 'XLSX',
                  },
                ],
              })
            }
          >
            <Icon name="download" />
            Exporter
          </button>
        }
      />
      <Kpis
        items={[
          {
            icon: 'scale',
            num: DEMO_PORTEFEUILLE_MANDATS.length,
            lbl: 'Mandats actifs',
            sub: 'tout le cabinet',
          },
          {
            icon: 'bank',
            num: tribunaux.length - 1,
            lbl: 'Tribunaux',
            sub: 'juridictions distinctes',
            accent: 'gold',
          },
          {
            icon: 'building',
            num: totalLots,
            lbl: 'Lots cumulés',
            accent: 'sage',
          },
          {
            icon: 'clock',
            num: echeancesProches,
            lbl: 'Échéances < 60 j',
            sub: 'à anticiper',
            accent: 'amber',
          },
        ]}
      />
      <div
        style={{
          display: 'flex',
          gap: 10,
          marginBottom: 14,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: '#fff',
            border: '1px solid var(--line)',
            borderRadius: 9,
            padding: '7px 12px',
            flex: '1 1 240px',
            maxWidth: 340,
          }}
        >
          <Icon
            name="search"
            style={{
              width: 15,
              height: 15,
              color: 'var(--navy-300)',
            }}
          />
          <input
            type="text"
            aria-label="Rechercher un mandat"
            value={recherche}
            onChange={(evenement) => setRecherche(evenement.target.value)}
            placeholder="Rechercher un mandat, un code, un gestionnaire…"
            style={{
              border: 'none',
              outline: 'none',
              background: 'transparent',
              width: '100%',
              fontSize: 13,
            }}
          />
        </div>
        <button className={`chip ${grouper ? 'active' : ''}`} onClick={() => setGrouper((valeur) => !valeur)}>
          <Icon
            name="grid"
            style={{
              width: 13,
              height: 13,
              verticalAlign: '-2px',
              marginRight: 5,
            }}
          />
          Grouper par tribunal
        </button>
      </div>
      <div
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 18,
          flexWrap: 'wrap',
        }}
      >
        {tribunaux.map((nomTribunal) => (
          <button
            className={`chip ${tribunal === nomTribunal ? 'active' : ''}`}
            onClick={() => setTribunal(nomTribunal)}
            key={nomTribunal}
          >
            {nomTribunal}{' '}
            <span
              style={{
                opacity: 0.6,
              }}
            >
              {nomTribunal === TOUS_TRIBUNAUX
                ? DEMO_PORTEFEUILLE_MANDATS.length
                : DEMO_PORTEFEUILLE_MANDATS.filter((mandat) => mandat.tj === nomTribunal).length}
            </span>
          </button>
        ))}
      </div>
      {!grouper && (
        <Panel
          title="Mandats"
          sub={`${mandatsFiltres.length} résultat${mandatsFiltres.length > 1 ? 's' : ''} · triés par échéance`}
          icon="scale"
          flush
        >
          {mandatsFiltres.map((mandat) => (
            <LigneMandat mandat={mandat} push={push} key={mandat.code} />
          ))}
          {mandatsFiltres.length === 0 && (
            <div
              style={{
                padding: 26,
                textAlign: 'center',
                color: 'var(--navy-300)',
                fontSize: 13,
              }}
            >
              Aucun mandat ne correspond.
            </div>
          )}
        </Panel>
      )}
      {grouper &&
        tribunaux
          .filter((nomTribunal) => nomTribunal !== TOUS_TRIBUNAUX)
          .filter((nomTribunal) => tribunal === TOUS_TRIBUNAUX || nomTribunal === tribunal)
          .map((nomTribunal) => {
            const mandatsDuTribunal = mandatsFiltres.filter((mandat) => mandat.tj === nomTribunal)
            return mandatsDuTribunal.length === 0 ? null : (
              <Panel
                title={nomTribunal}
                sub={`${mandatsDuTribunal.length} mandat${mandatsDuTribunal.length > 1 ? 's' : ''} · ${mandatsDuTribunal.reduce((total, mandat) => total + mandat.lots, 0)} lots`}
                icon="bank"
                flush
                key={nomTribunal}
              >
                {mandatsDuTribunal.map((mandat) => (
                  <LigneMandat mandat={mandat} push={push} key={mandat.code} />
                ))}
              </Panel>
            )
          })}
    </>
  )
}
