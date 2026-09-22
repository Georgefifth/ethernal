import { useEffect, useState } from "react";
import { Contract, formatEther } from "ethers";
import { Btn, Card, Input, Label, StatusBadge } from "./ui";
import { Countdown } from "./Countdown";
import { bpsToPct, shortAddr, STATUS_META } from "../lib/utils";
import {
  useInheritedIds, useVaults, fetchVault, heirKey, parseClaimCard, type VaultData,
} from "../hooks/useVault";
import { decryptLetter } from "../lib/letter";

const ZERO_SALT = "0x" + "0".repeat(64);

export function HeirPanel({ contract, address, chainId }: { contract: Contract; address: string; chainId: number }) {
  const { ids, reload: reloadIds } = useInheritedIds(contract, address);
  const { vaults, reload: reloadVaults } = useVaults(contract, ids);
  const reload = () => { reloadIds(); reloadVaults(); };
  const [cardText, setCardText] = useState("");
  const [cardErr, setCardErr] = useState("");
  const [cardVault, setCardVault] = useState<VaultData | null>(null);
  const [cardSalt, setCardSalt] = useState("");

  // deep link: ?vault=N&heir=0x..&salt=0x..
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const v = q.get("vault"), h = q.get("heir"), s = q.get("salt");
    if (v && h && s) openCard(`ethernal:${chainId}:${v}:${h}:${s}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contract, chainId]);

  // poll the claim-card vault too — chain time advances without user actions
  useEffect(() => {
    if (!cardVault) return;
    const t = setInterval(async () => {
      try { setCardVault(await fetchVault(contract, cardVault.id)); } catch { /* keep stale */ }
    }, 3000);
    return () => clearInterval(t);
  }, [contract, cardVault?.id]);

  async function openCard(text: string) {
    setCardErr("");
    const parsed = parseClaimCard(text);
    if (!parsed) { setCardErr("Not a valid claim card — expect ethernal:chain:vault:0xheir:0xsalt"); return; }
    if (parsed.heir.toLowerCase() !== address.toLowerCase()) {
      setCardErr("This claim card is for a different wallet — switch accounts.");
      return;
    }
    try {
      const v = await fetchVault(contract, parsed.vaultId);
      setCardVault(v);
      setCardSalt(parsed.salt);
    } catch { setCardErr("Vault not found on this network."); }
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Vaults naming you heir</h2>

      {/* claim card input */}
      <Card className="p-4 mb-5">
        <Label>Have a claim card? (sealed-heir vaults)</Label>
        <div className="flex gap-2">
          <Input placeholder="ethernal:chain:vault:0xheir:0xsalt" value={cardText}
            onChange={(e) => setCardText(e.target.value)} />
          <Btn variant="ghost" onClick={() => openCard(cardText)}>Open</Btn>
        </div>
        {cardErr && <p className="text-warn text-xs mt-2 font-mono">{cardErr}</p>}
      </Card>

      <div className="space-y-4">
        {cardVault && (
          <HeirVaultCard key={`card-${cardVault.id}`} contract={contract} v={cardVault} me={address}
            salt={cardSalt} onAction={async () => setCardVault(await fetchVault(contract, cardVault.id))} />
        )}
        {vaults.map((v) => (
          <HeirVaultCard key={v.id.toString()} contract={contract} v={v} me={address} salt={ZERO_SALT} onAction={reload} />
        ))}
        {vaults.length === 0 && !cardVault && (
          <Card className="p-10 text-center text-muted">
            Nothing left to you yet — or you're checking the wrong wallet.
          </Card>
        )}
      </div>
    </div>
  );
}

function HeirVaultCard({ contract, v, me, salt, onAction }: {
  contract: Contract; v: VaultData; me: string; salt: string; onAction: () => void;
}) {
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [pass, setPass] = useState("");
  const [opened, setOpened] = useState("");
  const myKey = heirKey(v.privateHeirs, me, salt);
  const heir = v.heirs.find((h) => h.key.toLowerCase() === myKey.toLowerCase());
  const meta = STATUS_META[v.status];

  const act = (name: string, fn: () => Promise<unknown>) => async () => {
    setBusy(name); setErr("");
    try {
      const tx = (await fn()) as { wait?: () => Promise<unknown> };
      await tx.wait?.();
      onAction();
    } catch (e) {
      setErr((e as { reason?: string; shortMessage?: string }).reason || (e as { shortMessage?: string }).shortMessage || "failed");
    } finally { setBusy(""); }
  };

  const openLetter = async () => {
    setBusy("letter"); setErr("");
    try {
      const ct = await contract.letterOf(v.id, myKey);
      setOpened(await decryptLetter(ct, pass));
    } catch { setErr("Wrong passphrase — or no letter for you."); }
    finally { setBusy(""); }
  };

  const myShareEth = heir ? (v.ethBalance * BigInt(heir.bps)) / 10000n : 0n;
  const canInitiate = v.status === 1;
  const canFinalize = v.status === 2 && v.claimableAt > 0 && v.chainNow >= v.claimableAt;
  const canWithdraw = v.status === 3 && heir && !heir.withdrawn;

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="font-bold text-xl">Vault #{v.id.toString()}</h3>
            <StatusBadge status={v.status} />
            {v.privateHeirs && <span className="text-xs font-mono text-gold/70 border border-gold/30 rounded-full px-2 py-0.5">sealed heirs</span>}
          </div>
          <p className="text-muted text-xs mt-1 font-mono">owner {shortAddr(v.owner)} · your share {heir ? bpsToPct(heir.bps) : "?"}</p>
        </div>
        <div className="text-right font-mono">
          <div className="text-muted text-xs">your cut</div>
          <div className="text-gold text-xl">{parseFloat(formatEther(myShareEth)).toFixed(4)} ETH</div>
          {heir && heir.nfts.length > 0 && <div className="text-xs text-muted">+ {heir.nfts.length} NFT{heir.nfts.length > 1 ? "s" : ""} bequeathed</div>}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 text-sm font-mono mb-4">
        <div className="bg-panel2 rounded-lg p-3">
          <div className="text-muted text-xs mb-1">Heartbeat lapses</div>
          <Countdown target={v.lapsesAt} now0={v.chainNow} className={v.status >= 1 ? "text-warn" : "text-alive"} />
        </div>
        <div className="bg-panel2 rounded-lg p-3">
          <div className="text-muted text-xs mb-1">Claim window</div>
          {v.claimStart ? <Countdown target={v.claimableAt} now0={v.chainNow} className="text-gold" /> : "not claimed"}
        </div>
        <div className="bg-panel2 rounded-lg p-3">
          <div className="text-muted text-xs mb-1">Vault holds</div>
          {parseFloat(formatEther(v.ethBalance)).toFixed(4)} ETH
        </div>
      </div>

      {err && <p className="text-warn text-xs mb-3 font-mono">{err}</p>}

      <div className="flex flex-wrap gap-2 items-center">
        {canInitiate && (
          <Btn variant="danger" disabled={!!busy} onClick={act("claim", () => contract.initiateClaim(v.id, salt))}>
            {busy === "claim" ? "Filing…" : "⚑ File claim — owner is silent"}
          </Btn>
        )}
        {v.status === 2 && (
          <Btn disabled={!!busy || !canFinalize} onClick={act("fin", () => contract.finalizeClaim(v.id))}>
            {canFinalize ? "Finalize claim" : <>Finalizes in <Countdown target={v.claimableAt} now0={v.chainNow} /></>}
          </Btn>
        )}
        {canWithdraw && (
          <Btn disabled={!!busy} onClick={act("wd", () => contract.withdrawShare(v.id, salt))}>
            {busy === "wd" ? "Claiming…" : `Withdraw your ${bpsToPct(heir!.bps)}`}
          </Btn>
        )}
        {heir?.withdrawn && <span className="text-alive text-sm">✓ Your share has been inherited</span>}
        {heir?.hasLetter && (
          <div className="flex items-center gap-1 w-full mt-2">
            <Input placeholder="letter passphrase" type="password" className="w-56" value={pass} onChange={(e) => setPass(e.target.value)} />
            <Btn variant="ghost" disabled={!!busy || !pass} onClick={openLetter}>Open sealed letter</Btn>
          </div>
        )}
      </div>
      {opened && (
        <div className="mt-3 border border-gold/30 rounded-lg p-4 bg-panel2">
          <Label>Letter from {shortAddr(v.owner)}</Label>
          <p className="italic leading-relaxed">{opened}</p>
        </div>
      )}
      {!heir && <p className="text-muted text-xs mt-2">Connected wallet is not an heir of this vault{salt !== ZERO_SALT ? " — check the salt" : ""}.</p>}
      <p className="text-muted/50 text-xs mt-3 font-mono">{meta.desc}</p>
    </Card>
  );
}
