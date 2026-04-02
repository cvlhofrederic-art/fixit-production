'use client'

import React, { useState } from 'react'
import type { User } from '@supabase/supabase-js'
import type { SignatureData } from '../types'
import { ROLE_COLORS, getRoleLabel } from '../types'
import { TOAST_SHORT } from '@/lib/constants'
import GmailConnectButton from '@/components/syndic-dashboard/communication/GmailConnectButton'

interface ParametresSectionProps {
  user: User | null
  locale: string
  t: (key: string) => string
  userRole: string
  userName: string
  initials: string
  cabinetNom: string
  setCabinetNom: (v: string) => void
  cabinetEmail: string
  setCabinetEmail: (v: string) => void
  cabinetAddress: string
  setCabinetAddress: (v: string) => void
  cabinetLogo: string | null
  setCabinetLogo: (v: string | null) => void
  syndicSignature: SignatureData | null
  setSyndicSignature: (v: SignatureData | null) => void
  showSignatureModal: boolean
  setShowSignatureModal: (v: boolean) => void
}

export default function ParametresSection({
  user,
  locale,
  t,
  userRole,
  userName,
  initials,
  cabinetNom,
  setCabinetNom,
  cabinetEmail,
  setCabinetEmail,
  cabinetAddress,
  setCabinetAddress,
  cabinetLogo,
  setCabinetLogo,
  syndicSignature,
  setSyndicSignature,
  showSignatureModal,
  setShowSignatureModal,
}: ParametresSectionProps) {
  // ── Internal state ──
  const [notifSettings, setNotifSettings] = useState([
    { label: locale === 'pt' ? 'Alertas RC Pro expirados' : 'Alertes RC Pro expirées', checked: true },
    { label: locale === 'pt' ? 'Controlos regulamentares iminentes' : 'Contrôles réglementaires imminents', checked: true },
    { label: locale === 'pt' ? 'Novas missões criadas' : 'Nouvelles missions créées', checked: true },
    { label: locale === 'pt' ? 'Sinalizações de condóminos' : 'Signalements copropriétaires', checked: false },
    { label: locale === 'pt' ? 'Resumo semanal' : 'Résumé hebdomadaire', checked: true },
  ])
  const [paramSaved, setParamSaved] = useState(false)

  // ── Handlers ──
  const handleSaveParams = () => {
    if (user) {
      if (cabinetAddress) localStorage.setItem(`fixit_syndic_address_${user.id}`, cabinetAddress)
      if (cabinetLogo) localStorage.setItem(`fixit_syndic_logo_${user.id}`, cabinetLogo)
      if (syndicSignature) localStorage.setItem(`fixit_syndic_signature_${user.id}`, JSON.stringify(syndicSignature))
    }
    setParamSaved(true)
    setTimeout(() => setParamSaved(false), TOAST_SHORT)
  }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 200 * 1024) {
      alert(locale === 'pt' ? 'O logo deve ter menos de 200KB' : 'Le logo doit faire moins de 200KB')
      return
    }
    if (!file.type.startsWith('image/')) {
      alert(locale === 'pt' ? 'Apenas imagens (PNG, JPG)' : 'Images uniquement (PNG, JPG)')
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      const b64 = ev.target?.result as string
      setCabinetLogo(b64)
      if (user) localStorage.setItem(`fixit_syndic_logo_${user.id}`, b64)
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="max-w-2xl space-y-6">

      {/* ── Section Mon Profil (visible par TOUS les utilisateurs) ── */}
      <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <span className="text-xl">👤</span> {locale === 'pt' ? 'O Meu Perfil' : 'Mon Profil'}
        </h2>
        <div className="space-y-4">
          {/* Nom + Rôle */}
          <div className="flex items-center gap-4 bg-gray-50 rounded-xl p-4">
            <div className="w-12 h-12 rounded-full bg-[#0D1B2E] text-white flex items-center justify-center font-bold text-lg">{initials}</div>
            <div>
              <p className="font-semibold text-gray-900">{userName}</p>
              <span className={`inline-block mt-1 text-xs font-medium px-2.5 py-0.5 rounded-full ${ROLE_COLORS[userRole] || 'bg-gray-100 text-gray-800'}`}>
                {getRoleLabel(userRole, locale === 'pt' ? 'pt' : 'fr')}
              </span>
            </div>
          </div>
          {/* Ma signature digitale */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{locale === 'pt' ? 'A minha assinatura digital' : 'Ma signature digitale'}</label>
            <div className="flex items-center gap-4">
              {syndicSignature ? (
                <div className="relative">
                  <div className="border border-gray-200 rounded-lg bg-white p-2" style={{ width: 200, height: 80 }} dangerouslySetInnerHTML={{ __html: syndicSignature.svg_data.replace(/width="400"/, 'width="200"').replace(/height="160"/, 'height="80"') }} />
                  <div className="text-[10px] text-gray-500 mt-1">{syndicSignature.signataire} — {new Date(syndicSignature.timestamp).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR')}</div>
                  <button onClick={() => { setSyndicSignature(null); if (user) localStorage.removeItem(`fixit_syndic_signature_${user.id}`) }} className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600">×</button>
                </div>
              ) : null}
              <button
                onClick={() => setShowSignatureModal(true)}
                className="bg-gray-50 hover:bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-600 transition"
              >
                ✍️ {syndicSignature ? (locale === 'pt' ? 'Refazer assinatura' : 'Refaire la signature') : (locale === 'pt' ? 'Desenhar a minha assinatura' : 'Dessiner ma signature')}
              </button>
            </div>
            {!syndicSignature && (
              <p className="text-xs text-amber-600 mt-2">⚠️ {locale === 'pt' ? 'Nenhuma assinatura configurada — os PDFs gerados não terão assinatura.' : 'Aucune signature configurée — les PDF générés n\'auront pas de signature.'}</p>
            )}
          </div>
          <button onClick={() => { if (syndicSignature && user) { localStorage.setItem(`fixit_syndic_signature_${user.id}`, JSON.stringify(syndicSignature)); setParamSaved(true); setTimeout(() => setParamSaved(false), TOAST_SHORT) } }} className="bg-[#0D1B2E] hover:bg-[#152338] text-white px-5 py-2 rounded-lg font-semibold transition text-sm">
            {locale === 'pt' ? 'Guardar assinatura' : 'Enregistrer la signature'}
          </button>
        </div>
      </div>

      {/* ── Section Mon Cabinet (admin=syndic/syndic_admin uniquement) ── */}
      {(userRole === 'syndic' || userRole === 'syndic_admin') && (
      <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <span className="text-xl">🏢</span> {locale === 'pt' ? 'O Meu Gabinete' : 'Mon Cabinet'}
        </h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{locale === 'pt' ? 'Nome do gabinete' : 'Nom du cabinet'}</label>
            <input
              type="text"
              value={cabinetNom}
              onChange={e => setCabinetNom(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none"
              placeholder={locale === 'pt' ? 'Ex: Administração Silva & Associados' : 'Ex : Syndic Dupont & Associés'}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={cabinetEmail}
              onChange={e => setCabinetEmail(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{locale === 'pt' ? 'Morada do gabinete' : 'Adresse du cabinet'}</label>
            <textarea
              value={cabinetAddress}
              onChange={e => setCabinetAddress(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none resize-none"
              placeholder={locale === 'pt' ? 'Ex: Rua das Flores 123, 1000-001 Lisboa' : 'Ex : 12 rue de la Paix, 75002 Paris'}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{locale === 'pt' ? 'Logo do gabinete' : 'Logo du cabinet'}</label>
            <div className="flex items-center gap-4">
              {cabinetLogo && (
                <div className="relative">
                  <img src={cabinetLogo} alt="Logo" loading="lazy" width={64} height={64} className="w-16 h-16 object-contain border border-gray-200 rounded-lg bg-white p-1" />
                  <button onClick={() => { setCabinetLogo(null); if (user) localStorage.removeItem(`fixit_syndic_logo_${user.id}`) }} className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600">×</button>
                </div>
              )}
              <label className="cursor-pointer bg-gray-50 hover:bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-600 transition">
                📷 {cabinetLogo ? (locale === 'pt' ? 'Alterar logo' : 'Changer le logo') : (locale === 'pt' ? 'Carregar logo (PNG/JPG, max 200KB)' : 'Charger un logo (PNG/JPG, max 200KB)')}
                <input type="file" accept="image/png,image/jpeg" onChange={handleLogoUpload} className="hidden" />
              </label>
            </div>
            {!cabinetLogo && (
              <p className="text-xs text-amber-600 mt-2">⚠️ {locale === 'pt' ? 'Nenhum logo configurado — os PDFs gerados não terão logo.' : 'Aucun logo configuré — les PDF générés n\'auront pas de logo.'}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleSaveParams} className="bg-[#0D1B2E] hover:bg-[#152338] text-white px-6 py-2.5 rounded-lg font-semibold transition">
              {t('syndicDash.settings.saveChanges')}
            </button>
            {paramSaved && (
              <span className="text-green-600 text-sm font-medium flex items-center gap-1">
                ✅ {t('syndicDash.common.save')} !
              </span>
            )}
          </div>
        </div>
      </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
        <h2 className="text-lg font-bold text-gray-900 mb-4">{locale === 'pt' ? 'Subscrição' : 'Abonnement'}</h2>
        <div className="bg-[#F7F4EE] border border-[#E4DDD0] rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-[#0D1B2E]">{locale === 'pt' ? 'Teste gratuito' : 'Essai gratuit'}</p>
              <p className="text-sm text-[#C9A84C]">{locale === 'pt' ? '14 dias restantes · Acesso completo' : '14 jours restants · Accès complet'}</p>
            </div>
            <span className="bg-[#0D1B2E] text-white text-xs font-bold px-3 py-1 rounded-full">TRIAL</span>
          </div>
        </div>
        <button className="w-full bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 py-3 rounded-lg font-bold transition">
          {locale === 'pt' ? 'Escolher uma subscrição → a partir de 49€/mês' : 'Choisir un abonnement → à partir de 49€/mois'}
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
        <h2 className="text-lg font-bold text-gray-900 mb-4">📧 {locale === 'pt' ? 'Agente Email Fixy' : 'Agent Email Fixy'}</h2>
        <p className="text-sm text-gray-500 mb-4">{locale === 'pt' ? 'Conecte a sua caixa Gmail para que o Fixy analise automaticamente os seus emails: urgências, tipos de pedidos, sugestões de ações.' : 'Connectez votre boîte Gmail pour que Fixy analyse automatiquement vos emails : urgences, types de demandes, suggestions d\'actions.'}</p>
        <GmailConnectButton syndicId={user?.id} userEmail={user?.email} />
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
        <h2 className="text-lg font-bold text-gray-900 mb-4">{t('syndicDash.common.notifications')}</h2>
        {notifSettings.map((n, idx) => (
          <div key={n.label} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
            <span className="text-sm text-gray-700">{n.label}</span>
            <button
              onClick={() => setNotifSettings(prev => prev.map((item, i) => i === idx ? { ...item, checked: !item.checked } : item))}
              className={`w-11 h-6 rounded-full transition-all cursor-pointer relative ${n.checked ? 'bg-[#0D1B2E]' : 'bg-gray-200'}`}
              aria-label={`Activer/désactiver ${n.label}`}
            >
              <div className={`w-5 h-5 bg-white rounded-full shadow absolute top-0.5 transition-all`} style={{ left: n.checked ? '22px' : '2px' }} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
