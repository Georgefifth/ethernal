import { BrowserProvider, Contract, JsonRpcProvider, NonceManager, Wallet, type Signer } from "ethers";
import deployment from "../contract.json";

export const DEPLOYMENT = deployment as {
  address: string;
  tokenAddress: string;
  nftAddress?: string;
  chainId: number;
  network: string;
  abi: unknown[];
};

export const STATUS = ["Active", "Lapsed", "Challenged", "Claimable", "Drained"] as const;

// Well-known Hardhat/Anvil test accounts — LOCAL DEMO ONLY, never used on real networks.
export const LOCAL_KEYS = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
  "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a",
  "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba",
];

export interface Conn {
  signer: Signer;
  address: string;
  chainId: number;
  contract: Contract;
  isLocal: boolean;
}

export function contractWith(signer: Signer) {
  return new Contract(DEPLOYMENT.address, DEPLOYMENT.abi as string[], signer);
}

export async function connectMetaMask(): Promise<Conn> {
  const eth = (window as unknown as { ethereum?: { request: (a: object) => Promise<unknown> } }).ethereum;
  if (!eth) throw new Error("No wallet found — install MetaMask or use a local demo account.");
  await eth.request({ method: "eth_requestAccounts" });
  const provider = new BrowserProvider(eth as never);
  const signer = await provider.getSigner();
  const net = await provider.getNetwork();
  return {
    signer,
    address: await signer.getAddress(),
    chainId: Number(net.chainId),
    contract: contractWith(signer),
    isLocal: Number(net.chainId) === 31337,
  };
}

export async function connectLocal(index: number): Promise<Conn> {
  const provider = new JsonRpcProvider("http://127.0.0.1:8545");
  // NonceManager: automine can report a stale pending-nonce right after .wait();
  // a local counter keeps back-to-back txs (mint→approve→deposit) consistent.
  const signer = new NonceManager(new Wallet(LOCAL_KEYS[index], provider));
  const net = await provider.getNetwork();
  return {
    signer,
    address: await signer.getAddress(),
    chainId: Number(net.chainId),
    contract: contractWith(signer),
    isLocal: true,
  };
}

export async function localAccountAddresses(): Promise<string[]> {
  const provider = new JsonRpcProvider("http://127.0.0.1:8545");
  return provider.listAccounts().then((accs) => accs.map((a) => a.address));
}

export async function switchOrAddLocalChain(): Promise<void> {
  const eth = (window as unknown as { ethereum?: { request: (a: object) => Promise<unknown> } }).ethereum;
  if (!eth) return;
  try {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x7a69" }] });
  } catch {
    await eth.request({
      method: "wallet_addEthereumChain",
      params: [{ chainId: "0x7a69", chainName: "Hardhat Local", rpcUrls: ["http://127.0.0.1:8545"], nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 } }],
    });
  }
}
