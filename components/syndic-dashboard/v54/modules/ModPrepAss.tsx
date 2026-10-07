'use client'

import { PageHead } from '../primitives/page-head'
import { Alert } from '../primitives/alert'
import { Panel } from '../primitives/panel'
import { Empty } from '../primitives/empty'
import { Button } from '../primitives/button'
import Icon from '../primitives/icon/Icon'
import { useComingSoon } from './use-coming-soon'
import { useMessages } from '@/lib/syndic/v54/i18n'
import { PREP_ASS_MESSAGES } from './i18n/ModPrepAss.messages'

/** Preparador de Assembleia — port byte-exact du ModPrepAss du bundle V5.7. */

export default function ModPrepAss() {
  const soon = useComingSoon()
  const t = useMessages(PREP_ASS_MESSAGES)
  return (
    <>
      <PageHead
        title={t.titre}
        lede={t.chapeau}
        actions={<Button variant="gold" onClick={soon(t.nouvelleAssemblee, t.enDeveloppement)}><Icon name="plus" />{t.nouvelleAssemblee}</Button>}
      />
      <Alert kind="gold" icon="scale" title={t.cadre.titre}>
        {t.cadre.texte}
      </Alert>
      <Panel>
        <Empty
          illustration="ag"
          title={t.vide.titre}
          desc={t.vide.desc}
          action={<Button variant="primary" onClick={soon(t.vide.action, t.enDeveloppement)}>{t.vide.action}</Button>}
        />
      </Panel>
    </>
  )
}
