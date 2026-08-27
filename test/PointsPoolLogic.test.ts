import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("PointsPoolLogic", function () {
  async function deployClone() {
    const [deployer, user, other] = await ethers.getSigners();

    const Impl = await ethers.getContractFactory("PointsPoolLogic");
    const impl = await Impl.deploy();
    await impl.waitForDeployment();

    const Factory = await ethers.getContractFactory("CampaignFactory");
    const factory = await Factory.deploy();
    await factory.waitForDeployment();
    await factory.setImplementation("PointsPoolLogic", await impl.getAddress());

    const deadline = BigInt(await time.latest()) + 3600n;
    const iface = new ethers.Interface([
      "function initialize(address,string,string[],uint256)",
    ]);
    const initData = iface.encodeFunctionData("initialize", [
      deployer.address,
      "the demo league Final Reputation Pool",
      ["Northern Falcons", "Riverside Rangers"],
      deadline,
    ]);

    const tx = await factory.cloneCampaign("PointsPoolLogic", initData, deployer.address);
    const receipt = await tx.wait();
    const parsed = receipt?.logs
      .map((log) => {
        try { return factory.interface.parseLog(log as Parameters<typeof factory.interface.parseLog>[0]); } catch { return null; }
      })
      .find((e) => e?.name === "CampaignCreated");
    const cloneAddress = parsed?.args.clone as string;
    const clone = await ethers.getContractAt("PointsPoolLogic", cloneAddress);

    return { clone, deadline, deployer, user, other };
  }

  describe("Initialization", function () {
    it("sets owner, title, deadline, OPEN state", async function () {
      const { clone, deadline, deployer } = await deployClone();
      expect(await clone.owner()).to.equal(deployer.address);
      expect(await clone.title()).to.equal("the demo league Final Reputation Pool");
      expect(await clone.getDeadline()).to.equal(deadline);
      expect(await clone.getState()).to.equal(0n);
    });

    it("starts with zero weighted votes and vote counts", async function () {
      const { clone } = await deployClone();
      const [, counts, weighted] = await clone.getResults();
      expect(counts[0]).to.equal(0n);
      expect(weighted[0]).to.equal(0n);
    });

    it("cannot be initialized twice", async function () {
      const { clone, deadline, deployer } = await deployClone();
      await expect(
        clone.initialize(deployer.address, "Again", ["A", "B"], deadline)
      ).to.be.reverted;
    });
  });

  describe("stakeWeight (OPEN state)", function () {
    it("records prediction with weight and updates weighted votes", async function () {
      const { clone, user } = await deployClone();
      await clone.connect(user).stakeWeight(user.address, 0, 500n);
      const [, counts, weighted] = await clone.getResults();
      expect(counts[0]).to.equal(1n);
      expect(weighted[0]).to.equal(500n);
      expect(await clone.hasPredicted(user.address)).to.be.true;
    });

    it("emits PredictionStaked event", async function () {
      const { clone, user } = await deployClone();
      await expect(clone.connect(user).stakeWeight(user.address, 1, 750n))
        .to.emit(clone, "PredictionStaked")
        .withArgs(user.address, 1n, 750n);
    });

    it("reverts on double prediction", async function () {
      const { clone, user } = await deployClone();
      await clone.connect(user).stakeWeight(user.address, 0, 100n);
      await expect(
        clone.connect(user).stakeWeight(user.address, 0, 200n)
      ).to.be.revertedWithCustomError(clone, "AlreadyPredicted");
    });

    it("reverts on invalid option", async function () {
      const { clone, user } = await deployClone();
      await expect(
        clone.connect(user).stakeWeight(user.address, 99, 100n)
      ).to.be.revertedWithCustomError(clone, "InvalidOption");
    });

    it("reverts on zero weight", async function () {
      const { clone, user } = await deployClone();
      await expect(
        clone.connect(user).stakeWeight(user.address, 0, 0n)
      ).to.be.revertedWithCustomError(clone, "InvalidWeight");
    });

    it("reverts on weight > 1000", async function () {
      const { clone, user } = await deployClone();
      await expect(
        clone.connect(user).stakeWeight(user.address, 0, 1001n)
      ).to.be.revertedWithCustomError(clone, "InvalidWeight");
    });

    it("allows weight of exactly 1000", async function () {
      const { clone, user } = await deployClone();
      await expect(
        clone.connect(user).stakeWeight(user.address, 0, 1000n)
      ).to.not.be.reverted;
    });

    it("reverts after deadline", async function () {
      const { clone, deadline, user } = await deployClone();
      await time.increaseTo(deadline + 1n);
      await expect(
        clone.connect(user).stakeWeight(user.address, 0, 100n)
      ).to.be.revertedWithCustomError(clone, "DeadlinePassed");
    });
  });

  describe("closeCampaign (OPEN → CLOSED)", function () {
    it("transitions to CLOSED after deadline", async function () {
      const { clone, deadline, deployer } = await deployClone();
      await time.increaseTo(deadline + 1n);
      await clone.connect(deployer).closeCampaign();
      expect(await clone.getState()).to.equal(1n);
    });

    it("reverts before deadline", async function () {
      const { clone, deployer } = await deployClone();
      await expect(
        clone.connect(deployer).closeCampaign()
      ).to.be.revertedWithCustomError(clone, "DeadlineNotPassed");
    });

    it("reverts if called by non-owner", async function () {
      const { clone, deadline, user } = await deployClone();
      await time.increaseTo(deadline + 1n);
      await expect(
        clone.connect(user).closeCampaign()
      ).to.be.revertedWithCustomError(clone, "NotOwner");
    });
  });

  describe("revealResult (CLOSED → REVEALED)", function () {
    async function closedClone() {
      const ctx = await deployClone();
      const { clone, deadline, deployer, user, other } = ctx;
      await clone.connect(user).stakeWeight(user.address, 0, 800n);   // high weight, correct
      await clone.connect(other).stakeWeight(other.address, 1, 200n); // low weight, wrong
      await time.increaseTo(deadline + 1n);
      await clone.connect(deployer).closeCampaign();
      return ctx;
    }

    it("transitions to REVEALED and stores winningOption", async function () {
      const { clone, deployer } = await closedClone();
      await clone.connect(deployer).revealResult(0);
      expect(await clone.getState()).to.equal(2n);
      expect(await clone.winningOption()).to.equal(0n);
    });

    it("isCorrect returns true for user who picked the winning option", async function () {
      const { clone, deployer, user } = await closedClone();
      await clone.connect(deployer).revealResult(0);
      expect(await clone.isCorrect(user.address)).to.be.true;
    });

    it("isCorrect returns false for user who picked the losing option", async function () {
      const { clone, deployer, other } = await closedClone();
      await clone.connect(deployer).revealResult(0);
      expect(await clone.isCorrect(other.address)).to.be.false;
    });

    it("reverts if called by non-owner", async function () {
      const { clone, user } = await closedClone();
      await expect(
        clone.connect(user).revealResult(0)
      ).to.be.revertedWithCustomError(clone, "NotOwner");
    });

    it("reverts if still OPEN", async function () {
      const { clone, deployer } = await deployClone();
      await expect(
        clone.connect(deployer).revealResult(0)
      ).to.be.revertedWithCustomError(clone, "WrongState");
    });
  });

  describe("getUserPrediction", function () {
    it("returns the staked option and weight", async function () {
      const { clone, user } = await deployClone();
      await clone.connect(user).stakeWeight(user.address, 1, 600n);
      const [optionIndex, weight] = await clone.getUserPrediction(user.address);
      expect(optionIndex).to.equal(1n);
      expect(weight).to.equal(600n);
    });

    it("reverts for user who has not predicted", async function () {
      const { clone, user } = await deployClone();
      await expect(
        clone.getUserPrediction(user.address)
      ).to.be.revertedWith("PointsPoolLogic: user has not predicted");
    });
  });
});
