'use client'

import { useState, useRef, type FormEvent } from 'react'
import { PHONE_PT } from '@/lib/constants'

interface QuoteRequestFormProps {
  serviceType: string
  serviceName: string
  isEmergency?: boolean
}

export default function QuoteRequestForm({ serviceType, serviceName, isEmergency = false }: QuoteRequestFormProps) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    description: '',
    name: '',
    email: '',
    phone: '',
    address: '',
  })
  const [photos, setPhotos] = useState<File[]>([])
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([])
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const newPhotos = [...photos, ...files].slice(0, 5) // max 5 photos
    setPhotos(newPhotos)
    // Create preview URLs
    const urls = newPhotos.map(f => URL.createObjectURL(f))
    setPhotoPreviewUrls(urls)
  }

  const removePhoto = (index: number) => {
    const newPhotos = photos.filter((_, i) => i !== index)
    setPhotos(newPhotos)
    setPhotoPreviewUrls(newPhotos.map(f => URL.createObjectURL(f)))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      // Upload photos first if any
      const photoUrls: string[] = []
      for (const photo of photos) {
        const formData = new FormData()
        formData.append('file', photo)
        formData.append('bucket', 'quote-photos')
        formData.append('folder', 'en-quotes')
        try {
          const res = await fetch('/api/upload', { method: 'POST', body: formData })
          if (res.ok) {
            const data = await res.json()
            if (data.url) photoUrls.push(data.url)
          }
        } catch {
          // Continue even if photo upload fails
        }
      }

      // Build mailto with all form data
      const subject = encodeURIComponent(`${isEmergency ? 'URGENT: ' : ''}Quote Request - ${serviceName} in Porto`)
      const body = encodeURIComponent(
        `Service: ${serviceName}\n` +
        `Name: ${form.name}\n` +
        `Email: ${form.email}\n` +
        `Phone: ${form.phone}\n` +
        `Address: ${form.address}\n\n` +
        `Description:\n${form.description}\n\n` +
        (photoUrls.length > 0 ? `Photos:\n${photoUrls.join('\n')}\n\n` : '') +
        `---\nSent from VITFIX EN landing page`
      )
      window.location.href = `mailto:contact@vitfix.io?subject=${subject}&body=${body}`
      setSubmitted(true)
    } catch {
      // Fallback: just open mailto without photos
      const subject = encodeURIComponent(`Quote Request - ${serviceName}`)
      const body = encodeURIComponent(`Name: ${form.name}\nPhone: ${form.phone}\n\n${form.description}`)
      window.location.href = `mailto:contact@vitfix.io?subject=${subject}&body=${body}`
      setSubmitted(true)
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-8 text-center border border-border/50">
        <div className="text-5xl mb-4">{'\u2705'}</div>
        <h3 className="text-xl font-display font-bold text-dark mb-2">Quote Request Sent!</h3>
        <p className="text-text-muted">Your email client has opened with your request. We will get back to you within 24 hours.</p>
        <p className="text-sm text-text-muted mt-4">
          Prefer WhatsApp?{' '}
          <a href={`https://wa.me/${PHONE_PT.replace('+', '')}?text=${encodeURIComponent(`Hi, I need ${serviceName} in Porto`)}`} target="_blank" rel="noopener noreferrer" className="text-[#25D366] font-semibold hover:underline">
            Message us directly
          </a>
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-border/50 overflow-hidden">
      {/* Progress bar */}
      <div className="flex border-b border-border/30">
        {[1, 2, 3].map(s => (
          <button
            key={s}
            onClick={() => s < step && setStep(s)}
            className={`flex-1 py-3 text-sm font-semibold text-center transition-colors ${
              s === step ? 'bg-yellow/10 text-dark border-b-2 border-yellow' :
              s < step ? 'text-yellow cursor-pointer hover:bg-yellow/5' :
              'text-text-muted'
            }`}
          >
            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold mr-1.5 ${
              s < step ? 'bg-yellow text-dark' : s === step ? 'bg-yellow/20 text-dark' : 'bg-border/30 text-text-muted'
            }`}>{s < step ? '\u2713' : s}</span>
            {s === 1 ? 'Describe' : s === 2 ? 'Photos' : 'Contact'}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="p-6 md:p-8">
        {/* Step 1: Describe the issue */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-dark/70 mb-1">What do you need help with?</label>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-yellow/10 border border-yellow/25 text-sm font-semibold text-dark mb-3">
                {serviceType}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-dark/70 mb-1">Describe the issue or work needed</label>
              <textarea
                required
                rows={4}
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                className="w-full px-4 py-3 border-2 border-border rounded-lg focus:border-yellow focus:outline-none resize-none"
                placeholder="E.g., I have a leaking pipe under the kitchen sink. It started dripping yesterday and is getting worse..."
              />
            </div>
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={!form.description.trim()}
              className="w-full bg-yellow hover:bg-yellow-light text-dark font-display font-bold rounded-full px-6 py-3.5 transition-all hover:-translate-y-0.5 shadow-[0_6px_20px_rgba(255,214,0,0.3)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              Next: Add Photos (Optional)
            </button>
          </div>
        )}

        {/* Step 2: Photos */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-dark/70 mb-1">Add photos of the issue (optional, max 5)</label>
              <p className="text-xs text-text-muted mb-3">Photos help our professionals give you a more accurate quote.</p>

              {/* Photo previews */}
              {photoPreviewUrls.length > 0 && (
                <div className="flex flex-wrap gap-3 mb-4">
                  {photoPreviewUrls.map((url, i) => (
                    <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url.startsWith('blob:') || url.startsWith('https:') ? url : ''} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removePhoto(i)}
                        className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600"
                      >
                        {'\u00d7'}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {photos.length < 5 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-border rounded-lg py-8 text-center hover:border-yellow transition-colors cursor-pointer"
                >
                  <span className="text-3xl block mb-2">{'\ud83d\udcf7'}</span>
                  <span className="text-sm text-text-muted">Click to add photos</span>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoChange}
                className="hidden"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 border-2 border-border text-dark font-semibold rounded-full px-6 py-3 transition-all hover:bg-border/10"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="flex-1 bg-yellow hover:bg-yellow-light text-dark font-display font-bold rounded-full px-6 py-3 transition-all hover:-translate-y-0.5 shadow-[0_6px_20px_rgba(255,214,0,0.3)]"
              >
                Next: Your Details
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Contact details */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-dark/70 mb-1">Full name *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full px-4 py-3 border-2 border-border rounded-lg focus:border-yellow focus:outline-none"
                placeholder="John Smith"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark/70 mb-1">Phone number *</label>
              <input
                type="tel"
                required
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                className="w-full px-4 py-3 border-2 border-border rounded-lg focus:border-yellow focus:outline-none"
                placeholder="+351 912 345 678"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark/70 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                className="w-full px-4 py-3 border-2 border-border rounded-lg focus:border-yellow focus:outline-none"
                placeholder="john@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark/70 mb-1">Address / Area in Porto</label>
              <input
                type="text"
                value={form.address}
                onChange={e => setForm({ ...form, address: e.target.value })}
                className="w-full px-4 py-3 border-2 border-border rounded-lg focus:border-yellow focus:outline-none"
                placeholder="E.g., Foz do Douro, Porto"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="flex-1 border-2 border-border text-dark font-semibold rounded-full px-6 py-3 transition-all hover:bg-border/10"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={submitting || !form.name.trim() || !form.phone.trim()}
                className="flex-1 bg-yellow hover:bg-yellow-light text-dark font-display font-bold rounded-full px-6 py-3 transition-all hover:-translate-y-0.5 shadow-[0_6px_20px_rgba(255,214,0,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Sending...' : isEmergency ? 'Send Urgent Request' : 'Get Free Quote'}
              </button>
            </div>

            <p className="text-xs text-text-muted text-center mt-2">
              {'\ud83d\udd12'} Your information is private and only shared with the assigned professional.
            </p>
          </div>
        )}
      </form>
    </div>
  )
}
