'use client'

import { PageHead } from '../primitives/page-head'
import { Panel } from '../primitives/panel'
import { Button } from '../primitives/button'
import Icon from '../primitives/icon/Icon'

/** Emails Fixy — port byte-exact du ModEmailsFixy du bundle V5.7. */

export default function ModEmailsFixy() {
  return (
    <>
      <PageHead
        title="Emails Fixy"
        lede="Análise IA da sua caixa de email · 0 emails"
        actions={<>
          <Button><Icon name="chat" />Lista</Button>
          <Button><Icon name="chart" />Relatório</Button>
          <Button variant="gold"><Icon name="sparkle" />Analisar agora</Button>
        </>}
      />
      <Panel>
        <div style={{ textAlign: 'center', padding: '60px 24px' }}>
          <div style={{ color: 'var(--v54-gold-500)', marginBottom: 14, display: 'flex', justifyContent: 'center' }}><Icon name="mail" style={{ width: 54, height: 54 }} /></div>
          <div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 24, marginBottom: 8 }}>Ligue a sua caixa Gmail</div>
          <div style={{ fontSize: 13, color: 'var(--v54-navy-300)', maxWidth: 480, margin: '0 auto 24px' }}>O Fixy irá analisar automaticamente todos os emails recebidos — urgências, tipos de pedido, sugestões de ações e rascunhos de resposta.</div>
          <Button variant="primary">Ligar Gmail</Button>
        </div>
      </Panel>
    </>
  )
}
