# Hawkeye UI

The web interface for **Hawkeye**, a self-hosted error tracker. It shows issues, uptime checks,
performance, logs and settings. It does not store anything itself: it talks to the Hawkeye backend
over its API.

Built with React 19, Vite, TypeScript, React Router and TanStack Query.

## How the pieces fit

```
your app + Sentry SDK ──events──▶  Hawkeye backend  ◀──API──  Hawkeye UI (this repo)
                                   (Django, Postgres, Valkey)       ▲
                                                                    └── you, in a browser
```

- **Backend:** <https://github.com/Dominic62q/Hawkeye-backend>. It receives events, groups them into
  issues, sends alerts and serves the API this UI uses.
- **This repo:** the screens. In development it runs on its own port and proxies API calls to the backend.

## Run it locally

You need Node 20.19 or newer and a running Hawkeye backend (by default on `http://localhost:8010`).

```bash
npm install
npm run dev
```

Open <http://localhost:5190>.

If your backend is somewhere else, copy `.env.example` to `.env` and set the address:

```bash
cp .env.example .env
```

```
HAWKEYE_API=http://localhost:8010
```

That is the only setting. Restart `npm run dev` after changing it.

| Command             | What it does                      |
| ------------------- | --------------------------------- |
| `npm run dev`       | Dev server with hot reload        |
| `npm run typecheck` | Type-check without building       |
| `npm run build`     | Type-check and build to `dist/`   |
| `npm run preview`   | Serve the built `dist/` locally   |

The dev server forwards `/api`, `/_allauth`, `/accounts`, `/oauth`, `/admin` and `/static` to the
backend, so sign-in cookies work without any CORS setup. A production build has no proxy: serve `dist/`
from the same host as the backend, or put both behind one reverse proxy.

## Connect your app

Hawkeye speaks the Sentry protocol, so you use the **standard Sentry SDKs**. There is no separate
Hawkeye SDK. For any app you want to monitor:

1. In Hawkeye, create a project (Settings → Projects) and open it to find its **DSN**.
2. Install the Sentry SDK for your language, once, in that app.
3. Initialise it with the DSN. Errors are then reported automatically.

The project page and the empty Issues screen both show these steps with your real DSN filled in.

| Language / framework | Install                              | Setup                                  |
| -------------------- | ------------------------------------ | -------------------------------------- |
| JavaScript           | `npm install @sentry/browser`        | `Sentry.init({ dsn: "<DSN>" })`        |
| React                | `npm install @sentry/react`          | `Sentry.init({ dsn: "<DSN>" })`        |
| Next.js              | `npm install @sentry/nextjs`         | `Sentry.init({ dsn: "<DSN>" })`        |
| Node.js              | `npm install @sentry/node`           | `Sentry.init({ dsn: "<DSN>" })`        |
| Python               | `pip install sentry-sdk`             | `sentry_sdk.init(dsn="<DSN>")`         |
| Django               | `pip install "sentry-sdk[django]"`   | `sentry_sdk.init(dsn="<DSN>")`         |
| Flask                | `pip install "sentry-sdk[flask]"`    | `sentry_sdk.init(dsn="<DSN>")`         |
| FastAPI              | `pip install "sentry-sdk[fastapi]"`  | `sentry_sdk.init(dsn="<DSN>")`         |
| PHP                  | `composer require sentry/sentry`     | `\Sentry\init(['dsn' => '<DSN>']);`    |
| Ruby                 | `bundle add sentry-ruby`             | `config.dsn = "<DSN>"` in `Sentry.init`|
| Go                   | `go get github.com/getsentry/sentry-go` | `sentry.Init(sentry.ClientOptions{Dsn: "<DSN>"})` |
| .NET                 | `dotnet add package Sentry`          | `options.Dsn = "<DSN>"`                |
| Rust                 | `cargo add sentry`                   | `sentry::init("<DSN>")`                |

Other Sentry SDKs work the same way. The snippets live in [`src/lib/sdk.ts`](src/lib/sdk.ts).

**The DSN's host must be reachable from the app that uses it.** The backend builds it from its
`GLITCHTIP_URL` setting. If your DSN says `localhost`, only apps on the same machine can report in.
To monitor apps elsewhere, run the backend on a public address and set `GLITCHTIP_URL` to it.

**Performance data** uses the same SDK and DSN. Tracing is off by default, so set the SDK's
`tracesSampleRate` (for example `1.0`, or `0.1` to sample a tenth of requests) to send transactions.

**Logs** can arrive two ways, and both need `GLITCHTIP_ENABLE_LOGS` on the backend (the default):

- Through the Sentry SDK, with its logging option turned on. Logs travel in the same request as errors.
- Through an OpenTelemetry (OTLP) exporter, sending to the backend's `/v1/logs` endpoint with the
  project key in an `Authorization: Bearer <key>` header.

## Project layout

```
src/
  pages/        One file per screen (Issues, Logs, Uptime, Performance, Settings, Account, sign-in)
  components/   Shared pieces (Shell, dialogs, charts, ConnectApp)
  lib/          API client, data hooks, types, SDK snippets
  styles/       Plain CSS with design tokens, light (Paper) and dark (Night) themes
prototype/      A single static design mockup (index.html)
```

## Notes

- The Releases tab is hidden for now.
- WebAuthn (security keys) is not supported yet; use an authenticator app for two-factor.
- Social sign-in buttons appear only when the backend has providers configured.
