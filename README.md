<p align="center">
  <img src="logo.png" width="96" alt="Nexiom logo">
</p>

<h1 align="center">Nexiom API</h1>
<p align="center"><b>One AI endpoint. It answers every time.</b></p>

<p align="center">
  <a href="#quickstart">Quickstart</a> ·
  <a href="#how-it-works">How it works</a> ·
  <a href="#setup">Setup</a>
</p>

---

Nexiom is a single chat-completions endpoint sitting in front of a chain of
independent inference paths. If one is throttled, slow, or down, the request
quietly moves on to the next — your code never sees the difference.

## Features

- **One endpoint, one key** — same request shape as any standard chat
  completions API, nothing provider-specific to learn.
- **Automatic failover** — a busy or failing path is skipped in real time,
  no retries needed on your end.
- **No lock-in** — swap or add inference paths behind the scenes without
  ever changing a line of your integration.
- **Self-serve API keys** — sign up, generate a key, and start using it.
- **Playground** — test the models directly in your browser.

## Quickstart

```bash
curl https://nexiom.dev/api/v1/chat/completions \
  -H "Authorization: Bearer $NEXIOM_KEY" \
  -d '{ "messages": [{ "role": "user", "content": "still there?" }] }'
```

Same request/response shape you already know. See the live site for the
JavaScript and Python examples too.

## How it works

1. **You send one request** — one base URL, one key, the usual message body.
2. **Nexiom finds a healthy path** — it checks what's fastest and available
   right now.
3. **You get an answer, not an error** — if a path is throttled or down,
   Nexiom re-routes before it ever reaches your code.

## Setup

### Prerequisites

- Node.js >= 18
- A Vercel KV store provisioned in your project (Vercel Dashboard → Storage → Create KV)

### Environment variables (Vercel)

Configure these in your Vercel project dashboard:

| Variable | Description |
|---|---|
| `KV_REST_API_URL` | Set automatically by Vercel KV integration |
| `KV_REST_API_TOKEN` | Set automatically by Vercel KV integration |
| `PATH_A_URL` .. `PATH_E_URL` | Upstream inference endpoint URLs |
| `PATH_A_KEY` .. `PATH_E_KEY` | Upstream API keys |
| `PATH_A_MODEL` .. `PATH_E_MODEL` | Default model names |
| `NEXIOM_API_KEY` | (optional) Legacy single shared key |
| `NEXIOM_KEYS` | (optional) Legacy JSON array of keys |

No database setup is needed — Vercel KV handles everything.

## Project structure

```
nexiom-api/
├── index.html, style.css, script.js, logo.png   → public site
├── api/
│   ├── lib/db.js                               → KV helpers
│   └── v1/
│       ├── auth/signup.js                       → POST signup
│       ├── auth/login.js                        → POST login
│       ├── auth/me.js                           → GET current user
│       ├── chat/completions.js                  → POST chat (API key auth)
│       ├── keys/index.js                        → GET/POST/DELETE keys
│       ├── models/index.js                      → GET available models
│       └── playground/chat.js                   → POST chat (session auth)
└── package.json
```
