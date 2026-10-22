# Saisie des chantiers : ce qui ouvre les pages des villes

Date : 21/10/2026. Pour qui : Frédéric (envoi) et Claude Code (saisie).

## Pourquoi

Google refuse les pages par ville où seul le nom change (« doorway abuse »). Il accepte une page par ville quand elle contient du vrai contenu local. Le guide `consignes-google-2026-10-19.md` (section 4.4) fixe les conditions. Sur vitfix.io, une page `/pt/servicos/limpeza-de-telhados-{concelho}/` s'ouvre quand **les trois** sont réunies :

1. **un chantier complet** dans ce concelho : photo décrite, freguesia ou lieu-dit, problème trouvé, ce qu'on a fait ;
2. **une information propre au lieu** : une particularité du concelho que tu as constatée, ou un deuxième chantier détaillé (lieu, problème, solution) ;
3. **ma relecture** des 7 tests du guide (ville interchangeable, série, comparaison…), notée avec sa date. Je n'ouvre ainsi que quelques pages à la fois, comme le recommande le guide (section 4.6).

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

## Ordre conseillé pour te démarquer

D'après le relevé du 19/10/2026 (`plano-paginas.md`) :

1. **Villages et petites villes peu couverts** : Baião, Marco de Canaveses, Amarante, Lousada, Felgueiras, Paços de Ferreira, Penafiel, Paredes, Santo Tirso, Trofa. À l'est, on n'y a relevé que des annonces OLX (Penafiel, Paredes) et aucun prestataire local fort. Santo Tirso et Trofa n'ont pas été relevés. Un chantier complet et une particularité locale suffisent à ouvrir une page presque sans équivalent.
2. **Porto, Gaia, Gondomar, Matosinhos, Valongo, Maia, Póvoa de Varzim** : Zaask et Habitissimo y ont déjà des pages par concelho. Ce sont tes chantiers, tes photos et tes avis qui feront la différence : vise plusieurs chantiers documentés par concelho.
3. **Vila do Conde** : concurrence non relevée le 19/10, à vérifier.
