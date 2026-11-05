#!/bin/sh
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Install Node.js 22 from https://nodejs.org and run this file again."
  exit 1
fi
if [ ! -d node_modules ]; then
  echo "First start installs libraries. Wait."
  npm install || exit 1
fi
(sleep 3 && open "http://127.0.0.1:8080") >/dev/null 2>&1 &
npm run dev
