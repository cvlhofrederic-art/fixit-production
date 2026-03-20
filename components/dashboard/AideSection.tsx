'use client'

import { useState } from 'react'

interface AideSectionProps {
  navigateTo: (page: string) => void
}

const FAQ_ITEMS = [
  { q: 'Comment créer un devis ?', a: 'Depuis la sidebar, cliquez sur Devis puis + Nouveau devis. Renseignez le client, la prestation et le montant HT. Le devis est généré automatiquement et peut être envoyé par email.' },
  { q: 'Comment valider un ordre de mission ?', a: 'Rendez-vous dans Ordres de mission (Communication), cliquez sur l\'ordre concerné. Dans le panel Actions, cliquez sur Valider la mission. Vous pouvez saisir votre heure d\'arrivée et associer des documents.' },
  { q: 'Comment renouveler un document de conformité ?', a: 'Dans Wallet Conformité (Profil Pro), les documents proches de l\'expiration sont mis en évidence. Cliquez sur Renouveler à côté du document concerné.' },
  { q: 'Comment activer ou désactiver un module ?', a: 'Dans Modules (Compte), vous pouvez activer ou désactiver chaque module via le toggle ON/OFF. Les modules désactivés disparaissent de votre sidebar.' },
  { q: 'Mon lien de réservation est-il personnalisable ?', a: 'Votre lien est automatiquement généré depuis votre nom de profil. Pour le modifier, changez votre nom dans Paramètres → Profil et sauvegardez.' },
  { q: 'Comment exporter mes données ?', a: 'Depuis Statistiques ou le tableau de bord, cliquez sur Exporter. Choisissez le format (PDF, Excel, CSV) et la période souhaitée.' },
]

export default function AideSection({ navigateTo }: AideSectionProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(null)

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
            <div className="v22-card-title">Questions fréquentes</div>
          </div>
          {FAQ_ITEMS.map((item, i) => (
            <div key={i} style={{ borderBottom: i < FAQ_ITEMS.length - 1 ? '1px solid var(--v22-border)' : 'none' }}>
              <div
                className="flex items-center justify-between cursor-pointer select-none"
                style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 500, color: 'var(--v22-text)' }}
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              >
                <span>{item.q}</span>
                <span className="v22-mono" style={{ fontSize: '16px', color: 'var(--v22-text-muted)', transition: 'transform 0.2s', transform: openFaq === i ? 'rotate(45deg)' : 'none' }}>+</span>
              </div>
              {openFaq === i && (
                <div style={{ padding: '0 14px 12px', fontSize: '12px', color: 'var(--v22-text-mid)', lineHeight: 1.7, borderTop: '1px solid var(--v22-border)', paddingTop: '10px', background: 'var(--v22-bg)' }}>
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
              <div className="flex justify-between py-2" style={{ borderBottom: '1px solid var(--v22-bg)', fontSize: '12px' }}>
                <span style={{ color: 'var(--v22-text-mid)' }}>Email</span>
                <span className="v22-mono font-medium" style={{ color: 'var(--v22-text)' }}>support@vitfix.io</span>
              </div>
              <div className="flex justify-between py-2" style={{ borderBottom: '1px solid var(--v22-bg)', fontSize: '12px' }}>
                <span style={{ color: 'var(--v22-text-mid)' }}>Téléphone</span>
                <span className="v22-mono font-medium" style={{ color: 'var(--v22-text)' }}>+33 1 80 00 00 00</span>
              </div>
              <div className="flex justify-between py-2" style={{ fontSize: '12px' }}>
                <span style={{ color: 'var(--v22-text-mid)' }}>Horaires</span>
                <span className="v22-mono font-medium" style={{ color: 'var(--v22-text)' }}>Lun – Ven · 9h – 18h</span>
              </div>
              <button className="v22-btn v22-btn-primary w-full mt-3" onClick={() => alert('Ticket créé — réponse sous 24h')}>Ouvrir un ticket</button>
            </div>
          </div>

          {/* Version */}
          <div className="v22-card">
            <div className="v22-card-head">
              <div className="v22-card-title">Version</div>
            </div>
            <div className="v22-card-body">
              <div className="flex justify-between py-2" style={{ borderBottom: '1px solid var(--v22-bg)', fontSize: '12px' }}>
                <span style={{ color: 'var(--v22-text-mid)' }}>Application</span>
                <span className="v22-mono font-medium">VITFIX Pro</span>
              </div>
              <div className="flex justify-between py-2" style={{ borderBottom: '1px solid var(--v22-bg)', fontSize: '12px' }}>
                <span style={{ color: 'var(--v22-text-mid)' }}>Version</span>
                <span className="v22-mono font-medium">v2.2.0</span>
              </div>
              <div className="flex justify-between py-2" style={{ borderBottom: '1px solid var(--v22-bg)', fontSize: '12px' }}>
                <span style={{ color: 'var(--v22-text-mid)' }}>Mise à jour</span>
                <span className="v22-mono font-medium">Mars 2026</span>
              </div>
              <div className="flex justify-between py-2" style={{ fontSize: '12px' }}>
                <span style={{ color: 'var(--v22-text-mid)' }}>Statut</span>
                <span className="v22-tag v22-tag-green">Stable</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
