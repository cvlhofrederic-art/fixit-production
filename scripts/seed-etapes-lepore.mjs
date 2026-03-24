import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const AID = '745a1498-fbc7-4c99-9595-5a3dc1729de5'

const ETAPES = {
  'Élagage petit arbre (< 5m)': ['Diagnostic visuel et repérage des branches à traiter', 'Sécurisation du périmètre au sol', 'Taille sélective des branches mortes malades ou gênantes', 'Éclaircie du houppier', 'Ramassage des rémanents et nettoyage'],
  'Élagage grand arbre (10-20m)': ['Diagnostic préalable sur site', 'Sécurisation du périmètre et signalétique', 'Installation nacelle ou préparation grimpe', 'Élagage progressif du sommet vers la base', 'Descente contrôlée par rétention', 'Mastic cicatrisant sur coupes principales', 'Broyage des rémanents sur place', 'Évacuation en déchetterie agréée', 'Nettoyage et remise en état'],
  'Élagage très grand arbre (> 20m)': ['Étude préalable obligatoire', 'Plan d\'intervention et consignes de sécurité', 'Sécurisation élargie du périmètre', 'Ascension en grimpe avec EPI', 'Élagage par section depuis la cime', 'Descente par rétention', 'Tronçonnage et débit au sol', 'Broyage ou évacuation des rémanents', 'Nettoyage et remise en état'],
  'Élagage de palmier': ['Diagnostic de l\'état du palmier', 'Sécurisation du périmètre', 'Accès au sommet', 'Suppression des palmes sèches et pendantes', 'Nettoyage du stipe', 'Retrait des inflorescences et fruits', 'Inspection charançon rouge', 'Évacuation des déchets verts', 'Nettoyage du chantier'],
  'Abattage petit arbre (< 10m)': ['Évaluation de l\'arbre', 'Définition zone de chute et sécurisation', 'Entaille directionnelle et coupe d\'abattage', 'Chute contrôlée', 'Ébranchage et débit du tronc', 'Broyage ou mise en tas des rémanents', 'Nettoyage du chantier'],
  'Abattage arbre moyen (10-20m)': ['Diagnostic et étude des contraintes', 'Sécurisation élargie du périmètre', 'Choix de la méthode', 'Ébranchage progressif depuis le sommet', 'Descente contrôlée du tronc par sections', 'Tronçonnage et débit au sol', 'Broyage ou chargement des rémanents', 'Évacuation en déchetterie agréée', 'Nettoyage et remise en état'],
  'Abattage grand arbre (> 20m)': ['Étude préalable obligatoire', 'Plan d\'intervention et coordination équipe', 'Sécurisation du périmètre élargi', 'Ascension en grimpe avec EPI', 'Démontage par section depuis la cime', 'Descente contrôlée de chaque section', 'Tronçonnage et débit du fût au sol', 'Dessouchage si inclus', 'Évacuation complète des déchets', 'Nettoyage nivellement et remise en état'],
  'Dessouchage / Rognage de souche': ['Dégagement de la souche', 'Installation de la rogneuse', 'Rognage progressif', 'Comblement du trou avec les copeaux', 'Nivellement et nettoyage'],
  'Broyage de branches': ['Tri et regroupement des branches', 'Mise en place du broyeur', 'Broyage des rémanents', 'Étalement du broyat ou mise en tas', 'Nettoyage de la zone'],
  'Évacuation déchets verts': ['Regroupement et chargement des déchets verts', 'Transport vers la déchetterie agréée', 'Dépôt et bordereau'],
  'Scarification de pelouse': ['Tonte rase préalable', 'Scarification mécanique en passes croisées', 'Ramassage des déchets de scarification', 'Regarnissage avec semences adaptées', 'Terreautage léger si nécessaire', 'Roulage et arrosage'],
  'Tonte de pelouse': ['Tonte à hauteur adaptée selon la saison', 'Ramassage des déchets de tonte', 'Finitions des bordures au rotofil', 'Soufflage des allées et terrasses'],
  'Pose de gazon naturel (semis)': ['Désherbage et nettoyage du terrain', 'Labour ou motocultage', 'Nivellement et affinage du lit de semences', 'Semis à la volée ou au semoir', 'Ratissage léger', 'Roulage et premier arrosage'],
  'Pose de gazon en rouleaux': ['Préparation du sol', 'Apport de terre végétale si nécessaire', 'Pose des rouleaux en quinconce', 'Découpe des bords et ajustements', 'Roulage et arrosage abondant'],
  'Pose de gazon synthétique': ['Préparation du sol', 'Pose du géotextile anti-repousse', 'Déroulage et ajustement des lés', 'Découpe des contours et jonctions', 'Fixation et lestage', 'Brossage des fibres'],
  'Taille de haies': ['Protection du sol', 'Taille mécanique des faces latérales', 'Taille du dessus à hauteur définie', 'Ramassage et évacuation des déchets', 'Nettoyage de la zone'],
  'Taille de fruitiers': ['Diagnostic de l\'état de l\'arbre fruitier', 'Suppression du bois mort et des gourmands', 'Éclaircie des branches charpentières', 'Taille de fructification', 'Mastic cicatrisant sur coupes principales', 'Ramassage des déchets de taille'],
  'Taille d\'arbustes et rosiers': ['Choix du type de taille adapté', 'Suppression du bois mort et branches faibles', 'Taille de mise en forme ou rajeunissement', 'Ramassage des déchets', 'Nettoyage du pied'],
  'Entretien jardin': ['Tonte et finitions bordures', 'Désherbage des massifs et allées', 'Taille des haies et arbustes si nécessaire', 'Ramassage des déchets verts', 'Soufflage des allées et terrasses', 'Tour d\'inspection et signalement d\'anomalies'],
  'Désherbage et nettoyage massifs': ['Désherbage manuel ou mécanique', 'Binage et aération du sol', 'Paillage', 'Nettoyage et évacuation des déchets'],
  'Débroussaillage': ['Repérage de la zone et contraintes', 'Débroussaillage mécanique', 'Coupe de la végétation basse et ronces', 'Mise en tas et broyage des rémanents', 'Évacuation ou brûlage réglementaire si autorisé', 'Nettoyage final'],
  'Nettoyage de terrain': ['État des lieux et repérage des obstacles', 'Débroussaillage complet', 'Arrachage végétation indésirable', 'Évacuation des déchets verts et encombrants', 'Nivellement sommaire', 'Remise en état finale'],
  'Ramassage de feuilles': ['Soufflage vers les zones de collecte', 'Ramassage mécanique ou manuel', 'Chargement et évacuation', 'Nettoyage des allées et terrasses'],
  'Création de massifs / Plantations': ['Implantation et traçage selon le plan', 'Préparation du sol', 'Creusement des trous de plantation', 'Plantation et tuteurage si nécessaire', 'Arrosage de mise en place', 'Paillage'],
  'Création d\'allées et bordures': ['Traçage et délimitation', 'Décaissage du sol', 'Pose du géotextile', 'Pose des bordures', 'Mise en place du revêtement', 'Compactage et finitions'],
  'Aménagement paysager complet': ['Visite du site et relevé des contraintes', 'Conception du plan d\'aménagement', 'Validation du projet avec le client', 'Préparation du terrain', 'Réalisation des aménagements', 'Plantations selon le plan', 'Installation arrosage si prévu', 'Paillage et finitions', 'Réception des travaux avec le client'],
  'Installation arrosage automatique': ['Étude des besoins', 'Conception du plan de réseau', 'Tranchée et pose des canalisations', 'Installation des asperseurs / goutteurs', 'Raccordement et programmateur', 'Test et réglage de chaque zone', 'Rebouchage et remise en état'],
  'Traitement phytosanitaire': ['Diagnostic du problème', 'Choix du produit homologué', 'Préparation et dosage', 'Application par pulvérisation', 'Balisage de la zone', 'Compte-rendu au client'],
  'Traitement charançon rouge (palmier)': ['Diagnostic visuel', 'Choix du protocole', 'Injection par endothérapie dans le stipe', 'Traitement complémentaire si nécessaire', 'Planification du suivi', 'Déclaration DRAAF si infestation confirmée'],
  'Entretien copropriété / Espaces verts': ['Visite du site et état des lieux', 'Cahier des charges avec le syndic', 'Planification du calendrier d\'intervention', 'Interventions régulières selon contrat', 'Compte-rendu après chaque passage', 'Bilan annuel et ajustement'],
  'Devis': ['Prise de rendez-vous', 'Déplacement sur site', 'Diagnostic et relevé des besoins', 'Chiffrage et rédaction du devis', 'Envoi au client'],
  'Élagage': ['Diagnostic visuel et évaluation sanitaire', 'Sécurisation et balisage du périmètre', 'Mise en place du matériel', 'Taille raisonnée selon les règles de l\'art', 'Descente contrôlée des branches', 'Broyage des rémanents sur place', 'Nettoyage de la zone'],
}

async function run() {
  const { data: services } = await sb.from('services').select('id, name').eq('artisan_id', AID)
  let total = 0
  for (const svc of services) {
    const { data: existing } = await sb.from('service_etapes').select('id').eq('service_id', svc.id).limit(1)
    if (existing && existing.length > 0) { console.log('SKIP:', svc.name); continue }
    const etapes = ETAPES[svc.name]
    if (!etapes) { console.log('NO MATCH:', svc.name); continue }
    const rows = etapes.map((d, i) => ({ service_id: svc.id, ordre: i + 1, designation: d }))
    const { error } = await sb.from('service_etapes').insert(rows)
    if (error) console.log('ERROR:', svc.name, error.message)
    else { console.log('OK:', svc.name, '->', rows.length, 'etapes'); total += rows.length }
  }
  console.log('---\nTotal inserted:', total)
}
run()
