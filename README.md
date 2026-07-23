<p align="center">
  <img src="logo.png" width="96" alt="Nexiom logo">
</p>

<h1 align="center">Nexiom API</h1>
<p align="center"><b>One AI endpoint. It answers every time.</b></p>

<p align="center">
  <a href="#quickstart">Quickstart</a> ·
  <a href="#how-it-works">How it works</a> ·
  <a href="#deploy">Deploy</a>
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

## Project structure

```
nexiom-api/
├── index.html, style.css, script.js, logo.png   → the public site
└── api/v1/chat/completions.js                   → the gateway
```

## Deploy

1. On vercel.com → **Add New Project** → import this repo. Zero build
   config needed.
2. In **Settings → Environment Variables**, configure up to 5 inference
   paths — Nexiom tries them in order and only uses the ones that are set:

   | Variable | Meaning |
   |---|---|
   | `PATH_A_URL`, `PATH_A_KEY` | first path's endpoint + key |
   | `PATH_B_URL`, `PATH_B_KEY` | second path |
   | `PATH_C_URL`, `PATH_C_KEY` | third path |
   | `PATH_D_URL`, `PATH_D_KEY` | fourth path |
   | `PATH_E_URL`, `PATH_E_KEY` | fifth path |
   | `PATH_A_MODEL` … `PATH_E_MODEL` | optional, forces a model on that path |

   Also set `NEXIOM_API_KEY` — the key your own users will send you. Pick
   any long random string; it isn't tied to a provider.

3. Redeploy after saving env vars.

## Calling it

```bash
curl https://<your-domain>/api/v1/chat/completions \
  -H "Authorization: Bearer <NEXIOM_API_KEY>" \
  -d '{"messages":[{"role":"user","content":"hey"}]}'
```

Pass `"model"` to force a specific underlying model, otherwise each path's
default is used.

---

<p align="center"><sub>hello@nexiom.dev is a placeholder in the site footer — swap it for a real inbox before sharing the link around.</sub></p>
