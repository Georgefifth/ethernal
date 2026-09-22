import { useCallback, useEffect, useState } from "react";
import type { Contract } from "ethers";
import { formatEther, isAddress, keccak256, solidityPacked, zeroPadValue, toBeHex } from "ethers";

export interface NftRef { token: string; tokenId: bigint }
export interface HeirInfo {
  key: string;
  address: string | null;   // null for private vaults
  bps: number;
  withdrawn: boolean;
  hasLetter: boolean;
  nfts: NftRef[];
}

export interface VaultData {
  id: bigint;
  owner: string;
  guardian: string;
  privateHeirs: boolean;
  heartbeatInterval: number;
  challengePeriod: number;
  lastCheckIn: number;
  claimStart: number;
  finalized: boolean;
  ethBalance: bigint;
  status: number;
  heirs: HeirInfo[];
  tokens: { address: string; balance: bigint }[];
  lapsesAt: number;
  claimableAt: number;
  chainNow: number;
}

export function heirKey(privateHeirs: boolean, heir: string, salt: string): string {
  return privateHeirs
    ? keccak256(solidityPacked(["address", "bytes32"], [heir, salt]))
    : zeroPadValue(heir, 32);
}

export function randomSalt(): string {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return "0x" + Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

export async function fetchVault(contract: Contract, id: bigint): Promise<VaultData> {
  const [v, status, tokens, lapsesAt, claimableAt, block] = await Promise.all([
    contract.getVault(id),
    contract.statusOf(id),
    contract.tokensOf(id),
    contract.lapsesAt(id),
    contract.claimableAt(id),
    contract.runner!.provider!.getBlock("latest"),
  ]);
  const privateHeirs = v.privateHeirs as boolean;
  const keys: string[] = await contract.heirKeysOf(id);
  const pub: string[] = privateHeirs ? [] : await contract.publicHeirsOf(id);

  const heirs: HeirInfo[] = await Promise.all(keys.map(async (k, i) => ({
    key: k,
    address: privateHeirs ? null : pub[i],
    bps: Number(await contract.shareOf(id, k)),
    withdrawn: await contract.hasWithdrawn(id, k),
    hasLetter: (await contract.letterOf(id, k)) !== "0x",
    nfts: (await contract.nftsOf(id, k)).map((n: { token: string; tokenId: bigint }) => ({ token: n.token, tokenId: n.tokenId })),
  })));

  const tokenDetails = await Promise.all(
    tokens.map(async (t: string) => ({ address: t, balance: await contract.tokenBalance(id, t) })),
  );
  return {
    id,
    owner: v.owner,
    guardian: v.guardian,
    privateHeirs,
    heartbeatInterval: Number(v.heartbeatInterval),
    challengePeriod: Number(v.challengePeriod),
    lastCheckIn: Number(v.lastCheckIn),
    claimStart: Number(v.claimStart),
    finalized: v.finalized,
    ethBalance: v.ethBalance,
    status: Number(status),
    heirs,
    tokens: tokenDetails,
    lapsesAt: Number(lapsesAt),
    claimableAt: Number(claimableAt),
    chainNow: block ? Number(block.timestamp) : Math.floor(Date.now() / 1000),
  };
}

export function useVaults(contract: Contract | null, ids: bigint[], refreshMs = 3000) {
  const [vaults, setVaults] = useState<VaultData[]>([]);
  const key = ids.join(",");
  const load = useCallback(async () => {
    if (!contract || ids.length === 0) { setVaults([]); return; }
    const data = await Promise.all(ids.map((id) => fetchVault(contract, id).catch(() => null)));
    setVaults(data.filter(Boolean) as VaultData[]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contract, key]);
  useEffect(() => {
    load();
    const t = setInterval(load, refreshMs);
    return () => clearInterval(t);
  }, [load, refreshMs]);
  return { vaults, reload: load };
}

export function useOwnedIds(contract: Contract | null, address: string | null) {
  const [ids, setIds] = useState<bigint[]>([]);
  const load = useCallback(() => {
    if (!contract || !address) { setIds([]); return; }
    contract.ownedVaults(address).then(setIds).catch(() => {});
  }, [contract, address]);
  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);
  return { ids, reload: load };
}

export function useInheritedIds(contract: Contract | null, address: string | null) {
  const [ids, setIds] = useState<bigint[]>([]);
  const load = useCallback(() => {
    if (!contract || !address) { setIds([]); return; }
    contract.inheritedVaults(address).then(setIds).catch(() => {});
  }, [contract, address]);
  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);
  return { ids, reload: load };
}

export function useGuardianIds(contract: Contract | null, address: string | null) {
  const [ids, setIds] = useState<bigint[]>([]);
  const load = useCallback(() => {
    if (!contract || !address) { setIds([]); return; }
    contract.guardianVaults(address).then(setIds).catch(() => {});
  }, [contract, address]);
  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);
  return { ids, reload: load };
}

/** Claim cards: salt persistence for private vaults (owner's device only). */
const SALT_KEY = (chainId: number, vaultId: bigint) => `ethernal:salts:${chainId}:${vaultId}`;

export function saveSalts(chainId: number, vaultId: bigint, entries: { heir: string; salt: string; key: string }[]) {
  localStorage.setItem(SALT_KEY(chainId, vaultId), JSON.stringify(entries));
}

export function loadSalts(chainId: number, vaultId: bigint): { heir: string; salt: string; key: string }[] {
  try { return JSON.parse(localStorage.getItem(SALT_KEY(chainId, vaultId)) || "[]"); }
  catch { return []; }
}

export function claimCard(chainId: number, vaultId: bigint, heir: string, salt: string): string {
  return `ethernal:${chainId}:${vaultId}:${heir}:${salt}`;
}

export function parseClaimCard(text: string): { vaultId: bigint; heir: string; salt: string } | null {
  const m = text.trim().match(/^ethernal:(\d+):(\d+):(0x[0-9a-fA-F]{40}):(0x[0-9a-fA-F]{64})$/);
  if (!m) return null;
  return { vaultId: BigInt(m[2]), heir: m[3], salt: m[4] };
}

export function toSalt32(s: string): string {
  return toBeHex(BigInt(s.startsWith("0x") ? s : "0x" + s), 32);
}

export { formatEther, isAddress };
