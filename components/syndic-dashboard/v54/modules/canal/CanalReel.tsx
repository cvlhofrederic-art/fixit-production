'use client'

import { useCallback, useRef, useState } from 'react'
import { PageHead } from '../../primitives/page-head'
import { Tabs } from '../../primitives/tabs'
import { Button } from '../../primitives/button'
import { useToast } from '../../primitives/toast'
import Icon from '../../primitives/icon/Icon'
import { useMessages } from '@/lib/syndic/v54/i18n'
import { useSyndicData } from '@/lib/syndic/v54/data-context'
import { fetchCanalPro, fetchSignalements, type ConversationCanalPro, type Signalement } from '@/lib/syndic/v54/api'
import { CANAL_MESSAGES } from '../i18n/ModCanal.messages'
import { CANAL_REEL_MESSAGES } from '../i18n/ModCanalReel.messages'
import { CanalDemandes } from './CanalDemandes'
import { CanalPro } from './CanalPro'
import { CanalInterne } from './CanalInterne'
import { ValiderMissionModal } from './ValiderMissionModal'
import { usePolling } from './use-polling'

/**
 * Canal de communication en données réelles (syndic connecté) — même grille et mêmes styles que la
 * version de démonstration (canal.css). Les demandes des copropriétaires et les conversations
 * prestataires sont rechargées toutes les 15 s tant que l'écran est visible, au retour sur l'onglet
 * et sur « Rafraîchir » ; jamais servies depuis le cache du navigateur.
 */
export function CanalReel() {
  const data = useSyndicData()
  const token = data.token ?? ''
  const tDemo = useMessages(CANAL_MESSAGES)
  const t = useMessages(CANAL_REEL_MESSAGES)
  const { push } = useToast()

  const [signalements, setSignalements] = useState<Signalement[]>(data.signalements ?? [])
  const [conversations, setConversations] = useState<ConversationCanalPro[] | null>(null)
  // Ouverture sur « Demandes » quand des demandes attendent une réponse, sinon sur « Professionnels ».
  const [tab, setTab] = useState(() => ((data.signalements ?? []).some((s) => s.statut === 'en_attente') ? 'ped' : 'pro'))
  const [selSignalement, setSelSignalement] = useState<string | null>(null)
  const [selConversation, setSelConversation] = useState<string | null>(null)
  const [aValider, setAValider] = useState<Signalement | null>(null)
  const erreurSignalee = useRef(false)

  /** Recharge demandes + conversations ; true si les deux ont répondu. */
  const charger = useCallback(async (): Promise<boolean> => {
    if (!token) return false
    const [s, c] = await Promise.allSettled([fetchSignalements(token), fetchCanalPro(token)])
    if (s.status === 'fulfilled') setSignalements(s.value)
    if (c.status === 'fulfilled') setConversations(c.value)
    else setConversations((prev) => prev ?? [])
    return s.status === 'fulfilled' && c.status === 'fulfilled'
  }, [token])

  const chargerAuto = useCallback(() => {
    void charger().then((ok) => {
      if (ok) {
        erreurSignalee.current = false
        return
      }
      // Une seule alerte tant que l'échec persiste ; le rechargement automatique continue.
      if (!erreurSignalee.current) push({ kind: 'error', title: t.erreurChargement, desc: t.erreurChargementDesc })
      erreurSignalee.current = true
    })
  }, [charger, push, t.erreurChargement, t.erreurChargementDesc])
  usePolling(chargerAuto)

  const rafraichir = () => {
    void charger().then((ok) => push(ok
      ? { kind: 'success', title: t.aJour, desc: t.aJourDesc }
      : { kind: 'error', title: t.erreurChargement, desc: t.erreurChargementDesc }))
  }

  const apresValidation = () => {
    chargerAuto()
    data.refresh?.()
  }

  const enAttente = signalements.filter((s) => s.statut === 'en_attente').length
  const missionsActives = (conversations ?? []).filter((c) => c.ordre && c.ordre.statut !== 'termine' && c.ordre.statut !== 'refuse').length

  return (
    <>
      <PageHead
        title={tDemo.titre}
        lede={tDemo.chapeau}
        actions={<Button onClick={rafraichir}><Icon name="refresh" />{t.rafraichir}</Button>}
      />
      <Tabs active={tab} onChange={setTab} tabs={[
        { id: 'pro', label: tDemo.onglets.pro, icon: 'wrench', badge: missionsActives || undefined },
        { id: 'int', label: tDemo.onglets.int, icon: 'building' },
        { id: 'ped', label: tDemo.onglets.ped, icon: 'doc', badge: enAttente || undefined },
      ]} />

      {tab === 'ped' && (
        <CanalDemandes
          signalements={signalements}
          selectedId={selSignalement}
          onSelect={setSelSignalement}
          onValider={setAValider}
          token={token}
          onRafraichir={chargerAuto}
        />
      )}
      {tab === 'pro' && (
        <CanalPro
          conversations={conversations}
          selectedId={selConversation}
          onSelect={setSelConversation}
          token={token}
          onRafraichir={chargerAuto}
          nbEquipe={(data.team ?? []).length}
          onEquipe={() => setTab('int')}
        />
      )}
      {tab === 'int' && <CanalInterne token={token} equipe={data.team ?? []} />}

      <ValiderMissionModal
        open={aValider != null}
        onClose={() => setAValider(null)}
        signalement={aValider}
        artisans={data.artisans}
        token={token}
        onValidee={apresValidation}
      />
    </>
  )
}
