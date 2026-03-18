'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type Step = 1 | 2 | 3

export default function SyndicRegisterPage() {
  const [step, setStep] = useState<Step>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  // SIRET
  const [siretInput, setSiretInput] = useState('')
  const [siretStatus, setSiretStatus] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle')
  const [siretError, setSiretError] = useState('')
  const [company, setCompany] = useState<any>(null)

  // Form
  const [form, setForm] = useState({
    nom: '', prenom: '', email: '', telephone: '', password: '', confirmPassword: '',
    typeStructure: 'syndic', // syndic | conciergerie | bailleur | promoteur | autre
    nbImmeubles: '',
    adresse: '', ville: '', codePostal: '',
  })

  const verifySiret = async () => {
    if (siretInput.replace(/\s/g, '').length !== 14) {
      setSiretError('Le SIRET doit contenir 14 chiffres')
      return
    }
    setSiretStatus('checking')
    setSiretError('')
    try {
      const res = await fetch(`/api/verify-siret?siret=${siretInput.replace(/\s/g, '')}`)
      const data = await res.json()
      if (data.error || !data.isActive) {
        setSiretStatus('error')
        setSiretError(data.error || 'Entreprise introuvable ou inactive')
      } else {
        setCompany(data)
        setSiretStatus('ok')
      }
    } catch {
      setSiretStatus('error')
      setSiretError('Erreur lors de la vérification')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.password !== form.confirmPassword) { setError('Les mots de passe ne correspondent pas'); return }
    if (form.password.length < 8) { setError('Mot de passe trop court (8 caractères minimum)'); return }
    setLoading(true)
    setError('')
    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            role: 'syndic',
            full_name: `${form.prenom} ${form.nom}`,
            phone: form.telephone,
            type_structure: form.typeStructure,
            nb_immeubles: form.nbImmeubles,
            siret: siretInput.replace(/\s/g, ''),
            company_name: company?.name || '',
            company_siren: company?.siren || '',
            company_address: company?.address || '',
            abonnement: 'trial', // 14 jours gratuits
          }
        }
      })
      if (signUpError) { setError(signUpError.message); setLoading(false); return }
      setSuccess(true)
    } catch {
      setError('Une erreur est survenue.')
      setLoading(false)
    }
  }

  const typesStructure = [
    { id: 'syndic', label: 'Syndic de copropriété', emoji: '🏢' },
    { id: 'conciergerie', label: 'Conciergerie', emoji: '🗝️' },
    { id: 'bailleur', label: 'Bailleur / Foncière', emoji: '🏗️' },
    { id: 'promoteur', label: 'Promoteur immobilier', emoji: '🏛️' },
    { id: 'gestionnaire', label: 'Gestionnaire de biens', emoji: '📋' },
    { id: 'autre', label: 'Autre structure', emoji: '🔹' },
  ]

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Compte créé !</h2>
          <p className="text-gray-600 mb-2">Vérifiez votre email pour confirmer votre compte.</p>
          <p className="text-purple-600 font-semibold mb-6">14 jours d'essai gratuit inclus ✅</p>
          <Link href="/syndic/login" className="inline-block bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-lg font-bold transition">
            Se connecter
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-gray-100 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <span className="text-2xl font-display font-extrabold text-dark"><span className="text-yellow">VIT</span>FIX</span>
            <span className="text-purple-600 font-bold text-xl ml-1">Pro Syndic</span>
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Créer votre espace gestionnaire</h1>
          <p className="text-gray-500 mt-2">14 jours d'essai gratuit — Sans engagement — Sans carte bancaire</p>
        </div>

        {/* Steps */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                step >= s ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-500'
              }`}>{s}</div>
              {s < 3 && <div className={`w-12 h-1 rounded ${step > s ? 'bg-purple-600' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>
        <div className="flex justify-center gap-12 text-sm text-gray-500 mb-8 -mt-4">
          <span className={step >= 1 ? 'text-purple-600 font-semibold' : ''}>Structure</span>
          <span className={step >= 2 ? 'text-purple-600 font-semibold' : ''}>Contact</span>
          <span className={step >= 3 ? 'text-purple-600 font-semibold' : ''}>Sécurité</span>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-200 mb-4">
              {error}
            </div>
          )}

          {/* ÉTAPE 1 — Structure */}
          {step === 1 && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-gray-900">Votre structure</h2>

              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Type de structure</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {typesStructure.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setForm({ ...form, typeStructure: t.id })}
                      className={`p-3 rounded-xl border-2 text-center transition-all ${
                        form.typeStructure === t.id
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-purple-300'
                      }`}
                    >
                      <div className="text-2xl mb-1">{t.emoji}</div>
                      <div className="text-xs font-semibold text-gray-800">{t.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* SIRET */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">SIRET de votre structure</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={siretInput}
                    onChange={e => { setSiretInput(e.target.value); setSiretStatus('idle'); setSiretError('') }}
                    placeholder="123 456 789 01234"
                    maxLength={17}
                    className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={verifySiret}
                    disabled={siretStatus === 'checking'}
                    className="px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition disabled:opacity-50 whitespace-nowrap"
                  >
                    {siretStatus === 'checking' ? '...' : 'Vérifier'}
                  </button>
                </div>
                {siretError && <p className="text-red-500 text-sm mt-1">{siretError}</p>}
                {siretStatus === 'ok' && company && (
                  <div className="mt-3 bg-green-50 border border-green-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-green-700 font-semibold mb-1">
                      <span>✅</span> Entreprise vérifiée
                    </div>
                    <p className="text-sm text-gray-700 font-medium">{company.name}</p>
                    <p className="text-xs text-gray-500">{company.address} — {company.nafLabel}</p>
                  </div>
                )}
              </div>

              {/* Nb immeubles */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nombre d'immeubles gérés</label>
                <select
                  value={form.nbImmeubles}
                  onChange={e => setForm({ ...form, nbImmeubles: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none bg-white"
                >
                  <option value="">Sélectionner</option>
                  <option value="1-5">1 à 5 immeubles</option>
                  <option value="6-15">6 à 15 immeubles</option>
                  <option value="16-50">16 à 50 immeubles</option>
                  <option value="51-100">51 à 100 immeubles</option>
                  <option value="100+">Plus de 100 immeubles</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (siretStatus !== 'ok') { setError('Veuillez vérifier votre SIRET'); return }
                  if (!form.nbImmeubles) { setError('Indiquez le nombre d\'immeubles gérés'); return }
                  setError(''); setStep(2)
                }}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg font-bold transition"
              >
                Continuer →
              </button>
            </div>
          )}

          {/* ÉTAPE 2 — Contact */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-900">Vos coordonnées</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prénom</label>
                  <input type="text" value={form.prenom} onChange={e => setForm({ ...form, prenom: e.target.value })} required
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none" placeholder="Jean" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
                  <input type="text" value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} required
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none" placeholder="Dupont" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email professionnel</label>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none" placeholder="jean@monsyndic.fr" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                <input type="tel" value={form.telephone} onChange={e => setForm({ ...form, telephone: e.target.value })} required
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none" placeholder="06 00 00 00 00" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ville</label>
                  <input type="text" value={form.ville} onChange={e => setForm({ ...form, ville: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none" placeholder="Paris" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Code postal</label>
                  <input type="text" value={form.codePostal} onChange={e => setForm({ ...form, codePostal: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none" placeholder="75001" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setStep(1)} className="flex-1 border-2 border-gray-300 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-50 transition">
                  ← Retour
                </button>
                <button type="button" onClick={() => {
                  if (!form.prenom || !form.nom || !form.email || !form.telephone) { setError('Remplissez tous les champs'); return }
                  setError(''); setStep(3)
                }} className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg font-bold transition">
                  Continuer →
                </button>
              </div>
            </div>
          )}

          {/* ÉTAPE 3 — Sécurité */}
          {step === 3 && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <h2 className="text-xl font-bold text-gray-900">Sécurisez votre compte</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
                <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required minLength={8}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none" placeholder="8 caractères minimum" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirmer le mot de passe</label>
                <input type="password" value={form.confirmPassword} onChange={e => setForm({ ...form, confirmPassword: e.target.value })} required
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none" placeholder="Répétez le mot de passe" />
              </div>

              {/* Récap */}
              <div className="bg-purple-50 rounded-xl p-4 text-sm space-y-1 border border-purple-100">
                <p className="font-semibold text-purple-800 mb-2">Récapitulatif</p>
                <p className="text-gray-600">🏢 {company?.name}</p>
                <p className="text-gray-600">👤 {form.prenom} {form.nom} — {form.email}</p>
                <p className="text-gray-600">📊 {form.nbImmeubles} immeubles</p>
                <p className="text-green-600 font-semibold mt-2">✅ 14 jours d'essai gratuit</p>
              </div>

              <p className="text-xs text-gray-500">
                En créant un compte vous acceptez les{' '}
                <Link href="/cgu" className="text-purple-600 hover:underline">CGU</Link> et la{' '}
                <Link href="/confidentialite" className="text-purple-600 hover:underline">politique de confidentialité</Link> de Vitfix.
              </p>

              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(2)} className="flex-1 border-2 border-gray-300 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-50 transition">
                  ← Retour
                </button>
                <button type="submit" disabled={loading} className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg font-bold transition disabled:opacity-50">
                  {loading ? 'Création...' : 'Créer mon compte'}
                </button>
              </div>
            </form>
          )}
        </div>

        <p className="text-center text-gray-500 text-sm mt-6">
          Déjà un compte ?{' '}
          <Link href="/syndic/login" className="text-purple-600 hover:underline font-semibold">Se connecter</Link>
        </p>
      </div>
    </div>
  )
}
