# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Ranked RPS Online — a ranked Rock-Paper-Scissors matchmaking game (live at https://ranked-rps.com/), built on Next.js (App Router) with a dual-database backend: Firebase for live/ephemeral game state and Neo4j for durable player/rating data.

## Commands

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run start` — run a production build
- `npm run lint` — ESLint (via `eslint.config.mjs`, flat config extending `eslint-config-next`)
- `npm run typecheck` — `tsc --noEmit`
- `npm run test` — Vitest, one-shot (`vitest run`); `npm run test:watch` for the interactive watcher

Path alias: `@/*` → `./src/*`. TypeScript is `strict: true`.

### Testing
Vitest (`vitest.config.mts`, resolves the `@/*` alias, `environment: "node"`). Test files are co-located next to source as `*.test.ts` (e.g. `src/lib/calculateRating.test.ts`). Scope is currently limited to pure, dependency-free logic — `calculateRating.ts`, `gameLogic.ts`'s `computeRoundOutcome`/`determineRoundWinner`/`calculateGameStats`, `wildcardLogic.ts`'s `determineWildcardRoundWinner`, `ranks.ts`, `tournamentBracket.ts`, `time.ts`'s `formatCountdown`. Anything that touches Firebase RTDB/Admin, Neo4j, or `fetch` (`matchmaking.ts`, `matchmakingServer.ts`, `matchmaking.server.ts`, `auth.ts`, all `src/app/api/*/route.ts` handlers) isn't covered yet — it would need module-mocking (e.g. `vi.mock` on `@/lib/firebaseAdmin`/`@/lib/neo4j`) since those modules initialize SDK singletons at import time. `npm run test` runs in CI (`.github/workflows/ci.yml`) after lint/typecheck.

### ESLint style rules worth knowing before editing
Double quotes, required semicolons, 2-space indent, trailing commas on multiline, `eqeqeq`, no `var`. `console.log` warns (only `console.warn`/`console.error` are allowed) — don't leave debug `console.log`s in.

## Architecture

### Two databases, two purposes
- **Firebase** (`src/lib/firebase.ts` client SDK, `src/lib/firebaseAdmin.ts` Admin SDK) holds live, ephemeral game state in the Realtime Database — active games at `games/{id}`, the matchmaking queue at `matchmaking_queue/{mode}_{uid}`. Firebase Auth session cookies are the auth mechanism; `src/lib/auth.ts`'s `getAuthedUid(req)` verifies the `session` cookie via `adminAuth.verifySessionCookie` and is the shared (but not universally applied — see Security below) auth check for API routes.
- **Neo4j** (`src/lib/neo4j.ts`, a lazy `getDriver()` singleton using `NEO4J_URI`/`NEO4J_USERNAME`/`NEO4J_PASSWORD`/`NEO4J_DATABASE`) is the permanent record: `Player`, `Match`, `Round`, `Club`, `Title` nodes with `PARTICIPATED_IN`/`HAD_ROUND` relationships. All Neo4j access happens server-side inside API routes, never from the client. Username uniqueness is enforced by a Neo4j schema constraint; `initPlayer` catches `Neo.ClientError.Schema.ConstraintValidationFailed` and returns 409.

### Three game modes sharing one core, and a registry that makes adding a fourth cheap
The round/game rules themselves live in `src/lib/gameLogic.ts` (`computeRoundOutcome`, `determineRoundWinner`, `calculateGameStats`, `recordRankedGame`) — a deliberately dependency-free module (no `firebase/database`, no `firebase-admin`) so it's safely importable from both client and server code. `src/lib/matchmaking.ts` re-exports these and adds the client-driven (Firebase client SDK) I/O on top: `findMatch`, `createGame`, `resolveRound`, `endGame`. `src/lib/gameModes.ts`'s `GAME_MODES` registry (keyed by `PlayMode`) is the single source of truth for what varies per mode — label, Neo4j `Match.mode` string, whether matchmaking blocks (`live`), and round duration — so `findMatch`/`createGame` and the stats/leaderboard API routes branch on `GAME_MODES[mode].live`/`.matchMode` instead of hardcoded ternaries per mode. The three modes (all labeled by name in the UI on `/play`) differ in who drives resolution:
- **Blitz** (`src/app/game/[gameId]/page.tsx`): fully client-driven — a browser tab must stay open, since the client itself calls `resolveRound`/`endGame` against Firebase RTDB. One live game per player at a time.
- **Async** (`src/app/game/async/`, `src/app/asyncGames/`): a player can have many concurrent games; `findMatch(mode="async")` returns `{queued:true}` immediately rather than blocking. Resolution is server-side via `src/lib/matchmakingServer.ts` (Admin SDK), which is a deliberate server-side counterpart to `matchmaking.ts` — **never import it from a `"use client"` file**. Choice submission goes through `POST /api/games/submitChoice` → `submitChoiceServer`, which always attempts `resolveRoundServer` afterward (safe no-op if the opponent hasn't acted yet). `resolveRoundServer` uses an RTDB `.transaction()` so the submission path and the cron sweep can race safely without double-resolving a round or double-recording stats (`shouldFinalize` is only true for the transaction attempt that actually completes/cancels the game). `GET /api/cron/resolveAsyncRounds` (bearer-secret auth via `CRON_SECRET`, scheduled `0 0 * * *` in `vercel.json`) calls `sweepExpiredAsyncRounds` as a backstop for rounds nobody acted on — Vercel Hobby plan limits cron to once/day, which is acceptable since `roundTimeout` fallback logic still eventually ends abandoned matches.
- **Wildcard** (`src/app/game/wildcard/[gameId]/page.tsx`): live/client-driven like Blitz (not server-authoritative), but adds two extra moves, A and B, on top of Rock/Paper/Scissors. Before round 1, each player secretly picks 2 of Rock/Paper/Scissors that their own A will beat (the third, unpicked one beats their A instead; B beats only A and loses to all plain choices) — this is gated by `Game.configPhase`, a Firebase-only flag that holds the game in `MatchStatus.InProgress` without starting `roundStartTimestamp` until both players have submitted their `PlayerState.aBeats` config. Each player gets `config.wildcard.abStartingPoints` (3) total plays of A+B combined per match, tracked via `PlayerState.abRemaining`, enforced client-side at submission time. Round resolution can't reuse `determineRoundWinner`'s static lookup table, since a round involving an A needs that player's own config as input — see `src/lib/wildcardLogic.ts`'s `determineWildcardRoundWinner`, called from `computeRoundOutcome` when `game.mode === "wildcard"`. No bots/AI in this mode. `calculateGameStats` tallies counts for all `Choice` enum members generically (not hardcoded to Rock/Paper/Scissors), so it picks up A/B plays without a mode branch.

All three modes converge on `recordRankedGame`, which posts to `/api/postGameStats` (writes `Match`/`Round`/`PARTICIPATED_IN` to Neo4j) and `/api/adjustRating`.

### Rating system
Elo-style, implemented in `src/lib/calculateRating.ts` (mode-agnostic — just takes two ratings and a boolean), tuned via `src/config/settings.json`: `K: 45`, `distributionFactor: 750` (used in the `10^(rating/distributionFactor)` expected-score curve), `matchmakingRatingRange: 300`, `defaultRating: 1000`, `roundTimeout: 30`s (blitz), `async.roundTimeoutSeconds: 86400` (24h), `wildcard.roundTimeoutSeconds: 30`s + `wildcard.abStartingPoints: 3`. Ratings are clamped 0–5000.

Ratings are stored as a graph, not flat Player properties: `(:Player)-[:HAS_RATING]->(:Rating {mode, value})`, one `Rating` node per `PlayMode` a player has played. This replaced an earlier `Player.rating`/`Player.asyncRating` flat-property model (migrated via the one-time `scripts/migrateRatingsToGraph.ts`, additive-only — the legacy properties are still present but unused by current code) specifically so a future mode needs zero new Neo4j schema, just a `GAME_MODES` entry — `initPlayer` provisions a `Rating` node per `PLAY_MODES` entry on signup, `adjustRating`/`fetchPlayer`/`fetchDashboardStats`/`fetchLeaderboard` all join through `HAS_RATING` parameterized by `$mode` rather than interpolating a `p.${ratingField}` property name. `ProfileData`/`Player` (`src/types/index.ts`) expose this as `ratings: Partial<Record<PlayMode, number>>` rather than one field per mode.

### Session lifecycle — one reconciled session, sliding indefinitely
Auth has two halves that must be kept in sync: the Firebase client identity (persisted in IndexedDB, auto-refreshing) and the httpOnly `session` cookie the server authorizes against. `src/context/AuthContext.tsx` is the reconciler and the only place that subscribes to auth changes — it uses `onIdTokenChanged` (not `onAuthStateChanged`) so it also fires on every ~hourly token refresh and on app load with a restored session, re-minting the cookie through `POST /api/login` whenever it's due. That's what makes sessions slide rather than dying at a fixed 5 days while the UI still claims you're logged in.

- `src/lib/sessionCookie.ts` — pure, dependency-free constants and helpers shared by the login/logout routes, the proxy, and the client. `src/lib/session.ts` is the client-only manager: `establishSession`, `signOutEverywhere`, `hasFreshSession`. **Every path that mints or clears the cookie goes through `session.ts`** — never call `signOut(auth)` or `POST /api/login` directly, or you'll strand one half of the session.
- Two cookies, both set by `/api/login`: httpOnly `session` (the JWT), and readable `session_expires` (its expiry only, no secret). The second exists because `document.cookie` can't see an httpOnly cookie, so without it the client cannot tell "healthy session" from "cookie deleted" except by eating a 401.
- `AuthContext` exposes `status: "loading" | "authenticated" | "guest" | "unauthenticated"`, which means *both* a Firebase identity *and* an established cookie. **`user` can be non-null while `status` is `"unauthenticated"`.** Anything deciding "are they logged in" must read `status`; consumers that just need a uid to fetch public data may keep reading `user`. The `loading` boolean is derived and deprecated.
- `src/lib/api.ts` throws `ApiError` (carrying `status`) and recovers from a 401 once, via a handler `AuthProvider` registers with `setUnauthorizedHandler`. It's a registration hook rather than a direct import because `api.ts` also runs server-side (`gameLogic.ts`'s `recordRankedGame`), where importing the Firebase client SDK would poison the server bundle.
- `/api/login` deliberately has **no `auth_time` freshness check**, despite Firebase's docs recommending one: renewals present a refreshed ID token whose `auth_time` is the original sign-in, so that check would cap every session at 5 minutes. `/api/logout` calls `revokeRefreshTokens`, so logging out signs you out on every device.
- `src/proxy.ts` (Next 16's renamed middleware) is an **optimistic UX redirect, not a security boundary**: it decodes the cookie's `exp` without verifying the signature and makes no network call, per Next's own guidance that proxy runs on every matched request including prefetches. Real authorization stays in `getAuthedUid`. Everything behind its matcher is a client component fetching through that layer — if one is ever converted to a server component it needs its own check.

### API route security — no shared middleware, currently inconsistent
There is no auth middleware/wrapper applied uniformly across `src/app/api/*/route.ts`. Routes that need a caller identity call `getAuthedUid(req)` individually (e.g. `initPlayer`, `games/submitChoice`). **`adjustRating` and `postGameStats` currently have no auth check at all** — they trust whatever `uid`/`mode`/`newRating` is posted to them. This is an active area of hardening (see recent commits "lock down API routes!!", "prevent race condition during matchmaking") — when touching these routes, check whether an auth/authorization check needs adding rather than assuming existing sibling routes are a safe pattern to copy.

### Styling
CSS Modules (`src/styles/game.module.css`, per-page `*.module.css`), plus one global stylesheet at `src/app/global.css` (note: not `globals.css`) using CSS custom properties. No Tailwind.

### Types
`src/types/index.ts` — app-facing types: `Player`/`ProfileData` (`ratings: Partial<Record<PlayMode, number>>`), `PlayMode` (`"blitz" | "async" | "wildcard"`), `Club`/`ClubMember`, `MatchRecord` (Neo4j-derived history), `Game`/`PlayerState`/`RoundData` (Firebase live state — `PlayerState.aBeats`/`.abRemaining` and `Game.configPhase` are Wildcard-only), `Tournament`-related types, `RankTier`/`RankName`, API request/response shapes.
`src/types/neo4j.ts` — Neo4j-specific: enums (`Choice` — includes `WildcardA`/`WildcardB`, `MatchResult`, `MatchStatus`, tournament statuses) and node/relationship shapes (`Player`, `Rating` (`HAS_RATING` target), `Club`, `Match`, `Round`, `Title`, `ParticipatedIn`, `EarnedTitle`).
`src/lib/gameModes.ts` — the `GAME_MODES` registry described above; add a new `PlayMode` here (plus its own game-rule logic, if its rules differ) rather than a new ternary arm scattered across matchmaking/stats/UI files.

## Writing style
Use American spelling in code comments, commit messages, PR descriptions, and other prose (e.g. "color" not "colour", "behavior" not "behaviour", "canceled" not "cancelled"). Note `MatchStatus.Cancelled` in `src/types/neo4j.ts` is an existing British-spelled enum value; don't rename it, just don't introduce new British spellings elsewhere. Limit the use of em-dashes; prefer a period, comma, or parentheses instead.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
