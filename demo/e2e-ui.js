// Ethernal v2 — full-lifecycle Firefox E2E (real clicks + screenshots)
const { firefox } = require('/home/yap/tools/demo-recorder/node_modules/playwright');

const APP = 'http://localhost:5173';
const RPC = 'http://localhost:8545';
const SHOTS = '/home/yap/Hack/3rd-Web-Hack/demo/shots';
const A = {
  alice:    '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', // #1 heir 60%
  bob:      '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', // #2 heir 40%
  guardian: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65', // #4
};

let rpcId = 0;
const rpc = (method, params = []) =>
  fetch(RPC, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method, params, id: ++rpcId }) }).then(r => r.json());
const timeSkip = async (secs) => { await rpc('evm_increaseTime', [secs]); await rpc('evm_mine'); };

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const blockNum = async () => parseInt((await rpc('eth_blockNumber')).result, 16);
const waitMined = async (before, extra = 1) => {
  for (let i = 0; i < 80; i++) { if (await blockNum() >= before + extra) return; await sleep(250); }
  throw new Error('tx not mined');
};

(async () => {
  const browser = await firefox.launch({ headless: true });
  const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const fails = [];
  const shot = (name) => p.screenshot({ path: `${SHOTS}/${name}.png` });
  const check = (name, cond) => { console.log(`${cond ? '✓' : '✗ FAIL'} ${name}`); if (!cond) fails.push(name); };
  const waitFor = async (name, text, timeout = 20000) => {
    try { await p.waitForSelector(`text=${text}`, { timeout }); check(name, true); return true; }
    catch { check(name, false); return false; }
  };
  const switchAccount = async (i) => {
    await p.getByText('switch', { exact: true }).click();
    await p.locator('header select').selectOption(String(i));
    await sleep(1500);
  };

  // ---------- 1. landing + connect ----------
  await p.goto(APP);
  await shot('01-landing');
  await p.getByText('Open the Vault').click();
  await p.locator('header select').selectOption('0');
  await sleep(1500);
  check('connected as owner #0', (await p.textContent('body')).includes('0xf39F'));

  // ---------- 2. create SEALED vault with guardian ----------
  await p.getByText('+ New Vault').click();
  await p.locator('input[placeholder="0x… heir address"]').first().fill(A.alice);
  await p.locator('input[placeholder="%"]').first().fill('60');
  await p.getByText('+ Add heir').click();
  await p.locator('input[placeholder="0x… heir address"]').nth(1).fill(A.bob);
  await p.locator('input[placeholder="%"]').nth(1).fill('40');
  await p.locator('select').nth(0).selectOption('120');   // heartbeat 2 min
  await p.locator('select').nth(1).selectOption('60');    // challenge 1 min
  await p.locator('input[placeholder="0x… or empty"]').fill(A.guardian);
  await p.getByText('Public — heirs visible & auto-discoverable').click(); // → sealed
  await shot('02-create-form');
  await p.getByText('Seal Vault', { exact: true }).click();
  await waitFor('claim cards screen', 'deliver these claim cards');
  await shot('03-claim-cards');
  const cards = await p.locator('code').allTextContents();
  const aliceCard = cards.find(c => c.toLowerCase().includes(A.alice.toLowerCase()));
  check('claim card issued for Alice', !!aliceCard && aliceCard.startsWith('ethernal:'));
  await p.getByText('Done — cards delivered').click();
  await waitFor('vault #0 in owner list', 'Vault #0');
  await shot('04-owner-vault');

  // ---------- 3. fund ETH + token ----------
  await p.locator('input[placeholder="ETH"]').fill('5');
  await p.getByRole('button', { name: 'Deposit', exact: true }).first().click();
  await waitFor('ETH deposit reflected', '5.0000 ETH');

  await p.locator('input[placeholder="mUSDC"]').fill('1000');
  await p.getByRole('button', { name: 'Deposit', exact: true }).nth(1).click();
  await waitFor('mUSDC deposit reflected', '1000.00 mUSDC', 30000);
  await shot('05-funded');

  // ---------- 4. sealed letter (toggle panel open first) ----------
  await p.getByText('✉ Letter').click();
  await p.locator('div.bg-panel2 select').first().selectOption({ label: '0x7099…79C8' });
  await p.locator('input[placeholder*="passphrase (tell them"]').fill('for-my-daughter');
  await p.locator('textarea').fill('The Ledger backup is in the safe behind the bookshelf. I love you.');
  await p.getByText('Seal letter on-chain').click();
  await waitFor('letter sealed', '✉ letter');
  await shot('06-letter-sealed');

  // ---------- 5. NFT bequest → Alice ----------
  await p.getByText('◈ Bequeath NFT').click();
  await p.locator('input[placeholder*="token id"]').fill('0');
  // two panels open now (letter + bequest); bequest select is the one next to the token-id input
  await p.locator('div.bg-panel2').filter({ has: p.locator('input[placeholder*="token id"]') }).locator('select').selectOption({ label: '0x7099…79C8' });
  await p.getByRole('button', { name: 'Bequeath', exact: true }).click();
  await waitFor('NFT bequest reflected', '1 NFT', 30000);
  await shot('07-bequest');

  // ---------- 6. ping ----------
  let bn = await blockNum();
  await p.getByText("I'm Alive").click();
  await waitMined(bn);  // ping tx MUST be mined before the time skip
  check('ping tx mined', true);

  // ---------- 7. lapse → heir claims via card ----------
  await timeSkip(130);
  await switchAccount(1);
  await p.getByText("I'm an heir").click();
  await sleep(1500);
  check('sealed vault NOT auto-listed', !(await p.textContent('body')).includes('Vault #0'));
  await p.locator('input[placeholder^="ethernal:"]').fill(aliceCard);
  await p.getByText('Open', { exact: true }).click();
  await waitFor('claim card opens vault', 'Vault #0');
  await shot('08-heir-lapsed');
  await p.getByText('⚑ File claim').click();
  await waitFor('status Challenged', 'Challenged');
  await shot('09-claim-filed');

  // ---------- 8. guardian veto ----------
  await switchAccount(4);
  await p.getByText("I'm a guardian").click();
  await waitFor('guardian sees vault', 'Vault #0');
  await shot('10-guardian-warning');
  await p.getByText('Veto this claim').click();
  await waitFor('veto cleared claim', 'no active claim');
  await shot('11-vetoed');

  // ---------- 9. re-file → finalize → withdraw ----------
  await switchAccount(1);
  await p.getByText("I'm an heir").click();
  await p.locator('input[placeholder^="ethernal:"]').fill(aliceCard);
  await p.getByText('Open', { exact: true }).click();
  await waitFor('vault reopened (Lapsed)', 'Vault #0');
  await p.getByText('⚑ File claim').click();
  await waitFor('re-challenged', 'Challenged');
  await timeSkip(61);
  await sleep(4000); // let poll refresh claimableAt
  await p.getByText('Finalize claim').click();
  await waitFor('status Claimable', 'Claimable');
  await p.getByText('Withdraw your 60%').click();
  await waitFor('withdraw complete', 'share has been inherited', 30000);
  await shot('12-inherited');

  // ---------- 10. decrypt letter ----------
  await p.locator('input[placeholder="letter passphrase"]').fill('for-my-daughter');
  await p.getByText('Open sealed letter').click();
  await waitFor('letter decrypted', 'bookshelf');
  await shot('13-letter-opened');

  // ---------- 11. negative: wrong passphrase ----------
  await p.locator('input[placeholder="letter passphrase"]').fill('wrong-pass');
  await p.getByText('Open sealed letter').click();
  await waitFor('wrong passphrase rejected', 'Wrong passphrase');
  await shot('14-wrong-pass');

  // ---------- 12. Bob: sealed vault invisible without card ----------
  const p2 = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await p2.goto(APP);
  await p2.getByText('Open the Vault').click();
  await p2.locator('header select').selectOption('2');
  await sleep(1500);
  await p2.getByText("I'm an heir").click();
  await sleep(1500);
  check('Bob sees no sealed vault', !(await p2.textContent('body')).includes('Vault #0'));
  await p2.screenshot({ path: `${SHOTS}/15-bob-empty.png` });

  console.log('\n' + (fails.length ? `✗ ${fails.length} failures: ${fails.join(', ')}` : '✓ ALL CHECKS PASSED'));
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error('CRASH:', e.message.split('\n')[0]); process.exit(1); });
