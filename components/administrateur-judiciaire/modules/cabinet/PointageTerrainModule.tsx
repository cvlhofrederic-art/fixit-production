'use client'

import { useEffect, useRef, useState } from 'react'
import {
  DEMO_JOURNAL_POINTAGES_JOUR,
  DEMO_MINUTES_TERRAIN_SEMAINE,
  DEMO_SITES_POINTAGE,
  POSITION_CABINET_POINTAGE,
  type PointageJour,
  type PositionGps,
  type SitePointage,
} from '@/components/administrateur-judiciaire/data/pointage'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'
import { formatDureeHms, formatDureeMinutes } from '@/lib/administrateur-judiciaire/domain/format'
import { distanceHaversineMetres } from '@/lib/administrateur-judiciaire/domain/geo'

/** Clé localStorage du rayon de déclenchement (mètres). */
export const CLE_STOCKAGE_RAYON_POINTAGE = 'vitfix.aj.pt.radius'

/** Rayon de déclenchement par défaut (mètres). */
const RAYON_PAR_DEFAUT = 80

/** Site pointable avec sa distance (mètres) à la position courante. */
export type SitePointageAvecDistance = SitePointage & { d: number }

/** Distance lisible : « 1.2 km » (point décimal, comme la maquette) au-delà de 1 000 m, sinon « 350 m ». */
export const formatDistancePointage = (metres: number): string =>
  metres >= 1e3 ? (metres / 1e3).toFixed(1) + ' km' : metres + ' m'

/** Rayon enregistré, ou 80 m (valeur absente, nulle ou non numérique, ou stockage indisponible). */
const lireRayonStocke = (): number => {
  try {
    return Number(localStorage.getItem(CLE_STOCKAGE_RAYON_POINTAGE)) || RAYON_PAR_DEFAUT
  } catch {
    // localStorage indisponible (navigation privée, stockage bloqué) : rayon par défaut.
    return RAYON_PAR_DEFAUT
  }
}

/**
 * Pointage terrain : le pointage démarre automatiquement quand la position entre dans le rayon d'une copropriété
 * et s'arrête en la quittant (durée créditée au cumul de la semaine et au journal du jour). Position simulée ou GPS.
 */
export function PointageTerrainModule() {
  const { push } = useToast()
  const [rayon, setRayon] = useState<number>(lireRayonStocke)
  const [position, setPosition] = useState<PositionGps>(POSITION_CABINET_POINTAGE)
  const [codeActif, setCodeActif] = useState<string | null>(null)
  const [maintenant, setMaintenant] = useState(Date.now())
  const refDebut = useRef<number | null>(null)
  const [minutesParSite, setMinutesParSite] = useState<Record<string, number>>(DEMO_MINUTES_TERRAIN_SEMAINE)
  const [journal, setJournal] = useState<PointageJour[]>(DEMO_JOURNAL_POINTAGES_JOUR)
  const sites: SitePointageAvecDistance[] = DEMO_SITES_POINTAGE.map((site) => ({
    ...site,
    d: distanceHaversineMetres(position, site),
  })).sort((a, b) => a.d - b.d)
  const siteProche = sites.find((site) => site.d <= rayon) || null

  useEffect(() => {
    const codeProche = siteProche ? siteProche.code : null
    if (codeProche !== codeActif) {
      if (codeActif) {
        const minutes = Math.max(1, Math.round((Date.now() - (refDebut.current || Date.now())) / 6e4)),
          fin = new Date(),
          heureFin = String(fin.getHours()).padStart(2, '0') + ':' + String(fin.getMinutes()).padStart(2, '0')
        setJournal((liste) =>
          [
            {
              code: codeActif,
              mins: minutes,
              end: heureFin,
            },
            ...liste,
          ].slice(0, 8),
        )
        setMinutesParSite((cumuls) => ({
          ...cumuls,
          [codeActif]: (cumuls[codeActif] || 0) + minutes,
        }))
      }
      if (codeProche) {
        refDebut.current = Date.now()
        setMaintenant(Date.now())
      }
      setCodeActif(codeProche)
    }
    // Comme dans la maquette, l'effet ne se relance qu'au changement de position ou de rayon : le site proche et le
    // site actif sont lus dans le rendu qui a provoqué ce changement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position, rayon])

  useEffect(() => {
    if (!codeActif) return
    const minuteur = setInterval(() => setMaintenant(Date.now()), 1e3)
    return () => clearInterval(minuteur)
  }, [codeActif])

  const secondesEcoulees = codeActif && refDebut.current ? Math.floor((maintenant - refDebut.current) / 1e3) : 0
  const changerRayon = (valeur: number) => {
    setRayon(valeur)
    try {
      localStorage.setItem(CLE_STOCKAGE_RAYON_POINTAGE, String(valeur))
    } catch {
      // localStorage indisponible : le rayon reste valable pour la session en cours.
    }
  }
  const localiserParGps = () => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      push({
        kind: 'info',
        title: 'Position GPS',
        desc: 'Demande envoyée au navigateur : autorisez la localisation si elle vous est proposée.',
      })
      navigator.geolocation.getCurrentPosition(
        (resultat) => {
          setPosition({
            lat: resultat.coords.latitude,
            lng: resultat.coords.longitude,
          })
          push({
            kind: 'success',
            title: 'Position GPS acquise',
            desc: 'Précision ' + Math.round(resultat.coords.accuracy) + ' m',
          })
        },
        () =>
          push({
            kind: 'warning',
            title: 'GPS indisponible',
            desc: 'Autorisez la localisation ou utilisez la simulation ci-dessous.',
          }),
      )
    } else {
      push({
        kind: 'warning',
        title: 'GPS non supporté',
      })
    }
  }
  const siteActif = DEMO_SITES_POINTAGE.find((site) => site.code === codeActif)
  const cumuls = Object.values(minutesParSite)
  const sitesVisites = cumuls.filter((minutes) => minutes > 0).length
  const totalMinutes = cumuls.reduce((total, minutes) => total + minutes, 0)
  const maximumMinutes = Math.max(1, ...cumuls)

  return (
    <>
      <PageHead
        eyebrow="Cabinet & supervision"
        title="Pointage terrain"
        lede="Pointage automatique géolocalisé des gestionnaires techniques sur les copropriétés."
      />
      <div className={`pt-live ${codeActif ? 'on' : 'pt-live-off'}`}>
        <span className="pt-pulse" />
        {codeActif ? (
          <>
            <div
              style={{
                flex: 1,
                minWidth: 0,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: '.08em',
                  textTransform: 'uppercase',
                  color: 'var(--sage-600)',
                  fontWeight: 700,
                  marginBottom: 4,
                }}
              >
                Pointage automatique en cours
              </div>
              <div
                style={{
                  fontFamily: 'Cormorant Garamond,serif',
                  fontSize: 23,
                  lineHeight: 1.1,
                }}
              >
                {siteActif?.nom}
              </div>
              <div
                style={{
                  fontSize: 12.5,
                  color: 'var(--navy-300)',
                  marginTop: 3,
                }}
              >
                {siteActif?.adresse}
                {' · à '}
                {siteProche ? siteProche.d : 0}
                {' m du repère'}
              </div>
            </div>
            <div
              style={{
                textAlign: 'right',
              }}
            >
              <div className="pt-live-timer">{formatDureeHms(secondesEcoulees)}</div>
              <button
                className="btn ghost sm"
                style={{
                  marginTop: 8,
                }}
                onClick={() => setPosition(POSITION_CABINET_POINTAGE)}
              >
                Quitter le site
              </button>
            </div>
          </>
        ) : (
          <div
            style={{
              flex: 1,
            }}
          >
            <div
              style={{
                fontSize: 11,
                letterSpacing: '.08em',
                textTransform: 'uppercase',
                color: 'var(--navy-300)',
                fontWeight: 700,
                marginBottom: 4,
              }}
            >
              Aucun pointage en cours
            </div>
            <div
              style={{
                fontSize: 14,
                lineHeight: 1.5,
              }}
            >
              {'Vous êtes à '}
              <b>{formatDistancePointage(sites[0].d)}</b>
              {' de '}
              {sites[0].nom}
              {". Le pointage démarre automatiquement dès l'entrée dans un rayon de "}
              <b>
                {rayon}
                {' m'}
              </b>
              .
            </div>
          </div>
        )}
      </div>
      <Kpis
        items={[
          {
            icon: 'clock',
            num: formatDureeMinutes(totalMinutes),
            lbl: 'Temps terrain (semaine)',
          },
          {
            icon: 'building',
            num: sitesVisites + ' / ' + DEMO_SITES_POINTAGE.length,
            lbl: 'Copropriétés visitées',
          },
          {
            icon: 'chart',
            num: formatDureeMinutes(Math.round(totalMinutes / Math.max(1, sitesVisites))),
            lbl: 'Durée moyenne / site',
            accent: 'gold',
          },
          {
            icon: 'target',
            num: rayon + ' m',
            lbl: 'Déclenchement',
            accent: 'sage',
          },
        ]}
      />
      <Panel
        title="Réglage du déclenchement"
        sub="Distance à partir de laquelle le pointage démarre et s'arrête automatiquement"
        icon="target"
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <input
            className="pt-range"
            type="range"
            min={20}
            max={500}
            step={10}
            value={rayon}
            onChange={(evenement) => changerRayon(Number(evenement.target.value))}
            aria-label="Rayon de déclenchement en mètres"
          />
          <div
            style={{
              fontFamily: 'JetBrains Mono,monospace',
              fontSize: 18,
              fontWeight: 600,
              minWidth: 64,
              textAlign: 'right',
            }}
          >
            {rayon}
            {' m'}
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            gap: 8,
            marginTop: 14,
            flexWrap: 'wrap',
          }}
        >
          <button className="btn sm" onClick={localiserParGps}>
            <Icon name="map" />
            Utiliser ma position réelle (GPS)
          </button>
          <button
            className="btn ghost sm"
            onClick={() => {
              setPosition(POSITION_CABINET_POINTAGE)
              push({
                kind: 'info',
                title: 'Position : cabinet',
                desc: 'Point de départ rétabli.',
              })
            }}
          >
            Retour cabinet
          </button>
        </div>
      </Panel>
      <Panel
        title="Proximité des copropriétés"
        sub="Simulez un déplacement — le pointage se déclenche en entrant dans la zone"
        icon="pin"
        flush
      >
        <div
          style={{
            padding: 16,
            display: 'grid',
            gap: 10,
          }}
        >
          {sites.map((site) => {
            const estActif = site.code === codeActif
            return (
              <div
                className="entity-card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '12px 14px',
                }}
                key={site.code}
              >
                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    {site.nom}{' '}
                    {estActif && (
                      <Pill kind="sage" noDot>
                        Pointage actif
                      </Pill>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--navy-300)',
                    }}
                  >
                    {site.adresse}
                  </div>
                </div>
                <div
                  style={{
                    textAlign: 'right',
                    minWidth: 118,
                  }}
                >
                  <div className="pt-card-dist">{formatDistancePointage(site.d)}</div>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--navy-300)',
                    }}
                  >
                    {formatDureeMinutes(minutesParSite[site.code] || 0)}
                    {' cette semaine'}
                  </div>
                </div>
                <button
                  className="btn sm"
                  disabled={estActif}
                  onClick={() =>
                    setPosition({
                      lat: site.lat,
                      lng: site.lng,
                    })
                  }
                >
                  {estActif ? 'Sur place' : 'Pointer ici'}
                </button>
              </div>
            )
          })}
        </div>
      </Panel>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.4fr 1fr',
          gap: 16,
        }}
      >
        <Panel title="Temps par copropriété — semaine" icon="chart">
          {DEMO_SITES_POINTAGE.map((site) => {
            const minutes = minutesParSite[site.code] || 0
            return (
              <div
                style={{
                  marginBottom: 12,
                }}
                key={site.code}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 13,
                    marginBottom: 5,
                  }}
                >
                  <span>{site.nom}</span>
                  <b
                    style={{
                      fontFamily: 'JetBrains Mono,monospace',
                    }}
                  >
                    {formatDureeMinutes(minutes)}
                  </b>
                </div>
                <div className="pt-bar-track">
                  <div
                    className="pt-bar-fill"
                    style={{
                      width: Math.round((minutes / maximumMinutes) * 100) + '%',
                    }}
                  />
                </div>
              </div>
            )
          })}
        </Panel>
        <Panel title="Journal du jour" sub="Pointages enregistrés aujourd'hui" icon="clock" flush>
          <div
            style={{
              padding: 16,
              display: 'grid',
              gap: 8,
            }}
          >
            {journal.length === 0 && (
              <div
                style={{
                  color: 'var(--navy-300)',
                  fontSize: 13,
                }}
              >
                {"Aucun pointage aujourd'hui."}
              </div>
            )}
            {journal.map((pointage, index) => {
              const site = DEMO_SITES_POINTAGE.find((candidat) => candidat.code === pointage.code)
              return (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 0',
                    borderBottom: '1px solid var(--line)',
                    fontSize: 13,
                  }}
                  key={index}
                >
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <Pill kind="navy" noDot>
                      {pointage.code}
                    </Pill>{' '}
                    {site ? site.nom : pointage.code}
                  </span>
                  <span
                    style={{
                      color: 'var(--navy-300)',
                    }}
                  >
                    {formatDureeMinutes(pointage.mins)}
                    {' · fin '}
                    {pointage.end}
                  </span>
                </div>
              )
            })}
          </div>
        </Panel>
      </div>
    </>
  )
}
