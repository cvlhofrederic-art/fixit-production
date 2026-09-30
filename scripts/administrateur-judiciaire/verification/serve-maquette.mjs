// Sert le fichier HTML autonome de la maquette pour les comparaisons (la maquette ne s'ouvre pas en file://).
// Usage : node serve-maquette.mjs "<chemin>/VitFix Syndic Judiciaire vX.html" [port=4173]
import http from 'node:http'
import fs from 'node:fs'

const [fichier, port = '4173'] = process.argv.slice(2)
if (!fichier || !fs.existsSync(fichier)) {
  console.error('Chemin de la maquette HTML manquant ou introuvable.')
  process.exit(1)
}
http
  .createServer((req, res) => {
    if (req.url.split('?')[0] !== '/') {
      res.writeHead(404)
      res.end('404')
      return
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    fs.createReadStream(fichier).pipe(res)
  })
  .listen(Number(port), '127.0.0.1', () => console.log(`maquette sur http://127.0.0.1:${port}`))
