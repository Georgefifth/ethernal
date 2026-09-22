// Ethernal — 3rd-Web-Hack demo video scene spec
// pipeline: node ~/tools/demo-recorder/record-demo.js demo/scenes.js --out=demo/out
// Prereqs: fresh `npx hardhat node` + `npm run deploy:local` + `npm run dev` on :5173

const ALICE = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"; // hardhat #1 — heir, 60%
const BOB   = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"; // hardhat #2 — heir, 40%
const GUARD = "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65"; // hardhat #4 — guardian

// every exec body runs inside an async IIFE — statements AND await are legal
const E = (body) => `(async()=>{${body}})()`;
const SEL = `const _sel=(el,v)=>{const st=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set;st.call(el,v);el.dispatchEvent(new Event('change',{bubbles:true}))};`;
const INP = `const _inp=(el,v)=>{const st=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;st.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}))};`;
const RPCQ = `const _rpc=(m,p)=>fetch('http://localhost:8545',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',method:m,params:p,id:1})}).then(r=>r.json());`;
const ACCT = (i) => E(`${SEL}_sel(document.querySelector('header select'),'${i}')`);
const SKIP = (s) => E(`${RPCQ}await _rpc('evm_increaseTime',[${s}]);await _rpc('evm_mine');`);
const WAIT_BLOCK = E(`${RPCQ}const n=parseInt((await _rpc('eth_blockNumber')).result,16);for(let i=0;i<80;i++){const b=parseInt((await _rpc('eth_blockNumber')).result,16);if(b>n)break;await new Promise(r=>setTimeout(r,250));}`);
const CARD_FILL = E(`${INP}_inp(document.querySelector('input[placeholder^="ethernal:"]'), window.__card)`);

module.exports = [
  // ---------- cards: the argument ----------
  { name: "cover",
    card: { image: "/home/yap/Hack/3rd-Web-Hack/demo/shots/s1.png" },
    duration: 14,
    vo: "A hundred and forty billion dollars of crypto sits in wallets whose owners are dead, or locked out forever. Ethernal is a non-custodial inheritance vault — a dead man's switch that can actually be contested." },

  { name: "problem",
    card: { image: "/home/yap/Hack/3rd-Web-Hack/demo/shots/s2.png" },
    duration: 19,
    vo: "Self-custody's oldest edge case: your keys are mortal, your assets aren't. Exchanges offer inheritance, but they hold your keys. Paper wills leak seed phrases. Multisig asks your heirs to already be experts. There's still no primitive that lets assets pass on without giving up custody while you're alive." },

  { name: "mechanism",
    card: { image: "/home/yap/Hack/3rd-Web-Hack/demo/shots/s3.png" },
    duration: 21,
    vo: "Here's the mechanism. The owner seals a vault and funds it. Every owner action is a heartbeat — no separate ritual. If the heartbeat lapses, heirs can file a claim — but it opens a challenge window, not a payout. The owner can cancel; a guardian can veto. Only an uncontested claim unlocks the shares." },

  // ---------- live: sealing ----------
  { name: "open-app", session: "app", url: "http://localhost:5173",
    actions: [
      { type: "waitFor", sel: "text=Open the Vault" },
      { type: "exec", js: ACCT(0) },
      { type: "click", sel: "text=Open the Vault" },
      { type: "waitFor", sel: "text=Your Vaults" },
      { type: "click", sel: "text=+ New Vault" },
      { type: "waitFor", sel: 'input[placeholder="0x… heir address"]' },
      { type: "wait", ms: 5000 },
    ],
    vo: "Meet Ada. She holds ETH she wants her kids to have — without handing over keys today, and without trusting a company to outlive her. She connects and opens a new vault." },

  { name: "heirs-sealed", session: "app",
    actions: [
      { type: "fill", sel: 'input[placeholder="0x… heir address"]', text: ALICE },
      { type: "fill", sel: 'input[placeholder="%"]', text: "60" },
      { type: "click", sel: "text=+ Add heir" },
      { type: "fill", sel: 'input[placeholder="0x… heir address"] >> nth=1', text: BOB },
      { type: "fill", sel: 'input[placeholder="%"] >> nth=1', text: "40" },
      { type: "exec", js: E(`${SEL}const s=document.querySelectorAll('select');_sel(s[0],'120');_sel(s[1],'60');`) },
      { type: "fill", sel: 'input[placeholder="0x… or empty"]', text: GUARD },
      { type: "click", sel: "text=Public — heirs visible" },
      { type: "wait", ms: 6000 },
    ],
    vo: "Sixty percent to her daughter, forty to her son. A two-minute heartbeat for the demo — in production she'd pick ninety days. A guardian as the emergency brake. And the important one: she seals the heir list. Only commitments go on-chain — nobody can scrape the ledger and phish her family." },

  { name: "claim-cards", session: "app",
    actions: [
      { type: "click", sel: "text=Seal Vault" },
      { type: "waitFor", sel: "text=deliver these claim cards", timeout: 25000 },
      { type: "exec", js: E("window.__card = document.querySelector('code').textContent") },
      { type: "hover", sel: "code" },
      { type: "wait", ms: 2500 },
      { type: "click", sel: "text=Done — cards delivered" },
      { type: "waitFor", sel: "text=Vault #0" },
      { type: "wait", ms: 5000 },
    ],
    vo: "One transaction — the vault is sealed. Each heir gets a claim card: the vault id, their address, and a secret salt. It's the only thing that links them to their share. She hands it over in person, or inside their sealed letter. Ethernal keeps nothing." },

  { name: "fund", session: "app",
    actions: [
      { type: "fill", sel: 'input[placeholder="ETH"]', text: "5" },
      { type: "click", sel: 'button:has-text("Deposit") >> nth=0' },
      { type: "waitFor", sel: "text=5.0000 ETH", timeout: 20000 },
      { type: "fill", sel: 'input[placeholder="mUSDC"]', text: "1000" },
      { type: "click", sel: 'button:has-text("Deposit") >> nth=1' },
      { type: "waitFor", sel: "text=1000.00 mUSDC", timeout: 30000 },
      { type: "wait", ms: 4000 },
    ],
    vo: "She funds it — five ETH, a thousand stablecoins. ETH, ERC-twenties, whatever the vault holds at the end is what gets split. No wrapping, no special token." },

  { name: "letter", session: "app",
    actions: [
      { type: "click", sel: "text=✉ Letter" },
      { type: "exec", js: E(`${SEL}const s=[...document.querySelectorAll('select')].find(x=>[...x.options].some(o=>o.textContent.includes('pick heir')));_sel(s,'${ALICE}');`) },
      { type: "fill", sel: 'input[placeholder*="passphrase (tell them"]', text: "ledger-phrase-2026" },
      { type: "fill", sel: "textarea", text: "The Ledger backup is in the safe behind the bookshelf. The combination is your mother's birthday. I love you." },
      { type: "click", sel: "text=Seal letter on-chain" },
      { type: "waitFor", sel: "text=✉ letter", timeout: 20000 },
      { type: "wait", ms: 4500 },
    ],
    vo: "And a dead man's letter — AES-256 encrypted in the browser before it ever touches the chain. The ciphertext is public; the passphrase is whispered off-chain. The honest version of privacy." },

  { name: "bequest", session: "app",
    actions: [
      { type: "click", sel: "text=◈ Bequeath NFT" },
      { type: "fill", sel: 'input[placeholder*="token id"]', text: "0" },
      { type: "exec", js: E(`${SEL}const d=[...document.querySelectorAll('div')].find(x=>x.querySelector('input[placeholder*="token id"]'));_sel(d.querySelector('select'),'${ALICE}');`) },
      { type: "click", sel: 'button:text-is("Bequeath")' },
      { type: "waitFor", sel: "text=1 NFT", timeout: 30000 },
      { type: "wait", ms: 4000 },
    ],
    vo: "Percentage splits can't express a real will — so specific bequests exist. This NFT goes to her daughter specifically, outside the sixty-forty split. No incumbent does per-asset inheritance; Ethernal does." },

  { name: "heartbeat", session: "app",
    actions: [
      { type: "click", sel: "text=I'm Alive" },
      { type: "exec", js: WAIT_BLOCK },
      { type: "wait", ms: 800 },
      { type: "exec", js: SKIP(130) },
      { type: "wait", ms: 3200 },
    ],
    vo: "As long as Ada acts — ping, deposit, anything — the contract knows she's alive. Watch the countdown reset. Then, one day, the actions stop. We fast-forward the chain past the heartbeat." },

  // ---------- live: the claim ----------
  { name: "heir-open", session: "app",
    actions: [
      { type: "click", sel: "text=switch" },
      { type: "wait", ms: 500 },
      { type: "exec", js: ACCT(1) },
      { type: "wait", ms: 1500 },
      { type: "click", sel: "text=I'm an heir" },
      { type: "exec", js: CARD_FILL },
      { type: "click", sel: 'button:text-is("Open")' },
      { type: "waitFor", sel: "text=Vault #0", timeout: 15000 },
      { type: "wait", ms: 5000 },
    ],
    vo: "Months later, her daughter opens the app. Notice: nothing was listed for her wallet — sealed vaults don't broadcast their heirs. Her claim card is the only key that finds it. She pastes it, and the vault appears — lapsed, claimable, hers to start." },

  { name: "file-claim", session: "app",
    actions: [
      { type: "click", sel: "text=⚑ File claim" },
      { type: "waitFor", sel: "text=Challenged", timeout: 20000 },
      { type: "wait", ms: 8000 },
    ],
    vo: "She files the claim — and this is the part most dead man's switches get wrong. No payout yet. A challenge window opens. If Ada is merely off-grid, she pings and it's cancelled. If a claim looks wrong, the guardian vetoes it." },

  { name: "veto", session: "app",
    actions: [
      { type: "click", sel: "text=switch" },
      { type: "wait", ms: 500 },
      { type: "exec", js: ACCT(4) },
      { type: "wait", ms: 1500 },
      { type: "click", sel: "text=I'm a guardian" },
      { type: "waitFor", sel: "text=Vault #0", timeout: 15000 },
      { type: "wait", ms: 1500 },
      { type: "click", sel: "text=Veto this claim" },
      { type: "waitFor", sel: "text=no active claim", timeout: 20000 },
      { type: "wait", ms: 5000 },
    ],
    vo: "The guardian's watchtower lights up — claim in progress, one minute to finalize. Say Ada's in a coma, not gone. One click: vetoed. The guardian can stop a claim but can never touch a wei — asymmetric power, enforced by the contract." },

  { name: "refile", session: "app",
    actions: [
      { type: "click", sel: "text=switch" },
      { type: "wait", ms: 500 },
      { type: "exec", js: ACCT(1) },
      { type: "wait", ms: 1500 },
      { type: "click", sel: "text=I'm an heir" },
      { type: "exec", js: CARD_FILL },
      { type: "click", sel: 'button:text-is("Open")' },
      { type: "waitFor", sel: "text=Vault #0", timeout: 15000 },
      { type: "click", sel: "text=⚑ File claim" },
      { type: "waitFor", sel: "text=Challenged", timeout: 20000 },
      { type: "exec", js: SKIP(61) },
      { type: "wait", ms: 3500 },
    ],
    vo: "This time there's no veto — Ada really is gone. The claim is re-filed, the challenge window runs, and nobody contests it. We skip the chain forward one more minute." },

  { name: "collect", session: "app",
    actions: [
      { type: "click", sel: "text=Finalize claim" },
      { type: "waitFor", sel: "text=Claimable", timeout: 20000 },
      { type: "click", sel: "text=Withdraw your 60%" },
      { type: "waitFor", sel: "text=share has been inherited", timeout: 25000 },
      { type: "wait", ms: 5500 },
    ],
    vo: "Finalized. Now she pulls her share — sixty percent of the ETH, sixty percent of the tokens, plus the NFT her mother meant for her. Pull-based payouts: each heir collects their own, no one's transaction can block another's." },

  { name: "letter-open", session: "app",
    actions: [
      { type: "fill", sel: 'input[placeholder="letter passphrase"]', text: "ledger-phrase-2026" },
      { type: "click", sel: "text=Open sealed letter" },
      { type: "waitFor", sel: "text=bookshelf", timeout: 15000 },
      { type: "wait", ms: 4000 },
    ],
    vo: "And the letter — sealed years ago, opened now. The last thing a smart contract can deliver isn't money. It's this." },

  // ---------- cards: the close ----------
  { name: "compare",
    card: { image: "/home/yap/Hack/3rd-Web-Hack/demo/shots/s4.png" },
    duration: 19,
    vo: "Against the incumbents: Casa wants two-fifty a year and holds a key. Liana is Bitcoin-only. Sarcophagus needs two tokens and a node network. Inheriti is patented and closed. Ethernal is one auditable contract — no token, no oracle, no admin key, free forever." },

  { name: "end",
    card: { image: "/home/yap/Hack/3rd-Web-Hack/demo/shots/s5.png" },
    duration: 13,
    vo: "Ethernal. MIT licensed, fully open — source, tests, and this demo are in the repo. Your keys die with you. Your crypto doesn't have to." },
];
