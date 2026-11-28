'use client'

import { useLocale } from '@/lib/i18n/context'
import { useBTPData } from '@/lib/hooks/use-btp-data'

interface Chantier {
  id: string
  titre: string
  client: string
}

interface ChantierSelectProps {
  userId: string
  /** Identifiant du compte : clé de cache des chantiers, la même que l'écran Chantiers (constat donnees-btp-15). */
  authUserId?: string
  orgRole?: string
  value: string
  onChange: (chantierId: string, titre: string, client: string) => void
  className?: string
  /**
   * Nom accessible du champ. Les écrans qui posent un `<label>` FRÈRE, sans `htmlFor`, ne l'associent pas au
   * `<select>` : un lecteur d'écran n'annonce alors que « liste déroulante ». À renseigner dans ce cas.
   */
  ariaLabel?: string
  /**
   * Faux pour un écran qui ne fait que LIRE. Par défaut, `useBTPData` peut envoyer un POST d'import des anciens
   * chantiers du navigateur vers la base : acceptable depuis l'écran Chantiers, pas depuis un formulaire de devis,
   * qui créerait des chantiers en base au simple fait d'être ouvert.
   */
  autoImport?: boolean
  /**
   * Faux pour un écran où une liste de chantiers n'est qu'un champ accessoire. `useBTPData` annonce sinon un
   * échec de chargement par un toast rouge, ce qui, au milieu de la saisie d'un devis, se lit « mon devis ne
   * s'est pas chargé » — et pousse à recommencer une saisie qui n'a rien perdu. Les écrans dont les chantiers
   * SONT le sujet gardent l'alerte, qui y est utile.
   */
  annoncerEchecs?: boolean
}

export function ChantierSelect({
  userId, authUserId, orgRole, value, onChange, className, ariaLabel, autoImport, annoncerEchecs,
}: ChantierSelectProps) {
  const isV5 = orgRole === 'pro_societe' || orgRole === 'artisan'
  const isPt = useLocale() === 'pt'
  const { items: chantiers } = useBTPData<Chantier>({
    table: 'chantiers', artisanId: userId, userId: authUserId || userId,
    ...(autoImport === undefined ? {} : { autoImport }),
    ...(annoncerEchecs === undefined ? {} : { annoncerEchecs }),
  })

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = chantiers.find(c => c.id === e.target.value)
    if (selected) {
      onChange(selected.id, selected.titre, selected.client)
    } else {
      onChange('', '', '')
    }
  }

  const defaultClass = isV5 ? 'v5-fi' : 'v22-form-input'

  return (
    <select
      className={className ?? defaultClass}
      aria-label={ariaLabel}
      value={value}
      onChange={handleChange}
    >
      <option value="">{isPt ? 'Selecionar uma obra...' : 'Sélectionner un chantier...'}</option>
      {chantiers.map(c => (
        <option key={c.id} value={c.id}>
          {c.titre}{c.client ? `${isPt ? ' · ' : ' — '}${c.client}` : ''}
        </option>
      ))}
    </select>
  )
}
