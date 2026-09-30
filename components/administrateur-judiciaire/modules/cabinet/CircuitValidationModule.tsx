'use client'

import { useState } from 'react'
import {
  DEMO_ACTES_CIRCUIT_VALIDATION,
  ETAPES_CIRCUIT_VALIDATION,
  type ActeCircuit,
  type EtapeCircuit,
} from '@/components/administrateur-judiciaire/data/circuit-validation'
import { useRoleCabinet } from '@/components/administrateur-judiciaire/shell/RoleCabinetContext'
import { Alert } from '@/components/administrateur-judiciaire/ui/Alert'
import { DataTable, type ColonneTableau } from '@/components/administrateur-judiciaire/ui/DataTable'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'
import { LIBELLES_ROLES_CABINET } from '@/lib/administrateur-judiciaire/domain/roles-cabinet'

/** Message du toast affiché quand un acte avance dans le circuit. */
interface MessageAvancementCircuit {
  titre: string
  description: string
}

/**
 * Circuit de validation des actes : préparé → vérifié par le juriste → validé et signé par la direction.
 * Les actions dépendent du rôle choisi dans la barre du haut ; l'avancement est local (démo, sans persistance).
 */
export function CircuitValidationModule() {
  const role = useRoleCabinet()
  const { push } = useToast()
  const [actes, setActes] = useState<ActeCircuit[]>(DEMO_ACTES_CIRCUIT_VALIDATION)
  const faireAvancer = (id: number, etape: EtapeCircuit, message: MessageAvancementCircuit) => {
    setActes((liste) =>
      liste.map((acte) =>
        acte.id === id
          ? {
              ...acte,
              stage: etape,
            }
          : acte,
      ),
    )
    push({
      kind: 'success',
      title: message.titre,
      desc: message.description,
    })
  }
  const aVerifier = actes.filter((acte) => acte.stage === 'prepare').length,
    aValider = actes.filter((acte) => acte.stage === 'verifie').length,
    valides = actes.filter((acte) => acte.stage === 'valide').length

  const colonnes: ColonneTableau<ActeCircuit>[] = [
    {
      h: 'Acte',
      render: (acte) => (
        <div>
          <b
            style={{
              fontWeight: 600,
            }}
          >
            {acte.objet}
          </b>
          <div
            style={{
              fontSize: 11,
              color: 'var(--navy-300)',
            }}
          >
            {acte.type}
            {' · préparé par '}
            {acte.by}
          </div>
        </div>
      ),
    },
    {
      h: 'Copropriété',
      render: (acte) => (
        <span
          style={{
            fontSize: 12,
            color: 'var(--navy-500)',
          }}
        >
          {acte.copro}
        </span>
      ),
    },
    {
      h: 'Étape',
      render: (acte) => (
        <Pill kind={ETAPES_CIRCUIT_VALIDATION[acte.stage].pill} noDot>
          {ETAPES_CIRCUIT_VALIDATION[acte.stage].label}
        </Pill>
      ),
    },
    {
      h: '',
      style: {
        width: 170,
        textAlign: 'right',
      },
      tdStyle: {
        textAlign: 'right',
      },
      // La maquette testait « (Juridique ou Direction) et préparé et Juridique » : cela revient à Juridique + préparé.
      render: (acte) =>
        role === 'Juridique' && acte.stage === 'prepare' ? (
          <button
            className="btn sm"
            style={{
              background: 'var(--amber-600,#C08A2D)',
              color: '#fff',
              border: 'none',
            }}
            onClick={() =>
              faireAvancer(acte.id, 'verifie', {
                titre: 'Simulation — vérification',
                description: "L'acte n'a pas été réellement vérifié (" + acte.objet + ').',
              })
            }
          >
            Vérifier
          </button>
        ) : role === 'Direction' && acte.stage === 'verifie' ? (
          <button
            className="btn sm gold"
            onClick={() =>
              faireAvancer(acte.id, 'valide', {
                titre: 'Simulation — validation',
                description: "Aucune signature électronique n'a été apposée (" + acte.objet + ').',
              })
            }
          >
            {'Valider & signer'}
          </button>
        ) : acte.stage === 'valide' ? (
          <span
            style={{
              fontSize: 11.5,
              color: 'var(--sage-700)',
              fontWeight: 600,
            }}
          >
            Signé ✓
          </span>
        ) : (
          <span
            style={{
              fontSize: 11.5,
              color: 'var(--navy-300)',
            }}
          >
            {acte.stage === 'prepare' ? 'En attente juriste' : 'En attente direction'}
          </span>
        ),
    },
  ]

  return (
    <>
      <PageHead
        eyebrow="Cabinet & supervision"
        title="Circuit de validation"
        lede="Chaque acte suit un circuit : préparé par le gestionnaire ou le comptable, vérifié par le juriste, puis validé et signé par la direction. Les actions dépendent de votre rôle."
        actions={
          <Pill kind="navy" noDot>
            {'Connecté : '}
            {LIBELLES_ROLES_CABINET[role] || role}
          </Pill>
        }
      />
      <Alert kind="info" icon="shield" title={`Vous agissez en tant que « ${role} »`}>
        {role === 'Juridique'
          ? 'Vous pouvez vérifier les actes préparés avant transmission à la direction.'
          : role === 'Direction'
            ? 'Vous pouvez valider et signer les actes vérifiés par le pôle juridique.'
            : 'Changez de rôle dans la barre du haut (Juridique ou Direction) pour agir sur le circuit. En lecture seule pour ce rôle.'}
      </Alert>
      <Kpis
        items={[
          {
            icon: 'pencil',
            num: aVerifier,
            lbl: 'À vérifier',
            sub: 'pôle juridique',
            accent: 'gold',
          },
          {
            icon: 'scale',
            num: aValider,
            lbl: 'À valider & signer',
            sub: 'direction',
            accent: 'amber',
          },
          {
            icon: 'check',
            num: valides,
            lbl: 'Validés',
            accent: 'sage',
          },
          {
            icon: 'clipboard',
            num: actes.length,
            lbl: 'Actes au circuit',
          },
        ]}
      />
      <Panel title="File de validation" sub="préparé → vérifié (juriste) → validé & signé (direction)" icon="check" flush>
        <DataTable rowKey="id" columns={colonnes} rows={actes} />
      </Panel>
    </>
  )
}
