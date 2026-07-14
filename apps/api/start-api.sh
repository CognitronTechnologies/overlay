#!/bin/sh
# API container entrypoint: apply pending DB migrations, then start the server.
# Kept as a script (not an inline dockerCommand) so Render doesn't mis-split a
# quoted command — that produced "exited with status 127". Must be LF-only.
set -e
npm run db:deploy
exec node apps/api/dist/main.js
