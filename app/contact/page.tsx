'use client'

import { useState } from 'react'
import { useTranslation, useLocale } from '@/lib/i18n/context'
import { PHONE_PT, PHONE_FR_SECONDARY, WHATSAPP_PT } from '@/lib/constants'
import Button from '@/components/ui/Button'
import { useScrollAnimation } from '@/hooks/useScrollAnimation'

export default function ContactPage() {
  const { t } = useTranslation()
  const locale = useLocale()
  const isPt = locale === 'pt'
  const [form, setForm] = useState({ nom: '', email: '', sujet: '', message: '' })
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  useScrollAnimation()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSending(true)
    setSendError('')
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Erreur d\'envoi')
      }
      setSent(true)
    } catch (err) {
      setSendError(isPt
        ? 'Erro ao enviar a mensagem. Tente novamente ou contacte-nos em contact@vitfix.io'
        : 'Erreur lors de l\'envoi. Réessayez ou contactez-nous à contact@vitfix.io')
    } finally {
      setSending(false)
    }
  }

  const contactJsonLd = isPt ? {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'ContactPage',
        name: 'Contacto VITFIX',
        description: 'Contacte a equipa VITFIX para questões sobre serviços de profissionais.',
        url: 'https://vitfix.io/pt/contact/',
        mainEntity: {
          '@type': 'HomeAndConstructionBusiness',
          name: 'VITFIX',
          url: 'https://vitfix.io/pt/',
          telephone: PHONE_PT,
          email: 'contact@vitfix.io',
          address: {
            '@type': 'PostalAddress',
            addressLocality: 'Marco de Canaveses',
            addressRegion: 'Porto',
            addressCountry: 'PT',
          },
          openingHoursSpecification: {
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
            opens: '08:00',
            closes: '20:00',
          },
          areaServed: [
            { '@type': 'City', name: 'Marco de Canaveses' },
            { '@type': 'City', name: 'Porto' },
            { '@type': 'City', name: 'Lisboa' },
          ],
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'VITFIX', item: 'https://vitfix.io/pt/' },
          { '@type': 'ListItem', position: 2, name: 'Contacto', item: 'https://vitfix.io/pt/contact/' },
        ],
      },
    ],
  } : {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'ContactPage',
        name: 'Contact VITFIX',
        description: 'Contactez VITFIX pour vos questions sur les services d\'artisans vérifiés.',
        url: 'https://vitfix.io/fr/contact/',
        mainEntity: {
          '@type': 'HomeAndConstructionBusiness',
          name: 'VITFIX',
          url: 'https://vitfix.io/fr/',
          telephone: PHONE_FR_SECONDARY,
          email: 'contact@vitfix.io',
          address: {
            '@type': 'PostalAddress',
            addressLocality: 'Marseille',
            addressRegion: 'Provence-Alpes-Côte d\'Azur',
            addressCountry: 'FR',
          },
          openingHoursSpecification: {
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
            opens: '08:00',
            closes: '20:00',
          },
          areaServed: [
            { '@type': 'City', name: 'Marseille' },
            { '@type': 'City', name: 'Paris' },
            { '@type': 'City', name: 'Lyon' },
            { '@type': 'City', name: 'Aix-en-Provence' },
          ],
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'VITFIX', item: 'https://vitfix.io/fr/' },
          { '@type': 'ListItem', position: 2, name: 'Contact', item: 'https://vitfix.io/fr/contact/' },
        ],
      },
    ],
  }

  return (
    <div className="min-h-screen bg-warm-gray py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(contactJsonLd) }} />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-display font-extrabold tracking-tight text-dark mb-2 fade-up">{t('contact.title')}</h1>
        <p className="text-text-muted mb-8 fade-up">
          {t('contact.subtitle')}
        </p>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Contact info */}
          <div className="space-y-6 fade-up">
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <div className="text-2xl mb-2">{'📧'}</div>
              <h3 className="font-display font-bold text-dark mb-1">Email</h3>
              <p className="text-text-muted text-sm">contact@vitfix.io</p>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <div className="text-2xl mb-2">{'🕒'}</div>
              <h3 className="font-display font-bold text-dark mb-1">{t('contact.hours.label')}</h3>
              <p className="text-text-muted text-sm">{t('contact.hours.value')}</p>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <div className="text-2xl mb-2">{'📞'}</div>
              <h3 className="font-display font-bold text-dark mb-1">{isPt ? 'Telefone' : 'Téléphone'}</h3>
              {isPt ? (
                <a href={`tel:${PHONE_PT}`} className="text-yellow font-semibold text-sm hover:underline">{PHONE_PT}</a>
              ) : (
                <a href="tel:+33757910711" className="text-yellow font-semibold text-sm hover:underline">+33 7 57 91 07 11</a>
              )}
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <div className="text-2xl mb-2">{'📍'}</div>
              <h3 className="font-display font-bold text-dark mb-1">{t('contact.hq.label')}</h3>
              {isPt ? (
                <>
                  <p className="text-text-muted text-sm">Marco de Canaveses, Porto</p>
                  <p className="text-text-muted text-sm">Região do Tâmega e Sousa</p>
                </>
              ) : (
                <>
                  <p className="text-text-muted text-sm">Marseille, France</p>
                  <p className="text-text-muted text-sm">Provence-Alpes-Côte d&apos;Azur</p>
                </>
              )}
            </div>
          </div>

          {/* Form */}
          <div className="md:col-span-2 bg-white rounded-2xl shadow-sm p-8 fade-up">
            {sent ? (
              <div className="text-center py-8">
                <div className="text-5xl mb-4">{'✅'}</div>
                <h2 className="text-xl font-display font-bold text-dark mb-2">
                  {isPt ? 'Mensagem enviada com sucesso!' : 'Message envoyé avec succès !'}
                </h2>
                <p className="text-text-muted mb-4">
                  {isPt
                    ? 'Recebemos a sua mensagem e responderemos em breve.'
                    : 'Nous avons bien reçu votre message et vous répondrons rapidement.'}
                </p>
                <div className="mt-4">
                  <button onClick={() => { setSent(false); setForm({ nom: '', email: '', sujet: '', message: '' }) }} className="text-sm text-text-muted hover:text-dark transition underline">
                    {isPt ? 'Enviar outra mensagem' : 'Envoyer un autre message'}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="contact-name" className="block text-sm font-medium text-dark/70 mb-1">{t('contact.form.fullName')}</label>
                  <input
                    id="contact-name"
                    type="text"
                    required
                    value={form.nom}
                    onChange={e => setForm({ ...form, nom: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-border rounded-lg focus:border-yellow focus:outline-none"
                    placeholder={t('contact.form.namePlaceholder')}
                  />
                </div>
                <div>
                  <label htmlFor="contact-email" className="block text-sm font-medium text-dark/70 mb-1">Email</label>
                  <input
                    id="contact-email"
                    type="email"
                    required
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-border rounded-lg focus:border-yellow focus:outline-none"
                    placeholder={t('contact.form.emailPlaceholder')}
                  />
                </div>
                <div>
                  <label htmlFor="contact-subject" className="block text-sm font-medium text-dark/70 mb-1">{t('contact.form.subject')}</label>
                  <select
                    id="contact-subject"
                    required
                    value={form.sujet}
                    onChange={e => setForm({ ...form, sujet: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-border rounded-lg focus:border-yellow focus:outline-none bg-white"
                  >
                    <option value="">{t('contact.form.chooseSubject')}</option>
                    <option>{t('contact.form.subjects.general')}</option>
                    <option>{t('contact.form.subjects.booking')}</option>
                    <option>{t('contact.form.subjects.artisan')}</option>
                    <option>{t('contact.form.subjects.report')}</option>
                    <option>{t('contact.form.subjects.other')}</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="contact-message" className="block text-sm font-medium text-dark/70 mb-1">Message</label>
                  <textarea
                    id="contact-message"
                    required
                    rows={5}
                    value={form.message}
                    onChange={e => setForm({ ...form, message: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-border rounded-lg focus:border-yellow focus:outline-none resize-none"
                    placeholder={t('contact.form.messagePlaceholder')}
                  />
                </div>
                {sendError && (
                  <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-200">{sendError}</div>
                )}
                <Button type="submit" variant="primary" size="lg" className="w-full" disabled={sending}>
                  {sending ? (isPt ? 'A enviar...' : 'Envoi en cours...') : t('contact.form.send')}
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
