'use client'

import AgentChatPage from '../AgentChatPage'
import { AGENT_CONFIGS } from '../configs'
import type { User } from '@supabase/supabase-js'

interface UserWithProfile extends User {
  profile?: { country?: string }
}

export default function MaxAgentPage({ user }: { user: UserWithProfile }) {
  return <AgentChatPage agentConfig={AGENT_CONFIGS.max} user={user} />
}
