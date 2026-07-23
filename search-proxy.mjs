#!/usr/bin/env node
// Tiny local web-search proxy for LOCAL CHAT.
// Scrapes DuckDuckGo's HTML endpoint (no API key, no rate-limit account,
// SafeSearch off via kp=-2) and returns plain JSON so the browser-side chat
// UI can call it without touching HTML scraping or worrying about CORS.
import http from 'node:http';
import https from 'node:https';

const PORT = process.env.SEARCH_PROXY_PORT || 8765;

function fetchDuckDuckGo(query){
  return new Promise((resolve, reject) => {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kp=-2`;
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LocalChatSearch/1.0)' } }, (res) => {
      if(res.statusCode >= 300 && res.statusCode < 400 && res.headers.location){
        https.get(res.headers.location, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LocalChatSearch/1.0)' } }, (res2) => {
          let body = '';
          res2.on('data', c => body += c);
          res2.on('end', () => resolve(body));
        }).on('error', reject);
        return;
      }
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve(body));
    }).on('error', reject);
  });
}

function decodeEntities(s){
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&#39;/g, "'");
}
function stripTags(s){
  return decodeEntities(s.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
}

// DuckDuckGo throttles automated traffic to this endpoint with a CAPTCHA-style
// "select all squares containing a duck" challenge page instead of an HTTP
// error — detect it explicitly so callers get a clear signal instead of a
// silently empty result list.
function isBlockedPage(html){
  return /select all squares containing a duck|error-lite@duckduckgo\.com/i.test(html);
}

// DuckDuckGo's HTML result markup: each hit has a.result__a (title + redirect
// href wrapping the real URL in ?uddg=) and a.result__snippet (summary text).
function parseResults(html, limit){
  const linkRe = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  const snippetRe = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
  const links = [...html.matchAll(linkRe)];
  const snippets = [...html.matchAll(snippetRe)];

  const results = [];
  for(let i = 0; i < links.length && results.length < limit; i++){
    const title = stripTags(links[i][2]);
    if(!title) continue;
    const rawHref = links[i][1];
    const uddgMatch = rawHref.match(/[?&]uddg=([^&]+)/);
    const url = uddgMatch ? decodeURIComponent(uddgMatch[1]) : (rawHref.startsWith('//') ? 'https:' + rawHref : rawHref);
    const snippet = snippets[i] ? stripTags(snippets[i][1]) : '';
    results.push({ title, url, snippet });
  }
  return results;
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if(req.method === 'OPTIONS'){ res.writeHead(204); res.end(); return; }

  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  if(parsedUrl.pathname !== '/search'){
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found. Use GET /search?q=your+query' }));
    return;
  }

  const query = (parsedUrl.searchParams.get('q') || '').trim();
  if(!query){
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Missing ?q= query parameter' }));
    return;
  }
  const limit = Math.min(parseInt(parsedUrl.searchParams.get('n'), 10) || 6, 10);

  try{
    const html = await fetchDuckDuckGo(query);
    if(isBlockedPage(html)){
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'DuckDuckGo is rate-limiting this IP right now (its bot-detection kicked in). Wait a minute or two before searching again.' }));
      return;
    }
    const results = parseResults(html, limit);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ query, results }));
  }catch(e){
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `Search failed: ${e.message}` }));
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`LOCAL CHAT search proxy running at http://0.0.0.0:${PORT}/search?q=...`);
});
