// ─── Emergency Block for EN service pages ───
// Server Component — WhatsApp + Phone CTA

import { PHONE_PT } from '@/lib/constants'

interface EmergencyBlockProps {
  serviceType: string
  isEmergencyPage?: boolean
}

export default function EmergencyBlock({ serviceType, isEmergencyPage = false }: EmergencyBlockProps) {
  const whatsappText = encodeURIComponent(`Hi VITFIX, I need emergency help with ${serviceType} in Porto. Can you send someone?`)
  const whatsappUrl = `https://wa.me/${PHONE_PT.replace('+', '')}?text=${whatsappText}`

  const containerClass = isEmergencyPage
    ? 'rounded-2xl p-8 md:p-10 text-center'
    : 'rounded-2xl p-6 md:p-8'

  return (
    <div className={containerClass} style={{ background: 'linear-gradient(135deg, #FFF3E0 0%, #FFE0B2 50%, #FFCC02 100%)' }}>
      <div className={isEmergencyPage ? '' : 'flex flex-col md:flex-row md:items-center md:justify-between gap-6'}>
        <div className={isEmergencyPage ? 'mb-6' : ''}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">{'\ud83d\udea8'}</span>
            <h3 className="font-display text-xl md:text-2xl font-extrabold text-dark">
              {isEmergencyPage ? 'Get Help Right Now' : 'Need Emergency Help?'}
            </h3>
          </div>
          <p className="text-dark/80 text-sm md:text-base max-w-lg">
            {isEmergencyPage
              ? 'Our emergency professionals are available 24/7. Call or WhatsApp for immediate assistance.'
              : `Urgent ${serviceType.toLowerCase()} issue? Get immediate help via WhatsApp or phone.`
            }
          </p>
          {isEmergencyPage && (
            <div className="flex items-center justify-center gap-4 mt-3 text-sm text-dark/70">
              <span className="flex items-center gap-1">{'\u23f0'} Available 24/7</span>
              <span className="flex items-center gap-1">{'\u26a1'} Avg response: 15 min</span>
            </div>
          )}
        </div>

        <div className={`flex flex-col sm:flex-row gap-3 ${isEmergencyPage ? 'justify-center' : ''}`}>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20BD5A] text-white font-display font-bold rounded-full px-6 py-3.5 text-base transition-all hover:-translate-y-0.5 shadow-lg"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            WhatsApp Us
          </a>
          <a
            href={`tel:${PHONE_PT}`}
            className="inline-flex items-center justify-center gap-2 bg-dark hover:bg-dark/90 text-white font-display font-bold rounded-full px-6 py-3.5 text-base transition-all hover:-translate-y-0.5"
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/>
            </svg>
            Call Now
          </a>
        </div>
      </div>
    </div>
  )
}
