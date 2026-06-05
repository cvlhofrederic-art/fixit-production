import { readFileSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const inputPath = process.argv[2] || '/Users/elgato_fofo/Downloads/VitFix_Dashboard_V5_7 (13).html'
const outputPath = process.argv[3] || join(__dirname, '../.claude/v57-decoded.html')

const html = readFileSync(inputPath, 'utf8')

function extractScript(typeAttr) {
  const re = new RegExp(`<script[^>]*type="${typeAttr}"[^>]*>([\\s\\S]*?)</script>`, 'i')
  const m = html.match(re)
  if (!m) throw new Error(`Missing script type=${typeAttr}`)
  return m[1]
}

const manifestText = extractScript('__bundler/manifest')
const templateText = extractScript('__bundler/template')

const manifest = JSON.parse(manifestText)
let template = JSON.parse(templateText)

const uuids = Object.keys(manifest)
console.error(`[decoder] ${uuids.length} assets in manifest`)

const summary = []

for (const uuid of uuids) {
  const entry = manifest[uuid]
  const bytes = Buffer.from(entry.data, 'base64')
  const finalBytes = entry.compressed ? gunzipSync(bytes) : bytes
  const isText = /^(text\/|application\/(json|javascript|x-javascript|ecmascript))/i.test(entry.mime || '')
  let snippet = ''
  if (isText) {
    const str = finalBytes.toString('utf8')
    snippet = str.length > 200 ? str.slice(0, 200) + '…' : str
  }
  summary.push({ uuid, mime: entry.mime, size: finalBytes.length, isText, snippet })

  if (isText) {
    template = template.split(uuid).join(`__ASSET_${uuid.slice(0, 8)}__`)
  } else {
    template = template.split(uuid).join(`data:${entry.mime};base64,${entry.data}`)
  }
}

writeFileSync(outputPath, template, 'utf8')
console.error(`[decoder] template written to ${outputPath} (${template.length} chars)`)

console.error('\n[decoder] asset summary:')
for (const a of summary) {
  console.error(`- ${a.uuid.slice(0, 8)}  ${a.mime}  ${a.size}B  text=${a.isText}`)
  if (a.isText && a.snippet) console.error(`    ${a.snippet.replace(/\n/g, ' ⏎ ')}`)
}

const textAssets = summary.filter((a) => a.isText)
if (textAssets.length) {
  const allTextPath = outputPath.replace(/\.html$/, '.assets.txt')
  const dump = []
  for (const a of textAssets) {
    const entry = manifest[a.uuid]
    const bytes = Buffer.from(entry.data, 'base64')
    const finalBytes = entry.compressed ? gunzipSync(bytes) : bytes
    dump.push(`==== ASSET ${a.uuid} (${a.mime}, ${a.size}B) ====`)
    dump.push(finalBytes.toString('utf8'))
    dump.push('')
  }
  writeFileSync(allTextPath, dump.join('\n'), 'utf8')
  console.error(`[decoder] ${textAssets.length} text assets dumped to ${allTextPath}`)
}
