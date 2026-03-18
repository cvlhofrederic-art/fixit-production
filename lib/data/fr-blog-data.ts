// ──────────────────────────────────────────────────────────────────────────────
// lib/fr-blog-data.ts
// Données articles blog FR — SEO programmatique marché France
// ──────────────────────────────────────────────────────────────────────────────

export interface FrBlogArticle {
  slug: string
  title: string
  metaTitle: string
  metaDesc: string
  category: string
  icon: string
  emoji: string
  date: string
  datePublished: string
  intro: string
  sections: { heading: string; content: string }[]
  ctaText: string
  relatedServices: string[]
}

export const FR_BLOG_ARTICLES: FrBlogArticle[] = [
  {
    slug: 'choisir-artisan',
    title: 'Comment bien choisir son artisan ?',
    metaTitle: 'Comment bien choisir son artisan ? | Guide Vitfix 2026',
    metaDesc: 'SIRET, assurance RC Pro, avis clients... Découvrez les 5 critères indispensables pour choisir un artisan fiable et éviter les arnaques.',
    category: 'Conseils',
    icon: '🔍',
    emoji: '🔍',
    date: '10 février 2026',
    datePublished: '2026-02-10',
    intro: 'SIRET, assurance RC Pro, avis clients... Voici les 5 critères indispensables pour ne pas se tromper quand on fait appel à un professionnel du bâtiment.',
    sections: [
      {
        heading: 'Vérifiez le numéro SIRET de l\'artisan',
        content: 'Le numéro SIRET est la carte d\'identité de l\'entreprise. Il prouve que l\'artisan est bien enregistré et en activité. Vous pouvez le vérifier gratuitement sur le site de l\'INSEE ou sur societe.com. Un artisan sans SIRET valide est un signal d\'alarme majeur : ne signez jamais un devis dans ce cas.',
      },
      {
        heading: 'Demandez l\'attestation d\'assurance RC Pro',
        content: 'L\'assurance Responsabilité Civile Professionnelle est obligatoire pour tous les artisans du bâtiment. Elle vous protège en cas de dommage causé pendant les travaux. Demandez systématiquement une copie de l\'attestation en cours de validité avant de signer quoi que ce soit. Si l\'artisan refuse, passez votre chemin.',
      },
      {
        heading: 'Consultez les avis clients vérifiés',
        content: 'Les avis Google, les recommandations sur les plateformes spécialisées et le bouche-à-oreille restent les meilleurs indicateurs de fiabilité. Méfiez-vous des profils avec uniquement des avis 5 étoiles sans commentaires détaillés. Privilégiez les artisans avec des avis circonstanciés mentionnant le type de travaux réalisés.',
      },
      {
        heading: 'Comparez au moins 3 devis détaillés',
        content: 'Ne signez jamais le premier devis reçu. Demandez au minimum 3 devis pour pouvoir comparer les prix, les délais et les prestations incluses. Un bon devis doit détailler chaque poste : main-d\'oeuvre, fournitures, TVA applicable, durée estimée et conditions de paiement.',
      },
      {
        heading: 'Vérifiez les qualifications et labels',
        content: 'Les labels RGE (Reconnu Garant de l\'Environnement), Qualibat ou Qualifelec sont des gages de compétence. Ils permettent aussi de bénéficier d\'aides financières comme MaPrimeRénov\'. Vérifiez la validité du label sur le site officiel de l\'organisme certificateur.',
      },
    ],
    ctaText: 'Trouvez un artisan vérifié près de chez vous',
    relatedServices: ['plomberie', 'electricite', 'peinture'],
  },
  {
    slug: 'urgence-plomberie',
    title: 'Fuite d\'eau : que faire en urgence ?',
    metaTitle: 'Fuite d\'eau urgente : que faire ? Guide pas-à-pas | Vitfix',
    metaDesc: 'Coupez l\'eau, identifiez la source, contactez un plombier. Notre guide pas-à-pas pour limiter les dégâts en cas de fuite d\'eau.',
    category: 'Urgence',
    icon: '🔧',
    emoji: '🔧',
    date: '2 février 2026',
    datePublished: '2026-02-02',
    intro: 'Coupez l\'eau, identifiez la source, contactez un plombier. Notre guide pas-à-pas pour limiter les dégâts en cas de fuite d\'eau chez vous.',
    sections: [
      {
        heading: 'Coupez immédiatement l\'arrivée d\'eau',
        content: 'Le premier réflexe est de fermer le robinet d\'arrêt général. Il se trouve généralement dans votre compteur d\'eau (souvent dans un placard technique ou à l\'entrée du logement). En coupant l\'eau, vous limitez immédiatement les dégâts. Si vous ne trouvez pas le robinet, appelez votre gardien ou le service des eaux de votre commune.',
      },
      {
        heading: 'Protégez vos biens et coupez l\'électricité si nécessaire',
        content: 'Si la fuite est importante et que l\'eau s\'approche des prises électriques ou du tableau électrique, coupez le disjoncteur principal par sécurité. Déplacez vos objets de valeur, documents importants et appareils électroniques hors de la zone inondée. Utilisez des serpillières et des bassines pour contenir l\'eau.',
      },
      {
        heading: 'Identifiez la source de la fuite',
        content: 'Essayez de localiser l\'origine : robinet qui goutte, tuyau percé, joint usé, ballon d\'eau chaude qui fuit, WC qui déborde... Cette information sera précieuse pour le plombier et lui permettra d\'intervenir plus rapidement avec le bon matériel. Prenez des photos pour votre assurance.',
      },
      {
        heading: 'Contactez un plombier d\'urgence',
        content: 'Faites appel à un plombier professionnel dès que possible. Précisez la nature de la fuite et son emplacement pour qu\'il puisse préparer son intervention. Sur Vitfix, vous pouvez trouver un plombier disponible près de chez vous en quelques clics, avec des tarifs transparents et des avis vérifiés.',
      },
      {
        heading: 'Déclarez le sinistre à votre assurance',
        content: 'Contactez votre assurance habitation dans les 5 jours ouvrés suivant le sinistre. Envoyez un courrier recommandé avec accusé de réception décrivant les circonstances et les dégâts. Conservez toutes les factures du plombier et les photos des dommages. Votre assurance pourra mandater un expert si les dégâts sont importants.',
      },
    ],
    ctaText: 'Trouvez un plombier d\'urgence maintenant',
    relatedServices: ['plomberie'],
  },
  {
    slug: 'renovation-appartement',
    title: 'Rénover son appartement : par où commencer ?',
    metaTitle: 'Rénover son appartement : guide complet 2026 | Vitfix',
    metaDesc: 'Avant d\'appeler les artisans, établissez un plan de travaux cohérent. Nos experts vous guident étape par étape pour votre rénovation.',
    category: 'Rénovation',
    icon: '🏠',
    emoji: '🏠',
    date: '25 janvier 2026',
    datePublished: '2026-01-25',
    intro: 'Avant d\'appeler les artisans, établissez un plan de travaux cohérent. Nos experts vous guident étape par étape pour réussir votre rénovation.',
    sections: [
      {
        heading: 'Faites un diagnostic complet de votre logement',
        content: 'Avant toute chose, évaluez l\'état général de votre appartement : électricité, plomberie, isolation, menuiseries, revêtements. Un diagnostic vous permet de prioriser les travaux et d\'anticiper les mauvaises surprises. Si votre logement a plus de 15 ans, pensez au diagnostic de performance énergétique (DPE) pour identifier les postes énergivores.',
      },
      {
        heading: 'Établissez un budget réaliste',
        content: 'Le coût moyen d\'une rénovation complète se situe entre 800 et 1 500 euros/m\u00b2 selon l\'ampleur des travaux. Prévoyez une marge de 10 à 15 % pour les imprévus, qui sont fréquents en rénovation. Renseignez-vous sur les aides disponibles : MaPrimeRénov\', éco-PTZ, TVA réduite à 5,5 % pour les travaux d\'amélioration énergétique.',
      },
      {
        heading: 'Respectez l\'ordre logique des travaux',
        content: 'L\'ordre classique est : démolition et gros oeuvre, puis électricité et plomberie (avant de refermer les murs), puis isolation et cloisonnement, puis revêtements sols et murs, et enfin les finitions. Inverser cet ordre peut coûter très cher en reprises. Un maître d\'oeuvre peut coordonner les différents corps de métier.',
      },
      {
        heading: 'Choisissez des artisans qualifiés',
        content: 'Pour chaque lot de travaux (plomberie, électricité, peinture...), demandez au moins 3 devis. Vérifiez les assurances, les qualifications et les références. Sur Vitfix, tous les artisans sont vérifiés et notés par de vrais clients. Cela vous fait gagner un temps précieux dans votre recherche.',
      },
      {
        heading: 'Anticipez les autorisations nécessaires',
        content: 'En copropriété, certains travaux nécessitent l\'accord de l\'assemblée générale : modification des parties communes, changement d\'aspect extérieur, déplacement de cloisons porteuses. Déposez une déclaration préalable en mairie si vous modifiez l\'aspect extérieur. Pour les travaux lourds, un permis de construire peut être nécessaire.',
      },
    ],
    ctaText: 'Trouvez des artisans pour votre rénovation',
    relatedServices: ['plomberie', 'electricite', 'peinture', 'plaquiste'],
  },
  {
    slug: 'isolation-thermique',
    title: 'Isolation thermique : les aides disponibles en 2026',
    metaTitle: 'Aides isolation thermique 2026 : MaPrimeRénov\', éco-PTZ | Vitfix',
    metaDesc: 'MaPrimeRénov\', éco-PTZ, TVA à 5,5 %... Tout ce qu\'il faut savoir sur les aides financières pour vos travaux d\'isolation en 2026.',
    category: 'Financement',
    icon: '❄️',
    emoji: '❄️',
    date: '18 janvier 2026',
    datePublished: '2026-01-18',
    intro: 'MaPrimeRénov\', éco-PTZ, TVA à 5,5 %... Tout ce qu\'il faut savoir sur les aides à l\'isolation thermique en 2026.',
    sections: [
      {
        heading: 'MaPrimeRénov\' : l\'aide principale en 2026',
        content: 'MaPrimeRénov\' est accessible à tous les propriétaires, sans condition de revenus. Le montant de l\'aide dépend de vos revenus et du gain énergétique obtenu. Pour l\'isolation des murs par l\'extérieur, l\'aide peut atteindre 75 euros/m\u00b2 pour les ménages modestes. La demande se fait en ligne sur le site officiel avant le début des travaux.',
      },
      {
        heading: 'L\'éco-prêt à taux zéro (éco-PTZ)',
        content: 'L\'éco-PTZ permet d\'emprunter jusqu\'à 50 000 euros sans intérêts pour financer vos travaux de rénovation énergétique. Il est cumulable avec MaPrimeRénov\' et les autres aides. La durée de remboursement peut aller jusqu\'à 20 ans. Tous les établissements bancaires conventionnés peuvent vous le proposer.',
      },
      {
        heading: 'La TVA réduite à 5,5 %',
        content: 'Les travaux d\'amélioration de la performance énergétique bénéficient d\'un taux de TVA réduit à 5,5 % au lieu de 20 %. Cette réduction s\'applique automatiquement sur le devis de l\'artisan pour les logements de plus de 2 ans. Cela représente une économie significative, surtout pour les gros chantiers d\'isolation.',
      },
      {
        heading: 'Les Certificats d\'Économie d\'Énergie (CEE)',
        content: 'Les CEE sont des primes versées par les fournisseurs d\'énergie (EDF, Engie, TotalEnergies...) pour inciter aux travaux d\'économie d\'énergie. Le montant varie selon le type de travaux et votre zone géographique. Ces primes sont cumulables avec MaPrimeRénov\' et l\'éco-PTZ. Comparez les offres des différents fournisseurs.',
      },
      {
        heading: 'L\'obligation d\'un artisan RGE',
        content: 'Pour bénéficier de ces aides, vous devez obligatoirement faire appel à un artisan certifié RGE (Reconnu Garant de l\'Environnement). Cette certification garantit la compétence de l\'artisan en matière de travaux énergétiques. Vérifiez la validité du label sur le site France Rénov\' avant de signer votre devis.',
      },
    ],
    ctaText: 'Trouvez un artisan RGE près de chez vous',
    relatedServices: ['plomberie', 'electricite'],
  },
  {
    slug: 'electricite-normes',
    title: 'Mise aux normes électriques : ce que dit la loi',
    metaTitle: 'Normes électriques 2026 : NF C 15-100, obligations | Vitfix',
    metaDesc: 'Norme NF C 15-100, diagnostics obligatoires, travaux exigés lors de la vente... Tout savoir sur la mise aux normes électriques en 2026.',
    category: 'Réglementation',
    icon: '⚡',
    emoji: '⚡',
    date: '10 janvier 2026',
    datePublished: '2026-01-10',
    intro: 'Norme NF C 15-100, diagnostics obligatoires, travaux exigés lors de la vente... On fait le point sur la mise aux normes électriques.',
    sections: [
      {
        heading: 'La norme NF C 15-100 : le standard de référence',
        content: 'La norme NF C 15-100 définit les règles d\'installation électrique dans les logements neufs et les rénovations lourdes. Elle impose un nombre minimum de prises par pièce, la présence d\'un disjoncteur différentiel 30 mA, la mise à la terre de toute l\'installation et des circuits spécialisés pour le four, le lave-linge et les plaques de cuisson.',
      },
      {
        heading: 'Le diagnostic électrique obligatoire',
        content: 'Lors de la vente d\'un logement dont l\'installation électrique a plus de 15 ans, un diagnostic électrique est obligatoire. Il est valable 3 ans pour la vente et 6 ans pour la location. Le diagnostic est réalisé par un diagnostiqueur certifié qui vérifie 87 points de contrôle. En cas d\'anomalies, le vendeur doit informer l\'acheteur.',
      },
      {
        heading: 'Les 6 points de sécurité indispensables',
        content: 'Le Consuel (Comité national pour la sécurité des usagers de l\'électricité) identifie 6 points critiques : la présence d\'un appareil général de commande et de protection, une prise de terre et son circuit, un dispositif différentiel de sensibilité appropriée, des protections contre les surintensités, l\'absence de matériels vétustes et inadaptés, et les protections mécaniques des conducteurs.',
      },
      {
        heading: 'Les travaux les plus courants',
        content: 'Les mises aux normes les plus fréquentes concernent : le remplacement d\'un tableau électrique vétuste (500 à 2 000 euros), l\'ajout de prises de terre (800 à 1 500 euros), le passage en différentiel 30 mA (200 à 500 euros par circuit) et le remplacement de prises et interrupteurs non conformes. Un électricien qualifié établira un devis détaillé.',
      },
      {
        heading: 'Qui peut réaliser les travaux ?',
        content: 'Les travaux électriques doivent être réalisés par un électricien qualifié, idéalement certifié Qualifelec. Après les travaux, un certificat de conformité Consuel peut être exigé, notamment pour les rénovations complètes. Sur Vitfix, trouvez facilement un électricien vérifié et assuré pour votre mise aux normes.',
      },
    ],
    ctaText: 'Trouvez un électricien qualifié',
    relatedServices: ['electricite'],
  },
  {
    slug: 'devis-travaux',
    title: 'Comment lire un devis de travaux ?',
    metaTitle: 'Comment lire un devis de travaux ? Guide complet | Vitfix',
    metaDesc: 'Prix HT/TTC, TVA applicable, délai d\'exécution, garanties... Ne signez plus sans comprendre chaque ligne de votre devis de travaux.',
    category: 'Conseils',
    icon: '📄',
    emoji: '📄',
    date: '3 janvier 2026',
    datePublished: '2026-01-03',
    intro: 'Prix HT/TTC, TVA applicable, délai d\'exécution, garanties... Ne signez plus sans comprendre chaque ligne de votre devis.',
    sections: [
      {
        heading: 'Les mentions obligatoires du devis',
        content: 'Un devis légal doit comporter : les coordonnées complètes de l\'artisan (nom, adresse, SIRET), vos coordonnées en tant que client, la date du devis, la description détaillée de chaque prestation, le prix unitaire et le prix total HT et TTC, le taux de TVA applicable, la durée de validité de l\'offre et les conditions de paiement.',
      },
      {
        heading: 'Comprendre la différence HT et TTC',
        content: 'Le prix HT (Hors Taxes) est le prix avant TVA. Le prix TTC (Toutes Taxes Comprises) est ce que vous payez réellement. La TVA standard est de 20 %, mais elle peut être réduite à 10 % pour les travaux d\'entretien dans les logements de plus de 2 ans, ou à 5,5 % pour les travaux d\'amélioration énergétique. Vérifiez toujours que le bon taux est appliqué.',
      },
      {
        heading: 'Fournitures et main-d\'oeuvre : deux postes distincts',
        content: 'Un bon devis sépare clairement le coût des fournitures (matériaux, pièces) et le coût de la main-d\'oeuvre. Cela vous permet de comparer les prix des matériaux avec ceux du commerce et de négocier si nécessaire. Certains artisans incluent les fournitures dans un forfait global, ce qui rend la comparaison plus difficile.',
      },
      {
        heading: 'Les garanties à vérifier',
        content: 'Le devis doit mentionner les garanties applicables : garantie de parfait achèvement (1 an), garantie biennale sur les équipements (2 ans) et garantie décennale pour le gros oeuvre (10 ans). Vérifiez que l\'artisan dispose bien d\'une assurance décennale en cours de validité. Ces garanties vous protègent après la fin des travaux.',
      },
      {
        heading: 'Quand et comment signer un devis ?',
        content: 'Prenez le temps de comparer plusieurs devis avant de vous engager. Une fois signé, le devis a valeur de contrat : il engage les deux parties sur le contenu, le prix et les délais. Inscrivez la mention "Bon pour accord" suivie de la date et de votre signature. Conservez un exemplaire. Attention : un acompte supérieur à 30 % avant le début des travaux est un signal d\'alerte.',
      },
    ],
    ctaText: 'Demandez des devis gratuits sur Vitfix',
    relatedServices: ['plomberie', 'electricite', 'peinture', 'plaquiste'],
  },
]

export function getFrBlogArticle(slug: string): FrBlogArticle | undefined {
  return FR_BLOG_ARTICLES.find(a => a.slug === slug)
}
