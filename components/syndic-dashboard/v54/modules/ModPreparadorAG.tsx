'use client'

import { PageHead } from '../primitives/page-head'
import { Panel } from '../primitives/panel'
import { Empty } from '../primitives/empty'
import { Button } from '../primitives/button'
import Icon from '../primitives/icon/Icon'
import { useComingSoon } from './use-coming-soon'
import { useMessages } from '@/lib/syndic/v54/i18n'
import { PREPARADOR_AG_MESSAGES } from './i18n/ModPreparadorAG.messages'

/** Preparador AG — port byte-exact du ModPreparadorAG du bundle V5.7. */

export default function ModPreparadorAG() {
  const soon = useComingSoon()
  const t = useMessages(PREPARADOR_AG_MESSAGES)
  return (
    <>
      <PageHead
        title={t.titre}
        lede={t.chapeau}
        actions={<Button onClick={soon(t.nouvelleAg, t.enDeveloppement)}><Icon name="plus" />{t.nouvelleAgBouton}</Button>}
      />
      <Panel>
        <Empty
          illustration="ag"
          title={t.vide.titre}
          desc={t.vide.desc}
          action={<Button variant="primary" onClick={soon(t.vide.toast, t.enDeveloppement)}>{t.vide.action}</Button>}
        />
      </Panel>
    </>
  )
}
