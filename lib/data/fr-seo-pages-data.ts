// ──────────────────────────────────────────────────────────────────────────────
// lib/fr-seo-pages-data.ts
// Données SEO programmatiques — marché FR Marseille + littoral PACA
// 20 services × 19 villes = 380 pages services × villes
// 20 génériques + 380 service×ville = 400 pages "près de chez moi"
// 19 pages ville
// ──────────────────────────────────────────────────────────────────────────────

export interface FrCityData {
  name: string
  slug: string
  population: number
  lat: number
  lng: number
  quartiers: string[]
  nearbyCities: string[]
  department: string
  region: string
}

export interface FrServiceFAQ {
  question: string
  answer: string
}

export interface FrUrgencyData {
  urgencyMetaTitle: string
  urgencyMetaDesc: string
  immediateSteps: string[]
  whenToCall: string[]
  avgResponseTime: string
  schedule: string
}

export interface FrServiceData {
  name: string
  slug: string
  icon: string
  metaTitle: string
  metaDesc: string
  heroTitle: string
  heroSubtitle: string
  features: string[]
  problemsWeSolve: string[]
  urgencyText: string
  urgencyData: FrUrgencyData
  faqs: FrServiceFAQ[]
}

// ── VILLES ────────────────────────────────────────────────────────────────────

export const FR_CITIES: FrCityData[] = [
  {
    name: 'Marseille',
    slug: 'marseille',
    population: 870_321,
    lat: 43.2965,
    lng: 5.3698,
    quartiers: ['Le Panier', 'Joliette', 'Belsunce', 'Noailles', 'Castellane', 'Prado', 'La Pointe-Rouge', 'Les Goudes', 'La Valentine', 'La Rose', 'Saint-Barnabé', 'La Blancarde', 'Périer', 'Bonneveine', 'Saint-Loup'],
    nearbyCities: ['Aubagne', 'Allauch', 'La Ciotat', 'Cassis', 'Martigues'],
    department: 'Bouches-du-Rhône (13)',
    region: 'Provence-Alpes-Côte d\'Azur',
  },
  {
    name: 'Aix-en-Provence',
    slug: 'aix-en-provence',
    population: 143_097,
    lat: 43.5297,
    lng: 5.4474,
    quartiers: ['Centre-ville', 'Mazarin', 'Jas-de-Bouffan', 'Pont de l\'Arc', 'Luynes', 'La Pioline', 'Les Milles', 'Puyricard'],
    nearbyCities: ['Marseille', 'Salon-de-Provence', 'Aubagne', 'Allauch'],
    department: 'Bouches-du-Rhône (13)',
    region: 'Provence-Alpes-Côte d\'Azur',
  },
  {
    name: 'Aubagne',
    slug: 'aubagne',
    population: 46_036,
    lat: 43.2932,
    lng: 5.5688,
    quartiers: ['Centre-ville', 'La Tourtelle', 'Les Passons', 'La Destrousse', 'Carnoux', 'Les Quatre Saisons'],
    nearbyCities: ['Marseille', 'La Ciotat', 'Cassis', 'Aix-en-Provence'],
    department: 'Bouches-du-Rhône (13)',
    region: 'Provence-Alpes-Côte d\'Azur',
  },
  {
    name: 'La Ciotat',
    slug: 'la-ciotat',
    population: 36_048,
    lat: 43.1764,
    lng: 5.6078,
    quartiers: ['Centre-ville', 'La Madrague', 'Ceyreste', 'Les Lecques', 'Les Calanques', 'Le Liouquet'],
    nearbyCities: ['Aubagne', 'Cassis', 'Marseille', 'Saint-Cyr-sur-Mer'],
    department: 'Bouches-du-Rhône (13)',
    region: 'Provence-Alpes-Côte d\'Azur',
  },
  {
    name: 'Cassis',
    slug: 'cassis',
    population: 7_276,
    lat: 43.2139,
    lng: 5.5379,
    quartiers: ['Centre', 'Les Calanques', 'Port-Miou', 'En-Vau', 'Le Bestouan'],
    nearbyCities: ['Aubagne', 'La Ciotat', 'Marseille'],
    department: 'Bouches-du-Rhône (13)',
    region: 'Provence-Alpes-Côte d\'Azur',
  },
  {
    name: 'Martigues',
    slug: 'martigues',
    population: 49_077,
    lat: 43.4064,
    lng: 5.0530,
    quartiers: ['Ferrières', 'Jonquières', 'L\'Île', 'Lavéra', 'Saint-Julien', 'Canto-Perdrix'],
    nearbyCities: ['Marseille', 'Salon-de-Provence', 'Aix-en-Provence', 'Istres'],
    department: 'Bouches-du-Rhône (13)',
    region: 'Provence-Alpes-Côte d\'Azur',
  },
  {
    name: 'Allauch',
    slug: 'allauch',
    population: 20_000,
    lat: 43.3374,
    lng: 5.4819,
    quartiers: ['Centre', 'Le Logis Neuf', 'La Millière', 'La Cayolle', 'Saint-Loup', 'Pichauris'],
    nearbyCities: ['Marseille', 'Aubagne', 'Aix-en-Provence'],
    department: 'Bouches-du-Rhône (13)',
    region: 'Provence-Alpes-Côte d\'Azur',
  },
  {
    name: 'Salon-de-Provence',
    slug: 'salon-de-provence',
    population: 43_024,
    lat: 43.6400,
    lng: 5.0963,
    quartiers: ['Centre-ville', 'Les Alpilles', 'Bois de l\'Aune', 'La Crémade', 'Montauban', 'Le Toulon'],
    nearbyCities: ['Aix-en-Provence', 'Marseille', 'Martigues', 'Istres'],
    department: 'Bouches-du-Rhône (13)',
    region: 'Provence-Alpes-Côte d\'Azur',
  },
  {
    name: 'Saint-Cyr-sur-Mer',
    slug: 'saint-cyr-sur-mer',
    population: 12_000,
    lat: 43.1789,
    lng: 5.7106,
    quartiers: ['Les Lecques', 'La Madrague', 'Portissol', 'La Baume', 'Port d\'Alon', 'Le Baumaderie'],
    nearbyCities: ['La Ciotat', 'Bandol', 'Cassis', 'Aubagne'],
    department: 'Var (83)',
    region: 'Provence-Alpes-Côte d\'Azur',
  },
  {
    name: 'Bandol',
    slug: 'bandol',
    population: 9_000,
    lat: 43.1364,
    lng: 5.7524,
    quartiers: ['Port de Bandol', 'Renécros', 'La Gorguette', 'Île de Bendor', 'Beaucours', 'Les Salettes'],
    nearbyCities: ['Saint-Cyr-sur-Mer', 'La Ciotat', 'Sanary-sur-Mer', 'Six-Fours-les-Plages'],
    department: 'Var (83)',
    region: 'Provence-Alpes-Côte d\'Azur',
  },
  {
    name: 'Gémenos',
    slug: 'gemenos',
    population: 7_000,
    lat: 43.2940,
    lng: 5.6266,
    quartiers: ['Centre-ville', 'Les Montagnes', 'La Foux', 'Parc d\'Activités', 'Font de Mai'],
    nearbyCities: ['Aubagne', 'La Ciotat', 'Cassis', 'Marseille'],
    department: 'Bouches-du-Rhône (13)',
    region: 'Provence-Alpes-Côte d\'Azur',
  },
  {
    name: 'Sanary-sur-Mer',
    slug: 'sanary-sur-mer',
    population: 18_000,
    lat: 43.1192,
    lng: 5.8014,
    quartiers: ['Port de Sanary', 'Portissol', 'La Gare', 'Beaucours', 'Les Playes', 'Saint-Nazaire'],
    nearbyCities: ['Bandol', 'Six-Fours-les-Plages', 'Saint-Cyr-sur-Mer', 'La Ciotat'],
    department: 'Var (83)',
    region: 'Provence-Alpes-Côte d\'Azur',
  },
  {
    name: 'Six-Fours-les-Plages',
    slug: 'six-fours-les-plages',
    population: 35_000,
    lat: 43.1017,
    lng: 5.8363,
    quartiers: ['Le Brusc', 'Les Playes', 'Les Laurons', 'Reynier', 'La Tour Fondue', 'Bonnegrace'],
    nearbyCities: ['Sanary-sur-Mer', 'Bandol', 'La Ciotat', 'Saint-Cyr-sur-Mer'],
    department: 'Var (83)',
    region: 'Provence-Alpes-Côte d\'Azur',
  },
  {
    name: 'Ceyreste',
    slug: 'ceyreste',
    population: 3_600,
    lat: 43.2100,
    lng: 5.6400,
    quartiers: ['Centre-village', 'Les Baumelles', 'Le Défends', 'La Pauline', 'Les Barles'],
    nearbyCities: ['La Ciotat', 'Cassis', 'Aubagne', 'Gémenos'],
    department: 'Bouches-du-Rhône (13)',
    region: 'Provence-Alpes-Côte d\'Azur',
  },
  {
    name: 'La Seyne-sur-Mer',
    slug: 'la-seyne-sur-mer',
    population: 64_000,
    lat: 43.1030,
    lng: 5.8830,
    quartiers: ['Tamaris', 'Berthe', 'Les Playes', 'Saint-Georges', 'Fabregas', 'La Seyne-centre', 'Bregaillon', 'Les Mouissèques'],
    nearbyCities: ['Six-Fours-les-Plages', 'Sanary-sur-Mer', 'Bandol', 'Saint-Cyr-sur-Mer'],
    department: 'Var (83)',
    region: 'Provence-Alpes-Côte d\'Azur',
  },
  {
    name: 'Hyères',
    slug: 'hyeres',
    population: 57_000,
    lat: 43.1201,
    lng: 6.1283,
    quartiers: ['Centre historique', 'La Bayorre', 'La Capte', 'Presqu\'île de Giens', 'Costebelle', 'L\'Almanarre', 'Le Pradet', 'La Sauvette'],
    nearbyCities: ['La Seyne-sur-Mer', 'Six-Fours-les-Plages', 'Bandol', 'Sanary-sur-Mer'],
    department: 'Var (83)',
    region: 'Provence-Alpes-Côte d\'Azur',
  },
  {
    name: 'La Valette-du-Var',
    slug: 'la-valette-du-var',
    population: 23_500,
    lat: 43.1361,
    lng: 5.9833,
    quartiers: ['Centre-ville', 'La Coupiane', 'Saint-Roch', 'Les Ours', 'Pont-Major', 'La Pomme'],
    nearbyCities: ['La Seyne-sur-Mer', 'Hyères', 'Six-Fours-les-Plages', 'Sanary-sur-Mer'],
    department: 'Var (83)',
    region: 'Provence-Alpes-Côte d\'Azur',
  },
  {
    name: 'Plan-de-Cuques',
    slug: 'plan-de-cuques',
    population: 11_000,
    lat: 43.3356,
    lng: 5.4961,
    quartiers: ['Centre', 'La Pounche', 'Font Obscure', 'Les Quatre Saisons', 'Saint-Jean'],
    nearbyCities: ['Marseille', 'Allauch', 'Gémenos', 'Aubagne'],
    department: 'Bouches-du-Rhône (13)',
    region: 'Provence-Alpes-Côte d\'Azur',
  },
  {
    name: 'Gardanne',
    slug: 'gardanne',
    population: 20_000,
    lat: 43.4558,
    lng: 5.4695,
    quartiers: ['Vieux Gardanne', 'Biver', 'Biver-les-Pins', 'La Barque', 'Fontvenelle'],
    nearbyCities: ['Aix-en-Provence', 'Marseille', 'Aubagne', 'Allauch'],
    department: 'Bouches-du-Rhône (13)',
    region: 'Provence-Alpes-Côte d\'Azur',
  },
]

// ── SERVICES ──────────────────────────────────────────────────────────────────

export const FR_SERVICES: FrServiceData[] = [
  // ── PLOMBIER ─────────────────────────────────────────────────────────────────
  {
    name: 'Plombier',
    slug: 'plombier',
    icon: '🔧',
    metaTitle: 'Plombier {city} — Devis gratuit, intervention rapide 7j/7',
    metaDesc: 'Plombier de confiance à {city} : artisans certifiés et vérifiés pour fuites, débouchage, chauffe-eau. Devis gratuit, intervention rapide 7j/7.',
    heroTitle: 'Plombier à {city} : Intervention rapide, devis gratuit',
    heroSubtitle: 'Plombiers qualifiés pour tous vos travaux à {city} : fuite d\'eau, débouchage, chauffe-eau, sanitaires. Disponibles 7j/7, réponse sous 30 min.',
    features: [
      'Réparation de fuites d\'eau (visible et cachée)',
      'Débouchage canalisation et toilettes',
      'Installation et remplacement chauffe-eau',
      'Pose de robinetterie et sanitaires',
      'Détection de fuite non destructive',
      'Urgence plomberie disponible 24h/24',
      'Installation cuisine et salle de bain',
      'Entretien chaudière et circuit de chauffage',
    ],
    problemsWeSolve: [
      'Fuite d\'eau sous l\'évier ou derrière un mur',
      'Canalisation bouchée ou siphon obstrué',
      'Chauffe-eau en panne ou qui fuit',
      'Robinet qui goutte en permanence',
      'WC bouché ou chasse d\'eau défaillante',
      'Pression d\'eau insuffisante ou irrégulière',
      'Odeurs d\'égout persistantes',
      'Dégât des eaux à colmater rapidement',
    ],
    urgencyText: 'Une fuite d\'eau peut provoquer des dégâts des eaux en quelques heures. Appelez-nous immédiatement pour une intervention rapide à {city}.',
    urgencyData: {
      urgencyMetaTitle: 'Plombier Urgence {city} — Intervention 24h/7j',
      urgencyMetaDesc: 'Plombier en urgence à {city} : fuite, inondation, dégât des eaux. Disponible 24h/24, 7j/7. Appel et WhatsApp.',
      immediateSteps: [
        'Coupez l\'eau au robinet de barrage principal',
        'Éteignez le chauffe-eau ou la chaudière',
        'Protégez vos biens en dessous (serviettes, bacs)',
        'Prenez des photos des dégâts pour l\'assurance',
        'Appelez ou WhatsApp VITFIX immédiatement',
        'Prévenez votre assurance habitation',
      ],
      whenToCall: [
        'Fuite d\'eau visible, impossible à arrêter',
        'Canalisation principale bouchée (plusieurs WC/douches)',
        'Chauffe-eau qui fuit ou ne chauffe plus',
        'Odeur de gaz (appelez aussi le 0800 47 33 33)',
        'Dégât des eaux en cours (plafond qui fuit)',
        'Coupure d\'eau totale dans le logement',
      ],
      avgResponseTime: '30 à 60 min',
      schedule: '7j/7, 24h/24',
    },
    faqs: [
      {
        question: 'Quel est le tarif d\'un plombier à {city} et en région PACA ?',
        answer: 'Le tarif horaire d\'un plombier à {city} varie généralement entre 60 € et 120 € HT selon la nature de l\'intervention. Une intervention en urgence (soirée, week-end, nuit) peut entraîner un supplément de 50 à 100 %. Comptez en moyenne 150 à 300 € pour une fuite simple, 400 à 800 € pour un remplacement de chauffe-eau. Demandez un devis gratuit pour connaître le tarif exact.',
      },
      {
        question: 'Combien de temps faut-il attendre un plombier en urgence à {city} ?',
        answer: 'Nos plombiers interviennent en urgence à {city} et dans les communes alentours sous 30 à 60 minutes selon votre localisation. En zone littorale (La Ciotat, Cassis, Bandol, Saint-Cyr), nos équipes sont positionnées pour intervenir rapidement. Contactez-nous par WhatsApp pour avoir une estimation du délai en temps réel.',
      },
      {
        question: 'Mes dégâts des eaux sont-ils pris en charge par mon assurance ?',
        answer: 'La plupart des contrats d\'assurance habitation couvrent les dégâts des eaux. Il est important de déclarer le sinistre à votre assureur dans les 5 jours ouvrés et de conserver toutes les preuves (photos, factures de réparation). Nos techniciens peuvent établir un rapport d\'intervention détaillé pour faciliter votre démarche auprès de l\'assurance.',
      },
      {
        question: 'Proposez-vous des interventions dans toutes les communes autour de {city} ?',
        answer: 'Oui, nous intervenons à {city} et dans toutes les communes alentours : Aubagne, La Ciotat, Cassis, Aix-en-Provence, Martigues, Allauch, Salon-de-Provence, Bandol, Saint-Cyr-sur-Mer et dans l\'ensemble des Bouches-du-Rhône et du Var. Contactez-nous pour vérifier les délais d\'intervention dans votre commune.',
      },
      {
        question: 'Comment trouver un plombier de confiance à {city} ?',
        answer: 'Pour trouver un plombier fiable à {city}, vérifiez que l\'artisan est couvert par une assurance décennale et responsabilité civile professionnelle, et qu\'il remet un devis écrit avant toute intervention. Sur VITFIX, tous nos plombiers sont vérifiés, assurés et notés par les clients après chaque passage. Nous affichons les certifications, les avis vérifiés et des tarifs transparents — pour que vous choisissiez en toute confiance sans mauvaise surprise.',
      },
    ],
  },

  // ── ÉLECTRICIEN ──────────────────────────────────────────────────────────────
  {
    name: 'Électricien',
    slug: 'electricien',
    icon: '⚡',
    metaTitle: 'Électricien {city} — Devis gratuit, certifié Qualifelec',
    metaDesc: 'Électricien certifié et de confiance à {city} : tableau électrique, mise aux normes, dépannage urgent 24h/7j. Qualifelec, devis gratuit.',
    heroTitle: 'Électricien à {city} : Certifié, disponible 7j/7',
    heroSubtitle: 'Électriciens certifiés Qualifelec pour tous vos travaux électriques à {city}. Mise aux normes, tableau électrique, dépannage urgent. Devis gratuit.',
    features: [
      'Remplacement et mise aux normes tableau électrique',
      'Installation prises et interrupteurs',
      'Pose d\'éclairage (LED, spots, lustres)',
      'Dépannage électrique et court-circuit',
      'Installation borne de recharge voiture électrique',
      'Câblage cuisine équipée',
      'Mise aux normes NF C 15-100',
      'Vérification et diagnostic électrique complet',
    ],
    problemsWeSolve: [
      'Disjoncteur qui saute régulièrement',
      'Prise ou interrupteur défaillant',
      'Panne de courant partielle ou totale',
      'Tableau électrique vétuste ou non conforme',
      'Câblage endommagé ou vieillissant',
      'Installation sans terre (mise aux normes)',
      'Court-circuit récurrent',
      'Éclairage qui clignote ou ne fonctionne plus',
    ],
    urgencyText: 'Une panne électrique ou un court-circuit peut être dangereux. N\'attendez pas — contactez un électricien certifié à {city} immédiatement.',
    urgencyData: {
      urgencyMetaTitle: 'Électricien Urgence {city} — Dépannage 24h/7j',
      urgencyMetaDesc: 'Électricien en urgence à {city} : panne de courant, court-circuit, disjoncteur. Disponible 24h/24. Certifié Qualifelec.',
      immediateSteps: [
        'Coupez le disjoncteur général si possible',
        'N\'essayez pas de réparer vous-même',
        'Débranchez les appareils sensibles (ordinateurs, TV)',
        'Assurez-vous qu\'il n\'y a pas de flamme ou de fumée',
        'Appelez le 18 (pompiers) en cas d\'incendie électrique',
        'Contactez VITFIX pour intervention rapide',
      ],
      whenToCall: [
        'Panne de courant totale dans le logement',
        'Court-circuit avec odeur de brûlé',
        'Disjoncteur qui saute en continu',
        'Étincelles visibles sur une prise ou câble',
        'Tableau électrique chaud ou qui bourdonne',
        'Electrisation ou risque de contact avec un câble',
      ],
      avgResponseTime: '30 à 60 min',
      schedule: '7j/7, 24h/24',
    },
    faqs: [
      {
        question: 'Quel est le tarif d\'un électricien à {city} ?',
        answer: 'Le tarif d\'un électricien à {city} varie entre 50 € et 100 € HT de l\'heure. Pour un dépannage simple (remplacement d\'une prise, d\'un interrupteur), comptez 80 à 150 €. Pour un remplacement de tableau électrique, le tarif se situe généralement entre 800 et 2 000 € selon la taille et la complexité. Un devis gratuit vous permettra d\'avoir une estimation précise.',
      },
      {
        question: 'Faut-il un électricien certifié pour les travaux à {city} ?',
        answer: 'Pour les travaux importants (tableau électrique, mise aux normes, création de circuits), il est fortement recommandé de faire appel à un électricien certifié Qualifelec ou RGE. Cette certification est souvent exigée par les assurances et pour l\'obtention de certaines aides (MaPrimeRénov\'). Nos électriciens à {city} sont tous certifiés et vous remettent une attestation de conformité après intervention.',
      },
      {
        question: 'Ma maison doit-elle être mise aux normes électriques ?',
        answer: 'La mise aux normes NF C 15-100 est obligatoire lors d\'une vente immobilière (diagnostic électrique exigé si installation > 15 ans) et fortement recommandée pour votre sécurité. Les installations vétustes (sans différentiel, sans mise à la terre, câblage aluminium) présentent des risques d\'incendie. Nos électriciens réalisent un diagnostic gratuit pour évaluer l\'état de votre installation à {city}.',
      },
      {
        question: 'Installez-vous des bornes de recharge pour voitures électriques à {city} ?',
        answer: 'Oui, nos électriciens installent des bornes de recharge (Wallbox) à domicile à {city} et dans tout le département. Nous gérons l\'ensemble du dossier : étude de faisabilité, installation, mise en service et déclaration Consuel. Des aides financières (Advenir) peuvent couvrir jusqu\'à 50 % du coût de l\'installation.',
      },
      {
        question: 'Comment trouver un électricien de confiance à {city} ?',
        answer: 'Pour trouver un électricien fiable à {city}, vérifiez ces points : certification Qualifelec ou RGE (obligatoire pour les aides MaPrimeRénov\'), assurance décennale valide, devis écrit détaillé avant toute intervention, et avis clients vérifiés. Méfiez-vous des prix anormalement bas qui cachent souvent des travaux bâclés. VITFIX sélectionne ses électriciens selon ces critères stricts et vous remet une attestation de conformité après chaque intervention.',
      },
    ],
  },

  // ── PEINTRE ──────────────────────────────────────────────────────────────────
  {
    name: 'Peintre',
    slug: 'peintre',
    icon: '🎨',
    metaTitle: 'Peintre {city} — Devis gratuit, artisan qualifié',
    metaDesc: 'Peintre professionnel à {city} : peinture intérieure, ravalement façade, enduit. Artisan qualifié, devis gratuit, rendu soigné garanti.',
    heroTitle: 'Peintre à {city} : Artisan qualifié, devis gratuit',
    heroSubtitle: 'Peintres artisans pour tous vos travaux de peinture à {city} : intérieure, façade, décoration. Finitions soignées, délais respectés. Devis gratuit.',
    features: [
      'Peinture intérieure (murs, plafonds, boiseries)',
      'Ravalement de façade et peinture extérieure',
      'Application d\'enduit et rebouchage fissures',
      'Pose de papier peint et revêtements muraux',
      'Peinture décorative et effets spéciaux',
      'Traitement anti-humidité et anti-moisissures',
      'Ponçage et préparation des supports',
      'Peinture de protection métaux et boiseries',
    ],
    problemsWeSolve: [
      'Murs et plafonds à repeindre (peinture écaillée)',
      'Façade dégradée ou noircie',
      'Fissures à reboucher et traiter',
      'Humidité et moisissures sur les murs',
      'Papier peint à décoller et remplacer',
      'Boiseries (volets, portes) à rénover',
      'Changement de couleur ou rafraîchissement',
      'Préparation pour mise en vente du logement',
    ],
    urgencyText: 'Dégâts des eaux, moisissures à traiter rapidement ? Nos peintres interviennent à {city} pour des travaux urgents.',
    urgencyData: {
      urgencyMetaTitle: 'Peintre Urgence {city} — Intervention rapide dégâts',
      urgencyMetaDesc: 'Peintre en urgence à {city} : dégâts des eaux, moisissures, rénovation rapide. Intervention dans les meilleurs délais.',
      immediateSteps: [
        'Identifiez la source d\'humidité (plomberie, toiture)',
        'Faites réparer la source avant de peindre',
        'Aérez et séchez la pièce au maximum',
        'Protégez vos meubles et revêtements de sol',
        'Photographiez les dégâts pour l\'assurance',
        'Contactez VITFIX pour un devis rapide',
      ],
      whenToCall: [
        'Moisissures importantes sur les murs',
        'Peinture qui cloque suite à une fuite',
        'Plafond endommagé après dégât des eaux',
        'Façade dégradée à sécuriser rapidement',
        'Rénovation urgente avant une mise en location',
        'Traitement anti-humidité avant l\'hiver',
      ],
      avgResponseTime: '24 à 48h pour devis',
      schedule: 'Lun–Sam, 8h–19h',
    },
    faqs: [
      {
        question: 'Quel est le tarif d\'un peintre à {city} ?',
        answer: 'Le tarif d\'un peintre à Marseille varie entre 25 € et 50 € HT au m² pour la peinture intérieure, incluant la préparation des supports, une sous-couche et deux couches de finition. Le ravalement de façade coûte généralement entre 40 et 80 € HT au m². Ces tarifs dépendent de l\'état du support, de la couleur et du type de peinture choisie. Un devis gratuit vous donnera une estimation précise.',
      },
      {
        question: 'Combien de temps durent des travaux de peinture ?',
        answer: 'La durée des travaux de peinture dépend de la surface à traiter. Pour une pièce standard (20-25 m²), comptez 1 à 2 jours. Pour un appartement complet (3 pièces), prévoyez 3 à 5 jours. Le délai inclut la préparation des surfaces, le séchage entre les couches et les finitions. Nos peintres respectent les délais convenus et travaillent avec soin.',
      },
      {
        question: 'Dois-je fournir la peinture ou vous la choisissez ?',
        answer: 'Nous pouvons vous conseiller sur le choix des peintures et les fournir directement, ou utiliser vos propres produits si vous avez déjà fait votre choix. Nous travaillons avec des marques professionnelles (Tollens, Dulux Valentine, Sikkens) qui offrent un rendu optimal et une garantie de tenue dans le temps. Pour les projets décoratifs, nous proposons également un service de conseil couleur.',
      },
      {
        question: 'Intervenez-vous pour le ravalement de façade à {city} ?',
        answer: 'Oui, nos peintres réalisent le ravalement de façade pour les maisons individuelles et les immeubles à Marseille et dans tout le département 13. Nous traitons les fissures, appliquons un traitement hydrofuge et remettons en état les enduits dégradés. Nous gérons également les démarches en copropriété et pouvons vous accompagner pour les aides MaPrimeRénov\' si votre façade est concernée.',
      },
    ],
  },

  // ── PLAQUISTE ─────────────────────────────────────────────────────────────────
  {
    name: 'Plaquiste',
    slug: 'plaquiste',
    icon: '🏗️',
    metaTitle: 'Plaquiste {city} — Cloisons, faux-plafonds, isolation, devis gratuit',
    metaDesc: 'Plaquiste professionnel à {city} : pose de cloisons, faux-plafonds, isolation thermique et phonique. Artisan qualifié, devis gratuit.',
    heroTitle: 'Plaquiste à {city} : Cloisons & faux-plafonds',
    heroSubtitle: 'Plaquistes certifiés pour vos travaux de cloisonnement, faux-plafonds et isolation à {city}. Finitions impeccables, devis gratuit, travail soigné.',
    features: [
      'Pose de cloisons en plaque de plâtre (BA13, BA18)',
      'Installation de faux-plafonds (plâtre, BA13)',
      'Isolation thermique et phonique des murs',
      'Habillage de conduits et de colonnes',
      'Création de niches et de rangements intégrés',
      'Pose de doublage isolant sur murs extérieurs',
      'Enduit de lissage et préparation au peint',
      'Réfection après dégât des eaux ou sinistre',
    ],
    problemsWeSolve: [
      'Pièce à diviser ou créer avec une cloison',
      'Plafond endommagé à refaire (dégât des eaux)',
      'Isolation phonique insuffisante (bruit voisins)',
      'Isolation thermique à améliorer (combles, murs)',
      'Conduits disgracieux à habiller',
      'Rénovation de salle de bain (niche, douche italienne)',
      'Remise en état après travaux électricité/plomberie',
      'Réalisation d\'un home-cinéma ou bureau insonorisé',
    ],
    urgencyText: 'Plafond endommagé après un dégât des eaux ? Nos plaquistes interviennent rapidement à {city} pour remettre en état votre logement.',
    urgencyData: {
      urgencyMetaTitle: 'Plaquiste Urgence {city} — Réfection plafond et cloisons',
      urgencyMetaDesc: 'Plaquiste en urgence à {city} : plafond endommagé, cloison à réparer. Intervention rapide pour dégâts des eaux et sinistres.',
      immediateSteps: [
        'Sécurisez la zone si le plafond est instable',
        'Faites réparer la fuite source avant tout travail',
        'Prenez des photos pour votre assurance',
        'Protégez le sol et les meubles sous la zone sinistrée',
        'Laissez sécher 48 à 72h minimum',
        'Contactez VITFIX pour le chiffrage et l\'intervention',
      ],
      whenToCall: [
        'Plafond effondré ou sur le point de l\'être',
        'Faux-plafond endommagé par une fuite',
        'Cloison cassée ou instable',
        'Réfection après sinistre (incendie, dégât des eaux)',
        'Isolation urgente avant l\'hiver',
        'Remise en état pour une mise en location',
      ],
      avgResponseTime: '24 à 48h pour devis',
      schedule: 'Lun–Sam, 8h–18h',
    },
    faqs: [
      {
        question: 'Quel est le tarif d\'un plaquiste à {city} ?',
        answer: 'Le tarif d\'un plaquiste à Marseille varie entre 30 et 60 € HT au m² pour la pose de cloisons en plaque de plâtre, incluant l\'ossature métallique, les plaques et les bandes. Pour un faux-plafond, comptez 25 à 50 € HT au m². Les travaux d\'isolation (doublage) sont généralement entre 40 et 80 € HT au m² selon l\'isolant choisi. Ces prix incluent la main-d\'œuvre et les matériaux.',
      },
      {
        question: 'Peut-on obtenir des aides pour l\'isolation intérieure à {city} ?',
        answer: 'Oui, plusieurs aides sont disponibles pour les travaux d\'isolation : MaPrimeRénov\' (jusqu\'à 75 € par m² pour les ménages modestes), les Certificats d\'Économies d\'Énergie (CEE) via les fournisseurs d\'énergie, et l\'éco-prêt à taux zéro. Pour bénéficier de ces aides, les travaux doivent être réalisés par un artisan certifié RGE. Nos plaquistes vous accompagnent dans les démarches.',
      },
      {
        question: 'Combien de temps prend la pose d\'une cloison ?',
        answer: 'La pose d\'une cloison standard (3 m × 2,5 m) prend généralement 1 journée complète pour un plaquiste expérimenté : montage de l\'ossature, pose des plaques, bandes et enduit. Pour une pièce complète à diviser ou une rénovation avec isolation, comptez 2 à 4 jours. Les finitions (ponçage, impression) s\'ajoutent si vous souhaitez que nous préparyons aussi le support pour la peinture.',
      },
      {
        question: 'Intervenez-vous en copropriété à {city} ?',
        answer: 'Oui, nous intervenons en appartement et en copropriété dans tout Marseille et le département 13. Pour les travaux modifiant la structure (cloisons portantes, accroches en façade), des autorisations en assemblée générale peuvent être nécessaires. Nous vous conseillons sur la réglementation applicable et pouvons vous fournir les documents techniques nécessaires.',
      },
    ],
  },

  // ── NETTOYAGE & ENCOMBRANTS ──────────────────────────────────────────────────
  {
    name: 'Nettoyage & Encombrants',
    slug: 'nettoyage-encombrants',
    icon: '🗑️',
    metaTitle: 'Nettoyage Encombrants {city} — Débarras, Copropriété | Devis gratuit',
    metaDesc: 'Enlèvement d\'encombrants à {city} par une équipe sérieuse et de confiance : débarras appartement, nettoyage copropriété, déchetterie agréée. Devis gratuit, intervention sous 24h.',
    heroTitle: 'Nettoyage & Encombrants à {city} : Débarras rapide',
    heroSubtitle: 'Enlèvement d\'encombrants, débarras d\'appartement et nettoyage de parties communes à {city}. Service particuliers et copropriétés. Devis gratuit, intervention sous 24h.',
    features: [
      'Enlèvement et évacuation de tous types d\'encombrants',
      'Débarras complet d\'appartement (succession, déménagement)',
      'Nettoyage et entretien des parties communes de copropriété',
      'Gestion et évacuation des déchets de chantier',
      'Traitement des dépôts sauvages (cave, parking, parties communes)',
      'Nettoyage de cave, garage et grenier',
      'Service syndic : contrat d\'entretien parties communes',
      'Tri sélectif et éco-responsabilité — déchetterie agréée',
    ],
    problemsWeSolve: [
      'Appartement ou maison entier à vider (succession, déménagement)',
      'Dépôt sauvage dans les parties communes de l\'immeuble',
      'Cave ou garage encombrés depuis des années',
      'Déchets de travaux à évacuer rapidement',
      'Nettoyage après sinistre (incendie, dégât des eaux)',
      'Parties communes sales ou dégradées (copropriété)',
      'Vieille literie, électroménager hors d\'usage à enlever',
      'Syndic : maintenance préventive et contrat régulier',
    ],
    urgencyText: 'Dépôt sauvage, sinistre ou appartement à vider d\'urgence ? Nos équipes interviennent à {city} sous 24h.',
    urgencyData: {
      urgencyMetaTitle: 'Enlèvement Encombrants Urgence {city} — Intervention 24h',
      urgencyMetaDesc: 'Enlèvement d\'encombrants en urgence à {city} : débarras, dépôt sauvage, sinistre. Intervention rapide, devis gratuit.',
      immediateSteps: [
        'Identifiez et listez les encombrants à évacuer',
        'Signalez tout déchet dangereux (amiante, chimiques)',
        'Pour les copropriétés : prévenez le syndic',
        'Prenez des photos pour l\'état des lieux',
        'Ne touchez pas aux déchets suspects sans équipement',
        'Contactez VITFIX pour un devis et une intervention rapide',
      ],
      whenToCall: [
        'Dépôt sauvage bloquant les accès de l\'immeuble',
        'Appartement à vider dans un délai contraint',
        'Nettoyage d\'urgence après sinistre ou décès',
        'Parties communes insalubres (syndic)',
        'Déchets de chantier à évacuer avant inspection',
        'Encombrants gênant la sécurité ou l\'accès',
      ],
      avgResponseTime: '24 à 48h',
      schedule: 'Lun–Sam, 7h–19h',
    },
    faqs: [
      {
        question: 'Quel est le tarif pour l\'enlèvement d\'encombrants à {city} ?',
        answer: 'Le tarif dépend du volume à évacuer et de l\'accessibilité. Pour un débarras partiel (quelques meubles, électroménager), comptez 150 à 400 €. Pour un appartement complet à vider (T2/T3), le tarif se situe généralement entre 500 et 1 500 € selon le volume et l\'étage. Le devis est toujours gratuit et engage notre société. Nous fournissons un bordereau de dépôt en déchetterie agréée sur demande.',
      },
      {
        question: 'Intervenez-vous pour les copropriétés à {city} ?',
        answer: 'Oui, nous travaillons régulièrement avec les syndics et gestionnaires de copropriété à {city} et dans la région. Nous proposons des contrats d\'entretien des parties communes (nettoyage hebdomadaire ou mensuel), l\'évacuation ponctuelle des dépôts sauvages, et le nettoyage après sinistres. Nous vous remettons des bons d\'intervention et factures détaillées pour la comptabilité de la copropriété.',
      },
      {
        question: 'Que faites-vous des encombrants enlevés ?',
        answer: 'Nous trions systématiquement les encombrants : réutilisables (donnés à des associations), recyclables (déchetteries agréées), et déchets ultimes (centre de traitement habilité). Nous respectons la réglementation sur la gestion des déchets et pouvons vous fournir les bordereaux de suivi si nécessaire (notamment pour les copropriétés soumises à traçabilité). Nous évitons absolument les dépôts sauvages.',
      },
      {
        question: 'Pouvez-vous vider un appartement en succession à {city} ?',
        answer: 'Oui, le débarras en succession est l\'une de nos spécialités. Nous intervenons avec discrétion et respect, procédons à un inventaire si souhaité, récupérons les objets de valeur pour les héritiers, et évacuons le reste. Nous pouvons travailler directement avec le notaire ou l\'agence immobilière. Délai d\'intervention possible sous 48h à {city} et dans la région.',
      },
      {
        question: 'Comment être sûr de choisir une entreprise sérieuse pour l\'enlèvement d\'encombrants à {city} ?',
        answer: 'Pour choisir une entreprise fiable de nettoyage et débarras à {city}, demandez un devis écrit détaillant les prestations et le tarif, vérifiez que l\'entreprise est déclarée et assurée, et assurez-vous qu\'elle évacue les déchets en déchetteries agréées (un bordereau de dépôt peut vous être remis). Méfiez-vous des entreprises qui proposent des prix anormalement bas et ne fournissent pas de justificatif. Sur VITFIX, toutes nos équipes sont vérifiées, assurées et notées par les clients après chaque intervention.',
      },
    ],
  },

  // ── ESPACES VERTS & ÉLAGAGE ──────────────────────────────────────────────────
  {
    name: 'Espaces Verts & Élagage',
    slug: 'espaces-verts',
    icon: '🌿',
    metaTitle: 'Jardinier Élagage {city} — Espaces Verts Copropriété | Devis gratuit',
    metaDesc: 'Jardinier et élagueur à {city} : tonte, taille de haies, élagage d\'arbres, entretien espaces verts de copropriété. Certifié, devis gratuit.',
    heroTitle: 'Espaces Verts & Élagage à {city} : Jardinier certifié',
    heroSubtitle: 'Entretien de jardins, taille de haies, élagage d\'arbres et aménagement d\'espaces verts à {city}. Particuliers et copropriétés. Devis gratuit, travail soigné.',
    features: [
      'Tonte et entretien de pelouse (particuliers et copropriétés)',
      'Taille de haies et d\'arbustes',
      'Élagage raisonné d\'arbres (certification grimpeur)',
      'Abattage d\'arbres dangereux ou malades',
      'Débroussaillage et désherbage',
      'Entretien des espaces verts de copropriété (contrat)',
      'Évacuation et broyage des déchets verts',
      'Création et aménagement de jardins et massifs',
    ],
    problemsWeSolve: [
      'Arbres mal taillés ou branches dangereuses',
      'Pelouse envahie par les herbes folles',
      'Haie qui déborde et obstrue la visibilité',
      'Jardin laissé à l\'abandon à reprendre en main',
      'Arbre malade ou mort à abattre en sécurité',
      'Espaces verts de copropriété non entretenus',
      'Déchets verts à évacuer après tempête',
      'Racines envahissantes endommageant les canalisations',
    ],
    urgencyText: 'Arbre ou branche tombé après une tempête ? Nos élagueurs interviennent en urgence à {city} pour sécuriser la zone.',
    urgencyData: {
      urgencyMetaTitle: 'Élagage Urgence {city} — Arbre tombé, Branches dangereuses',
      urgencyMetaDesc: 'Élagage d\'urgence à {city} : arbre tombé, branches sur toit ou voie publique. Intervention rapide, sécurisation de la zone.',
      immediateSteps: [
        'Sécurisez la zone — éloignez les personnes',
        'Ne touchez pas à un arbre sur des lignes électriques (appelez ERDF)',
        'Photographiez les dégâts pour votre assurance',
        'Signalez la situation à la mairie si voie publique concernée',
        'Pour les copropriétés : prévenez le syndic immédiatement',
        'Contactez VITFIX pour intervention rapide',
      ],
      whenToCall: [
        'Arbre ou grosse branche tombé sur véhicule, toiture ou voie publique',
        'Branches fortement inclinées menaçant de tomber',
        'Arbre déraciné par une tempête',
        'Branche coincée sur lignes électriques (après appel ERDF)',
        'Débroussaillage d\'urgence (risque incendie — obligations légales PACA)',
        'Espaces verts de copropriété à sécuriser rapidement',
      ],
      avgResponseTime: '24 à 48h',
      schedule: 'Lun–Sam, 7h–19h',
    },
    faqs: [
      {
        question: 'Quel est le tarif d\'élagage d\'arbre à {city} ?',
        answer: 'Le tarif d\'élagage varie selon la hauteur et la complexité de l\'arbre. Pour un petit arbre (< 5 m), comptez 150 à 300 €. Pour un arbre de taille moyenne (5–10 m), le tarif se situe entre 300 et 700 €. Pour les grands arbres nécessitant des techniques de cordiste (grimpe), comptez 700 à 1 500 €. L\'évacuation des déchets verts est généralement incluse ou facturée séparément selon le volume. Devis gratuit sur place ou sur photo.',
      },
      {
        question: 'Faut-il une autorisation pour abattre un arbre à {city} ?',
        answer: 'En France, l\'abattage d\'arbres peut nécessiter une autorisation selon les cas : arbres en zone protégée (PLU), arbres dans les espaces boisés classés, arbres en copropriété (accord de l\'assemblée générale). À {city}, certains secteurs (zones naturelles, espaces proches des calanques ou du littoral) peuvent être soumis à des réglementations plus strictes. Nos élagueurs connaissent la réglementation locale et peuvent vous accompagner dans les démarches si nécessaire.',
      },
      {
        question: 'Proposez-vous des contrats d\'entretien pour les copropriétés à {city} ?',
        answer: 'Oui, nous proposons des contrats d\'entretien annuels ou mensuels pour les espaces verts de copropriété. Ces contrats comprennent la tonte régulière, la taille saisonnière des haies et arbustes, l\'élagage préventif et l\'évacuation des déchets verts. Nous travaillons avec les syndics et gestionnaires de biens à {city} et dans les communes alentours. Devis gratuit sur visite.',
      },
      {
        question: 'L\'élagage est-il obligatoire dans certains cas en PACA ?',
        answer: 'En région PACA, le débroussaillage est OBLIGATOIRE légalement dans les zones exposées au risque d\'incendie de forêt, selon l\'article L131-10 du Code forestier. Les propriétaires riverains d\'espaces boisés doivent débroussailler dans un périmètre de 50 mètres autour de leur bâtiment (jusqu\'à 200 m sur décision préfectorale). Les copropriétés sont également concernées. Nos équipes réalisent ces débroussaillages obligatoires dans toutes les communes du 13 et du Var.',
      },
      {
        question: 'Comment choisir un jardinier ou élagueur de confiance à {city} ?',
        answer: 'Pour choisir un jardinier ou élagueur sérieux à {city}, privilégiez un professionnel déclaré avec une assurance responsabilité civile, qui remet un devis détaillé avant de commencer. Pour les travaux d\'élagage, vérifiez la certification CS (Certificat de Spécialisation élagage) — c\'est la garantie d\'un grimpeur formé aux techniques sécurisées. Méfiez-vous des rabatteurs qui proposent des interventions à très bas prix sans devis ni assurance. Sur VITFIX, tous nos jardiniers et élagueurs sont qualifiés, assurés et évalués par nos clients.',
      },
    ],
  },

  // ── PAYSAGISTE ───────────────────────────────────────────────────────────────
  {
    name: 'Paysagiste',
    slug: 'paysagiste',
    icon: '🌳',
    metaTitle: 'Paysagiste {city} — Création Jardin, Aménagement Paysager | Devis gratuit',
    metaDesc: 'Paysagiste certifié et de confiance à {city} : création de jardin, engazonnement, terrasse, arrosage automatique. Artisan qualifié, assurés, devis gratuit.',
    heroTitle: 'Paysagiste à {city} : Création & aménagement jardin',
    heroSubtitle: 'Paysagistes qualifiés pour la création, l\'aménagement et l\'entretien de jardins à {city}. Terrasses, allées, massifs, arrosage automatique. Devis gratuit sur place.',
    features: [
      'Création de jardins et aménagement paysager sur mesure',
      'Engazonnement (semis ou gazon en rouleau)',
      'Création de massifs et plantations méditerranéennes',
      'Installation de terrasses (bois, composite, carrelage extérieur)',
      'Pose d\'allées et dallages (graviers, pavés, béton désactivé)',
      'Systèmes d\'arrosage automatique (économie d\'eau)',
      'Bassins, fontaines et points d\'eau décoratifs',
      'Éclairage extérieur de jardin (spots, guirlandes)',
    ],
    problemsWeSolve: [
      'Jardin nu ou en friche à transformer en espace de vie',
      'Terrain en pente à aménager en terrasses',
      'Pelouse envahie par les mauvaises herbes à reprendre',
      'Espace extérieur à créer avant mise en vente',
      'Allées dégradées ou inexistantes dans le jardin',
      'Arrosage manuel chronophage à automatiser',
      'Jardin trop exposé à protéger avec haies et arbres',
      'Rénovation complète d\'un jardin méditerranéen existant',
    ],
    urgencyText: 'Aménagement urgent avant un événement ou une mise en vente ? Nos paysagistes interviennent rapidement à {city}.',
    urgencyData: {
      urgencyMetaTitle: 'Paysagiste Urgence {city} — Aménagement rapide',
      urgencyMetaDesc: 'Paysagiste en urgence à {city} : aménagement avant vente, événement, remise en état rapide. Intervention sous 48h.',
      immediateSteps: [
        'Définissez vos priorités (surface, budget, délai impératif)',
        'Prenez des photos du jardin actuel sous tous les angles',
        'Notez les contraintes (canalisations, racines, exposition soleil)',
        'Contactez VITFIX pour un rendez-vous rapide',
        'Devis sur plan ou sur place sous 24h',
        'Intervention programmée selon vos délais',
      ],
      whenToCall: [
        'Jardin à remettre en état avant mise en vente urgente',
        'Aménagement avant un événement (mariage, réception)',
        'Pelouse à regénérer avant la saison estivale',
        'Travaux de plantation avant l\'hiver',
        'Nettoyage et remise en ordre après une tempête',
        'Jardin laissé à l\'abandon depuis des années à reprendre',
      ],
      avgResponseTime: '24 à 48h pour devis',
      schedule: 'Lun–Sam, 7h–19h',
    },
    faqs: [
      {
        question: 'Quel est le tarif d\'un paysagiste à {city} et alentours ?',
        answer: 'Le tarif d\'un paysagiste varie selon la nature des travaux. Pour un entretien régulier (tonte + taille + désherbage), comptez 50 à 100 € de l\'heure. Pour la création d\'un jardin, les prix débutent à 50 € HT au m² pour un aménagement simple (engazonnement, massifs) et peuvent dépasser 200 € au m² avec terrasse, allées et système d\'arrosage. Devis gratuit sur visite.',
      },
      {
        question: 'Quelle est la meilleure période pour créer un jardin en Provence et sur le littoral ?',
        answer: 'En région méditerranéenne (La Ciotat, Cassis, Bandol, Saint-Cyr, Marseille), les meilleures périodes sont l\'automne (sept–nov) pour les plantations d\'arbres et arbustes, et le printemps (mars–avril) pour l\'engazonnement. L\'été est à éviter pour les grandes plantations en raison du stress hydrique. Nos paysagistes sélectionnent des essences méditerranéennes adaptées à la sécheresse estivale.',
      },
      {
        question: 'Proposez-vous des contrats d\'entretien de jardin à {city} et sur la côte ?',
        answer: 'Oui, nous proposons des contrats mensuels ou annuels pour l\'entretien de jardins particuliers et de copropriétés à {city} et dans les communes alentours (Aubagne, La Ciotat, Cassis, Bandol, Saint-Cyr) et dans tout le 13 et le Var. Ces contrats comprennent tonte, taille saisonnière, désherbage, fertilisation et entretien du système d\'arrosage. Devis gratuit sur visite.',
      },
      {
        question: 'Installez-vous des systèmes d\'arrosage automatique en PACA ?',
        answer: 'Oui, nous installons des systèmes d\'arrosage automatique sur mesure, adaptés au climat méditerranéen. Un système bien conçu économise 30 à 50 % d\'eau par rapport à l\'arrosage manuel — crucial en période de restrictions estivales en PACA. Nous proposons arrosage par aspersion pour les pelouses et goutte-à-goutte pour les massifs et potagers.',
      },
      {
        question: 'Comment trouver un paysagiste sérieux et de confiance à {city} ?',
        answer: 'Pour choisir un paysagiste fiable à {city}, vérifiez qu\'il est professionnel déclaré (SIRET), couvert par une assurance RC professionnelle, et qu\'il vous remet un devis détaillé avec plan ou descriptif des travaux avant de commencer. Un bon paysagiste vous conseille sur les essences adaptées au climat méditerranéen et respecte les délais convenus. Sur VITFIX, nos paysagistes sont qualifiés, assurés et évalués par les clients après chaque chantier. Photos avant/après disponibles sur demande.',
      },
    ],
  },

  // ── ÉLAGUEUR ──────────────────────────────────────────────────────────────────
  {
    name: 'Élagueur',
    slug: 'elagueur',
    icon: '🌲',
    metaTitle: 'Élagueur {city} — Élagage Abattage Arbres, Débroussaillage | Devis gratuit',
    metaDesc: 'Élagueur certifié CS et de confiance à {city} : élagage raisonné, abattage, débroussaillage obligatoire PACA. Grimpeur qualifié et assuré, devis gratuit.',
    heroTitle: 'Élagueur à {city} : Élagage, abattage & débroussaillage',
    heroSubtitle: 'Élagueurs grimpeurs certifiés pour l\'élagage, l\'abattage et le débroussaillage obligatoire à {city}. Particuliers et copropriétés. Travail sécurisé, déchets évacués.',
    features: [
      'Élagage raisonné d\'arbres (technique de cordiste certifié)',
      'Abattage d\'arbres dangereux ou malades',
      'Dessouchage et broyage de souches sur place',
      'Débroussaillage anti-incendie (obligation légale PACA)',
      'Broyage et évacuation des déchets verts',
      'Sécurisation après tempête (arbre tombé, branches)',
      'Diagnostic arboricole (état sanitaire des arbres)',
      'Contrats d\'entretien copropriétés et professionnels',
    ],
    problemsWeSolve: [
      'Arbre dangereux (branches mortes, arbre penché)',
      'Arbre malade ou mort à abattre en sécurité',
      'Branches encombrant toit, lignes électriques ou voie publique',
      'Racines envahissantes endommageant canalisations ou terrasse',
      'Obligation légale de débroussaillage non respectée (PACA)',
      'Souche à supprimer pour récupérer l\'espace',
      'Branches tombées après une tempête à évacuer',
      'Haies, arbustes et broussailles envahissants',
    ],
    urgencyText: 'Arbre tombé, branches menaçantes après une tempête ? Nos élagueurs interviennent en urgence à {city} sous 24h.',
    urgencyData: {
      urgencyMetaTitle: 'Élagueur Urgence {city} — Arbre tombé, Intervention 24h',
      urgencyMetaDesc: 'Élagueur en urgence à {city} : arbre tombé, branches dangereuses après tempête. Zone sécurisée, intervention rapide 7j/7.',
      immediateSteps: [
        'Éloignez immédiatement toutes les personnes de la zone dangereuse',
        'N\'approchez JAMAIS un arbre sur des lignes électriques — appelez ENEDIS (09 72 67 50 XX)',
        'Photographiez les dégâts pour votre assurance',
        'Signalez à la mairie si la voie publique est bloquée',
        'Pour les copropriétés, prévenez le syndic immédiatement',
        'Appelez ou WhatsApp VITFIX pour intervention urgente',
      ],
      whenToCall: [
        'Arbre tombé sur véhicule, toiture ou voie publique',
        'Grosses branches menaçant de tomber sur une habitation',
        'Arbre partiellement déraciné mais encore debout',
        'Débroussaillage d\'urgence (risque incendie de forêt)',
        'Arbre dangereux signalé par la mairie ou le voisinage',
        'Tempête ayant causé des dégâts importants dans le jardin',
      ],
      avgResponseTime: '24 à 48h',
      schedule: 'Lun–Sam, 7h–19h / Urgences 7j/7',
    },
    faqs: [
      {
        question: 'Quel est le prix d\'un élagueur à {city} et alentours ?',
        answer: 'Le tarif d\'élagage dépend de la hauteur et de l\'espèce de l\'arbre. Pour un arbre < 5 m, comptez 150 à 350 €. Entre 5 et 10 m, prévoyez 350 à 800 €. Pour les grands arbres (> 10 m) en technique de cordiste, le tarif va de 800 à 2 000 €. L\'abattage complet avec broyage et évacuation coûte généralement 500 à 3 000 € selon la taille et l\'emplacement. Devis gratuit sur photos ou visite.',
      },
      {
        question: 'Le débroussaillage est-il obligatoire dans les Bouches-du-Rhône et le Var ?',
        answer: 'Oui, dans toutes les communes du 13 et du Var situées en zone à risque d\'incendie, le débroussaillage est OBLIGATOIRE (article L131-10 du Code forestier). À {city} et dans les communes du secteur (La Ciotat, Aubagne, Cassis, Bandol, Saint-Cyr), les propriétaires doivent débroussailler sur 50 mètres autour de leurs constructions. En cas de non-respect, la commune peut réaliser les travaux aux frais du propriétaire.',
      },
      {
        question: 'Faut-il une autorisation pour abattre un arbre sur le littoral ?',
        answer: 'Dans certains cas, oui : en zone protégée (PLU), en espace boisé classé, ou en copropriété (accord assemblée générale requis). Sur le littoral méditerranéen (La Ciotat, Cassis, Bandol, Saint-Cyr), les réglementations peuvent être plus strictes en zone Natura 2000 ou proche des calanques. Nos élagueurs connaissent les règles locales et peuvent vous accompagner dans les démarches administratives.',
      },
      {
        question: 'Proposez-vous des contrats d\'élagage pour copropriétés à {city} et alentours ?',
        answer: 'Oui, nous intervenons régulièrement pour des syndics et copropriétés à {city} et dans les communes du littoral méditerranéen. Nos contrats comprennent l\'élagage saisonnier, le débroussaillage réglementaire, la taille des haies et l\'évacuation des déchets verts. Nous fournissons des attestations d\'intervention conformes aux obligations légales PACA, opposables aux services de l\'État et aux assurances.',
      },
      {
        question: 'Comment reconnaître un élagueur qualifié et de confiance à {city} ?',
        answer: 'Un élagueur sérieux à {city} possède le CS (Certificat de Spécialisation élagage), signe d\'une formation reconnue aux techniques de grimpe et de taille raisonnée. Il est couvert par une assurance RC professionnelle et remet systématiquement un devis écrit avant intervention. Méfiez-vous des propositions spontanées sans devis ni justificatif. Sur VITFIX, nos élagueurs sont certifiés CS, assurés, et évalués après chaque intervention par les clients — pour un travail soigné et sécurisé en toute confiance.',
      },
    ],
  },

  // ── NETTOYAGE COPROPRIÉTÉ ─────────────────────────────────────────────────────
  {
    name: 'Nettoyage Copropriété',
    slug: 'nettoyage-copropriete',
    icon: '🏢',
    metaTitle: 'Nettoyage Copropriété {city} — Parties Communes, Contrat Syndic | Devis gratuit',
    metaDesc: 'Nettoyage de copropriété à {city} : parties communes, halls, escaliers, parkings, local poubelles. Contrat syndic, intervention ponctuelle. Devis gratuit.',
    heroTitle: 'Nettoyage Copropriété à {city} : Parties communes & syndics',
    heroSubtitle: 'Service de nettoyage professionnel pour copropriétés à {city} : halls d\'entrée, escaliers, parkings, caves, local poubelles. Contrats annuels pour syndics. Devis gratuit.',
    features: [
      'Nettoyage et désinfection des halls d\'entrée',
      'Entretien des escaliers et paliers (lavage complet)',
      'Nettoyage des parkings souterrains et extérieurs',
      'Entretien du local poubelles et locaux vélos',
      'Lavage des vitres et surfaces vitrées communes',
      'Nettoyage de façades à la haute pression',
      'Évacuation des encombrants et dépôts sauvages',
      'Contrats hebdomadaires, bi-mensuels ou mensuels',
    ],
    problemsWeSolve: [
      'Parties communes sales, dégradées ou malodorantes',
      'Hall d\'entrée non entretenu (traces, graffitis, odeurs)',
      'Parking encombré de dépôts sauvages',
      'Local poubelles insalubre ou infesté de nuisibles',
      'Escaliers gras ou glissants (risque chute)',
      'Façade noircie à nettoyer avant assemblée générale',
      'Absence de prestataire de nettoyage régulier',
      'Nettoyage urgent après sinistre (dégât des eaux, vandalisme)',
    ],
    urgencyText: 'Sinistre, vandalisme ou inspection imminente dans votre copropriété ? Nos équipes interviennent à {city} sous 24h.',
    urgencyData: {
      urgencyMetaTitle: 'Nettoyage Copropriété Urgence {city} — Intervention 24h',
      urgencyMetaDesc: 'Nettoyage de copropriété en urgence à {city} : sinistre, vandalisme, inspection imminente. Intervention rapide pour syndics.',
      immediateSteps: [
        'Sécurisez la zone si nécessaire (accès restreint)',
        'Photographiez l\'état des lieux pour les archives de la copropriété',
        'Prévenez le conseil syndical',
        'En cas de sinistre, déclarez à l\'assurance de l\'immeuble',
        'Contactez VITFIX pour un devis et une intervention rapide',
        'Nous intervenons généralement sous 24 à 48h',
      ],
      whenToCall: [
        'Vandalisme ou graffitis dans les parties communes',
        'Dégât des eaux nécessitant un nettoyage urgent',
        'Inspection ou visite d\'acquéreur imminente',
        'Assemblée générale — présentation irréprochable requise',
        'Infestation (rongeurs, insectes) dans les locaux communs',
        'Sinistre ou incendie dans les parties communes',
      ],
      avgResponseTime: '24 à 48h',
      schedule: 'Lun–Sam, 6h–20h (horaires adaptables)',
    },
    faqs: [
      {
        question: 'Quel est le tarif pour le nettoyage d\'une copropriété à {city} ?',
        answer: 'Le tarif dépend du nombre de lots, des surfaces et de la fréquence. Pour une petite copropriété (10–20 lots), comptez 200 à 500 € par mois pour un entretien hebdomadaire. Les grandes copropriétés (50+ lots) avec parking, espaces verts et locaux spécifiques représentent 1 000 à 3 000 € mensuels. Nous établissons un devis détaillé gratuit après visite des parties communes.',
      },
      {
        question: 'Travaillez-vous avec les syndics à {city}, La Ciotat, Bandol et alentours ?',
        answer: 'Oui, nous collaborons avec des syndics professionnels et des copropriétés autogérées à Marseille, Aubagne, La Ciotat, Cassis, Bandol, Saint-Cyr et dans tout le 13 et le Var. Nous fournissons des factures conformes à la comptabilité des copropriétés, des attestations d\'intervention signées et nous adaptons les horaires pour minimiser les nuisances aux résidents.',
      },
      {
        question: 'Proposez-vous le nettoyage de façades pour les copropriétés ?',
        answer: 'Oui, nous réalisons le nettoyage de façades par haute pression ou avec des produits adaptés (anti-mousse, anti-calcaire, anti-graffitis). En PACA, les façades exposées au soleil et à l\'humidité marine se salissent rapidement. Nous intervenons avant et après ravalement, avec les autorisations nécessaires en zone classée (notamment Cassis, La Ciotat, Bandol). Devis gratuit sur photos.',
      },
      {
        question: 'Que comprend un contrat de nettoyage de parties communes ?',
        answer: 'Un contrat standard comprend : balayage et lavage des halls, nettoyage des escaliers et paliers, dépoussiérage (boîtes aux lettres, interphones), nettoyage du local poubelles et sortie/rentrée des bacs. En option : vitres, parking, local vélos, espaces verts. Le cahier des charges est défini ensemble avant signature pour coller exactement aux besoins de votre copropriété.',
      },
    ],
  },

  // ── NETTOYAGE TERRAINS ────────────────────────────────────────────────────────
  {
    name: 'Nettoyage Terrains',
    slug: 'nettoyage-terrains',
    icon: '🏕️',
    metaTitle: 'Nettoyage Terrains {city} — Débroussaillage, Friche, Gravats | Devis gratuit',
    metaDesc: 'Nettoyage de terrains à {city} : terrain en friche, débroussaillage anti-incendie, enlèvement gravats, remise en état avant vente ou construction. Devis gratuit.',
    heroTitle: 'Nettoyage de Terrains à {city} : Friche, débroussaillage & gravats',
    heroSubtitle: 'Remise en état de terrains à {city} : débroussaillage, nettoyage de friche, évacuation de gravats, préparation avant construction ou vente. Intervention rapide, devis gratuit.',
    features: [
      'Débroussaillage et nettoyage de terrain en friche',
      'Enlèvement et évacuation de gravats et déchets de chantier',
      'Préparation de terrain avant construction ou mise en vente',
      'Tonte et fauchage de grandes surfaces (tracteur disponible)',
      'Broyage de végétaux et évacuation déchets verts',
      'Nettoyage anti-incendie (débroussaillage obligatoire PACA)',
      'Enlèvement dépôts sauvages sur terrain privé',
      'Remise en état de parcelles agricoles abandonnées',
    ],
    problemsWeSolve: [
      'Terrain laissé à l\'abandon depuis plusieurs années',
      'Friche à remettre en état avant vente ou construction',
      'Gravats et déchets de chantier à évacuer',
      'Terrain envahi par ronces, arbustes et broussailles',
      'Obligation légale de débroussaillage non respectée (PACA)',
      'Souches à supprimer pour récupérer l\'espace',
      'Dépôt sauvage sur terrain privé ou copropriété',
      'Mise en demeure de la mairie ou des pompiers',
    ],
    urgencyText: 'Mise en demeure de la mairie, vente imminente ou risque incendie sur votre terrain à {city} ? Nous intervenons sous 48h.',
    urgencyData: {
      urgencyMetaTitle: 'Nettoyage Terrain Urgence {city} — Débroussaillage rapide',
      urgencyMetaDesc: 'Nettoyage de terrain en urgence à {city} : débroussaillage PACA, mise en demeure, vente imminente. Intervention sous 48h.',
      immediateSteps: [
        'Conservez le document de mise en demeure si applicable',
        'Identifiez les accès au terrain (portail, chemin)',
        'Listez les déchets présents (gravats, végétaux, encombrants)',
        'Prenez des photos pour état des lieux et assurance',
        'Contactez VITFIX pour un devis rapide (sur photos ou visite)',
        'Intervention planifiée selon votre délai d\'urgence',
      ],
      whenToCall: [
        'Mise en demeure de la mairie ou des pompiers',
        'Vente imminente nécessitant la remise en état',
        'Risque d\'incendie avéré sur terrain embroussaillé',
        'Construction imminente nécessitant un terrain propre',
        'Gravats devant être évacués dans un délai court',
        'Dépôt sauvage signalé menaçant de s\'étendre',
      ],
      avgResponseTime: '48 à 72h',
      schedule: 'Lun–Sam, 7h–18h',
    },
    faqs: [
      {
        question: 'Quel est le tarif pour nettoyer un terrain en friche à {city}, La Ciotat ou Bandol ?',
        answer: 'Le tarif dépend de la superficie, de la densité de végétation et des déchets à évacuer. Pour 500 m² avec débroussaillage simple, comptez 500 à 1 200 €. Pour 1 000 m² avec végétation dense et évacuation de gravats, prévoyez 1 500 à 3 500 €. Le devis est gratuit sur photos ou visite. Nous fournissons un bordereau de dépôt en déchetterie agréée à la demande.',
      },
      {
        question: 'Le débroussaillage est-il obligatoire dans les Bouches-du-Rhône et le Var ?',
        answer: 'Oui, le débroussaillage est une OBLIGATION légale en région PACA (article L131-10 du Code forestier) pour les communes situées en zone à risque d\'incendie. À Marseille, La Ciotat, Aubagne, Cassis, Bandol et Saint-Cyr, les propriétaires doivent débroussailler sur 50 m autour de leurs constructions (jusqu\'à 200 m sur arrêté préfectoral). En cas de non-respect, la commune peut exécuter les travaux aux frais du propriétaire.',
      },
      {
        question: 'Évacuez-vous les gravats et déchets de chantier ?',
        answer: 'Oui, nous évacuons tous types de déchets : gravats, tuiles, parpaings, bois, ferraille, déchets verts. Nous trions les matériaux pour les orienter vers les filières adaptées (déchetteries, centres de recyclage agréés). Bordereaux de dépôt remis sur demande — utiles pour les dossiers d\'assurance ou de vente. Chargement et transport inclus dans nos devis.',
      },
      {
        question: 'Intervenez-vous pour nettoyer des terrains avant vente sur la côte marseillaise ?',
        answer: 'Oui, c\'est une prestation très fréquente sur l\'axe Marseille–La Ciotat–Bandol. Un terrain propre et débroussaillé se vend plus facilement et à meilleur prix. Nous intervenons sous 48 à 72h et fournissons des photos avant/après pour votre dossier de vente. Nous travaillons en coordination avec les agences immobilières et notaires si nécessaire.',
      },
    ],
  },

  // ── JARDINIER ─────────────────────────────────────────────────────────────────
  {
    name: 'Jardinier',
    slug: 'jardinier',
    icon: '🌱',
    metaTitle: 'Jardinier {city} — Entretien Jardin, Taille Haie, Taille Olivier | Devis gratuit',
    metaDesc: 'Jardinier professionnel à {city} : entretien de jardins, tonte pelouse, taille haie, taille oliviers, contrat annuel. Tarifs compétitifs, devis gratuit.',
    heroTitle: 'Jardinier à {city} : Entretien jardins & taille',
    heroSubtitle: 'Jardiniers qualifiés pour l\'entretien régulier de vos jardins à {city} : tonte, taille haie, taille oliviers, désherbage, contrats mensuels. Particuliers et copropriétés. Devis gratuit.',
    features: [
      'Tonte pelouse et entretien gazon (mensuel ou bi-mensuel)',
      'Taille de haies (thuyas, lauriers, cyprès, bambous)',
      'Taille d\'oliviers et d\'arbres fruitiers (amandiers, figuiers)',
      'Désherbage et traitement allées, bordures, massifs',
      'Ramassage feuilles mortes et déchets verts',
      'Taille de palmiers (élagage et dévitalisation palmes sèches)',
      'Entretien contrat annuel ou mensuel (particulier et copropriété)',
      'Évacuation et broyage des déchets verts',
    ],
    problemsWeSolve: [
      'Pelouse qui pousse trop vite et manque d\'entretien',
      'Haie qui déborde sur la propriété du voisin',
      'Oliviers non taillés depuis plusieurs années',
      'Allées et bordures envahies par les mauvaises herbes',
      'Jardin mal entretenu visible depuis la rue (mise en demeure mairie)',
      'Jardin de résidence secondaire à entretenir à distance',
      'Palmiers avec palmes sèches et risque incendie',
      'Déchets verts qui s\'accumulent sans évacuation',
    ],
    urgencyText: 'Jardin à remettre en état rapidement ? Haie en infraction avec le voisinage ? Nos jardiniers interviennent sous 48h à {city}.',
    urgencyData: {
      urgencyMetaTitle: 'Jardinier Urgence {city} — Intervention rapide 48h',
      urgencyMetaDesc: 'Jardinier en urgence à {city} : mise en état rapide, haie débordante, vente imminente. Intervention sous 48h, devis gratuit.',
      immediateSteps: [
        'Prenez des photos de l\'état actuel du jardin',
        'Notez la superficie et les travaux prioritaires',
        'Vérifiez les contraintes (accès, stationnement engins)',
        'Contactez VITFIX pour un devis rapide',
        'Nous planifions l\'intervention selon votre urgence',
        'Intervention sous 24 à 48h possible',
      ],
      whenToCall: [
        'Mise en demeure du voisin ou de la mairie concernant votre haie',
        'Jardin à remettre en état avant mise en vente',
        'Résidence secondaire à préparer avant votre arrivée',
        'Jardin laissé à l\'abandon depuis plusieurs mois',
        'Copropriété avec espaces verts en mauvais état avant AG',
        'Palmiers avec palmes sèches menaçantes',
      ],
      avgResponseTime: '24 à 48h',
      schedule: 'Lun–Sam, 7h–19h',
    },
    faqs: [
      {
        question: 'Quel est le tarif d\'un jardinier à La Ciotat, Aubagne, Bandol et Sanary ?',
        answer: 'Le tarif horaire d\'un jardinier en région PACA (La Ciotat, Aubagne, Bandol, Sanary, Gémenos) varie entre 35 et 65 € de l\'heure selon la prestation. La tonte d\'une pelouse de 100 m² coûte entre 40 et 80 €. La taille d\'une haie de 10 mètres linéaires : 60 à 150 €. Un contrat d\'entretien mensuel (tonte + taille + débroussaillage) pour un jardin de 300 m² coûte en moyenne 100 à 200 €/mois. Devis gratuit.',
      },
      {
        question: 'Proposez-vous la taille d\'oliviers en Provence ?',
        answer: 'Oui, la taille d\'oliviers est une spécialité de nos jardiniers en région PACA. L\'olivier nécessite une taille annuelle pour maintenir sa forme, favoriser la production et prévenir les maladies (notamment la mouche de l\'olive). La période idéale est le printemps, après les gelées. Nous intervenons à La Ciotat, Aubagne, Cassis, Bandol, Saint-Cyr, Gémenos, Sanary et dans tout le 13 et le Var. Tarif à partir de 80 € pour un olivier de taille moyenne.',
      },
      {
        question: 'La taille de haie est-elle réglementée en France ?',
        answer: 'Oui, la hauteur des haies et leur implantation en bordure de propriété sont réglementées. En règle générale : haie à moins de 50 cm de la limite = hauteur max 2 m ; haie à plus de 50 cm = pas de limite de hauteur. Les branches et racines qui dépassent chez le voisin peuvent être coupées par ce dernier. Nos jardiniers connaissent ces règles et peuvent vous conseiller pour éviter tout conflit de voisinage.',
      },
      {
        question: 'Intervenez-vous pour des résidences secondaires sur le littoral ?',
        answer: 'Oui, nous proposons un service spécial "résidence secondaire" très populaire sur le littoral (La Ciotat, Cassis, Bandol, Saint-Cyr, Sanary, Six-Fours). Nous gérons votre jardin en votre absence : tonte régulière, taille haies, arrosage, ramassage courrier si besoin. Devis sur mesure selon la fréquence souhaitée. Rapport et photos après chaque intervention si demandé.',
      },
    ],
  },

  // ── VIDE MAISON & DÉBARRAS SUCCESSION ────────────────────────────────────────
  {
    name: 'Vide Maison & Débarras',
    slug: 'vide-maison',
    icon: '📦',
    metaTitle: 'Vide Maison {city} — Débarras Succession, Après Décès | Devis gratuit',
    metaDesc: 'Vide maison à {city} : débarras après décès, succession, départ en maison de retraite, avant vente. Discret, rapide, devis gratuit. Débarras gratuit si objets de valeur.',
    heroTitle: 'Vide Maison & Débarras à {city} : Succession & après décès',
    heroSubtitle: 'Spécialistes du vide maison et du débarras succession à {city}. Intervention discrète et respectueuse après décès, départ EHPAD ou avant vente. Devis gratuit, débarras gratuit si objets récupérables.',
    features: [
      'Vide maison complet (succession, décès, départ EHPAD)',
      'Débarras après décès avec respect des biens du défunt',
      'Vider appartement avant vente ou mise en location',
      'Débarras départ maison de retraite ou EHPAD',
      'Rachat d\'objets de valeur (meubles, bibelots, argenterie)',
      'Tri sélectif et don aux associations (Emmaüs, Croix-Rouge)',
      'Nettoyage complet du logement après vidage',
      'Coordination avec notaires et agences immobilières',
    ],
    problemsWeSolve: [
      'Maison d\'un proche décédé à vider dans des délais imposés',
      'Appartement à vider après départ en EHPAD',
      'Logement à débarrasser avant mise en vente immobilière',
      'Cave, grenier ou garage encombrés depuis des années',
      'Locataire parti en laissant des meubles et affaires',
      'Logement insalubre ou syndrome de Diogène à traiter',
      'Trop d\'objets à évacuer sans moyen de transport adapté',
      'Objets de valeur à inventorier avant le débarras',
    ],
    urgencyText: 'Succession à traiter rapidement, mise en vente imminente ? Nous vidons votre maison à {city} sous 48h.',
    urgencyData: {
      urgencyMetaTitle: 'Vide Maison Urgence {city} — Débarras succession 48h',
      urgencyMetaDesc: 'Vide maison en urgence à {city} : succession, avant vente, appartement à libérer. Intervention sous 48h, devis gratuit.',
      immediateSteps: [
        'Attendez l\'accord du notaire avant de vider (succession)',
        'Faites un inventaire rapide des objets de valeur',
        'Identifiez ce que la famille souhaite conserver',
        'Prenez des photos pour l\'état des lieux',
        'Contactez VITFIX pour un devis gratuit sous 24h',
        'Intervention planifiée selon votre délai imposé',
      ],
      whenToCall: [
        'Logement à libérer dans un délai court imposé par le bailleur',
        'Succession nécessitant la mise en vente rapide du bien',
        'Départ précipité en maison de retraite ou EHPAD',
        'Fin de bail locataire sans enlèvement des meubles',
        'Logement dégradé ou insalubre nécessitant un nettoyage profond',
        'Vente immobilière à finaliser dans les semaines à venir',
      ],
      avgResponseTime: '24 à 48h',
      schedule: 'Lun–Sam, 8h–18h',
    },
    faqs: [
      {
        question: 'Quel est le tarif pour un vide maison à La Ciotat, Aubagne ou Bandol ?',
        answer: 'Le tarif dépend du volume et de l\'accessibilité. Pour un appartement T2 à T3, comptez 400 à 1 200 €. Pour une maison complète, le tarif se situe entre 800 et 3 000 €. Si des objets de valeur sont récupérables (meubles, argenterie, tableau, bibelots), le débarras peut être partiellement ou totalement gratuit. Devis gratuit à domicile dans tout le secteur Marseille–La Ciotat–Bandol–Sanary.',
      },
      {
        question: 'Peut-on faire un débarras succession avant la fin de la procédure notariale ?',
        answer: 'Il faut généralement attendre l\'accord du notaire et des héritiers avant de procéder au vidage. Cependant, une fois l\'accord obtenu, nous pouvons intervenir très rapidement (sous 48h à La Ciotat, Aubagne, Cassis, Bandol, Gémenos, Sanary). Nous travaillons fréquemment en coordination avec les notaires de la région. Si des objets doivent être conservés pour inventaire notarial, nous les respectons scrupuleusement.',
      },
      {
        question: 'Le débarras peut-il être gratuit à {city} et dans le 13 ?',
        answer: 'Oui, le débarras peut être totalement gratuit si la valeur des objets récupérables (meubles anciens, électroménager en état, bibelots, argenterie, outils) couvre nos frais de main-d\'œuvre et transport. Après visite ou photos, nous évaluons la valeur récupérable et vous proposons soit un devis, soit un débarras sans frais. Ce service est disponible sur toute la zone Marseille–La Ciotat–Aubagne–Bandol–Sanary–Six-Fours.',
      },
      {
        question: 'Intervenez-vous pour vider un appartement après expulsion ou départ de locataire ?',
        answer: 'Oui, nous intervenons pour les bailleurs et propriétaires qui récupèrent un logement encombré après le départ d\'un locataire (avec ou sans expulsion). Nous documentons l\'état du logement par photos avant et après intervention — utile pour les démarches juridiques. Intervention rapide à La Ciotat, Aubagne, Cassis, Bandol, Gémenos, Sanary, Six-Fours et dans tout le 13 et le Var.',
      },
    ],
  },

  // ── DÉBOUCHAGE CANALISATION ───────────────────────────────────────────────────
  {
    name: 'Débouchage Canalisation',
    slug: 'debouchage-canalisation',
    icon: '🚿',
    metaTitle: 'Débouchage Canalisation {city} — WC Bouché, Urgence 24h | Devis gratuit',
    metaDesc: 'Débouchage canalisation à {city} : WC bouché, évier, douche, canalisation bouchée. Intervention urgence 24h/7j. Haute pression et caméra. Devis gratuit.',
    heroTitle: 'Débouchage Canalisation à {city} : WC bouché, urgence 24h',
    heroSubtitle: 'Débouchage professionnel de canalisations à {city} : WC bouchés, évier, baignoire, douche, canalisation principale. Intervention 24h/7j, haute pression, sans casse. Devis gratuit.',
    features: [
      'Débouchage WC et toilettes (furet mécanique ou haute pression)',
      'Débouchage évier, lavabo et canalisation cuisine',
      'Débouchage baignoire, douche et siphon',
      'Curage canalisation principale à la haute pression (350 bars)',
      'Inspection vidéo par caméra (diagnostic précis)',
      'Débouchage fosse septique et bac à graisses',
      'Hydrocurage canalisation d\'assainissement',
      'Détection de racines dans les canalisations',
    ],
    problemsWeSolve: [
      'WC ou toilettes bouchés (urgent)',
      'Évier ou lavabo qui se vide très lentement',
      'Canalisation principale bouchée (plusieurs équipements touchés)',
      'Odeurs d\'égout persistantes dans le logement',
      'Retour d\'égout dans la douche ou la baignoire',
      'Lavabo qui déborde dès qu\'on laisse couler l\'eau',
      'Fosse septique pleine ou canalisation de refoulement bouchée',
      'Bac à graisses (restaurant, cuisine pro) à curer',
    ],
    urgencyText: 'WC bouché ou canalisation bouchée ? Nos techniciens interviennent en urgence à {city} 24h/24, 7j/7.',
    urgencyData: {
      urgencyMetaTitle: 'Débouchage Urgence {city} — Canalisation bouchée 24h/7j',
      urgencyMetaDesc: 'Débouchage d\'urgence à {city} : WC bouché, canalisation bouchée, retour d\'égout. Technicien disponible 24h/24, 7j/7.',
      immediateSteps: [
        'N\'utilisez plus les équipements sanitaires bouchés',
        'Ne versez pas de produit chimique déboucheur en excès',
        'Si retour d\'égout : coupez l\'eau d\'alimentation',
        'Aérez la pièce en cas d\'odeurs fortes',
        'Photographiez le problème si visible',
        'Appelez ou WhatsApp VITFIX — intervention sous 1h en urgence',
      ],
      whenToCall: [
        'WC complètement bouché, impossible d\'utiliser les toilettes',
        'Retour d\'eau sale ou d\'égout dans les équipements',
        'Toutes les canalisations du logement bouchées',
        'Odeur d\'égout insupportable impossible à localiser',
        'Baignoire ou douche qui ne se vide plus du tout',
        'Canalisation bouchée avant une réunion ou un événement',
      ],
      avgResponseTime: '30 à 60 min en urgence',
      schedule: '7j/7, 24h/24',
    },
    faqs: [
      {
        question: 'Quel est le tarif pour un débouchage de canalisation à La Ciotat, Aubagne ou Bandol ?',
        answer: 'Le tarif d\'un débouchage simple (WC, évier, lavabo) varie entre 80 et 200 € selon l\'accessibilité et la technique. Pour un curage à haute pression, comptez 150 à 400 €. Pour une inspection caméra + débouchage, prévoyez 200 à 500 €. En intervention de nuit ou le week-end, un supplément d\'urgence peut s\'appliquer. Devis gratuit avant intervention sur La Ciotat, Aubagne, Cassis, Bandol, Gémenos, Sanary et Six-Fours.',
      },
      {
        question: 'Comment déboucher soi-même une canalisation avant d\'appeler un professionnel ?',
        answer: 'Pour un bouchon simple (cheveux, savon), vous pouvez essayer : une ventouse (10 ventouses rapides), de l\'eau bouillante dans l\'évier, ou un furet manuel. Si le problème persiste après 10–15 min, appelez un professionnel. Évitez les produits chimiques agressifs en quantité (endommagent les canalisations PVC et irritent les yeux). N\'utilisez jamais de produit acide ou soude concentrée sur des canalisations en plomb ou fonte.',
      },
      {
        question: 'Pourquoi mes canalisations se bouchent régulièrement ?',
        answer: 'Les bouchages récurrents sont souvent causés par : un défaut de pente des canalisations, des racines d\'arbres qui pénètrent dans les tuyaux (fréquent en PACA avec les pins, oliviers et figuiers), une accumulation de calcaire (eau dure en Provence), ou une canalisation en mauvais état ou de trop faible diamètre. Une inspection par caméra permet d\'identifier la cause exacte et d\'y remédier définitivement. Nous proposons ce diagnostic à La Ciotat, Aubagne, Cassis, Bandol et sur tout le littoral.',
      },
      {
        question: 'Intervenez-vous aussi pour les copropriétés et immeubles ?',
        answer: 'Oui, nous intervenons pour les copropriétés, les syndics et les immeubles collectifs. Le curage des colonnes montantes et la maintenance des réseaux d\'assainissement font partie de nos prestations régulières. Nous pouvons établir des contrats de maintenance préventive annuels pour les immeubles de Marseille, La Ciotat, Aubagne, Bandol, Sanary et Six-Fours — utiles pour prévenir les bouchages récurrents dans les parties communes.',
      },
    ],
  },

  // ── COUVREUR / TOITURE ────────────────────────────────────────────────────────
  {
    name: 'Couvreur / Toiture',
    slug: 'couvreur',
    icon: '🏠',
    metaTitle: 'Couvreur {city} — Toiture, tuile canal, fuite urgence | VITFIX',
    metaDesc: 'Couvreur à {city} : réparation toiture, fuite urgence, tuile canal provençale, réfection complète. Garantie décennale, devis gratuit sous 24h.',
    heroTitle: 'Couvreur à {city} : Toiture, réparation fuite, tuile canal',
    heroSubtitle: 'Couvreurs qualifiés pour tous vos travaux de toiture à {city} : tuile canal, tuile plate, réfection, étanchéité. Intervention urgente possible. Devis gratuit.',
    features: [
      'Réparation de fuite toiture (intervention urgente)',
      'Remplacement tuiles cassées ou déplacées (mistral)',
      'Réfection complète de toiture',
      'Pose et entretien tuile canal provençale',
      'Étanchéité toit plat (bitume, résine)',
      'Zinguerie (gouttières, chéneaux, faîtages)',
      'Isolation toiture par l\'extérieur (ITE)',
      'Nettoyage et démoussage toiture',
    ],
    problemsWeSolve: [
      'Toit qui fuit après les pluies ou le mistral',
      'Tuiles cassées, déplacées ou manquantes',
      'Gouttières bouchées ou arrachées',
      'Chéneaux rouillés ou fissurés',
      'Infiltration d\'eau au niveau du faîtage',
      'Toit plat avec cloque ou fissure d\'étanchéité',
      'Mousse et lichens sur les tuiles (risque d\'infiltration)',
      'Isolation insuffisante (perte de chaleur en hiver)',
    ],
    urgencyText: 'Fuite de toit après orage ou mistral ? Nos couvreurs interviennent en urgence à {city} pour une mise hors d\'eau rapide.',
    urgencyData: {
      urgencyMetaTitle: 'Couvreur Urgence {city} — Fuite toiture 24h/7j',
      urgencyMetaDesc: 'Couvreur en urgence à {city} : fuite après orage, tuile arrachée, toit ouvert. Mise hors d\'eau rapide, intervention 7j/7.',
      immediateSteps: [
        'Protégez vos affaires avec des bâches ou seaux',
        'Ne montez pas sur le toit par sécurité',
        'Prenez des photos des dégâts intérieurs et extérieurs',
        'Coupez l\'électricité si l\'eau touche une zone électrique',
        'Déclarez le sinistre à votre assurance sous 5 jours',
        'Appelez ou WhatsApp VITFIX pour une mise hors d\'eau urgente',
      ],
      whenToCall: [
        'Toit qui laisse entrer la pluie dans le logement',
        'Tuile arrachée ou cassée exposant la charpente',
        'Infiltration d\'eau au plafond ou dans les murs',
        'Charpente exposée après un épisode de mistral',
        'Dégât des eaux en cours depuis la toiture',
        'Gouttière arrachée causant des dégâts en façade',
      ],
      avgResponseTime: '2 à 4 h (mise hors d\'eau)',
      schedule: '7j/7, urgences 24h/24',
    },
    faqs: [
      {
        question: 'Quel est le prix d\'une réparation de toiture à {city} et en PACA ?',
        answer: 'Le tarif d\'une réparation ponctuelle (quelques tuiles) varie entre 150 et 500 € selon l\'accessibilité. Une réfection complète de toiture en tuile canal coûte entre 80 et 150 €/m² posé. Pour une toiture de 80 m², prévoyez 6 000 à 12 000 €. Les tuiles canal provençales sont plus chères à la pose mais sont parfaitement adaptées au climat méditerranéen. Devis gratuit sous 24h.',
      },
      {
        question: 'Quelles sont les spécificités des toitures à {city} (tuile canal, mistral) ?',
        answer: 'La toiture en tuile canal (ou tuile romaine) est caractéristique de l\'architecture provençale. Elle est idéale pour le climat méditerranéen : excellente ventilation, résistance aux UV, belle esthétique. La contrainte principale en PACA est le mistral : les tuiles doivent être agrafées ou scellées pour résister aux vents violents. Un couvreur local connaît parfaitement ces spécificités. La faible pente des toits provençaux requiert aussi une attention particulière à l\'étanchéité.',
      },
      {
        question: 'Mon assurance habitation couvre-t-elle les dégâts de toiture (mistral, orage) ?',
        answer: 'Oui, la garantie tempête, grêle, neige couvre les dommages causés par le vent (mistral), la grêle ou la neige. Il faut déclarer le sinistre dans les 5 jours ouvrés. L\'assurance mandate généralement un expert pour estimer les dégâts. Nous établissons un rapport d\'intervention détaillé et pouvons vous accompagner dans vos démarches. En cas de sinistre climatique reconnu (arrêté préfectoral), la procédure est simplifiée.',
      },
      {
        question: 'Quelle garantie pour des travaux de couverture ?',
        answer: 'Tout couvreur professionnel est soumis à la garantie décennale (10 ans pour les travaux structurels comme une réfection complète), la garantie de parfait achèvement (1 an) et la garantie biennale (2 ans pour les éléments dissociables). Nos artisans fournissent obligatoirement leur attestation d\'assurance décennale avant le début des travaux. Ne travaillez jamais avec un couvreur ne pouvant justifier de cette assurance.',
      },
    ],
  },

  // ── CLIMATISATION ─────────────────────────────────────────────────────────────
  {
    name: 'Climatisation',
    slug: 'climatisation',
    icon: '❄️',
    metaTitle: 'Climatisation {city} — Installation, entretien, dépannage | VITFIX',
    metaDesc: 'Climatisation réversible à {city} : installation, entretien annuel, dépannage. RGE, éligible MaPrimeRénov. Devis gratuit, pompe à chaleur PACA.',
    heroTitle: 'Climatisation à {city} : Installation clim réversible, RGE certifié',
    heroSubtitle: 'Spécialistes en climatisation réversible à {city} : installation, entretien, dépannage. Pompe à chaleur éligible MaPrimeRénov et aides CEE. Devis gratuit.',
    features: [
      'Installation climatisation réversible (split, multi-split)',
      'Pose pompe à chaleur air/air et air/eau',
      'Entretien annuel et nettoyage des filtres',
      'Dépannage panne de climatisation (urgence)',
      'Installation climatisation gainable',
      'Recharge gaz réfrigérant (R32, R410A)',
      'Remplacement unités défectueuses',
      'Conseil choix climatiseur (surface, DPE, aides)',
    ],
    problemsWeSolve: [
      'Logement surchauffé en été (PACA : 35 à 40°C)',
      'Climatiseur qui ne refroidit plus ou fuit',
      'Unité extérieure bruyante ou vibrante',
      'Odeurs désagréables (moisissures dans les filtres)',
      'Facture électrique trop élevée (ancien système)',
      'Chauffage insuffisant en hiver (réversible)',
      'Télécommande ou carte électronique HS',
      'Gaz réfrigérant à recharger',
    ],
    urgencyText: 'Panne de climatisation en plein été à {city} ? Nos techniciens interviennent rapidement pour rétablir votre confort thermique.',
    urgencyData: {
      urgencyMetaTitle: 'Dépannage Climatisation {city} — Urgence chaleur été',
      urgencyMetaDesc: 'Dépannage climatisation en urgence à {city} : panne de clim, fuite de gaz, unité HS. Technicien RGE disponible rapidement.',
      immediateSteps: [
        'Redémarrez l\'unité après 2 min d\'arrêt complet',
        'Vérifiez que le filtre n\'est pas obstrué (nettoyable)',
        'Contrôlez le disjoncteur dédié à la clim',
        'Vérifiez que l\'unité extérieure n\'est pas obstruée (feuilles, grille)',
        'Si fuite de gaz (bruit de sifflement) : coupez et appelez',
        'Contactez VITFIX pour diagnostic rapide',
      ],
      whenToCall: [
        'Climatiseur complètement HS en pleine chaleur estivale',
        'Fuite de gaz réfrigérant suspectée',
        'Unité intérieure qui fuit de l\'eau',
        'Odeur de brûlé ou fumée de l\'unité',
        'Erreur électronique persistante (code clignote)',
        'Climatiseur qui tourne sans refroidir',
      ],
      avgResponseTime: '2 à 4 h',
      schedule: 'Lun–Sam 8h–19h, urgences été 7j/7',
    },
    faqs: [
      {
        question: 'Quel est le prix d\'installation d\'une climatisation à {city} en 2025 ?',
        answer: 'L\'installation d\'un split mural (une pièce) coûte entre 1 200 et 2 500 € TTC (matériel + pose). Pour un multi-split (2 à 4 unités), comptez 3 000 à 6 000 €. La pompe à chaleur air/eau (chauffage et ECS) est plus onéreuse : 8 000 à 15 000 €, mais éligible à MaPrimeRénov jusqu\'à 4 000 € de subvention. Après aides, une clim réversible peut revenir à moins de 1 000 €.',
      },
      {
        question: 'La climatisation est-elle éligible à MaPrimeRénov en PACA ?',
        answer: 'La climatisation simple n\'est pas éligible à MaPrimeRénov. En revanche, la pompe à chaleur air/air réversible peut bénéficier de CEE (Certificats d\'Économies d\'Énergie) et d\'éco-PTZ. La PAC air/eau (qui remplace une chaudière fuel ou gaz) est éligible à MaPrimeRénov : jusqu\'à 4 000 € selon les revenus. L\'intervention doit être réalisée par un artisan RGE (Reconnu Garant de l\'Environnement).',
      },
      {
        question: 'Faut-il un entretien annuel pour une climatisation en PACA ?',
        answer: 'L\'entretien annuel est obligatoire pour les systèmes dont la puissance dépasse 12 kW. Pour les systèmes résidentiels standards, il est fortement recommandé : nettoyage des filtres (tous les 3 mois idéalement), contrôle du gaz réfrigérant, vérification des connexions électriques. En PACA, la poussière, le pollen et les insectes colmatent rapidement les filtres. L\'entretien préventif coûte 80 à 150 € et évite les pannes estivales.',
      },
      {
        question: 'Quelle marque de climatisation recommander en PACA ?',
        answer: 'Pour la résistance au climat méditerranéen (chaleur intense, humidité côtière), nous recommandons en priorité : Daikin, Mitsubishi Electric et Panasonic (fiabilité maximale, SAV en France). Atlantic et Hitachi offrent un bon rapport qualité/prix. Évitez les marques sans SAV France — en cas de panne en août à Marseille, les délais peuvent être catastrophiques. Nous travaillons avec des marques dont nous garantissons l\'approvisionnement en pièces.',
      },
    ],
  },

  // ── CARRELEUR ─────────────────────────────────────────────────────────────────
  {
    name: 'Carreleur',
    slug: 'carreleur',
    icon: '🔲',
    metaTitle: 'Carreleur {city} — Pose carrelage, faïence salle de bain | VITFIX',
    metaDesc: 'Carreleur professionnel à {city} : pose carrelage sol/mur, faïence salle de bain, terrasse, rénovation. TVA 10%, devis gratuit.',
    heroTitle: 'Carreleur à {city} : Pose carrelage, rénovation salle de bain',
    heroSubtitle: 'Carreleurs qualifiés à {city} pour tous vos travaux : pose carrelage sol et mur, faïence salle de bain, terrasse extérieure, grande dalle. TVA réduite, devis gratuit.',
    features: [
      'Pose carrelage sol toutes surfaces (jusqu\'à grande dalle)',
      'Pose faïence murale salle de bain et cuisine',
      'Carrelage extérieur et terrasse (antidérapant)',
      'Rénovation et remplacement carrelage existant',
      'Préparation support (ragréage, imperméabilisation)',
      'Pose sur plancher chauffant',
      'Joints colorés et résine époxy pour espaces humides',
      'Pose mosaïque et carreaux de ciment décoratifs',
    ],
    problemsWeSolve: [
      'Carrelage décollé, fissuré ou cassé',
      'Salle de bain à rénover entièrement',
      'Terrasse glissante ou carrelage extérieur abîmé',
      'Joints noircis ou dégradés à refaire',
      'Parquet à remplacer par du carrelage imitation bois',
      'Cuisine avec faïence abîmée ou démodée',
      'Plancher chauffant à carreler (pose spécifique)',
      'Salle de bain PMR (douche à l\'italienne, pente)',
    ],
    urgencyText: 'Carrelage décollé ou salle de bain hors service ? Nos carreleurs interviennent rapidement à {city} pour un résultat durable.',
    urgencyData: {
      urgencyMetaTitle: 'Carreleur {city} — Rénovation carrelage rapide',
      urgencyMetaDesc: 'Carreleur disponible à {city} : pose carrelage sol/mur, rénovation salle de bain, terrasse. Devis gratuit, intervention rapide.',
      immediateSteps: [
        'Sécurisez les carreaux décollés pour éviter les chutes',
        'Mesurez la surface à carreler (longueur × largeur)',
        'Notez le type de support (béton, ancien carrelage, bois)',
        'Pensez à choisir votre carrelage avant la pose',
        'Prévoyez 10 % de carreaux en plus (chutes et casse)',
        'Contactez VITFIX pour un devis précis sous 24h',
      ],
      whenToCall: [
        'Carreaux décollés formant des bosses (risque de chute)',
        'Salle de bain à rénover avant une location ou vente',
        'Terrasse à carreler avant l\'été',
        'Carrelage fissuré laissant passer l\'eau',
        'Joints de salle de bain moisis impossibles à récupérer',
        'Chantier de rénovation globale incluant le carrelage',
      ],
      avgResponseTime: '2 à 5 jours ouvrés',
      schedule: 'Lun–Sam 8h–18h',
    },
    faqs: [
      {
        question: 'Quel est le tarif d\'un carreleur à {city} et en région PACA ?',
        answer: 'La pose de carrelage coûte entre 25 et 60 €/m² en main d\'œuvre seule selon la complexité (grande dalle simple : 25 €/m², mosaïque ou chevron : 55 €/m²). Pour une salle de bain complète (sol + murs + faïence, ~15 m²), comptez 800 à 2 000 € de pose. La TVA est à 10 % (travaux de rénovation en logement de plus de 2 ans). Devis gratuit fourni avant tout engagement.',
      },
      {
        question: 'Peut-on poser du carrelage sur un ancien carrelage ?',
        answer: 'Oui, c\'est techniquement possible si l\'ancien carrelage est bien adhérent, plan et propre. Cette solution évite le coût et le temps du dépose-repose. Cependant, elle surélève le sol (attention aux portes, seuils, plinthes) et est déconseillée si l\'ancien carrelage est décollé ou si le support est douteux. Nous réalisons un diagnostic gratuit du support avant de recommander cette option.',
      },
      {
        question: 'Quelle est la différence entre carrelage intérieur et extérieur en PACA ?',
        answer: 'Le carrelage extérieur doit obligatoirement être antidérapant (classe R11 minimum pour terrasse) et résistant aux variations thermiques importantes de PACA (40°C d\'amplitude hiver/été). Les carreaux à faible absorption d\'eau (grès cérame pleine masse, rectifié) sont idéaux pour les terrasses provençales exposées aux UV et aux embruns côtiers (Cassis, Bandol, Sanary).',
      },
      {
        question: 'Combien de temps dure la pose d\'une salle de bain à {city} ?',
        answer: 'La pose de carrelage d\'une salle de bain standard (5–10 m²) prend 2 à 4 jours ouvrés (préparation + pose sol + pose mur + joints). Si une reprise de support ou une imperméabilisation est nécessaire, ajoutez 1 à 2 jours. La salle de bain est utilisable 24 à 48h après la dernière pose (séchage du mortier). Nous planifions les travaux pour minimiser l\'indisponibilité de la pièce.',
      },
    ],
  },

  // ── MAÇON / RAVALEMENT ────────────────────────────────────────────────────────
  {
    name: 'Maçon / Ravalement',
    slug: 'macon',
    icon: '🧱',
    metaTitle: 'Maçon {city} — Ravalement façade, enduit, rénovation | VITFIX',
    metaDesc: 'Maçon qualifié à {city} : ravalement façade, enduit, réparation fissures, rénovation extérieure. Devis gratuit, garantie décennale.',
    heroTitle: 'Maçon à {city} : Ravalement façade, enduit, maçonnerie générale',
    heroSubtitle: 'Maçons qualifiés à {city} pour ravalement de façade, enduit extérieur, réparation fissures, rénovation gros œuvre. Garantie décennale, devis gratuit.',
    features: [
      'Ravalement et réfection de façade (enduit, peinture)',
      'Réparation de fissures (structurelles et superficielles)',
      'Pose d\'enduit monocouche ou à la chaux',
      'Isolation thermique par l\'extérieur (ITE)',
      'Rénovation de mur, terrasse et dalle béton',
      'Maçonnerie générale : cloison, seuil, escalier',
      'Carrelage extérieur et allée',
      'Démolition et rénovation cloison intérieure',
    ],
    problemsWeSolve: [
      'Façade fissurée, éclatée ou avec traces d\'humidité',
      'Enduit extérieur dégradé (UV, gel, humidité)',
      'Ravalement obligatoire (syndic ou mairie)',
      'Fissures sur mur porteur ou de façade',
      'Mur de clôture abîmé ou à refaire',
      'Dalle ou terrasse béton fissurée',
      'Rénovation extérieure avant vente ou location',
      'Isolation insuffisante (façade froide en hiver)',
    ],
    urgencyText: 'Fissure sur façade ou mur porteur à {city} ? Nos maçons diagnostiquent et interviennent rapidement pour sécuriser votre bien.',
    urgencyData: {
      urgencyMetaTitle: 'Maçon Urgence {city} — Fissures, ravalement, réparation',
      urgencyMetaDesc: 'Maçon disponible à {city} : réparation fissures urgentes, ravalement façade, enduit. Garantie décennale, devis gratuit.',
      immediateSteps: [
        'Photographiez la fissure avec un repère de mesure',
        'Observez si la fissure évolue (pose d\'un témoin)',
        'Ne colmatez pas provisoirement sans diagnostic',
        'En cas de fissure structurelle : évacuez et appelez',
        'Prévenez votre assurance habitation',
        'Contactez VITFIX pour un diagnostic rapide',
      ],
      whenToCall: [
        'Fissure en escalier sur façade ou pignon',
        'Enduit qui se décolle en grandes plaques',
        'Infiltration d\'eau par la façade ou le mur',
        'Obligation de ravalement (arrêté municipal)',
        'Fissure qui s\'élargit rapidement',
        'Mur de clôture menaçant de tomber',
      ],
      avgResponseTime: '24 à 48 h (diagnostic)',
      schedule: 'Lun–Ven 8h–18h',
    },
    faqs: [
      {
        question: 'Le ravalement de façade est-il obligatoire à {city} ?',
        answer: 'Oui, à Marseille comme dans toutes les communes de France, le ravalement de façade est obligatoire tous les 10 ans (article L132-1 du Code de la Construction). Le maire peut imposer un ravalement par arrêté, notamment dans les secteurs sauvegardés. En copropriété, la décision est prise en assemblée générale. Le coût est déductible des revenus fonciers pour les bailleurs.',
      },
      {
        question: 'Quel est le prix d\'un ravalement de façade en PACA ?',
        answer: 'Le coût d\'un ravalement dépend du revêtement choisi et de l\'état initial. Comptez 35 à 80 €/m² pour un enduit monocouche projeté, 60 à 120 €/m² pour un enduit à la chaux (plus authentique et respirant), 80 à 150 €/m² pour une ITE (isolation thermique par l\'extérieur). Pour une maison de 100 m² de façade, prévoyez 4 000 à 10 000 €. Devis gratuit sur visite.',
      },
      {
        question: 'Quelles spécificités pour les façades en PACA (UV, mistral, embruns) ?',
        answer: 'Le climat méditerranéen impose des contraintes particulières : les UV intenses dégradent les peintures ordinaires en 5 ans (utilisez des peintures antisalissures et hydrofuges), le mistral génère des contraintes mécaniques sur l\'enduit (choisissez un enduit flexible), les embruns en bord de mer nécessitent des enduits résistants aux chlorures. Nous recommandons systématiquement une peinture anti-algues et un hydrofuge pour les propriétés côtières (La Ciotat, Cassis, Bandol, Sanary).',
      },
      {
        question: 'La rénovation de façade est-elle éligible à des aides financières ?',
        answer: 'L\'isolation thermique par l\'extérieur (ITE) lors d\'un ravalement est éligible à MaPrimeRénov (jusqu\'à 75 €/m²) et aux CEE. Le chantier doit être réalisé par un artisan RGE. Le ravalement seul (sans isolation) ne bénéficie pas d\'aide directe, mais est déductible des revenus fonciers. En copropriété, l\'Anah peut subventionner une partie si le syndicat répond aux critères.',
      },
    ],
  },

  // ── SERRURIER ─────────────────────────────────────────────────────────────────
  {
    name: 'Serrurier',
    slug: 'serrurier',
    icon: '🔐',
    metaTitle: 'Serrurier {city} — Ouverture porte, blindage, tarifs transparents | VITFIX',
    metaDesc: 'Serrurier de confiance à {city} : ouverture porte, changement serrure, urgence 24h. Tarifs transparents affichés, pas d\'arnaque. Devis gratuit.',
    heroTitle: 'Serrurier à {city} : Ouverture porte, serrure, tarifs clairs',
    heroSubtitle: 'Serruriers certifiés à {city} : ouverture de porte sans dégât, changement de serrure, installation porte blindée. Tarifs affichés, sans mauvaises surprises. Disponible 7j/7.',
    features: [
      'Ouverture de porte claquée ou bloquée (sans effraction)',
      'Remplacement et installation de serrures',
      'Installation porte blindée et multipoints',
      'Changement de cylindre après vol ou perte de clés',
      'Réparation de serrure coincée ou forcée',
      'Installation judas et chaînes de sécurité',
      'Ouverture coffre-fort',
      'Diagnostic de sécurité et conseil',
    ],
    problemsWeSolve: [
      'Porte d\'entrée claquée, clés oubliées à l\'intérieur',
      'Serrure forcée après tentative d\'effraction',
      'Clés perdues ou volées (changer le cylindre d\'urgence)',
      'Serrure coincée, clé qui tourne dans le vide',
      'Porte blindée à installer après un cambriolage',
      'Serrure vétuste non conforme à l\'assurance',
      'Porte de garage bloquée',
      'Judas ou interphone à installer',
    ],
    urgencyText: 'Enfermé dehors ou serrure forcée ? Nos serruriers interviennent en urgence à {city} sans surfacturation abusive.',
    urgencyData: {
      urgencyMetaTitle: 'Serrurier Urgence {city} — Ouverture porte 24h/7j',
      urgencyMetaDesc: 'Serrurier d\'urgence à {city} : ouverture porte, serrure forcée, cambriolage. Tarifs transparents affichés. Disponible 24h/24.',
      immediateSteps: [
        'Vérifiez que la porte n\'est pas simplement poussée sans être claquée',
        'Appelez votre bailleur ou syndic (ils ont souvent un double)',
        'En cas de cambriolage : appelez d\'abord le 17 (police)',
        'Demandez le tarif exact AVANT l\'intervention',
        'Exigez une facture détaillée à la fin',
        'Contactez VITFIX : tarifs affichés, pas d\'arnaque',
      ],
      whenToCall: [
        'Porte claquée, impossible d\'entrer chez soi',
        'Serrure forcée ou cylindre arraché après effraction',
        'Clés perdues ou volées (sécurité urgente)',
        'Serrure bloquée, impossible de tourner la clé',
        'Locataire entrant dans un nouveau logement (cylindre à changer)',
        'Porte dont la serrure est détraquée',
      ],
      avgResponseTime: '30 à 90 min',
      schedule: '7j/7, 24h/24',
    },
    faqs: [
      {
        question: 'Quel est le tarif d\'un serrurier à {city} ?',
        answer: 'L\'ouverture d\'une porte standard à {city} coûte entre 80 et 200 € en journée selon la complexité. Une ouverture de nuit ou le week-end : 150 à 350 €. Le changement de cylindre seul : 80 à 150 € (matériel inclus). La pose d\'une serrure multipoints : 300 à 600 €. Exigez TOUJOURS un devis écrit avant toute intervention. Si le serrurier refuse de donner un prix au téléphone, c\'est un signal d\'alarme.',
      },
      {
        question: 'Comment éviter les arnaques au serrurier à {city} ?',
        answer: 'Les arnaques au serrurier sont fréquentes en PACA : devis non fourni, factures gonflées à 1 500 €, pressions pour payer en liquide. Pour vous protéger à {city} : 1) Demandez le tarif complet (déplacement + main d\'œuvre + matériel) AVANT l\'arrivée. 2) N\'acceptez aucune intervention sans devis signé. 3) Payez par CB (trace bancaire). 4) Exigez une facture avec numéro de SIRET. 5) Vérifiez les avis Google. VITFIX pratique des tarifs transparents affichés.',
      },
      {
        question: 'Faut-il changer sa serrure après un cambriolage ou une perte de clés ?',
        answer: 'Oui, absolument. Après un cambriolage ou une perte de clés, il faut changer le cylindre de serrure dans les plus brefs délais — le cylindre seul suffit dans la plupart des cas, coût : 80 à 150 €. Choisissez un cylindre de classe A2P (certification anti-crochetage) : c\'est souvent une exigence de votre assurance habitation pour être couvert en cas de cambriolage.',
      },
      {
        question: 'Quelle serrure choisir pour une porte d\'entrée à {city} ?',
        answer: 'Nous recommandons une serrure multipoints (3 ou 5 points) avec cylindre certifié A2P. En zone côtière PACA, choisissez des pièces inox ou laitonnées pour résister à la corrosion marine. Les marques Vachette, Mul-T-Lock ou KABA offrent d\'excellents niveaux de sécurité. Une porte blindée peut également être envisagée après cambriolage.',
      },
      {
        question: 'Comment trouver un serrurier de confiance à {city} ?',
        answer: 'À {city} comme partout en PACA, les faux serruriers abusent des urgences. Pour trouver un artisan fiable : vérifiez qu\'il possède un numéro de SIRET valide, une assurance responsabilité civile, et des avis clients authentiques (Google, Pages Jaunes). Un vrai serrurier donne toujours le tarif complet avant d\'intervenir. VITFIX ne sélectionne que des serruriers certifiés avec tarifs affichés — aucune mauvaise surprise à la facturation.',
      },
    ],
  },

  // ── STORE BANNE & PERGOLA ─────────────────────────────────────────────────────
  {
    name: 'Store Banne & Pergola',
    slug: 'store-banne',
    icon: '⛱️',
    metaTitle: 'Store banne {city} — Installation, motorisation, réparation | VITFIX',
    metaDesc: 'Store banne à {city} : installation store terrasse, motorisation Somfy, réparation toile. Spécialiste stores PACA, devis gratuit sur mesure.',
    heroTitle: 'Store banne à {city} : Terrasse, motorisation, sur mesure',
    heroSubtitle: 'Installation et réparation de stores bannes à {city} : store coffre, store à bras, motorisation Somfy. Profitez de votre terrasse toute l\'année. Devis gratuit.',
    features: [
      'Installation store banne sur mesure (jusqu\'à 6 m)',
      'Store à bras articulés et store coffre',
      'Motorisation Somfy (commande murale, télécommande, appli)',
      'Détecteur vent et soleil (sécurité automatique)',
      'Remplacement toile de store banne',
      'Réparation store banne (mécanisme, bras, cassette)',
      'Pergola bioclimatique (lames orientables)',
      'Store vertical et store enrouleur extérieur',
    ],
    problemsWeSolve: [
      'Terrasse exposée soleil sans protection (été PACA 35–40°C)',
      'Store banne dont le mécanisme est coincé ou cassé',
      'Toile de store déchirée, décolorée ou moisie',
      'Store soufflé par le mistral (besoin détecteur vent)',
      'Terrasse sans protection pluie (pergola bioclimatique)',
      'Motorisation défaillante ou télécommande perdue',
      'Appartement ou restaurant avec façade à équiper',
      'Store manuel à motoriser',
    ],
    urgencyText: 'Store banne coincé ou cassé en plein été à {city} ? Nos techniciens interviennent rapidement pour vous rendre votre terrasse.',
    urgencyData: {
      urgencyMetaTitle: 'Réparation store banne {city} — Intervention rapide',
      urgencyMetaDesc: 'Réparation store banne à {city} : mécanisme bloqué, toile déchirée, motorisation HS. Technicien spécialisé, devis gratuit.',
      immediateSteps: [
        'Rentrez le store banne si le vent se lève (éviter la casse)',
        'Ne forcez pas sur un mécanisme coincé',
        'Photographiez les parties endommagées',
        'Notez la marque et le modèle du store si visible',
        'Contactez VITFIX pour intervention rapide',
      ],
      whenToCall: [
        'Store bloqué en position déployée avec vent',
        'Bras cassé ou déformé ne permettant plus l\'enroulement',
        'Toile déchirée ou décousue',
        'Motorisation ne répondant plus',
        'Store qui ne tient plus horizontal (déréglé)',
        'Coffre endommagé laissant entrer la pluie',
      ],
      avgResponseTime: '2 à 5 jours ouvrés',
      schedule: 'Lun–Sam 8h–18h',
    },
    faqs: [
      {
        question: 'Quel est le prix d\'un store banne à {city} et en PACA ?',
        answer: 'Un store banne à bras articulés standard (3 m de large) coûte entre 800 et 2 000 € installé. Avec motorisation Somfy : ajoutez 400 à 600 €. Un store coffre (mécanisme protégé) : 1 500 à 3 500 €. La pergola bioclimatique (12–20 m²) : 8 000 à 20 000 € selon les options. Le remplacement de toile seule : 200 à 600 €.',
      },
      {
        question: 'Quelle motorisation choisir pour un store banne en PACA (mistral) ?',
        answer: 'Pour la PACA, nous recommandons systématiquement une motorisation avec détecteur vent Somfy Eolis ou Sunis : le store rentre automatiquement dès que le vent dépasse le seuil programmé. C\'est indispensable avec le mistral. La motorisation Somfy io (connectée) permet aussi de rentrer le store depuis votre smartphone où que vous soyez — pratique si le vent se lève quand vous n\'êtes pas chez vous.',
      },
      {
        question: 'Un store banne résiste-t-il au mistral à {city} et sur la côte ?',
        answer: 'Sans motorisation avec détecteur de vent, un store banne peut être arraché ou endommagé par le mistral (qui peut dépasser 100 km/h). Avec un détecteur vent Somfy Eolis, le store se rentre automatiquement. Pour les zones très exposées (La Ciotat, Cassis, Bandol, Sanary), nous recommandons aussi des toiles technique anti-vent et des stores coffre qui protègent le mécanisme des intempéries.',
      },
      {
        question: 'Peut-on motoriser un store banne existant sans tout changer ?',
        answer: 'Oui, dans la grande majorité des cas, un store banne manuel peut être motorisé. Nous remplaçons l\'axe manuel par un moteur tubulaire Somfy et installons la commande (interrupteur mural, télécommande ou module connecté). Le coût est de 400 à 700 € selon le modèle. Cette opération prend généralement 2 à 3 heures. Nous vérifions la compatibilité lors d\'un devis sur place.',
      },
    ],
  },

  // ── VITRIER ───────────────────────────────────────────────────────────────────
  {
    name: 'Vitrier',
    slug: 'vitrier',
    icon: '🪟',
    metaTitle: 'Vitrier {city} — Remplacement vitre, double vitrage urgence | VITFIX',
    metaDesc: 'Vitrier à {city} : remplacement vitre cassée en urgence, double vitrage, menuiserie aluminium/PVC. Devis gratuit, intervention rapide 7j/7.',
    heroTitle: 'Vitrier à {city} : Vitre cassée, double vitrage, urgence',
    heroSubtitle: 'Vitriers disponibles à {city} pour remplacement de vitre cassée en urgence, pose de double vitrage, réparation fenêtre. Intervention rapide, devis gratuit.',
    features: [
      'Remplacement vitre cassée en urgence (même nuit)',
      'Pose double vitrage (fenêtre, porte, véranda)',
      'Vitrage de sécurité (feuilleté, trempé)',
      'Vitre anti-effraction (P2A, P4A)',
      'Remplacement fenêtre aluminium ou PVC',
      'Pose baie vitrée et porte vitrée',
      'Réparation joint et serrure de fenêtre',
      'Miroir sur mesure et vitre de meuble',
    ],
    problemsWeSolve: [
      'Vitre cassée (accident, caillou, tentative d\'effraction)',
      'Double vitrage brisé avec condensation entre les vitres',
      'Fenêtre qui ferme mal ou laisse passer le courant d\'air',
      'Vitre de porte d\'entrée brisée (sécurité)',
      'Pare-douche ou vitre de salle de bain cassée',
      'Fenêtre avec double vitrage ancien peu isolant',
      'Vitrine commerciale brisée (urgence)',
      'Véranda ou verrière à revitrager',
    ],
    urgencyText: 'Vitre cassée laissant le logement ouvert à {city} ? Nos vitriers interviennent en urgence avec bâchage provisoire immédiat.',
    urgencyData: {
      urgencyMetaTitle: 'Vitrier Urgence {city} — Vitre cassée 24h/7j',
      urgencyMetaDesc: 'Vitrier d\'urgence à {city} : vitre cassée, fenêtre brisée, effraction. Bâchage provisoire + remplacement rapide. Disponible 24h/24.',
      immediateSteps: [
        'Ramassez les éclats de verre avec des gants épais',
        'Ne laissez pas d\'enfants ou d\'animaux accéder à la zone',
        'Bâchez provisoirement la fenêtre (sac poubelle + adhésif)',
        'Photographiez les dégâts pour l\'assurance',
        'En cas d\'effraction : appelez le 17 avant le vitrier',
        'Contactez VITFIX pour intervention urgente et mise en sécurité',
      ],
      whenToCall: [
        'Vitre cassée laissant le logement ouvert (froid, insécurité)',
        'Double vitrage brisé ne pouvant plus fermer',
        'Vitre de porte d\'entrée brisée (sécurité)',
        'Vitrine commerciale brisée (pertes, vol)',
        'Vitre cassée après tentative d\'effraction',
        'Bris de glace par le mistral ou grêle',
      ],
      avgResponseTime: '1 à 3 h (urgence)',
      schedule: '7j/7, urgences 24h/24',
    },
    faqs: [
      {
        question: 'Quel est le tarif d\'un vitrier à {city}, La Ciotat ou Aubagne ?',
        answer: 'Le remplacement d\'une vitre simple standard (60×90 cm) coûte entre 80 et 180 € posé (déplacement + vitre + joint). Pour du double vitrage standard : 150 à 350 € selon la taille. Un vitrage de sécurité feuilleté (anti-effraction) : 200 à 500 €. En urgence de nuit, un supplément de 50 à 100 € peut s\'appliquer. Devis gratuit avant toute intervention.',
      },
      {
        question: 'Mon assurance habitation couvre-t-elle le bris de glace ?',
        answer: 'La garantie bris de glace est incluse dans la plupart des assurances habitation et couvre les vitres, miroirs, plaques de cuisson et vitrocéramique. La franchise est généralement de 50 à 100 €. Vous devez déclarer le sinistre sous 5 jours ouvrés. Nos vitriers établissent une facture détaillée acceptée par tous les assureurs.',
      },
      {
        question: 'Vaut-il mieux réparer ou remplacer une fenêtre à double vitrage en PACA ?',
        answer: 'Si seul le vitrage est cassé mais que la menuiserie est en bon état, on remplace uniquement le vitrage : 150 à 350 € selon la taille. Si la fenêtre a plus de 20 ans, que les joints sont dégradés ou que le mécanisme est usé, un remplacement complet (450 à 900 €) est plus rentable sur le long terme. En PACA, optez pour du double vitrage 4/16/4 argon qui offre une bonne isolation thermique et acoustique contre le mistral.',
      },
      {
        question: 'Existe-t-il des vitres anti-effraction recommandées en PACA ?',
        answer: 'Oui, pour les zones à risque (rez-de-chaussée, banlieue marseillaise), nous recommandons le vitrage feuilleté anti-effraction certifié P2A (résistance à l\'impact classe 2) ou P4A pour les vitrines. Le film de sécurité peut aussi être posé sur une vitre existante (80 à 150 €/m²) : il retarde l\'intrusion et protège des éclats. Une vitre P2A décourage la majorité des cambrioleurs opportunistes.',
      },
    ],
  },
  // ── MENUISIER ──────────────────────────────────────────────────────────────
  {
    name: 'Menuisier',
    slug: 'menuisier',
    icon: '🪚',
    metaTitle: 'Menuisier {city} — Portes, Fenêtres, Parquet | VITFIX',
    metaDesc: 'Menuisier à {city} disponible rapidement. Pose de portes, fenêtres, parquet, dressing. Artisans vérifiés VITFIX, devis gratuit. Menuiserie intérieure et extérieure.',
    heroTitle: 'Menuisier à {city} — Pose & Réparation',
    heroSubtitle: 'Portes, fenêtres, parquet, placards : un menuisier qualifié intervient à {city} rapidement.',
    features: [
      '🚪 Pose de portes intérieures et extérieures',
      '🪟 Installation de fenêtres et volets',
      '🌳 Pose de parquet massif et stratifié',
      '🗄️ Dressing, placards sur mesure',
      '🔧 Réparation de menuiseries existantes',
      '✅ Artisans assurés RC pro, devis gratuit',
    ],
    problemsWeSolve: [
      'Porte qui grince ou ferme mal',
      'Fenêtre qui ne ferme plus hermétiquement',
      'Parquet abîmé, rayé ou décollé',
      'Dressing ou placards à aménager',
      'Huisseries à remplacer après travaux',
      'Volets roulants ou battants défectueux',
    ],
    urgencyText: 'Porte claquée ou volet bloqué ? Nos menuisiers interviennent en urgence à {city}.',
    urgencyData: {
      urgencyMetaTitle: 'Menuisier urgence {city} — Intervention rapide | VITFIX',
      urgencyMetaDesc: 'Menuisier disponible en urgence à {city}. Porte coincée, fenêtre cassée, volet bloqué — intervention sous 2h. Devis immédiat.',
      immediateSteps: [
        'Sécurisez l\'accès si la porte ne ferme plus',
        'Ne forcez pas une fenêtre bloquée',
        'Photographiez les dégâts pour l\'assurance',
        'Appelez un menuisier VITFIX à {city}',
      ],
      whenToCall: [
        'Porte d\'entrée qui ne ferme plus',
        'Fenêtre cassée (pénétration d\'air ou pluie)',
        'Volet bloqué ou arraché par le vent',
        'Parquet décollé avec risque de chute',
      ],
      avgResponseTime: '2 à 4h',
      schedule: 'Lun–Sam 7h–20h, urgences 7j/7',
    },
    faqs: [
      {
        question: 'Quel est le tarif d\'un menuisier à {city} ?',
        answer: 'La pose d\'une porte intérieure coûte entre 150 € et 400 € (fourniture non comprise). Une fenêtre PVC double vitrage installée revient à 300 à 800 € selon les dimensions. La pose de parquet coûte 15 à 35 €/m² de main d\'œuvre. Un dressing sur mesure en menuiserie varie de 1 500 à 5 000 € selon la surface. VITFIX vous fournit un devis détaillé et gratuit avant toute intervention.',
      },
      {
        question: 'Faut-il un menuisier ou un serrurier pour une porte bloquée à {city} ?',
        answer: 'Cela dépend du problème : si la serrure est bloquée ou les clés perdues, appelez un serrurier. Si le problème vient du bâti (cadre tordu, gonds usés, porte qui frotte), c\'est le menuisier qu\'il faut contacter. Nos experts VITFIX à {city} peuvent diagnostiquer par téléphone quel professionnel est le plus adapté à votre situation.',
      },
      {
        question: 'Combien de temps prend la pose d\'un parquet à {city} ?',
        answer: 'La pose d\'un parquet dans une pièce de 20 m² prend généralement une journée complète (7 à 8h). Il faut parfois ajouter le temps de ponçage (½ journée) si le sous-plancher est irrégulier, et laisser 24h de séchage pour les colles. Un appartement complet (60 m²) nécessite en général 2 à 3 jours de travail.',
      },
      {
        question: 'Les menuisiers VITFIX de {city} travaillent-ils le week-end ?',
        answer: 'Oui, nos menuisiers partenaires à {city} proposent des interventions du lundi au samedi, et en urgence le dimanche. Les interventions hors horaires standard (soir, week-end, jours fériés) font l\'objet d\'une majoration de 25 à 50 % selon les artisans. Consultez les disponibilités directement sur VITFIX pour trouver un créneau adapté.',
      },
    ],
  },
  // ── RAMONEUR ──────────────────────────────────────────────────────────────
  {
    name: 'Ramoneur',
    slug: 'ramoneur',
    icon: '🏠',
    metaTitle: 'Ramoneur {city} — Ramonage Cheminée Certifié | VITFIX',
    metaDesc: 'Ramonage de cheminée à {city} par des ramoneurs certifiés. Obligatoire 1 à 2x/an pour votre assurance. Certificat de ramonage fourni. Devis gratuit.',
    heroTitle: 'Ramoneur à {city} — Ramonage & Entretien Cheminée',
    heroSubtitle: 'Ramonage obligatoire, entretien de cheminée et insert : un ramoneur certifié intervient à {city}.',
    features: [
      '🔥 Ramonage de cheminée traditionnelle',
      '🪨 Ramonage insert, poêle à bois et granulés',
      '📋 Certificat de ramonage pour assurance',
      '🔍 Diagnostic de l\'état du conduit',
      '🛡️ Pose de hérisson anti-oiseau',
      '✅ Ramoneurs certifiés, intervention assurée',
    ],
    problemsWeSolve: [
      'Ramonage annuel obligatoire non effectué',
      'Cheminée qui tire mal ou fume dans la pièce',
      'Conduit bouché (suie, nid d\'oiseau)',
      'Risque d\'incendie de conduit',
      'Certificat manquant pour l\'assurance',
      'Poêle à granulés à entretenir',
    ],
    urgencyText: 'Cheminée qui fume ou incendie de conduit ? Appelez un ramoneur d\'urgence à {city}.',
    urgencyData: {
      urgencyMetaTitle: 'Ramoneur urgence {city} — Incendie conduit, intervention rapide | VITFIX',
      urgencyMetaDesc: 'Ramoneur disponible en urgence à {city}. Cheminée qui fume, incendie de conduit, conduit bouché. Intervention 24h/24. Devis immédiat.',
      immediateSteps: [
        'En cas d\'incendie de conduit : appelez le 18 immédiatement',
        'Fermez le registre de la cheminée',
        'Évacuez la pièce si fumée importante',
        'Contactez un ramoneur VITFIX après sécurisation',
      ],
      whenToCall: [
        'Cheminée qui fume dans la pièce',
        'Conduit potentiellement bouché',
        'Avant la saison de chauffe (septembre–octobre)',
        'Pour obtenir un certificat pour l\'assurance',
      ],
      avgResponseTime: '24 à 48h (urgence : 4h)',
      schedule: 'Lun–Sam 8h–18h, urgences 7j/7',
    },
    faqs: [
      {
        question: 'Le ramonage est-il obligatoire à {city} ?',
        answer: 'Oui, le ramonage est obligatoire en France par arrêté préfectoral : 1 fois par an pour les cheminées à bois et inserts, 2 fois par an pour les conduits raccordés à des appareils fonctionnant au fioul ou au gaz. À {city}, comme dans toute la PACA, votre assureur peut refuser une indemnisation en cas d\'incendie si vous ne pouvez pas présenter un certificat de ramonage valide.',
      },
      {
        question: 'Combien coûte un ramonage à {city} ?',
        answer: 'Le prix d\'un ramonage standard à {city} varie entre 60 € et 120 € selon le type de conduit et la longueur. Le certificat de ramonage est inclus dans ce prix. Un poêle à granulés nécessite un entretien plus complet (vérification du brûleur, nettoyage) qui coûte 80 à 150 €. Le déplacement est généralement inclus dans le tarif pour les communes proches de {city}.',
      },
      {
        question: 'Quand faire ramoner sa cheminée à {city} ?',
        answer: 'Idéalement avant la saison de chauffe, en septembre ou octobre, pour être prêt pour l\'hiver. Évitez les périodes de pointe (novembre–décembre) où les ramoneurs sont surchargés et les délais s\'allongent. Si vous utilisez votre cheminée en été, prévoyez un second ramonage au printemps. Pour les appareils à gaz et fioul, deux ramonages par an sont obligatoires.',
      },
      {
        question: 'Le ramoneur VITFIX fournit-il un certificat accepté par les assurances à {city} ?',
        answer: 'Oui, tous nos ramoneurs partenaires à {city} sont des professionnels certifiés qui remettent un certificat de ramonage conforme, reconnu par toutes les compagnies d\'assurance. Ce document mentionne la date, l\'adresse, le type de conduit, et les travaux effectués. Conservez-le précieusement avec vos papiers d\'assurance habitation.',
      },
    ],
  },
  // ── PISCINISTE ──────────────────────────────────────────────────────────────
  {
    name: 'Pisciniste',
    slug: 'pisciniste',
    icon: '🏊',
    metaTitle: 'Pisciniste {city} — Entretien & Installation Piscine | VITFIX',
    metaDesc: 'Pisciniste à {city} pour l\'entretien, la réparation et l\'installation de piscines. Traitement eau, hivernage, fuite piscine. Devis gratuit, artisans vérifiés PACA.',
    heroTitle: 'Pisciniste à {city} — Entretien & Réparation Piscine',
    heroSubtitle: 'Entretien régulier, traitement de l\'eau, réparation de fuite : un pisciniste qualifié intervient à {city}.',
    features: [
      '💧 Entretien et traitement de l\'eau',
      '🔧 Réparation de fuites et équipements',
      '❄️ Hivernage et remise en route printanière',
      '🏗️ Installation de piscines neuves',
      '🌊 Rénovation de liner et carrelage piscine',
      '✅ Piscinistes certifiés, devis gratuit à {city}',
    ],
    problemsWeSolve: [
      'Eau verte ou trouble malgré le traitement',
      'Fuite de piscine (perte de niveau anormale)',
      'Pompe ou filtre en panne',
      'Hivernage ou remise en route de piscine',
      'Liner décollé ou déchiré',
      'Carrelage piscine à rénover',
    ],
    urgencyText: 'Fuite de piscine ou panne de pompe ? Nos piscinistes interviennent rapidement à {city}.',
    urgencyData: {
      urgencyMetaTitle: 'Pisciniste urgence {city} — Fuite piscine, panne pompe | VITFIX',
      urgencyMetaDesc: 'Pisciniste disponible rapidement à {city}. Fuite de piscine, pompe en panne, eau verte — intervention sous 24h. Devis immédiat.',
      immediateSteps: [
        'Coupez la pompe si elle fait un bruit anormal',
        'Mesurez la perte de niveau quotidienne pour évaluer la fuite',
        'Ne videz pas la piscine sans avis professionnel',
        'Appelez un pisciniste VITFIX à {city}',
      ],
      whenToCall: [
        'Perte de niveau supérieure à 2 cm/jour',
        'Eau verte ou trouble persistant',
        'Pompe, filtre ou robot en panne',
        'Liner décollé ou déchiré',
      ],
      avgResponseTime: '24 à 48h',
      schedule: 'Lun–Sam 8h–19h (saison : 7j/7)',
    },
    faqs: [
      {
        question: 'Combien coûte l\'entretien d\'une piscine à {city} ?',
        answer: 'Un contrat d\'entretien annuel pour une piscine de 40 m³ à {city} coûte entre 800 € et 2 000 € selon la fréquence des visites (hebdomadaire, bi-mensuelle) et les prestations incluses (produits chimiques, hivernage, remise en route). Une visite ponctuelle d\'entretien ou de traitement de l\'eau coûte 60 à 150 €. En PACA, la saison d\'utilisation étant plus longue, un contrat annuel est souvent plus économique.',
      },
      {
        question: 'Comment savoir si ma piscine à {city} a une fuite ?',
        answer: 'Le test du seau est simple : remplissez un seau d\'eau à niveau, placez-le sur la première marche de la piscine, laissez la pompe tourner 24h. Si la piscine baisse plus que le seau, il y a une fuite hydraulique. Si les deux baissent pareil, c\'est simplement de l\'évaporation (normale : 1 à 3 cm/semaine en été en PACA). En cas de doute, nos piscinistes à {city} réalisent un test d\'étanchéité complet.',
      },
      {
        question: 'Faut-il hiverner sa piscine à {city} ?',
        answer: 'Oui, même en PACA où les hivers sont doux, l\'hivernage est recommandé. À {city}, les températures peuvent descendre sous 5°C en janvier-février, ce qui risque d\'endommager les équipements. L\'hivernage actif (maintien d\'une filtration réduite avec produits hivernants) est préférable à l\'hivernage passif pour une piscine de PACA. Comptez 150 à 350 € pour un hivernage professionnel complet.',
      },
      {
        question: 'Quel traitement pour une eau verte dans une piscine à {city} ?',
        answer: 'L\'eau verte est due à une prolifération d\'algues causée par un déséquilibre chimique (pH, chlore) ou une filtration insuffisante. Le traitement comporte 4 étapes : 1. Choc chlore (hypochlorite) pour tuer les algues. 2. Traitement antialguicide. 3. Filtration continue 24h. 4. Rééquilibrage du pH entre 7,2 et 7,6. En PACA, la chaleur estivale accélère la prolifération : vérifiez le chlore 2x par semaine en juillet-août à {city}.',
      },
    ],
  },
]

// ── HELPERS ───────────────────────────────────────────────────────────────────

export function getFrCityBySlug(slug: string): FrCityData | null {
  return FR_CITIES.find(c => c.slug === slug) ?? null
}

export function getFrServiceBySlug(slug: string): FrServiceData | null {
  return FR_SERVICES.find(s => s.slug === slug) ?? null
}

export interface FrPageCombo {
  service: FrServiceData
  city: FrCityData
  slug: string
  nearbyCities: FrCityData[]
}

/** Returns all 32 service × city combos */
export function getAllFrPageCombos(): FrPageCombo[] {
  const combos: FrPageCombo[] = []
  for (const service of FR_SERVICES) {
    for (const city of FR_CITIES) {
      combos.push({
        service,
        city,
        slug: `${service.slug}-${city.slug}`,
        nearbyCities: city.nearbyCities
          .map(n => FR_CITIES.find(c => c.name === n))
          .filter((c): c is FrCityData => c !== undefined),
      })
    }
  }
  return combos
}

export function getFrPageCombo(slug: string): FrPageCombo | null {
  for (const service of FR_SERVICES) {
    for (const city of FR_CITIES) {
      if (`${service.slug}-${city.slug}` === slug) {
        return {
          service,
          city,
          slug,
          nearbyCities: city.nearbyCities
            .map(n => FR_CITIES.find(c => c.name === n))
            .filter((c): c is FrCityData => c !== undefined),
        }
      }
    }
  }
  return null
}

/** Urgency combos — same set as service combos */
export interface FrUrgencyCombo {
  service: FrServiceData
  city: FrCityData
  slug: string
}

export function getAllFrUrgencyCombos(): FrUrgencyCombo[] {
  return getAllFrPageCombos().map(c => ({
    service: c.service,
    city: c.city,
    slug: `${c.service.slug}-urgence-${c.city.slug}`,
  }))
}

export function getFrUrgencyCombo(slug: string): FrUrgencyCombo | null {
  for (const service of FR_SERVICES) {
    for (const city of FR_CITIES) {
      if (`${service.slug}-urgence-${city.slug}` === slug) {
        return { service, city, slug }
      }
    }
  }
  return null
}

// ── ARTICLES BLOG FR ──────────────────────────────────────────────────────────

export interface FrBlogArticle {
  slug: string
  title: string
  metaTitle: string
  metaDesc: string
  category: 'plomberie' | 'electricite' | 'peinture' | 'couverture' | 'serrurerie' | 'maconnerie' | 'renovation' | 'aides'
  icon: string
  datePublished: string
  intro: string
  sections: { heading: string; content: string }[]
  ctaText: string
  relatedServices: string[]
}

export const FR_BLOG_ARTICLES: FrBlogArticle[] = [
  {
    slug: 'plombier-pas-cher-marseille-eviter-arnaques',
    title: 'Plombier pas cher à Marseille : comment éviter les arnaques ?',
    metaTitle: 'Plombier pas cher à Marseille — Éviter les arnaques en 2026 | VITFIX',
    metaDesc: 'Comment trouver un plombier pas cher et fiable à Marseille ? Les arnaques les plus courantes et comment les éviter. Tarifs réels, conseils pratiques.',
    category: 'plomberie',
    icon: '🔧',
    datePublished: '2026-02-15',
    intro: 'Marseille est l\'une des villes de France où les arnaques aux faux plombiers sont les plus fréquentes. Des factures multipliées par 10, des interventions inutiles, des devis incompréhensibles — voici tout ce qu\'il faut savoir pour trouver un vrai plombier fiable et pas cher dans les Bouches-du-Rhône.',
    sections: [
      {
        heading: 'Les tarifs réels d\'un plombier à Marseille',
        content: 'Un plombier à Marseille facture en moyenne entre 60 € et 100 € HT de l\'heure. Une intervention simple (remplacement de robinet, décolmatage basique) coûte entre 80 € et 180 € tout compris. Un remplacement de chauffe-eau électrique 100L revient entre 350 € et 600 € posé. Si un plombier vous annonce 500 € pour un simple débouchage ou 1 500 € pour remplacer un joint, fuyez — c\'est une arnaque.'
      },
      {
        heading: 'Les 5 arnaques les plus courantes',
        content: '1. Le faux plombier de nuit : annonce des tarifs normaux mais majore ensuite de 300 % au moment de la facture. 2. Le devis verbal : jamais de trace écrite, la facture est astronomique. 3. La pièce cassée volontairement : le plombier casse quelque chose pour facturer une réparation supplémentaire. 4. Le produit miraculeux : vente de produits déboucheurs à 200 € pour un débouchage manuel qui vaut 80 €. 5. Le sous-traitant non déclaré : l\'artisan envoie quelqu\'un sans qualification ni assurance.'
      },
      {
        heading: 'Comment vérifier un plombier avant d\'appeler',
        content: 'Vérifiez toujours : le numéro SIRET (consultable sur societe.com), l\'attestation d\'assurance responsabilité civile professionnelle, les avis Google avec des commentaires détaillés. Demandez un devis écrit AVANT toute intervention. Sur VITFIX, tous nos plombiers sont vérifiés, assurés, et leurs tarifs sont affichés en toute transparence.'
      },
      {
        heading: 'Les aides disponibles pour la plomberie à Marseille',
        content: 'Certains travaux de plomberie liés à l\'économie d\'eau (remplacement de chauffe-eau thermodynamique, installation de mitigeur) peuvent bénéficier d\'aides de l\'Anah ou de la Métropole Aix-Marseille. Pour les chauffe-eau solaires, la prime CEE peut couvrir jusqu\'à 30 % du coût. Renseignez-vous avant de faire remplacer votre chauffe-eau.'
      },
    ],
    ctaText: 'Trouver un plombier vérifié à Marseille',
    relatedServices: ['plombier', 'debouchage-canalisation'],
  },
  {
    slug: 'prix-ravalement-facade-marseille-2026',
    title: 'Prix ravalement de façade à Marseille en 2026',
    metaTitle: 'Prix ravalement façade Marseille 2026 — Tarifs et devis | VITFIX',
    metaDesc: 'Combien coûte un ravalement de façade à Marseille en 2026 ? Tarifs détaillés par type de façade, aides disponibles, durée des travaux. Devis gratuit.',
    category: 'peinture',
    icon: '🎨',
    datePublished: '2026-01-20',
    intro: 'Le ravalement de façade est obligatoire tous les 10 ans en copropriété à Marseille selon le règlement sanitaire départemental. Mais combien ça coûte vraiment en 2026 dans les Bouches-du-Rhône ? Voici les tarifs détaillés et toutes les aides auxquelles vous pouvez prétendre.',
    sections: [
      {
        heading: 'Tarifs du ravalement à Marseille en 2026',
        content: 'Le coût d\'un ravalement de façade à Marseille varie entre 30 € et 80 € par m² selon le type de finition. Pour une maison individuelle de 120 m² de façade : comptez entre 3 600 € et 9 600 €. Pour une copropriété de 500 m² : entre 15 000 € et 40 000 €. Ces tarifs incluent l\'échafaudage, la préparation (nettoyage, décapage, traitement des fissures) et la finition (enduit, peinture ou crépi).'
      },
      {
        heading: 'Les types de finition et leurs prix',
        content: 'Peinture façade : 20 € à 35 €/m² — idéale pour les façades planes en bon état. Enduit monocouche : 25 € à 45 €/m² — recouvre les petites irrégularités. Crépi projeté : 30 € à 55 €/m² — robuste et résistant. Isolation thermique par l\'extérieur (ITE/capoto) : 80 € à 160 €/m² — le plus cher mais éligible aux aides MaPrimeRénov.'
      },
      {
        heading: 'Aides pour le ravalement à Marseille',
        content: 'Si le ravalement inclut une isolation thermique par l\'extérieur : MaPrimeRénov peut couvrir jusqu\'à 75 €/m² pour les ménages modestes (travaux réalisés par un artisan RGE). La Métropole Aix-Marseille-Provence propose également des aides pour la rénovation de façades en secteur sauvegardé (Vieux-Port, Panier, cours Julien). En copropriété, l\'Anah subventionne jusqu\'à 50 % pour les copropriétés en difficulté.'
      },
      {
        heading: 'Durée des travaux de ravalement',
        content: 'Une maison individuelle : 1 à 2 semaines. Un petit immeuble de 10 appartements : 3 à 6 semaines. Un grand immeuble en copropriété : 2 à 4 mois. La durée dépend aussi des conditions météo — à Marseille, le mistral peut ralentir la pose des enduits et peintures extérieures.'
      },
    ],
    ctaText: 'Obtenir un devis ravalement à Marseille',
    relatedServices: ['peintre', 'macon'],
  },
  {
    slug: 'maprimerenov-paca-comment-en-beneficier',
    title: 'MaPrimeRénov\' PACA : comment en bénéficier en 2026 ?',
    metaTitle: 'MaPrimeRénov\' PACA 2026 — Guide complet pour en bénéficier | VITFIX',
    metaDesc: 'Comment bénéficier de MaPrimeRénov\' en région PACA (Marseille, Aix, Toulon) ? Conditions, montants, artisans RGE agréés. Guide complet mis à jour 2026.',
    category: 'aides',
    icon: '💰',
    datePublished: '2026-01-10',
    intro: 'MaPrimeRénov\' est l\'aide principale de l\'État pour financer vos travaux de rénovation énergétique. En région PACA (Marseille, Aix-en-Provence, Toulon, Var), de nombreux propriétaires passent à côté de milliers d\'euros d\'aides faute d\'information. Voici le guide complet mis à jour pour 2026.',
    sections: [
      {
        heading: 'Qui peut bénéficier de MaPrimeRénov\' en PACA ?',
        content: 'Tout propriétaire (occupant ou bailleur) d\'un logement construit depuis plus de 15 ans peut demander MaPrimeRénov\'. Les locataires sont exclus. En 2026, le dispositif est accessible à tous les ménages, quel que soit leur revenu, avec des montants qui varient selon les ressources : de 25 % à 90 % du coût des travaux selon votre profil. Les copropriétés peuvent aussi déposer un dossier collectif.'
      },
      {
        heading: 'Quels travaux sont éligibles à Marseille ?',
        content: 'Isolation des combles ou toiture (jusqu\'à 75 €/m²), isolation des murs par l\'extérieur ou l\'intérieur (jusqu\'à 75 €/m²), pompe à chaleur air-eau ou géothermique (jusqu\'à 4 000 €), chauffe-eau thermodynamique (jusqu\'à 400 €), ventilation VMC double flux (jusqu\'à 550 €), isolation des fenêtres (jusqu\'à 100 €/fenêtre). Tous les travaux doivent être réalisés par un artisan certifié RGE.'
      },
      {
        heading: 'Comment faire la demande en PACA ?',
        content: 'La demande se fait en ligne sur maprimerenov.gouv.fr AVANT le début des travaux. Étapes : 1. Créez un compte sur le site. 2. Faites réaliser un audit énergétique si le montant total dépasse 5 000 €. 3. Obtenez des devis d\'artisans RGE. 4. Déposez la demande en ligne avec les devis. 5. Attendez l\'accord de l\'Anah. 6. Réalisez les travaux. 7. Transmettez les factures et recevez le versement.'
      },
      {
        heading: 'Artisans RGE à Marseille : où les trouver ?',
        content: 'Seuls les artisans certifiés RGE (Reconnu Garant de l\'Environnement) donnent droit aux aides. La liste officielle est sur france-renov.gouv.fr. Sur VITFIX, tous nos artisans partenaires éligibles aux travaux de rénovation énergétique affichent leur certification RGE sur leur profil. C\'est le moyen le plus simple de trouver un artisan qualifié et de comparer les devis.'
      },
    ],
    ctaText: 'Trouver un artisan RGE à Marseille',
    relatedServices: ['plaquiste', 'climatisation', 'couvreur'],
  },
  {
    slug: 'couvreur-urgence-marseille-tuiles-cassees',
    title: 'Couvreur urgence Marseille : que faire en cas de tuiles cassées ?',
    metaTitle: 'Couvreur urgence Marseille — Tuiles cassées, que faire ? | VITFIX',
    metaDesc: 'Tuiles cassées après le mistral à Marseille ? Infiltration d\'eau par le toit ? Que faire en urgence, qui appeler, quelles aides. Guide couvreur PACA.',
    category: 'couverture',
    icon: '🏠',
    datePublished: '2025-12-05',
    intro: 'Le mistral peut souffler à plus de 100 km/h à Marseille et dans les Bouches-du-Rhône. Résultat : des tuiles arrachées, des infiltrations soudaines, des dégâts des eaux. Que faire en urgence ? Comment trouver un couvreur fiable à Marseille qui intervient rapidement ?',
    sections: [
      {
        heading: 'Les premiers gestes d\'urgence en cas de tuiles cassées',
        content: 'Ne montez surtout pas sur le toit vous-même — les accidents de toiture sont extrêmement dangereux. À l\'intérieur : placez des bacs et des serviettes sous les zones d\'infiltration. Protégez vos meubles et équipements avec des bâches plastiques. Prenez des photos des dégâts immédiatement pour votre assurance. Coupez l\'électricité dans les zones touchées par l\'eau. Appelez votre assureur pour déclarer le sinistre dans les 5 jours ouvrables.'
      },
      {
        heading: 'Pourquoi les tuiles cassent-elles à Marseille ?',
        content: 'Le mistral est la principale cause : des vents violents peuvent arracher les tuiles mal fixées ou vieillissantes. Les toitures en tuiles romanes (très répandues en PACA) sont particulièrement sensibles si le mortier de fixation s\'est dégradé. Les variations thermiques importantes entre l\'été (40°C) et l\'hiver (gel possible) fissurent progressivement les tuiles les plus fragiles. Un entretien régulier (inspection annuelle, nettoyage du mousse) prévient la majorité des sinistres.'
      },
      {
        heading: 'Combien coûte la réparation de tuiles à Marseille ?',
        content: 'Le remplacement de quelques tuiles cassées coûte entre 150 € et 400 € (déplacement + matériaux + main d\'œuvre). Une réfection complète de toiture sur une maison de 100 m² varie de 8 000 € à 20 000 € selon le type de tuile et l\'état de la charpente. Une tuile romane standard coûte entre 1 € et 3 €, une tuile en terre cuite de qualité entre 3 € et 8 €.'
      },
      {
        heading: 'Votre assurance couvre-t-elle les tuiles cassées par le mistral ?',
        content: 'Oui, dans la grande majorité des cas. Les dommages causés par des vents supérieurs à 100 km/h (tempête) sont couverts par la garantie tempête de votre assurance multirisque habitation. Certains contrats couvrent dès 60 km/h. Déclarez le sinistre dans les 5 jours, conservez les photos des dégâts et la facture du couvreur — l\'assureur peut mandater un expert avant remboursement.'
      },
    ],
    ctaText: 'Trouver un couvreur d\'urgence à Marseille',
    relatedServices: ['couvreur'],
  },
  {
    slug: 'faux-serruriers-marseille-comment-les-reperer',
    title: 'Faux serruriers Marseille : comment les repérer et les éviter ?',
    metaTitle: 'Faux serruriers Marseille 2026 — Comment les repérer ? | VITFIX',
    metaDesc: 'Les faux serruriers pullulent à Marseille. Annonces mensongères, tarifs abusifs, interventions inutiles. Voici comment les identifier et trouver un vrai serrurier.',
    category: 'serrurerie',
    icon: '🔑',
    datePublished: '2025-11-18',
    intro: 'Marseille est tristement connue pour ses faux serruriers qui profitent des situations d\'urgence (porte claquée, serrure bloquée) pour facturer des sommes astronomiques. Des factures de 500 € à 2 000 € pour ouvrir une serrure standard, des menaces, des pressions — voici comment vous protéger.',
    sections: [
      {
        heading: 'Les techniques des faux serruriers à Marseille',
        content: 'Ils achètent des publicités Google en haut des résultats avec des numéros locaux (0491, 0413) mais opèrent depuis Paris ou à l\'étranger. Ils annoncent un tarif attractif au téléphone (50-80 €) puis multiplient par 5 ou 10 sur place. Ils prétextent des serrures "compliquées" ou des "dégâts irréparables" pour forcer le remplacement complet à prix exorbitant. Ils ne fournissent pas de devis écrit avant d\'intervenir. Leurs véhicules n\'ont souvent pas de marquage professionnel.'
      },
      {
        heading: 'Comment identifier un vrai serrurier ?',
        content: 'Vérifiez sur societe.com que la société a bien un siège social à Marseille ou dans les alentours. Un vrai serrurier possède un numéro SIRET valide, une assurance RC pro, et remet un devis écrit AVANT toute intervention. Il dispose d\'un véhicule sérigraphié au nom de l\'entreprise. Sur les annuaires officiels, il est référencé sous sa véritable raison sociale. Sur VITFIX, chaque serrurier a été vérifié : SIRET, assurance, avis clients authentiques.'
      },
      {
        heading: 'Que faire en cas de facture abusive ?',
        content: 'Refusez de payer si le montant est abusif — vous avez le droit de contester sur place. Demandez une facture détaillée. Saisissez la DGCCRF (Direction Générale de la Concurrence) via signal.conso.gouv.fr. Portez plainte au commissariat de police. Contactez votre assurance — certains contrats couvrent l\'assistance serrurerie. Vous pouvez également saisir le médiateur de la consommation.'
      },
      {
        heading: 'Les tarifs normaux d\'un serrurier à Marseille',
        content: 'Ouverture de porte standard (serrure 3 points normale) : 80 € à 150 € en journée. Le soir et weekend : majoration de 30 à 50 %. Remplacement d\'une serrure 3 points de qualité : 150 € à 350 € tout compris (serrure + main d\'œuvre). Cylindre seul (entretien) : 50 € à 100 €. Si on vous annonce 500 € pour une ouverture simple en journée, c\'est une arnaque.'
      },
    ],
    ctaText: 'Trouver un serrurier vérifié à Marseille',
    relatedServices: ['serrurier'],
  },
]

export function getFrBlogArticle(slug: string): FrBlogArticle | undefined {
  return FR_BLOG_ARTICLES.find(a => a.slug === slug)
}
