# Demo video script — Ethernal v2 (~120s)

Setup before recording:
1. `cd contracts && npm run node` (fresh node, clean state)
2. `npm run deploy:local`
3. `cd ../app && npm run dev`
4. Browser at http://localhost:5173, clean profile, zoom 110%
5. Hardhat accounts: #0 owner, #1 heir Alice, #2 heir Bob, #4 guardian

## Scenes

| # | Shot | Action | Voiceover (approx) |
|---|------|--------|--------------------|
| 1 | Landing hero | scroll slowly | "A hundred forty billion dollars of Bitcoin sits in wallets whose owners are gone. Blockchains never solved inheritance — Ethernal does." |
| 2 | Problem cards | scroll past $140B / 0 / 1 | "No 'forgot password'. No executor. One heartbeat between your family and your assets." |
| 3 | Create vault | account #0 → New Vault → heirs #1 (60%) #2 (40%), toggle **Sealed**, heartbeat 2min, challenge 1min → Seal → claim cards shown | "Ada seals a vault — sixty forty to her kids. And she seals the heir list too: only commitments go on-chain, so nobody can hunt her family." |
| 4 | Claim cards | highlight card rows | "Each heir gets a claim card — the only proof linking them to their share. She hands it over in person." |
| 5 | Deposit + bequest + letter | deposit 5 ETH + mUSDC → Bequeath NFT #0 → heir1 → seal letter w/ passphrase | "She funds it, bequeaths an NFT to her daughter specifically — like a real will — and seals a letter only her passphrase opens." |
| 6 | Heartbeat | click "I'm Alive"; countdown resets | "As long as Ada acts — ping, deposit, anything — she's alive. No separate ritual." |
| 7 | Lapse + guardian veto | switch to #1 → File claim → switch to #4 → "I'm a guardian" tab → amber warning → Veto | "Ada goes silent. Her daughter files a claim — but the guardian's watchtower lights up, and vetoes it. A coma isn't a funeral." |
| 8 | Finalize + withdraw | re-file → wait challenge → Finalize → Withdraw → NFT + ETH land | "When the claim stands, the vault opens: sixty percent, plus the bequeathed NFT, plus the letter." |
| 9 | End card | logo + GitHub | "Ethernal. Non-custodial inheritance — no token, no subscription, no admin key." |
