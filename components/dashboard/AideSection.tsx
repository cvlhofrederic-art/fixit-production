'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { useThemeVars } from './useThemeVars'

type OrgRole = 'artisan' | 'pro_societe' | 'pro_conciergerie' | 'pro_gestionnaire'

interface AideSectionProps {
  navigateTo: (page: string) => void
  orgRole?: OrgRole
}

const FAQ_ITEMS_ARTISAN = [
  { q: 'Comment cr\u00E9er un devis ?', a: 'Depuis la sidebar, cliquez sur Devis puis + Nouveau devis. Renseignez le client, la prestation et le montant HT. Le devis est g\u00E9n\u00E9r\u00E9 automatiquement et peut \u00EAtre envoy\u00E9 par email.' },
  { q: 'Comment valider un ordre de mission ?', a: 'Rendez-vous dans Ordres de mission (Communication), cliquez sur l\'ordre concern\u00E9. Dans le panel Actions, cliquez sur Valider la mission. Vous pouvez saisir votre heure d\'arriv\u00E9e et associer des documents.' },
  { q: 'Comment renouveler un document de conformit\u00E9 ?', a: 'Dans Wallet Conformit\u00E9 (Profil Pro), les documents proches de l\'expiration sont mis en \u00E9vidence. Cliquez sur Renouveler \u00E0 c\u00F4t\u00E9 du document concern\u00E9.' },
  { q: 'Comment activer ou d\u00E9sactiver un module ?', a: 'Dans Modules (Compte), vous pouvez activer ou d\u00E9sactiver chaque module via le toggle ON/OFF. Les modules d\u00E9sactiv\u00E9s disparaissent de votre sidebar.' },
  { q: 'Mon lien de r\u00E9servation est-il personnalisable ?', a: 'Votre lien est automatiquement g\u00E9n\u00E9r\u00E9 depuis votre nom de profil. Pour le modifier, changez votre nom dans Param\u00E8tres \u2192 Profil et sauvegardez.' },
  { q: 'Comment exporter mes donn\u00E9es ?', a: 'Depuis Statistiques ou le tableau de bord, cliquez sur Exporter. Choisissez le format (PDF, Excel, CSV) et la p\u00E9riode souhait\u00E9e.' },
]

const FAQ_ITEMS_SOCIETE = [
  { q: 'Comment cr\u00E9er une situation de travaux ?', a: 'Allez dans "Situations de travaux", cliquez sur "\u00C9mettre situation". S\u00E9lectionnez le chantier, renseignez l\'avancement par lot, la retenue de garantie est calcul\u00E9e automatiquement (5%).' },
  { q: 'Comment fonctionne le pointage GPS ?', a: 'Chaque employ\u00E9 pointe via l\'app mobile. Le GPS v\u00E9rifie qu\'il est bien sur le chantier assign\u00E9. Vert = sur site, Orange = zone tampon (500m), Rouge = hors zone.' },
  { q: 'Comment remplir un formulaire DC4 ?', a: 'Dans "Sous-traitance DC4", cliquez "+ Nouveau DC4". Renseignez le sous-traitant, le chantier, le montant et le pourcentage. Le formulaire respecte le format r\u00E9glementaire des march\u00E9s publics.' },
  { q: 'Comment suivre la rentabilit\u00E9 d\'un chantier ?', a: 'Section "Rentabilit\u00E9 Chantier" : comparaison budget pr\u00E9vu vs r\u00E9alis\u00E9, ventilation par poste (MO, mat\u00E9riaux, sous-traitance). Alertes automatiques en cas de d\u00E9passement.' },
  { q: 'Comment contacter le support ?', a: 'Email : support@vitfix.io \u2022 T\u00E9l : 04 91 00 00 00 \u2022 Chat Fixy 24/7 (bouton jaune en bas \u00E0 droite).' },
]

export default function AideSection({ navigateTo, orgRole = 'artisan' }: AideSectionProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const isSociete = orgRole === 'pro_societe' || orgRole === 'artisan'
  const isV5 = isSociete
  const tv = useThemeVars(isV5)
  const FAQ_ITEMS = isSociete ? FAQ_ITEMS_SOCIETE : FAQ_ITEMS_ARTISAN

  // ═══════════════════════════════════════════════════════
  // V5 RENDER — pro_societe uses the v5 design system
  // ═══════════════════════════════════════════════════════
  if (isSociete) {
    return (
      <div className="v5-fade">
        <div className="v5-pg-t">
          <h1>Aide</h1>
          <p>Centre d&apos;assistance VITFIX &mdash; Soci&eacute;t&eacute; BTP</p>
        </div>

        {/* Getting started card */}
        <div className="v5-card" style={{ marginBottom: '1rem' }}>
          <div className="v5-st">Guide de d&eacute;marrage rapide</div>
          <div style={{ fontSize: 12, color: '#666', lineHeight: 1.6 }}>
            1. Compl&eacute;tez votre <strong>profil entreprise</strong> (SIRET, certifications, effectif)<br />
            2. Cr&eacute;ez vos <strong>chantiers</strong> et assignez vos <strong>&eacute;quipes</strong><br />
            3. Configurez vos <strong>lots/prestations</strong> avec prix unitaires<br />
            4. Uploadez vos <strong>documents de conformit&eacute;</strong><br />
            5. Commencez &agrave; &eacute;mettre des <strong>situations de travaux</strong> et <strong>factures</strong> !
          </div>
        </div>

        {/* FAQ accordion */}
        <div className="v5-st" style={{ marginBottom: '.5rem' }}>Questions fr&eacute;quentes</div>
        {FAQ_ITEMS.map((item, i) => (
          <div key={i} className={`v5-faq-i${openFaq === i ? ' open' : ''}`}>
            <div className="v5-faq-q" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
              <span>{item.q}</span>
              <span className="v5-faq-arr">{openFaq === i ? '\u25B2' : '\u25BC'}</span>
            </div>
            {openFaq === i && (
              <div className="v5-faq-a">{item.a}</div>
            )}
          </div>
        ))}

        {/* Contact */}
        <div className="v5-card" style={{ marginTop: '1rem' }}>
          <div className="v5-st">Contact support</div>
          <div style={{ fontSize: 12, color: '#666', lineHeight: 1.6 }}>
            Email : <strong>support@vitfix.io</strong><br />
            T&eacute;l : <strong>04 91 00 00 00</strong><br />
            Chat Fixy 24/7 (bouton jaune en bas &agrave; droite)
          </div>
          <button className="v5-btn v5-btn-p" style={{ marginTop: 10 }} onClick={() => toast.info('Ticket cr\u00E9\u00E9 \u2014 r\u00E9ponse sous 24h')}>Ouvrir un ticket</button>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════
  // V22 RENDER — artisan / other roles
  // ═══════════════════════════════════════════════════════
  return (
    <div className="animate-fadeIn">
      <div className="v22-page-header">
        <div className="v22-page-title">Aide</div>
        <div className="v22-page-sub">Documentation & support</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ alignItems: 'start' }}>
        {/* FAQ */}
        <div className="v22-card">
          <div className="v22-card-head">
            <div className="v22-card-title">Questions fr&eacute;quentes</div>
          </div>
          {FAQ_ITEMS.map((item, i) => (
            <div key={i} style={{ borderBottom: i < FAQ_ITEMS.length - 1 ? `1px solid ${tv.border}` : 'none' }}>
              <div
                className="flex items-center justify-between cursor-pointer select-none"
                style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 500, color: tv.text }}
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              >
                <span>{item.q}</span>
                <span className="v22-mono" style={{ fontSize: '16px', color: tv.textMuted, transition: 'transform 0.2s', transform: openFaq === i ? 'rotate(45deg)' : 'none' }}>+</span>
              </div>
              {openFaq === i && (
                <div style={{ padding: '0 14px 12px', fontSize: '12px', color: tv.textMid, lineHeight: 1.7, borderTop: `1px solid ${tv.border}`, paddingTop: '10px', background: tv.bg }}>
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-4">
          {/* Contact support */}
          <div className="v22-card">
            <div className="v22-card-head">
              <div className="v22-card-title">Contact support</div>
            </div>
            <div className="v22-card-body">
              <div className="flex justify-between py-2" style={{ borderBottom: `1px solid ${tv.bg}`, fontSize: '12px' }}>
                <span style={{ color: tv.textMid }}>Email</span>
                <span className="v22-mono font-medium" style={{ color: tv.text }}>support@vitfix.io</span>
              </div>
              <div className="flex justify-between py-2" style={{ borderBottom: `1px solid ${tv.bg}`, fontSize: '12px' }}>
                <span style={{ color: tv.textMid }}>T&eacute;l&eacute;phone</span>
                <span className="v22-mono font-medium" style={{ color: tv.text }}>+33 1 80 00 00 00</span>
              </div>
              <div className="flex justify-between py-2" style={{ fontSize: '12px' }}>
                <span style={{ color: tv.textMid }}>Horaires</span>
                <span className="v22-mono font-medium" style={{ color: tv.text }}>Lun &ndash; Ven &middot; 9h &ndash; 18h</span>
              </div>
              <button className="v22-btn v22-btn-primary w-full mt-3" onClick={() => toast.info('Ticket cr\u00E9\u00E9 \u2014 r\u00E9ponse sous 24h')}>Ouvrir un ticket</button>
            </div>
          </div>

          {/* Version */}
          <div className="v22-card">
            <div className="v22-card-head">
              <div className="v22-card-title">Version</div>
            </div>
            <div className="v22-card-body">
              <div className="flex justify-between py-2" style={{ borderBottom: `1px solid ${tv.bg}`, fontSize: '12px' }}>
                <span style={{ color: tv.textMid }}>Application</span>
                <span className="v22-mono font-medium">VITFIX Pro</span>
              </div>
              <div className="flex justify-between py-2" style={{ borderBottom: `1px solid ${tv.bg}`, fontSize: '12px' }}>
                <span style={{ color: tv.textMid }}>Version</span>
                <span className="v22-mono font-medium">v2.2.0</span>
              </div>
              <div className="flex justify-between py-2" style={{ borderBottom: `1px solid ${tv.bg}`, fontSize: '12px' }}>
                <span style={{ color: tv.textMid }}>Mise &agrave; jour</span>
                <span className="v22-mono font-medium">Mars 2026</span>
              </div>
              <div className="flex justify-between py-2" style={{ fontSize: '12px' }}>
                <span style={{ color: tv.textMid }}>Statut</span>
                <span className="v22-tag v22-tag-green">Stable</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
