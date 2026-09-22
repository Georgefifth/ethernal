import { useState } from "react";
import { Contract, ZeroAddress, isAddress, parseEther, formatEther } from "ethers";
import { Btn, Card, Input, Label, StatusBadge } from "./ui";
import { Countdown } from "./Countdown";
import { bpsToPct, fmtDuration, pctToBps, shortAddr, STATUS_META } from "../lib/utils";
import {
  useOwnedIds, useVaults, randomSalt, saveSalts, loadSalts, claimCard, heirKey, type VaultData,
} from "../hooks/useVault";
import { encryptLetter } from "../lib/letter";
import { DEPLOYMENT } from "../lib/web3";

const HEARTBEAT_PRESETS = [
  { label: "2 min (demo)", secs: 120 },
  { label: "5 min (demo)", secs: 300 },
  { label: "1 day", secs: 86400 },
  { label: "30 days", secs: 2592000 },
  { label: "90 days", secs: 7776000 },
];
const CHALLENGE_PRESETS = [
  { label: "1 min (demo)", secs: 60 },
  { label: "5 min (demo)", secs: 300 },
  { label: "7 days", secs: 604800 },
  { label: "30 days", secs: 2592000 },
];
const ZERO_SALT = "0x" + "0".repeat(64);

interface HeirRow { address: string; pct: string }

export function OwnerPanel({ contract, address, chainId }: { contract: Contract; address: string; chainId: number }) {
  const { ids, reload: reloadIds } = useOwnedIds(contract, address);
  const { vaults, reload: reloadVaults } = useVaults(contract, ids);
  const [showCreate, setShowCreate] = useState(false);
  const reload = () => { reloadIds(); reloadVaults(); };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">Your Vaults</h2>
        <Btn onClick={() => setShowCreate(!showCreate)}>{showCreate ? "Cancel" : "+ New Vault"}</Btn>
      </div>
      {showCreate && <CreateVaultForm contract={contract} chainId={chainId} onDone={() => { setShowCreate(false); reload(); }} />}
      {vaults.length === 0 && !showCreate && (
        <Card className="p-10 text-center text-muted">
          No vaults yet. Seal your first vault — it takes one transaction.
        </Card>
      )}
      <div className="space-y-4">
        {vaults.map((v) => <VaultCard key={v.id.toString()} contract={contract} v={v} me={address} chainId={chainId} onAction={reload} />)}
      </div>
    </div>
  );
}

function CreateVaultForm({ contract, chainId, onDone }: { contract: Contract; chainId: number; onDone: () => void }) {
  const [heirs, setHeirs] = useState<HeirRow[]>([{ address: "", pct: "100" }]);
  const [heartbeat, setHeartbeat] = useState(300);
  const [challenge, setChallenge] = useState(60);
  const [guardian, setGuardian] = useState("");
  const [privateHeirs, setPrivateHeirs] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [cards, setCards] = useState<string[]>([]);

  const total = heirs.reduce((s, h) => s + (parseFloat(h.pct) || 0), 0);
  const valid = heirs.every((h) => isAddress(h.address) && parseFloat(h.pct) > 0)
    && Math.abs(total - 100) < 0.01
    && (guardian === "" || isAddress(guardian));

  async function create() {
    setBusy(true); setErr("");
    try {
      const salts = heirs.map(() => (privateHeirs ? randomSalt() : ZERO_SALT));
      const tx = await contract.createVault(
        heirs.map((h) => h.address),
        salts,
        heirs.map((h) => pctToBps(parseFloat(h.pct))),
        heartbeat,
        challenge,
        guardian || ZeroAddress,
        privateHeirs,
      );
      const rcpt = await tx.wait();
      // vault id = nextVaultId - 1
      const id = (await contract.nextVaultId()) - 1n;
      void rcpt;
      if (privateHeirs) {
        saveSalts(chainId, id, heirs.map((h, i) => ({
          heir: h.address, salt: salts[i], key: heirKey(privateHeirs, h.address, salts[i]),
        })));
        setCards(heirs.map((h, i) => claimCard(chainId, id, h.address, salts[i])));
      } else {
        onDone();
      }
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  }

  const setRow = (i: number, k: keyof HeirRow, val: string) =>
    setHeirs(heirs.map((h, j) => (j === i ? { ...h, [k]: val } : h)));

  if (cards.length > 0) {
    return (
      <Card className="p-6 mb-4 border-gold/40">
        <h3 className="font-bold text-lg mb-2 text-gold">Vault sealed — deliver these claim cards</h3>
        <p className="text-muted text-sm mb-4 leading-relaxed">
          Heir identities never touch the chain — only commitments. Each heir needs their claim card
          (vault + address + secret salt) to prove inheritance. Hand it over in person or store it
          in their sealed letter. <b className="text-parchment">We do not keep these</b> — save them now.
        </p>
        <div className="space-y-2 mb-4">
          {cards.map((c, i) => (
            <div key={i} className="flex gap-2 items-center">
              <code className="flex-1 text-xs bg-ink border border-line rounded px-3 py-2 overflow-x-auto whitespace-nowrap">{c}</code>
              <Btn variant="ghost" className="text-xs shrink-0" onClick={() => navigator.clipboard.writeText(c)}>copy</Btn>
            </div>
          ))}
        </div>
        <Btn onClick={onDone}>Done — cards delivered</Btn>
      </Card>
    );
  }

  return (
    <Card className="p-6 mb-4 border-gold/30">
      <h3 className="font-bold text-lg mb-4 text-gold">Seal a new vault</h3>
      <Label>Heirs & shares — must total 100%</Label>
      <div className="space-y-2 mb-3">
        {heirs.map((h, i) => (
          <div key={i} className="flex gap-2">
            <Input placeholder="0x… heir address" value={h.address} onChange={(e) => setRow(i, "address", e.target.value)} />
            <Input placeholder="%" type="number" min="0" max="100" value={h.pct} className="w-24" onChange={(e) => setRow(i, "pct", e.target.value)} />
            {heirs.length > 1 && (
              <Btn variant="ghost" onClick={() => setHeirs(heirs.filter((_, j) => j !== i))}>✕</Btn>
            )}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 mb-4">
        <Btn variant="ghost" className="text-xs" onClick={() => setHeirs([...heirs, { address: "", pct: "" }])}>+ Add heir</Btn>
        <span className={`text-xs font-mono ${Math.abs(total - 100) < 0.01 ? "text-alive" : "text-warn"}`}>total: {total}%</span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <Label>Heartbeat — check in at least every</Label>
          <select value={heartbeat} onChange={(e) => setHeartbeat(Number(e.target.value))}
            className="w-full bg-panel2 border border-line rounded-lg px-3 py-2 text-sm">
            {HEARTBEAT_PRESETS.map((p) => <option key={p.secs} value={p.secs}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <Label>Challenge window after a claim</Label>
          <select value={challenge} onChange={(e) => setChallenge(Number(e.target.value))}
            className="w-full bg-panel2 border border-line rounded-lg px-3 py-2 text-sm">
            {CHALLENGE_PRESETS.map((p) => <option key={p.secs} value={p.secs}>{p.label}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <Label>Guardian (optional) — can veto claims, never touches funds</Label>
          <Input placeholder="0x… or empty" value={guardian} onChange={(e) => setGuardian(e.target.value)} />
        </div>
        <div>
          <Label>Heir privacy</Label>
          <button onClick={() => setPrivateHeirs(!privateHeirs)}
            className={`w-full text-left px-3 py-2 rounded-lg border text-sm cursor-pointer transition ${
              privateHeirs ? "border-gold/50 bg-gold/10 text-gold" : "border-line text-muted hover:text-parchment"
            }`}>
            {privateHeirs ? "◆ Sealed — only commitments on-chain" : "Public — heirs visible & auto-discoverable"}
          </button>
        </div>
      </div>
      {privateHeirs && (
        <p className="text-xs text-muted mb-4 leading-relaxed">
          Sealed mode stores salted commitments instead of addresses — heirs can't be identified or
          targeted on-chain. You'll get a claim card per heir to hand over. They can claim without
          anyone knowing they were named.
        </p>
      )}

      {err && <p className="text-warn text-xs mb-3 font-mono">{err}</p>}
      <Btn disabled={!valid || busy} onClick={create}>{busy ? "Sealing…" : "Seal Vault"}</Btn>
    </Card>
  );
}

function VaultCard({ contract, v, me, chainId, onAction }: { contract: Contract; v: VaultData; me: string; chainId: number; onAction: () => void }) {
  const [amount, setAmount] = useState("");
  const [tokAmount, setTokAmount] = useState("");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [letterHeir, setLetterHeir] = useState("");
  const [letterText, setLetterText] = useState("");
  const [letterPass, setLetterPass] = useState("");
  const [showLetter, setShowLetter] = useState(false);
  const [showBequest, setShowBequest] = useState(false);
  const [nftId, setNftId] = useState("");
  const [nftHeir, setNftHeir] = useState("");
  const [guardianIn, setGuardianIn] = useState("");
  const [showGuardian, setShowGuardian] = useState(false);

  const meta = STATUS_META[v.status];
  const salts = loadSalts(chainId, v.id);
  const saltFor = (addrOrKey: string) =>
    v.privateHeirs ? (salts.find((s) => s.heir.toLowerCase() === addrOrKey.toLowerCase())?.salt ?? "") : ZERO_SALT;

  const act = (name: string, fn: () => Promise<unknown>) => async () => {
    setBusy(name); setErr("");
    try {
      const tx = (await fn()) as { wait?: () => Promise<unknown> };
      await tx.wait?.();
      onAction();
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(""); }
  };

  const depositToken = async () => {
    const erc20 = new Contract(DEPLOYMENT.tokenAddress, [
      "function approve(address,uint256) returns (bool)",
      "function mint(address,uint256)",
    ], contract.runner!);
    const amt = BigInt(Math.floor(parseFloat(tokAmount) * 1e6));
    await (await erc20.mint(me, amt)).wait();
    await (await erc20.approve(await contract.getAddress(), amt)).wait();
    return contract.depositToken(v.id, DEPLOYMENT.tokenAddress, amt);
  };

  const bequest = async () => {
    const nft = new Contract(DEPLOYMENT.nftAddress!, [
      "function mint(address) returns (uint256)",
      "function approve(address,uint256)",
    ], contract.runner!);
    await (await nft.mint(me)).wait();
    await (await nft.approve(await contract.getAddress(), BigInt(nftId))).wait();
    return contract.bequeath721(v.id, DEPLOYMENT.nftAddress, BigInt(nftId), nftHeir, saltFor(nftHeir));
  };

  const sealLetter = async () => {
    const ct = await encryptLetter(letterText, letterPass);
    return contract.setLetter(v.id, letterHeir, saltFor(letterHeir), ct);
  };

  const heirOptions = v.privateHeirs
    ? salts.map((s) => s.heir)
    : v.heirs.map((h) => h.address!);

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="font-bold text-xl">Vault #{v.id.toString()}</h3>
            <StatusBadge status={v.status} />
            {v.privateHeirs && <span className="text-xs font-mono text-gold/70 border border-gold/30 rounded-full px-2 py-0.5">sealed heirs</span>}
            {v.guardian !== ZeroAddress && <span className="text-xs font-mono text-muted border border-line rounded-full px-2 py-0.5">guardian {shortAddr(v.guardian)}</span>}
          </div>
          <p className="text-muted text-xs mt-1">{meta.desc}</p>
        </div>
        <div className="text-right">
          <div className="font-mono text-2xl text-gold">{parseFloat(formatEther(v.ethBalance)).toFixed(4)} ETH</div>
          {v.tokens.map((t) => (
            <div key={t.address} className="font-mono text-xs text-muted">+ {(Number(t.balance) / 1e6).toFixed(2)} mUSDC</div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-4 font-mono">
        <div className="bg-panel2 rounded-lg p-3">
          <div className="text-muted text-xs mb-1">Heartbeat</div>
          {fmtDuration(v.heartbeatInterval)}
        </div>
        <div className="bg-panel2 rounded-lg p-3">
          <div className="text-muted text-xs mb-1">Lapses in</div>
          <Countdown target={v.lapsesAt} now0={v.chainNow} className={v.status >= 1 ? "text-warn" : "text-alive"} />
        </div>
        <div className="bg-panel2 rounded-lg p-3">
          <div className="text-muted text-xs mb-1">Challenge</div>
          {fmtDuration(v.challengePeriod)}
        </div>
        <div className="bg-panel2 rounded-lg p-3">
          <div className="text-muted text-xs mb-1">Claim ends</div>
          {v.claimStart ? <Countdown target={v.claimableAt} now0={v.chainNow} className="text-gold" /> : "—"}
        </div>
      </div>

      <div className="mb-4">
        <Label>Heirs</Label>
        <div className="space-y-1">
          {v.heirs.map((h) => {
            const stored = salts.find((s) =>
              h.address ? s.heir.toLowerCase() === h.address.toLowerCase() : s.key === h.key);
            return (
              <div key={h.key} className="flex items-center gap-3 text-sm font-mono flex-wrap">
                <span className="text-parchment">{h.address ? shortAddr(h.address) : `sealed:${h.key.slice(0, 10)}…`}</span>
                <span className="text-gold">{bpsToPct(h.bps)}</span>
                {h.nfts.length > 0 && <span className="text-xs text-muted">+ {h.nfts.length} NFT{h.nfts.length > 1 ? "s" : ""}</span>}
                {h.hasLetter && <span className="text-xs text-muted">✉ letter</span>}
                {h.withdrawn && <span className="text-xs text-alive">✓ inherited</span>}
                {v.privateHeirs && stored && (
                  <button className="text-xs text-gold/70 hover:text-gold underline underline-offset-2 cursor-pointer"
                    onClick={() => navigator.clipboard.writeText(claimCard(chainId, v.id, stored.heir, stored.salt))}>
                    copy claim card
                  </button>
                )}
                {v.privateHeirs && !stored && !h.address && (
                  <span className="text-xs text-muted/60">claim card not on this device</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {err && <p className="text-warn text-xs mb-3 font-mono">{err}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <Btn onClick={act("ping", () => contract.ping(v.id))} disabled={!!busy || v.finalized}>
          {busy === "ping" ? "Pinging…" : "♥ I'm Alive"}
        </Btn>
        <div className="flex items-center gap-1">
          <Input placeholder="ETH" className="w-24" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Btn variant="ghost" disabled={!!busy || !amount || v.finalized}
            onClick={act("dep", () => contract.depositETH(v.id, { value: parseEther(amount) }))}>Deposit</Btn>
        </div>
        {DEPLOYMENT.tokenAddress && (
          <div className="flex items-center gap-1">
            <Input placeholder="mUSDC" className="w-24" value={tokAmount} onChange={(e) => setTokAmount(e.target.value)} />
            <Btn variant="ghost" disabled={!!busy || !tokAmount || v.finalized} onClick={act("tok", depositToken)}>Deposit</Btn>
          </div>
        )}
        {DEPLOYMENT.nftAddress && (
          <Btn variant="ghost" onClick={() => setShowBequest(!showBequest)} disabled={v.finalized}>◈ Bequeath NFT</Btn>
        )}
        <Btn variant="ghost" onClick={() => setShowLetter(!showLetter)} disabled={v.finalized}>✉ Letter</Btn>
        <Btn variant="ghost" onClick={() => setShowGuardian(!showGuardian)} disabled={v.finalized}>⚿ Guardian</Btn>
      </div>

      {showBequest && !v.finalized && DEPLOYMENT.nftAddress && (
        <div className="mt-4 border border-line rounded-lg p-4 bg-panel2">
          <Label>Specific bequest — this NFT goes to this heir, not the split</Label>
          <div className="flex gap-2 flex-wrap">
            <Input placeholder="token id (mints a fresh mNFT)" className="w-44" value={nftId} onChange={(e) => setNftId(e.target.value)} />
            <select value={nftHeir} onChange={(e) => setNftHeir(e.target.value)}
              className="bg-ink border border-line rounded-lg px-3 py-2 text-sm font-mono">
              <option value="">pick heir…</option>
              {heirOptions.map((a) => <option key={a} value={a}>{shortAddr(a)}</option>)}
            </select>
            <Btn disabled={!!busy || !nftId || !nftHeir} onClick={act("nft", bequest)}>
              {busy === "nft" ? "Bequeathing…" : "Bequeath"}
            </Btn>
          </div>
        </div>
      )}

      {showLetter && !v.finalized && (
        <div className="mt-4 border border-line rounded-lg p-4 bg-panel2">
          <Label>Sealed letter — AES-256 encrypted, passphrase handed off-chain</Label>
          <div className="flex gap-2 mb-2">
            <select value={letterHeir} onChange={(e) => setLetterHeir(e.target.value)}
              className="bg-ink border border-line rounded-lg px-3 py-2 text-sm font-mono">
              <option value="">pick heir…</option>
              {heirOptions.map((a) => <option key={a} value={a}>{shortAddr(a)}</option>)}
            </select>
            <Input placeholder="passphrase (tell them in person)" type="password" value={letterPass} onChange={(e) => setLetterPass(e.target.value)} />
          </div>
          <textarea value={letterText} onChange={(e) => setLetterText(e.target.value)} rows={2}
            placeholder="The seed phrase is behind the third brick…"
            className="w-full bg-ink border border-line rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:border-gold" />
          <Btn disabled={!!busy || !letterHeir || !letterPass || !letterText} onClick={act("letter", sealLetter)}>
            {busy === "letter" ? "Sealing…" : "Seal letter on-chain"}
          </Btn>
        </div>
      )}

      {showGuardian && !v.finalized && (
        <div className="mt-4 border border-line rounded-lg p-4 bg-panel2">
          <Label>Guardian — can veto a claim (emergency brake), can never move funds</Label>
          <div className="flex gap-2">
            <Input placeholder="0x… guardian address (0x0 to remove)" value={guardianIn} onChange={(e) => setGuardianIn(e.target.value)} />
            <Btn disabled={!!busy || !isAddress(guardianIn)} onClick={act("guard", () => contract.setGuardian(v.id, guardianIn))}>
              {busy === "guard" ? "Setting…" : "Set guardian"}
            </Btn>
          </div>
        </div>
      )}
    </Card>
  );
}

function errMsg(e: unknown): string {
  const s = (e as { reason?: string; shortMessage?: string; message?: string });
  return s.reason || s.shortMessage || s.message || "transaction failed";
}
