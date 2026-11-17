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
  orgRole?: string
  value: string
  onChange: (chantierId: string, titre: string, client: string) => void
  className?: string
}

export function ChantierSelect({ userId, orgRole, value, onChange, className }: ChantierSelectProps) {
  const isV5 = orgRole === 'pro_societe' || orgRole === 'artisan'
  const isPt = useLocale() === 'pt'
  const { items: chantiers } = useBTPData<Chantier>({ table: 'chantiers', artisanId: userId, userId })

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
