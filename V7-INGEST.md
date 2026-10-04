# Velora Ingest V7

Velora V7 separates the static customer app from the catalogue-ingest backend.

## Run locally

```bash
export VELORA_MASTER_KEY="replace-with-a-long-random-secret"
npm start
```

Open `http://localhost:8094`.

The backend serves the static Velora app and exposes the V7 API on the same origin.

## Main endpoints

- `GET /api/system/status`
- `GET /api/catalogue`
- `GET /api/providers`
- `POST /api/providers/xtream/connect`
- `POST /api/providers/m3u/connect`
- `POST /api/providers/:id/sync`
- `POST /api/providers/sync-all`
- `POST /api/health/scan`
- `DELETE /api/providers/:id`

## Mass ingest behaviour

An Xtream-compatible connection syncs live streams, VOD movies and series in parallel. V7 normalizes names, years, artwork and source metadata, then merges duplicate channels/titles while retaining multiple sources.

Remote M3U URLs can be connected once and refreshed automatically.

Provider credentials remain in the backend data store. When `VELORA_MASTER_KEY` is set, provider secrets are encrypted at rest with AES-256-GCM.

## Scheduling

Each provider has `refreshMinutes` (minimum recommended value: 5). The backend checks every minute and refreshes providers when they are due.

## Static GitHub Pages

GitHub Pages cannot execute `server.mjs`. The Pages build remains the customer-facing static app. In **Admin → Velora Ingest V7**, set the deployed backend URL, then load the backend catalogue.

For a single-origin deployment, deploy the whole repository to a Node host and leave the Backend URL blank.
