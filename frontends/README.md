# AutoFinX Frontend

React + Vite frontend for the AutoFinX platform.

## Main Routes

- `/trading` for the mobile-style quick trade flow
- `/deals` for active deals and trade history
- `/robot-trading` for simplified robot session setup and controls
- `/trading/desk` for the legacy trading desk
- `/wallet`, `/settings`, `/strategies`, `/risk`, `/live-bots` for the existing dashboard modules

## Development

```sh
npm install
npm run dev
```

The frontend expects the Laravel API to be available and the environment variables in `.env` to be configured for the correct backend origin.

## Production Build

```sh
npm run build
```

## Notes

- The quick-trade UI and robot-trading UI reuse the existing app shell, auth flow, wallet hooks, and API layer.
- `/trading` and `/robot-trading` now share the same workspace execution toggle: switch the workspace to `paper` or `live` once and both surfaces follow it.
- Live mode defaults to `Binance` and uses the selected active integration from the shared trading settings state.
- Signal previews and chart estimates are heuristic technical summaries, not AI guarantees.
