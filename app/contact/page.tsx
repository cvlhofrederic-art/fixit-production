'use client'

import type { Metadata } from 'next'
import { useState } from 'react'

export default function ContactPage() {
  const [form, setForm] = useState({ nom: '', email: '', sujet: '', message: '' })
  const [sent, setSent] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Ouvre le client mail avec les données pré-remplies
    const mailto = `mailto:contact@vitfix.fr?subject=${encodeURIComponent(form.sujet || 'Contact Vitfix')}&body=${encodeURIComponent(`Nom : ${form.nom}\nEmail : ${form.email}\n\n${form.message}`)}`
    window.location.href = mailto
    setSent(true)
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Nous contacter</h1>
        <p className="text-gray-600 mb-8">
          Une question, un problème ou une suggestion ? Notre équipe vous répond sous 24h ouvrées.
        </p>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Infos contact */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl p-5 shadow-sm">
              <div className="text-2xl mb-2">📧</div>
              <h3 className="font-bold text-gray-900 mb-1">Email</h3>
              <p className="text-gray-600 text-sm">contact@vitfix.fr</p>
            </div>
            <div className="bg-white rounded-xl p-5 shadow-sm">
              <div className="text-2xl mb-2">🕒</div>
              <h3 className="font-bold text-gray-900 mb-1">Horaires</h3>
              <p className="text-gray-600 text-sm">Lun–Ven : 9h–18h</p>
            </div>
            <div className="bg-white rounded-xl p-5 shadow-sm">
              <div className="text-2xl mb-2">📍</div>
              <h3 className="font-bold text-gray-900 mb-1">Siège</h3>
              <p className="text-gray-600 text-sm">France</p>
            </div>
          </div>

          {/* Formulaire */}
          <div className="md:col-span-2 bg-white rounded-2xl shadow-sm p-8">
            {sent ? (
              <div className="text-center py-8">
                <div className="text-5xl mb-4">✅</div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Message envoyé !</h2>
                <p className="text-gray-600">Votre client mail s&apos;est ouvert. Nous répondrons sous 24h ouvrées.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nom complet</label>
                  <input
                    type="text"
                    required
                    value={form.nom}
                    onChange={e => setForm({ ...form, nom: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#FFC107] focus:outline-none"
                    placeholder="Jean Dupont"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#FFC107] focus:outline-none"
                    placeholder="jean@exemple.fr"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sujet</label>
                  <select
                    value={form.sujet}
                    onChange={e => setForm({ ...form, sujet: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#FFC107] focus:outline-none bg-white"
                  >
                    <option value="">Choisir un sujet</option>
                    <option>Question générale</option>
                    <option>Problème avec une réservation</option>
                    <option>Je suis artisan et je veux m&apos;inscrire</option>
                    <option>Signaler un problème</option>
                    <option>Autre</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                  <textarea
                    required
                    rows={5}
                    value={form.message}
                    onChange={e => setForm({ ...form, message: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#FFC107] focus:outline-none resize-none"
                    placeholder="Décrivez votre demande..."
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 py-3 rounded-xl font-semibold transition"
                >
                  Envoyer le message
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
