'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useTranslation, useLocale } from '@/lib/i18n/context'
import { FEATURED_CATEGORIES, EXTRA_CATEGORIES, CATEGORIES } from '@/lib/categories'
import { PHASE_TEST_DEPTS_FR, PHASE_TEST_COMMUNES_FR, type FRCommune, type FRDepartement } from '@/lib/geo/fr-geo-data'
import { PT_DISTRITOS, ALL_COMMUNES_PT, type PTCommune, type PTDistrito } from '@/lib/geo/pt-geo-data'
import s from './landing-v2.module.css'

// Derive SERVICE_KEYS from the single source of truth
const SERVICE_KEYS = FEATURED_CATEGORIES.map(c => ({ icon: c.icon, key: c.i18nKey, slug: c.slug }))
const SERVICE_KEYS_EXTRA = EXTRA_CATEGORIES.map(c => ({ icon: c.icon, key: c.i18nKey, slug: c.slug }))

export default function HomePage() {
  const router = useRouter()
  const { t } = useTranslation()
  const locale = useLocale()

  const [selectedCategory, setSelectedCategory] = useState('')
  const [location, setLocation] = useState('')
  const [user, setUser] = useState<any>(null)
  const [showAllServices, setShowAllServices] = useState(false)
  const [revealedEls, setRevealedEls] = useState<Set<string>>(new Set())

  // Autocomplete localisation — style Doctolib (phase test : dept 13 FR / Porto PT)
  const [locOpen, setLocOpen] = useState(false)
  const [locCursor, setLocCursor] = useState(0)
  const locBoxRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (locBoxRef.current && !locBoxRef.current.contains(e.target as Node)) setLocOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const searchPath = locale === 'pt' ? '/pesquisar' : '/recherche'
  const registerPath = '/pro/register'
  const tariffsPath = '/pro/tarifs'
  const consumerPricingPath = '/pro/tarifs'

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user || null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user || null))
    return () => subscription.unsubscribe()
  }, [])

  // Scroll reveal — reveals elements entering viewport OR already scrolled past
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(e => {
          // Reveal if intersecting OR if element has been scrolled past (above viewport)
          if (e.isIntersecting || e.boundingClientRect.bottom < 0) {
            const id = (e.target as HTMLElement).dataset.revealId
            if (id) setRevealedEls(prev => new Set(prev).add(id))
            observer.unobserve(e.target)
          }
        })
      },
      { threshold: 0.01, rootMargin: '0px 0px 150px 0px' }
    )
    const raf = requestAnimationFrame(() => {
      document.querySelectorAll('[data-reveal-id]').forEach(el => observer.observe(el))
    })
    // Fallback: on scroll, check for elements scrolled past that observer may have missed
    let scrollTicking = false
    const onScroll = () => {
      if (scrollTicking) return
      scrollTicking = true
      requestAnimationFrame(() => {
        document.querySelectorAll('[data-reveal-id]').forEach(el => {
          const rect = el.getBoundingClientRect()
          const id = (el as HTMLElement).dataset.revealId
          if (id && (rect.top < window.innerHeight + 150)) {
            setRevealedEls(prev => {
              if (prev.has(id)) return prev
              const next = new Set(prev)
              next.add(id)
              return next
            })
          }
        })
        scrollTicking = false
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { cancelAnimationFrame(raf); observer.disconnect(); window.removeEventListener('scroll', onScroll) }
  }, [])

  const revealClass = (id: string) =>
    `${s.reveal}${revealedEls.has(id) ? ` ${s.visible}` : ''}`

  const handleSearch = () => {
    const params = new URLSearchParams()
    if (selectedCategory) params.set('category', selectedCategory)
    if (location) params.set('loc', location)
    router.push(`${searchPath}?${params.toString()}`)
  }

  // Build dropdown categories from single source of truth (lib/categories.ts)
  const allCategories = CATEGORIES.map(cat => ({
    id: cat.slug,
    slug: cat.slug,
    icon: cat.icon,
    name: t(`services.${cat.i18nKey}.title`),
  })).sort((a, b) => a.name.localeCompare(b.name))

  const isPt = locale === 'pt'

  // Suggestions localisation — locale-aware, phase test uniquement (dept 13 FR / Porto PT)
  const locSuggestions = useMemo(() => {
    const raw = location.trim()
    if (raw.length < 1) return [] as Array<{ key: string; label: string; right?: string }>
    const norm = raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const out: Array<{ key: string; label: string; right?: string }> = []
    const seen = new Set<string>()
    const push = (key: string, label: string, right?: string) => {
      if (seen.has(label)) return
      seen.add(label); out.push({ key, label, right })
    }
    if (isPt) {
      // PT : distrito Porto + concelhos + freguesias
      PT_DISTRITOS.forEach((d: PTDistrito) => {
        const n = d.nom.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        if (n.startsWith(norm) || n.includes(norm)) push(`d-${d.code}`, `${d.nom} (distrito)`, d.regiao)
      })
      ALL_COMMUNES_PT.forEach((c: PTCommune) => {
        if (out.length >= 12) return
        const n = c.nom.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        if (n.startsWith(norm) || n.includes(norm)) {
          const label = c.parent ? `${c.nom} · ${c.parent}` : c.nom
          push(`c-${c.code}`, label, c.type === 'freguesia' ? 'freguesia' : 'concelho')
        }
      })
    } else {
      // FR : dept 13 + communes du 13 (phase test)
      PHASE_TEST_DEPTS_FR.forEach((d: FRDepartement) => {
        const n = d.nom.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        if (d.code.startsWith(norm) || n.startsWith(norm) || n.includes(norm)) {
          push(`d-${d.code}`, `${d.code} - ${d.nom}`, d.region)
        }
      })
      PHASE_TEST_COMMUNES_FR.forEach((c: FRCommune) => {
        if (out.length >= 12) return
        const n = c.nom.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        if (n.startsWith(norm) || n.includes(norm) || (c.cp && c.cp.startsWith(norm))) {
          push(`c-${c.code}`, c.nom, c.cp || '')
        }
      })
    }
    return out.slice(0, 10)
  }, [location, isPt])

  const pickLoc = (label: string) => {
    setLocation(label)
    setLocOpen(false)
  }

  return (
    <div className={s.landingPage}>

      {/* ══════ NAV ══════ */}
      <header>
        <nav className={s.nav}>
          <div className={s.navInner}>
            <Link href="/" className={s.navLogo}>
              <span className={s.logoText}>
                <span className={s.logoVit}>VIT</span><span className={s.logoFix}>FIX</span>
              </span>
            </Link>
            <ul className={s.navLinks}>
              <li><a href="#services">{isPt ? 'Serviços' : 'Services'}</a></li>
              <li><a href="#how">{isPt ? 'Como funciona' : 'Comment ça marche'}</a></li>
              <li><a href="#espace-pro">{isPt ? 'Espaço Profissional' : 'Espace Artisan'}</a></li>
              <li><a href="#pricing">{isPt ? 'Preços' : 'Tarifs'}</a></li>
            </ul>
            <div className={s.navRight}>
              <Link href="/auth/login" className={s.btnConnect}>
                {isPt ? 'Entrar' : 'Se connecter'}
              </Link>
            </div>
          </div>
        </nav>
      </header>

      {/* ══════ HERO ══════ */}
      <section className={s.hero}>
        <div className={s.heroInner}>
          <div className={s.heroLeft}>
            <div className={s.heroBadge}>
              ⚡ {isPt ? 'Profissionais verificados · Resposta em 2h' : 'Artisans vérifiés · Réponse en 2h'}
            </div>
            <h1>
              {isPt
                ? <>Encontre e reserve o seu<br />profissional <span className={s.yellow}>online</span></>
                : <>Trouvez et réservez votre<br />artisan <span className={s.yellow}>en ligne</span></>
              }
            </h1>
            <p className={s.heroSub}>
              {t('home.heroDesc') || 'Prenez rendez-vous en quelques clics avec des artisans certifiés près de chez vous. Disponibilités en temps réel, confirmations instantanées.'}
            </p>
            <div className={s.heroButtons}>
              <Link href={searchPath} className={s.btnPrimary}>
                {t('home.findArtisanBtn') || 'Trouver un artisan'}
              </Link>
              <Link href={registerPath} className={s.btnSecondary}>
                {t('home.isArtisan') || 'Vous êtes artisan ?'}
              </Link>
            </div>
            <div className={s.heroTrustTags}>
              <span className={s.trustTag}>✅ {isPt ? 'Profissionais verificados' : 'Artisans vérifiés'}</span>
              <span className={s.trustTag}>⚡ {isPt ? 'Resposta em 2h' : 'Réponse en 2h'}</span>
              <span className={s.trustTag}>⭐ 4.9/5 {isPt ? 'satisfação' : 'satisfaction'}</span>
              <span className={s.trustTag}>📅 {isPt ? 'Agenda em tempo real' : 'Agenda en temps réel'}</span>
            </div>
          </div>

          <div className={`${s.heroRight} ${revealClass('hero-card')}`} data-reveal-id="hero-card">
            <div className={s.heroCard}>
              <div className={s.heroCardTitle}>🔍 {isPt ? 'Reserve a sua intervenção' : 'Réservez votre intervention'}</div>
              <div className={s.formGroup}>
                <label>{isPt ? 'TIPO DE SERVIÇO' : "TYPE D'INTERVENTION"}</label>
                <select
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value)}
                >
                  <option value="">{isPt ? 'Selecione...' : 'Sélectionnez...'}</option>
                  {allCategories.map(cat => (
                    <option key={cat.id} value={cat.slug}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div className={s.formGroup}>
                <label>{isPt ? 'ONDE?' : 'OÙ ?'}</label>
                <div ref={locBoxRef} style={{ position: 'relative' }}>
                  <input
                    type="text"
                    placeholder={isPt ? 'Cidade ou código postal' : 'Code postal ou ville'}
                    value={location}
                    onChange={e => { setLocation(e.target.value); setLocOpen(true); setLocCursor(0) }}
                    onFocus={() => setLocOpen(true)}
                    onKeyDown={e => {
                      if (!locOpen && (e.key === 'ArrowDown')) { setLocOpen(true); return }
                      if (e.key === 'ArrowDown') { e.preventDefault(); setLocCursor(c => Math.min(c + 1, locSuggestions.length - 1)) }
                      else if (e.key === 'ArrowUp') { e.preventDefault(); setLocCursor(c => Math.max(c - 1, 0)) }
                      else if (e.key === 'Enter') {
                        if (locOpen && locSuggestions[locCursor]) { e.preventDefault(); pickLoc(locSuggestions[locCursor].label) }
                        else { handleSearch() }
                      } else if (e.key === 'Escape') {
                        setLocOpen(false)
                      }
                    }}
                  />
                  {locOpen && locSuggestions.length > 0 && (
                    <div role="listbox" style={{
                      position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 30,
                      background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8,
                      boxShadow: '0 4px 18px rgba(0,0,0,.08)', maxHeight: 280, overflowY: 'auto',
                    }}>
                      {locSuggestions.map((sug, i) => (
                        <div
                          key={sug.key}
                          role="option"
                          aria-selected={i === locCursor}
                          onMouseEnter={() => setLocCursor(i)}
                          onMouseDown={(e) => { e.preventDefault(); pickLoc(sug.label) }}
                          style={{
                            padding: '10px 12px', cursor: 'pointer',
                            background: i === locCursor ? '#FFF5E6' : '#fff',
                            borderBottom: i < locSuggestions.length - 1 ? '1px solid #f2f2f2' : 'none',
                            display: 'flex', alignItems: 'center', gap: 10,
                          }}
                        >
                          <span style={{ color: '#222', fontSize: 13, fontWeight: 500 }}>{sug.label}</span>
                          {sug.right && <span style={{ color: '#888', fontSize: 11, marginLeft: 'auto' }}>{sug.right}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <button className={s.btnSearch} onClick={handleSearch}>
                {isPt ? 'Pesquisar profissionais disponíveis' : 'Rechercher les artisans disponibles'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ══════ STATS BAR ══════ */}
      <div className={`${s.statsBar} ${revealClass('stats')}`} data-reveal-id="stats">
        <div className={s.statsBarInner}>
          <div className={s.statItem}>
            <div className={s.statNumber}>2 800+</div>
            <div className={s.statLabel}>{isPt ? 'Profissionais certificados' : 'Artisans certifiés'}</div>
          </div>
          <div className={s.statItem}>
            <div className={s.statNumber}>48 000+</div>
            <div className={s.statLabel}>{isPt ? 'Intervenções realizadas' : 'Interventions réalisées'}</div>
          </div>
          <div className={s.statItem}>
            <div className={s.statNumber}>4.9 / 5</div>
            <div className={s.statLabel}>{isPt ? 'Nota média dos clientes' : 'Note moyenne clients'}</div>
          </div>
          <div className={s.statItem}>
            <div className={s.statNumber}>&lt; 2h</div>
            <div className={s.statLabel}>{isPt ? 'Tempo de resposta médio' : 'Délai de réponse moyen'}</div>
          </div>
        </div>
      </div>

      {/* ══════ SERVICES ══════ */}
      <section className={s.services} id="services">
        <div className={`${s.sectionCenter} ${revealClass('services-header')}`} data-reveal-id="services-header">
          <span className={s.sectionEyebrow}>{isPt ? 'OS NOSSOS SERVIÇOS' : 'NOS PRESTATIONS'}</span>
          <h2 className={s.sectionTitle}>{isPt ? 'Todas as suas reparações cobertas' : 'Tous vos dépannages couverts'}</h2>
          <p className={s.sectionDesc}>{isPt ? 'Profissionais qualificados para cada tipo de intervenção' : "Des professionnels qualifiés pour chaque type d'intervention"}</p>
        </div>

        <div className={`${s.servicesGrid} ${revealClass('services-grid')}`} data-reveal-id="services-grid">
          {SERVICE_KEYS.map(service => (
            <Link key={service.slug} href={`${searchPath}?category=${service.slug}`} className={s.serviceCard}>
              <span className={s.serviceIcon}>{service.icon}</span>
              <h4>{t(`services.${service.key}.title`)}</h4>
              <p>{t(`services.${service.key}.desc`)}</p>
            </Link>
          ))}
        </div>

        {showAllServices && (
          <div className={s.extraServices}>
            <div className={s.servicesGrid}>
              {SERVICE_KEYS_EXTRA.map(service => (
                <Link key={service.slug} href={`${searchPath}?category=${service.slug}`} className={s.serviceCard}>
                  <span className={s.serviceIcon}>{service.icon}</span>
                  <h4>{t(`services.${service.key}.title`)}</h4>
                  <p>{t(`services.${service.key}.desc`)}</p>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className={s.servicesToggle}>
          <button onClick={() => setShowAllServices(p => !p)}>
            {showAllServices
              ? (isPt ? 'Ver menos ↑' : 'Voir moins ↑')
              : (isPt ? `Ver os ${CATEGORIES.length} serviços →` : `Voir les ${CATEGORIES.length} services →`)
            }
          </button>
        </div>
      </section>

      {/* ══════ HOW IT WORKS ══════ */}
      <section className={s.how} id="how">
        <div className={`${s.sectionCenter} ${revealClass('how-header')}`} data-reveal-id="how-header">
          <span className={s.sectionEyebrow}>{isPt ? 'SIMPLES & RÁPIDO' : 'SIMPLE & RAPIDE'}</span>
          <h2 className={s.sectionTitle}>{t('home.howItWorksTitle') || 'Comment ça marche ?'}</h2>
          <p className={s.sectionDesc}>{isPt ? '3 passos para uma intervenção bem-sucedida' : "3 étapes pour une intervention réussie"}</p>
        </div>
        <div className={`${s.howGrid} ${revealClass('how-grid')}`} data-reveal-id="how-grid">
          <div className={s.howStep}>
            <div className={s.stepNum}>1</div>
            <h4>{t('home.step1Name') || 'Cherchez'}</h4>
            <p>{t('home.step1Detail') || "Sélectionnez le type d'intervention, votre localisation et consultez les artisans disponibles près de chez vous."}</p>
          </div>
          <div className={s.howStep}>
            <div className={s.stepNum}>2</div>
            <h4>{t('home.step2Name') || 'Réservez'}</h4>
            <p>{t('home.step2Detail') || "Choisissez un créneau dans l'agenda en temps réel de l'artisan. Confirmation immédiate par SMS et email."}</p>
          </div>
          <div className={s.howStep}>
            <div className={s.stepNum}>3</div>
            <h4>{t('home.step3Name') || 'Recevez'}</h4>
            <p>{t('home.step3Detail') || "L'artisan intervient au créneau choisi. Vous recevez un rappel 24h avant. Payez et notez après l'intervention."}</p>
          </div>
        </div>
      </section>

      {/* ══════ REVIEWS ══════ */}
      <section className={s.reviews}>
        <div className={`${s.sectionCenter} ${revealClass('reviews-header')}`} data-reveal-id="reviews-header">
          <span className={s.sectionEyebrow}>{isPt ? 'O QUE DIZEM' : "CE QU'ILS EN DISENT"}</span>
          <h2 className={s.sectionTitle}>{isPt ? 'Avaliações dos nossos utilizadores' : 'Avis de nos utilisateurs'}</h2>
          <p className={s.reviewsSubtitle}>{isPt ? 'Mais de 2 300 avaliações verificadas · Nota média ' : 'Plus de 12 000 avis vérifiés · Note moyenne '}<strong>4.9 / 5</strong></p>
        </div>
        <div className={`${s.reviewsGrid} ${revealClass('reviews-grid')}`} data-reveal-id="reviews-grid">
          <div className={s.reviewCard}>
            <div className={s.reviewStars}>★★★★★</div>
            <p className={s.reviewText}>{`« ${t('home.review1Text') || "Super rapide, j'ai trouvé un plombier en 30 minutes pour une fuite urgente. L'artisan était ponctuel, professionnel et le prix correspondait exactement au devis."} »`}</p>
            <div className={s.reviewAuthor}>
              <div className={s.reviewAvatar} style={{ background: '#FFCC80' }}>ML</div>
              <div>
                <div className={s.reviewName}>Marie L.</div>
                <div className={s.reviewMeta}>{isPt ? 'Canalização — Porto' : 'Plomberie — Marseille 13006'}</div>
                <div className={s.reviewVerified}>✔ {isPt ? 'Avaliação verificada' : 'Avis vérifié'}</div>
              </div>
            </div>
          </div>
          <div className={s.reviewCard}>
            <div className={s.reviewStars}>★★★★★</div>
            <p className={s.reviewText}>{`« ${t('home.review2Text') || "J'utilise Vitfix depuis 6 mois pour tous mes travaux. La réservation en ligne c'est vraiment pratique, plus besoin de courir après les artisans par téléphone."} »`}</p>
            <div className={s.reviewAuthor}>
              <div className={s.reviewAvatar} style={{ background: '#80DEEA' }}>TC</div>
              <div>
                <div className={s.reviewName}>Thomas C.</div>
                <div className={s.reviewMeta}>{isPt ? 'Eletricidade — Lisboa' : 'Électricité — Lyon 69003'}</div>
                <div className={s.reviewVerified}>✔ {isPt ? 'Avaliação verificada' : 'Avis vérifié'}</div>
              </div>
            </div>
          </div>
          <div className={`${s.reviewCard} ${s.highlighted}`}>
            <div className={s.reviewStars}>★★★★★</div>
            <p className={s.reviewText}>{`« ${t('home.review3Text') || "L'espace artisan est top. Mon agenda est géré automatiquement, je reçois mes rendez-vous sans décrocher le téléphone. Mon CA a augmenté de 40% en 3 mois."} »`}</p>
            <div className={s.reviewAuthor}>
              <div className={s.reviewAvatar} style={{ background: '#FFCC80' }}>KD</div>
              <div>
                <div className={s.reviewName}>Karim D.</div>
                <div className={s.reviewMeta}>{isPt ? 'Profissional Serralheiro — Porto' : 'Artisan Serrurier — Paris'}</div>
                <div className={s.reviewVerified}>✔ {isPt ? 'Avaliação verificada' : 'Avis vérifié'}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════ ESPACE PRO ══════ */}
      <section className={s.espacePro} id="espace-pro">
        <div className={s.espaceProInner}>
          <div className={`${s.proLeft} ${revealClass('pro-left')}`} data-reveal-id="pro-left">
            <div className={s.proEyebrow}>{isPt ? 'ESPAÇO PROFISSIONAL' : 'ESPACE PROFESSIONNEL'}</div>
            <h2 className={s.proTitle}>{t('home.proTitle') || 'Développez votre activité avec Vitfix'}</h2>
            <p className={s.proDesc}>{t('home.proDesc') || 'Rejoignez les 2 800 artisans qui gèrent leur agenda, leurs devis et leur comptabilité depuis une seule application.'}</p>
            <ul className={s.proFeatures}>
              {[
                isPt ? 'Agenda online com confirmações automáticas por SMS' : 'Agenda en ligne avec confirmations automatiques par SMS',
                isPt ? 'Geração de orçamentos e faturas PDF em 30 segundos' : 'Génération de devis et factures PDF en 30 secondes',
                isPt ? 'Proof of Work : fotos antes/depois + assinatura do cliente geolocalizada' : 'Proof of Work : photos avant/après + signature client géolocalisée',
                isPt ? 'Contabilidade IA com declarações de IVA e balanço automatizado' : 'Comptabilité IA avec déclarations TVA et bilan automatisé',
                isPt ? 'Aplicação móvel iOS & Android incluída' : 'Application mobile iOS & Android incluse',
                isPt ? 'Visibilidade junto de milhares de clientes verificados' : 'Visibilité auprès de milliers de clients vérifiés',
              ].map((feat, i) => (
                <li key={i}><span className={s.proCheck}>✓</span> {feat}</li>
              ))}
            </ul>
            <div className={s.proButtons}>
              <Link href={registerPath} className={s.btnYellow}>
                {isPt ? 'Criar o meu espaço pro gratuito' : 'Créer mon espace pro gratuit'}
              </Link>
              <a href="#pricing" className={s.btnOutlineYellow}>
                {isPt ? 'Ver os preços' : 'Voir les tarifs'}
              </a>
            </div>
          </div>
          <div className={`${s.proRight} ${revealClass('pro-right')}`} data-reveal-id="pro-right">
            <div className={s.artisanCard}>
              <div className={s.artisanHeader}>
                <div className={s.artisanAvatar}>KD</div>
                <div>
                  <div className={s.artisanName}>Karim Durrani</div>
                  <div className={s.artisanJob}>{isPt ? 'Serralheiro — Porto' : 'Serrurier — Paris 75011'}</div>
                </div>
                <div className={s.artisanRating}>
                  <div className={s.artisanStars}>★★★★★</div>
                  <div className={s.artisanRatingSub}>4.9 · 127 {isPt ? 'avaliações' : 'avis'}</div>
                </div>
              </div>
              <div className={s.artisanStats}>
                <div className={s.artisanStat}>
                  <div className={s.artisanStatVal}>38</div>
                  <div className={s.artisanStatLabel}>{isPt ? 'Reservas este mês' : 'RDV ce mois'}</div>
                </div>
                <div className={s.artisanStat}>
                  <div className={s.artisanStatVal}>6 240€</div>
                  <div className={s.artisanStatLabel}>{isPt ? 'Faturação este mês' : 'CA ce mois'}</div>
                </div>
                <div className={s.artisanStat}>
                  <div className={s.artisanStatVal}>98%</div>
                  <div className={s.artisanStatLabel}>{isPt ? 'Pontualidade' : 'Ponctualité'}</div>
                </div>
              </div>
              <div className={s.slotsLabel}>📅 {isPt ? 'Próximos horários disponíveis' : 'Prochains créneaux disponibles'}</div>
              <div className={s.slotsWrap}>
                <span className={s.slotAvailable}>{isPt ? 'Seg 09:00' : 'Lun 09:00'}</span>
                <span className={s.slotTaken}>{isPt ? 'Seg 11:00' : 'Lun 11:00'}</span>
                <span className={s.slotAvailable}>{isPt ? 'Ter 14:00' : 'Mar 14:00'}</span>
                <span className={s.slotAvailable}>{isPt ? 'Ter 16:00' : 'Mar 16:00'}</span>
                <span className={s.slotTaken}>{isPt ? 'Qua 09:00' : 'Mer 09:00'}</span>
                <span className={s.slotAvailable}>{isPt ? 'Qui 10:00' : 'Jeu 10:00'}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════ PRICING ══════ */}
      <section className={s.pricing} id="pricing">
        <div className={`${s.sectionCenter} ${revealClass('pricing-header')}`} data-reveal-id="pricing-header">
          <span className={s.sectionEyebrow}>{isPt ? 'PREÇOS TRANSPARENTES' : 'TARIFS TRANSPARENTS'}</span>
          <h2 className={s.sectionTitle}>{isPt ? 'Escolha a sua oferta' : 'Choisissez votre offre'}</h2>
          <p className={s.sectionDesc}>{isPt ? 'Sem compromisso · Sem taxas ocultas · 14 dias de teste gratuito' : 'Sans engagement · Sans frais cachés · 14 jours d\'essai gratuit'}</p>
        </div>
        <div className={`${s.pricingGrid} ${revealClass('pricing-grid')}`} data-reveal-id="pricing-grid">
          <div className={s.pricingCard}>
            <div className={s.pricingTier}>STARTER</div>
            <div className={s.pricingPrice}>{isPt ? 'Gratuito' : 'Gratuit'}</div>
            <div className={s.pricingDesc}>{isPt ? 'Para começar e testar a plataforma' : 'Pour débuter et tester la plateforme'}</div>
            <ul className={s.pricingFeatures}>
              {[
                isPt ? 'Perfil profissional visível' : 'Profil artisan visible',
                isPt ? 'Até 5 reservas/mês' : "Jusqu'à 5 RDV/mois",
                isPt ? 'Orçamento PDF básico' : 'Devis PDF basique',
                isPt ? 'Suporte por email' : 'Support email',
              ].map((f, i) => <li key={i}><span className={s.pfCheck}>✓</span> {f}</li>)}
            </ul>
            <Link href={registerPath} className={s.btnPricingOutline}>
              {isPt ? 'Começar gratuitamente' : 'Commencer gratuitement'}
            </Link>
          </div>

          <div className={`${s.pricingCard} ${s.featured}`}>
            <div className={s.pricingBadge}>⭐ {isPt ? 'O mais popular' : 'Le plus populaire'}</div>
            <div className={s.pricingTier}>PRO</div>
            <div className={s.pricingPrice}>49€ <span className={s.per}>{isPt ? '/mês' : '/mois'}</span></div>
            <div className={s.pricingDesc}>{isPt ? 'Para profissionais que querem aumentar o seu faturamento' : 'Pour les artisans qui veulent développer leur CA'}</div>
            <ul className={s.pricingFeatures}>
              {[
                isPt ? 'Reservas ilimitadas' : 'RDV illimités',
                isPt ? 'Orçamentos & faturas PDF' : 'Devis & factures PDF',
                'Proof of Work',
                isPt ? 'Contabilidade IA' : 'Comptabilité IA',
                isPt ? 'App móvel iOS & Android' : 'App mobile iOS & Android',
                isPt ? 'Suporte prioritário' : 'Support prioritaire',
              ].map((f, i) => <li key={i}><span className={s.pfCheck}>✓</span> {f}</li>)}
            </ul>
            <Link href={registerPath} className={s.btnPricingFilled}>
              {isPt ? 'Experimentar 14 dias grátis' : 'Essayer 14 jours gratuit'}
            </Link>
          </div>

          <div className={s.pricingCard}>
            <div className={s.pricingTier}>BUSINESS</div>
            <div className={s.pricingPrice}>{isPt ? 'Personalizado' : 'Sur mesure'}</div>
            <div className={s.pricingDesc}>{isPt ? 'Para equipas e empresas de construção' : 'Pour les équipes et entreprises du bâtiment'}</div>
            <ul className={s.pricingFeatures}>
              {[
                isPt ? 'Multi-profissionais / agência' : 'Multi-artisans / agence',
                isPt ? 'Painel de controlo centralizado' : 'Tableau de bord centralisé',
                isPt ? 'API e integrações' : 'API & intégrations',
                isPt ? 'Onboarding dedicado' : 'Onboarding dédié',
                isPt ? 'SLA garantido' : 'SLA garanti',
              ].map((f, i) => <li key={i}><span className={s.pfCheck}>✓</span> {f}</li>)}
            </ul>
            <Link href="/contact" className={s.btnPricingOutline}>
              {isPt ? 'Pedir um orçamento' : 'Demander un devis'}
            </Link>
          </div>
        </div>
      </section>

      {/* ══════ CERTIFICATIONS ══════ */}
      <section className={s.certs}>
        <div className={s.certsLabel}>{isPt ? 'CERTIFICAÇÕES & PARCEIROS' : 'CERTIFICATIONS & PARTENAIRES'}</div>
        <div className={`${s.certsRow} ${revealClass('certs')}`} data-reveal-id="certs">
          {[
            { icon: '🏛️', name: isPt ? 'Qualidade Certificada' : 'Qualibat' },
            { icon: '🛡️', name: isPt ? 'Seguros & RCPro' : 'RGE Certifié' },
            { icon: '🥇', name: isPt ? 'Profissionais de Excelência' : "Artisan du Goût" },
            { icon: '📋', name: isPt ? 'Registo Comercial' : 'Registre des Métiers' },
            { icon: '🔒', name: 'RGPD Conforme' },
          ].map((cert, i) => (
            <div key={i} className={s.certItem}>
              <span className={s.certIcon}>{cert.icon}</span>
              <span className={s.certName}>{cert.name}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ══════ VILLES PT ══════ */}
      {isPt && (
        <section style={{ padding: '4rem 0', background: '#F5F3EF' }}>
          <div style={{ maxWidth: '72rem', margin: '0 auto', padding: '0 1rem' }}>
            <h2 className="font-display" style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 800, textAlign: 'center', color: '#1a1a1a', marginBottom: '0.5rem' }}>
              Disponível nestas cidades
            </h2>
            <p style={{ color: '#6b7280', textAlign: 'center', marginBottom: '2rem' }}>
              Profissionais verificados em toda a região do Porto e Tâmega e Sousa
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem' }}>
              {[
                { name: 'Marco de Canaveses', slug: 'marco-de-canaveses', pop: '53450' },
                { name: 'Penafiel', slug: 'penafiel', pop: '72265' },
                { name: 'Amarante', slug: 'amarante', pop: '56264' },
                { name: 'Baião', slug: 'baiao', pop: '20522' },
                { name: 'Felgueiras', slug: 'felgueiras', pop: '58065' },
                { name: 'Lousada', slug: 'lousada', pop: '47387' },
                { name: 'Paços de Ferreira', slug: 'pacos-de-ferreira', pop: '56340' },
                { name: 'Paredes', slug: 'paredes', pop: '86854' },
                { name: 'Porto', slug: 'porto', pop: '231800' },
                { name: 'Vila Nova de Gaia', slug: 'vila-nova-de-gaia', pop: '302296' },
                { name: 'Braga', slug: 'braga', pop: '193324' },
                { name: 'Maia', slug: 'maia', pop: '135306' },
              ].map(city => (
                <Link
                  key={city.slug}
                  href={`/pt/cidade/${city.slug}/`}
                  style={{ background: '#fff', borderRadius: '0.75rem', padding: '1rem', border: '1px solid rgba(0,0,0,0.06)', textAlign: 'center', textDecoration: 'none', transition: 'all 0.2s' }}
                >
                  <span className="font-display" style={{ fontWeight: 700, color: '#1a1a1a', display: 'block' }}>{city.name}</span>
                  <span style={{ fontSize: '0.8rem', color: '#6b7280', display: 'block', marginTop: '0.25rem' }}>
                    {parseInt(city.pop).toLocaleString('pt-PT')} hab.
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ══════ CTA ══════ */}
      <section className={s.cta}>
        <h2>
          {t('home.ctaTitle') || 'Prêt à réserver votre artisan ?'}
        </h2>
        <p>
          {t('home.ctaSubtitle') || "Rejoignez des milliers d'utilisateurs qui ont simplifié leurs dépannages"}
        </p>
        <div className={s.ctaButtons}>
          <Link href={searchPath} className={s.btnCtaWhite}>
            {t('home.findArtisanNow') || 'Trouver un artisan maintenant'}
          </Link>
          <Link href={registerPath} className={s.btnCtaOutline}>
            {isPt ? 'Criar o meu espaço profissional' : 'Créer mon espace artisan'}
          </Link>
        </div>
      </section>

      {/* ══════ FOOTER ══════ */}
      <footer className={s.footer}>
        <div className={s.footerGrid}>
          <div className={s.footerBrand}>
            <span className={s.logoText}><span className={s.logoVit}>VIT</span><span className={s.logoFix}>FIX</span></span>
            <p>{isPt ? 'A ligação profissional-cliente, reinventada.' : 'La mise en relation artisan-client, réinventée.'}</p>
          </div>
          <div className={s.footerCol}>
            <h5>Vitfix</h5>
            <ul>
              <li><Link href={isPt ? '/pt/sobre' : '/fr/a-propos'}>{isPt ? 'Sobre nós' : 'À propos'}</Link></li>
              <li><Link href="/contact">{isPt ? 'Contacto' : 'Contact'}</Link></li>
              <li><Link href={isPt ? '/pt/blog' : '/fr/blog'}>Blog</Link></li>
              <li><Link href={isPt ? '/pt/avaliacoes' : '/fr/avis'}>{isPt ? 'Avaliações' : 'Avis'}</Link></li>
            </ul>
          </div>
          <div className={s.footerCol}>
            <h5>{isPt ? 'Para Particulares' : 'Pour les Particuliers'}</h5>
            <ul>
              <li><Link href={searchPath}>{isPt ? 'Encontrar um profissional' : 'Trouver un artisan'}</Link></li>
              <li><a href="#how">{isPt ? 'Como funciona' : 'Comment ça marche'}</a></li>
              <li><Link href={consumerPricingPath}>{isPt ? 'Preços' : 'Tarifs'}</Link></li>
            </ul>
          </div>
          <div className={s.footerCol}>
            <h5>{isPt ? 'Para Profissionais' : 'Pour les Artisans'}</h5>
            <ul>
              <li><Link href={registerPath}>{isPt ? 'Torne-se parceiro' : 'Devenir partenaire'}</Link></li>
              <li><Link href={tariffsPath}>{isPt ? 'Preços profissionais' : 'Tarifs artisans'}</Link></li>
              <li><Link href={isPt ? '/pro/faq' : '/pro/faq'}>FAQ</Link></li>
            </ul>
          </div>
          <div className={s.footerCol}>
            <h5>{isPt ? 'Legal' : 'Légal'}</h5>
            <ul>
              <li><Link href={isPt ? '/fr/cgu' : '/fr/cgu'}>{isPt ? 'Termos e condições' : 'CGU'}</Link></li>
              <li><Link href="/confidentialite">{isPt ? 'Privacidade' : 'Confidentialité'}</Link></li>
              <li><Link href={isPt ? '/fr/mentions-legales' : '/fr/mentions-legales'}>{isPt ? 'Aviso legal' : 'Mentions légales'}</Link></li>
            </ul>
          </div>
        </div>
        <div className={s.footerBottom}>
          © 2026 Vitfix · {isPt ? 'Todos os direitos reservados' : 'Tous droits réservés'} ·{' '}
          <Link href={isPt ? '/fr/mentions-legales' : '/fr/mentions-legales'}>{isPt ? 'Aviso legal' : 'Mentions légales'}</Link> ·{' '}
          <Link href="/confidentialite">{isPt ? 'Privacidade' : 'Confidentialité'}</Link>
        </div>
      </footer>

    </div>
  )
}
