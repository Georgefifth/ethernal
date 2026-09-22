# Ethernal ◆

**Your keys die with you. Your crypto doesn't have to.**

Ethernal is a non-custodial on-chain inheritance vault — a dead man's switch for crypto assets, built for the [3rd-Web-Hack](https://3rd-web-hack.devpost.com/) hackathon.

## The problem

Blockchains never solved inheritance. An estimated ~20% of all Bitcoin (~$140B+) is stranded in wallets whose owners died or lost access. Custodial exchanges offer inheritance, but only by holding your keys — defeating self-custody. Paper wills leak seed phrases. Multi-sig schemes demand heirs already be crypto-fluent.

There is no widely-adopted, non-custodial, on-chain inheritance primitive. This is a genuinely unsolved problem *native* to blockchain.

## How it works

```
Seal ──► Heartbeat ──► Lapse ──► Challenge ──► Inherit
deposit   any owner     silence   heirs file;    heirs pull
assets    action =      detected  owner/guardian shares +
          alive proof             may veto       bequests + letters
```

1. **Seal** — owner creates a vault, deposits ETH/ERC-20, registers heirs and shares (basis points), sets a heartbeat interval and a challenge window.
2. **Heartbeat** — *every* owner action is proof of life. `ping()`, depositing, withdrawing, updating heirs — all refresh the timer and auto-cancel any pending claim. No separate ritual to remember.
3. **Lapse & challenge** — miss the interval and any heir may `initiateClaim()`. That opens a challenge window where the owner can cancel — or a designated **guardian** can veto (guardians can never touch funds).
4. **Inherit** — uncontested claims finalize; each heir pulls their exact share of ETH and every deposited token via `withdrawShare()`, plus any **specifically-bequeathed NFTs** ("my Azuki goes to Alice").
5. **Dead man's letters** — optionally seal an AES-256-GCM encrypted message per heir on-chain; the passphrase is handed over in person. Ciphertext public, key off-chain.
6. **Sealed heirs (optional)** — heir identities can be stored as salted commitments instead of addresses, so your family isn't a public target. Each heir gets a *claim card* — the only proof that links them to their share.

## Why it's safe

- **Non-custodial** — no admin key, no operator, no multisig committee. The contract is the executor.
- **Owner stays sovereign** — full withdraw/update rights while alive; heirs get nothing until finalization.
- **Contestable claims** — the challenge window is a second heartbeat, catching false positives; an optional guardian adds an emergency brake.
- **Pull payouts** — heirs withdraw their own share; shares computed against the finalized balance so early claimers can't shrink later ones.
- **Privacy by choice** — public heirs for discoverability, or sealed commitments so heirs can't be identified or phished.

## vs. incumbents

| | Casa | Sarcophagus | Inheriti | Liana | **Ethernal** |
|---|---|---|---|---|---|
| Custodial / trusted party | holds a key | node operators | proprietary shares | none | **none** |
| Cost | $250/yr | ETH+SARCO tokens | paid plans | free | **gas only** |
| Assets inherited | BTC only | file payloads | data/keys | BTC only | **ETH+ERC20+NFT** |
| Heir privacy | n/a | encrypted payload | SSS shares | xpub-only | **salted commitments** |
| Specific bequests | ✗ | ✗ | ✗ | ✗ | **✓ per-heir NFTs** |
| Open source | partial | ✓ | ✗ (patented) | ✓ | **✓ MIT** |

## Tech stack

| Layer | Choice |
|---|---|
| Contracts | Solidity 0.8.24, Hardhat 2, ethers v6, chai-matchers + network-helpers (14 tests) |
| Frontend | Vite + React 19 + TypeScript + Tailwind 4 + ethers v6 |
| Crypto | WebCrypto AES-GCM-256, PBKDF2 (100k iters) for sealed letters |
| Chain | Any EVM — local Hardhat node for dev/demo, Sepolia-ready |

## Quickstart

```bash
# 1. contracts
cd contracts
npm install
npm test                     # 16 tests, full lifecycle

# 2. local chain + deploy (writes ABI+address into app/src/contract.json)
npm run node                 # terminal A
npm run deploy:local         # terminal B

# 3. app
cd ../app
npm install
npm run dev                  # http://localhost:5173
```

**Demo flow (2 minutes):** connect a *demo account* (hardhat account #0) → New Vault → heirs `#1`/`#2` at 60/40, heartbeat **2 min**, challenge **1 min** → deposit ETH + mUSDC → bequeath an NFT to #1 → seal a letter → switch to account #1 → wait for lapse → *File claim* → wait out the challenge → *Finalize* → *Withdraw* → open the sealed letter.

**Sealed-heirs flow:** toggle "Sealed" at creation → copy each heir's claim card → heir pastes it under *I'm an heir → Have a claim card?* to open their vault (nothing is discoverable on-chain).

**Sepolia:** copy `contracts/.env.example` → `.env`, add RPC + funded key, `npm run deploy:sepolia`.

## Project layout

```
contracts/   Ethernal.sol + tests + deploy/e2e scripts (Hardhat)
app/         React dapp — landing, owner dashboard, heir portal
AGENTS.md    design doc: problem, judging map, conventions
SUBMISSION.md  devpost submission draft
demo/        demo assets & script
```

## License

MIT
