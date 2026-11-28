// scripts/mobile/publier-play.mjs — dépose un AAB signé sur un canal de la Google Play Console.
//
// Appelé par le workflow « App Android — envoi Play ». Écrit en Node pur (fetch et crypto de la plateforme) :
// pas d'action tierce à épingler, pas de dépendance ajoutée au dépôt, et le jeton n'existe qu'en mémoire.
//
// Entrées, toutes par variables d'environnement (jamais en argument : la ligne de commande est lisible
// par les autres processus du runner) :
//   GOOGLE_PLAY_SERVICE_ACCOUNT_JSON  clé JSON du compte de service, avec le rôle « Release manager »
//   PLAY_PACKAGE_NAME                 identifiant de l'appli, par exemple io.vitfix.pro
//   PLAY_AAB                          chemin du fichier .aab signé
//   PLAY_TRACK                        canal visé : internal, alpha, beta ou production
//   PLAY_STATUS                       draft (par défaut) ou completed
//   PLAY_NOTES                        notes de version facultatives (fr-FR)
//
// La Play Console refuse un versionCode déjà envoyé : le workflow le dérive du numéro de run.
// `publierSurPlay` est exporté pour les tests ; l'exécution directe du fichier seule lit l'environnement.

import { createSign } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const PORTEE = 'https://www.googleapis.com/auth/androidpublisher'
const JETON_URL = 'https://oauth2.googleapis.com/token'
const API = 'https://androidpublisher.googleapis.com/androidpublisher/v3'
const API_ENVOI = 'https://androidpublisher.googleapis.com/upload/androidpublisher/v3'

export const CANAUX = ['internal', 'alpha', 'beta', 'production']
// Tant que l'appli n'a jamais été publiée, Google la considère en brouillon et refuse un envoi
// « completed » : la version doit arriver en « draft », puis être publiée d'un clic dans la console.
export const STATUTS = ['draft', 'completed']

const base64url = (donnees) => Buffer.from(donnees).toString('base64url')

// Réponse d'erreur de l'API lue et résumée : sans cela, un 400 de Google arrive comme un échec muet.
async function lireReponse(reponse, etape) {
  const texte = await reponse.text()
  if (!reponse.ok) {
    const court = texte.length > 800 ? `${texte.slice(0, 800)}…` : texte
    throw new Error(`${etape} : HTTP ${reponse.status} — ${court}`)
  }
  return texte ? JSON.parse(texte) : {}
}

// Jeton d'accès par JWT signé avec la clé privée du compte de service (flux « jwt-bearer » de Google).
async function obtenirJeton(compte, appelerHttp, maintenant) {
  if (!compte?.client_email || !compte?.private_key) {
    throw new Error('clé JSON du compte de service incomplète (client_email ou private_key absent)')
  }
  const entete = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const corps = base64url(
    JSON.stringify({
      iss: compte.client_email,
      scope: PORTEE,
      aud: JETON_URL,
      iat: maintenant,
      exp: maintenant + 3600,
    }),
  )
  const signature = createSign('RSA-SHA256').update(`${entete}.${corps}`).sign(compte.private_key, 'base64url')

  const reponse = await appelerHttp(JETON_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${entete}.${corps}.${signature}`,
    }),
  })
  const { access_token: jeton } = await lireReponse(reponse, 'obtention du jeton Google')
  if (!jeton) throw new Error('réponse sans access_token à la demande de jeton')
  return jeton
}

/**
 * Ouvre une modification, envoie le bundle, le rattache au canal puis valide. Rien n'est visible des
 * testeurs tant que la validation finale n'a pas eu lieu.
 * @returns {Promise<number|string>} le versionCode extrait du bundle par Google.
 */
export async function publierSurPlay({
  compte,
  paquet,
  aab,
  canal,
  statut = 'draft',
  notes,
  appelerHttp = fetch,
  maintenant = () => Math.floor(Date.now() / 1000),
  journal = console.log,
}) {
  if (!paquet) throw new Error("identifiant d'application absent")
  if (!CANAUX.includes(canal)) throw new Error(`canal inconnu : ${canal} (attendus : ${CANAUX.join(', ')})`)
  if (!STATUTS.includes(statut)) throw new Error(`statut inconnu : ${statut} (attendus : ${STATUTS.join(', ')})`)
  if (!aab?.length) throw new Error('bundle vide ou illisible')

  const jeton = await obtenirJeton(compte, appelerHttp, maintenant())
  const auth = { authorization: `Bearer ${jeton}` }
  const base = `${API}/applications/${encodeURIComponent(paquet)}/edits`

  const edition = await lireReponse(
    await appelerHttp(base, { method: 'POST', headers: auth }),
    "ouverture d'une modification",
  )
  const id = edition.id
  if (!id) throw new Error('réponse sans identifiant de modification')
  journal(`modification ${id} ouverte sur ${paquet}`)

  // Google extrait lui-même le versionCode du bundle : ne pas le recalculer ici.
  const envoye = await lireReponse(
    await appelerHttp(
      `${API_ENVOI}/applications/${encodeURIComponent(paquet)}/edits/${encodeURIComponent(id)}/bundles?uploadType=media`,
      { method: 'POST', headers: { ...auth, 'content-type': 'application/octet-stream' }, body: aab },
    ),
    'envoi du bundle',
  )
  const versionCode = envoye.versionCode
  if (versionCode === undefined || versionCode === null) throw new Error('réponse sans versionCode après envoi')
  journal(`bundle envoyé — versionCode ${versionCode}`)

  const sortie = {
    versionCodes: [String(versionCode)],
    status: statut,
    ...(notes ? { releaseNotes: [{ language: 'fr-FR', text: notes }] } : {}),
  }
  await lireReponse(
    await appelerHttp(`${base}/${encodeURIComponent(id)}/tracks/${encodeURIComponent(canal)}`, {
      method: 'PUT',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ track: canal, releases: [sortie] }),
    }),
    `mise à jour du canal ${canal}`,
  )

  await lireReponse(
    await appelerHttp(`${base}/${encodeURIComponent(id)}:commit`, { method: 'POST', headers: auth }),
    'validation de la modification',
  )
  journal(
    statut === 'draft'
      ? `version ${versionCode} déposée en brouillon sur le canal ${canal} — à publier dans la Play Console`
      : `version ${versionCode} publiée sur le canal ${canal}`,
  )
  return versionCode
}

function exigerEnv(nom) {
  const valeur = process.env[nom]
  if (!valeur) throw new Error(`variable d'environnement absente : ${nom}`)
  return valeur
}

async function main() {
  await publierSurPlay({
    compte: JSON.parse(exigerEnv('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON')),
    paquet: exigerEnv('PLAY_PACKAGE_NAME'),
    aab: await readFile(exigerEnv('PLAY_AAB')),
    canal: exigerEnv('PLAY_TRACK'),
    statut: exigerEnv('PLAY_STATUS'),
    notes: process.env.PLAY_NOTES,
  })
}

// Exécuté seulement quand le fichier est lancé directement : l'import par un test ne déclenche rien.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((erreur) => {
    console.error(`::error::envoi Play impossible — ${erreur.message}`)
    process.exitCode = 1
  })
}
