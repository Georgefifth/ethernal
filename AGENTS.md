# Ethernal — 3rd-Web-Hack Submission

**Tagline:** Your keys die with you. Your crypto doesn't have to.

## Hackathon

- **Event:** [3rd-Web-Hack](https://3rd-web-hack.devpost.com/) (TechZap Club)
- **Theme:** "Hack the Web, build solutions to existing Blockchain problems" — real-world unsolved Blockchain/Web3 problems
- **Deadline:** Sep 27, 2026 @ 12:30pm IST (UTC+5:30) = Sep 27 07:00 UTC = **Sep 27 15:00 UTC+8**
- **Judging:** Innovation · Technical Feasibility · Uniqueness · Design
- **Required deliverables:** problem statement, solution, working MVP, tech stack list, public GitHub repo w/ setup instructions, demo video or live demo, pitch deck
- **Prizes:** $500 / $200 / $50 USDT · ~272 participants · students only

## The Problem

Blockchain's oldest unsolved problem: **private keys are mortal, assets are not.**

An estimated ~20% of all Bitcoin (~$140B+) is stranded in wallets whose owners died or lost access — no recourse, no inheritance path, no "forgot password". Exchanges offer custodial inheritance (Coinbase, etc.) but that defeats self-custody. Paper wills leak keys. Multi-sig schemes require heirs to already be crypto-fluent. There is no widely-adopted non-custodial, on-chain inheritance primitive — it is literally an unsolved problem *native* to blockchain, which matches this hackathon's brief exactly.

Precedent that validates the theme: "Noah" (crypto will) was an ETHGlobal New York 2025 finalist. But nothing similar dominates Devpost submissions at small events — high uniqueness headroom.

## The Solution

**Ethernal** is a non-custodial on-chain inheritance vault ("dead man's switch" done safely):

1. **Owner** creates a vault, deposits ETH/ERC-20, registers heirs + shares (basis points), sets heartbeat + challenge windows. Heirs can be **public** or **sealed** — `keccak256(heir, salt)` commitments hide identities on-chain; heirs hold "claim cards" (`ethernal:chain:vault:addr:salt`) as their proof.
2. **Every owner action is a heartbeat** — `ping()`, deposits, withdrawals, heir updates all refresh liveness AND auto-cancel any pending claim (Liana's "any spend refreshes the timelock", generalized).
3. **Claim initiation:** after lapse, an heir `initiateClaim()` → opens a **challenge period** the owner can cancel, and an optional **guardian** can veto (guardians can NEVER touch funds — asymmetric power).
4. **Finalization:** uncontested claims become claimable; heirs **pull** their share of ETH + all ERC-20s + any **specifically-bequeathed NFTs** (per-heir assignment — "my Azuki to Alice").
5. **Dead man's letter:** AES-256-GCM ciphertext per heir on-chain; passphrase handed off-chain. Honest privacy model.

Safety properties: non-custodial (no admin key), pull-based payouts, challenge period + guardian veto, owner sovereign while alive, heir privacy by choice.

## Competitive landscape (researched 2026-09-22)

| Product | Model | Weakness | Our edge |
|---|---|---|---|
| Casa Inheritance | 3-key multisig, request→6mo owner veto | $250/yr, custodial key, BTC-only | free, non-custodial, any EVM asset |
| Liana (Bitcoin) | timelocked recovery key, any spend refreshes | BTC only, no per-asset bequests | multi-asset + NFT bequests + guardian |
| Sarcophagus | Arweave payload + SARCO-incentivized nodes | dual-token complexity, resurrection windows | zero deps, no token |
| Inheriti/SafeHaven | SSS shares + SafeKey hw + Merge Authority | patented/closed | MIT, auditable single contract |
| Vault12 | guardian quorum restores vault (48h veto) | centralized app | guardian veto contract-enforced |
| CipherWill/Killswitch | centralized DMS, reminder ladder | custodial keys | non-custodial |

Lessons absorbed: challenge window ≈ Casa/Vault12 veto; auto-heartbeat ≈ Liana refresh; sealed heirs ≈ Sarcophagus/Inheriti privacy pitch done right; per-heir bequests = gap nobody fills.

## Judging-criteria map

| Criterion | How Ethernal answers it |
|---|---|
| Innovation | On-chain liveness oracle (heartbeat) + contestable claims + per-heir encrypted letters. Not another vote/supply-chain/escrow clone. |
| Technical Feasibility | Single audited-shape Solidity contract, no external deps, no oracles needed — time is the only input. Fully testable. |
| Uniqueness | Competitor scan: rental-deposit escrows, milestone crowdfunding, voting, supply chain saturate Devpost. Inheritance is rare and visceral. |
| Design | Countdown-driven UX: owner sees a live "time until claimable" ring; heirs see a clear claim state machine. Demo uses 60s heartbeats so the full lifecycle plays out live on stage. |

## Demo story (for video + pitch)

> "Meet Ada. She holds ETH she wants her kids to have — but if she hands them the key today, it's not really hers anymore. Ethernal: she deposits, sets a 30-day heartbeat, and just checks in. Watch: we simulate Ada going silent — heartbeat lapses — her heir initiates the claim, the challenge window runs, no ping arrives — and the vault pays out, split 60/40, plus an encrypted letter only her daughter can open. No custodian. No court. Just the contract."

## Architecture

```
3rd-Web-Hack/
  contracts/        Hardhat 2.x + Solidity 0.8.x + ethers v6 tests
    contracts/Ethernal.sol
    test/Ethernal.test.js
    scripts/deploy.js
  app/              Vite + React + TS + Tailwind v4 + ethers v6 dapp
    src/pages — Landing / Owner dashboard / Heir portal
  README.md         Devpost-facing: problem, solution, stack, setup
  SUBMISSION.md     Devpost submission draft
  demo/             demo script + assets
```

- **Chain:** any EVM. Dev/demo on local Hardhat node (`npx hardhat node`); Sepolia for the live demo link if testnet ETH is available.
- **Contract address / ABI** for the app: exported to `app/src/contract.json` by the deploy script.
- **No backend.** Frontend talks to the chain directly via MetaMask/ethers. Message encryption is client-side AES-GCM (WebCrypto), passphrase-derived (PBKDF2).

## Commands

- Contracts: `cd contracts && npm test` · `npm run node` · `npm run deploy:local` · `npm run deploy:sepolia`
- App: `cd app && npm run dev` · `npm run build`

## Conventions

- No secrets committed; `.env` gitignored; `.env.example` committed.
- Contract: checks-effects-interactions, custom errors, events on every state change, pull-over-push for payouts.
- UI: dark theme, countdown-first design, every contract state maps to a visible badge/stepper.
- Demo mode: heartbeat intervals as low as 60s must be supported (UI hint + contract allows ≥60s).

## Status / TODO

- [x] `Ethernal.sol` v2 — lifecycle + sealed-heir commitments + guardian veto + NFT bequests + auto-heartbeat + letters
- [x] Contract tests — 14 passing (public & private vaults, veto, bequests, auto-heartbeat, splits, edge cases)
- [x] Deploy scripts + ABI/address export to `app/src/contract.json` (incl. MockToken + MockNFT on local)
- [x] Frontend — landing, owner dashboard (privacy toggle, guardian, bequest, letter), heir portal (claim cards + salt claims)
- [x] E2E verified — `scripts/e2e-demo.js` covers sealed heirs/NFT/veto/auto-heartbeat; `demo/e2e-ui.js` = full Firefox UI lifecycle (21 checks + screenshots in `demo/shots/`)
- [x] README + SUBMISSION.md + demo script (`demo/DEMO_SCRIPT.md`)
- [x] Demo video recorded — `demo/scenes.js` (18 scenes: cards + live UI session) → `demo/out/demo.mp4` (~5 min, TTS VO + captions + focus zoom). Re-record: fresh `hardhat node` + `deploy:local` (scenes expect Vault #0), `npm run dev`, then `node ~/tools/demo-recorder/record-demo.js demo/scenes.js --out=demo/out`
- [x] GitHub Pages live preview — https://georgefifth.github.io/ethernal/ (gh-pages branch, relative-base build; contract.json is a per-chain deployments map so one build serves local + testnet)
- [ ] Optional: Sepolia deploy (needs funded key in contracts/.env)
- [x] Pitch deck — `demo/deck.html` (8 slides: problem/solution/innovation/vs incumbents/proof/impact+roadmap/end) → `demo/Ethernal-deck.pdf` (re-export: playwright chromium → `page.pdf`, 1920×1080 pages)
- [ ] Devpost submission (deadline Sep 27 12:30 IST) — needs: repo link, `demo/out/demo.mp4`, `demo/Ethernal-deck.pdf`, SUBMISSION.md copy
