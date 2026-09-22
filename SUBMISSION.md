# Devpost submission — Ethernal

**Project name:** Ethernal

**Elevator pitch:** Your keys die with you. Your crypto doesn't have to — a non-custodial on-chain will for ETH, tokens, NFTs, and last words.

**Built with:** `solidity` `ethereum` `hardhat` `ethers.js` `react` `typescript` `vite` `tailwindcss` `web3` `smart-contracts`

**Try it out:** https://georgefifth.github.io/ethernal/ (live UI) · https://github.com/Georgefifth/ethernal (source + one-command local demo)

**Demo video:** https://github.com/Georgefifth/ethernal/blob/main/demo/demo.mp4 (plays inline on GitHub) — direct download: https://github.com/Georgefifth/ethernal/releases/download/v1.0-hackathon/demo.mp4

**Pitch deck:** https://github.com/Georgefifth/ethernal/blob/main/demo/Ethernal-deck.pdf (renders inline on GitHub)

---

## Inspiration

Blockchains never solved inheritance. Roughly 20% of all Bitcoin — over **$140B** — sits in wallets whose owners died or lost access. There is no protocol-level recovery path: no "forgot password," no executor, no estate process.

Every existing answer asks you to give up the thing self-custody is *for*. Custodial exchanges will pass assets to a family, but only because they hold the keys. Paper wills leak seed phrases to anyone who opens the drawer. Multisig inheritance setups require heirs who are already crypto-native. Casa charges ~$250/year and holds a key; Inheriti is closed and patented; Sarcophagus requires you to buy a token to write a will.

We asked: can the contract itself be the executor — contestable, private, and free?

## What it does

Ethernal is a dead man's switch implemented as a smart-contract vault:

- **Seal** — the owner deposits ETH/ERC-20s into a personal vault and registers heirs with exact percentage shares. Heirs can be *sealed*: only salted `keccak256` commitments go on-chain, so nobody can see or target them. Each sealed heir gets a physical **claim card** — the only thing they need.
- **Heartbeat** — every owner action (deposit, withdraw, edit heirs, seal a letter) proves liveness. No ritual check-ins.
- **Lapse → challenge** — if the heartbeat lapses, an heir files a claim, opening a challenge window where the owner cancels with one action — and an optional **guardian** can veto. A guardian can never touch funds; the contract forbids it. Claims are contestable, never instant — a long vacation can't drain your vault.
- **Inherit** — an uncontested claim finalizes; each heir *pulls* their share of ETH and every ERC-20, plus any **specific NFT bequests** ("my Azuki goes to Alice") and their **sealed letter** — an AES-256 message decrypted only with a passphrase whispered off-chain.

## How we built it

- **Contract:** Solidity 0.8.24 on Hardhat 2 — a single dependency-free contract using checks-effects-interactions, custom errors, full event coverage, and pull-based payouts computed on *frozen* claim balances (so late claims can't dilute early ones).
- **Privacy:** sealed heirs are `keccak256(heir, salt)` commitments; claim cards encode `chainId:vaultId:heir:salt`. Letters use AES-256-GCM via WebCrypto with PBKDF2 keys — ciphertext on-chain, passphrase off-chain.
- **Frontend:** Vite + React 19 + TypeScript + Tailwind 4 + ethers v6 — three role portals (owner / heir / guardian watchtower), dark countdown-first UI where every contract state is a visible badge.
- **Verification:** 14 contract tests covering the full lifecycle and edge cases, plus a 21-check headless-Firefox Playwright suite that clicks through the entire flow with screenshots.

## Challenges we ran into

- **The premature-payout problem.** A naive dead man's switch has a fatal flaw: "silent" ≠ "dead". The challenge period — plus the guardian veto — turns a binary trigger into a contestable process without adding custody.
- **Heir privacy vs. UX.** Public heir addresses are convenient but create a phishable target list ("you're heir to 100 ETH — click here"). Sealed commitments fix that but make heirs undiscoverable; claim cards restore the UX without losing privacy — and both modes coexist per vault.
- **Fair share math.** If heirs claim at different times, naive proportional math lets early withdrawals shrink everyone else's cut. Shares are computed against the balance frozen at finalization — our tests caught this before anyone lost money.
- **Honest demo-ability.** Inheritance runs on months; demos run on minutes. The contract supports heartbeats down to 60s and the UI reads *chain* time (not wall clock) so countdowns stay truthful under time-travel test RPCs.

## Accomplishments that we're proud of

- A genuinely non-custodial executor: no admin key, no oracle, no keeper, no token, no subscription — MIT and auditable in one file.
- Features no incumbent ships together: sealed heirs + guardian veto + per-asset NFT bequests + encrypted last letters.
- The whole lifecycle is demoable end-to-end in under five minutes — including the veto-and-retry path.
- 14/14 contract tests, 21/21 browser E2E checks, and a narrated demo video — every claim in this submission was executed, not asserted.

## What we learned

- The best inheritance UX is *invisible*: making every owner action a heartbeat (borrowing Liana's timelock insight, generalized to any interaction) removed the one chore users would forget.
- "Private heirs" is the difference between a will and a doxxing list — and it's just a salt and a hash away.
- Contestability beats speed for irreversible operations: a challenge window is cheaper than a lawsuit.

## What's next for Ethernal

- **Deploys:** Sepolia + low-fee L2s; claim-card PDF/print export for real-world handover.
- **Liveness signals:** ERC-4337 session heartbeats and activity-based liveness (any on-chain action counts).
- **Notifications:** keeper/watchtower alerts when a vault approaches lapse or enters challenge.
- **Estates:** multi-vault bundles, contingent heirs, and M-of-N guardian attestations as an alternative trigger.
