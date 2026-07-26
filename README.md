# Arka

Arka turns group payments into one simple flow: create a shared tab, invite friends by QR or join code, collect NIM contributions, and settle the final payment through Nimiq Pay.

- Live app: [arka-omega.vercel.app](https://arka-omega.vercel.app)
- Public repository: [github.com/ceshez/arka](https://github.com/ceshez/arka)
- Builder: [Carlos Sánchez](https://github.com/ceshez) (solo)
- Competition: [Nimiq Mini Apps Competition](https://miniappscompetition.com/)

## What Arka solves

Splitting a group expense usually means juggling messages, calculations, payment reminders, and a final merchant payment. Arka keeps that journey in one mobile-first shared space. It is designed for friends, families, travel groups, dinners, gifts, and small events.

## How it works

1. The host connects a Nimiq wallet and creates an Arka with a total, deadline, and split method.
2. Arka creates a shareable QR, invite link, and manual join code.
3. Guests preview the Arka, join it, and see their exact share.
4. Each guest sends NIM directly to the host wallet through Nimiq Pay or Nimiq Wallet.
5. Arka marks a contribution as paid only after the transaction is found on the Nimiq network.
6. Once the group is ready, the host pays the merchant with the collected NIM through Nimiq Pay.

Arka uses host-wallet collection. It is not escrow, multisig, or a custodial wallet.

## Why Nimiq Pay

NIM is the live payment asset and a core part of Arka, not a decorative integration. Inside Nimiq Pay, Arka uses the injected Mini App provider to request wallet access and submit basic NIM transactions. In a regular browser, it uses the official Nimiq Hub checkout. Private keys and seed phrases never enter Arka.

The production configuration uses the Nimiq mainnet Hub and a mainnet RPC endpoint. Before an in-app transfer, Arka checks that Nimiq consensus is available; after submission, it waits for network confirmation before updating local payment state.

> Real-payment warning: mainnet actions move real NIM. Verify the recipient and amount in Nimiq Pay before approving. In Nimiq Pay, select the Default/Mainnet network for real tests.

## Current features

- NIM-first Arka creation
- Equal, custom, consumption, and sponsor split modes
- Cross-device invite discovery through QR, link, or `ARKA-XXXXXXXX` code
- Guest preview and join flow
- Host and guest payment dashboards
- Real NIM contribution and merchant-settlement requests
- Network-confirmed success states
- Mobile-first honeycomb payment progress
- Local activity, completed Arka history, and shareable receipt cards
- Vercel Web Analytics and Speed Insights

## Current limitations

- Confirmed payments are stored locally after network confirmation; cross-device payment synchronization is still pending.
- USDT checkout is disabled until the EVM transfer and confirmation path is implemented end to end.
- The proposed 3% NIM cashback is not active yet. It requires a funded reward wallet, payout rules, confirmation, retry handling, and abuse protection before Arka can truthfully credit rewards.
- QR, invitation, and two-phone payment flows still require the builder's manual device QA before submission.

## Architecture

```text
Host creates Arka
  -> Supabase invite RPC stores a public invite snapshot
  -> Guest joins by QR, link, or code
  -> Guest approves a NIM transfer in Nimiq Pay / Nimiq Hub
  -> Nimiq mainnet RPC confirms the transaction
  -> Arka updates the local member payment state
  -> Host settles the merchant through Nimiq Pay / Nimiq Hub
```

Supabase is used only for shared invite discovery and membership snapshots. Browser roles do not receive direct table access. Payment-provider code remains isolated in `src/lib/nimiq`.

## Tech stack

- React 19, TypeScript, and Vite
- Tailwind CSS
- React Router and Zustand
- `@nimiq/mini-app-sdk` and `@nimiq/hub-api`
- Supabase for cross-device invites
- `qrcode.react` and `qr-scanner`
- Vercel Analytics and Speed Insights

## Run locally

Requirements: Node.js 20+ and pnpm.

```bash
pnpm install
Copy-Item .env.example .env.local
pnpm dev
```

For a real shared invite, create a Supabase project, apply every SQL file in `supabase/migrations` in filename order, and set:

```dotenv
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

The publishable/anonymous key is intended for browser use. Never place a Supabase `service_role` key, wallet secret, seed phrase, or private key in a `VITE_*` variable.

Optional explicit mainnet configuration:

```dotenv
VITE_NIMIQ_RPC_URL=https://rpc.nimiqwatch.com
VITE_NIMIQ_HUB_URL=https://hub.nimiq.com
```

## Validate and build

```bash
pnpm lint
pnpm build
```

The production deployment is built from the public `main` branch on Vercel. Configure the same public Supabase and Nimiq variables for Preview and Production environments before deploying.

## License

Arka is released under the [MIT License](LICENSE).
