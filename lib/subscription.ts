import { supabaseAdmin } from '@/lib/supabase-server'

export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing' | 'none'

export interface UserSubscription {
  plan_id: string
  status: SubscriptionStatus
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
}

export async function getUserSubscription(userId: string): Promise<UserSubscription | null> {
  const { data } = await supabaseAdmin
    .from('subscriptions')
    .select('plan_id, status, stripe_customer_id, stripe_subscription_id, current_period_end, cancel_at_period_end')
    .eq('user_id', userId)
    .single()
  return data as UserSubscription | null
}

export async function upsertSubscription(userId: string, sub: Partial<UserSubscription> & { plan_id: string }) {
  const { error } = await supabaseAdmin
    .from('subscriptions')
    .upsert({
      user_id: userId,
      ...sub,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
  if (error) console.error('[subscription] upsert error:', error)
}

export async function requirePlan(userId: string, minPlan: string): Promise<boolean> {
  const sub = await getUserSubscription(userId)
  if (!sub || sub.status !== 'active') return minPlan === 'artisan_starter'
  const hierarchy = ['artisan_starter', 'artisan_pro', 'syndic_essential', 'syndic_premium']
  return hierarchy.indexOf(sub.plan_id) >= hierarchy.indexOf(minPlan)
}
