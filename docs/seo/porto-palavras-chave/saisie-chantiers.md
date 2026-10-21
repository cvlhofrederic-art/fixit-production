# Saisie des chantiers : ce qui ouvre les pages des villes

Date : 21/10/2026. Pour qui : Frédéric (envoi) et Claude Code (saisie).

## Pourquoi

Google refuse les pages par ville où seul le nom change (« doorway abuse »). Il accepte une page par ville quand elle contient du vrai contenu local. Sur vitfix.io, une page `/pt/servicos/limpeza-de-telhados-{concelho}/` s'ouvre **toute seule** dès que les chantiers d'un concelho suffisent :

- **deux chantiers** de limpeza de telhados dans ce concelho, **ou**
- **un seul chantier avec une photo**.

Avant ce seuil, les recherches de ce concelho arrivent sur la page du district (`/pt/servicos/limpeza-de-telhados/`) et sur les pages telhador et impermeabilização du concelho, qui la lient. Chaque chantier apparaît aussi sur la page du district, avec sa freguesia : c'est ainsi que les villages sont nommés, par de vrais travaux, sans liste de villes.

## Ce qu'il faut m'envoyer (un message par chantier)

```
Concelho : Santo Tirso
Freguesia ou village : Vila das Aves
Mois des travaux : 09/2026
Travaux : lavagem e impermeabilização do telhado (ou : limpeza de caleiras, pintura de telhas…)
Surface (facultatif) : 120 m²
Photo (facultatif) : avant / après, jointe au message
Ce que montre la photo : telhado de telha cerâmica depois da lavagem
Particularité locale (facultatif) : ex. « telhado de lousa », « prédio antigo com acesso por corda »
```

Règles :

- **Seulement des chantiers réels**, faits par ton équipe. Jamais de chantier inventé ou « type » : c'est la règle 0.2 du plan SEO, et Google sanctionne les fausses informations sur une entreprise.
- **Photos** : les tiennes, nettes, sans filtre, sans visage ni numéro de maison lisible. Une photo de chantier vaut plus qu'un paragraphe de texte.
- **Nom du client** : jamais sans son accord écrit (`consentimento_nome`).
- **Particularité locale** : seulement ce que tu as vu sur place (type de toit, accès, contraintes de la câmara). Elle apparaît sur la page du concelho, sous le titre « Os telhados de {concelho} ».

## Comment je le saisis

Dans `data/seo/local-proof.json`, une ligne par chantier (format complet : `docs/seo/phase-3-donnees-reelles.md`, section 3 bis) :

```json
{ "cidade": "santo-tirso", "metier": "limpeza-de-telhados", "tipo": "Lavagem e impermeabilização de telhado", "quantidade": "120 m²", "mes": "2026-09", "freguesia": "Vila das Aves", "foto": "/images/chantiers/limpeza-de-telhados/santo-tirso-2026-09.jpg", "foto_alt": "Telhado cerâmico depois da lavagem e impermeabilização", "publicado": "2026-10-25" }
```

`publicado` est le jour de la saisie. Il devient la date de modification (`lastmod`) de la page du concelho et de la page du district. Les particularités locales vont dans `notas_concelho`.

## Ce qui se passe ensuite, automatiquement

1. Le chantier s'affiche sur la page du district, avec la freguesia et le mois.
2. Au seuil atteint, la page du concelho s'ouvre. Elle est ajoutée au sitemap et liée depuis la page du district, la page de la ville et les pages telhador et impermeabilização de ce concelho.
3. Après la mise en ligne, je demande son indexation dans la Search Console.

## Ordre conseillé pour te démarquer

1. **Villages et petites villes peu couverts** (Baião, Marco de Canaveses, Amarante, Lousada, Felgueiras, Paços de Ferreira, Penafiel, Paredes, Santo Tirso, Trofa) : peu de concurrents, un ou deux chantiers suffisent à ouvrir une page qui n'a presque pas d'équivalent.
2. **Porto, Gaia, Matosinhos, Maia, Gondomar** : Zaask, Habitissimo et OLX y ont déjà des pages par ville. Ce sont tes chantiers, tes photos et tes avis qui feront la différence. Vises-y plusieurs chantiers documentés par concelho.
