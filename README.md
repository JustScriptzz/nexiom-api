# Nexiom API

A single AI chat-completions endpoint backed by a chain of inference paths.
If one is rate limited or down, the request falls through to the next one
automatically. The public site never names which services sit behind it —
that list only lives in `api/v1/chat/completions.js` and your env vars.

## Project structure

```
nexiom-api/
├── index.html, style.css, script.js, logo.png   → the public site (static)
└── api/v1/chat/completions.js                   → the gateway (serverless function)
```

## Deploy

1. Push this repo to GitHub (already done if you're reading this from the repo).
2. On vercel.com, "Add New Project" → import `JustScriptzz/nexiom-api`. No
   build settings needed, it's zero-config.
3. In the Vercel project's Settings → Environment Variables, add whichever
   of these you have keys for. You don't need all of them — Nexiom only
   tries paths it has a key for, in this order:

   | Variable | Path |
   |---|---|
   | `GROQ_API_KEY` | Groq |
   | `CEREBRAS_API_KEY` | Cerebras |
   | `OFOX_API_KEY` | Ofox.ai |
   | `ATLAS_API_KEY` (+ optional `ATLAS_BASE_URL`) | Atlas Cloud |
   | `OPENCODE_ZEN_API_KEY` | OpenCode Zen |

   Also set `NEXIOM_API_KEY` — this is the key *your* users will send you.
   Make it up yourself (a long random string), it isn't tied to any provider.

   Optional per-path model overrides: `GROQ_MODEL`, `CEREBRAS_MODEL`,
   `OFOX_MODEL`, `ATLAS_MODEL`, `OPENCODE_ZEN_MODEL` — otherwise sensible
   defaults are used.

4. Redeploy after adding env vars (Vercel does this automatically on save,
   or trigger it manually from the Deployments tab).

## Calling it

```bash
curl https://<your-domain>/api/v1/chat/completions \
  -H "Authorization: Bearer <NEXIOM_API_KEY>" \
  -d '{"messages":[{"role":"user","content":"hey"}]}'
```

Same shape as any OpenAI-style chat completions call. Pass `"model"` if you
want to force a specific underlying model; otherwise each path's default is
used.

## Notes

- Logfare and g4f/g4v were left out on purpose — see the chat where this was
  built for why.
- `hello@nexiom.dev` in the site footer/access section is a placeholder —
  swap it for a real inbox before sharing the link around.
