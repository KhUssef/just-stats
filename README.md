# just-stats

Private traffic dashboard for the portfolio site. It reads the `hits` and `events`
tables the portfolio writes to its Neon Postgres database and shows them the way
Vercel Analytics does: visitors, page views, clicks and bot share against the
previous period, a traffic chart, top pages, referrers, outreach tokens,
countries, devices, why traffic was flagged as bots, and a log of recent visits.

The database belongs to the portfolio project, which creates and migrates the
tables. This app only reads.

## Setup

Environment variables (see `.env.example`):

- `DATABASE_URL` - the portfolio's Neon connection string. On Vercel, connect the
  existing Neon store to this project from the Storage tab.
- `STATS_PASSWORD` - every page asks for it (HTTP Basic auth, any username).
- `SITE_HOST` (optional) - the portfolio's host, so internal links are not referrers.
- `STATS_TZ` (optional) - time zone for chart buckets, default `Africa/Tunis`.

## Commands

```bash
npm install
npm run dev        # http://localhost:3000, needs .env.local
npm run build
npm run lint
npx tsc --noEmit
```
