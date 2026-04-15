'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { useLocale } from '@/lib/i18n/context'
import { useThemeVars } from './useThemeVars'

type OrgRole = 'artisan' | 'pro_societe' | 'pro_conciergerie' | 'pro_gestionnaire'

interface AideSectionProps {
  navigateTo: (page: string) => void
  orgRole?: OrgRole
}

const FAQ_ITEMS_ARTISAN_FR = [
  { q: 'Comment créer un devis ?', a: 'Depuis la sidebar, cliquez sur Devis puis + Nouveau devis. Renseignez le client, la prestation et le montant HT. Le devis est généré automatiquement et peut être envoyé par email.' },
  { q: 'Comment valider un ordre de mission ?', a: "Rendez-vous dans Ordres de mission (Communication), cliquez sur l'ordre concerné. Dans le panel Actions, cliquez sur Valider la mission. Vous pouvez saisir votre heure d'arrivée et associer des documents." },
  { q: 'Comment renouveler un document de conformité ?', a: "Dans Wallet Conformité (Profil Pro), les documents proches de l'expiration sont mis en évidence. Cliquez sur Renouveler à côté du document concerné." },
  { q: 'Comment activer ou désactiver un module ?', a: 'Dans Modules (Conta), vous pouvez activer ou désactiver chaque module via le toggle ON/OFF. Les modules désactivés disparaissent de votre sidebar.' },
  { q: 'Mon lien de réservation est-il personnalisable ?', a: 'Votre lien est automatiquement généré depuis votre nom de profil. Pour le modifier, changez votre nom dans Paramètres → Profil et sauvegardez.' },
  { q: 'Comment exporter mes données ?', a: 'Depuis Statistiques ou le tableau de bord, cliquez sur Exporter. Choisissez le format (PDF, Excel, CSV) et la période souhaitée.' },
]
const FAQ_ITEMS_ARTISAN_PT = [
  { q: 'Como criar um orçamento?', a: 'Na barra lateral, clique em Orçamentos e depois em + Novo orçamento. Preencha o cliente, a prestação e o valor sem IVA. O orçamento é gerado automaticamente e pode ser enviado por e-mail.' },
  { q: 'Como validar uma ordem de serviço?', a: 'Vá a Ordens de serviço (Comunicação), clique na ordem em questão. No painel Ações, clique em Validar a missão. Pode registar a hora de chegada e associar documentos.' },
  { q: 'Como renovar um documento de conformidade?', a: 'Em Wallet Conformidade (Perfil Pro), os documentos próximos do prazo de validade são destacados. Clique em Renovar ao lado do documento em causa.' },
  { q: 'Como ativar ou desativar um módulo?', a: 'Em Módulos (Conta), pode ativar ou desativar cada módulo através do botão ON/OFF. Os módulos desativados desaparecem da sua barra lateral.' },
  { q: 'O meu link de reserva é personalizável?', a: 'O seu link é gerado automaticamente a partir do seu nome de perfil. Para o alterar, mude o nome em Definições → Perfil e guarde.' },
  { q: 'Como exportar os meus dados?', a: 'Em Estatísticas ou no painel, clique em Exportar. Escolha o formato (PDF, Excel, CSV) e o período pretendido.' },
]

const FAQ_ITEMS_SOCIETE_FR = [
  { q: 'Comment créer une situation de travaux ?', a: 'Allez dans "Situations de travaux", cliquez sur "Émettre situation". Sélectionnez le chantier, renseignez l\'avancement par lot, la retenue de garantie est calculée automatiquement (5%).' },
  { q: 'Comment fonctionne le pointage GPS ?', a: "Chaque employé pointe via l'app mobile. Le GPS vérifie qu'il est bien sur le chantier assigné. Vert = sur site, Orange = zone tampon (500m), Rouge = hors zone." },
  { q: 'Comment remplir un formulaire DC4 ?', a: 'Dans "Sous-traitance DC4", cliquez "+ Nouveau DC4". Renseignez le sous-traitant, le chantier, le montant et le pourcentage. Le formulaire respecte le format réglementaire des marchés publics.' },
  { q: "Comment suivre la rentabilité d'un chantier ?", a: 'Section "Rentabilité Chantier" : comparaison budget prévu vs réalisé, ventilation par poste (MO, matériaux, sous-traitance). Alertes automatiques en cas de dépassement.' },
  { q: 'Comment contacter le support ?', a: 'Email : support@vitfix.io • Tél : 04 91 00 00 00 • Chat Fixy 24/7 (bouton jaune en bas à droite).' },
]
const FAQ_ITEMS_SOCIETE_PT = [
  { q: 'Como criar uma situação de obra?', a: 'Vá a "Situações de obra", clique em "Emitir situação". Selecione a obra, preencha o avanço por lote — a retenção de garantia é calculada automaticamente (5%).' },
  { q: 'Como funciona o registo de presenças por GPS?', a: 'Cada colaborador regista a presença via app móvel. O GPS verifica se está na obra atribuída. Verde = no local, Laranja = zona tampão (500m), Vermelho = fora da zona.' },
  { q: 'Como preencher um formulário de subempreitada?', a: 'Em "Subempreitada", clique em "+ Nova subempreitada". Preencha o subempreiteiro, a obra, o valor e a percentagem. O formulário respeita o formato regulamentar dos concursos públicos.' },
  { q: 'Como acompanhar a rentabilidade de uma obra?', a: 'Secção "Rentabilidade de Obra": comparação do orçamento previsto vs. realizado, repartição por rubrica (MO, materiais, subempreitada). Alertas automáticos em caso de desvio.' },
  { q: 'Como contactar o suporte?', a: 'E-mail: support@vitfix.io • Chat Fixy 24/7 (botão amarelo em baixo à direita).' },
]

export default function AideSection({ navigateTo, orgRole = 'artisan' }: AideSectionProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const locale = useLocale()
  const isPt = locale === 'pt'
  const isSociete = orgRole === 'pro_societe' || orgRole === 'artisan'
  const isV5 = isSociete
  const tv = useThemeVars(isV5)
  const FAQ_ITEMS = isSociete
    ? (isPt ? FAQ_ITEMS_SOCIETE_PT : FAQ_ITEMS_SOCIETE_FR)
    : (isPt ? FAQ_ITEMS_ARTISAN_PT : FAQ_ITEMS_ARTISAN_FR)

  // ═══════════════════════════════════════════════════════
  // V5 RENDER — pro_societe uses the v5 design system
  // ═══════════════════════════════════════════════════════
  if (isSociete) {
    return (
      <div className="v5-fade">
        <div className="v5-pg-t">
          <h1>{isPt ? 'Ajuda' : 'Aide'}</h1>
          <p>{isPt ? 'Centro de assistência VITFIX — Empresa de Construção' : 'Centre d\'assistance VITFIX — Société BTP'}</p>
        </div>

        {/* Getting started card */}
        <div className="v5-card" style={{ marginBottom: '1rem' }}>
          <div className="v5-st">{isPt ? 'Guia de início rápido' : 'Guide de démarrage rapide'}</div>
          <div style={{ fontSize: 12, color: '#666', lineHeight: 1.6 }}>
            {isPt ? <>
              1. Complete o seu <strong>perfil de empresa</strong> (NIF/NIPC, certificações, efetivo)<br />
              2. Crie as suas <strong>obras</strong> e atribua as suas <strong>equipas</strong><br />
              3. Configure os seus <strong>lotes/prestações</strong> com preços unitários<br />
              4. Carregue os seus <strong>documentos de conformidade</strong><br />
              5. Comece a emitir <strong>situações de obra</strong> e <strong>faturas</strong>!
            </> : <>
              1. Complétez votre <strong>profil entreprise</strong> (SIRET, certifications, effectif)<br />
              2. Créez vos <strong>chantiers</strong> et assignez vos <strong>équipes</strong><br />
              3. Configurez vos <strong>lots/prestations</strong> avec prix unitaires<br />
              4. Uploadez vos <strong>documents de conformité</strong><br />
              5. Commencez à émettre des <strong>situations de travaux</strong> et <strong>factures</strong> !
            </>}
          </div>
        </div>

        {/* FAQ accordion */}
        <div className="v5-st" style={{ marginBottom: '.5rem' }}>{isPt ? 'Perguntas frequentes' : 'Questions fréquentes'}</div>
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
          <div className="v5-st">{isPt ? 'Contacto de suporte' : 'Contact support'}</div>
          <div style={{ fontSize: 12, color: '#666', lineHeight: 1.6 }}>
            Email : <strong>support@vitfix.io</strong><br />
            {!isPt && <>Tél : <strong>04 91 00 00 00</strong><br /></>}
            {isPt ? 'Chat Fixy 24/7 (botão amarelo em baixo à direita)' : 'Chat Fixy 24/7 (bouton jaune en bas à droite)'}
          </div>
          <button className="v5-btn v5-btn-p" style={{ marginTop: 10 }} onClick={() => toast.info(isPt ? 'Pedido criado — resposta em 24h' : 'Ticket créé — réponse sous 24h')}>{isPt ? 'Abrir pedido de suporte' : 'Ouvrir un ticket'}</button>
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
        <div className="v22-page-title">{isPt ? 'Ajuda' : 'Aide'}</div>
        <div className="v22-page-sub">Documentation & support</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ alignItems: 'start' }}>
        {/* FAQ */}
        <div className="v22-card">
          <div className="v22-card-head">
            <div className="v22-card-title">{isPt ? 'Perguntas frequentes' : 'Questions fréquentes'}</div>
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
              <div className="v22-card-title">{isPt ? 'Contacto de suporte' : 'Contact support'}</div>
            </div>
            <div className="v22-card-body">
              <div className="flex justify-between py-2" style={{ borderBottom: `1px solid ${tv.bg}`, fontSize: '12px' }}>
                <span style={{ color: tv.textMid }}>Email</span>
                <span className="v22-mono font-medium" style={{ color: tv.text }}>support@vitfix.io</span>
              </div>
              <div className="flex justify-between py-2" style={{ borderBottom: `1px solid ${tv.bg}`, fontSize: '12px' }}>
                <span style={{ color: tv.textMid }}>{isPt ? 'Telefone' : 'Téléphone'}</span>
                <span className="v22-mono font-medium" style={{ color: tv.text }}>+33 1 80 00 00 00</span>
              </div>
              <div className="flex justify-between py-2" style={{ fontSize: '12px' }}>
                <span style={{ color: tv.textMid }}>{isPt ? 'Horário' : 'Horaires'}</span>
                <span className="v22-mono font-medium" style={{ color: tv.text }}>{isPt ? 'Seg – Sex · 9h – 18h' : 'Lun – Ven · 9h – 18h'}</span>
              </div>
              <button className="v22-btn v22-btn-primary w-full mt-3" onClick={() => toast.info(isPt ? 'Pedido criado — resposta em 24h' : 'Ticket créé — réponse sous 24h')}>{isPt ? 'Abrir pedido de suporte' : 'Ouvrir un ticket'}</button>
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
                <span style={{ color: tv.textMid }}>{isPt ? 'Atualização' : 'Mise à jour'}</span>
                <span className="v22-mono font-medium">{isPt ? 'Março 2026' : 'Mars 2026'}</span>
              </div>
              <div className="flex justify-between py-2" style={{ fontSize: '12px' }}>
                <span style={{ color: tv.textMid }}>{isPt ? 'Estado' : 'Statut'}</span>
                <span className="v22-tag v22-tag-green">Stable</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
