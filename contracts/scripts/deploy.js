const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const Ethernal = await ethers.getContractFactory("Ethernal");
  const ethernal = await Ethernal.deploy();
  await ethernal.waitForDeployment();
  const address = await ethernal.getAddress();
  console.log(`Ethernal deployed on ${network.name}: ${address}`);

  // Optional demo token + NFT on local chains so all flows demo end-to-end.
  let tokenAddress = "", nftAddress = "";
  if (network.name === "localhost" || network.name === "hardhat") {
    const Mock = await ethers.getContractFactory("MockToken");
    const token = await Mock.deploy();
    await token.waitForDeployment();
    tokenAddress = await token.getAddress();
    const Nft = await ethers.getContractFactory("MockNFT");
    const nft = await Nft.deploy();
    await nft.waitForDeployment();
    nftAddress = await nft.getAddress();
    console.log(`MockToken: ${tokenAddress}  MockNFT: ${nftAddress}`);
  }

  const out = {
    address: ethernal.target ?? address,
    tokenAddress,
    nftAddress,
    chainId: Number(network.config.chainId ?? (await ethers.provider.getNetwork()).chainId),
    network: network.name,
    abi: JSON.parse(Ethernal.interface.formatJson()),
  };
  const dest = path.join(__dirname, "..", "..", "app", "src", "contract.json");
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, JSON.stringify(out, null, 2));
  console.log(`ABI + address written to ${dest}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
