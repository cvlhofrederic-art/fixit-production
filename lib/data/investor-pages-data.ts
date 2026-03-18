// ─── Investor Landing Pages Data ───
// Multilingual SEO landing pages targeting foreign property investors/owners in Porto
// Languages: FR (French investors), NL (Dutch/Belgian), ES (Spanish), EN (additional)
// Services: Renovation, Plumbing, Electrical, Maintenance

export interface InvestorPage {
  serviceKey: 'renovation' | 'plumbing' | 'electrical' | 'maintenance'
  locale: 'fr' | 'nl' | 'es'
  slug: string

  // SEO
  metaTitle: string
  metaDescription: string
  canonicalPath: string

  // Content
  heroTitle: string
  heroSubtitle: string
  introText: string
  features: { icon: string; title: string; description: string }[]
  whyChooseUs: { title: string; text: string }[]
  faqs: { question: string; answer: string }[]
  ctaTitle: string
  ctaText: string

  // Schema.org
  schemaType: 'LocalBusiness' | 'HomeAndConstructionBusiness'
  schemaServiceTypes: string[]

  // Cross-links (hreflang alternates for this service)
  hreflangAlternates: Record<string, string>

  // Related pages within same locale
  relatedSlugs: string[]
}

// ─────────────────────────────────────
// FRENCH INVESTOR PAGES
// ─────────────────────────────────────

export const FR_INVESTOR_PAGES: InvestorPage[] = [
  // ─── FR: Renovation ───
  {
    serviceKey: 'renovation',
    locale: 'fr',
    slug: 'travaux-appartement-porto',
    metaTitle: 'Travaux Appartement Porto | Rénovation Investisseurs Français | VITFIX',
    metaDescription: 'Rénovation d\'appartement à Porto pour investisseurs français. Travaux clé en main, devis gratuit, suivi à distance. Plomberie, électricité, peinture, rénovation complète.',
    canonicalPath: '/fr/travaux-appartement-porto/',
    heroTitle: 'Travaux et Rénovation à Porto pour Investisseurs Français',
    heroSubtitle: 'Votre appartement à Porto mérite les meilleurs artisans. Rénovation clé en main avec suivi à distance, devis gratuit et communication en français.',
    introText: `Porto attire chaque année des milliers d'investisseurs français séduits par le marché immobilier portugais, le programme Golden Visa et le régime fiscal NHR. Que vous ayez acquis un appartement dans la Baixa, un immeuble à Cedofeita ou une maison à Vila Nova de Gaia, la question des travaux de rénovation se pose rapidement.

VITFIX est votre partenaire local de confiance pour tous vos travaux à Porto. Notre réseau d'artisans vérifiés couvre l'ensemble de la métropole portuane : Porto centro, Gaia, Matosinhos, Maia, Gondomar et Valongo. Nous coordonnons vos chantiers de A à Z, même lorsque vous êtes en France.

Notre service s'adapte parfaitement aux investisseurs à distance : devis détaillé par email, suivi photo régulier via WhatsApp, facturation conforme à la législation portugaise (IVA incluse). Que ce soit pour une rénovation complète avant mise en location Airbnb, des travaux de mise aux normes électriques, ou simplement rafraîchir un bien avant la vente, nos artisans interviennent rapidement et professionnellement.

Les travaux les plus demandés par nos clients français à Porto incluent la rénovation de salles de bain et cuisines, la peinture intérieure, le remplacement de plomberie vétuste, la mise aux normes du tableau électrique, l'installation de climatisation et l'isolation thermique. Chaque intervention est réalisée par un professionnel certifié, avec garantie sur les travaux.`,
    features: [
      { icon: '🏗️', title: 'Rénovation Complète', description: 'Cuisine, salle de bain, sols, peinture — rénovation intégrale de votre bien à Porto.' },
      { icon: '📱', title: 'Suivi à Distance', description: 'Photos et vidéos WhatsApp à chaque étape. Gérez vos travaux depuis la France.' },
      { icon: '🇫🇷', title: 'Communication Française', description: 'Échangez en français avec notre équipe. Devis et factures en français.' },
      { icon: '💰', title: 'Devis Gratuit Détaillé', description: 'Estimation claire et détaillée sans engagement. Prix transparents, sans surprise.' },
      { icon: '✅', title: 'Artisans Vérifiés', description: 'Tous nos artisans sont certifiés, assurés et évalués par d\'autres investisseurs.' },
      { icon: '📋', title: 'Clé en Main', description: 'On gère tout : permis, coordination des corps de métier, nettoyage final.' },
    ],
    whyChooseUs: [
      { title: 'Spécialiste Investisseurs Étrangers', text: 'Nous connaissons les besoins spécifiques des propriétaires français à Porto : normes locales, fiscalité, gestion locative.' },
      { title: 'Réseau Local Vérifié', text: 'Plus de 120 artisans vérifiés dans la métropole de Porto. Chaque professionnel est évalué et certifié.' },
      { title: 'Gestion de Projet Complète', text: 'De la première visite technique au nettoyage final, nous coordonnons l\'ensemble du chantier.' },
    ],
    faqs: [
      { question: 'Combien coûte une rénovation d\'appartement à Porto ?', answer: 'Le coût dépend de l\'ampleur des travaux. Une rénovation légère (peinture, sols) coûte environ 150-250€/m². Une rénovation complète (plomberie, électricité, cuisine, salle de bain) revient à 400-700€/m². Nous fournissons un devis détaillé gratuit.' },
      { question: 'Puis-je gérer les travaux depuis la France ?', answer: 'Absolument. La majorité de nos clients français gèrent leurs travaux à distance. Nous envoyons des rapports photo/vidéo via WhatsApp à chaque étape et vous validez les choix de matériaux par email.' },
      { question: 'Faut-il un permis pour rénover un appartement à Porto ?', answer: 'Pour les travaux intérieurs sans modification structurelle, aucun permis n\'est nécessaire. Pour des modifications structurelles ou en zone historique (Ribeira, Baixa), une autorisation de la Câmara Municipal est requise. Nous gérons les démarches administratives.' },
      { question: 'Combien de temps dure une rénovation complète ?', answer: 'Une rénovation légère (T2) prend 2-3 semaines. Une rénovation complète (T2-T3) nécessite 6-10 semaines selon la complexité. Nous établissons un planning détaillé avant le démarrage.' },
    ],
    ctaTitle: 'Demandez un Devis Gratuit',
    ctaText: 'Décrivez votre projet et recevez un devis détaillé sous 48h. Sans engagement.',
    schemaType: 'HomeAndConstructionBusiness',
    schemaServiceTypes: ['Renovation', 'Construction', 'Painting', 'Tiling', 'Kitchen Renovation', 'Bathroom Renovation'],
    hreflangAlternates: {
      'fr': '/fr/travaux-appartement-porto/',
      'en': '/en/apartment-renovation-porto/',
      'nl': '/nl/appartement-renovatie-porto/',
      'es': '/es/reformas-apartamento-oporto/',
    },
    relatedSlugs: ['plombier-porto', 'electricien-porto', 'entretien-appartement-porto'],
  },

  // ─── FR: Plomberie ───
  {
    serviceKey: 'plumbing',
    locale: 'fr',
    slug: 'plombier-porto',
    metaTitle: 'Plombier Porto | Dépannage Francophone | VITFIX',
    metaDescription: 'Plombier à Porto pour propriétaires français. Dépannage, réparation fuite, installation sanitaire. Service en français, devis gratuit, intervention rapide.',
    canonicalPath: '/fr/plombier-porto/',
    heroTitle: 'Plombier à Porto — Service Francophone',
    heroSubtitle: 'Fuite d\'eau, canalisation bouchée, chauffe-eau en panne ? Nos plombiers vérifiés interviennent rapidement partout à Porto. Communication en français garantie.',
    introText: `Trouver un plombier fiable à Porto quand on est propriétaire français peut être un vrai casse-tête. Barrière de la langue, méconnaissance des normes locales, difficulté à comparer les prix — VITFIX résout tous ces problèmes.

Notre réseau de plombiers certifiés couvre l'intégralité de la métropole de Porto : du centre historique à Vila Nova de Gaia, en passant par Matosinhos, Maia et Gondomar. Chaque intervention est coordonnée en français par notre équipe, du premier diagnostic à la facturation.

Que votre appartement Airbnb ait une fuite d'eau urgente entre deux locataires, que votre immeuble d'investissement nécessite une remise aux normes de la plomberie, ou que vous souhaitiez moderniser la salle de bain de votre résidence secondaire, nos plombiers interviennent avec professionnalisme et transparence.

Les interventions les plus courantes pour nos clients français incluent : réparation de fuites, débouchage de canalisations, remplacement de chauffe-eau, rénovation de salle de bain, installation de robinetterie et mise en conformité de la plomberie pour les biens anciens. Tous nos plombiers sont agréés et assurés conformément à la législation portugaise.`,
    features: [
      { icon: '💧', title: 'Réparation de Fuites', description: 'Détection et réparation rapide de fuites d\'eau, même cachées derrière les murs.' },
      { icon: '🚿', title: 'Salle de Bain Complète', description: 'Rénovation plomberie salle de bain : douche, baignoire, WC, robinetterie.' },
      { icon: '🔥', title: 'Chauffe-eau & Chaudière', description: 'Installation, réparation et entretien de chauffe-eau gaz et électriques.' },
      { icon: '🚰', title: 'Débouchage Urgent', description: 'Débouchage de canalisations, éviers, WC et collecteurs. Intervention rapide.' },
      { icon: '🏠', title: 'Mise aux Normes', description: 'Mise en conformité de la plomberie pour les biens anciens de Porto.' },
      { icon: '📄', title: 'Facture Conforme', description: 'Facturation avec IVA, conforme pour vos déclarations fiscales au Portugal.' },
    ],
    whyChooseUs: [
      { title: 'Intervention Rapide', text: 'Nos plombiers interviennent sous 2-4h pour les urgences et sous 24-48h pour les travaux planifiés.' },
      { title: 'Prix Transparents', text: 'Devis gratuit avant intervention. Pas de surprise, pas de supplément caché.' },
      { title: 'Gestion à Distance', text: 'Idéal pour les propriétaires en France : on gère l\'accès, l\'intervention et le compte-rendu.' },
    ],
    faqs: [
      { question: 'Combien coûte un plombier à Porto ?', answer: 'Les tarifs varient selon l\'intervention : une réparation simple (robinet, fuite) coûte 30-60€. Un débouchage entre 50-120€. Une rénovation complète de salle de bain entre 1 500-4 000€ selon les finitions.' },
      { question: 'Pouvez-vous intervenir en urgence le week-end ?', answer: 'Oui, nos plombiers d\'urgence sont disponibles 7j/7, y compris week-ends et jours fériés. Un supplément de 30-50% s\'applique pour les interventions hors horaires ouvrés.' },
      { question: 'Je suis en France et mon locataire signale une fuite. Que faire ?', answer: 'Contactez-nous par WhatsApp avec les photos du problème. Nous coordonnons l\'intervention directement avec votre locataire ou gestionnaire, et vous tenons informé à chaque étape.' },
      { question: 'Les plombiers parlent-ils français ?', answer: 'Notre équipe de coordination communique en français. Les plombiers eux-mêmes parlent portugais, mais toute la communication avec vous (devis, suivi, facture) se fait en français.' },
    ],
    ctaTitle: 'Devis Plomberie Gratuit',
    ctaText: 'Décrivez votre problème de plomberie et recevez un devis sous 24h.',
    schemaType: 'LocalBusiness',
    schemaServiceTypes: ['Plumbing', 'Pipe Repair', 'Drain Cleaning', 'Water Heater Repair'],
    hreflangAlternates: {
      'fr': '/fr/plombier-porto/',
      'en': '/en/plumber-porto/',
      'nl': '/nl/loodgieter-porto/',
      'es': '/es/fontanero-oporto/',
    },
    relatedSlugs: ['travaux-appartement-porto', 'electricien-porto', 'entretien-appartement-porto'],
  },

  // ─── FR: Électricité ───
  {
    serviceKey: 'electrical',
    locale: 'fr',
    slug: 'electricien-porto',
    metaTitle: 'Électricien Porto | Dépannage & Installation | VITFIX',
    metaDescription: 'Électricien certifié à Porto pour investisseurs français. Installation, dépannage, mise aux normes, certificat énergétique. Service francophone, devis gratuit.',
    canonicalPath: '/fr/electricien-porto/',
    heroTitle: 'Électricien Certifié à Porto',
    heroSubtitle: 'Installation, dépannage et mise aux normes électriques par des professionnels certifiés DGEG. Service coordonné en français pour les propriétaires francophones.',
    introText: `L'électricité est un enjeu majeur pour tout investisseur immobilier à Porto. Les immeubles anciens du centre historique nécessitent souvent une mise aux normes complète du tableau électrique, tandis que les appartements destinés à la location Airbnb doivent répondre aux standards de sécurité portugais.

VITFIX connecte les propriétaires français avec des électriciens certifiés DGEG (Direção-Geral de Energia e Geologia) partout dans la métropole de Porto. Chaque électricien de notre réseau possède les certifications requises par la loi portugaise et une assurance responsabilité civile professionnelle.

Nos interventions couvrent l'ensemble des besoins électriques : installation de prises et interrupteurs, mise aux normes du tableau électrique, câblage pour climatisation, installation de luminaires, certification énergétique pour la vente ou la location, et dépannage d'urgence en cas de panne.

Pour les investisseurs français qui rénovent un bien à Porto, nous proposons un service complet : audit électrique initial, devis détaillé, réalisation des travaux et délivrance du certificat d'installation électrique (obligatoire pour la mise en location). Tout est coordonné en français, même si vous êtes en France.`,
    features: [
      { icon: '⚡', title: 'Mise aux Normes', description: 'Mise en conformité du tableau électrique et du câblage aux normes portugaises.' },
      { icon: '💡', title: 'Installation Complète', description: 'Prises, interrupteurs, luminaires, câblage réseau et prises spécifiques.' },
      { icon: '❄️', title: 'Climatisation', description: 'Installation et raccordement électrique de climatisation réversible.' },
      { icon: '📜', title: 'Certificat Électrique', description: 'Délivrance du certificat d\'installation électrique pour vente ou location.' },
      { icon: '☀️', title: 'Panneaux Solaires', description: 'Installation de panneaux photovoltaïques pour réduire vos charges.' },
      { icon: '🔌', title: 'Dépannage Urgence', description: 'Intervention rapide pour pannes, courts-circuits et coupures.' },
    ],
    whyChooseUs: [
      { title: 'Certifié DGEG', text: 'Tous nos électriciens possèdent la certification DGEG obligatoire au Portugal.' },
      { title: 'Conformité Garantie', text: 'Travaux conformes aux normes portugaises avec certificat à l\'appui.' },
      { title: 'Documentation Française', text: 'Devis, rapports et factures fournis en français pour votre comptabilité.' },
    ],
    faqs: [
      { question: 'Mon appartement à Porto a un vieux tableau électrique. Faut-il le changer ?', answer: 'Si votre tableau date d\'avant 2000, une mise aux normes est fortement recommandée, voire obligatoire pour la mise en location. Le coût d\'un remplacement complet varie de 300 à 800€ selon la complexité.' },
      { question: 'Le certificat électrique est-il obligatoire pour louer au Portugal ?', answer: 'Oui, le Certificado de Instalação Elétrica est obligatoire pour la mise en location et la vente d\'un bien au Portugal. Nos électriciens certifiés peuvent réaliser l\'inspection et délivrer ce certificat.' },
      { question: 'Combien coûte l\'installation d\'une climatisation à Porto ?', answer: 'L\'installation complète d\'un split de climatisation (fourniture + pose + raccordement électrique) coûte entre 700 et 1 400€ par unité, selon la puissance et la difficulté d\'installation.' },
      { question: 'Pouvez-vous installer des panneaux solaires sur mon immeuble ?', answer: 'Oui, nos électriciens sont qualifiés pour l\'installation de systèmes photovoltaïques. Le coût moyen pour un système résidentiel est de 3 000-6 000€, avec un retour sur investissement en 5-7 ans grâce à l\'ensoleillement de Porto.' },
    ],
    ctaTitle: 'Devis Électricité Gratuit',
    ctaText: 'Décrivez vos besoins électriques et recevez un devis sous 24h.',
    schemaType: 'LocalBusiness',
    schemaServiceTypes: ['Electrician', 'Electrical Installation', 'Electrical Certification', 'AC Installation'],
    hreflangAlternates: {
      'fr': '/fr/electricien-porto/',
      'en': '/en/electrician-porto/',
      'nl': '/nl/elektricien-porto/',
      'es': '/es/electricista-oporto/',
    },
    relatedSlugs: ['travaux-appartement-porto', 'plombier-porto', 'entretien-appartement-porto'],
  },

  // ─── FR: Entretien ───
  {
    serviceKey: 'maintenance',
    locale: 'fr',
    slug: 'entretien-appartement-porto',
    metaTitle: 'Entretien Appartement Porto | Gestion Propriété à Distance | VITFIX',
    metaDescription: 'Entretien et maintenance de votre appartement à Porto depuis la France. Gestion locative, réparations, inspections régulières. Service francophone pour investisseurs.',
    canonicalPath: '/fr/entretien-appartement-porto/',
    heroTitle: 'Entretien & Gestion de Propriété à Porto',
    heroSubtitle: 'Vous êtes en France, votre appartement est à Porto ? Nous assurons l\'entretien régulier, les réparations et la maintenance de votre bien immobilier.',
    introText: `Posséder un appartement à Porto depuis la France exige un partenaire de confiance sur place. Que votre bien soit en location longue durée, en Airbnb ou simplement votre résidence secondaire, l'entretien régulier est essentiel pour préserver sa valeur et éviter les mauvaises surprises.

VITFIX propose un service d'entretien et de gestion technique complet pour les propriétaires français à Porto. Notre formule couvre les inspections périodiques, les petites réparations courantes, la coordination avec vos locataires et la gestion des urgences. Tout est rapporté en français via WhatsApp et email.

Pour les propriétaires Airbnb, nous proposons des interventions rapides entre les séjours : vérification de la plomberie et de l'électricité, petites réparations, remplacement d'ampoules et d'accessoires, nettoyage technique des filtres de climatisation. Pour les biens en location longue durée, nous assurons les inspections saisonnières (pré-hiver et pré-été) qui préviennent les dommages coûteux.

Notre service de gestion de clés vous permet de ne jamais avoir à vous déplacer pour un artisan ou un contrôle technique. Nous conservons un jeu de clés en sécurité et coordonnons tous les accès nécessaires, avec votre autorisation préalable pour chaque intervention.`,
    features: [
      { icon: '🏠', title: 'Inspections Régulières', description: 'Visites mensuelles ou trimestrielles avec rapport photo détaillé.' },
      { icon: '🔑', title: 'Gestion de Clés', description: 'Conservation sécurisée des clés et coordination des accès artisans.' },
      { icon: '📱', title: 'Suivi WhatsApp', description: 'Rapports photo/vidéo et communication instantanée en français.' },
      { icon: '🛠️', title: 'Réparations Courantes', description: 'Petits travaux, remplacement d\'équipements, réparations rapides.' },
      { icon: '⚠️', title: 'Urgences 7j/7', description: 'Intervention prioritaire en cas de fuite, panne ou urgence locataire.' },
      { icon: '📊', title: 'Rapports d\'État', description: 'Rapport annuel sur l\'état de votre bien avec recommandations d\'entretien.' },
    ],
    whyChooseUs: [
      { title: 'Partenaire de Confiance', text: 'Des dizaines de propriétaires français nous font confiance pour gérer leurs biens à Porto.' },
      { title: 'Réactivité Garantie', text: 'Réponse sous 2h pour les urgences, intervention sous 24h pour les réparations planifiées.' },
      { title: 'Tout en Français', text: 'Communication, rapports, devis et factures entièrement en français.' },
    ],
    faqs: [
      { question: 'Quels sont les tarifs de l\'entretien régulier ?', answer: 'Nos formules d\'entretien commencent à 50€/mois pour une inspection mensuelle avec rapport. Les formules complètes (inspections + petites réparations incluses + gestion de clés) sont disponibles à partir de 120€/mois.' },
      { question: 'Mon locataire m\'appelle pour un problème. Pouvez-vous gérer à ma place ?', answer: 'C\'est exactement notre rôle. Votre locataire peut nous contacter directement. Nous diagnostiquons le problème, envoyons un artisan si nécessaire, et vous tenons informé à chaque étape. Vous validez les devis depuis la France.' },
      { question: 'Proposez-vous un service pour les propriétaires Airbnb ?', answer: 'Oui, nous avons une formule spécifique Airbnb : vérification technique entre chaque séjour, réparations rapides, remplacement d\'équipements cassés, et maintenance préventive de la climatisation et de la plomberie.' },
      { question: 'Je viens d\'acheter un appartement à Porto. Par quoi commencer ?', answer: 'Nous recommandons un audit technique complet de votre bien (plomberie, électricité, menuiserie, toiture). Cet audit initial (150-250€) identifie les travaux prioritaires et permet d\'établir un plan d\'entretien adapté.' },
    ],
    ctaTitle: 'Demander un Devis Entretien',
    ctaText: 'Décrivez votre bien et vos besoins. Devis personnalisé sous 48h.',
    schemaType: 'LocalBusiness',
    schemaServiceTypes: ['Property Maintenance', 'Property Management', 'Home Inspection', 'Handyman'],
    hreflangAlternates: {
      'fr': '/fr/entretien-appartement-porto/',
      'en': '/en/property-maintenance-porto/',
      'nl': '/nl/appartement-onderhoud-porto/',
      'es': '/es/mantenimiento-apartamento-oporto/',
    },
    relatedSlugs: ['travaux-appartement-porto', 'plombier-porto', 'electricien-porto'],
  },
]

// ─────────────────────────────────────
// DUTCH INVESTOR PAGES
// ─────────────────────────────────────

export const NL_INVESTOR_PAGES: InvestorPage[] = [
  // ─── NL: Renovatie ───
  {
    serviceKey: 'renovation',
    locale: 'nl',
    slug: 'appartement-renovatie-porto',
    metaTitle: 'Appartement Renovatie Porto | Nederlandse Service | VITFIX',
    metaDescription: 'Appartement renoveren in Porto? VITFIX regelt het. Betrouwbare vakmensen, gratis offerte, begeleiding op afstand. Ideaal voor Nederlandse investeerders in Portugal.',
    canonicalPath: '/nl/appartement-renovatie-porto/',
    heroTitle: 'Appartement Renovatie in Porto voor Nederlandse Investeerders',
    heroSubtitle: 'Uw appartement in Porto laten renoveren? Wij regelen alles: betrouwbare vakmensen, gratis offerte en begeleiding op afstand vanuit Nederland of België.',
    introText: `Porto is een van de populairste bestemmingen voor Nederlandse en Belgische vastgoedinvesteerders. Met het Golden Visa-programma, de gunstige fiscale regeling (NHR) en het groeiende toerisme biedt Porto uitstekende kansen. Maar een appartement kopen is één ding — het renoveren vanuit Nederland of België is een andere uitdaging.

VITFIX is uw lokale partner voor alle renovatiewerkzaamheden in Porto. Ons netwerk van geverifieerde vakmensen dekt de hele metropoolregio: Porto centrum, Vila Nova de Gaia, Matosinhos, Maia, Gondomar en Valongo. Wij coördineren uw verbouwing van A tot Z, ook wanneer u in Nederland of België bent.

Onze service is speciaal ontworpen voor buitenlandse eigenaren: gedetailleerde offertes per email, regelmatige foto-updates via WhatsApp, facturatie conform de Portugese wetgeving (IVA inbegrepen). Of het nu gaat om een complete renovatie voor Airbnb-verhuur, het moderniseren van een badkamer, of het upgraden van de elektrische installatie — onze vakmensen leveren kwaliteitswerk.

De meest gevraagde werkzaamheden door onze Nederlandse klanten zijn: badkamer- en keukenrenovatie, binnenschilderwerk, vervanging van oude leidingen, vernieuwing van het elektrisch paneel, airco-installatie en thermische isolatie.`,
    features: [
      { icon: '🏗️', title: 'Complete Renovatie', description: 'Keuken, badkamer, vloeren, schilderwerk — totale renovatie van uw woning in Porto.' },
      { icon: '📱', title: 'Begeleiding op Afstand', description: 'WhatsApp foto\'s en video\'s bij elke stap. Beheer uw verbouwing vanuit Nederland.' },
      { icon: '🇬🇧', title: 'Engelse Communicatie', description: 'Alle communicatie in het Engels. Offertes en facturen in het Engels.' },
      { icon: '💰', title: 'Gratis Offerte', description: 'Duidelijke, gedetailleerde offerte zonder verplichtingen. Transparante prijzen.' },
      { icon: '✅', title: 'Geverifieerde Vakmensen', description: 'Al onze vakmensen zijn gecertificeerd, verzekerd en beoordeeld door andere investeerders.' },
      { icon: '📋', title: 'Turnkey Project', description: 'Wij regelen alles: vergunningen, coördinatie vakmensen, eindschoonmaak.' },
    ],
    whyChooseUs: [
      { title: 'Specialist Buitenlandse Eigenaren', text: 'Wij kennen de specifieke behoeften van Nederlandse en Belgische vastgoedeigenaren in Porto.' },
      { title: 'Lokaal Geverifieerd Netwerk', text: 'Meer dan 120 geverifieerde vakmensen in de metropoolregio Porto.' },
      { title: 'Volledige Projectbegeleiding', text: 'Van de eerste technische inspectie tot de eindoplevering.' },
    ],
    faqs: [
      { question: 'Wat kost een appartement renovatie in Porto?', answer: 'De kosten hangen af van de omvang. Een lichte renovatie (schilderwerk, vloeren) kost ongeveer €150-250/m². Een complete renovatie (leidingen, elektra, keuken, badkamer) komt neer op €400-700/m². Wij verstrekken een gratis gedetailleerde offerte.' },
      { question: 'Kan ik de verbouwing vanuit Nederland beheren?', answer: 'Absoluut. De meeste van onze Nederlandse klanten beheren hun verbouwing op afstand. Wij sturen foto- en videorapporten via WhatsApp bij elke fase en u keurt materialen per email goed.' },
      { question: 'Heb ik een vergunning nodig voor een renovatie in Porto?', answer: 'Voor interne werkzaamheden zonder structurele wijzigingen is geen vergunning nodig. Voor structurele wijzigingen of in historische zones (Ribeira, Baixa) is een vergunning van de Câmara Municipal vereist. Wij regelen de administratie.' },
      { question: 'Hoe lang duurt een complete renovatie?', answer: 'Een lichte renovatie (T2) duurt 2-3 weken. Een complete renovatie (T2-T3) duurt 6-10 weken afhankelijk van de complexiteit. We stellen een gedetailleerde planning op voor aanvang.' },
    ],
    ctaTitle: 'Vraag een Gratis Offerte Aan',
    ctaText: 'Beschrijf uw project en ontvang binnen 48 uur een gedetailleerde offerte. Vrijblijvend.',
    schemaType: 'HomeAndConstructionBusiness',
    schemaServiceTypes: ['Renovation', 'Construction', 'Painting', 'Tiling', 'Kitchen Renovation', 'Bathroom Renovation'],
    hreflangAlternates: {
      'fr': '/fr/travaux-appartement-porto/',
      'en': '/en/apartment-renovation-porto/',
      'nl': '/nl/appartement-renovatie-porto/',
      'es': '/es/reformas-apartamento-oporto/',
    },
    relatedSlugs: ['loodgieter-porto', 'elektricien-porto', 'appartement-onderhoud-porto'],
  },

  // ─── NL: Loodgieter ───
  {
    serviceKey: 'plumbing',
    locale: 'nl',
    slug: 'loodgieter-porto',
    metaTitle: 'Loodgieter Porto | Betrouwbare Service | VITFIX',
    metaDescription: 'Loodgieter nodig in Porto? VITFIX verbindt u met geverifieerde loodgieters. Lekkages, verstoppingen, boiler reparatie. Engelse service, gratis offerte.',
    canonicalPath: '/nl/loodgieter-porto/',
    heroTitle: 'Betrouwbare Loodgieter in Porto',
    heroSubtitle: 'Lekkage, verstopping of boilerproblemen? Onze geverifieerde loodgieters komen snel ter plaatse in heel Porto. Communicatie in het Engels gegarandeerd.',
    introText: `Als Nederlandse of Belgische vastgoedeigenaar in Porto heeft u een betrouwbare loodgieter nodig die u kunt vertrouwen — ook als u er niet bent. VITFIX lost dit op met ons netwerk van gecertificeerde loodgieters in de hele metropoolregio Porto.

Of uw Airbnb-appartement een waterlek heeft tussen twee gasten, uw huurwoning nieuwe leidingen nodig heeft, of de boiler van uw vakantiehuis het heeft begeven — onze loodgieters zijn snel ter plaatse. Alle communicatie verloopt in het Engels via onze coördinatie.

Wij dekken Porto centrum, Vila Nova de Gaia, Matosinhos, Maia en Gondomar. Elke loodgieter in ons netwerk is gecertificeerd en verzekerd conform de Portugese wetgeving. U ontvangt een duidelijke offerte vooraf, zodat u precies weet wat het kost.

Veel voorkomende klussen voor onze Nederlandse klanten: lekdetectie en reparatie, ontstopping van afvoeren, boiler vervanging, badkamerrenovatie (leidingwerk), kraanreparatie en vervanging, en sanitaire installaties voor nieuwbouw of verbouwing.`,
    features: [
      { icon: '💧', title: 'Lekreparatie', description: 'Snelle detectie en reparatie van waterlekken, ook achter muren en onder vloeren.' },
      { icon: '🚿', title: 'Badkamer Leidingwerk', description: 'Complete sanitaire installatie voor badkamerrenovatie: douche, bad, toilet, kranen.' },
      { icon: '🔥', title: 'Boiler Service', description: 'Installatie, reparatie en onderhoud van gas- en elektrische boilers.' },
      { icon: '🚰', title: 'Spoedontverstopping', description: 'Ontstopping van afvoeren, toiletten, gootstenen en hoofdriool.' },
      { icon: '🏠', title: 'Keuring Leidingen', description: 'Inspectie en vernieuwing van oude leidingen in historische panden.' },
      { icon: '📄', title: 'Conforme Factuur', description: 'Facturatie met IVA, geschikt voor uw Portugese belastingaangifte.' },
    ],
    whyChooseUs: [
      { title: 'Snelle Interventie', text: 'Onze loodgieters komen binnen 2-4 uur voor spoedgevallen en binnen 24-48 uur voor geplande werkzaamheden.' },
      { title: 'Transparante Prijzen', text: 'Gratis offerte vooraf. Geen verrassingen, geen verborgen kosten.' },
      { title: 'Beheer op Afstand', text: 'Ideaal voor eigenaren in Nederland: wij regelen de toegang, de interventie en het verslag.' },
    ],
    faqs: [
      { question: 'Wat kost een loodgieter in Porto?', answer: 'Tarieven variëren per klus: een eenvoudige reparatie (kraan, lek) kost €30-60. Een ontstopping €50-120. Een complete badkamerrenovatie (leidingwerk) €1.500-4.000 afhankelijk van de afwerking.' },
      { question: 'Kunnen jullie in het weekend komen voor een noodgeval?', answer: 'Ja, onze spoedloodgieters zijn 7 dagen per week beschikbaar, inclusief weekenden en feestdagen. Een toeslag van 30-50% geldt voor interventies buiten kantooruren.' },
      { question: 'Mijn huurder meldt een lekkage en ik ben in Nederland. Wat nu?', answer: 'Stuur ons een WhatsApp met foto\'s van het probleem. Wij coördineren de interventie direct met uw huurder of beheerder en houden u op de hoogte bij elke stap.' },
      { question: 'Spreken de loodgieters Engels?', answer: 'Ons coördinatieteam communiceert in het Engels. De loodgieters spreken Portugees, maar alle communicatie met u (offertes, updates, facturen) verloopt in het Engels.' },
    ],
    ctaTitle: 'Gratis Loodgieter Offerte',
    ctaText: 'Beschrijf uw loodgietersprobleem en ontvang binnen 24 uur een offerte.',
    schemaType: 'LocalBusiness',
    schemaServiceTypes: ['Plumbing', 'Pipe Repair', 'Drain Cleaning', 'Water Heater Repair'],
    hreflangAlternates: {
      'fr': '/fr/plombier-porto/',
      'en': '/en/plumber-porto/',
      'nl': '/nl/loodgieter-porto/',
      'es': '/es/fontanero-oporto/',
    },
    relatedSlugs: ['appartement-renovatie-porto', 'elektricien-porto', 'appartement-onderhoud-porto'],
  },

  // ─── NL: Elektricien ───
  {
    serviceKey: 'electrical',
    locale: 'nl',
    slug: 'elektricien-porto',
    metaTitle: 'Elektricien Porto | Gecertificeerd & Betrouwbaar | VITFIX',
    metaDescription: 'Gecertificeerde elektricien in Porto voor Nederlandse investeerders. Installatie, reparatie, keuring, energiecertificaat. Engelse service, gratis offerte.',
    canonicalPath: '/nl/elektricien-porto/',
    heroTitle: 'Gecertificeerde Elektricien in Porto',
    heroSubtitle: 'Installatie, reparatie en elektrische keuring door DGEG-gecertificeerde professionals. Engelse communicatie voor Nederlandse en Belgische eigenaren.',
    introText: `De elektrische installatie is een cruciaal aspect van elk vastgoedinvestering in Porto. Oudere gebouwen in het historische centrum hebben vaak een volledige vernieuwing van de meterkast nodig, terwijl appartementen bestemd voor Airbnb-verhuur moeten voldoen aan de Portugese veiligheidsnormen.

VITFIX verbindt Nederlandse en Belgische eigenaren met DGEG-gecertificeerde elektriciens in de hele metropoolregio Porto. Elke elektricien in ons netwerk bezit de wettelijk vereiste certificeringen en een beroepsaansprakelijkheidsverzekering.

Onze diensten omvatten het volledige spectrum: installatie van stopcontacten en schakelaars, vernieuwing van de meterkast, bekabeling voor airconditioning, installatie van verlichting, energiecertificering voor verkoop of verhuur, en spoedinterventies bij stroomuitval.

Voor Nederlandse investeerders die een woning renoveren in Porto bieden wij een compleet traject: elektrische audit, gedetailleerde offerte, uitvoering en afgifte van het elektrisch installatiecertificaat (verplicht voor verhuur). Alles wordt in het Engels gecoördineerd.`,
    features: [
      { icon: '⚡', title: 'Meterkast Vernieuwing', description: 'Vernieuwing van de meterkast en bekabeling conform Portugese normen.' },
      { icon: '💡', title: 'Complete Installatie', description: 'Stopcontacten, schakelaars, verlichting, netwerkbekabeling en speciale aansluitingen.' },
      { icon: '❄️', title: 'Airco Installatie', description: 'Installatie en elektrische aansluiting van airconditioningsystemen.' },
      { icon: '📜', title: 'Elektrisch Certificaat', description: 'Afgifte van het verplichte elektrische installatiecertificaat voor verkoop of verhuur.' },
      { icon: '☀️', title: 'Zonnepanelen', description: 'Installatie van fotovoltaïsche systemen om uw energiekosten te verlagen.' },
      { icon: '🔌', title: 'Spoedinterventie', description: 'Snelle interventie bij stroomuitval, kortsluiting en storingen.' },
    ],
    whyChooseUs: [
      { title: 'DGEG Gecertificeerd', text: 'Al onze elektriciens bezitten de verplichte DGEG-certificering voor Portugal.' },
      { title: 'Gegarandeerde Conformiteit', text: 'Werkzaamheden conform Portugese normen met certificaat ter ondersteuning.' },
      { title: 'Engelse Documentatie', text: 'Offertes, rapporten en facturen in het Engels voor uw administratie.' },
    ],
    faqs: [
      { question: 'Mijn appartement in Porto heeft een oude meterkast. Moet die vervangen worden?', answer: 'Als uw meterkast van voor 2000 dateert, is vernieuwing sterk aanbevolen en vaak verplicht voor verhuur. Een volledige vervanging kost tussen €300 en €800 afhankelijk van de complexiteit.' },
      { question: 'Is het elektrisch certificaat verplicht voor verhuur in Portugal?', answer: 'Ja, het Certificado de Instalação Elétrica is verplicht voor zowel verhuur als verkoop van onroerend goed in Portugal. Onze gecertificeerde elektriciens kunnen de inspectie uitvoeren en dit certificaat afgeven.' },
      { question: 'Wat kost een airco-installatie in Porto?', answer: 'Een complete installatie van een split-airco (apparaat + montage + elektrische aansluiting) kost tussen €700 en €1.400 per unit, afhankelijk van het vermogen en de installatiemoeilijkheid.' },
      { question: 'Kunnen jullie zonnepanelen installeren op mijn gebouw?', answer: 'Ja, onze elektriciens zijn gekwalificeerd voor de installatie van fotovoltaïsche systemen. De gemiddelde kosten voor een residentieel systeem zijn €3.000-6.000, met een terugverdientijd van 5-7 jaar dankzij het zonrijke Porto.' },
    ],
    ctaTitle: 'Gratis Elektra Offerte',
    ctaText: 'Beschrijf uw elektrische behoeften en ontvang binnen 24 uur een offerte.',
    schemaType: 'LocalBusiness',
    schemaServiceTypes: ['Electrician', 'Electrical Installation', 'Electrical Certification', 'AC Installation'],
    hreflangAlternates: {
      'fr': '/fr/electricien-porto/',
      'en': '/en/electrician-porto/',
      'nl': '/nl/elektricien-porto/',
      'es': '/es/electricista-oporto/',
    },
    relatedSlugs: ['appartement-renovatie-porto', 'loodgieter-porto', 'appartement-onderhoud-porto'],
  },

  // ─── NL: Onderhoud ───
  {
    serviceKey: 'maintenance',
    locale: 'nl',
    slug: 'appartement-onderhoud-porto',
    metaTitle: 'Appartement Onderhoud Porto | Vastgoedbeheer op Afstand | VITFIX',
    metaDescription: 'Onderhoud van uw appartement in Porto vanuit Nederland. Vastgoedbeheer, reparaties, regelmatige inspecties. Engelse service voor investeerders.',
    canonicalPath: '/nl/appartement-onderhoud-porto/',
    heroTitle: 'Appartement Onderhoud & Vastgoedbeheer in Porto',
    heroSubtitle: 'U bent in Nederland, uw appartement staat in Porto? Wij zorgen voor het regelmatig onderhoud, reparaties en technisch beheer van uw vastgoed.',
    introText: `Een appartement bezitten in Porto vanuit Nederland of België vereist een betrouwbare partner ter plaatse. Of uw woning nu wordt verhuurd op lange termijn, via Airbnb of simpelweg uw tweede huis is — regelmatig onderhoud is essentieel om de waarde te behouden en onaangename verrassingen te voorkomen.

VITFIX biedt een complete technische onderhouds- en beheerdienst voor Nederlandse en Belgische vastgoedeigenaren in Porto. Onze service omvat periodieke inspecties, reguliere kleine reparaties, coördinatie met uw huurders en het afhandelen van noodgevallen. Alles wordt in het Engels gerapporteerd via WhatsApp en email.

Voor Airbnb-eigenaren bieden wij snelle interventies tussen boekingen: controle van sanitair en elektra, kleine reparaties, vervanging van lampen en accessoires, technische reiniging van airconditioningfilters. Voor langetermijnverhuur zorgen wij voor seizoensinspecties (voor de winter en voor de zomer) die kostbare schade voorkomen.

Onze sleutelbeheerservice betekent dat u nooit hoeft te reizen voor een vakman of technische controle. Wij bewaren een reservesleutel in een beveiligde omgeving en coördineren alle benodigde toegang, met uw voorafgaande toestemming voor elke interventie.`,
    features: [
      { icon: '🏠', title: 'Regelmatige Inspecties', description: 'Maandelijkse of driemaandelijkse bezoeken met gedetailleerd fotoverslag.' },
      { icon: '🔑', title: 'Sleutelbeheer', description: 'Beveiligde bewaring van sleutels en coördinatie van toegang voor vakmensen.' },
      { icon: '📱', title: 'WhatsApp Updates', description: 'Foto- en videorapporten en directe communicatie in het Engels.' },
      { icon: '🛠️', title: 'Kleine Reparaties', description: 'Kleine klussen, vervanging van apparatuur, snelle reparaties.' },
      { icon: '⚠️', title: 'Spoed 7/7', description: 'Prioritaire interventie bij lekkage, storing of huurdersnoodgeval.' },
      { icon: '📊', title: 'Statusrapporten', description: 'Jaarlijks rapport over de staat van uw woning met onderhoudsaanbevelingen.' },
    ],
    whyChooseUs: [
      { title: 'Betrouwbare Partner', text: 'Tientallen Nederlandse en Belgische eigenaren vertrouwen op ons voor het beheer van hun vastgoed in Porto.' },
      { title: 'Gegarandeerde Reactiesnelheid', text: 'Antwoord binnen 2 uur voor noodgevallen, interventie binnen 24 uur voor geplande reparaties.' },
      { title: 'Alles in het Engels', text: 'Communicatie, rapporten, offertes en facturen volledig in het Engels.' },
    ],
    faqs: [
      { question: 'Wat kosten de reguliere onderhoudsdiensten?', answer: 'Onze onderhoudsformules beginnen vanaf €50/maand voor een maandelijkse inspectie met rapport. Complete formules (inspecties + kleine reparaties inbegrepen + sleutelbeheer) zijn beschikbaar vanaf €120/maand.' },
      { question: 'Mijn huurder belt over een probleem. Kunnen jullie dat voor mij afhandelen?', answer: 'Dat is precies onze rol. Uw huurder kan ons rechtstreeks contacteren. Wij stellen de diagnose, sturen indien nodig een vakman, en houden u bij elke stap op de hoogte. U keurt offertes goed vanuit Nederland.' },
      { question: 'Bieden jullie een service voor Airbnb-eigenaren?', answer: 'Ja, wij hebben een specifieke Airbnb-formule: technische controle tussen boekingen, snelle reparaties, vervanging van kapotte apparatuur, en preventief onderhoud van airco en sanitair.' },
      { question: 'Ik heb net een appartement in Porto gekocht. Waar begin ik?', answer: 'Wij adviseren een complete technische audit van uw woning (sanitair, elektra, schrijnwerk, dak). Deze initiële audit (€150-250) identificeert prioritaire werkzaamheden en stelt een passend onderhoudsplan op.' },
    ],
    ctaTitle: 'Vraag een Onderhoudsofferte Aan',
    ctaText: 'Beschrijf uw woning en behoeften. Persoonlijke offerte binnen 48 uur.',
    schemaType: 'LocalBusiness',
    schemaServiceTypes: ['Property Maintenance', 'Property Management', 'Home Inspection', 'Handyman'],
    hreflangAlternates: {
      'fr': '/fr/entretien-appartement-porto/',
      'en': '/en/property-maintenance-porto/',
      'nl': '/nl/appartement-onderhoud-porto/',
      'es': '/es/mantenimiento-apartamento-oporto/',
    },
    relatedSlugs: ['appartement-renovatie-porto', 'loodgieter-porto', 'elektricien-porto'],
  },
]

// ─────────────────────────────────────
// SPANISH INVESTOR PAGES
// ─────────────────────────────────────

export const ES_INVESTOR_PAGES: InvestorPage[] = [
  // ─── ES: Reformas ───
  {
    serviceKey: 'renovation',
    locale: 'es',
    slug: 'reformas-apartamento-oporto',
    metaTitle: 'Reformas Apartamento Oporto | Para Inversores Españoles | VITFIX',
    metaDescription: 'Reformas de apartamento en Oporto para inversores españoles. Obras llave en mano, presupuesto gratis, seguimiento a distancia. Fontanería, electricidad, pintura.',
    canonicalPath: '/es/reformas-apartamento-oporto/',
    heroTitle: 'Reformas y Renovación en Oporto para Inversores Españoles',
    heroSubtitle: 'Su apartamento en Oporto merece los mejores profesionales. Reformas llave en mano con seguimiento a distancia, presupuesto gratis y comunicación en español.',
    introText: `Oporto se ha convertido en uno de los destinos favoritos de los inversores inmobiliarios españoles. La proximidad geográfica, el programa Golden Visa, el régimen fiscal NHR y la creciente demanda turística hacen de Oporto una ciudad ideal para la inversión. Sin embargo, reformar un apartamento a distancia puede ser complicado sin un socio local de confianza.

VITFIX es su aliado en Oporto para todo tipo de obras y reformas. Nuestra red de profesionales verificados cubre toda la zona metropolitana: Oporto centro, Vila Nova de Gaia, Matosinhos, Maia, Gondomar y Valongo. Coordinamos su reforma de principio a fin, incluso cuando usted está en España.

Nuestro servicio está diseñado para propietarios a distancia: presupuestos detallados por email, seguimiento fotográfico por WhatsApp, facturación conforme a la legislación portuguesa (IVA incluido). Ya sea una reforma integral para alquiler vacacional, una renovación de baño, o la puesta al día de la instalación eléctrica, nuestros profesionales trabajan con calidad y transparencia.

Las obras más solicitadas por nuestros clientes españoles incluyen: reforma de baños y cocinas, pintura interior, sustitución de tuberías antiguas, actualización del cuadro eléctrico, instalación de aire acondicionado y aislamiento térmico. Cada intervención la realiza un profesional certificado con garantía.`,
    features: [
      { icon: '🏗️', title: 'Reforma Integral', description: 'Cocina, baño, suelos, pintura — renovación completa de su vivienda en Oporto.' },
      { icon: '📱', title: 'Seguimiento a Distancia', description: 'Fotos y vídeos por WhatsApp en cada etapa. Gestione su obra desde España.' },
      { icon: '🇬🇧', title: 'Comunicación en Inglés', description: 'Toda la comunicación en inglés. Presupuestos y facturas en inglés.' },
      { icon: '💰', title: 'Presupuesto Gratis', description: 'Estimación clara y detallada sin compromiso. Precios transparentes.' },
      { icon: '✅', title: 'Profesionales Verificados', description: 'Todos nuestros profesionales están certificados, asegurados y valorados.' },
      { icon: '📋', title: 'Llave en Mano', description: 'Lo gestionamos todo: licencias, coordinación de gremios, limpieza final.' },
    ],
    whyChooseUs: [
      { title: 'Especialistas en Inversores Extranjeros', text: 'Conocemos las necesidades de los propietarios españoles en Oporto: normativa local, fiscalidad, gestión de alquileres.' },
      { title: 'Red Local Verificada', text: 'Más de 120 profesionales verificados en la zona metropolitana de Oporto.' },
      { title: 'Gestión Completa del Proyecto', text: 'Desde la primera visita técnica hasta la limpieza final, coordinamos toda la obra.' },
    ],
    faqs: [
      { question: '¿Cuánto cuesta reformar un apartamento en Oporto?', answer: 'El coste depende del alcance de las obras. Una reforma ligera (pintura, suelos) cuesta unos 150-250€/m². Una reforma integral (fontanería, electricidad, cocina, baño) sale por 400-700€/m². Proporcionamos presupuesto detallado gratis.' },
      { question: '¿Puedo gestionar las obras desde España?', answer: 'Por supuesto. La mayoría de nuestros clientes españoles gestionan sus reformas a distancia. Enviamos informes fotográficos y de vídeo por WhatsApp en cada fase y usted aprueba los materiales por email.' },
      { question: '¿Se necesita licencia para reformar un apartamento en Oporto?', answer: 'Para obras interiores sin modificación estructural no hace falta licencia. Para cambios estructurales o en zona histórica (Ribeira, Baixa) se requiere autorización de la Câmara Municipal. Nosotros gestionamos los trámites.' },
      { question: '¿Cuánto tiempo dura una reforma completa?', answer: 'Una reforma ligera (T2) dura 2-3 semanas. Una reforma integral (T2-T3) necesita 6-10 semanas según la complejidad. Establecemos un calendario detallado antes de empezar.' },
    ],
    ctaTitle: 'Solicite un Presupuesto Gratis',
    ctaText: 'Describa su proyecto y reciba un presupuesto detallado en 48h. Sin compromiso.',
    schemaType: 'HomeAndConstructionBusiness',
    schemaServiceTypes: ['Renovation', 'Construction', 'Painting', 'Tiling', 'Kitchen Renovation', 'Bathroom Renovation'],
    hreflangAlternates: {
      'fr': '/fr/travaux-appartement-porto/',
      'en': '/en/apartment-renovation-porto/',
      'nl': '/nl/appartement-renovatie-porto/',
      'es': '/es/reformas-apartamento-oporto/',
    },
    relatedSlugs: ['fontanero-oporto', 'electricista-oporto', 'mantenimiento-apartamento-oporto'],
  },

  // ─── ES: Fontanero ───
  {
    serviceKey: 'plumbing',
    locale: 'es',
    slug: 'fontanero-oporto',
    metaTitle: 'Fontanero Oporto | Servicio Rápido y Fiable | VITFIX',
    metaDescription: 'Fontanero en Oporto para propietarios españoles. Averías, fugas, instalaciones sanitarias. Servicio en inglés, presupuesto gratis, intervención rápida.',
    canonicalPath: '/es/fontanero-oporto/',
    heroTitle: 'Fontanero Profesional en Oporto',
    heroSubtitle: '¿Fuga de agua, atasco o avería del calentador? Nuestros fontaneros verificados intervienen rápidamente en todo Oporto. Comunicación en inglés garantizada.',
    introText: `Encontrar un fontanero de confianza en Oporto como propietario español puede ser complicado. La barrera del idioma, el desconocimiento de la normativa local y la dificultad para comparar precios son problemas reales. VITFIX los resuelve todos.

Nuestra red de fontaneros certificados cubre toda la zona metropolitana de Oporto: desde el centro histórico hasta Vila Nova de Gaia, pasando por Matosinhos, Maia y Gondomar. Cada intervención se coordina a través de nuestro equipo, que se comunica en inglés, desde el primer diagnóstico hasta la facturación.

Tanto si su apartamento Airbnb tiene una fuga urgente entre huéspedes, como si su edificio de inversión necesita una renovación de las tuberías, o quiere modernizar el baño de su segunda residencia, nuestros fontaneros actúan con profesionalidad y transparencia.

Las intervenciones más habituales para nuestros clientes españoles incluyen: reparación de fugas, desatascos, sustitución de calentadores, renovación de baños, reparación de grifos e instalaciones sanitarias para reformas.`,
    features: [
      { icon: '💧', title: 'Reparación de Fugas', description: 'Detección y reparación rápida de fugas de agua, incluso ocultas tras paredes.' },
      { icon: '🚿', title: 'Baño Completo', description: 'Fontanería completa para reforma de baño: ducha, bañera, WC, grifería.' },
      { icon: '🔥', title: 'Calentador y Caldera', description: 'Instalación, reparación y mantenimiento de calentadores de gas y eléctricos.' },
      { icon: '🚰', title: 'Desatasco Urgente', description: 'Desatasco de tuberías, fregaderos, WC y bajantes. Intervención rápida.' },
      { icon: '🏠', title: 'Puesta a Norma', description: 'Adecuación de las instalaciones de fontanería en edificios antiguos de Oporto.' },
      { icon: '📄', title: 'Factura Legal', description: 'Facturación con IVA, válida para sus declaraciones fiscales en Portugal.' },
    ],
    whyChooseUs: [
      { title: 'Intervención Rápida', text: 'Nuestros fontaneros acuden en 2-4 horas para urgencias y en 24-48 horas para trabajos programados.' },
      { title: 'Precios Claros', text: 'Presupuesto gratis antes de la intervención. Sin sorpresas ni costes ocultos.' },
      { title: 'Gestión a Distancia', text: 'Ideal para propietarios en España: gestionamos el acceso, la intervención y el informe.' },
    ],
    faqs: [
      { question: '¿Cuánto cobra un fontanero en Oporto?', answer: 'Los precios varían según la intervención: una reparación sencilla (grifo, fuga) cuesta 30-60€. Un desatasco entre 50-120€. Una reforma completa de baño (fontanería) entre 1.500-4.000€ según acabados.' },
      { question: '¿Pueden venir en fin de semana por una urgencia?', answer: 'Sí, nuestros fontaneros de urgencia están disponibles los 7 días de la semana, incluidos fines de semana y festivos. Se aplica un recargo del 30-50% para intervenciones fuera de horario laboral.' },
      { question: 'Estoy en España y mi inquilino avisa de una fuga. ¿Qué hago?', answer: 'Envíenos un WhatsApp con las fotos del problema. Coordinamos la intervención directamente con su inquilino o gestor, y le mantenemos informado en cada paso.' },
      { question: '¿Los fontaneros hablan español?', answer: 'Nuestro equipo de coordinación se comunica en inglés y puede asistir en español básico. Los fontaneros hablan portugués, pero toda la comunicación con usted (presupuestos, seguimiento, facturas) se realiza en inglés.' },
    ],
    ctaTitle: 'Presupuesto de Fontanería Gratis',
    ctaText: 'Describa su problema de fontanería y reciba un presupuesto en 24h.',
    schemaType: 'LocalBusiness',
    schemaServiceTypes: ['Plumbing', 'Pipe Repair', 'Drain Cleaning', 'Water Heater Repair'],
    hreflangAlternates: {
      'fr': '/fr/plombier-porto/',
      'en': '/en/plumber-porto/',
      'nl': '/nl/loodgieter-porto/',
      'es': '/es/fontanero-oporto/',
    },
    relatedSlugs: ['reformas-apartamento-oporto', 'electricista-oporto', 'mantenimiento-apartamento-oporto'],
  },

  // ─── ES: Electricista ───
  {
    serviceKey: 'electrical',
    locale: 'es',
    slug: 'electricista-oporto',
    metaTitle: 'Electricista Oporto | Certificado y Profesional | VITFIX',
    metaDescription: 'Electricista certificado en Oporto para inversores españoles. Instalación, reparación, certificado eléctrico, aire acondicionado. Presupuesto gratis.',
    canonicalPath: '/es/electricista-oporto/',
    heroTitle: 'Electricista Certificado en Oporto',
    heroSubtitle: 'Instalaciones, reparaciones y certificaciones eléctricas por profesionales con certificación DGEG. Comunicación en inglés para propietarios españoles.',
    introText: `La instalación eléctrica es un aspecto clave de cualquier inversión inmobiliaria en Oporto. Los edificios antiguos del centro histórico suelen necesitar una renovación completa del cuadro eléctrico, mientras que los apartamentos destinados a alquiler vacacional deben cumplir las normas de seguridad portuguesas.

VITFIX conecta a los propietarios españoles con electricistas certificados por la DGEG (Direção-Geral de Energia e Geologia) en toda la zona metropolitana de Oporto. Cada electricista de nuestra red posee las certificaciones requeridas por la legislación portuguesa y un seguro de responsabilidad civil profesional.

Nuestras intervenciones cubren todo el espectro eléctrico: instalación de enchufes e interruptores, renovación del cuadro eléctrico, cableado para aire acondicionado, instalación de iluminación, certificación energética para venta o alquiler, e intervenciones de urgencia por cortes de luz.

Para los inversores españoles que reforman una vivienda en Oporto, ofrecemos un servicio completo: auditoría eléctrica inicial, presupuesto detallado, ejecución de los trabajos y emisión del certificado de instalación eléctrica (obligatorio para el alquiler).`,
    features: [
      { icon: '⚡', title: 'Cuadro Eléctrico', description: 'Renovación del cuadro eléctrico y cableado conforme a la normativa portuguesa.' },
      { icon: '💡', title: 'Instalación Completa', description: 'Enchufes, interruptores, iluminación, cableado de red y tomas especiales.' },
      { icon: '❄️', title: 'Aire Acondicionado', description: 'Instalación y conexión eléctrica de sistemas de climatización.' },
      { icon: '📜', title: 'Certificado Eléctrico', description: 'Emisión del certificado de instalación eléctrica para venta o alquiler.' },
      { icon: '☀️', title: 'Paneles Solares', description: 'Instalación de sistemas fotovoltaicos para reducir sus costes energéticos.' },
      { icon: '🔌', title: 'Urgencias', description: 'Intervención rápida en cortes de luz, cortocircuitos y averías.' },
    ],
    whyChooseUs: [
      { title: 'Certificación DGEG', text: 'Todos nuestros electricistas poseen la certificación DGEG obligatoria en Portugal.' },
      { title: 'Conformidad Garantizada', text: 'Trabajos conformes a la normativa portuguesa con certificado de respaldo.' },
      { title: 'Documentación en Inglés', text: 'Presupuestos, informes y facturas en inglés para su administración.' },
    ],
    faqs: [
      { question: 'Mi apartamento en Oporto tiene un cuadro eléctrico antiguo. ¿Hay que cambiarlo?', answer: 'Si su cuadro eléctrico es anterior al año 2000, se recomienda encarecidamente renovarlo y es obligatorio para alquilar. El coste de un cambio completo varía entre 300 y 800€ según la complejidad.' },
      { question: '¿Es obligatorio el certificado eléctrico para alquilar en Portugal?', answer: 'Sí, el Certificado de Instalação Elétrica es obligatorio tanto para el alquiler como para la venta de inmuebles en Portugal. Nuestros electricistas certificados pueden realizar la inspección y emitir este certificado.' },
      { question: '¿Cuánto cuesta instalar aire acondicionado en Oporto?', answer: 'La instalación completa de un split (equipo + montaje + conexión eléctrica) cuesta entre 700 y 1.400€ por unidad, según la potencia y la dificultad de instalación.' },
      { question: '¿Pueden instalar paneles solares en mi edificio?', answer: 'Sí, nuestros electricistas están cualificados para instalar sistemas fotovoltaicos. El coste medio de un sistema residencial es de 3.000-6.000€, con un periodo de amortización de 5-7 años gracias a la insolación de Oporto.' },
    ],
    ctaTitle: 'Presupuesto Eléctrico Gratis',
    ctaText: 'Describa sus necesidades eléctricas y reciba un presupuesto en 24h.',
    schemaType: 'LocalBusiness',
    schemaServiceTypes: ['Electrician', 'Electrical Installation', 'Electrical Certification', 'AC Installation'],
    hreflangAlternates: {
      'fr': '/fr/electricien-porto/',
      'en': '/en/electrician-porto/',
      'nl': '/nl/elektricien-porto/',
      'es': '/es/electricista-oporto/',
    },
    relatedSlugs: ['reformas-apartamento-oporto', 'fontanero-oporto', 'mantenimiento-apartamento-oporto'],
  },

  // ─── ES: Mantenimiento ───
  {
    serviceKey: 'maintenance',
    locale: 'es',
    slug: 'mantenimiento-apartamento-oporto',
    metaTitle: 'Mantenimiento Apartamento Oporto | Gestión a Distancia | VITFIX',
    metaDescription: 'Mantenimiento de su apartamento en Oporto desde España. Gestión de propiedad, reparaciones, inspecciones regulares. Servicio en inglés para inversores.',
    canonicalPath: '/es/mantenimiento-apartamento-oporto/',
    heroTitle: 'Mantenimiento y Gestión de Propiedad en Oporto',
    heroSubtitle: '¿Está en España y su apartamento está en Oporto? Nos encargamos del mantenimiento regular, las reparaciones y la gestión técnica de su inmueble.',
    introText: `Ser propietario de un apartamento en Oporto desde España requiere un socio de confianza in situ. Ya sea que su vivienda esté en alquiler de larga duración, en Airbnb o sea simplemente su segunda residencia, el mantenimiento regular es esencial para conservar su valor y evitar sorpresas desagradables.

VITFIX ofrece un servicio de mantenimiento técnico y gestión integral para propietarios españoles en Oporto. Nuestra fórmula cubre inspecciones periódicas, pequeñas reparaciones habituales, coordinación con sus inquilinos y gestión de emergencias. Todo se reporta en inglés por WhatsApp y email.

Para propietarios de Airbnb, ofrecemos intervenciones rápidas entre estancias: revisión de fontanería y electricidad, pequeñas reparaciones, sustitución de bombillas y accesorios, limpieza técnica de filtros de aire acondicionado. Para alquileres de larga duración, realizamos inspecciones estacionales (pre-invierno y pre-verano) que previenen daños costosos.

Nuestro servicio de custodia de llaves le evita desplazamientos para un técnico o una inspección. Guardamos un juego de llaves en lugar seguro y coordinamos todos los accesos necesarios, con su autorización previa para cada intervención.`,
    features: [
      { icon: '🏠', title: 'Inspecciones Regulares', description: 'Visitas mensuales o trimestrales con informe fotográfico detallado.' },
      { icon: '🔑', title: 'Custodia de Llaves', description: 'Custodia segura de llaves y coordinación de acceso para profesionales.' },
      { icon: '📱', title: 'Seguimiento WhatsApp', description: 'Informes con fotos y vídeos, comunicación instantánea en inglés.' },
      { icon: '🛠️', title: 'Reparaciones Corrientes', description: 'Pequeños trabajos, sustitución de equipos, reparaciones rápidas.' },
      { icon: '⚠️', title: 'Urgencias 7/7', description: 'Intervención prioritaria en caso de fuga, avería o emergencia del inquilino.' },
      { icon: '📊', title: 'Informes de Estado', description: 'Informe anual del estado de su vivienda con recomendaciones de mantenimiento.' },
    ],
    whyChooseUs: [
      { title: 'Socio de Confianza', text: 'Decenas de propietarios españoles confían en nosotros para gestionar sus inmuebles en Oporto.' },
      { title: 'Rapidez Garantizada', text: 'Respuesta en 2 horas para urgencias, intervención en 24 horas para reparaciones programadas.' },
      { title: 'Todo en Inglés', text: 'Comunicación, informes, presupuestos y facturas completamente en inglés.' },
    ],
    faqs: [
      { question: '¿Cuánto cuestan los servicios de mantenimiento regular?', answer: 'Nuestras fórmulas de mantenimiento empiezan desde 50€/mes para una inspección mensual con informe. Las fórmulas completas (inspecciones + pequeñas reparaciones incluidas + custodia de llaves) están disponibles desde 120€/mes.' },
      { question: 'Mi inquilino llama por un problema. ¿Pueden gestionarlo por mí?', answer: 'Exactamente ese es nuestro papel. Su inquilino puede contactarnos directamente. Diagnosticamos el problema, enviamos un profesional si es necesario, y le mantenemos informado en cada paso. Usted aprueba los presupuestos desde España.' },
      { question: '¿Tienen servicio para propietarios de Airbnb?', answer: 'Sí, tenemos una fórmula específica para Airbnb: revisión técnica entre reservas, reparaciones rápidas, sustitución de equipos dañados, y mantenimiento preventivo de aire acondicionado y fontanería.' },
      { question: 'Acabo de comprar un apartamento en Oporto. ¿Por dónde empiezo?', answer: 'Recomendamos una auditoría técnica completa (fontanería, electricidad, carpintería, cubierta). Esta auditoría inicial (150-250€) identifica los trabajos prioritarios y permite establecer un plan de mantenimiento adaptado.' },
    ],
    ctaTitle: 'Solicite un Presupuesto de Mantenimiento',
    ctaText: 'Describa su vivienda y necesidades. Presupuesto personalizado en 48h.',
    schemaType: 'LocalBusiness',
    schemaServiceTypes: ['Property Maintenance', 'Property Management', 'Home Inspection', 'Handyman'],
    hreflangAlternates: {
      'fr': '/fr/entretien-appartement-porto/',
      'en': '/en/property-maintenance-porto/',
      'nl': '/nl/appartement-onderhoud-porto/',
      'es': '/es/mantenimiento-apartamento-oporto/',
    },
    relatedSlugs: ['reformas-apartamento-oporto', 'fontanero-oporto', 'electricista-oporto'],
  },
]

// ─── Helper functions ───

export function getInvestorPage(locale: 'fr' | 'nl' | 'es', slug: string): InvestorPage | undefined {
  const pages = locale === 'fr' ? FR_INVESTOR_PAGES : locale === 'nl' ? NL_INVESTOR_PAGES : ES_INVESTOR_PAGES
  return pages.find(p => p.slug === slug)
}

export function getInvestorPagesByLocale(locale: 'fr' | 'nl' | 'es'): InvestorPage[] {
  return locale === 'fr' ? FR_INVESTOR_PAGES : locale === 'nl' ? NL_INVESTOR_PAGES : ES_INVESTOR_PAGES
}

export function getAllInvestorSlugs(locale: 'fr' | 'nl' | 'es'): string[] {
  return getInvestorPagesByLocale(locale).map(p => p.slug)
}

// Coverage areas shared across all investor pages
export const PORTO_COVERAGE_AREAS = [
  'Porto', 'Vila Nova de Gaia', 'Matosinhos', 'Maia', 'Gondomar', 'Valongo', 'Marco de Canaveses', 'Penafiel',
]
