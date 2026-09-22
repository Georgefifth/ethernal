import { Btn, Card, Divider } from "./ui";

export function Landing({ onLaunch }: { onLaunch: () => void }) {
  return (
    <div className="max-w-4xl mx-auto px-6 pb-24">
      {/* hero */}
      <div className="text-center pt-20 pb-14">
        <div className="text-gold text-sm tracking-[0.4em] uppercase mb-6">A dead man's switch for the chain</div>
        <h1 className="text-6xl md:text-7xl font-bold leading-tight">
          Your keys die with you.<br />
          <span className="text-gold italic">Your crypto doesn't have to.</span>
        </h1>
        <p className="text-muted text-lg mt-8 max-w-2xl mx-auto leading-relaxed">
          ~20% of all Bitcoin — over $140 billion — sits in wallets whose owners are gone.
          Ethernal is a non-custodial inheritance vault: a heartbeat, a challenge window,
          and heirs who inherit without ever touching your keys while you live.
        </p>
        <Btn className="mt-10 text-base px-8 py-3" onClick={onLaunch}>Open the Vault →</Btn>
      </div>

      {/* the problem */}
      <div className="grid md:grid-cols-3 gap-4 mb-16">
        {[
          ["$140B+", "of Bitcoin is estimated permanently stranded — owners dead, keys lost, no recourse"],
          ["0", "recovery mechanisms exist at the protocol level. No 'forgot password'. No executor. Nothing."],
          ["1", "heartbeat stands between your heirs and your assets — check in, stay sovereign"],
        ].map(([n, t]) => (
          <Card key={n} className="p-6">
            <div className="text-4xl font-bold text-gold font-mono">{n}</div>
            <p className="text-muted text-sm mt-3 leading-relaxed">{t}</p>
          </Card>
        ))}
      </div>

      <Divider>how it works</Divider>

      {/* lifecycle */}
      <div className="grid md:grid-cols-4 gap-4 mb-16">
        {[
          ["Ⅰ", "Seal", "Deposit ETH & tokens into your vault. Name heirs and their shares."],
          ["Ⅱ", "Heartbeat", "Ping periodically — a signed 'I'm alive' on-chain. Set your own interval."],
          ["Ⅲ", "Lapse & challenge", "Miss the beat and heirs may file a claim. You get a final window to cancel."],
          ["Ⅳ", "Inherit", "Uncontested? The vault opens. Each heir pulls their share — plus your sealed letter."],
        ].map(([n, t, d]) => (
          <div key={n} className="border border-line rounded-xl p-5 bg-panel2">
            <div className="text-gold font-mono text-xl mb-2">{n}</div>
            <div className="font-bold mb-1.5">{t}</div>
            <p className="text-muted text-sm leading-relaxed">{d}</p>
          </div>
        ))}
      </div>

      <Divider>why it's safe</Divider>
      <div className="grid md:grid-cols-3 gap-4 text-sm mb-16">
        {[
          ["Non-custodial", "No admin key, no company, no multisig committee. The contract is the executor — deployed once, trustless forever."],
          ["Contestable, not instant", "A lapsed heartbeat opens a claim — it never pays out instantly. A challenge window protects you from silence-by-vacation."],
          ["Every action is a heartbeat", "No calendar reminder needed — any vault interaction (deposit, withdraw, update) proves you're alive and cancels pending claims."],
        ].map(([t, d]) => (
          <div key={t} className="p-5">
            <div className="text-gold font-bold mb-1.5">{t}</div>
            <p className="text-muted leading-relaxed">{d}</p>
          </div>
        ))}
      </div>

      <Divider>what incumbents get wrong</Divider>
      <div className="grid md:grid-cols-3 gap-4 text-sm">
        {[
          ["Sealed heirs", "Public heir lists paint a target on your family. Ethernal can store salted commitments — heirs stay anonymous until they claim with a claim card only they hold."],
          ["Specific bequests", "A real will isn't just percentages — 'my Azuki goes to Alice.' Assign individual NFTs to individual heirs alongside their share."],
          ["Guardian veto", "Optional emergency brake: a trusted guardian can veto a pending claim — but the contract forbids them from ever touching a wei."],
        ].map(([t, d]) => (
          <div key={t} className="p-5">
            <div className="text-gold font-bold mb-1.5">{t}</div>
            <p className="text-muted leading-relaxed">{d}</p>
          </div>
        ))}
      </div>
      <p className="text-muted/60 text-xs mt-10 text-center font-mono">
        no token · no subscription · no oracle · no admin key — gas is the only fee
      </p>
    </div>
  );
}
