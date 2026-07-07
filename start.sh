#!/bin/bash
# Serves LOCAL CHAT on your LAN so your phone can reach it.
cd "$(dirname "$0")"
IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "localhost")
echo "LOCAL CHAT running at:"
echo "  PC:    http://localhost:8080"
echo "  Phone: http://$IP:8080"
echo "(same Wi-Fi network required)"
python3 -m http.server 8080 --bind 0.0.0.0
