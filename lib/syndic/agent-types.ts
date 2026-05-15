// lib/syndic/agent-types.ts

export type AgentId = 'fixy' | 'max' | 'lea' | 'alfredo' | 'tempo'

export type SyndicRole =
  | 'syndic'
  | 'syndic_admin'
  | 'syndic_tech'
  | 'syndic_secretaire'
  | 'syndic_gestionnaire'
  | 'syndic_comptable'
  | 'syndic_juriste'

export type Locale = 'fr' | 'pt'

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool'

export interface Conversation {
  id: string
  syndic_id: string
  agent_id: AgentId
  locale: Locale
  title: string
  immeuble_id: string | null
  message_count: number
  last_message_preview: string | null
  created_at: string
  updated_at: string
  archived_at: string | null
}

export interface ToolCall {
  tool_name: string
  arguments: Record<string, unknown>
  result?: Record<string, unknown>
  status: 'pending' | 'confirmed' | 'cancelled' | 'executed' | 'error'
}

export interface Message {
  id: string
  conversation_id: string
  role: MessageRole
  content: string
  tool_calls: ToolCall[] | null
  metadata: {
    model?: string
    tokens_in?: number
    tokens_out?: number
    latency_ms?: number
    langfuse_trace_id?: string
    sources_cited?: Array<{ type: string; ref: string; url?: string }>
  } | null
  created_at: string
}

export interface ToolDescriptor {
  name: string
  label: { fr: string; pt: string }
  description: { fr: string; pt: string }
  requiresConfirmation: boolean
  allowedRoles: SyndicRole[]
}

export interface AgentConfig {
  id: AgentId
  displayName: { fr: string; pt: string }
  tagline: { fr: string; pt: string }
  avatarEmoji: string
  accentColor: string
  endpoint: string
  streaming: boolean
  voice: boolean
  fileUpload?: { accept: string; maxSizeMB: number }
  suggestedPrompts: { fr: string[]; pt: string[] }
  toolDescriptors: ToolDescriptor[]
  allowedRoles: SyndicRole[]
  crossAgentReferrals: AgentId[]
}
