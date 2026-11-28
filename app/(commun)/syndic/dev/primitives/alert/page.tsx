import { Alert } from '@/components/syndic-dashboard/v54/primitives/alert'

const sectionHeader: React.CSSProperties = {
  fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase',
  color: 'var(--v54-gold-700)', fontWeight: 600, margin: '32px 0 16px',
}

export default function AlertShowcasePage() {
  return (
    <div>
      <p style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--v54-gold-700)', fontWeight: 600, marginBottom: 12 }}>
        Primitive · batch 4
      </p>
      <h1 style={{ fontFamily: 'var(--v54-font-serif)', fontWeight: 500, fontSize: 32, margin: 0 }}>Alert</h1>
      <p style={{ fontSize: 14, color: 'var(--v54-navy-300)', marginTop: 8, maxWidth: 640 }}>
        Encart : 4 kinds (amber défaut / rust / sage / gold). Children rendus dans un `&lt;p&gt;` (inline-safe).
      </p>

      <h2 style={sectionHeader}>Les 4 kinds</h2>
      <div style={{ maxWidth: 520 }} data-testid="alert-demo">
        <Alert title="Aviso (amber, défaut)" icon="alert">Mensagem de aviso padrão.</Alert>
        <Alert kind="rust" title="Erro (rust)" icon="ban">Algo correu mal, verifique os dados.</Alert>
        <Alert kind="sage" title="Sucesso (sage)" icon="check">Operação concluída com êxito.</Alert>
        <Alert kind="gold" title="Informação (gold)" icon="info">Nota premium para o gestor.</Alert>
      </div>
    </div>
  )
}
