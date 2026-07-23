#!/bin/bash
# Serves LOCAL CHAT on your LAN so your phone can reach it.
cd "$(dirname "$0")"
IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "localhost")

# Web search (Settings > Web search) needs this local proxy running too.
SEARCH_PID=""
if command -v node >/dev/null 2>&1; then
  node search-proxy.mjs &
  SEARCH_PID=$!
  trap 'kill "$SEARCH_PID" 2>/dev/null' EXIT
else
  echo "(node not found — web search won't work; install Node to enable it)"
fi

echo "LOCAL CHAT running at:"
echo "  PC:    http://localhost:8080"
echo "  Phone: http://$IP:8080"
echo "(same Wi-Fi network required)"
python3 -m http.server 8080 --bind 0.0.0.0
