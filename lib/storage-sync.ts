import { isStorageReadable } from '@/lib/safe-storage'

// Synchronisation localStorage <-> table Supabase user_storage.
//
// Stratégie : les écritures du localStorage dont la clé commence par `fixit_` sont interceptées, puis envoyées par
// lots (debounce 1,5 s) à /api/user-storage. À la connexion, les entrées du compte sont rapportées du serveur dans
// le localStorage (« restauration », hydrateStorageFromServer) sans repasser par le miroir.
//
// Avantage : aucun refacto invasif des composants existants. Tout code qui appelle déjà
// `localStorage.setItem('fixit_xxx', ...)` est automatiquement synchronisé.
//
// Clés ignorées :
//  - clés ne commençant pas par `fixit_`, ou que /api/user-storage refuserait (caractères, longueur)
//  - valeurs trop volumineuses (> 5 Mo) pour rester sous la limite serveur
//  - drapeaux ponctuels type `fixit_clean_v6_*` (sans valeur métier)
//
// Quatre garanties (audit des fondations du 11/11/2026, relecture du 14/11/2026) — le serveur est la seule copie qui
// survit à un changement d'appareil, et le navigateur la seule qui contient ce qui n'est pas encore parti :
//  1. Rien n'est envoyé tant qu'une restauration n'a pas réussi pour le compte connecté. Avant, une restauration en
//     échec (réseau, 429, 500) laissait partir les écritures du montage — jeux par défaut compris — par-dessus les
//     vraies données du serveur. La restauration est retentée seule (5 s, 15 s, 1 min, puis toutes les 5 min). Une
//     réponse sans la liste des valeurs compte pour un échec, pas pour un serveur vide.
//  2. Une modification faite dans cet onglet et pas encore confirmée par le serveur n'est plus effacée par la
//     restauration suivante (elle a lieu à chaque retour sur l'onglet), tant que le serveur détient encore la valeur
//     d'avant cette modification — celle du navigateur juste avant la saisie, ou la dernière que cet onglet a
//     synchronisée — ou une valeur que cet onglet lui a envoyée sans en recevoir la réponse (coupure juste après
//     l'envoi : il a pu l'enregistrer). S'il en détient une autre (écrite depuis un autre appareil ou un autre onglet),
//     le serveur gagne, comme avant. Ces modifications en attente sont notées dans le navigateur (CLE_ETAT) pour
//     survivre à un rechargement. Seule la modification elle-même repart : la dernière valeur écrite par cet onglet, ou
//     celle dont la note gardée dans le navigateur donne l'empreinte (après un rechargement, ou dans un autre onglet qui
//     la trouve en place et la prend en charge). Une valeur que cet onglet n'a pas écrite n'est jamais renvoyée d'ici :
//     ce peut être une valeur plus ancienne, remise dans le navigateur par la restauration d'un autre onglet. Quand le
//     navigateur ne détient plus la valeur écrite ici :
//      - si une restauration l'a remplacée pendant qu'elle attendait son nouvel essai (après un échec), elle est remise
//        dans le navigateur et repart, aux mêmes conditions — une suppression aussi. Chaque restauration note ce
//        qu'elle remplace (CLE_REMPLACEMENTS), une clé absente du navigateur comprise, sauf le dernier texte que son
//        onglet a synchronisé avec le serveur ; un texte que son onglet a réécrit tel qu'il le lisait, au montage, avant
//        qu'elle ne réponde, est noté comme les autres. Toute écriture faite ensuite dans un onglet efface la note : une
//        valeur choisie par l'utilisateur dans un autre onglet, même identique à celle du serveur, n'est pas défaite —
//        une réécriture automatique l'efface de même (voir les limites) ;
//      - sinon, le serveur gagne si la clé a disparu, si la valeur en place est la sienne, ou l'une de celles qu'il a
//        détenues avant d'après ce que cet onglet en sait ; toute autre valeur (la saisie d'un autre onglet, peut-être
//        encore en route, qui l'envoie lui-même) est laissée en place pour cette relecture, sans repartir d'ici, et la
//        modification d'ici est abandonnée avec sa note.
//     La même règle vaut pour un envoi en échec : il ne repart qu'après une nouvelle restauration, jamais à l'aveugle —
//     pas même à la fermeture de l'onglet (une exception pour une suppression : voir DCF2RB dans les limites). Une
//     suppression en échec attend ce nouvel essai tant qu'elle reste la dernière action de cet onglet sur la clé, même
//     si la clé est revenue dans le navigateur pendant son envoi : la relecture du nouvel essai tranche. Elle ne repart
//     pas si le serveur n'a plus la clé à cette relecture, ni si une relecture faite pendant son envoi l'a déjà tenue
//     pour faite (clé absente du serveur) — pas même quand l'envoi plus ancien d'un autre onglet, ou de cet onglet, y
//     remet ensuite la clé (voir les limites). Une exception (DW5f du banc) : tenue pour faite, elle repart au nouvel
//     essai quand un envoi plus ancien de cet onglet pour la même clé est confirmé ensuite alors que le navigateur n'a
//     plus la clé ; la note revient avec lui, et la relecture du nouvel essai tranche. Elle est perdue, enfin, quand la
//     confirmation d'un envoi plus ancien de cet onglet pour la même clé a levé sa note pendant son envoi (DCF2, voir
//     les limites). Quand deux envois de la même clé se chevauchent, la confirmation du premier ne lève pas la note
//     tant que la valeur plus récente écrite dans cet onglet attend son envoi ou reste en place dans le navigateur
//     (pour une suppression : tant que la clé en est absente), ni quand un autre onglet l'y a remplacée par une valeur
//     que cet onglet ne connaît pas ; elle la lève quand la restauration d'un autre onglet y a remis le texte confirmé
//     lui-même (au caractère près : la même valeur réécrite dans un autre ordre des champs passe pour inconnue, et la
//     note est gardée, DCF7) ou une valeur que le serveur détenait avant la modification d'ici, d'après ce que cet
//     onglet en sait, même si la dernière action de cet onglet est une suppression encore en route.
//  3. Un envoi en échec (réseau ou réponse d'erreur) est retenté seul : le serveur est relu après 5 s, 15 s, 1 min,
//     puis toutes les 5 min, et ce qui attend repart. Une valeur que le serveur refuse (400, 413, 422) reste dans le
//     navigateur et ne bloque pas les autres. Une valeur qu'il ne parvient pas à enregistrer (500 à chaque envoi qui
//     la contient, alors que les autres passent) est mise à part : retentée seule au bout de 5 min, puis toutes les
//     30 min ; une autre valeur saisie pour la même clé repart avec les envois ordinaires, et si le serveur ne
//     l'enregistre pas davantage, l'envoi repart aussitôt valeur par valeur sans retenir les autres. Tant que rien ne
//     passe, c'est le serveur qui est tenu pour en panne, et rien n'est mis à part.
//  4. Ce qui attend l'envoi ne part jamais avec le jeton d'un autre compte. « Tout envoyer » (premier passage d'un
//     compte dont le serveur ne détient rien) ne recopie que les clés qui portent l'identifiant du compte ou de sa
//     fiche, et seulement si le serveur en a donné la liste ; jamais celles qui portent un autre identifiant, et les
//     clés sans identifiant seulement si rien n'indique qu'un autre compte a utilisé ce navigateur. Ce qu'il ne
//     parvient pas à envoyer reste en attente dans le miroir, comme une saisie pas encore confirmée.
// Limites connues : les clés du navigateur ne sont pas rangées par compte, deux comptes sur le même navigateur y
// lisent les valeurs l'un de l'autre ; une valeur dont l'envoi échoue sans aucune réponse du serveur (connexion qui
// ne laisse pas passer un envoi volumineux) retient encore les valeurs du même envoi, comme avant : sans réponse,
// rien ne la distingue d'une coupure du réseau ; « tout envoyer » ne part que tant que l'espace du compte est vide
// sur le serveur : la première écriture qui y est sauvegardée lui retire toute nouvelle occasion. La valeur d'avant
// ne date rien : si un autre appareil change la valeur puis la remet telle qu'elle était pendant qu'une modification
// d'ici attend son nouvel essai, celle-ci repart par-dessus (avant ce miroir, elle partait si l'utilisateur continuait
// dans l'onglet, et cédait sinon) ; le serveur date chaque valeur, mais ne transmet pas cette date. Une relecture faite
// pendant qu'un envoi de cet onglet est en route, déjà enregistré par le serveur mais dont la réponse n'est pas encore
// arrivée, donne raison au serveur : une saisie faite depuis dans cet onglet est perdue, comme avant. Les onglets d'un
// même navigateur partagent son stockage mais pas leur mémoire : chacun ne connaît que ses propres envois, et les
// notes de l'état ne sont écrites que 3 s après la saisie. Quand la même clé est modifiée dans deux onglets à quelques
// secondes d'écart, la restauration de l'un (retour sur l'onglet, jeton rafraîchi : tous les onglets relisent le
// serveur) remplace dans le navigateur la saisie de l'autre encore en route, sauf si cet onglet garde lui-même une
// note pour la clé : si l'envoi de cette saisie échoue ensuite, elle est perdue, comme avant. Quand l'envoi d'une
// modification arrive au serveur après celui d'une modification plus récente faite dans l'autre onglet, le serveur
// garde la dernière arrivée, comme avant — sauf pour une suppression dont la réponse s'est perdue : avant ce miroir,
// elle repartait si l'utilisateur continuait dans son onglet ; ici, si une relecture (pendant son envoi, ou celle du
// nouvel essai) a trouvé la clé absente du serveur, elle ne repart pas, et la valeur plus ancienne, arrivée après elle,
// revient au serveur et dans le navigateur (scénarios DW5e du banc) ; de même quand cette valeur plus ancienne vient
// d'un envoi de cet onglet, si la restauration d'un onglet neuf a remis entre-temps la clé dans le navigateur (DW5f-B).
// La renvoyer sans contrôle effacerait, dans d'autres cas, une valeur recréée depuis dans un autre onglet (DW5d,
// DW5h) : rien ne distingue ces cas sans la date de chaque valeur. Une saisie faite par-dessus celle de l'autre onglet,
// dont l'envoi échoue, ne repart que si le serveur détient encore l'une des deux valeurs que cet onglet connaissait
// (garantie 2), sinon elle est perdue, comme avant. Enfin, un renvoi décidé par la relecture d'un nouvel essai part
// 1,5 s après elle : une modification faite entre-temps dans un autre onglet, dont l'envoi arrive au serveur avant ce
// renvoi, en est effacée et ne reste que dans ce navigateur (DXR) ; avant ce miroir, une modification en échec ne
// repartait que si l'utilisateur continuait dans son onglet. De même, un envoi de cet onglet encore en route, qui
// porte d'autres valeurs, envoie à sa fin, sans relire le serveur, une suppression que l'échec d'un autre envoi de
// l'onglet vient de remettre en attente : une modification faite entre-temps dans un autre onglet, arrivée au serveur
// avant elle, en est effacée, comme avant (DCF2RB).
// Une suppression faite juste après une saisie de la même clé, dans le même onglet, est perdue quand un onglet neuf
// s'ouvre pendant leurs envois et que sa restauration remet dans le navigateur la valeur que le serveur détenait avant
// la saisie : la confirmation de la saisie, arrivée pendant l'envoi de la suppression, lève la note de la clé
// (garantie 2) ; la suppression, en échec ensuite, n'est pas remise en attente, et la saisie reste au serveur et
// revient dans le navigateur, où l'on peut la supprimer de nouveau (DCF2 du banc, aussi quand l'onglet neuf est resté
// sur une version antérieure du site, ou quand la clé est ensuite retirée du navigateur hors de l'application). Avant
// ce miroir, elle repartait si l'utilisateur continuait dans son onglet. Garder la note (essayé à la neuvième passe,
// retiré à la onzième : contre-relecture du 17/11/2026) faisait de la saisie confirmée la valeur d'avant de l'action
// suivante de l'onglet sur la clé : quand l'ancienne valeur était revenue au serveur avant cette action (réécrite par
// l'onglet neuf à son ouverture, ou remise ailleurs), celle-ci cédait au nouvel essai sans repartir (DCF5). Ici,
// sa valeur d'avant est celle du navigateur juste avant elle, et elle part, même quand cette valeur n'a été remise au
// serveur, ailleurs, qu'après elle : elle l'y efface (la valeur d'avant ne date rien : DCF5-enVol-apres, DCF5S-apres).
// Une modification d'ici (saisie ou suppression) qui attend son nouvel essai après un échec, et que la restauration
// d'un autre onglet a remplacée dans le navigateur, cède au serveur dans les cas suivants, alors qu'avant ce miroir
// elle repartait si l'utilisateur continuait dans l'onglet, sans relire le serveur :
//  - l'onglet qui restaure est resté sur une version antérieure du site : il ne note pas ce qu'il remplace, et une
//    écriture faite dans cet onglet-là n'efface aucune note ; s'il y écrit exactement le texte qu'une restauration
//    notée a remis, la modification d'ici repart par-dessus ;
//  - le stockage du navigateur est plein et la note des remplacements devrait grandir pour recevoir la marque de cette
//    modification : elle n'est pas réécrite, la marque nouvelle n'est pas écrite, et aucune marque déjà écrite n'en
//    sort (PLEIN-CAP, PLEIN-CAPc, PLEIN-CAPX-saisie, PLEIN-X3, PLEIN-D1Fs et PLEIN-10 du banc) ;
//  - pour une saisie, la clé a été retirée du navigateur hors de l'application (outils du navigateur) avant la
//    restauration : celle-ci marque une clé absente, et non la modification d'ici ;
//  - une réécriture automatique (section qui persiste son état à chaque rendu, action sur un document qui réécrit à
//    l'identique les deux listes de documents), faite dans un onglet après la restauration — celui qui a restauré, ou
//    un troisième à son ouverture —, efface la note comme un choix de l'utilisateur. Rien ne distingue ici une
//    réécriture automatique d'un choix ; il faudrait pour cela la date de chaque valeur ;
//  - 50 marques de la même sorte ou plus ont été posées après la sienne, en une ou plusieurs restaurations, avant son
//    nouvel essai (clés absentes du navigateur : créées ailleurs, ou stockage vidé ; textes remplacés : clés réécrites
//    par l'application, ou modifiées sur un autre appareil, depuis la dernière restauration de ce navigateur — un
//    onglet neuf ne connaît aucune valeur synchronisée) : la note ne garde que les 50 marques les plus récentes de
//    chaque sorte, et pour une même restauration, les dernières dans l'ordre du serveur (CAPS, CAPW, AILLEURS, CAPCUM).
// Dans les deux premiers cas, une suppression repart pourtant si la marque d'une clé absente laissée par une
// restauration plus ancienne est encore en place. Toute restauration marque une clé absente du navigateur qu'elle y
// remet (dès la première d'un navigateur neuf, ou dont le stockage a été vidé : jusqu'à 50 clés) ; cette marque reste
// dans la note des remplacements tant qu'aucun onglet de cette version n'écrit la clé et que son texte garde la même
// longueur, et elle suit le texte aux restaurations suivantes.
// La note de l'état ne garde que l'empreinte d'une modification, et la marque d'un remplacement ne sert qu'à l'onglet
// de la modification, tant qu'il reste ouvert : si une modification en échec est remplacée dans le navigateur par la
// restauration d'un autre onglet — avant que sa note n'entre dans l'état (dans les 3 s qui suivent la saisie, ou au
// passage de son onglet en arrière-plan), ou après, quand cet autre onglet a réécrit la valeur à son ouverture avant
// de restaurer —, et que son onglet est rechargé ou fermé avant le nouvel essai (5 s après un premier échec, puis
// 15 s, 1 min et 5 min après plusieurs échecs), son texte n'est plus nulle part et elle est perdue ; avant ce miroir,
// elle partait à la fermeture de l'onglet, sans relire le serveur.
// Une suppression arrivée au serveur sans réponse, quand la restauration d'un autre onglet a remis la valeur dans le
// navigateur pendant son envoi, est faite, mais la valeur reste dans le navigateur, comme avant. Une valeur laissée en
// place par une relecture (garantie 2) peut rester à l'écran, différente de celle du serveur, jusqu'à la relecture
// suivante.
// Coût, pour une valeur de plusieurs Mo : son empreinte complète (lecture et tri de toute la valeur : 60 à 100 ms pour
// une liste de 2,4 M caractères) n'est calculée qu'à l'écriture de l'état (au plus une fois toutes les 3 s pour une clé
// en attente), quand le serveur est relu pour une clé en attente, quand un autre onglet a remplacé la valeur écrite
// ici, et une fois par valeur envoyée sans réponse si le serveur détient autre chose que la valeur d'avant. L'empreinte
// du seul texte (environ 5 ms pour 2,4 M caractères sur le PC du banc) est calculée à chaque écriture de l'état ; deux
// fois quand une restauration remplace une valeur que son onglet n'a pas synchronisée, ou le texte que suit une marque
// (environ 10 ms par liste de 2 Mo), et quand une relecture trouve une note de remplacement pour une modification
// d'ici ; une fois quand une restauration remet une clé absente du navigateur. Au chargement d'une page, une
// restauration remplace ainsi toute clé dont le texte du navigateur diffère de celui du serveur, même sans aucune
// modification en attente : toute clé que l'application a écrite depuis la dernière restauration de ce navigateur
// (l'ordre de ses champs n'étant pas celui de la base), ou qui a été modifiée ailleurs depuis. Sur un navigateur neuf,
// ou dont le stockage a été vidé, la première restauration calcule l'empreinte du texte de chaque valeur qu'elle y
// écrit, et y laisse jusqu'à 50 marques de clé absente. Chaque restauration qui pose une marque réécrit la note des
// remplacements et relit la valeur de chaque clé déjà notée : jusqu'à 100 valeurs (50 marques de chaque sorte), et déjà
// jusqu'à 50 après la première ouverture d'un navigateur neuf. La restauration lit chaque valeur du navigateur avant de
// la remplacer ; chaque écriture interceptée lit la note des remplacements, présente dès la première restauration d'un
// navigateur : quelques Ko (3,5 Ko pour 50 marques au banc, 17 Ko au plus pour 100 marques aux noms de clé les plus
// longs). Les valeurs envoyées sans réponse (envoisIncertains) restent en mémoire, jamais dans le navigateur : jusqu'à
// cinq textes par clé pendant une panne d'écriture du serveur, soit jusqu'à quatre copies de plus d'une valeur de
// plusieurs Mo. Rien n'est calculé à la saisie, ni à la confirmation d'un envoi tant que la valeur écrite ici est en
// place.
//
// Stockage du navigateur (lot 5 Sentry, lib/safe-storage.ts) : un stockage illisible (bloqué par le navigateur,
// SecurityError à la lecture de window.localStorage) coupe le miroir, la restauration et la migration. Un stockage
// plein (QuotaExceededError à l'écriture) reste lisible et les garde actifs : suppressions et réécritures qui ne
// l'agrandissent pas y réussissent encore et doivent atteindre le serveur.

// Client applicatif partagé (cookies SSR). NE PAS recréer ici un client
// @supabase/supabase-js : il lirait la session dans le localStorage (où elle
// n'est jamais présente — l'auth est en cookies), donc getToken() renverrait
// toujours null et AUCUNE donnée ne serait sauvegardée dans le cloud.
// Régression « base clients qui disparaît » (2026-06-01).
// Le jeton vient du cache tenu par les événements d'auth (lib/auth/jeton-acces.ts) : plus de getSession() à
// chaque flush, donc plus de prise du verrou d'auth partagé entre onglets (lot 1 Sentry du 28/10/2026).
import { jetonAcces } from '@/lib/auth/jeton-acces'

const FIXIT_PREFIX = 'fixit_'
// 5 MB max par cle pour absorber les cas legacy ou des fichiers sont
// stockes en base64 directement dans le localStorage : logo cabinet
// syndic, signature scannée, justificatifs Wallet (KBis, RC Pro, décennale).
// Une migration vers Supabase Storage (phase 2) est prevue pour ces cas
// afin de stocker l'URL au lieu du base64 ; en attendant, ce seuil
// genereux garantit qu'aucune donnee n'est silencieusement perdue.
const MAX_VALUE_BYTES = 5_000_000
// Lot 8 Sentry du 28/10/2026 : avec 500 ms, le chargement du dashboard pro produisait 20 POST en 10 s. Les
// écritures d'un même enchaînement partent maintenant ensemble, en un seul POST tant que la taille le permet.
const DEBOUNCE_MS = 1500
// Un POST regroupe jusqu'à FLUSH_BATCH_SIZE clés (= MAX_ENTRIES_PER_REQUEST de /api/user-storage) et
// FLUSH_BATCH_BYTES de valeurs (une clé peut peser 5 Mo : logo, signature, justificatifs en base64).
const FLUSH_BATCH_SIZE = 50
const FLUSH_BATCH_BYTES = 4_000_000
/** Règle des clés de /api/user-storage : une seule clé hors règle ferait refuser tout l'envoi qui la contient. */
const CLE_ACCEPTEE = /^fixit_[a-z0-9_-]+$/i
const LONGUEUR_MAX_CLE = 120
/** Attente avant un nouvel essai après un échec (restauration ou envoi) ; le dernier délai se répète. */
const DELAIS_REESSAI_MS = [5_000, 15_000, 60_000, 300_000]
/** Attente avant de retenter, seule, une valeur mise à part (voir `isolees`) ; le dernier délai se répète. */
const DELAIS_VALEUR_ISOLEE_MS = [300_000, 1_800_000]
/** Envois un par un : après autant d'échecs sans un seul succès, c'est le serveur qui est en panne, la série s'arrête. */
const ECHECS_AVANT_ARRET = 3
/** État du miroir gardé dans le navigateur. Hors préfixe `fixit_` : jamais envoyé au serveur. */
const CLE_ETAT = 'vitfix_miroir_etat_v1'
/** Délai avant d'écrire l'état : un envoi normal est confirmé avant, et rien n'est alors écrit. */
const DELAI_ETAT_MS = 3_000
/**
 * Ce que les restaurations ont remplacé dans le navigateur (voir noterRemplacements). Hors préfixe `fixit_` : jamais
 * envoyé au serveur.
 */
const CLE_REMPLACEMENTS = 'vitfix_miroir_remplacements_v1'
/**
 * Remplacements gardés au plus dans le navigateur, pour chaque sorte (voir noterRemplacements) : au-delà, les plus
 * anciens sont oubliés.
 */
const REMPLACEMENTS_MAX = 50
/** Valeurs envoyées d'ici sans réponse gardées au plus par clé (voir envoisIncertains). */
const ENVOIS_INCERTAINS_MAX = 5
/** Empreinte d'une clé que le serveur ne détenait pas, ou d'une modification qui est une suppression. */
const ABSENTE = ''
/** Identifiant de compte ou de fiche porté par une clé (`fixit_documents_<identifiant>`). */
const MOTIF_IDENTIFIANT = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g

type Minuteur = ReturnType<typeof setTimeout>
/**
 * Issue d'un appel au serveur :
 *  - `refuse` (400, 413, 422) : il refuse ce contenu, le renvoyer tel quel n'y changera rien ;
 *  - `indisponible` : pas de réponse (réseau), jeton refusé (401) ou limite de débit (429) — le contenu n'est pas en cause ;
 *  - `erreur` : toute autre réponse (5xx surtout) — panne passagère, ou valeur qu'il ne parvient pas à enregistrer.
 */
type Issue = 'ok' | 'refuse' | 'erreur' | 'indisponible'
type EntreeAEnvoyer = { key: string; value: unknown; raw: string }
interface Envoi { jeton: string; keepalive: boolean; compte: string | null }
/** Bilan d'un envoi complet (flushNow). */
interface Bilan {
  /** Valeurs que le serveur a enregistrées pendant cet envoi : la preuve qu'il répond. */
  reussies: number
  /** Quelque chose a été remis en attente : un nouvel essai est à programmer. */
  panne: boolean
  /**
   * Valeurs en erreur alors qu'elles étaient seules dans leur envoi. La fin de l'envoi tranche : si d'autres valeurs
   * sont passées, ce sont elles que le serveur ne parvient pas à enregistrer ; sinon c'est lui qui est en panne.
   */
  seulesEnErreur: EntreeAEnvoyer[]
}

/**
 * Ce que le serveur détenait pour une clé avant une modification locale pas encore confirmée : la valeur telle
 * qu'elle était dans le navigateur (`brut`, null si la clé n'existait pas), ou seulement son empreinte quand la
 * note vient de l'état gardé dans le navigateur (rechargement, autre onglet). `synchro` : la dernière valeur que cet
 * onglet a synchronisée, quand elle diffère de `brut` (saisie faite par-dessus la valeur d'un autre onglet, pas encore
 * confirmée) : si le serveur détient encore l'une ou l'autre, il n'a rien reçu de plus récent que la modification.
 * La modification elle-même est la dernière valeur écrite par cet onglet (derniereEcritureIci).
 * `pourEcritureIci` : note gardée à la confirmation d'un envoi (confirmerEcriture), parce que cet onglet a écrit une
 * valeur plus récente que celle confirmée. `anciennes` et `precedente` : valeurs que le serveur a détenues avant
 * `brut`, depuis la première modification faite ici — les empreintes déjà calculées, et le texte de la valeur de la
 * note précédente quand son empreinte ne l'était pas encore (calculée seulement si elle sert, voir valeursConnues ; une
 * seule valeur ainsi gardée en mémoire par clé, jusqu'à la confirmation suivante).
 * La restauration d'un autre onglet, lue avant l'arrivée d'un envoi, peut remettre l'une d'elles dans le navigateur :
 * la relecture la reconnaît et le serveur gagne. Connues au mieux : une valeur plus ancienne dont l'empreinte n'a
 * jamais été calculée est tenue pour inconnue, laissée en place une fois, jamais renvoyée (issuePourLaNoteDIci).
 */
interface Base {
  brut?: string | null
  empreinte?: string
  synchro?: string
  empreinteSynchro?: string
  pourEcritureIci?: true
  anciennes?: string[]
  precedente?: string
}

interface EtatMiroir {
  v: 1
  /** Dernier compte pour lequel le miroir a travaillé dans ce navigateur. */
  compte: string
  /** Tous les comptes vus dans ce navigateur depuis que cet état existe. */
  comptes: string[]
  /** Clés modifiées ici et pas encore confirmées par le serveur → empreinte de la valeur qu'il détenait. */
  attente: Record<string, string>
  /**
   * Mêmes clés → empreinte du texte de la modification (ABSENTE pour une suppression) : après un rechargement, ou dans
   * un autre onglet, seule cette valeur repart (relecture du 16/11/2026). Absente d'un état écrit plus tôt : la note ne
   * fait alors rien repartir, le serveur gagne.
   */
  valeurs?: Record<string, string>
}

/** Note lue dans l'état : celle d'un autre onglet du même compte, ou de cet onglet avant un rechargement. */
interface NoteEtat { base: string; valeur?: string }

/** Issue de la relecture du serveur pour une clé qu'il détient (voir issueDeLaRelecture). */
type Relecture = 'serveur' | 'garder' | 'laisser'

/**
 * Remplacement fait dans le navigateur par une restauration : empreinte du texte qu'elle a remplacé (ABSENTE : la clé en
 * avait disparu) et de celui qu'elle a écrit.
 */
type Remplacement = [remplace: string, par: string]

interface RegistreRemplacements {
  v: 1
  /** Compte dont la restauration a fait ces remplacements. */
  compte: string
  remplacements: Record<string, Remplacement>
}

/** Valeur envoyée d'ici sans réponse ; son empreinte n'est calculée que si elle sert. */
interface EnvoiIncertain { brut: string; empreinte?: string }

export interface ResultatHydratation {
  /** Valeurs rapportées du serveur dans le navigateur. */
  count: number
  /** true seulement si le serveur a répondu : un échec ne dit rien de ce qu'il contient. */
  ok: boolean
  /** Le serveur a répondu et ne détient rien pour ce compte. */
  vide: boolean
  /** Ce navigateur a déjà servi à un autre compte : ce qu'il contient n'appartient peut-être pas à celui-ci. */
  autreCompte: boolean
}

const SANS_RESTAURATION: ResultatHydratation = { count: 0, ok: false, vide: false, autreCompte: false }

const pendingWrites = new Map<string, string>()
const pendingDeletes = new Set<string>()
let flushTimer: Minuteur | null = null
let installed = false

// Dernière valeur envoyée au serveur (ou reçue de lui) par clé : une valeur identique n'est pas renvoyée.
const derniereValeurSynchronisee = new Map<string, string>()
// Dernière valeur écrite par cet onglet pour chaque clé (null : supprimée), telle que l'interception l'a vue. Ce
// qu'écrit une restauration, ici ou dans un autre onglet, n'y figure pas ; retirée quand la restauration la remplace
// par la valeur du serveur. Égale à la valeur synchronisée, elle est tenue par la même chaîne, sans seconde copie en
// mémoire (valeurs de plusieurs Mo). C'est la modification que protège la note de la clé : voir noteAGarder et
// issueDeLaRelecture.
const derniereEcritureIci = new Map<string, string | null>()
// Valeurs envoyées par cet onglet dont l'envoi a échoué sans réponse qui dise si le serveur les a enregistrées (réseau
// coupé juste après l'envoi, réponse d'erreur), par clé et au plus ENVOIS_INCERTAINS_MAX : le serveur a pu les
// enregistrer, et les y retrouver ne prouve pas une écriture faite ailleurs (relecture du 17/11/2026, réponse perdue).
// Oubliées à la confirmation d'un envoi de la clé, quand le serveur gagne et au changement de compte. Gardées en
// mémoire seulement, jamais écrites dans le navigateur (aucun quota en jeu) : le texte complet de chacune, soit pendant
// une panne d'écriture du serveur jusqu'à quatre copies de plus d'une valeur de plusieurs Mo ; leur empreinte n'est
// calculée que si elle sert (voir le coût en tête du module).
const envoisIncertains = new Map<string, EnvoiIncertain[]>()
// setItem d'origine, capturé à l'installation du miroir : l'hydratation écrit sans repasser par le miroir
// (avant, chaque valeur reçue du serveur repartait en POST 500 ms plus tard).
let ecrireSansMiroirRef: ((key: string, value: string) => void) | null = null
// removeItem d'origine, pour remettre dans le navigateur une suppression en attente (voir remettreDansLeNavigateur).
let supprimerSansMiroirRef: ((key: string) => void) | null = null
// Hydratations en cours : tant qu'il y en a une, flushNow n'envoie rien (voir flushNow). Un compteur plutôt qu'un
// booléen : Providers peut lancer deux hydratations qui se chevauchent (bootstrap immédiat puis INITIAL_SESSION).
let hydratationsEnCours = 0
// POST en vol par clé, avec leur nombre (deux flush peuvent se chevaucher pour une même clé) : renseigné au départ
// du POST, vidé à sa réponse, succès ou échec. Voir enregistrerEcritureMiroir.
const postsEnVol = new Map<string, number>()

// Modifications locales pas encore confirmées par le serveur (garantie 2).
const bases = new Map<string, Base>()
// Clés confirmées (ou reprises du serveur) depuis la dernière écriture de l'état : à retirer de ses notes.
const confirmees = new Set<string>()
// Valeurs que le serveur a refusées (trop volumineuses, invalides) : inutile de renvoyer la même.
const refusees = new Map<string, string>()
// Compte pour lequel le miroir travaille, lu dans le jeton d'accès ; null tant qu'aucun jeton lisible n'a été vu.
let compteCourant: string | null = null
// Le serveur a été relu avec succès pour ce compte et aucun envoi n'a échoué depuis : les envois sont permis
// (garanties 1 et 2). Remis à faux par un envoi en échec : le nouvel essai commence par une restauration.
let amorce = false
let echecsHydratation = 0
let hydratationARetenter = false
let minuteurHydratation: Minuteur | null = null
let echecsEnvoi = 0
let minuteurReessai: Minuteur | null = null
let minuteurEtat: Minuteur | null = null
// Clés dont un envoi a reçu une réponse d'erreur du serveur → nombre d'échecs de suite. Un lot qui échoue de nouveau
// avec l'une d'elles repart valeur par valeur : si c'est elle que le serveur ne parvient pas à enregistrer, elle ne
// bloque pas les autres (garantie 3).
const echecsServeur = new Map<string, number>()
// Parmi elles, celles qui ont échoué seules alors que d'autres valeurs passaient → la valeur en cause : mises à part,
// elles ne partent plus avec les envois ordinaires et sont retentées de loin en loin (planifierIsolees). Une autre
// valeur saisie pour la même clé n'est plus en cause : elle repart avec les envois ordinaires.
const isolees = new Map<string, string>()
// Le prochain envoi peut tenter les valeurs mises à part : leur délai est écoulé et le serveur va être relu.
let isoleesPermises = false
let essaisIsolees = 0
let minuteurIsolees: Minuteur | null = null
// Ce que la dernière restauration réussie a appris, pour « tout envoyer » (pushAllLocalToServer) : le serveur ne
// détenait rien, un autre compte est déjà passé par ce navigateur, et les identifiants (compte, fiche) sous lesquels
// ce compte range ses clés — si le serveur en a donné la liste (identifiantsDonnes).
let serveurVide = false
let autreCompteVu = false
const identifiantsDuCompte = new Set<string>()
let identifiantsDonnes = false
const avertissementsFaits = new Set<string>()

function avertirUneFois(cle: string, message: string, detail?: unknown): void {
  if (avertissementsFaits.has(cle)) return
  avertissementsFaits.add(cle)
  if (detail === undefined) console.warn(message)
  else console.warn(message, detail)
}

function arreter(minuteur: Minuteur | null): null {
  if (minuteur) clearTimeout(minuteur)
  return null
}

function delaiDeReessai(echecs: number): number {
  return DELAIS_REESSAI_MS[Math.min(Math.max(echecs, 1), DELAIS_REESSAI_MS.length) - 1]
}

function marquerEnVol(keys: string[]): void {
  for (const k of keys) postsEnVol.set(k, (postsEnVol.get(k) ?? 0) + 1)
}

function libererEnVol(keys: string[]): void {
  for (const k of keys) {
    const restants = (postsEnVol.get(k) ?? 0) - 1
    if (restants > 0) postsEnVol.set(k, restants)
    else postsEnVol.delete(k)
  }
}

function ecrireSansMiroir(key: string, value: string): void {
  if (ecrireSansMiroirRef) ecrireSansMiroirRef(key, value)
  else window.localStorage.setItem(key, value)
}

function supprimerSansMiroir(key: string): void {
  if (supprimerSansMiroirRef) supprimerSansMiroirRef(key)
  else window.localStorage.removeItem(key)
}

/** Valeur actuelle de la clé dans le localStorage ; undefined s'il est illisible (stockage bloqué). */
function valeurLocale(key: string): string | null | undefined {
  try {
    return window.localStorage.getItem(key)
  } catch (error) {
    console.warn('[storage-sync] localStorage illisible :', error)
    return undefined
  }
}

async function getToken(): Promise<string | null> {
  try {
    return await jetonAcces()
  } catch {
    return null
  }
}

/**
 * Compte (identifiant d'utilisateur) inscrit dans un jeton d'accès Supabase, ou null s'il n'est pas lisible. Sert
 * seulement à savoir à qui appartient ce qui attend dans ce navigateur : le serveur, lui, vérifie le jeton.
 */
function compteDuJeton(jeton: string): string | null {
  try {
    const charge = jeton.split('.')[1]
    if (!charge) return null
    const donnees = JSON.parse(atob(charge.replaceAll('-', '+').replaceAll('_', '/'))) as { sub?: unknown }
    return typeof donnees.sub === 'string' && donnees.sub !== '' ? donnees.sub : null
  } catch {
    // Jeton sans charge lisible : le miroir fonctionne, sans suivi de compte.
    return null
  }
}

async function identite(): Promise<{ jeton: string; compte: string | null } | null> {
  const jeton = await getToken()
  return jeton ? { jeton, compte: compteDuJeton(jeton) } : null
}

/**
 * Note le compte connecté. S'il remplace un autre compte dans la même page, tout ce qui attendait appartenait au
 * précédent : rien ne doit partir avec le nouveau jeton (garantie 4). Renvoie true dans ce cas.
 */
function adopterCompte(compte: string | null): boolean {
  if (compte === null || compte === compteCourant) return false
  const remplacement = compteCourant !== null
  if (remplacement) {
    pendingWrites.clear()
    pendingDeletes.clear()
    bases.clear()
    confirmees.clear()
    refusees.clear()
    derniereValeurSynchronisee.clear()
    derniereEcritureIci.clear()
    envoisIncertains.clear()
    echecsServeur.clear()
    isolees.clear()
    isoleesPermises = false
    essaisIsolees = 0
    flushTimer = arreter(flushTimer)
    minuteurEtat = arreter(minuteurEtat)
    minuteurIsolees = arreter(minuteurIsolees)
  }
  minuteurReessai = arreter(minuteurReessai)
  minuteurHydratation = arreter(minuteurHydratation)
  compteCourant = compte
  // Rien de ce qu'une restauration a appris ne vaut pour un autre compte.
  amorce = false
  serveurVide = false
  autreCompteVu = false
  identifiantsDuCompte.clear()
  identifiantsDonnes = false
  echecsHydratation = 0
  echecsEnvoi = 0
  return remplacement
}

function shouldSync(key: string): boolean {
  if (!key.startsWith(FIXIT_PREFIX)) return false
  // On exclut quelques flags transitoires qui ne portent aucune valeur metier
  // et seraient juste du bruit DB (et causeraient des cycles entre devices
  // si le flag de migration etait synchronise).
  if (key.startsWith('fixit_clean_v')) return false
  if (key === 'fixit_btp_local_migrated_v1') return false
  if (key === 'fixit_user_storage_migrated_v1') return false
  if (key.length > LONGUEUR_MAX_CLE || !CLE_ACCEPTEE.test(key)) {
    avertirUneFois(`cle:${key}`, '[storage-sync] clé non sauvegardée en ligne (caractères ou longueur refusés par le serveur) :', key)
    return false
  }
  return true
}

// ── Empreintes : comparer ce que détient le serveur à ce que cet appareil en savait ──────────────────────────────

/** Valeur telle qu'elle part au serveur : le JSON lu, ou le texte brut s'il n'en est pas. */
function versServeur(brut: string): unknown {
  try { return JSON.parse(brut) } catch { return brut }
}

function comparerCles(a: string, b: string): number {
  if (a < b) return -1
  return a > b ? 1 : 0
}

/** JSON à clés triées : la base range les objets dans son propre ordre, deux écritures égales doivent se reconnaître. */
function canonique(valeur: unknown): string {
  if (Array.isArray(valeur)) return `[${valeur.map(canonique).join(',')}]`
  if (valeur !== null && typeof valeur === 'object') {
    const objet = valeur as Record<string, unknown>
    const champs = Object.keys(objet).sort(comparerCles).map(cle => `${JSON.stringify(cle)}:${canonique(objet[cle])}`)
    return `{${champs.join(',')}}`
  }
  return JSON.stringify(valeur) ?? 'null'
}

/** Condensé non cryptographique (cyrb53) : sert à reconnaître une valeur, pas à la protéger. */
function condenser(texte: string): string {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < texte.length; i++) {
    const code = texte.charCodeAt(i)
    h1 = Math.imul(h1 ^ code, 2654435761)
    h2 = Math.imul(h2 ^ code, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

function empreinteDeValeur(valeur: unknown): string {
  const texte = canonique(valeur)
  return `${texte.length.toString(36)}.${condenser(texte)}`
}

/**
 * Empreinte du texte lui-même, tel que le navigateur le détient : reconnaît la modification notée dans l'état, sans lire
 * la valeur (une seule passe sur le texte, bien moins coûteuse qu'empreinteDeValeur).
 */
function empreinteDuTexte(texte: string): string {
  return `${texte.length.toString(36)}.${condenser(texte)}`
}

function empreinteDeBase(base: Base): string {
  if (base.empreinte === undefined) base.empreinte = typeof base.brut === 'string' ? empreinteDeValeur(versServeur(base.brut)) : ABSENTE
  return base.empreinte
}

function empreinteDeSynchro(base: Base): string | undefined {
  if (base.synchro === undefined) return undefined
  if (base.empreinteSynchro === undefined) base.empreinteSynchro = empreinteDeValeur(versServeur(base.synchro))
  return base.empreinteSynchro
}

/** Le serveur détient-il encore l'une des valeurs que cet appareil lui connaissait avant la modification locale ? */
function serveurDetientEncore(base: Base, valeur: unknown, enTexte: string): boolean {
  if (base.brut === enTexte || base.synchro === enTexte) return true
  let recue: string | undefined
  const empreinteRecue = (): string => {
    if (recue === undefined) recue = empreinteDeValeur(valeur)
    return recue
  }
  const attendue = empreinteDeBase(base)
  if (attendue !== ABSENTE && attendue === empreinteRecue()) return true
  const synchro = empreinteDeSynchro(base)
  return synchro !== undefined && synchro === empreinteRecue()
}

/** Cet onglet a envoyé cette valeur sans réponse qui dise si le serveur l'a enregistrée : il a pu le faire. */
function noterEnvoiIncertain(e: EntreeAEnvoyer): void {
  const envois = envoisIncertains.get(e.key) ?? []
  if (envois.some(envoi => envoi.brut === e.raw)) return
  envois.push({ brut: e.raw })
  if (envois.length > ENVOIS_INCERTAINS_MAX) envois.shift()
  envoisIncertains.set(e.key, envois)
}

/** Le serveur détient-il une valeur que cet onglet lui a envoyée sans en recevoir la réponse ? */
function serveurDetientUnEnvoiIncertain(key: string, valeur: unknown, enTexte: string): boolean {
  const envois = envoisIncertains.get(key)
  if (!envois) return false
  if (envois.some(envoi => envoi.brut === enTexte)) return true
  const recue = empreinteDeValeur(valeur)
  return envois.some((envoi) => {
    if (envoi.empreinte === undefined) envoi.empreinte = empreinteDeValeur(versServeur(envoi.brut))
    return envoi.empreinte === recue
  })
}

/**
 * Le serveur n'a-t-il rien reçu d'ailleurs, d'après ce que cet onglet en sait ? Il détient la valeur d'avant la
 * modification faite ici (serveurDetientEncore), ou une valeur que cet onglet lui a envoyée sans en recevoir la réponse
 * (réponse perdue : il l'a peut-être enregistrée). Une valeur changée ailleurs puis remise telle qu'elle était ne se
 * distingue pas d'une valeur inchangée (limite écrite en tête du module).
 */
function serveurDetientLaValeurDAvant(key: string, base: Base, valeur: unknown, enTexte: string): boolean {
  return serveurDetientEncore(base, valeur, enTexte) || serveurDetientUnEnvoiIncertain(key, valeur, enTexte)
}

function avecEmpreinte(liste: string[] | undefined, empreinte: string): string[] {
  if (empreinte === ABSENTE || liste?.includes(empreinte)) return liste ?? []
  return [...(liste ?? []), empreinte]
}

/**
 * Empreintes des valeurs que le serveur a détenues avant la modification faite ici, telles que cet onglet les connaît :
 * celles de la note, la valeur d'avant la modification (`brut`, `synchro`), et celle de la note précédente
 * (`precedente`, dont l'empreinte est calculée ici une fois pour toutes). Seulement quand le navigateur ne détient plus
 * la valeur écrite ici : une empreinte coûte une lecture complète de la valeur.
 */
function valeursConnues(base: Base): string[] {
  if (base.precedente !== undefined) {
    base.anciennes = avecEmpreinte(base.anciennes, empreinteDeValeur(versServeur(base.precedente)))
    delete base.precedente
  }
  let connues = avecEmpreinte(base.anciennes, empreinteDeBase(base))
  const synchro = empreinteDeSynchro(base)
  if (synchro !== undefined) connues = avecEmpreinte(connues, synchro)
  return connues
}

/** La valeur en place est-elle l'une de celles que le serveur a détenues avant, d'après ce que cet onglet en sait ? */
function estConnue(locale: string, base: Base): boolean {
  const connues = valeursConnues(base)
  return connues.length > 0 && connues.includes(empreinteDeValeur(versServeur(locale)))
}

/**
 * Ce que la note prise à la confirmation d'un envoi retient des valeurs d'avant : les empreintes déjà calculées (écriture
 * de l'état, ou remplacement de la valeur écrite ici), et le texte de la valeur de la note quand son empreinte ne l'est
 * pas encore. Rien n'est calculé ici : les confirmations arrivent parfois en rafale (envois qui se chevauchent sur un
 * réseau lent). Le texte d'une note plus ancienne, jamais calculé, est oublié (voir Base).
 */
function anciennesTransmises(base: Base | undefined): Pick<Base, 'anciennes' | 'precedente'> {
  if (base === undefined) return {}
  let anciennes = base.anciennes ?? []
  if (base.empreinte !== undefined) anciennes = avecEmpreinte(anciennes, base.empreinte)
  if (base.empreinteSynchro !== undefined) anciennes = avecEmpreinte(anciennes, base.empreinteSynchro)
  const transmises: Pick<Base, 'anciennes' | 'precedente'> = {}
  if (anciennes.length > 0) transmises.anciennes = anciennes
  if (base.empreinte === undefined && typeof base.brut === 'string') transmises.precedente = base.brut
  return transmises
}

/** La valeur du navigateur est-elle la modification dont la note de l'état donne l'empreinte ? */
function estLaValeurNotee(locale: string | null, note: NoteEtat): boolean {
  if (note.valeur === undefined) return false
  if (locale === null) return note.valeur === ABSENTE
  return note.valeur !== ABSENTE && note.valeur === empreinteDuTexte(locale)
}

/** Le serveur détient-il encore la valeur d'avant la modification notée dans l'état ? */
function serveurDetientLaBaseNotee(note: NoteEtat, valeur: unknown): boolean {
  return note.base !== ABSENTE && note.base === empreinteDeValeur(valeur)
}

// ── État gardé dans le navigateur : compte et modifications en attente ───────────────────────────────────────────

/** État tel que le navigateur le détient, quel que soit son numéro de version ; null s'il est absent ou illisible. */
function lireEtatBrut(): Record<string, unknown> | null {
  const brut = valeurLocale(CLE_ETAT)
  if (!brut) return null
  try {
    const lu: unknown = JSON.parse(brut)
    return lu !== null && typeof lu === 'object' && !Array.isArray(lu) ? lu as Record<string, unknown> : null
  } catch {
    // État illisible : on repart sans notes, comme sur un navigateur neuf.
    return null
  }
}

function lireEtat(brut: Record<string, unknown> | null = lireEtatBrut()): EtatMiroir | null {
  const lu = brut as Partial<EtatMiroir> | null
  if (!lu || lu.v !== 1 || typeof lu.compte !== 'string' || !Array.isArray(lu.comptes)) return null
  if (!lu.attente || typeof lu.attente !== 'object') return null
  const attente = Object.fromEntries(Object.entries(lu.attente).filter(([, empreinte]) => typeof empreinte === 'string'))
  const etat: EtatMiroir = { v: 1, compte: lu.compte, comptes: lu.comptes.filter(c => typeof c === 'string'), attente }
  // Les empreintes des modifications sont facultatives : un état qui n'en a pas reste lisible (voir EtatMiroir).
  if (lu.valeurs && typeof lu.valeurs === 'object' && !Array.isArray(lu.valeurs)) {
    etat.valeurs = Object.fromEntries(Object.entries(lu.valeurs).filter(([, empreinte]) => typeof empreinte === 'string'))
  }
  return etat
}

/**
 * Comptes vus dans ce navigateur d'après l'état, quel que soit son numéro de version : celui d'une autre version du
 * site témoigne lui aussi du passage d'un autre compte (garantie 4).
 */
function comptesVus(brut: Record<string, unknown> | null): string[] {
  const comptes = brut?.comptes
  return Array.isArray(comptes) ? comptes.filter((c): c is string => typeof c === 'string') : []
}

/**
 * Écrit l'état si quelque chose a changé : le compte courant, et les clés encore en attente de confirmation, avec
 * l'empreinte de la valeur que le serveur détenait et celle du texte de la modification. Les notes d'un autre onglet du
 * même compte sont conservées ; celles d'un autre compte sont abandonnées. Les champs que cette version ne connaît pas
 * sont gardés, et l'état d'un autre numéro de version n'est pas écrasé : les notes de cette page restent alors en
 * mémoire, sans survivre à un rechargement (relecture du 17/11/2026).
 */
function synchroniserEtat(): void {
  minuteurEtat = arreter(minuteurEtat)
  const compte = compteCourant
  if (compte === null || typeof window === 'undefined') return
  const brut = lireEtatBrut()
  if (brut !== null && brut.v !== 1) {
    confirmees.clear()
    return
  }
  const actuel = lireEtat(brut)
  const gardees = actuel?.compte === compte ? Object.entries(actuel.attente).filter(([cle]) => !confirmees.has(cle)) : []
  confirmees.clear()
  const attente = Object.fromEntries(gardees)
  const valeurs: Record<string, string> = {}
  for (const [cle] of gardees) {
    const valeur = actuel?.valeurs && Object.prototype.hasOwnProperty.call(actuel.valeurs, cle) ? actuel.valeurs[cle] : undefined
    if (valeur !== undefined) valeurs[cle] = valeur
  }
  for (const [cle, base] of bases) {
    attente[cle] = empreinteDeBase(base)
    const modification = derniereEcritureIci.get(cle)
    if (modification === undefined) delete valeurs[cle]
    else valeurs[cle] = modification === null ? ABSENTE : empreinteDuTexte(modification)
  }
  const suivant: Record<string, unknown> = { ...(actuel && brut ? brut : {}), v: 1, compte, comptes: Array.from(new Set([...(actuel?.comptes ?? []), compte])), attente }
  if (Object.keys(valeurs).length > 0) suivant.valeurs = valeurs
  else delete suivant.valeurs
  if (brut && JSON.stringify(brut) === JSON.stringify(suivant)) return
  try {
    ecrireSansMiroir(CLE_ETAT, JSON.stringify(suivant))
  } catch (erreur) {
    // Stockage plein : les notes restent en mémoire pour cette page, elles ne survivront pas à un rechargement.
    avertirUneFois('etat', '[storage-sync] état du miroir non enregistré dans le navigateur :', erreur)
  }
}

function planifierEtat(): void {
  if (minuteurEtat || compteCourant === null) return
  minuteurEtat = setTimeout(() => { minuteurEtat = null; synchroniserEtat() }, DELAI_ETAT_MS)
}

function oublierBase(key: string): void {
  if (!bases.delete(key)) return
  confirmees.add(key)
  planifierEtat()
}

// ── Remplacements faits par une restauration ─────────────────────────────────────────────────────────────────────

/**
 * Registre des remplacements tel que le navigateur le détient : null s'il est absent ou illisible, 'autre' s'il a été
 * écrit par une autre version du site (il n'est alors ni lu ni écrasé).
 */
function lireRegistreRemplacements(): RegistreRemplacements | 'autre' | null {
  const brut = valeurLocale(CLE_REMPLACEMENTS)
  if (!brut) return null
  let lu: unknown
  try {
    lu = JSON.parse(brut)
  } catch {
    // Illisible : comme sans remplacement noté.
    return null
  }
  if (lu === null || typeof lu !== 'object' || Array.isArray(lu)) return null
  const registre = lu as Partial<RegistreRemplacements>
  if (registre.v !== 1) return 'autre'
  if (typeof registre.compte !== 'string' || !registre.remplacements || typeof registre.remplacements !== 'object') return null
  const remplacements: Record<string, Remplacement> = {}
  for (const [cle, r] of Object.entries(registre.remplacements)) {
    if (Array.isArray(r) && r.length === 2 && typeof r[0] === 'string' && typeof r[1] === 'string') remplacements[cle] = [r[0], r[1]]
  }
  return { v: 1, compte: registre.compte, remplacements }
}

/** Remplacements notés pour le compte courant, par clé. */
function lireRemplacements(): Map<string, Remplacement> {
  const registre = lireRegistreRemplacements()
  if (registre === null || registre === 'autre' || registre.compte !== compteCourant) return new Map()
  return new Map(Object.entries(registre.remplacements))
}

/**
 * Empreinte du texte qu'une restauration va remplacer, quand il peut être la modification d'un onglet en attente de son
 * nouvel essai : ni le texte du serveur, ni le dernier que cet onglet a synchronisé (reçu du serveur, ou envoyé et
 * confirmé). Un texte que cet onglet a écrit lui-même est noté aussi : un onglet qui s'ouvre réécrit souvent au montage,
 * avant que sa restauration ne réponde, la valeur qu'il lit — la modification d'un autre onglet en attente
 * (contre-relecture du 17/11/2026). ABSENTE pour une clé absente du navigateur, que cet onglet la connaisse ou non : la
 * suppression d'un autre onglet peut y attendre son nouvel essai, y compris quand cet onglet vient de s'ouvrir (ou de
 * se recharger) et n'a jamais vu la clé. undefined sinon. Quand le texte en place a lui-même été écrit par une
 * restauration (`precedent`, lue avant une saisie arrivée depuis par exemple), la note le suit et désigne toujours la
 * modification qu'elle avait remplacée.
 */
function texteRemplace(key: string, locale: string | null | undefined, enTexte: string, precedent: Remplacement | undefined): string | undefined {
  if (locale === undefined || locale === enTexte) return undefined
  if (locale === null) return ABSENTE
  const synchroniseIci = locale === derniereValeurSynchronisee.get(key)
  if (precedent === undefined) return synchroniseIci ? undefined : empreinteDuTexte(locale)
  const enPlace = empreinteDuTexte(locale)
  if (precedent[1] === enPlace) return precedent[0]
  return synchroniseIci ? undefined : enPlace
}

/**
 * Note dans le navigateur ce que la restauration vient de remplacer, pour l'onglet dont c'était la modification en
 * attente (remplaceeParUneRestauration), avec les remplacements déjà notés pour ce compte dont le texte écrit semble
 * encore en place (même longueur : son empreinte n'est pas recalculée), dans la limite de REMPLACEMENTS_MAX pour chaque
 * sorte de marque — clé absente du navigateur, texte remplacé : les plus anciennes sont oubliées, puis les premières
 * dans l'ordre du serveur. Une sorte ne fait pas oublier l'autre : les marques de clés absentes (celles d'un navigateur
 * neuf, ou de clés créées ailleurs) faisaient sauter celle d'une saisie remplacée, et les marques de textes remplacés
 * celle d'une suppression (contre-relecture du 17/11/2026, huitième passe). Dans un stockage plein, une note qui
 * devrait grandir n'est pas réécrite : la marque nouvelle n'est pas écrite, et aucune marque déjà écrite n'en sort. Un
 * second essai, réduit aux REMPLACEMENTS_MAX marques les plus récentes toutes sortes confondues, a été retiré
 * (contre-relecture du 17/11/2026, dixième passe) : il chassait la marque d'une modification encore en attente au
 * profit d'une marque qui ne servait à rien (liste modifiée ailleurs, ou réécrite par l'application dans son ordre des
 * champs).
 */
function noterRemplacements(nouveaux: Map<string, Remplacement>): void {
  const compte = compteCourant
  if (compte === null || nouveaux.size === 0) return
  const registre = lireRegistreRemplacements()
  if (registre === 'autre') return
  const gardes = new Map<string, Remplacement>()
  if (registre && registre.compte === compte) {
    for (const [cle, r] of Object.entries(registre.remplacements)) {
      const locale = valeurLocale(cle)
      if (!nouveaux.has(cle) && typeof locale === 'string' && r[1].startsWith(`${locale.length.toString(36)}.`)) gardes.set(cle, r)
    }
  }
  for (const [cle, r] of nouveaux) gardes.set(cle, r)
  const tous = Array.from(gardes)
  const dernieres = (absente: boolean) => tous.filter(([, r]) => (r[0] === ABSENTE) === absente).slice(-REMPLACEMENTS_MAX)
  const retenus = new Set([...dernieres(true), ...dernieres(false)])
  const suivant: RegistreRemplacements = { v: 1, compte, remplacements: Object.fromEntries(tous.filter(e => retenus.has(e))) }
  try {
    ecrireSansMiroir(CLE_REMPLACEMENTS, JSON.stringify(suivant))
  } catch (erreur) {
    // Stockage plein : une modification remplacée par cette restauration cède au serveur (limite en tête du module).
    avertirUneFois('remplacements', '[storage-sync] remplacements de la restauration non notés dans le navigateur :', erreur)
  }
}

/**
 * Écriture faite dans cet onglet : la valeur en place est désormais celle de l'utilisateur. La note d'un remplacement
 * pour cette clé est effacée, pour qu'aucune modification en attente ailleurs ne repasse par-dessus. Une suppression
 * n'a rien à effacer : une note ne vaut que pour le texte que la restauration a écrit, jamais pour une clé absente.
 */
function oublierRemplacement(key: string): void {
  const brut = valeurLocale(CLE_REMPLACEMENTS)
  if (!brut || !brut.includes(JSON.stringify(key))) return
  const registre = lireRegistreRemplacements()
  if (registre === null || registre === 'autre' || !Object.prototype.hasOwnProperty.call(registre.remplacements, key)) return
  delete registre.remplacements[key]
  try {
    if (Object.keys(registre.remplacements).length === 0) supprimerSansMiroir(CLE_REMPLACEMENTS)
    else ecrireSansMiroir(CLE_REMPLACEMENTS, JSON.stringify(registre))
  } catch (erreur) {
    // Réécriture plus courte : elle passe même dans un stockage plein. Un échec laisse la note en place.
    avertirUneFois('remplacements-oubli', '[storage-sync] remplacement de la restauration non effacé du navigateur :', erreur)
  }
}

/**
 * Première modification non confirmée d'une clé : on retient ce que le serveur détenait alors, pour autant que cet
 * appareil le sache — la valeur du navigateur juste avant l'écriture (celle du serveur sur un appareil à jour),
 * sinon la dernière valeur synchronisée, sinon rien (clé tenue pour absente du serveur). Quand le navigateur détenait
 * autre chose que la dernière valeur synchronisée (la saisie d'un autre onglet, pas encore confirmée), celle-ci est
 * retenue aussi : si les deux envois échouent, le serveur la détient encore au nouvel essai (relecture du 16/11/2026).
 * Une modification suivante de la même clé garde la note, mais l'état est réécrit : il donne l'empreinte de la
 * dernière modification, seule à repartir après un rechargement.
 */
function noterBase(key: string, avant: string | null | undefined): void {
  if (!bases.has(key)) {
    const synchronisee = derniereValeurSynchronisee.get(key)
    const connue = avant === undefined ? synchronisee : avant
    const base: Base = { brut: connue ?? null }
    if (synchronisee !== undefined && synchronisee !== base.brut) base.synchro = synchronisee
    bases.set(key, base)
  }
  planifierEtat()
}

// ── Envois ───────────────────────────────────────────────────────────────────────────────────────────────────────

async function appeler(methode: 'POST' | 'DELETE', corps: string, jeton: string, keepalive: boolean): Promise<Issue> {
  try {
    const res = await fetch('/api/user-storage', {
      method: methode,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jeton}` },
      body: corps,
      keepalive,
    })
    if (res.ok) return 'ok'
    if (res.status === 400 || res.status === 413 || res.status === 422) return 'refuse'
    if (res.status === 401 || res.status === 429) return 'indisponible'
    return 'erreur'
  } catch {
    // Erreur réseau : le localStorage reste la source opérationnelle, l'envoi sera retenté.
    return 'indisponible'
  }
}

function poster(lot: EntreeAEnvoyer[], jeton: string, keepalive: boolean): Promise<Issue> {
  const corps = JSON.stringify({ entries: lot.map(e => ({ key: e.key, value: e.value })) })
  // keepalive: true survit au unload. Necessaire pour beforeunload + tablette
  // qui ferme la session avant la fin de la requete. Limite navigateur ~64 KB
  // par requete keepalive — au-dela on retire keepalive (le user verra ses
  // donnees au prochain login via hydrate).
  return appeler('POST', corps, jeton, keepalive && corps.length < 60_000)
}

/** La clé n'est plus tenue pour en échec : sa prochaine valeur repartira avec les envois groupés. */
function oublierEchecs(key: string): void {
  echecsServeur.delete(key)
  isolees.delete(key)
}

function compterUnEchec(key: string): void {
  echecsServeur.set(key, (echecsServeur.get(key) ?? 0) + 1)
}

/**
 * Faut-il garder la note de la clé quand le serveur vient de confirmer `confirmee` ? Oui si cet onglet a, pour elle, une
 * valeur plus récente : une écriture ou une suppression en attente d'envoi, ou une valeur écrite ici et toujours en
 * place dans le navigateur (partie dans un autre envoi dont la réponse n'est pas arrivée, par exemple). Oui encore si un
 * autre onglet l'y a remplacée par une valeur que cet onglet ne connaît pas (peut-être sa saisie, encore en route) : la
 * relecture suivante la laissera en place une fois au lieu de l'effacer, sans la renvoyer. Non si elle y a été remplacée
 * par une valeur que le serveur détenait avant, d'après ce que cet onglet en sait : la restauration d'un autre onglet,
 * lue avant l'arrivée de cet envoi, l'y a remise, et le serveur doit gagner (relectures des 15 et 16/11/2026). Non si la
 * clé a disparu du navigateur (stockage vidé hors de l'application, ou suppression faite dans un autre onglet, qui
 * l'envoie lui-même) : le serveur gagne à la relecture (une clé vidée hors de l'application, puis remise par la
 * restauration d'un autre onglet : voir les limites en tête du module). Ni si cet onglet n'a rien écrit de plus
 * récent : ce qu'un autre onglet a écrit depuis a son propre envoi. Ni, enfin, quand la clé n'a plus de note (levée à
 * une confirmation précédente, ou reprise du serveur) : cet onglet ne sait plus ce que le serveur détenait avant.
 * La valeur confirmée n'est reconnue qu'au caractère près : la même valeur réécrite dans un autre ordre des champs
 * passe pour une valeur que cet onglet ne connaît pas, et la note est gardée (DCF7).
 * Une suppression faite ici après la valeur confirmée, partie dans un autre envoi et encore en route, suit la même
 * règle : la note est gardée tant que la clé est absente du navigateur, ou qu'il détient une valeur que cet onglet ne
 * connaît pas ; elle est levée quand la restauration d'un autre onglet y a remis une valeur que le serveur détenait
 * avant, et la suppression, si elle échoue ensuite, est perdue (DCF2, dans les limites en tête du module). Garder la
 * note dans ce cas jusqu'à la réponse de la suppression (essayé à la neuvième passe, retiré à la onzième :
 * contre-relecture du 17/11/2026) faisait de la saisie confirmée la valeur d'avant de l'action suivante de l'onglet sur
 * la clé : quand la valeur remise par cette restauration était revenue au serveur avant cette action, celle-ci cédait
 * au nouvel essai sans repartir.
 */
function noteAGarder(key: string, confirmee: string, base: Base | undefined): boolean {
  if (pendingWrites.has(key) || pendingDeletes.has(key)) return true
  const ecriteIci = derniereEcritureIci.get(key)
  if (ecriteIci === undefined || ecriteIci === confirmee) return false
  const locale = valeurLocale(key)
  if (locale === undefined || locale === confirmee) return false
  if (locale === ecriteIci) return true
  if (locale === null || base === undefined) return false
  return !estConnue(locale, base)
}

/** Le serveur détient maintenant cette valeur. */
function confirmerEcriture(e: EntreeAEnvoyer): void {
  oublierEchecs(e.key)
  envoisIncertains.delete(e.key)
  const base = bases.get(e.key)
  derniereValeurSynchronisee.set(e.key, e.raw)
  // Même contenu : une seule chaîne en mémoire pour les deux (aller-retour A → B → A).
  if (derniereEcritureIci.get(e.key) === e.raw) derniereEcritureIci.set(e.key, e.raw)
  if (noteAGarder(e.key, e.raw, base)) {
    bases.set(e.key, { brut: e.raw, pourEcritureIci: true, ...anciennesTransmises(base) })
    planifierEtat()
  } else {
    oublierBase(e.key)
  }
}

function refuserEcriture(e: EntreeAEnvoyer): void {
  oublierEchecs(e.key)
  refusees.set(e.key, e.raw)
  avertirUneFois(`refus:${e.key}`, '[storage-sync] valeur refusée par le serveur, elle reste dans ce navigateur seulement :', e.key)
}

/**
 * Remet une écriture en attente après un envoi en échec, sauf si la clé a changé depuis (réécrite, supprimée, ou
 * remplacée par l'hydratation) : la valeur plus récente a son propre envoi, l'ancienne l'écraserait (aller-retour
 * A → B → A pendant un POST de B en échec).
 */
function remettreEnAttente(e: EntreeAEnvoyer): void {
  if (valeurLocale(e.key) !== e.raw) return
  pendingWrites.set(e.key, e.raw)
  // Valeur sans note (envoyée par « tout envoyer ») : on note ce que le serveur en détenait, pour autant que cet
  // appareil le sache. La note la protège à la relecture qui précède le nouvel essai, et après un rechargement. Cet
  // onglet ne l'a pas écrite lui-même, mais il en a maintenant la charge : c'est elle que la note protège.
  if (!derniereEcritureIci.has(e.key)) derniereEcritureIci.set(e.key, e.raw)
  noterBase(e.key, undefined)
}

/** Range l'issue d'un envoi pour une de ses valeurs. */
function conclure(e: EntreeAEnvoyer, issue: Issue, bilan: Bilan): void {
  if (issue === 'ok') {
    confirmerEcriture(e)
    bilan.reussies++
    return
  }
  if (issue === 'refuse') {
    refuserEcriture(e)
    return
  }
  if (issue === 'erreur') compterUnEchec(e.key)
  noterEnvoiIncertain(e)
  remettreEnAttente(e)
  bilan.panne = true
}

/**
 * Une valeur envoyée seule a reçu une réponse d'erreur du serveur. Est-ce elle qu'il ne parvient pas à enregistrer,
 * ou est-il en panne ? La fin de l'envoi tranche, selon que d'autres valeurs sont passées ou non (voir flushNow).
 */
function echouerSeule(e: EntreeAEnvoyer, bilan: Bilan): void {
  compterUnEchec(e.key)
  noterEnvoiIncertain(e)
  remettreEnAttente(e)
  bilan.seulesEnErreur.push(e)
}

/**
 * Envoie des valeurs une par une : celles d'un lot refusé en bloc, ou en erreur pour la deuxième fois. Tant que rien
 * ne passe, c'est le serveur qui est tenu pour en panne : la série s'arrête pour ne pas le marteler, et tout reste
 * en attente du nouvel essai.
 * `dejaIsolees` : valeurs déjà mises à part, retentées à leur tour — leur échec ne dit rien de l'état du serveur.
 * Renvoie false si la série a été interrompue : toutes les valeurs n'ont pas eu leur essai.
 */
async function envoyerUneParUne(entrees: EntreeAEnvoyer[], envoi: Envoi, bilan: Bilan, dejaIsolees = false): Promise<boolean> {
  // Les moins souvent en échec d'abord : une valeur que le serveur n'enregistre jamais ne doit pas, en tête de série,
  // faire prendre le serveur pour indisponible.
  const ordre = [...entrees].sort((a, b) => (echecsServeur.get(a.key) ?? 0) - (echecsServeur.get(b.key) ?? 0))
  let arret = false
  for (const e of ordre) {
    if (arret) {
      // Le nouvel essai leur est dû même si un autre lot du même envoi passe ensuite (relecture du 15/11/2026).
      remettreEnAttente(e)
      bilan.panne = true
      continue
    }
    marquerEnVol([e.key])
    let issue: Issue
    try {
      issue = await poster([e], envoi.jeton, envoi.keepalive)
    } finally {
      libererEnVol([e.key])
    }
    // Un autre compte s'est connecté pendant l'envoi : plus rien de cet envoi ne le concerne.
    if (compteCourant !== envoi.compte) return false
    if (issue !== 'erreur') {
      conclure(e, issue, bilan)
      // Pas de réponse, jeton refusé ou limite de débit : inutile d'adresser la suite de la série au serveur.
      if (issue === 'indisponible') arret = true
      continue
    }
    // Déjà à part : elle y reste, son échec ne dit rien du serveur.
    if (dejaIsolees) {
      compterUnEchec(e.key)
      noterEnvoiIncertain(e)
      remettreEnAttente(e)
      continue
    }
    echouerSeule(e, bilan)
    if (bilan.reussies === 0 && bilan.seulesEnErreur.length >= ECHECS_AVANT_ARRET) arret = true
  }
  return !arret
}

/**
 * Envoie un lot groupé. Refusé en bloc, ou en erreur alors qu'une de ses valeurs l'était déjà à l'envoi précédent, il
 * repart aussitôt valeur par valeur : une seule valeur ne doit pas bloquer les autres. Un lot en échec n'empêche pas
 * les suivants de partir : une valeur volumineuse qui ne passe pas ne retient pas celles des autres lots.
 */
async function envoyerLot(lot: EntreeAEnvoyer[], envoi: Envoi, bilan: Bilan): Promise<void> {
  const cles = lot.map(e => e.key)
  marquerEnVol(cles)
  try {
    const issue = await poster(lot, envoi.jeton, envoi.keepalive)
    // Un autre compte s'est connecté pendant l'envoi : plus rien de cet envoi ne le concerne.
    if (compteCourant !== envoi.compte) return
    const deuxiemeErreur = issue === 'erreur' && lot.some(e => echecsServeur.has(e.key))
    if (lot.length > 1 && (issue === 'refuse' || deuxiemeErreur)) await envoyerUneParUne(lot, envoi, bilan)
    // Seule dans son envoi (par sa taille, ou parce que rien d'autre n'attendait) : c'est déjà un envoi « une par une ».
    else if (deuxiemeErreur) echouerSeule(lot[0], bilan)
    else for (const e of lot) conclure(e, issue, bilan)
  } finally {
    libererEnVol(cles)
  }
}

/**
 * Fin d'un envoi : tranche le sort des valeurs en erreur alors qu'elles étaient seules dans leur envoi. Si d'autres
 * valeurs sont passées, le serveur répond : ce sont elles qu'il ne parvient pas à enregistrer, elles sont mises à
 * part et ne bloquent plus rien. Si rien n'est passé, c'est lui qui est en panne : tout attend le nouvel essai.
 */
function trancher(bilan: Bilan): void {
  if (bilan.seulesEnErreur.length === 0) return
  if (bilan.reussies === 0) {
    bilan.panne = true
    return
  }
  for (const e of bilan.seulesEnErreur) {
    isolees.set(e.key, e.raw)
    avertirUneFois(`isolee:${e.key}`, '[storage-sync] valeur que le serveur ne parvient pas à enregistrer, mise à part : elle reste dans ce navigateur et sera retentée seule :', e.key)
  }
}

/**
 * Fin d'un envoi (flushNow, pushAllLocalToServer) : tranche le sort des valeurs en erreur, programme le nouvel essai
 * de ce qui a été remis en attente, puis l'essai suivant des valeurs mises à part.
 */
function terminerEnvoi(bilan: Bilan): void {
  trancher(bilan)
  if (bilan.panne) {
    echecsEnvoi++
    // Garantie 2 : ce qui a été remis en attente ne repartira qu'après une nouvelle lecture du serveur.
    amorce = false
    planifierReessai()
  } else if (amorce) {
    echecsEnvoi = 0
  }
  planifierIsolees()
}

/** Envoie les suppressions en attente. */
async function envoyerSuppressions(envoi: Envoi, bilan: Bilan): Promise<void> {
  const cles = Array.from(pendingDeletes)
  pendingDeletes.clear()
  for (let debut = 0; debut < cles.length; debut += FLUSH_BATCH_SIZE) {
    const lot = cles.slice(debut, debut + FLUSH_BATCH_SIZE)
    const issue = await appeler('DELETE', JSON.stringify({ keys: lot }), envoi.jeton, envoi.keepalive)
    if (compteCourant !== envoi.compte) return
    if (issue === 'refuse') avertirUneFois('refus-suppression', '[storage-sync] suppression refusée par le serveur :', lot)
    for (const cle of lot) {
      // La clé a été réécrite pendant l'appel : son écriture a son propre envoi.
      if (pendingWrites.has(cle)) {
        if (issue === 'ok') bases.set(cle, { brut: null })
        continue
      }
      if (issue === 'ok') oublierBase(cle)
      // Remise en attente tant que la dernière action de cet onglet sur la clé est cette suppression, même si le
      // navigateur détient de nouveau une valeur : la relecture qui précède le nouvel essai tranche. La valeur que la
      // restauration d'un autre onglet a remise à sa place (marquée) n'arrête pas la suppression ; celle qu'un autre
      // onglet a écrite l'arrête (le serveur gagne, ou elle est laissée en place) ; une clé que le serveur n'a plus ne la
      // fait pas repartir (reprendreUneCleAbsente). Recréée ici, la clé a son propre envoi : la supprimer effacerait du
      // serveur une valeur présente ici (relecture du 14/11/2026, contre-relecture du 17/11/2026). Seulement si elle a
      // encore sa note : une relecture faite pendant l'envoi, qui a trouvé la clé absente du serveur, l'a tenue pour
      // faite et a levé la note. Remise en attente sans note, elle échappait à la relecture du nouvel essai et
      // repartait sans contrôle, par-dessus une valeur recréée entre-temps ailleurs (contre-relecture du 17/11/2026,
      // huitième passe). La confirmation d'un envoi plus ancien de la même clé, arrivée pendant celui de la
      // suppression, peut aussi l'avoir levée : la suppression est alors perdue (noteAGarder ; DCF2 en tête du module).
      else if (issue !== 'refuse' && derniereEcritureIci.get(cle) === null && bases.has(cle)) {
        pendingDeletes.add(cle)
        bilan.panne = true
      }
    }
  }
}

/**
 * Programme le nouvel essai d'un envoi en échec. Il commence par une restauration (garantie 2) : ce qui attend ne
 * repart que si le serveur détient toujours la valeur d'avant ; s'il en détient une autre, il gagne.
 */
function planifierReessai(): void {
  minuteurReessai = arreter(minuteurReessai)
  minuteurReessai = setTimeout(() => {
    minuteurReessai = null
    // Une restauration déjà en cours ou déjà programmée fera le même travail.
    if (hydratationsEnCours === 0 && !minuteurHydratation) void hydrateStorageFromServer()
  }, delaiDeReessai(echecsEnvoi))
}

/** Reste-t-il des valeurs mises à part en attente ? Oublie celles qui n'attendent plus (reprises du serveur, modifiées dans un autre onglet). */
function resteDesIsolees(): boolean {
  for (const cle of Array.from(isolees.keys())) {
    if (!pendingWrites.has(cle) && !postsEnVol.has(cle)) oublierEchecs(cle)
  }
  return isolees.size > 0
}

/**
 * Programme l'essai suivant des valeurs mises à part : seules, de loin en loin, et comme tout nouvel essai après une
 * nouvelle lecture du serveur (garantie 2). Un seul minuteur, qui s'arrête quand plus rien n'est à part.
 */
function planifierIsolees(): void {
  if (!resteDesIsolees()) {
    essaisIsolees = 0
    minuteurIsolees = arreter(minuteurIsolees)
    return
  }
  if (minuteurIsolees) return
  minuteurIsolees = setTimeout(() => {
    minuteurIsolees = null
    if (!resteDesIsolees()) return
    essaisIsolees++
    isoleesPermises = true
    amorce = false
    void hydrateStorageFromServer()
  }, DELAIS_VALEUR_ISOLEE_MS[Math.min(essaisIsolees, DELAIS_VALEUR_ISOLEE_MS.length - 1)])
}

function planifierNouvelleHydratation(): void {
  if (minuteurHydratation) return
  const delai = delaiDeReessai(echecsHydratation)
  if (echecsHydratation > 0) {
    console.warn(`[storage-sync] restauration depuis le serveur impossible, nouvel essai dans ${delai / 1000} s ; rien n'est envoyé d'ici là`)
  }
  minuteurHydratation = setTimeout(() => {
    minuteurHydratation = null
    void hydrateStorageFromServer()
  }, delai)
}

async function flushNow(opts: { keepalive?: boolean } = {}): Promise<void> {
  // Rien ne part pendant l'hydratation : une écriture faite au montage avant la réponse du serveur (jeu par défaut
  // de la bibliothèque ou des prestations, données de démo) écraserait la vraie valeur, saisie sur un autre appareil.
  // L'envoi keepalive de fermeture d'onglet est retenu lui aussi, par choix : si l'onglet se ferme avant la réponse,
  // ces écritures restent dans le localStorage et dans les notes du miroir, et repartiront à la prochaine visite.
  if (hydratationsEnCours > 0) return
  if (pendingWrites.size === 0 && pendingDeletes.size === 0) return
  const qui = await identite()
  if (!qui) return
  if (adopterCompte(qui.compte)) return
  // Garanties 1 et 2 : sans restauration réussie depuis le chargement de la page ou depuis le dernier envoi en échec,
  // on ne sait pas ce que détient le serveur. Après un échec, le nouvel essai est déjà programmé et commencera par
  // relire le serveur (planifierReessai) : d'ici là rien ne part, ni à chaque frappe, ni à la fermeture de l'onglet.
  // Ce qui attend reste dans le navigateur et dans les notes du miroir.
  if (!amorce) {
    if (hydratationsEnCours === 0 && !minuteurReessai) planifierNouvelleHydratation()
    return
  }
  // Une hydratation a pu commencer pendant la lecture du jeton.
  if (hydratationsEnCours > 0) return

  const compte = compteCourant
  const avecLesIsolees = isoleesPermises
  isoleesPermises = false
  const groupees: EntreeAEnvoyer[] = []
  const aPart: EntreeAEnvoyer[] = []
  for (const [key, raw] of Array.from(pendingWrites)) {
    // Une autre valeur que celle mise à part pour cette clé (saisie depuis, même pendant l'envoi qui l'a mise à part)
    // n'est plus en cause : elle part avec les envois ordinaires. Réécrite à l'identique (montage du tableau de bord),
    // la valeur en cause reste à part (relecture du 15/11/2026). Les échecs de la clé restent comptés : si le serveur
    // n'enregistre pas davantage la nouvelle valeur, l'envoi groupé repart aussitôt valeur par valeur, sans relecture
    // du serveur ni retard pour les valeurs voisines (relecture du 16/11/2026).
    if (isolees.has(key) && isolees.get(key) !== raw) isolees.delete(key)
    const isolee = isolees.has(key)
    // Valeur mise à part : elle reste en file jusqu'à son propre essai (planifierIsolees).
    if (isolee && !avecLesIsolees) continue
    // Retirée IMMÉDIATEMENT de la file, pour ne pas réémettre la même entrée si une écriture survient pendant
    // l'envoi (perte d'idempotence sinon).
    pendingWrites.delete(key)
    const entree = { key, value: versServeur(raw), raw }
    let envoyable = false
    try { envoyable = JSON.stringify(entree.value).length <= MAX_VALUE_BYTES } catch { envoyable = false }
    if (!envoyable) refuserEcriture(entree)
    else if (isolee) aPart.push(entree)
    else groupees.push(entree)
  }

  const bilan: Bilan = { reussies: 0, panne: false, seulesEnErreur: [] }
  const envoi: Envoi = { jeton: qui.jeton, keepalive: opts.keepalive === true, compte }
  // Un seul POST avec toutes les clés modifiées, tant que le nombre et la taille le permettent.
  for (const lot of grouperEnLots(groupees)) {
    await envoyerLot(lot, envoi, bilan)
    if (compteCourant !== compte) return
  }
  const isoleesTentees = await envoyerUneParUne(aPart, envoi, bilan, true)
  if (compteCourant !== compte) return
  await envoyerSuppressions(envoi, bilan)
  if (compteCourant !== compte) return

  // Série interrompue (le serveur ne répondait plus) : l'essai des valeurs mises à part leur reste dû.
  if (avecLesIsolees && !isoleesTentees) isoleesPermises = true
  terminerEnvoi(bilan)
}

function scheduleFlush() {
  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = setTimeout(() => { flushNow() }, DEBOUNCE_MS)
}

/**
 * Cœur du miroir, appelé par le setItem intercepté. Une valeur identique à la dernière synchronisée n'est pas
 * renvoyée (lot 8 Sentry : réécritures à l'identique au montage du dashboard), sauf si une autre valeur de la clé
 * attend son envoi ou est en cours d'envoi : sinon l'aller-retour A → B → A (double-clic sur une bascule) enverrait
 * B, ou laisserait B au serveur au retour de son POST.
 * `avant` : valeur de la clé dans le navigateur juste avant l'écriture (null si elle n'existait pas) ; sans elle, la
 * clé est tenue pour inconnue du serveur. Exporté pour les tests.
 */
export function enregistrerEcritureMiroir(key: string, value: string, avant?: string | null): void {
  if (!shouldSync(key)) return
  // Même identique à la valeur en place, l'écriture est celle de l'utilisateur : plus aucune modification en attente
  // ailleurs ne repasse par-dessus au titre d'un remplacement par une restauration (relecture du 17/11/2026).
  oublierRemplacement(key)
  // Réécriture à l'identique (montage du tableau de bord) : la chaîne de la valeur synchronisée sert aussi ici, sans
  // seconde copie en mémoire.
  const synchronisee = derniereValeurSynchronisee.get(key)
  derniereEcritureIci.set(key, synchronisee === value ? synchronisee : value)
  if (synchronisee === value && !pendingWrites.has(key) && !postsEnVol.has(key) && !bases.has(key)) return
  noterBase(key, avant)
  if (refusees.get(key) !== value) refusees.delete(key)
  pendingWrites.set(key, value)
  pendingDeletes.delete(key) // annule un eventuel delete en attente
  scheduleFlush()
}

/** Cœur du miroir pour removeItem : la clé sera renvoyée si elle est réécrite ensuite. */
export function enregistrerSuppressionMiroir(key: string, avant?: string | null): void {
  if (!shouldSync(key)) return
  derniereEcritureIci.set(key, null)
  noterBase(key, avant)
  derniereValeurSynchronisee.delete(key)
  refusees.delete(key)
  // La valeur que le serveur n'enregistrait pas n'existe plus : la suppression part avec les envois ordinaires.
  oublierEchecs(key)
  pendingDeletes.add(key)
  pendingWrites.delete(key)
  scheduleFlush()
}

/** Lots d'envoi : jusqu'à FLUSH_BATCH_SIZE clés et FLUSH_BATCH_BYTES de valeurs par POST (un seul lot en général). */
function grouperEnLots(entries: EntreeAEnvoyer[]): EntreeAEnvoyer[][] {
  const lots: EntreeAEnvoyer[][] = []
  let tailleLot = 0
  for (const e of entries) {
    const dernier = lots[lots.length - 1]
    if (dernier && dernier.length < FLUSH_BATCH_SIZE && tailleLot + e.raw.length <= FLUSH_BATCH_BYTES) {
      dernier.push(e)
      tailleLot += e.raw.length
    } else {
      lots.push([e])
      tailleLot = e.raw.length
    }
  }
  return lots
}

// ── Restauration depuis le serveur ───────────────────────────────────────────────────────────────────────────────

/** Remet en attente d'envoi la valeur actuelle du navigateur pour cette clé (ou sa suppression). */
function remettreLaValeurLocaleEnAttente(key: string, locale: string | null | undefined = valeurLocale(key)): void {
  if (locale === undefined) return
  if (locale === null) {
    pendingWrites.delete(key)
    pendingDeletes.add(key)
    return
  }
  if (refusees.get(key) === locale) return
  pendingDeletes.delete(key)
  pendingWrites.set(key, locale)
}

/** La valeur en place est une modification notée dans l'état : cet onglet la prend en charge et la renvoie. */
function prendreEnCharge(key: string, locale: string | null, note: NoteEtat): void {
  bases.set(key, { empreinte: note.base })
  derniereEcritureIci.set(key, locale)
  remettreLaValeurLocaleEnAttente(key, locale)
}

/**
 * Garantie 2, pour une clé que le serveur détient : sa valeur gagne (« serveur »), sauf si le navigateur porte une
 * modification pas encore confirmée ET que le serveur détient toujours la valeur d'avant cette modification — elle est
 * alors gardée et renvoyée (« garder »). Seule repart la modification elle-même (relecture du 16/11/2026) : la dernière
 * valeur écrite par cet onglet, ou celle dont la note de l'état donne l'empreinte (`note` : note d'un autre onglet, ou de
 * cet onglet avant un rechargement). Une valeur que cet onglet n'a pas écrite peut être plus ancienne que celle du
 * serveur — la restauration d'un autre onglet, lue avant l'arrivée d'un envoi, remet ce qu'elle a lu, y compris une
 * valeur venue d'un autre appareil : la renvoyer écraserait la dernière saisie.
 * `locale` : la valeur du navigateur, lue par la restauration ; `remplacement` : ce qu'une restauration a noté pour la
 * clé (voir remplaceeParUneRestauration).
 */
function issueDeLaRelecture(key: string, valeur: unknown, enTexte: string, locale: string | null | undefined, note: NoteEtat | undefined, remplacement: Remplacement | undefined): Relecture {
  const base = bases.get(key)
  if (!base && note === undefined) return 'serveur'
  // Stockage illisible : rien à garder ni à envoyer.
  if (locale === undefined) return 'serveur'
  if (base) return issuePourLaNoteDIci(key, base, locale, valeur, enTexte, remplacement)
  if (locale === enTexte || note === undefined || !estLaValeurNotee(locale, note) || !serveurDetientLaBaseNotee(note, valeur)) return 'serveur'
  prendreEnCharge(key, locale, note)
  return 'garder'
}

/**
 * Relecture d'une clé modifiée ici.
 *  - La valeur écrite ici est en place : gardée et renvoyée si le serveur détient encore la valeur d'avant (voir
 *    serveurDetientLaValeurDAvant), sinon le serveur gagne (écrite ailleurs entre-temps).
 *  - Une restauration l'a remplacée alors qu'elle attendait son nouvel essai (remplaceeParUneRestauration) : elle est
 *    remise dans le navigateur et repart aux mêmes conditions — une suppression aussi. Une restauration ne dit rien de
 *    ce que veut l'utilisateur : elle a remis ce que le serveur détenait, ou détenait au moment de la lire.
 *  - Sinon, un autre onglet a écrit à sa place, ou le stockage a été vidé hors de l'application. Le serveur gagne si la
 *    clé a disparu (une suppression faite dans un autre onglet part de cet onglet-là), si la valeur en place est la
 *    sienne (choisie par l'utilisateur dans un autre onglet, même identique à la valeur d'avant), s'il a reçu autre chose
 *    depuis, ou si la valeur en place est l'une de celles qu'il a détenues avant, d'après ce que cet onglet en sait.
 *    Toute autre valeur peut être la saisie de l'autre onglet, encore en route : elle reste en place pour cette relecture
 *    (« laisser »), sans repartir d'ici — son onglet l'envoie lui-même, et un envoi en échec se remet en attente tant
 *    qu'elle est en place. La modification d'ici est alors abandonnée (laisserEnPlace).
 */
function issuePourLaNoteDIci(key: string, base: Base, locale: string | null, valeur: unknown, enTexte: string, remplacement: Remplacement | undefined): Relecture {
  const ecriteIci = derniereEcritureIci.get(key)
  if (ecriteIci === undefined) return 'serveur'
  if (locale === ecriteIci) {
    // Déjà identique au serveur : rien à renvoyer.
    if (locale === enTexte || !serveurDetientLaValeurDAvant(key, base, valeur, enTexte)) return 'serveur'
    remettreLaValeurLocaleEnAttente(key, locale)
    return 'garder'
  }
  if (remplaceeParUneRestauration(key, ecriteIci, locale, remplacement)) {
    if (ecriteIci === enTexte || !serveurDetientLaValeurDAvant(key, base, valeur, enTexte)) return 'serveur'
    remettreDansLeNavigateur(key, ecriteIci)
    return 'garder'
  }
  if (locale === null || locale === enTexte) return 'serveur'
  if (!serveurDetientLaValeurDAvant(key, base, valeur, enTexte) || estConnue(locale, base)) return 'serveur'
  return 'laisser'
}

/**
 * La valeur en place est-elle celle qu'une restauration a écrite à la place de la modification faite ici (`ecriteIci`,
 * null pour une suppression), qui attend son nouvel essai (remise en attente après un échec) ? La restauration note ce
 * qu'elle remplace (noterRemplacements) et toute écriture faite depuis dans un onglet efface la note
 * (oublierRemplacement) : la valeur en place n'est alors pas un choix de l'utilisateur. Une modification encore en route
 * n'est pas concernée : sans réponse, rien ne dit qu'elle n'est pas déjà arrivée.
 */
function remplaceeParUneRestauration(key: string, ecriteIci: string | null, locale: string | null, remplacement: Remplacement | undefined): boolean {
  if (remplacement === undefined || locale === null) return false
  const enAttente = ecriteIci === null ? pendingDeletes.has(key) : pendingWrites.get(key) === ecriteIci
  if (!enAttente) return false
  const [remplace, par] = remplacement
  return remplace === (ecriteIci === null ? ABSENTE : empreinteDuTexte(ecriteIci)) && par === empreinteDuTexte(locale)
}

/** Remet dans le navigateur la modification d'ici (ou la suppression) qu'une restauration avait remplacée ; elle part. */
function remettreDansLeNavigateur(key: string, ecriteIci: string | null): void {
  try {
    if (ecriteIci === null) supprimerSansMiroir(key)
    else ecrireSansMiroir(key, ecriteIci)
  } catch (erreur) {
    // Stockage plein : la saisie part quand même, comme avant ce miroir ; le navigateur garde la valeur du serveur.
    avertirUneFois(`reprise:${key}`, '[storage-sync] saisie en attente non remise dans le navigateur (stockage plein) :', erreur)
  }
}

/**
 * La valeur d'un autre onglet reste en place, sans repartir d'ici (voir issuePourLaNoteDIci). Ce que cet onglet avait
 * écrit avant elle ne part plus, et sa note est levée : la relecture suivante tranche, comme sans note.
 */
function laisserEnPlace(key: string): void {
  pendingWrites.delete(key)
  pendingDeletes.delete(key)
  bases.delete(key)
  confirmees.add(key)
  oublierEchecs(key)
  envoisIncertains.delete(key)
  derniereEcritureIci.delete(key)
}

/**
 * Clé modifiée ici, ou notée dans l'état, que le serveur ne détient pas du tout (créée dans ce navigateur, jamais
 * partie) : elle part, comme avant — mais seulement la modification elle-même, jamais une valeur qu'un autre onglet a
 * écrite à sa place.
 */
function reprendreUneCleAbsente(key: string, note: NoteEtat | undefined): void {
  const locale = valeurLocale(key)
  if (locale === undefined) return
  // Absente du serveur : une suppression faite ici est faite, rien à renvoyer, même si son envoi est encore en route
  // (sa note levée, elle n'est pas remise en attente si sa réponse se perd : voir envoyerSuppressions). Une note de
  // l'état n'est levée que 3 s après la confirmation : relue entre-temps, elle renvoyait une suppression déjà faite
  // (relecture du 17/11/2026). De même si le navigateur détient de nouveau une valeur, écrite depuis dans un autre
  // onglet (qui l'envoie lui-même) ou remise par une restauration : renvoyée, la suppression effacerait du serveur la
  // valeur arrivée entre-temps (contre-relecture du 17/11/2026).
  if (bases.has(key) && derniereEcritureIci.get(key) === null) {
    pendingDeletes.delete(key)
    oublierBase(key)
    return
  }
  if (locale === null) return
  if (bases.has(key)) {
    if (derniereEcritureIci.has(key) && locale === derniereEcritureIci.get(key)) remettreLaValeurLocaleEnAttente(key, locale)
    return
  }
  if (note !== undefined && estLaValeurNotee(locale, note)) prendreEnCharge(key, locale, note)
}

/** Notes de l'état, par clé : l'empreinte de la valeur d'avant, et celle de la modification si l'état la donne. */
function notesDeLEtat(etat: EtatMiroir): Map<string, NoteEtat> {
  const notes = new Map<string, NoteEtat>()
  for (const [cle, base] of Object.entries(etat.attente)) {
    const valeur = etat.valeurs && Object.prototype.hasOwnProperty.call(etat.valeurs, cle) ? etat.valeurs[cle] : undefined
    notes.set(cle, valeur === undefined ? { base } : { base, valeur })
  }
  return notes
}

/**
 * Hydrate le localStorage depuis la DB pour l'utilisateur connecte.
 * Providers l'appelle après installStorageSync() : les valeurs reçues sont écrites sans repasser par le miroir. Le
 * serveur gagne, sauf pour une clé modifiée ici dont il détient toujours l'ancienne valeur (voir
 * issueDeLaRelecture). Les envois sont retenus jusqu'à la fin ; ils ne commencent qu'après une restauration
 * réussie pour ce compte, et un échec (réseau, 429, 500) est retenté seul.
 */
export async function hydrateStorageFromServer(): Promise<ResultatHydratation> {
  // Lisible suffit : un stockage plein accepte encore toute valeur qui ne l'agrandit pas (entrées inchangées depuis la
  // dernière synchronisation, valeurs raccourcies sur un autre appareil) ; une écriture refusée est ignorée plus bas.
  if (typeof window === 'undefined' || !isStorageReadable('local')) return { ...SANS_RESTAURATION }
  hydratationsEnCours++
  try {
    return await hydraterDepuisLeServeur()
  } finally {
    hydratationsEnCours--
    if (hydratationsEnCours === 0) {
      if (amorce) {
        hydratationARetenter = false
        synchroniserEtat()
        // Clés absentes du serveur, modifications gardées : l'envoi retenu est relancé. Plus rien n'attend (le
        // serveur a gagné partout) : la série d'échecs d'envoi est close.
        if (pendingWrites.size > 0 || pendingDeletes.size > 0) scheduleFlush()
        else echecsEnvoi = 0
      } else {
        // Restauration en échec : ce qui a été modifié ici reste noté dans le navigateur, pour la prochaine visite.
        if (bases.size > 0) planifierEtat()
        if (hydratationARetenter) {
          hydratationARetenter = false
          planifierNouvelleHydratation()
        }
      }
    }
  }
}

function echecDeRestauration(): ResultatHydratation {
  echecsHydratation++
  hydratationARetenter = true
  return { ...SANS_RESTAURATION }
}

async function hydraterDepuisLeServeur(): Promise<ResultatHydratation> {
  // Pas de session : rien à restaurer, et rien à retenter.
  const qui = await identite()
  if (!qui) return { ...SANS_RESTAURATION }
  adopterCompte(qui.compte)
  const compte = compteCourant

  let entries: Record<string, unknown>
  let identifiants: unknown
  try {
    const res = await fetch('/api/user-storage', {
      headers: { Authorization: `Bearer ${qui.jeton}` },
    })
    if (!res.ok) return echecDeRestauration()
    const json = await res.json() as { entries?: unknown; identifiants?: unknown } | null
    // Réponse sans la liste des valeurs : elle ne dit pas ce que détient le serveur. La tenir pour « rien » ouvrirait
    // la voie à « tout envoyer » (garantie 1).
    const recues = json?.entries
    if (recues === null || typeof recues !== 'object' || Array.isArray(recues)) return echecDeRestauration()
    entries = recues as Record<string, unknown>
    identifiants = json?.identifiants
  } catch {
    return echecDeRestauration()
  }
  // Un autre compte s'est connecté pendant l'appel : cette réponse ne le concerne pas.
  if (compteCourant !== compte) return { ...SANS_RESTAURATION }

  const brutEtat = lireEtatBrut()
  const etat = lireEtat(brutEtat)
  const autreCompte = compte !== null && comptesVus(brutEtat).some(c => c !== compte)
  const notesAilleurs = compte !== null && etat?.compte === compte ? notesDeLEtat(etat) : new Map<string, NoteEtat>()

  const remplacements = lireRemplacements()
  const nouveauxRemplacements = new Map<string, Remplacement>()
  let count = 0
  let ecrituresRefusees = 0
  for (const [key, value] of Object.entries(entries)) {
    // On ecrit la valeur en string. Si c'est deja une primitive (string),
    // on la stocke telle quelle ; sinon JSON.stringify.
    const enTexte = typeof value === 'string' ? value : JSON.stringify(value)
    const locale = valeurLocale(key)
    const issue = issueDeLaRelecture(key, value, enTexte, locale, notesAilleurs.get(key), remplacements.get(key))
    if (issue === 'garder') continue
    if (issue === 'laisser') {
      laisserEnPlace(key)
      continue
    }
    // Ce que la valeur du serveur remplace peut être la modification d'un autre onglet, en attente de son nouvel essai :
    // noté pour lui (noterRemplacements), avant que cet onglet n'oublie ce qu'il avait écrit ou synchronisé.
    const remplace = texteRemplace(key, locale, enTexte, remplacements.get(key))
    // Le serveur gagne : une écriture faite au montage avant la réponse (jeu par défaut, données de démo) ne part
    // pas écraser la vraie valeur. Retirée avant l'écriture locale, qui peut échouer (quota).
    pendingWrites.delete(key)
    pendingDeletes.delete(key)
    bases.delete(key)
    confirmees.add(key)
    oublierEchecs(key)
    envoisIncertains.delete(key)
    try {
      // setItem d'origine : une valeur reçue du serveur ne doit jamais repartir en POST (lot 8 Sentry :
      // Providers installe le miroir avant d'hydrater, chaque clé hydratée était renvoyée).
      ecrireSansMiroir(key, enTexte)
      if (remplace !== undefined) nouveauxRemplacements.set(key, [remplace, empreinteDuTexte(enTexte)])
      derniereValeurSynchronisee.set(key, enTexte)
      // Ce que cet onglet avait écrit n'est plus en place : inutile de le garder en mémoire (valeur de plusieurs Mo).
      // Resté le même, il est tenu par la même chaîne que la valeur synchronisée, sans seconde copie.
      if (derniereEcritureIci.get(key) === enTexte) derniereEcritureIci.set(key, enTexte)
      else derniereEcritureIci.delete(key)
      count++
    } catch {
      // Stockage plein : la valeur du navigateur reste en place.
      ecrituresRefusees++
    }
  }
  if (ecrituresRefusees > 0) console.warn(`[storage-sync] ${ecrituresRefusees} valeur(s) du serveur non écrite(s) dans ce navigateur (stockage plein)`)
  noterRemplacements(nouveauxRemplacements)

  // Modifications d'ici que le serveur ne détient pas du tout (clé créée dans ce navigateur, jamais partie) : elles
  // partent, comme avant.
  for (const key of new Set([...bases.keys(), ...notesAilleurs.keys()])) {
    if (!Object.prototype.hasOwnProperty.call(entries, key)) reprendreUneCleAbsente(key, notesAilleurs.get(key))
  }

  amorce = true
  echecsHydratation = 0
  minuteurHydratation = arreter(minuteurHydratation)
  // Le serveur vient d'être relu : ce qui attendait un nouvel essai peut repartir sans attendre son délai. Le compte
  // des échecs d'envoi, lui, court jusqu'au prochain envoi réussi : sinon un serveur qui répond aux lectures mais
  // refuse les envois serait sollicité toutes les 5 s.
  minuteurReessai = arreter(minuteurReessai)
  // Ce que « tout envoyer » a le droit de faire pour ce compte (pushAllLocalToServer).
  serveurVide = Object.keys(entries).length === 0
  autreCompteVu = autreCompte
  identifiantsDuCompte.clear()
  // Sans la liste du serveur (fiche du compte illisible), on ne sait pas sous quels identifiants ce compte range ses
  // clés : « tout envoyer » attend une restauration qui la donne (relecture du 15/11/2026).
  identifiantsDonnes = Array.isArray(identifiants)
  const donnes: unknown[] = Array.isArray(identifiants) ? identifiants : []
  for (const identifiant of [compte, ...donnes]) {
    if (typeof identifiant === 'string' && identifiant !== '') identifiantsDuCompte.add(identifiant.toLowerCase())
  }
  return { count, ok: true, vide: serveurVide, autreCompte }
}

// ── Interception des écritures ───────────────────────────────────────────────────────────────────────────────────

interface RegistreMiroir {
  prototype: Storage
  stockage: Storage
  setItem: Storage['setItem']
  removeItem: Storage['removeItem']
  getItem: Storage['getItem']
  surEcriture: ((key: string, value: string, avant: string | null | undefined) => void) | null
  surSuppression: ((key: string, avant: string | null | undefined) => void) | null
}

const CLE_REGISTRE = '__vitfixMiroirStockage'

function registreGlobal(): Record<string, RegistreMiroir | undefined> {
  return globalThis as unknown as Record<string, RegistreMiroir | undefined>
}

/** Faut-il lire la valeur d'avant l'écriture ? Seulement pour une clé suivie qui n'a pas déjà de modification notée. */
function valeurAvant(lire: () => string | null, key: string): string | null | undefined {
  if (bases.has(key) || !shouldSync(key)) return undefined
  try {
    return lire()
  } catch {
    // Lecture refusée : la clé sera tenue pour inconnue du serveur.
    return undefined
  }
}

/**
 * Remplace setItem / removeItem sur Storage.prototype, pour le seul localStorage. Affecter
 * `localStorage.setItem = …` ne marche que sur Chromium : la norme (suivie par Firefox et par jsdom) y voit
 * l'enregistrement d'une entrée nommée « setItem », et aucune écriture n'était alors sauvegardée en ligne.
 * Le remplacement n'est posé qu'une fois par page, même si le module est rechargé : seuls les rappels changent.
 */
function intercepterLePrototype(stockage: Storage): void {
  const prototype = Storage.prototype
  let registre = registreGlobal()[CLE_REGISTRE]
  if (!registre || registre.prototype !== prototype) {
    const neuf: RegistreMiroir = {
      prototype,
      stockage,
      setItem: prototype.setItem,
      removeItem: prototype.removeItem,
      getItem: prototype.getItem,
      surEcriture: null,
      surSuppression: null,
    }
    // Appel incomplet, autre stockage (sessionStorage) ou miroir débranché : la fonction d'origine, telle quelle.
    prototype.setItem = function setItem(this: Storage, ...args: string[]): void {
      if (this !== neuf.stockage || !neuf.surEcriture || args.length < 2) {
        neuf.setItem.apply(this, args as [string, string])
        return
      }
      const key = String(args[0])
      const value = String(args[1])
      const avant = valeurAvant(() => neuf.getItem.call(this, key), key)
      neuf.setItem.call(this, key, value)
      neuf.surEcriture(key, value, avant)
    }
    prototype.removeItem = function removeItem(this: Storage, ...args: string[]): void {
      if (this !== neuf.stockage || !neuf.surSuppression || args.length < 1) {
        neuf.removeItem.apply(this, args as [string])
        return
      }
      const key = String(args[0])
      const avant = valeurAvant(() => neuf.getItem.call(this, key), key)
      neuf.removeItem.call(this, key)
      neuf.surSuppression(key, avant)
    }
    registreGlobal()[CLE_REGISTRE] = neuf
    registre = neuf
  }
  const actif = registre
  actif.stockage = stockage
  actif.surEcriture = enregistrerEcritureMiroir
  actif.surSuppression = enregistrerSuppressionMiroir
  ecrireSansMiroirRef = (key, value) => { actif.setItem.call(stockage, key, value) }
  supprimerSansMiroirRef = (key) => { actif.removeItem.call(stockage, key) }
}

/** Stockage qui n'est pas un vrai Storage (double de test) : le remplacement se fait sur l'objet lui-même. */
function intercepterLObjet(stockage: Storage): void {
  const origSet = stockage.setItem.bind(stockage)
  const origRemove = stockage.removeItem.bind(stockage)
  ecrireSansMiroirRef = origSet
  supprimerSansMiroirRef = origRemove

  stockage.setItem = (key: string, value: string) => {
    const avant = valeurAvant(() => stockage.getItem(key), key)
    origSet(key, value)
    enregistrerEcritureMiroir(key, value, avant)
  }

  stockage.removeItem = (key: string) => {
    const avant = valeurAvant(() => stockage.getItem(key), key)
    origRemove(key)
    enregistrerSuppressionMiroir(key, avant)
  }
}

/** Fermeture ou mise en arrière-plan de l'onglet : dernière chance d'envoyer, et de noter ce qui n'est pas parti. */
function avantDeQuitter(): void {
  if (pendingWrites.size > 0 || pendingDeletes.size > 0) void flushNow({ keepalive: true })
  if (bases.size > 0 || confirmees.size > 0) synchroniserEtat()
}

/**
 * Le réseau revient : on n'attend pas. Si une restauration est due — première lecture du serveur, ou relecture avant
 * le nouvel essai d'un envoi en échec — elle part tout de suite ; sinon, ce qui attend est envoyé.
 */
function reprendre(): void {
  if (amorce) {
    void flushNow()
    return
  }
  if (compteCourant === null && pendingWrites.size === 0 && pendingDeletes.size === 0) return
  minuteurHydratation = arreter(minuteurHydratation)
  minuteurReessai = arreter(minuteurReessai)
  void hydrateStorageFromServer()
}

/**
 * Installe le miroir : intercepte localStorage.setItem / removeItem pour
 * mirroir vers la DB en debounce. Idempotent (safe si rappele).
 */
export function installStorageSync(): void {
  if (typeof window === 'undefined') return
  if (installed) return
  installed = true

  // Stockage bloqué par le navigateur (réglage « bloquer les données des sites », iframe sandboxée, certaines
  // webviews) : la simple lecture de window.localStorage lève une SecurityError. Appelé sur chaque page par
  // Providers : sans ce garde, ces visiteurs tombaient sur une erreur (Sentry G, S). Pas de miroir possible, le site
  // reste utilisable. Un stockage plein ou en lecture seule reste lisible : le miroir est posé, car suppressions et
  // réécritures plus courtes y réussissent et doivent être répliquées ; une écriture refusée lève comme sans miroir
  // et n'est pas répliquée.
  if (!isStorageReadable('local')) {
    console.warn('[storage-sync] localStorage inaccessible, miroir désactivé :', 'lecture du stockage impossible (bloqué par le navigateur ou absent)')
    return
  }

  try {
    const stockage = window.localStorage
    if (typeof Storage !== 'undefined' && stockage instanceof Storage) intercepterLePrototype(stockage)
    else intercepterLObjet(stockage)
  } catch (error) {
    // Objet Storage non modifiable (navigateur exotique) : pas de miroir, mais aucune erreur pour le visiteur.
    console.warn('[storage-sync] miroir non installé :', error)
    return
  }

  // Flush a la fermeture de l'onglet pour ne pas perdre les pending writes.
  // Utilisation de fetch keepalive: true qui survit au unload (vs un POST
  // classique annule par le navigateur).
  window.addEventListener('beforeunload', avantDeQuitter)
  // Idem pour visibilitychange (mobile : l'onglet est mis en arriere-plan,
  // pas forcement de beforeunload).
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') avantDeQuitter()
  })
  window.addEventListener('online', reprendre)
}

/**
 * Parmi les clés du navigateur, celles que « tout envoyer » peut recopier dans l'espace du compte connecté :
 *  - une clé qui porte l'identifiant du compte ou de sa fiche : toujours ;
 *  - une clé qui porte un autre identifiant : jamais — elle appartient à un autre compte passé par ce navigateur ;
 *  - une clé sans identifiant : seulement si rien n'indique qu'un autre compte a utilisé ce navigateur.
 * Rien n'est retiré du navigateur : le tri ne porte que sur ce qui part.
 */
function clesDuCompte(cles: string[]): string[] {
  const siennes: string[] = []
  const communes: string[] = []
  let cleDUnAutre = false
  for (const cle of cles) {
    const identifiants = cle.toLowerCase().match(MOTIF_IDENTIFIANT)
    if (!identifiants) communes.push(cle)
    else if (identifiants.some(identifiant => identifiantsDuCompte.has(identifiant))) siennes.push(cle)
    else cleDUnAutre = true
  }
  return cleDUnAutre || autreCompteVu ? siennes : [...siennes, ...communes]
}

/**
 * « Tout envoyer » : recopie vers le serveur les clés `fixit_*` que ce navigateur détient pour le compte connecté
 * (une seule fois). Utile au premier passage d'un compte dont le serveur ne détient rien alors que le navigateur a
 * déjà des données (compte antérieur au miroir).
 * La fonction porte elle-même ses conditions : une restauration a réussi pour ce compte, le serveur a répondu qu'il
 * ne détenait rien (garantie 1) et a donné la liste des identifiants du compte, et seules les clés du compte partent
 * (garantie 4, voir clesDuCompte).
 * Les valeurs partent comme un envoi ordinaire : un lot refusé en bloc repart valeur par valeur, et ce qui ne passe pas
 * (réseau, panne) reste en attente dans le miroir, noté dans le navigateur, pour le nouvel essai qui suit une relecture
 * du serveur. Renvoie le nombre de valeurs que le serveur a enregistrées.
 */
export async function pushAllLocalToServer(): Promise<{ count: number }> {
  // Lecture seule : un stockage plein (QuotaExceededError à l'écriture) se lit encore et doit pouvoir migrer.
  if (typeof window === 'undefined' || !isStorageReadable('local')) return { count: 0 }
  const qui = await identite()
  if (!qui) return { count: 0 }
  adopterCompte(qui.compte)
  // Pas de restauration réussie pour ce compte (ou un envoi en échec depuis), ou serveur qui détient déjà des
  // valeurs : on ne sait pas ce que cet envoi écraserait. Sans la liste des identifiants du compte, on ne sait pas
  // lesquelles de ces clés sont les siennes.
  if (!amorce || !serveurVide || !identifiantsDonnes) return { count: 0 }
  const compte = compteCourant

  const presentes: string[] = []
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i)
    if (k && shouldSync(k)) presentes.push(k)
  }
  const keys = clesDuCompte(presentes)
  if (keys.length === 0) return { count: 0 }

  const entries: EntreeAEnvoyer[] = keys.map(k => {
    const raw = window.localStorage.getItem(k) || ''
    return { key: k, value: versServeur(raw), raw }
  }).filter(e => {
    try { return JSON.stringify(e.value).length <= MAX_VALUE_BYTES } catch { return false }
  })

  // Relecture du 15/11/2026 : un lot refusé ou en échec était abandonné en entier, et une seule valeur que la base
  // refuse privait toutes les autres du lot de leur copie en ligne.
  const bilan: Bilan = { reussies: 0, panne: false, seulesEnErreur: [] }
  const envoi: Envoi = { jeton: qui.jeton, keepalive: false, compte }
  for (const lot of grouperEnLots(entries)) {
    await envoyerLot(lot, envoi, bilan)
    // Un autre compte s'est connecté pendant l'envoi : la suite ne part pas, et rien de cet envoi ne le concerne.
    if (compteCourant !== compte) return { count: bilan.reussies }
  }
  terminerEnvoi(bilan)
  return { count: bilan.reussies }
}

/** Tests : remet le miroir à neuf (files, notes, minuteurs, compte) et débranche l'interception du prototype. */
export function reinitialiserMiroirPourTests(): void {
  pendingWrites.clear()
  pendingDeletes.clear()
  bases.clear()
  confirmees.clear()
  refusees.clear()
  derniereValeurSynchronisee.clear()
  derniereEcritureIci.clear()
  envoisIncertains.clear()
  postsEnVol.clear()
  echecsServeur.clear()
  isolees.clear()
  identifiantsDuCompte.clear()
  avertissementsFaits.clear()
  flushTimer = arreter(flushTimer)
  minuteurEtat = arreter(minuteurEtat)
  minuteurReessai = arreter(minuteurReessai)
  minuteurHydratation = arreter(minuteurHydratation)
  minuteurIsolees = arreter(minuteurIsolees)
  compteCourant = null
  amorce = false
  serveurVide = false
  autreCompteVu = false
  identifiantsDonnes = false
  isoleesPermises = false
  essaisIsolees = 0
  echecsHydratation = 0
  echecsEnvoi = 0
  hydratationARetenter = false
  hydratationsEnCours = 0
  installed = false
  ecrireSansMiroirRef = null
  supprimerSansMiroirRef = null
  const registre = registreGlobal()[CLE_REGISTRE]
  if (registre) {
    registre.surEcriture = null
    registre.surSuppression = null
  }
}
