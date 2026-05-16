'use client'

import AgentChatPage from '../AgentChatPage'
import { AGENT_CONFIGS } from '../configs'
import type { User } from '@supabase/supabase-js'

interface UserWithProfile extends User {
  profile?: { country?: string }
}

interface Props {
  user: UserWithProfile
  // Forward au dashboard parent quand Fixy émet `##ACTION##{"type":"navigate",...}##`.
  onNavigate?: (page: string) => void
}

export default function FixyAgentPage({ user, onNavigate }: Props) {
  return <AgentChatPage agentConfig={AGENT_CONFIGS.fixy} user={user} onNavigate={onNavigate} />
}
