import { useState } from "react";
import { Btn } from "./components/ui";
import { Landing } from "./components/Landing";
import { OwnerPanel } from "./components/OwnerPanel";
import { HeirPanel } from "./components/HeirPanel";
import { GuardianPanel } from "./components/GuardianPanel";
import { connectLocal, connectMetaMask, deploymentFor, LOCAL_KEYS, type Conn } from "./lib/web3";
import { shortAddr } from "./lib/utils";

export default function App() {
  const [view, setView] = useState<"landing" | "app">("landing");
  const [conn, setConn] = useState<Conn | null>(null);
  const [tab, setTab] = useState<"owner" | "heir" | "guardian">("owner");
  const [err, setErr] = useState("");

  const connect = async (fn: () => Promise<Conn>) => {
    setErr("");
    try { setConn(await fn()); } catch (e) { setErr((e as Error).message); }
  };

  return (
    <div className="min-h-full">
      {/* header */}
      <header className="border-b border-line sticky top-0 bg-ink/90 backdrop-blur z-10">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <button onClick={() => setView("landing")} className="font-bold text-lg tracking-wide cursor-pointer">
            Ethernal <span className="text-gold">◆</span>
          </button>
          <div className="flex items-center gap-2">
            {conn ? (
              <>
                <span className="text-xs font-mono text-muted hidden sm:inline">
                  {conn.isLocal ? "local:" : ""}{conn.chainId}
                </span>
                <span className="font-mono text-sm text-gold border border-gold/30 rounded-lg px-3 py-1.5 bg-panel">
                  {shortAddr(conn.address)}
                </span>
                <Btn variant="ghost" className="text-xs" onClick={() => setConn(null)}>switch</Btn>
              </>
            ) : (
              <>
                <Btn variant="ghost" className="text-xs" onClick={() => connect(connectMetaMask)}>MetaMask</Btn>
                <select
                  className="bg-panel border border-line rounded-lg px-2 py-1.5 text-xs font-mono"
                  defaultValue=""
                  onChange={(e) => e.target.value !== "" && connect(() => connectLocal(Number(e.target.value)))}
                >
                  <option value="" disabled>demo account…</option>
                  {LOCAL_KEYS.map((_, i) => <option key={i} value={i}>account #{i}</option>)}
                </select>
              </>
            )}
          </div>
        </div>
      </header>

      {view === "landing" ? (
        <Landing onLaunch={() => setView("app")} />
      ) : !conn ? (
        <div className="max-w-md mx-auto mt-24 text-center px-6">
          <h2 className="text-2xl font-bold mb-3">Connect to begin</h2>
          <p className="text-muted text-sm mb-6 leading-relaxed">
            Use MetaMask on a live network, or pick a demo account against a local Hardhat node
            (<span className="font-mono text-xs">npm run node && npm run deploy:local</span> in <span className="font-mono text-xs">contracts/</span>).
          </p>
          {err && <p className="text-warn text-sm mb-4 font-mono">{err}</p>}
          <div className="flex gap-3 justify-center">
            <Btn onClick={() => connect(connectMetaMask)}>Connect MetaMask</Btn>
            <Btn variant="ghost" onClick={() => connect(() => connectLocal(0))}>Local demo</Btn>
          </div>
          {!deploymentFor(31337) && (
            <p className="text-warn text-xs mt-6 font-mono">contract.json has no deployments — run npm run deploy:local in contracts/.</p>
          )}
        </div>
      ) : (
        <main className="max-w-4xl mx-auto px-6 py-8">
          <div className="flex gap-2 mb-6">
            {(["owner", "heir", "guardian"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-5 py-2 rounded-lg text-sm font-medium cursor-pointer transition ${
                  tab === t ? "bg-gold text-ink" : "border border-line text-muted hover:text-parchment"
                }`}>
                {t === "owner" ? "I hold the keys" : t === "heir" ? "I'm an heir" : "I'm a guardian"}
              </button>
            ))}
          </div>
          {tab === "owner" && <OwnerPanel contract={conn.contract} address={conn.address} chainId={conn.chainId} />}
          {tab === "heir" && <HeirPanel contract={conn.contract} address={conn.address} chainId={conn.chainId} />}
          {tab === "guardian" && <GuardianPanel contract={conn.contract} address={conn.address} />}
        </main>
      )}
    </div>
  );
}
