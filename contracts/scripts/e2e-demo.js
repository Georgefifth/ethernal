// End-to-end demo script: exercises the deployed Ethernal contract exactly
// like the frontend does — v2: private heirs, NFT bequests, guardian veto.
// Run: npx hardhat run scripts/e2e-demo.js --network localhost
const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

const dep = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "app", "src", "contract.json")));

const log = (s) => console.log(`\x1b[33m◆\x1b[0m ${s}`);
const ST = ["Active", "Lapsed", "Challenged", "Claimable", "Drained"];
const ZERO_SALT = ethers.ZeroHash;
const salt = (s) => ethers.keccak256(ethers.toUtf8Bytes(s));

async function main() {
  if (network.name === "hardhat") throw new Error("run with --network localhost");
  const provider = ethers.provider;
  const [owner, heir1, heir2, , guardian] = await ethers.getSigners();
  const c = new ethers.Contract(dep.address, dep.abi, owner);

  log(`Ethernal at ${dep.address} (chain ${dep.chainId})`);

  // ============ private vault: sealed heirs + NFT bequest ============
  const tx1 = await c.createVault(
    [heir1.address, heir2.address], [salt("alice-pepper"), salt("bob-pepper")], [6000, 4000],
    120, 60, guardian.address, true,
  );
  await tx1.wait();
  const id = (await c.nextVaultId()) - 1n;
  const v = await c.getVault(id);
  log(`vault #${id} created — SEALED heirs (publicHeirs=${(await c.publicHeirsOf(id)).length}), guardian=${v.guardian.slice(0, 10)}…`);

  await (await c.depositETH(id, { value: ethers.parseEther("10") })).wait();
  const token = new ethers.Contract(dep.tokenAddress, [
    "function mint(address,uint256)", "function approve(address,uint256)", "function balanceOf(address) view returns (uint256)",
  ], owner);
  await (await token.mint(owner.address, 10_000)).wait();
  await (await token.approve(dep.address, 10_000)).wait();
  await (await c.depositToken(id, dep.tokenAddress, 10_000)).wait();

  // NFT bequest → heir1
  const nft = new ethers.Contract(dep.nftAddress, [
    "function mint(address) returns (uint256)", "function approve(address,uint256)", "function ownerOf(uint256) view returns (address)",
  ], owner);
  await (await nft.mint(owner.address)).wait();
  await (await nft.approve(dep.address, 0)).wait();
  await (await c.bequeath721(id, dep.nftAddress, 0, heir1.address, salt("alice-pepper"))).wait();
  log(`10 ETH + 10000 mUSDC deposited; NFT #0 bequeathed to heir1`);

  await (await c.setLetter(id, heir1.address, salt("alice-pepper"), ethers.toUtf8Bytes("sealed-letter"))).wait();

  // guardian veto demo: heir files early (fails — heartbeat fresh), then lapse → claim → guardian vetoes → lapse again → claim → finalize
  try {
    await c.connect(heir1).initiateClaim(id, salt("alice-pepper"));
  } catch { log(`heir1 filed early → rejected (heartbeat fresh) ✓`); }

  await provider.send("evm_increaseTime", [130]);
  await provider.send("evm_mine");
  await (await c.connect(heir1).initiateClaim(id, salt("alice-pepper"))).wait();
  log(`lapsed → heir1 claim filed. status=${ST[await c.statusOf(id)]}`);

  await (await c.connect(guardian).vetoClaim(id)).wait();
  log(`guardian VETOED the claim (emergency brake). status=${ST[await c.statusOf(id)]}`);

  // guardian keeps stalling only as long as needed — heir re-files, this time no veto
  await (await c.connect(heir1).initiateClaim(id, salt("alice-pepper"))).wait();
  await provider.send("evm_increaseTime", [65]);
  await provider.send("evm_mine");
  await (await c.connect(heir1).finalizeClaim(id)).wait();
  log(`claim re-filed & finalized. status=${ST[await c.statusOf(id)]}`);

  const b1 = await provider.getBalance(heir1.address);
  await (await c.connect(heir1).withdrawShare(id, salt("alice-pepper"))).wait();
  const g1 = (await provider.getBalance(heir1.address)) - b1;
  const b2 = await provider.getBalance(heir2.address);
  await (await c.connect(heir2).withdrawShare(id, salt("bob-pepper"))).wait();
  const g2 = (await provider.getBalance(heir2.address)) - b2;

  log(`heir1 got ~${ethers.formatEther(g1)} ETH + ${await token.balanceOf(heir1.address)} mUSDC + NFT owner=${(await nft.ownerOf(0)).slice(0, 10)}…`);
  log(`heir2 got ~${ethers.formatEther(g2)} ETH + ${await token.balanceOf(heir2.address)} mUSDC`);
  log(`final status=${ST[await c.statusOf(id)]}`);

  // ============ auto-heartbeat demo: owner action cancels a claim ============
  await (await c.createVault([heir1.address], [ZERO_SALT], [10000], 120, 60, ethers.ZeroAddress, false)).wait();
  const id2 = (await c.nextVaultId()) - 1n;
  await provider.send("evm_increaseTime", [130]);
  await provider.send("evm_mine");
  await (await c.connect(heir1).initiateClaim(id2, ZERO_SALT)).wait();
  log(`vault #${id2} claimed by heir1. status=${ST[await c.statusOf(id2)]}`);
  await (await c.depositETH(id2, { value: 1000 })).wait(); // owner alive — deposit = heartbeat
  log(`owner deposited (no ping needed) → claim auto-cancelled. status=${ST[await c.statusOf(id2)]}`);

  console.log("\n✓ v2 lifecycle verified: sealed heirs, NFT bequest, guardian veto, auto-heartbeat");
}

main().catch((e) => { console.error(e); process.exit(1); });
