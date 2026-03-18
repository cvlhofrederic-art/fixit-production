// ─── EN Service Pages Data ───
// Standalone data for English service pages targeting Porto expats/tourists/Airbnb owners
// Completely independent from the PT programmatic SEO system (lib/seo-pages-data.ts)

export interface EnServicePage {
  slug: string
  serviceType: string
  isEmergency: boolean
  isEnglishSpeaking: boolean

  // SEO
  metaTitle: string
  metaDescription: string
  canonicalPath: string

  // Content
  heroTitle: string
  heroSubtitle: string
  features: { icon: string; title: string; description: string }[]
  problemsWeSolve: string[]
  coverageAreas: string[]
  faqs: { question: string; answer: string }[]

  // Schema.org
  schemaServiceType: string
  schemaType: 'LocalBusiness' | 'EmergencyService'

  // Cross-links
  ptEquivalentSlug: string | null
  relatedEnSlugs: string[]
}

export const EN_SERVICE_PAGES: EnServicePage[] = [
  // ─── 1. Plumber in Porto ───
  {
    slug: 'plumber-porto',
    serviceType: 'Plumber',
    isEmergency: false,
    isEnglishSpeaking: false,
    metaTitle: 'Plumber in Porto | Verified Professionals | VITFIX',
    metaDescription: 'Need a plumber in Porto? VITFIX connects you with verified, English-speaking plumbers. Free quotes, fast response. Serving Porto, Gaia, Matosinhos and beyond.',
    canonicalPath: '/en/plumber-porto/',
    heroTitle: 'Reliable Plumber in Porto',
    heroSubtitle: 'Get connected with verified plumbing professionals who speak English. Free quotes within 24 hours, no commitment required.',
    features: [
      { icon: '\ud83d\udebf', title: 'Pipe Repair & Replacement', description: 'Fix leaking, burst or corroded pipes in your home, apartment or rental property.' },
      { icon: '\ud83d\udca7', title: 'Leak Detection & Repair', description: 'Advanced leak detection to locate hidden water leaks behind walls and under floors.' },
      { icon: '\ud83c\udf21\ufe0f', title: 'Water Heater Services', description: 'Installation, repair and maintenance of gas and electric water heaters and boilers.' },
      { icon: '\ud83d\udec1', title: 'Bathroom Plumbing', description: 'Complete bathroom plumbing for renovations, new builds and Airbnb properties.' },
      { icon: '\ud83d\udeb0', title: 'Tap & Faucet Repair', description: 'Fix dripping taps, replace old faucets and upgrade kitchen or bathroom fixtures.' },
      { icon: '\ud83c\udfda\ufe0f', title: 'Drain Unblocking', description: 'Professional drain clearing for sinks, showers, toilets and main sewer lines.' },
    ],
    problemsWeSolve: [
      'Dripping or leaking taps and pipes',
      'Blocked drains and toilets',
      'Low water pressure issues',
      'Water heater not working',
      'Burst pipe emergency',
      'Bathroom or kitchen renovation plumbing',
      'Sewer smell in the house',
      'Water damage from hidden leaks',
    ],
    coverageAreas: ['Porto', 'Vila Nova de Gaia', 'Matosinhos', 'Maia', 'Gondomar', 'Valongo', 'Marco de Canaveses', 'Penafiel'],
    faqs: [
      { question: 'How quickly can a plumber come to my property in Porto?', answer: 'Most of our verified plumbers can respond within 2-4 hours for urgent issues, and schedule a visit within 24 hours for non-urgent work. Emergency services are available 24/7.' },
      { question: 'Do your plumbers speak English?', answer: 'Yes, all professionals on our platform serving the Porto expat community are English-speaking or have translation support available to ensure clear communication.' },
      { question: 'How much does a plumber cost in Porto?', answer: 'Plumbing costs in Porto range from \u20ac30 for simple repairs (like fixing a tap) to \u20ac500+ for larger jobs (bathroom renovation plumbing). We provide free quotes so you know the cost upfront.' },
      { question: 'Are your plumbers licensed and insured?', answer: 'All plumbers on VITFIX are verified professionals with valid licenses and insurance. We check credentials before any professional joins our platform.' },
      { question: 'Can you help with plumbing for my Airbnb property?', answer: 'Absolutely. Many of our clients are Airbnb hosts and property investors who need reliable plumbing services for their rental properties in Porto.' },
    ],
    schemaServiceType: 'Plumbing',
    schemaType: 'LocalBusiness',
    ptEquivalentSlug: 'canalizador-marco-de-canaveses',
    relatedEnSlugs: ['emergency-plumber-porto', 'english-speaking-plumber-porto', 'handyman-porto'],
  },

  // ─── 2. Emergency Plumber Porto ───
  {
    slug: 'emergency-plumber-porto',
    serviceType: 'Emergency Plumber',
    isEmergency: true,
    isEnglishSpeaking: false,
    metaTitle: 'Emergency Plumber Porto | 24/7 Available | VITFIX',
    metaDescription: 'Burst pipe? Flooding? Get an emergency plumber in Porto within 1 hour. 24/7 English-speaking plumbing service. Call or WhatsApp now.',
    canonicalPath: '/en/emergency-plumber-porto/',
    heroTitle: 'Emergency Plumber in Porto \u2014 Available 24/7',
    heroSubtitle: 'Burst pipe, flooding or major leak? Our verified emergency plumbers respond within 1 hour across Porto. English-speaking service guaranteed.',
    features: [
      { icon: '\u23f0', title: '24/7 Emergency Response', description: 'Round-the-clock availability including weekends and public holidays.' },
      { icon: '\u26a1', title: 'Fast Response Time', description: 'Average arrival time of 45 minutes across the Porto metropolitan area.' },
      { icon: '\ud83d\udca7', title: 'Burst Pipe Repair', description: 'Immediate containment and repair of burst pipes to prevent water damage.' },
      { icon: '\ud83c\udf0a', title: 'Flood Control', description: 'Emergency water extraction and damage prevention for flooded properties.' },
      { icon: '\ud83d\udec1', title: 'Blocked Drain Emergency', description: 'Urgent drain unblocking when water is backing up in your home.' },
      { icon: '\ud83d\udd27', title: 'Gas Leak Response', description: 'Emergency gas leak detection and isolation for your safety.' },
    ],
    problemsWeSolve: [
      'Burst pipe flooding your home',
      'Severely blocked toilet or drain',
      'Gas smell or suspected gas leak',
      'Water heater failure in winter',
      'Sewage backup into your home',
      'No hot water emergency',
    ],
    coverageAreas: ['Porto', 'Vila Nova de Gaia', 'Matosinhos', 'Maia', 'Gondomar', 'Valongo'],
    faqs: [
      { question: 'How fast can an emergency plumber arrive?', answer: 'Our emergency plumbers typically arrive within 30-60 minutes in central Porto, and within 90 minutes in surrounding areas like Gaia, Matosinhos and Maia.' },
      { question: 'Is there an extra charge for emergency calls?', answer: 'Emergency call-out fees range from \u20ac50-\u20ac80 depending on the time (evenings and weekends may have a surcharge). This is communicated upfront before the plumber arrives.' },
      { question: 'What should I do while waiting for the emergency plumber?', answer: 'Turn off the main water valve (usually near the water meter), move valuables away from water, and if safe, try to contain the leak with towels or buckets.' },
    ],
    schemaServiceType: 'Plumbing',
    schemaType: 'EmergencyService',
    ptEquivalentSlug: null,
    relatedEnSlugs: ['plumber-porto', 'english-speaking-plumber-porto'],
  },

  // ─── 3. Electrician Porto ───
  {
    slug: 'electrician-porto',
    serviceType: 'Electrician',
    isEmergency: false,
    isEnglishSpeaking: false,
    metaTitle: 'Electrician in Porto | Licensed & Verified | VITFIX',
    metaDescription: 'Find a licensed electrician in Porto. VITFIX connects you with verified, English-speaking electricians. Installations, repairs, safety inspections. Free quotes.',
    canonicalPath: '/en/electrician-porto/',
    heroTitle: 'Licensed Electrician in Porto',
    heroSubtitle: 'Connect with certified electrical professionals for installations, repairs and safety inspections. English-speaking service for expats and property owners.',
    features: [
      { icon: '\u26a1', title: 'Electrical Installations', description: 'New outlets, lighting, circuit breakers and complete electrical installations.' },
      { icon: '\ud83d\udca1', title: 'Lighting & Fixtures', description: 'Indoor and outdoor lighting installation, LED upgrades and smart lighting.' },
      { icon: '\ud83d\udd0c', title: 'Socket & Switch Repair', description: 'Fix faulty sockets, switches, and replace outdated electrical components.' },
      { icon: '\ud83d\udee1\ufe0f', title: 'Electrical Safety Inspection', description: 'Comprehensive electrical inspection and safety certification for your property.' },
      { icon: '\u2744\ufe0f', title: 'Air Conditioning', description: 'AC installation, repair and maintenance for homes and commercial properties.' },
      { icon: '\u2600\ufe0f', title: 'Solar Panel Installation', description: 'Design and installation of solar panel systems to reduce energy costs.' },
    ],
    problemsWeSolve: [
      'Power outage in part of the house',
      'Tripping circuit breakers',
      'Faulty or sparking outlets',
      'Need electrical certification for property sale',
      'Old wiring that needs upgrading',
      'AC installation or repair',
      'Outdoor lighting for garden or terrace',
    ],
    coverageAreas: ['Porto', 'Vila Nova de Gaia', 'Matosinhos', 'Maia', 'Gondomar', 'Valongo', 'Marco de Canaveses', 'Penafiel'],
    faqs: [
      { question: 'How much does an electrician cost in Porto?', answer: 'Electrical work in Porto ranges from \u20ac30 for simple repairs to \u20ac1,200+ for major installations. Simple jobs like replacing an outlet cost around \u20ac30-50, while a full electrical panel upgrade can cost \u20ac300-800.' },
      { question: 'Do I need a licensed electrician in Portugal?', answer: 'Yes, Portuguese law requires that electrical work be performed by a licensed professional (Instalador Eletricista). All electricians on VITFIX hold valid DGEG certifications.' },
      { question: 'Can you provide an electrical certificate for my property?', answer: 'Yes, our licensed electricians can perform safety inspections and issue the required electrical certification (Certifica\u00e7\u00e3o Energ\u00e9tica / Certificado de Instala\u00e7\u00e3o El\u00e9ctrica) needed for property sales or rentals.' },
      { question: 'Do your electricians handle smart home installations?', answer: 'Yes, many of our electricians are experienced with smart home systems including automated lighting, smart thermostats, and home automation wiring.' },
    ],
    schemaServiceType: 'Electrician',
    schemaType: 'LocalBusiness',
    ptEquivalentSlug: 'eletricista-marco-de-canaveses',
    relatedEnSlugs: ['handyman-porto', 'home-repair-porto'],
  },

  // ─── 4. Handyman Porto ───
  {
    slug: 'handyman-porto',
    serviceType: 'Handyman',
    isEmergency: false,
    isEnglishSpeaking: false,
    metaTitle: 'Handyman in Porto | All-Round Home Repairs | VITFIX',
    metaDescription: 'Need a reliable handyman in Porto? From furniture assembly to general repairs, our English-speaking handymen handle it all. Free quotes, fast booking.',
    canonicalPath: '/en/handyman-porto/',
    heroTitle: 'Reliable Handyman in Porto',
    heroSubtitle: 'One call for all your home repair needs. Our verified handymen handle everything from furniture assembly to general maintenance. English-speaking service.',
    features: [
      { icon: '\ud83d\udd28', title: 'General Repairs', description: 'Fix doors, windows, shelves, handles and all types of household repairs.' },
      { icon: '\ud83d\udebb', title: 'Furniture Assembly', description: 'IKEA and flat-pack furniture assembly, wall mounting of TVs and shelves.' },
      { icon: '\ud83c\udfa8', title: 'Painting & Touch-ups', description: 'Interior painting, wall touch-ups, and decorative finishes.' },
      { icon: '\ud83d\udeaa', title: 'Door & Window Repair', description: 'Fix sticking doors, broken locks, window mechanisms and draft issues.' },
      { icon: '\ud83e\uddf1', title: 'Tiling & Grouting', description: 'Replace broken tiles, re-grout bathrooms and fix tile damage.' },
      { icon: '\ud83c\udfe0', title: 'Property Maintenance', description: 'Regular maintenance packages for rental properties and holiday homes.' },
    ],
    problemsWeSolve: [
      'Squeaky or sticking doors',
      'Loose or broken handles and hinges',
      'Wall damage, holes and cracks',
      'Furniture assembly needed',
      'TV or shelf wall mounting',
      'General wear and tear in rental property',
      'Pre-checkout repairs for Airbnb',
    ],
    coverageAreas: ['Porto', 'Vila Nova de Gaia', 'Matosinhos', 'Maia', 'Gondomar', 'Valongo', 'Marco de Canaveses', 'Penafiel'],
    faqs: [
      { question: 'What kind of jobs can a handyman do?', answer: 'Our handymen handle a wide range of tasks: furniture assembly, painting, minor plumbing and electrical work, door/window repairs, shelving, TV mounting, tiling repairs, and general property maintenance.' },
      { question: 'How much does a handyman cost per hour in Porto?', answer: 'Handyman services in Porto typically cost between \u20ac25-40 per hour depending on the complexity of the work. Many jobs can be quoted as a fixed price before starting.' },
      { question: 'Can I book a handyman for my Airbnb turnover?', answer: 'Yes, many of our handymen specialize in rental property maintenance and can handle quick repairs between guest check-ins. We can set up recurring maintenance schedules.' },
    ],
    schemaServiceType: 'HomeRepair',
    schemaType: 'LocalBusiness',
    ptEquivalentSlug: null,
    relatedEnSlugs: ['home-repair-porto', 'property-maintenance-porto', 'plumber-porto'],
  },

  // ─── 5. Home Repair Porto ───
  {
    slug: 'home-repair-porto',
    serviceType: 'Home Repair',
    isEmergency: false,
    isEnglishSpeaking: false,
    metaTitle: 'Home Repair Services in Porto | Verified Professionals | VITFIX',
    metaDescription: 'Complete home repair services in Porto. Plumbing, electrical, painting, renovation and more. English-speaking professionals. Free quotes.',
    canonicalPath: '/en/home-repair-porto/',
    heroTitle: 'Home Repair Services in Porto',
    heroSubtitle: 'From plumbing to painting, electrical to renovation \u2014 find verified professionals for every home repair need. Free quotes, English-speaking service.',
    features: [
      { icon: '\ud83d\udebf', title: 'Plumbing Repairs', description: 'Fix leaks, unclog drains, repair taps and water heater issues.' },
      { icon: '\u26a1', title: 'Electrical Repairs', description: 'Fix outlets, switches, lighting and electrical panel issues.' },
      { icon: '\ud83c\udfa8', title: 'Painting Services', description: 'Interior and exterior painting, wall preparation and finishing.' },
      { icon: '\ud83e\uddf1', title: 'Renovation Work', description: 'Kitchen and bathroom renovation, tiling, flooring and structural repairs.' },
      { icon: '\ud83d\udeaa', title: 'Carpentry', description: 'Door and window repair, custom shelving and wood restoration.' },
      { icon: '\ud83c\udfe0', title: 'Waterproofing', description: 'Damp treatment, roof waterproofing and moisture control solutions.' },
    ],
    problemsWeSolve: [
      'Multiple repair needs in one visit',
      'Property renovation project',
      'Damp or moisture problems',
      'Kitchen or bathroom upgrade',
      'Preparing property for sale or rental',
      'Storm or water damage repair',
    ],
    coverageAreas: ['Porto', 'Vila Nova de Gaia', 'Matosinhos', 'Maia', 'Gondomar', 'Valongo', 'Marco de Canaveses', 'Penafiel'],
    faqs: [
      { question: 'Can one professional handle multiple types of repairs?', answer: 'For smaller mixed tasks, our handymen can handle multiple repair types. For specialized work (plumbing, electrical), we connect you with the right certified professional for each trade.' },
      { question: 'How do I get a quote for home repairs?', answer: 'Simply fill out our free quote form describing the work needed. You can attach photos to help our professionals give you an accurate estimate. Most quotes are provided within 24 hours.' },
      { question: 'Do you offer renovation services for entire apartments?', answer: 'Yes, we can connect you with professionals who handle full apartment renovations, from design planning to final finishing. This is popular with investors buying properties in Porto.' },
    ],
    schemaServiceType: 'HomeRepair',
    schemaType: 'LocalBusiness',
    ptEquivalentSlug: null,
    relatedEnSlugs: ['plumber-porto', 'electrician-porto', 'handyman-porto', 'property-maintenance-porto'],
  },

  // ─── 6. Property Maintenance Porto ───
  {
    slug: 'property-maintenance-porto',
    serviceType: 'Property Maintenance',
    isEmergency: false,
    isEnglishSpeaking: false,
    metaTitle: 'Property Maintenance Porto | Airbnb & Rental Management | VITFIX',
    metaDescription: 'Property maintenance services in Porto for Airbnb hosts, landlords and investors. Regular upkeep, emergency repairs, key management. English-speaking team.',
    canonicalPath: '/en/property-maintenance-porto/',
    heroTitle: 'Property Maintenance in Porto',
    heroSubtitle: 'Keep your rental property, Airbnb or investment in perfect condition. Regular maintenance, emergency repairs and property management support.',
    features: [
      { icon: '\ud83c\udfe0', title: 'Regular Maintenance', description: 'Scheduled maintenance visits to keep your property in top condition year-round.' },
      { icon: '\ud83d\udd11', title: 'Key Holding Service', description: 'We hold keys and provide access for repairs when you are not in Porto.' },
      { icon: '\ud83d\udcf1', title: 'Remote Management', description: 'Report issues via WhatsApp with photos and we coordinate the repair for you.' },
      { icon: '\ud83d\udcc5', title: 'Seasonal Checks', description: 'Pre-winter and pre-summer inspections to prevent costly damage.' },
      { icon: '\u26a0\ufe0f', title: 'Emergency Response', description: 'Priority response for urgent issues at your property, even when you are abroad.' },
      { icon: '\ud83d\udcca', title: 'Maintenance Reports', description: 'Regular condition reports with photos so you always know the state of your property.' },
    ],
    problemsWeSolve: [
      'Living abroad and need someone to manage repairs',
      'Airbnb property needs between-guest maintenance',
      'Preventing expensive damage with regular upkeep',
      'Need a trusted contact for emergency access',
      'Coordinating multiple trades for a renovation',
    ],
    coverageAreas: ['Porto', 'Vila Nova de Gaia', 'Matosinhos', 'Maia', 'Gondomar', 'Valongo'],
    faqs: [
      { question: 'How does the property maintenance service work?', answer: 'We assign a dedicated maintenance coordinator to your property. They schedule regular inspections, coordinate any needed repairs, and keep you updated via WhatsApp or email. You can choose monthly or quarterly maintenance plans.' },
      { question: 'I live outside Portugal. Can you manage my property?', answer: 'Absolutely. Many of our clients are international investors and digital nomads who own property in Porto. We handle everything from routine maintenance to emergency repairs, keeping you informed remotely.' },
      { question: 'Do you offer maintenance packages for Airbnb hosts?', answer: 'Yes, we have specific packages for short-term rental hosts that include rapid-response repairs between guest stays, regular deep maintenance, and pre-listing property checks.' },
    ],
    schemaServiceType: 'PropertyMaintenance',
    schemaType: 'LocalBusiness',
    ptEquivalentSlug: null,
    relatedEnSlugs: ['handyman-porto', 'home-repair-porto', 'plumber-porto'],
  },

  // ─── 7. English Speaking Plumber Porto ───
  {
    slug: 'english-speaking-plumber-porto',
    serviceType: 'English Speaking Plumber',
    isEmergency: false,
    isEnglishSpeaking: true,
    metaTitle: 'English Speaking Plumber in Porto | VITFIX',
    metaDescription: 'Looking for an English speaking plumber in Porto? VITFIX connects expats and tourists with verified plumbers who communicate in English. Free quotes.',
    canonicalPath: '/en/english-speaking-plumber-porto/',
    heroTitle: 'English Speaking Plumber in Porto',
    heroSubtitle: 'No Portuguese needed. Our verified plumbers communicate clearly in English, making your plumbing repair experience stress-free as an expat or visitor.',
    features: [
      { icon: '\ud83c\uddec\ud83c\udde7', title: 'Full English Communication', description: 'Every step in English \u2014 from booking to quote to job completion and invoicing.' },
      { icon: '\u2705', title: 'Verified Professionals', description: 'All plumbers are credential-checked, licensed and reviewed by other English-speaking clients.' },
      { icon: '\ud83d\udcb0', title: 'Transparent Pricing', description: 'Clear quotes in English with no hidden costs. Prices explained before work begins.' },
      { icon: '\ud83d\udcf1', title: 'WhatsApp Support', description: 'Message us in English on WhatsApp for quick queries and booking updates.' },
      { icon: '\ud83d\udcc4', title: 'English Invoices', description: 'Receive professional invoices and receipts in English for your records.' },
      { icon: '\u2b50', title: 'Expat-Reviewed', description: 'Rated by other expats and international residents in Porto.' },
    ],
    problemsWeSolve: [
      'Language barrier with local plumbers',
      'Need a plumber who understands your needs in English',
      'Want transparent pricing without miscommunication',
      'Need English documentation for landlord or insurance',
      'Just moved to Porto and need a trusted plumber',
    ],
    coverageAreas: ['Porto', 'Vila Nova de Gaia', 'Matosinhos', 'Maia', 'Gondomar', 'Valongo'],
    faqs: [
      { question: 'Do your plumbers really speak English fluently?', answer: 'Our plumbers range from fluent English speakers to those with strong working English. For every booking, we ensure clear communication \u2014 either directly with the plumber or with translation support from our team.' },
      { question: 'I just moved to Porto and do not speak Portuguese. Can you help?', answer: 'That is exactly what we are here for. Many of our clients are new expats in Porto who need home services in English. We handle the entire process \u2014 from booking to completion \u2014 in English.' },
      { question: 'Is the service more expensive because it is in English?', answer: 'No, our prices are the same as local rates. We do not charge extra for English-language service. You pay the same competitive rates as any customer in Porto.' },
    ],
    schemaServiceType: 'Plumbing',
    schemaType: 'LocalBusiness',
    ptEquivalentSlug: 'canalizador-marco-de-canaveses',
    relatedEnSlugs: ['plumber-porto', 'emergency-plumber-porto'],
  },

  // ─── 8. Apartment Renovation Porto ───
  {
    slug: 'apartment-renovation-porto',
    serviceType: 'Apartment Renovation',
    isEmergency: false,
    isEnglishSpeaking: false,
    metaTitle: 'Apartment Renovation Porto | Turnkey Service for Investors | VITFIX',
    metaDescription: 'Apartment renovation in Porto for expats and investors. Complete turnkey renovation: plumbing, electrical, painting, kitchen and bathroom. Free quotes, remote management.',
    canonicalPath: '/en/apartment-renovation-porto/',
    heroTitle: 'Apartment Renovation in Porto',
    heroSubtitle: 'Complete turnkey renovation for your Porto apartment. From kitchen and bathroom to full property makeover. Remote management for international investors and expat owners.',
    features: [
      { icon: '\ud83c\udfd7\ufe0f', title: 'Full Apartment Renovation', description: 'Kitchen, bathroom, flooring, painting \u2014 complete renovation of your Porto property from start to finish.' },
      { icon: '\ud83d\udcf1', title: 'Remote Management', description: 'WhatsApp photo and video updates at every stage. Manage your renovation from anywhere in the world.' },
      { icon: '\ud83c\uddec\ud83c\udde7', title: 'Full English Communication', description: 'Every step in English: quotes, progress reports, invoices and final handover documentation.' },
      { icon: '\ud83d\udcb0', title: 'Free Detailed Quote', description: 'Clear, itemised quotation with no commitment. Transparent pricing with no hidden costs.' },
      { icon: '\u2705', title: 'Verified Professionals', description: 'All tradespeople are credential-checked, insured and reviewed by other international property owners.' },
      { icon: '\ud83d\udccb', title: 'Turnkey Project Management', description: 'We handle everything: permits, multi-trade coordination, materials sourcing and final clean.' },
    ],
    problemsWeSolve: [
      'Just bought an apartment in Porto and need full renovation',
      'Preparing property for Airbnb short-term rental',
      'Modernising an older building for resale value',
      'Need renovation while living abroad',
      'Coordinating multiple trades (plumber, electrician, painter)',
      'Getting renovation permits in Porto historic areas',
    ],
    coverageAreas: ['Porto', 'Vila Nova de Gaia', 'Matosinhos', 'Maia', 'Gondomar', 'Valongo', 'Marco de Canaveses', 'Penafiel'],
    faqs: [
      { question: 'How much does an apartment renovation cost in Porto?', answer: 'Costs depend on the scope. A light renovation (painting, floors) costs around \u20ac150-250/m\u00b2. A complete renovation (plumbing, electrical, kitchen, bathroom) runs \u20ac400-700/m\u00b2. We provide a free detailed quote upfront.' },
      { question: 'Can I manage the renovation remotely from abroad?', answer: 'Absolutely. Most of our international clients manage their renovations remotely. We send photo and video progress reports via WhatsApp at every stage, and you approve material choices by email.' },
      { question: 'Do I need a permit to renovate an apartment in Porto?', answer: 'For interior work without structural changes, no permit is needed. For structural modifications or properties in historic zones (Ribeira, Baixa), a Câmara Municipal permit is required. We handle all paperwork.' },
      { question: 'How long does a full apartment renovation take?', answer: 'A light renovation (2-bedroom) takes 2-3 weeks. A complete renovation (2-3 bedroom) takes 6-10 weeks depending on complexity. We provide a detailed timeline before starting.' },
      { question: 'Is Porto a good investment for property renovation?', answer: 'Porto remains one of Europe\'s most attractive property investment markets, with strong rental yields (5-8% for Airbnb), the Golden Visa programme, and growing tourism demand. A well-renovated apartment in central Porto can generate excellent returns.' },
    ],
    schemaServiceType: 'Renovation',
    schemaType: 'LocalBusiness',
    ptEquivalentSlug: null,
    relatedEnSlugs: ['plumber-porto', 'electrician-porto', 'handyman-porto', 'property-maintenance-porto'],
  },

  // ─── 9. English Speaking Electrician Porto ───
  {
    slug: 'english-speaking-electrician-porto',
    serviceType: 'English Speaking Electrician',
    isEmergency: false,
    isEnglishSpeaking: true,
    metaTitle: 'English Speaking Electrician in Porto | VITFIX',
    metaDescription: 'Find an English speaking electrician in Porto. Licensed professionals for expats, tourists and property owners. Installations, repairs, safety certificates.',
    canonicalPath: '/en/english-speaking-electrician-porto/',
    heroTitle: 'English Speaking Electrician in Porto',
    heroSubtitle: 'Licensed electricians who communicate in English. Perfect for expats, property investors and Airbnb hosts needing electrical work in Porto.',
    features: [
      { icon: '\ud83c\uddec\ud83c\udde7', title: 'Full English Communication', description: 'Booking, quoting, work and invoicing all conducted in English.' },
      { icon: '\ud83d\udcdc', title: 'Licensed & Certified', description: 'All electricians hold valid Portuguese DGEG licenses and certifications.' },
      { icon: '\u26a1', title: 'All Electrical Work', description: 'From simple outlet repairs to complete rewiring and solar panel installation.' },
      { icon: '\ud83c\udfe0', title: 'Property Certification', description: 'Electrical safety certificates for property sales, rentals and insurance.' },
      { icon: '\ud83d\udcf1', title: 'WhatsApp Support', description: 'Quick communication via WhatsApp in English for scheduling and updates.' },
      { icon: '\ud83d\udcc4', title: 'English Documentation', description: 'Quotes, invoices and certificates provided in English.' },
    ],
    problemsWeSolve: [
      'Need an electrician who speaks English',
      'Electrical certification for property sale or rental',
      'AC installation or repair',
      'Upgrading old electrical installation',
      'Smart home or solar panel installation',
      'Need English documentation for insurance claim',
    ],
    coverageAreas: ['Porto', 'Vila Nova de Gaia', 'Matosinhos', 'Maia', 'Gondomar', 'Valongo'],
    faqs: [
      { question: 'Can you issue an electrical certificate in English?', answer: 'The official Portuguese electrical certificate follows a standard format. However, we can provide an English translation alongside the official document for your records and understanding.' },
      { question: 'I am buying an apartment in Porto. Do I need an electrical inspection?', answer: 'Portuguese law requires properties to have a valid electrical installation certificate for sale. Our licensed electricians can perform the inspection and issue the required certification.' },
      { question: 'Do you handle commercial electrical work?', answer: 'Yes, our licensed electricians handle both residential and commercial electrical work, including offices, shops and restaurant fit-outs in the Porto area.' },
    ],
    schemaServiceType: 'Electrician',
    schemaType: 'LocalBusiness',
    ptEquivalentSlug: 'eletricista-marco-de-canaveses',
    relatedEnSlugs: ['electrician-porto', 'handyman-porto'],
  },
]

// ─── Helper functions ───

export function getEnServicePage(slug: string): EnServicePage | undefined {
  return EN_SERVICE_PAGES.find(p => p.slug === slug)
}

export function getAllEnServiceSlugs(): string[] {
  return EN_SERVICE_PAGES.map(p => p.slug)
}
