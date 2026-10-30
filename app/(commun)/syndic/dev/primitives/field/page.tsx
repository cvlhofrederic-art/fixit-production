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

export default function FieldShowcasePage() {
  return (
    <div>
      <p style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--v54-gold-700)', fontWeight: 600, marginBottom: 12 }}>
        Primitive · batch 3
      </p>
      <h1 style={{ fontFamily: 'var(--v54-font-serif)', fontWeight: 500, fontSize: 32, margin: 0 }}>Field</h1>
      <p style={{ fontSize: 14, color: 'var(--v54-navy-300)', marginTop: 8, maxWidth: 640 }}>
        Champ de formulaire : label lié à l'enfant (htmlFor↔id), suffixe d'unité, hint, état erreur. Cliquer le
        label met le focus sur le champ.
      </p>

      <h2 style={sectionHeader}>Champs</h2>
      <div style={{ maxWidth: 420 }} data-testid="field-demo">
        <Field label="Nome do condomínio" name="cond-name">
          <input type="text" placeholder="Ex: Residência Lobão" />
        </Field>
        <Field label="Quota mensal" name="cond-quota" suffix="€" hint="Valor por fração autónoma.">
          <input type="number" inputMode="decimal" placeholder="0,00" />
        </Field>
        <Field label="Email do gestor" name="cond-email" required error="Endereço de email inválido.">
          <input type="email" placeholder="gestor@exemplo.pt" />
        </Field>
      </div>

      <h2 style={sectionHeader}>FormRow (2 colonnes)</h2>
      <div style={{ maxWidth: 480 }}>
        <FormRow>
          <Field label="Código postal" name="fld-cp">
            <input type="text" placeholder="4990-000" />
          </Field>
          <Field label="Localidade" name="fld-city">
            <input type="text" placeholder="Ponte de Lima" />
          </Field>
        </FormRow>
        <FormRow>
          <Field label="Observações" name="fld-obs" full>
            <textarea rows={2} placeholder="Notas internas…" />
          </Field>
        </FormRow>
      </div>
    </div>
  )
}
