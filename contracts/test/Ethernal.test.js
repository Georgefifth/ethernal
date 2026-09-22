const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

const DAY = 24 * 3600;
const HEARTBEAT = 30 * DAY;
const CHALLENGE = 7 * DAY;
const ZERO_SALT = ethers.ZeroHash;
const ZERO_ADDR = ethers.ZeroAddress;
const salt = (s) => ethers.keccak256(ethers.toUtf8Bytes(s));

const STATUS = { Active: 0, Lapsed: 1, Challenged: 2, Claimable: 3, Drained: 4 };

async function fixture() {
  const [owner, alice, bob, stranger, guardian] = await ethers.getSigners();
  const Ethernal = await ethers.getContractFactory("Ethernal");
  const ethernal = await Ethernal.deploy();
  const Mock = await ethers.getContractFactory("MockToken");
  const token = await Mock.deploy();
  const Nft = await ethers.getContractFactory("MockNFT");
  const nft = await Nft.deploy();
  return { ethernal, token, nft, owner, alice, bob, stranger, guardian };
}

async function publicVault() {
  const f = await fixture();
  await f.ethernal.createVault(
    [f.alice.address, f.bob.address], [ZERO_SALT, ZERO_SALT], [6000, 4000],
    HEARTBEAT, CHALLENGE, ZERO_ADDR, false,
  );
  return { ...f, vaultId: 0n };
}

async function privateVault() {
  const f = await fixture();
  await f.ethernal.createVault(
    [f.alice.address, f.bob.address], [salt("alice-pepper"), salt("bob-pepper")], [6000, 4000],
    HEARTBEAT, CHALLENGE, ZERO_ADDR, true,
  );
  return { ...f, vaultId: 0n };
}

describe("Ethernal v2", () => {
  describe("creation", () => {
    it("creates a public vault with heirs and shares", async () => {
      const { ethernal, alice, bob, vaultId } = await publicVault();
      const v = await ethernal.getVault(vaultId);
      expect(await ethernal.shareOf(vaultId, ethers.zeroPadValue(alice.address, 32))).to.equal(6000);
      expect(await ethernal.publicHeirsOf(vaultId)).to.deep.equal([alice.address, bob.address]);
      expect(v.owner).to.equal((await ethers.getSigners())[0].address);
      expect(await ethernal.statusOf(vaultId)).to.equal(STATUS.Active);
    });

    it("creates a private vault — commitments on-chain, addresses hidden", async () => {
      const { ethernal, alice, vaultId } = await privateVault();
      const key = ethers.keccak256(ethers.solidityPacked(["address", "bytes32"], [alice.address, salt("alice-pepper")]));
      expect(await ethernal.shareOf(vaultId, key)).to.equal(6000);
      expect(await ethernal.publicHeirsOf(vaultId)).to.deep.equal([]);
      expect((await ethernal.heirKeysOf(vaultId)).length).to.equal(2);
      // inheritedVaults must NOT index private heirs
      expect(await ethernal.inheritedVaults(alice.address)).to.deep.equal([]);
    });

    it("rejects bad share configs", async () => {
      const { ethernal, alice, bob } = await fixture();
      await expect(ethernal.createVault([alice.address], [ZERO_SALT], [5000], HEARTBEAT, CHALLENGE, ZERO_ADDR, false))
        .to.be.revertedWithCustomError(ethernal, "BadShares");
      await expect(ethernal.createVault([alice.address, alice.address], [ZERO_SALT, ZERO_SALT], [6000, 4000], HEARTBEAT, CHALLENGE, ZERO_ADDR, false))
        .to.be.revertedWithCustomError(ethernal, "BadShares");
      await expect(ethernal.createVault([alice.address, bob.address], [ZERO_SALT, ZERO_SALT], [10000, 0], HEARTBEAT, CHALLENGE, ZERO_ADDR, false))
        .to.be.revertedWithCustomError(ethernal, "BadShares");
      await expect(ethernal.createVault([alice.address], [ZERO_SALT], [10000], 59, CHALLENGE, ZERO_ADDR, false))
        .to.be.revertedWithCustomError(ethernal, "IntervalTooShort");
    });
  });

  describe("every action is a heartbeat", () => {
    it("deposits/withdrawals refresh liveness and cancel pending claims", async () => {
      const { ethernal, alice, vaultId } = await publicVault();
      await time.increase(HEARTBEAT + 1);
      await ethernal.connect(alice).initiateClaim(vaultId, ZERO_SALT);
      expect(await ethernal.statusOf(vaultId)).to.equal(STATUS.Challenged);

      // owner deposits instead of pinging — counts as proof of life
      await ethernal.depositETH(vaultId, { value: 1 });
      const v = await ethernal.getVault(vaultId);
      expect(v.claimStart).to.equal(0);
      expect(await ethernal.statusOf(vaultId)).to.equal(STATUS.Active);
    });
  });

  describe("claim lifecycle", () => {
    it("heir cannot claim while heartbeat is fresh; stranger can never claim", async () => {
      const { ethernal, alice, stranger, vaultId } = await publicVault();
      await expect(ethernal.connect(alice).initiateClaim(vaultId, ZERO_SALT))
        .to.be.revertedWithCustomError(ethernal, "HeartbeatNotLapsed");
      await time.increase(HEARTBEAT + 1);
      await expect(ethernal.connect(stranger).initiateClaim(vaultId, ZERO_SALT))
        .to.be.revertedWithCustomError(ethernal, "NotHeir");
    });

    it("full lifecycle: lapse → initiate → finalize → heirs pull 60/40", async () => {
      const { ethernal, token, owner, alice, bob, vaultId } = await publicVault();
      const tokenAddr = await token.getAddress();
      await ethernal.depositETH(vaultId, { value: ethers.parseEther("10") });
      await token.mint(owner.address, 10000);
      await token.approve(await ethernal.getAddress(), 10000);
      await ethernal.depositToken(vaultId, tokenAddr, 10000);

      await time.increase(HEARTBEAT + 1);
      await ethernal.connect(alice).initiateClaim(vaultId, ZERO_SALT);
      await time.increase(CHALLENGE + 1);
      await ethernal.finalizeClaim(vaultId);

      await expect(() => ethernal.connect(alice).withdrawShare(vaultId, ZERO_SALT))
        .to.changeEtherBalance(alice, ethers.parseEther("6"));
      expect(await token.balanceOf(alice.address)).to.equal(6000);
      await expect(() => ethernal.connect(bob).withdrawShare(vaultId, ZERO_SALT))
        .to.changeEtherBalance(bob, ethers.parseEther("4"));
      expect(await token.balanceOf(bob.address)).to.equal(4000);
      expect(await ethernal.statusOf(vaultId)).to.equal(STATUS.Drained);
    });

    it("private vault: heir claims with salt; wrong salt = not heir", async () => {
      const { ethernal, alice, bob, vaultId } = await privateVault();
      await ethernal.depositETH(vaultId, { value: ethers.parseEther("10") });
      await time.increase(HEARTBEAT + 1);

      await expect(ethernal.connect(alice).initiateClaim(vaultId, salt("wrong")))
        .to.be.revertedWithCustomError(ethernal, "NotHeir");
      await ethernal.connect(alice).initiateClaim(vaultId, salt("alice-pepper"));
      await time.increase(CHALLENGE + 1);
      await ethernal.finalizeClaim(vaultId);

      await expect(() => ethernal.connect(alice).withdrawShare(vaultId, salt("alice-pepper")))
        .to.changeEtherBalance(alice, ethers.parseEther("6"));
      await expect(() => ethernal.connect(bob).withdrawShare(vaultId, salt("bob-pepper")))
        .to.changeEtherBalance(bob, ethers.parseEther("4"));
    });
  });

  describe("guardian veto", () => {
    it("guardian can cancel a claim but never moves funds", async () => {
      const f = await fixture();
      const { ethernal, alice, guardian } = f;
      await ethernal.createVault([alice.address], [ZERO_SALT], [10000], HEARTBEAT, CHALLENGE, guardian.address, false);
      const vaultId = 0n;
      await ethernal.depositETH(vaultId, { value: ethers.parseEther("5") });

      await time.increase(HEARTBEAT + 1);
      await ethernal.connect(alice).initiateClaim(vaultId, ZERO_SALT);
      await ethernal.connect(guardian).vetoClaim(vaultId);
      expect((await ethernal.getVault(vaultId)).claimStart).to.equal(0);
      expect(await ethernal.guardianVaults(guardian.address)).to.deep.equal([vaultId]);
      await expect(ethernal.connect(guardian).finalizeClaim(vaultId))
        .to.be.revertedWithCustomError(ethernal, "NoClaimActive");
      // guardian cannot withdraw or touch funds
      await expect(ethernal.connect(guardian).ownerWithdrawETH(vaultId, 1))
        .to.be.revertedWithCustomError(ethernal, "NotOwner");
    });

    it("non-guardian cannot veto; owner can remove guardian", async () => {
      const f = await fixture();
      const { ethernal, alice, stranger } = f;
      await ethernal.createVault([alice.address], [ZERO_SALT], [10000], HEARTBEAT, CHALLENGE, stranger.address, false);
      const vaultId = 0n;
      await ethernal.setGuardian(vaultId, ZERO_ADDR);
      expect(await ethernal.guardianVaults(stranger.address)).to.deep.equal([]);
      await expect(ethernal.connect(stranger).vetoClaim(vaultId))
        .to.be.revertedWithCustomError(ethernal, "NotGuardian");
    });
  });

  describe("NFT specific bequests", () => {
    it("bequeaths an NFT to a specific heir; heir receives it on withdraw", async () => {
      const { ethernal, nft, owner, alice, bob, vaultId } = await publicVault();
      await nft.mint(owner.address); // id 0
      await nft.approve(await ethernal.getAddress(), 0);
      await ethernal.bequeath721(vaultId, await nft.getAddress(), 0, alice.address, ZERO_SALT);
      expect(await nft.ownerOf(0)).to.equal(await ethernal.getAddress());

      await ethernal.depositETH(vaultId, { value: ethers.parseEther("10") });
      await time.increase(HEARTBEAT + 1);
      await ethernal.connect(alice).initiateClaim(vaultId, ZERO_SALT);
      await time.increase(CHALLENGE + 1);
      await ethernal.finalizeClaim(vaultId);

      await ethernal.connect(alice).withdrawShare(vaultId, ZERO_SALT);
      expect(await nft.ownerOf(0)).to.equal(alice.address);
      // bob gets his ETH share, no NFT
      await ethernal.connect(bob).withdrawShare(vaultId, ZERO_SALT);
      expect(await nft.ownerOf(0)).to.equal(alice.address);
    });

    it("owner can reclaim a bequest before finalization", async () => {
      const { ethernal, nft, owner, alice, vaultId } = await publicVault();
      await nft.mint(owner.address);
      await nft.approve(await ethernal.getAddress(), 0);
      await ethernal.bequeath721(vaultId, await nft.getAddress(), 0, alice.address, ZERO_SALT);
      await ethernal.reclaim721(vaultId, alice.address, ZERO_SALT, 0);
      expect(await nft.ownerOf(0)).to.equal(owner.address);
    });
  });

  describe("letters", () => {
    it("stores a sealed letter under the heir key (public and private)", async () => {
      const { ethernal, alice, vaultId } = await publicVault();
      const ct = ethers.toUtf8Bytes("ciphertext");
      await ethernal.setLetter(vaultId, alice.address, ZERO_SALT, ct);
      expect(await ethernal.letterOf(vaultId, ethers.zeroPadValue(alice.address, 32))).to.equal(ethers.hexlify(ct));

      const f = await privateVault();
      await f.ethernal.setLetter(f.vaultId, f.alice.address, salt("alice-pepper"), ct);
      const key = ethers.keccak256(ethers.solidityPacked(["address", "bytes32"], [f.alice.address, salt("alice-pepper")]));
      expect(await f.ethernal.letterOf(f.vaultId, key)).to.equal(ethers.hexlify(ct));
    });
  });

  describe("owner controls", () => {
    it("heir cannot withdraw twice; stranger cannot withdraw; owner locked after finalize", async () => {
      const { ethernal, alice, stranger, vaultId } = await publicVault();
      await ethernal.depositETH(vaultId, { value: ethers.parseEther("10") });
      await time.increase(HEARTBEAT + 1);
      await ethernal.connect(alice).initiateClaim(vaultId, ZERO_SALT);
      await time.increase(CHALLENGE + 1);
      await ethernal.finalizeClaim(vaultId);
      await ethernal.connect(alice).withdrawShare(vaultId, ZERO_SALT);
      await expect(ethernal.connect(alice).withdrawShare(vaultId, ZERO_SALT))
        .to.be.revertedWithCustomError(ethernal, "AlreadyWithdrawn");
      await expect(ethernal.connect(stranger).withdrawShare(vaultId, ZERO_SALT))
        .to.be.revertedWithCustomError(ethernal, "NotHeir");
      await expect(ethernal.ownerWithdrawETH(vaultId, 1))
        .to.be.revertedWithCustomError(ethernal, "VaultFinalized");
    });

    it("owner can replace heirs before finalization", async () => {
      const { ethernal, alice, stranger, vaultId } = await publicVault();
      await ethernal.setHeirs(vaultId, [stranger.address], [ZERO_SALT], [10000]);
      expect(await ethernal.shareOf(vaultId, ethers.zeroPadValue(alice.address, 32))).to.equal(0);
      expect(await ethernal.shareOf(vaultId, ethers.zeroPadValue(stranger.address, 32))).to.equal(10000);
      expect(await ethernal.inheritedVaults(alice.address)).to.deep.equal([]);
      expect(await ethernal.inheritedVaults(stranger.address)).to.deep.equal([vaultId]);
    });
  });
});
