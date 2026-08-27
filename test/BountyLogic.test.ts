import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("BountyLogic", function () {
  async function deployClone(deadline = 0n) {
    const [deployer, user, other, third] = await ethers.getSigners();

    const Impl = await ethers.getContractFactory("BountyLogic");
    const impl = await Impl.deploy();
    await impl.waitForDeployment();

    const Factory = await ethers.getContractFactory("CampaignFactory");
    const factory = await Factory.deploy();
    await factory.waitForDeployment();
    await factory.setImplementation("BountyLogic", await impl.getAddress());

    const dl = deadline > 0n ? deadline : 0n;
    const iface = new ethers.Interface([
      "function initialize(address,string,string,uint256)",
    ]);
    const initData = iface.encodeFunctionData("initialize", [
      deployer.address,
      "Best Fan Photo",
      "Submit your best fan photo for a chance to win VIP tickets.",
      dl,
    ]);

    const tx = await factory.cloneCampaign("BountyLogic", initData, deployer.address);
    const receipt = await tx.wait();
    const parsed = receipt?.logs
      .map((log) => {
        try { return factory.interface.parseLog(log as Parameters<typeof factory.interface.parseLog>[0]); } catch { return null; }
      })
      .find((e) => e?.name === "CampaignCreated");
    const cloneAddress = parsed?.args.clone as string;
    const clone = await ethers.getContractAt("BountyLogic", cloneAddress);

    return { clone, deployer, user, other, third };
  }

  describe("Initialization", function () {
    it("sets owner, title, challengeDescription, OPEN state", async function () {
      const { clone, deployer } = await deployClone();
      expect(await clone.owner()).to.equal(deployer.address);
      expect(await clone.title()).to.equal("Best Fan Photo");
      expect(await clone.getState()).to.equal(0n);
    });

    it("starts with no participants", async function () {
      const { clone } = await deployClone();
      expect(await clone.getParticipantCount()).to.equal(0n);
    });

    it("cannot be initialized twice", async function () {
      const { clone, deployer } = await deployClone();
      await expect(
        clone.initialize(deployer.address, "Again", "desc", 0n)
      ).to.be.reverted;
    });
  });

  describe("register (OPEN state)", function () {
    it("registers participant and sets hasRegistered", async function () {
      const { clone, user } = await deployClone();
      await clone.connect(user).register(user.address);
      expect(await clone.getParticipantCount()).to.equal(1n);
      expect(await clone.hasRegistered(user.address)).to.be.true;
    });

    it("emits ParticipantRegistered event", async function () {
      const { clone, user } = await deployClone();
      await expect(clone.connect(user).register(user.address))
        .to.emit(clone, "ParticipantRegistered")
        .withArgs(user.address);
    });

    it("reverts on double registration", async function () {
      const { clone, user } = await deployClone();
      await clone.connect(user).register(user.address);
      await expect(
        clone.connect(user).register(user.address)
      ).to.be.revertedWithCustomError(clone, "AlreadyRegistered");
    });

    it("reverts after deadline when deadline is set", async function () {
      const [deployer] = await ethers.getSigners();
      const dl = BigInt(await time.latest()) + 100n;
      const { clone, user } = await deployClone(dl);
      await time.increaseTo(dl + 1n);
      await expect(
        clone.connect(user).register(user.address)
      ).to.be.revertedWithCustomError(clone, "DeadlinePassed");
    });

    it("allows registration with no deadline (creator-controlled)", async function () {
      const { clone, user } = await deployClone(0n); // no deadline
      await expect(clone.connect(user).register(user.address)).to.not.be.reverted;
    });

    it("reverts if CLOSED", async function () {
      const { clone, deployer, user } = await deployClone();
      await clone.connect(deployer).closeCampaign();
      await expect(
        clone.connect(user).register(user.address)
      ).to.be.revertedWithCustomError(clone, "WrongState");
    });
  });

  describe("closeCampaign (OPEN → CLOSED)", function () {
    it("transitions to CLOSED", async function () {
      const { clone, deployer } = await deployClone();
      await clone.connect(deployer).closeCampaign();
      expect(await clone.getState()).to.equal(1n);
    });

    it("emits BountyClosed event", async function () {
      const { clone, deployer } = await deployClone();
      await expect(clone.connect(deployer).closeCampaign())
        .to.emit(clone, "BountyClosed");
    });

    it("reverts if called by non-owner", async function () {
      const { clone, user } = await deployClone();
      await expect(
        clone.connect(user).closeCampaign()
      ).to.be.revertedWithCustomError(clone, "NotOwner");
    });

    it("reverts if already CLOSED", async function () {
      const { clone, deployer } = await deployClone();
      await clone.connect(deployer).closeCampaign();
      await expect(
        clone.connect(deployer).closeCampaign()
      ).to.be.revertedWithCustomError(clone, "WrongState");
    });
  });

  describe("finalizeWinners (CLOSED → FINALIZED)", function () {
    async function closedClone() {
      const ctx = await deployClone();
      const { clone, deployer, user, other } = ctx;
      await clone.connect(user).register(user.address);
      await clone.connect(other).register(other.address);
      await clone.connect(deployer).closeCampaign();
      return ctx;
    }

    it("transitions to FINALIZED and records winner(s)", async function () {
      const { clone, deployer, user } = await closedClone();
      await clone.connect(deployer).finalizeWinners([user.address]);
      expect(await clone.getState()).to.equal(2n); // FINALIZED
      expect(await clone.isWinner(user.address)).to.be.true;
    });

    it("emits WinnersFinalized event", async function () {
      const { clone, deployer, user } = await closedClone();
      await expect(clone.connect(deployer).finalizeWinners([user.address]))
        .to.emit(clone, "WinnersFinalized");
    });

    it("supports multiple winners", async function () {
      const { clone, deployer, user, other } = await closedClone();
      await clone.connect(deployer).finalizeWinners([user.address, other.address]);
      expect(await clone.isWinner(user.address)).to.be.true;
      expect(await clone.isWinner(other.address)).to.be.true;
    });

    it("deduplicates duplicate addresses in _winners", async function () {
      const { clone, deployer, user } = await closedClone();
      await clone.connect(deployer).finalizeWinners([user.address, user.address]);
      const winners = await clone.getWinners();
      expect(winners.length).to.equal(1);
    });

    it("reverts if no participants", async function () {
      const { clone, deployer } = await deployClone();
      await clone.connect(deployer).closeCampaign();
      await expect(
        clone.connect(deployer).finalizeWinners([deployer.address])
      ).to.be.revertedWithCustomError(clone, "NoParticipants");
    });

    it("reverts if called by non-owner", async function () {
      const { clone, user } = await closedClone();
      await expect(
        clone.connect(user).finalizeWinners([user.address])
      ).to.be.revertedWithCustomError(clone, "NotOwner");
    });

    it("reverts if still OPEN", async function () {
      const { clone, deployer, user } = await deployClone();
      await clone.connect(user).register(user.address);
      await expect(
        clone.connect(deployer).finalizeWinners([user.address])
      ).to.be.revertedWithCustomError(clone, "WrongState");
    });
  });

  describe("isWinner (any state)", function () {
    it("returns false for non-winner", async function () {
      const { clone, deployer, user, other } = await deployClone();
      await clone.connect(user).register(user.address);
      await clone.connect(other).register(other.address);
      await clone.connect(deployer).closeCampaign();
      await clone.connect(deployer).finalizeWinners([user.address]);
      expect(await clone.isWinner(other.address)).to.be.false;
    });
  });
});
