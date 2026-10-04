# My City Twin — new UI preview

Standalone frontend copy of My City Twin, containing the ver-4 UI.
The original team repository, backend repositories, and mycitytwin.com deployments are separate.

## Run locally

```bash
npm ci
npm run dev
```

## Check

```bash
npm test
npm run build
```

## Deploy a preview for the group

```bash
npx wrangler login
npm run deploy
```

Use your personal Cloudflare account. The Worker is named `mycitytwin-newui` and uses a separate `workers.dev` address; no team custom domain is configured.
Wrangler prints the preview URL after a successful deployment. Share that URL with the group.
The root opens ver-4; its direct path is `/ver-4/`.

`npm run deploy` rebuilds ver-4 in this repository. Previous version folders are preserved.
Future plans is a guided prototype with preset questions and sourced replies, not a connected AI backend.

Source snapshot: the team frontend at `62e6d79`, with independent deployment configuration.
Original project: https://github.com/Monash-FIT5120-TE01/my-city-twin
