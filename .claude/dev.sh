#!/bin/bash
export PATH="/Users/elgato_fofo/.nvm/versions/node/v24.13.0/bin:$PATH"
exec node ./node_modules/.bin/next dev "$@"
