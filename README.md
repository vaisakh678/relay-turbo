# Relay

A streaming AI gateway for multiple apps. Your app backends (e.g. AWS Lambda) handle auth and data; Relay holds the system prompts, provider keys and per-plan usage limits, and streams LLM responses to clients over SSE.

## Structure

- `apps/web` — dashboard (Vite + React + Tailwind). Currently UI-only with mock data.

## Development

```sh
pnpm install
pnpm dev
```

## License

- Gateway and dashboard (`apps/`): [AGPL-3.0](LICENSE). Free to self-host; if you run a modified version as a service, you must publish your changes.
- SDKs (`packages/`): [MIT](packages/LICENSE), so you can embed them in any app, open source or not.
