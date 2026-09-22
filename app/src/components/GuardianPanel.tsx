import { useState } from "react";
import type { Contract } from "ethers";
import { formatEther } from "ethers";
import { Btn, Card, StatusBadge } from "./ui";
import { Countdown } from "./Countdown";
import { shortAddr } from "../lib/utils";
import { useGuardianIds, useVaults, type VaultData } from "../hooks/useVault";

export function GuardianPanel({ contract, address }: { contract: Contract; address: string }) {
  const { ids, reload: reloadIds } = useGuardianIds(contract, address);
  const { vaults, reload: reloadVaults } = useVaults(contract, ids);
  const reload = () => { reloadIds(); reloadVaults(); };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-1">Guardian watchtower</h2>
      <p className="text-muted text-sm mb-4 leading-relaxed">
        You're the emergency brake on these vaults. If a claim looks premature — the owner is alive but
        unreachable — veto it. You can never touch the funds; the contract forbids it.
      </p>
      {vaults.length === 0 && (
        <Card className="p-10 text-center text-muted">No vaults name you guardian.</Card>
      )}
      <div className="space-y-4">
        {vaults.map((v) => <GuardianCard key={v.id.toString()} contract={contract} v={v} onAction={reload} />)}
      </div>
    </div>
  );
}

function GuardianCard({ contract, v, onAction }: { contract: Contract; v: VaultData; onAction: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const challenged = v.status === 2;

  return (
    <Card className={`p-6 ${challenged ? "border-warn/50" : ""}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h3 className="font-bold text-xl">Vault #{v.id.toString()}</h3>
          <StatusBadge status={v.status} />
        </div>
        <div className="font-mono text-sm text-muted">owner {shortAddr(v.owner)} · {parseFloat(formatEther(v.ethBalance)).toFixed(4)} ETH</div>
      </div>
      {challenged ? (
        <div className="bg-warn/10 border border-warn/30 rounded-lg p-4 mb-3">
          <p className="text-warn text-sm font-mono mb-1">
            ⚠ Claim in progress — finalizes in <Countdown target={v.claimableAt} now0={v.chainNow} />
          </p>
          <p className="text-muted text-xs">If you know the owner is alive, veto now. If they're truly gone, let it run.</p>
        </div>
      ) : (
        <p className="text-muted text-xs mb-3 font-mono">no active claim — lapses <Countdown target={v.lapsesAt} now0={v.chainNow} /></p>
      )}
      {err && <p className="text-warn text-xs mb-3 font-mono">{err}</p>}
      {challenged && (
        <Btn variant="danger" disabled={busy} onClick={async () => {
          setBusy(true); setErr("");
          try { await (await contract.vetoClaim(v.id)).wait(); onAction(); }
          catch (e) { setErr((e as { reason?: string }).reason || "failed"); }
          finally { setBusy(false); }
        }}>
          {busy ? "Vetoing…" : "✋ Veto this claim"}
        </Btn>
      )}
    </Card>
  );
}
