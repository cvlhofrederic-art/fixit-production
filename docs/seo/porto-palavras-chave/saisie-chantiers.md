# Saisie des chantiers : ce qui ouvre les pages des villes

Date : 21/10/2026. Pour qui : Frédéric (envoi) et Claude Code (saisie).

## Pourquoi

Google refuse les pages par ville où seul le nom change (« doorway abuse »). Il accepte une page par ville quand elle contient du vrai contenu local. Le guide `consignes-google-2026-10-19.md` (section 4.4) fixe les conditions. Sur vitfix.io, une page `/pt/servicos/limpeza-de-telhados-{concelho}/` s'ouvre quand **les trois** sont réunies :

1. **un chantier complet** dans ce concelho : photo décrite, freguesia ou lieu-dit, problème trouvé, ce qu'on a fait ;
2. **une information propre au lieu** : une particularité du concelho que tu as constatée, ou un deuxième chantier détaillé (lieu, problème, solution) ;
3. **ma relecture** des 7 tests du guide (ville interchangeable, série, comparaison…), notée avec sa date. Je n'ouvre ainsi que quelques pages à la fois, comme le recommande le guide (section 4.6).

Le guide pose une condition de plus, que le code ne vérifie pas : la fiche Google Business Profile déclare ce concelho dans sa zone (section 4.4, condition 1). Si le concelho n'est pas parmi les 20 zones de la fiche (`fiche-google-business-profile.md`, point 3 bis : par exemple Paços de Ferreira, Santo Tirso, Trofa, Póvoa de Varzim, Ovar ou Águeda), échange-le d'abord dans la fiche contre une des zones choisies pour leur population qui n'a pas de page concelho (règle d'échange au point 3 bis) ; je n'ouvre la page qu'une fois l'échange fait.

Tant qu'un concelho n'a pas sa page, ses recherches arrivent sur la page du district (`/pt/servicos/limpeza-de-telhados/`) et sur les pages telhador et impermeabilização du concelho, qui la lient. Les 6 chantiers les plus récents apparaissent aussi sur la page du district, avec leur freguesia : c'est ainsi que les villages sont nommés, par de vrais travaux, sans liste de villes.

## Ce qu'il faut m'envoyer (un message par chantier)

Exemple fictif, pour le format seulement. Ne pas saisir ni publier :

```
Concelho : <concelho>
Freguesia ou lieu-dit (nom tel qu'on l'écrit sur place) : <freguesia>
Mois des travaux : <MM/AAAA>
Travaux : <lavagem e impermeabilização do telhado / limpeza de caleiras / pintura de telhas…>
Surface (facultatif) : <m²>
Problème trouvé : <ex. musgo espesso, caleiras entupidas, telhas desbotadas>
Ce qu'on a fait : <ex. lavagem com produto para telhas e hidrofugante>
Accès : <échafaudage / cordes>
Photo : une seule, l'« après », jointe au message
Ce que montre la photo : <ex. telhado cerâmico depois da lavagem>
```

Et, une fois par concelho (facultatif mais utile) :

```
Particularité du concelho : <une phrase sur ce qui est fréquent dans ce concelho et que tu as constaté toi-même,
par ex. « muitos telhados antigos são de lousa »>
```

Je rédige cette phrase en portugais et je te la fais valider. Ce qui ne concerne qu'un chantier va dans « Problème trouvé » ou « Ce qu'on a fait ».

Règles :

- **Seulement des chantiers réels**, faits par ton équipe. Jamais de chantier inventé ou « type » : c'est la règle 0.2 du plan SEO, et Google sanctionne les fausses informations sur une entreprise.
- **Photo** : la tienne, nette, sans filtre, sans texte ni logo incrusté, sans visage ni numéro de maison lisible. Avant de la mettre en ligne, je retire ses métadonnées (position GPS, appareil) et je la redimensionne. Dis-moi où tu la déposes (dossier, chemin) : une image collée dans la conversation n'est pas un fichier que je peux copier.
- **Nom du client** : jamais sans son accord écrit (`consentimento_nome`).
- **Avis d'un client** : seulement avec son autorisation écrite. Il s'affiche alors comme texte sur la page du concelho (pas d'étoiles Google sur ton propre site).

## Comment je le saisis

Dans `data/seo/local-proof.json` (format complet : `docs/seo/phase-3-donnees-reelles.md`, section 3 bis). Exemple fictif, pour le format seulement :

```json
{ "cidade": "<slug-do-concelho>", "metier": "limpeza-de-telhados", "tipo": "<tipo de trabalho>", "quantidade": "<m²>", "mes": "<AAAA-MM>", "freguesia": "<freguesia>", "problema": "<o que encontrámos>", "solucao": "<o que fizemos>", "acesso": "corda", "foto": "/images/chantiers/limpeza-de-telhados/<ficheiro>.jpg", "foto_alt": "<o que mostra a foto>", "publicado": "<AAAA-MM-JJ>" }
```

- `publicado` est le **jour de la mise en production** (pas le jour de saisie). Je l'aligne au jour de la fusion, comme les autres dates du plan. Une modification visible plus tard (photo, texte) se note dans `atualizado`.
- La particularité du concelho va dans `notas_concelho` (une phrase complète de plus de 20 caractères), avec sa date `publicado`.
- Ma relecture va dans `revisoes_concelho` (`revisto` = jour de la mise en production). Sans elle, la page ne s'ouvre pas.

## Ce qui se passe ensuite

0. Je prépare la saisie dans une PR. Tu la fusionnes, le site est reconstruit et déployé.
1. Le chantier s'affiche sur la page du district s'il fait partie des 6 plus récents, avec sa freguesia.
2. Quand les trois conditions sont réunies, la page du concelho s'ouvre. Elle est ajoutée au sitemap et liée depuis la page du district (carte du chantier), la page de la ville et les pages telhador et impermeabilização de ce concelho.
3. Après la mise en ligne, je demande son indexation dans la Search Console.

## Renovação de fachadas et trabalhos verticais (ajout du 23/10/2026)

Les deux pages de district `/pt/servicos/renovacao-de-fachadas/` et `/pt/servicos/trabalhos-verticais/` n'ont encore aucune preuve d'expérience : ni chantier, ni photo, ni qualification vérifiable. Le guide (sections 2.3 et 5.2) en fait un critère de qualité. Ce qu'il faudrait m'envoyer, au même format que ci-dessus :

1. **1 ou 2 chantiers réels** de façade (prédio ou moradia) ou faits sur corde : concelho, freguesia, mois, travaux, problème trouvé, ce qu'on a fait, accès (échafaudage ou cordes), une photo « après » et ce qu'elle montre. Je les saisis dans `data/seo/local-proof.json` avec `"metier": "renovacao-de-fachadas"` ou `"metier": "trabalhos-verticais"`. Ils s'affichent sur la page du district sans changement de code.
2. **La certification IRATA, pour qu'elle soit vérifiable** : niveau (1, 2 ou 3) de chaque technicien, son nom ou son numéro de certificat, seulement avec son accord écrit. Sans cela, la page dit « certificação IRATA » sans pouvoir le prouver.
3. **Les détails de méthode retirés à la relecture du 23/10/2026**, à valider ou à corriger avant que je les remette : traitement du ferro des varandas, tinta compatível avec le capoto, lavagem à basse pression et produit contre les algues, saison des travaux, avis d'un engenheiro pour une fissure large, délimitation de la zone sous les cordes, mástique elástico pour les juntas, ce que le condomínio doit préparer, arrêt par vent fort, et l'ordre des étapes des deux méthodes.

## Ordre conseillé pour te démarquer

D'après le relevé du 19/10/2026 (`plano-paginas.md`) :

1. **Villages et petites villes peu couverts** : Baião, Marco de Canaveses, Amarante, Lousada, Felgueiras, Paços de Ferreira, Penafiel, Paredes, Santo Tirso, Trofa. À l'est, on n'y a relevé que des annonces OLX (Penafiel, Paredes) et aucun prestataire local fort. Santo Tirso et Trofa n'ont pas été relevés. Un chantier complet et une particularité locale suffisent à ouvrir une page presque sans équivalent.
2. **Porto, Gaia, Gondomar, Matosinhos, Valongo, Maia, Póvoa de Varzim** : Zaask et Habitissimo y ont déjà des pages par concelho. Ce sont tes chantiers, tes photos et tes avis qui feront la différence : vise plusieurs chantiers documentés par concelho.
3. **Vila do Conde** : concurrence non relevée le 19/10, à vérifier.
