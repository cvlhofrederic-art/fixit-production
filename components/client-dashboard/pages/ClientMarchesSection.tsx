'use client'

import { useState, useEffect, useCallback } from 'react'
import { Hammer, FileText, MapPin, User, Calendar, ChevronRight } from 'lucide-react'
import { formatPrice } from '@/lib/utils'

interface ClientMarchesSectionProps {
  userId: string | undefined
  locale: string
}

export default function ClientMarchesSection({ userId, locale }: ClientMarchesSectionProps) {
  const [myMarches, setMyMarches] = useState<any[]>([]) // eslint-disable-line @typescript-eslint/no-explicit-any
  const [marchesLoading, setMarchesLoading] = useState(false)

  const fetchMyMarches = useCallback(async (uid: string) => {
    setMarchesLoading(true)
    try {
      const res = await fetch(`/api/marches?publisher_user_id=${uid}`)
      if (res.ok) {
        const data = await res.json()
        setMyMarches(data.marches || [])
      }
    } catch { /* silent */ }
    finally { setMarchesLoading(false) }
  }, [])

  useEffect(() => {
    if (userId && myMarches.length === 0 && !marchesLoading) {
      fetchMyMarches(userId)
    }
  }, [userId, myMarches.length, marchesLoading, fetchMyMarches])

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-display font-black tracking-[-0.02em] flex items-center gap-2">
          <Hammer className="w-5 h-5" />
          {locale === 'pt' ? 'Bolsa de Mercados' : 'Bourse aux Marchés'}
        </h2>
        <p className="text-text-muted text-sm mt-1">
          {locale === 'pt'
            ? 'Publique o seu projeto e receba propostas de artesãos qualificados perto de si.'
            : 'Publiez votre projet et recevez des propositions d\'artisans qualifiés près de chez vous.'}
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-[#EFEFEF] p-5 text-center">
          <div className="text-2xl font-bold text-yellow-600">🏛️</div>
          <div className="text-sm text-text-muted mt-1">{locale === 'pt' ? 'Publique um projeto' : 'Publiez un projet'}</div>
        </div>
        <div className="bg-white rounded-2xl border border-[#EFEFEF] p-5 text-center">
          <div className="text-2xl font-bold text-blue-600">📍</div>
          <div className="text-sm text-text-muted mt-1">{locale === 'pt' ? 'Artesãos próximos notificados' : 'Artisans proches notifiés'}</div>
        </div>
        <div className="bg-white rounded-2xl border border-[#EFEFEF] p-5 text-center">
          <div className="text-2xl font-bold text-green-600">✅</div>
          <div className="text-sm text-text-muted mt-1">{locale === 'pt' ? 'Escolha a melhor proposta' : 'Choisissez la meilleure offre'}</div>
        </div>
      </div>

      {/* CTA to publish */}
      <div className="bg-white rounded-2xl border-[1.5px] border-[#EFEFEF] shadow-[0_4px_30px_rgba(0,0,0,0.08)] p-6 md:p-8 mb-6">
        <h3 className="font-display font-bold text-lg mb-3">
          {locale === 'pt' ? '📋 Publique o seu projeto' : '📋 Publiez votre projet'}
        </h3>
        <p className="text-text-muted text-sm mb-5">
          {locale === 'pt'
            ? 'Descreva os trabalhos necessários e receba até 3 propostas de artesãos certificados próximos de si. Gratuito e sem compromisso.'
            : 'Décrivez les travaux nécessaires et recevez jusqu\'à 3 propositions d\'artisans certifiés proches de chez vous. Gratuit et sans engagement.'}
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <a
            href={locale === 'pt' ? '/pt/mercados/publicar' : '/marches/publier'}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full font-bold text-sm transition-all"
            style={{ background: '#FFC107', color: '#1A1A1A', boxShadow: '0 4px 14px rgba(255,214,0,0.3)' }}
          >
            <Hammer className="w-4 h-4" />
            {locale === 'pt' ? 'Publicar um apelo a concurso' : 'Publier un appel d\'offres'}
          </a>
        </div>
      </div>

      {/* How it works */}
      <div className="bg-white rounded-2xl border-[1.5px] border-[#EFEFEF] shadow-[0_4px_30px_rgba(0,0,0,0.08)] p-6 md:p-8">
        <h3 className="font-display font-bold text-lg mb-4">
          {locale === 'pt' ? '🔄 Como funciona?' : '🔄 Comment ça marche ?'}
        </h3>
        <div className="space-y-4">
          <div className="flex gap-4 items-start">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0" style={{ background: '#FFF8E1', color: '#F9A825' }}>1</div>
            <div>
              <p className="font-semibold text-sm">{locale === 'pt' ? 'Descreva o seu projeto' : 'Décrivez votre projet'}</p>
              <p className="text-text-muted text-xs">{locale === 'pt' ? 'Tipo de trabalho, orçamento, prazo, exigências (RC Pro, RGE...)' : 'Type de travaux, budget, délai, exigences (RC Pro, RGE...)'}</p>
            </div>
          </div>
          <div className="flex gap-4 items-start">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0" style={{ background: '#E3F2FD', color: '#1565C0' }}>2</div>
            <div>
              <p className="font-semibold text-sm">{locale === 'pt' ? 'Artesãos próximos são notificados' : 'Les artisans proches sont notifiés'}</p>
              <p className="text-text-muted text-xs">{locale === 'pt' ? 'Apenas artesãos qualificados e disponíveis na sua zona recebem o pedido' : 'Seuls les artisans qualifiés et disponibles dans votre zone reçoivent la demande'}</p>
            </div>
          </div>
          <div className="flex gap-4 items-start">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0" style={{ background: '#E8F5E9', color: '#2E7D32' }}>3</div>
            <div>
              <p className="font-semibold text-sm">{locale === 'pt' ? 'Compare e escolha' : 'Comparez et choisissez'}</p>
              <p className="text-text-muted text-xs">{locale === 'pt' ? 'Receba até 3 propostas, consulte os perfis, e escolha o melhor artesão' : 'Recevez jusqu\'à 3 propositions, consultez les profils, et choisissez le meilleur artisan'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* My published marches */}
      <div className="mt-6">
        <h3 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5" />
          {locale === 'pt' ? 'Os meus pedidos publicados' : 'Mes appels d\'offres publiés'}
        </h3>

        {marchesLoading ? (
          <div className="text-center py-8 text-text-muted text-sm animate-pulse">
            {locale === 'pt' ? 'A carregar...' : 'Chargement...'}
          </div>
        ) : myMarches.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#EFEFEF] p-8 text-center">
            <div className="text-3xl mb-3">📭</div>
            <p className="text-text-muted text-sm">
              {locale === 'pt'
                ? 'Ainda não publicou nenhum pedido de orçamento.'
                : 'Vous n\'avez pas encore publié d\'appel d\'offres.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {myMarches.map((m: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
              const statusColors: Record<string, string> = {
                open: 'bg-green-100 text-green-700',
                awarded: 'bg-blue-100 text-blue-700',
                closed: 'bg-gray-100 text-gray-600',
                cancelled: 'bg-red-100 text-red-600',
              }
              const statusLabels: Record<string, string> = locale === 'pt'
                ? { open: 'Aberto', awarded: 'Atribuído', closed: 'Fechado', cancelled: 'Cancelado' }
                : { open: 'Ouvert', awarded: 'Attribué', closed: 'Clôturé', cancelled: 'Annulé' }
              const catObj = [
                { id: 'canalizacao', fr: 'Plomberie', pt: 'Canalização' },
                { id: 'eletricidade', fr: 'Électricité', pt: 'Eletricidade' },
                { id: 'pintura', fr: 'Peinture', pt: 'Pintura' },
                { id: 'construcao', fr: 'Construction', pt: 'Construção' },
                { id: 'climatizacao', fr: 'Climatisation', pt: 'Climatização' },
                { id: 'renovacao', fr: 'Rénovation', pt: 'Renovação' },
              ].find(c => c.id === m.category)
              const catLabel = catObj ? (locale === 'pt' ? catObj.pt : catObj.fr) : m.category

              return (
                <div key={m.id} className="bg-white rounded-2xl border-[1.5px] border-[#EFEFEF] p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h4 className="font-bold text-sm truncate">{m.title}</h4>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${statusColors[m.status] || 'bg-gray-100 text-gray-600'}`}>
                        {statusLabels[m.status] || m.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-text-muted flex-wrap">
                      <span>{catLabel}</span>
                      {m.location_city && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{m.location_city}</span>}
                      {m.budget_min != null && m.budget_max != null && (
                        <span>{formatPrice(m.budget_min)} – {formatPrice(m.budget_max)}</span>
                      )}
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {m.candidatures_count || 0} {locale === 'pt' ? 'candidaturas' : 'candidatures'}
                      </span>
                      {m.deadline && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(m.deadline).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR')}</span>}
                    </div>
                  </div>
                  <a
                    href={`${locale === 'pt' ? '/pt/mercados/gerir' : '/fr/marches/gerer'}?id=${m.id}&token=${m.access_token}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all flex-shrink-0"
                    style={{ background: '#FFC107', color: '#1A1A1A' }}
                  >
                    {locale === 'pt' ? 'Gerir' : 'Gérer'}
                    <ChevronRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
