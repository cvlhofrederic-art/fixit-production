'use client'

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
}

export function ChantierSelect({ userId, authUserId, orgRole, value, onChange, className }: ChantierSelectProps) {
  const isV5 = orgRole === 'pro_societe' || orgRole === 'artisan'
  const { items: chantiers } = useBTPData<Chantier>({ table: 'chantiers', artisanId: userId, userId: authUserId || userId })

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
      <option value="">Sélectionner un chantier...</option>
      {chantiers.map(c => (
        <option key={c.id} value={c.id}>
          {c.titre}{c.client ? ` — ${c.client}` : ''}
        </option>
      ))}
    </select>
  )
}
