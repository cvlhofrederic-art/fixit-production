// Bootstrap: inject node binary dir into PATH before Next.js starts.
// Fixes Turbopack panic "spawning node pooled process - No such file or directory"
// when preview_start launches with a minimal PATH missing nvm/homebrew paths.
const path = require('path')
const nodeBinDir = path.dirname(process.execPath)
if (!process.env.PATH.includes(nodeBinDir)) {
  process.env.PATH = nodeBinDir + ':' + process.env.PATH
}
// Forward CLI args (--port 3000 etc.) to next dev
process.argv = [process.argv[0], 'dev', ...process.argv.slice(2)]
require(path.resolve('./node_modules/next/dist/bin/next'))
