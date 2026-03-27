import { sendEmail } from './email'
import type { RFQ, RFQItem } from './rfq-types'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://vitfix.io'

export function buildSupplierEmailHTML(rfq: RFQ, items: RFQItem[], offerToken: string, supplierName: string): string {
  const lang = rfq.country === 'PT' ? 'pt' : 'fr'
  const offerUrl = `${BASE_URL}/rfq/repondre/${offerToken}`

  const itemsRows = items.map(item => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e8e8e4;">${item.product_name}${item.product_ref ? ` (${item.product_ref})` : ''}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e8e8e4;text-align:center;">${item.quantity} ${item.unit}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e8e8e4;color:#888;">${item.category || '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e8e8e4;color:#666;font-size:12px;">${item.notes || ''}</td>
    </tr>
  `).join('')

  if (lang === 'pt') {
    return `<!DOCTYPE html>
<html lang="pt">
<head><meta charset="UTF-8"><title>Pedido de Orçamento</title></head>
<body style="font-family:'IBM Plex Sans',Arial,sans-serif;background:#f7f7f5;margin:0;padding:24px;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #e8e8e4;border-radius:6px;overflow:hidden;">
    <div style="background:#0d0d0d;padding:20px 24px;display:flex;align-items:center;gap:12px;">
      <span style="color:#ffd600;font-weight:700;font-size:18px;">VITFIX</span>
      <span style="color:#666;font-size:13px;">— Pedido de Orçamento Profissional</span>
    </div>
    <div style="padding:28px 24px;">
      <p style="font-size:14px;color:#555;margin:0 0 16px;">Olá ${supplierName},</p>
      <p style="font-size:14px;color:#333;margin:0 0 20px;">Recebeu um novo pedido de orçamento de uma empresa de construção através da plataforma Vitfix.</p>

      <div style="background:#f7f7f5;border:1px solid #e8e8e4;border-radius:4px;padding:16px;margin:0 0 20px;">
        <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:.05em;">Referência</p>
        <p style="margin:0;font-size:15px;font-weight:600;color:#0d0d0d;">${rfq.title}</p>
        ${rfq.message ? `<p style="margin:8px 0 0;font-size:13px;color:#555;">${rfq.message}</p>` : ''}
      </div>

      <p style="margin:0 0 12px;font-size:12px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:.05em;">Materiais Solicitados</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin:0 0 24px;">
        <thead>
          <tr style="background:#f7f7f5;">
            <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e8e8e4;font-size:11px;color:#888;text-transform:uppercase;">Material</th>
            <th style="padding:8px 12px;text-align:center;border-bottom:2px solid #e8e8e4;font-size:11px;color:#888;text-transform:uppercase;">Qtd</th>
            <th style="padding:8px 12px;border-bottom:2px solid #e8e8e4;font-size:11px;color:#888;text-transform:uppercase;">Categoria</th>
            <th style="padding:8px 12px;border-bottom:2px solid #e8e8e4;font-size:11px;color:#888;text-transform:uppercase;">Notas</th>
          </tr>
        </thead>
        <tbody>${itemsRows}</tbody>
      </table>

      <a href="${offerUrl}" style="display:inline-block;background:#ffd600;color:#0d0d0d;font-weight:600;font-size:14px;padding:12px 28px;border-radius:4px;text-decoration:none;">Responder ao Pedido →</a>
      <p style="margin:16px 0 0;font-size:12px;color:#aaa;">Este link é válido durante 7 dias. Não necessita de criar uma conta.</p>
    </div>
    <div style="background:#f7f7f5;padding:16px 24px;border-top:1px solid #e8e8e4;">
      <p style="margin:0;font-size:11px;color:#aaa;">Vitfix.io — Plataforma de profissionais BTP | País: Portugal</p>
    </div>
  </div>
</body>
</html>`
  }

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>Demande de Devis Professionnel</title></head>
<body style="font-family:'IBM Plex Sans',Arial,sans-serif;background:#f7f7f5;margin:0;padding:24px;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #e8e8e4;border-radius:6px;overflow:hidden;">
    <div style="background:#0d0d0d;padding:20px 24px;">
      <span style="color:#ffd600;font-weight:700;font-size:18px;">VITFIX</span>
      <span style="color:#666;font-size:13px;margin-left:12px;">— Demande de Devis Professionnel</span>
    </div>
    <div style="padding:28px 24px;">
      <p style="font-size:14px;color:#555;margin:0 0 16px;">Bonjour ${supplierName},</p>
      <p style="font-size:14px;color:#333;margin:0 0 20px;">Vous avez reçu une nouvelle demande de devis d'une société BTP via la plateforme Vitfix.</p>

      <div style="background:#f7f7f5;border:1px solid #e8e8e4;border-radius:4px;padding:16px;margin:0 0 20px;">
        <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:.05em;">Référence</p>
        <p style="margin:0;font-size:15px;font-weight:600;color:#0d0d0d;">${rfq.title}</p>
        ${rfq.message ? `<p style="margin:8px 0 0;font-size:13px;color:#555;">${rfq.message}</p>` : ''}
      </div>

      <p style="margin:0 0 12px;font-size:12px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:.05em;">Matériaux demandés</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin:0 0 24px;">
        <thead>
          <tr style="background:#f7f7f5;">
            <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e8e8e4;font-size:11px;color:#888;text-transform:uppercase;">Produit</th>
            <th style="padding:8px 12px;text-align:center;border-bottom:2px solid #e8e8e4;font-size:11px;color:#888;text-transform:uppercase;">Qté</th>
            <th style="padding:8px 12px;border-bottom:2px solid #e8e8e4;font-size:11px;color:#888;text-transform:uppercase;">Catégorie</th>
            <th style="padding:8px 12px;border-bottom:2px solid #e8e8e4;font-size:11px;color:#888;text-transform:uppercase;">Notes</th>
          </tr>
        </thead>
        <tbody>${itemsRows}</tbody>
      </table>

      <a href="${offerUrl}" style="display:inline-block;background:#ffd600;color:#0d0d0d;font-weight:600;font-size:14px;padding:12px 28px;border-radius:4px;text-decoration:none;">Répondre à la demande →</a>
      <p style="margin:16px 0 0;font-size:12px;color:#aaa;">Ce lien est valable 7 jours. Aucun compte requis pour répondre.</p>
    </div>
    <div style="background:#f7f7f5;padding:16px 24px;border-top:1px solid #e8e8e4;">
      <p style="margin:0;font-size:11px;color:#aaa;">Vitfix.io — Plateforme professionnels BTP | Pays : France</p>
    </div>
  </div>
</body>
</html>`
}

export async function sendRFQToSuppliers(
  rfq: RFQ,
  items: RFQItem[],
  suppliers: Array<{ id: string; name: string; email: string; token: string }>
): Promise<void> {
  const emails = suppliers.map(s => ({
    to: s.email,
    subject: rfq.country === 'PT'
      ? `Novo pedido de orçamento — ${rfq.title}`
      : `Nouvelle demande de devis — ${rfq.title}`,
    html: buildSupplierEmailHTML(rfq, items, s.token, s.name),
  }))

  await Promise.allSettled(emails.map(e => sendEmail(e)))
}
