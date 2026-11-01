import { Field } from '@/components/syndic-dashboard/v54/primitives/field'
import { FormRow } from '@/components/syndic-dashboard/v54/primitives/form-row'

const sectionHeader: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: 'var(--v54-gold-700)',
  fontWeight: 600,
  margin: '32px 0 16px',
}

export default function FormRowShowcasePage() {
  return (
    <div>
      <p style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--v54-gold-700)', fontWeight: 600, marginBottom: 12 }}>
        Primitive · batch 3
      </p>
      <h1 style={{ fontFamily: 'var(--v54-font-serif)', fontWeight: 500, fontSize: 32, margin: 0 }}>FormRow</h1>
      <p style={{ fontSize: 14, color: 'var(--v54-navy-300)', marginTop: 8, maxWidth: 640 }}>
        Grille 2 colonnes (`.field-row`, 1fr/1fr, gap 14px) pour aligner des Field. Un Field `full` occupe toute
        la largeur.
      </p>

      <h2 style={sectionHeader}>Exemple</h2>
      <div style={{ maxWidth: 480 }} data-testid="form-row-demo">
        <FormRow>
          <Field label="Início" name="fr-start">
            <input type="date" />
          </Field>
          <Field label="Fim" name="fr-end">
            <input type="date" />
          </Field>
        </FormRow>
        <FormRow>
          <Field label="Motivo" name="fr-note" full>
            <input type="text" placeholder="Descrição…" />
          </Field>
        </FormRow>
      </div>
    </div>
  )
}
