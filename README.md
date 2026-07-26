# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```
# Arka

## Desktop and wallet testing

Arka keeps its existing mobile layout through 430px and adds a desktop shell
from 1024px with a sidebar, wider content, and two-column dashboard layouts.

- In Nimiq Pay, wallet access and NIM payments use `@nimiq/mini-app-sdk`.
- In a regular desktop browser, wallet access and NIM payments use the official
  Nimiq Hub popup.
- Creating a real Arka requires a connected wallet so the invite contains the
  host's actual Nimiq address. Guided demo Arkas continue to use mock payments.

Run `pnpm dev`, open `http://localhost:5173`, and select **Connect wallet**.
Allow the popup and choose an address in Nimiq Wallet. For a phone test, open
the Network URL inside Nimiq Pay.

## Cross-device invites

Arka uses Supabase for real shared invite discovery and joining. Local browser
storage is still used for device UI state, but it is not the source of truth
for QR codes or join codes.

1. Create a Supabase project.
2. Run every SQL file in [`supabase/migrations`](supabase/migrations) in filename order using the Supabase SQL editor or CLI.
3. Copy `.env.example` to `.env.local`.
4. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from the Supabase Connect dialog. Legacy projects can use `VITE_SUPABASE_ANON_KEY`.
5. Run `pnpm dev`.

The publishable or anonymous key is intended to be public. The migration enables RLS, removes
direct browser access to the table, and grants only the four invite RPC
functions. Never place a Supabase service-role key in a Vite environment
variable.

The four invite RPCs are intentionally `SECURITY DEFINER` and executable only
by `anon`, because opening a shared QR must work before Supabase authentication.
The Security Advisor will continue to report the four `anon` warnings as
reviewed exceptions. The functions use a restricted search path, timeouts,
input/state validation, explicit grants, and no direct browser table access.

For a phone test, open the deployed app (or the Vite LAN URL) on phone A,
create an Arka, and scan its QR with phone B. Phone B opens the preview first
and joins only after tapping **Join Arka**. Manual `ARKA-XXXXXXXX` entry follows
the same preview flow.
