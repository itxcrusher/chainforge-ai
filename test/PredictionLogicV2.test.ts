import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("PredictionLogicV2", function () {
  async function deployClone() {
    const [deployer, voter, other] = await ethers.getSigners();

    const Impl = await ethers.getContractFactory("PredictionLogicV2");
    const impl = await Impl.deploy();
    await impl.waitForDeployment();

    const Factory = await ethers.getContractFactory("CampaignFactory");
    const factory = await Factory.deploy();
    await factory.waitForDeployment();
    await factory.setImplementation("PredictionLogicV2", await impl.getAddress());

    const deadline = BigInt(await time.latest()) + 3600n; // 1h from now
    const iface = new ethers.Interface([
      "function initialize(address,string,string[],uint256)",
    ]);
    const initData = iface.encodeFunctionData("initialize", [
      deployer.address, // owner = server wallet
      "the demo league Final",
      ["Northern Falcons", "Desert Sultans"],
      deadline,
    ]);

    const tx = await factory.cloneCampaign("PredictionLogicV2", initData, deployer.address);
    const receipt = await tx.wait();
    const parsed = receipt?.logs
      .map((log) => {
        try { return factory.interface.parseLog(log as Parameters<typeof factory.interface.parseLog>[0]); } catch { return null; }
      })
      .find((e) => e?.name === "CampaignCreated");
    const cloneAddress = parsed?.args.clone as string;

    const clone = await ethers.getContractAt("PredictionLogicV2", cloneAddress);

    return { clone, cloneAddress, deadline, deployer, voter, other };
  }

  describe("Initialization", function () {
    it("sets owner, title, deadline, and starts in OPEN state", async function () {
      const { clone, deadline, deployer } = await deployClone();
      expect(await clone.owner()).to.equal(deployer.address);
      expect(await clone.title()).to.equal("the demo league Final");
      expect(await clone.getDeadline()).to.equal(deadline);
      expect(await clone.getState()).to.equal(0n); // State.OPEN = 0
    });

    it("starts with zero vote counts", async function () {
      const { clone } = await deployClone();
      const [, counts] = await clone.getResults();
      expect(counts[0]).to.equal(0n);
      expect(counts[1]).to.equal(0n);
    });

    it("cannot be initialized twice", async function () {
      const { clone, deadline, deployer } = await deployClone();
      await expect(
        clone.initialize(deployer.address, "Another", ["A", "B"], deadline)
      ).to.be.reverted;
    });

    it("reverts if owner is zero address", async function () {
      const [deployer] = await ethers.getSigners();
      const Impl = await ethers.getContractFactory("PredictionLogicV2");
      const impl = await Impl.deploy();
      await impl.waitForDeployment();
      const Factory = await ethers.getContractFactory("CampaignFactory");
      const factory = await Factory.deploy();
      await factory.waitForDeployment();
      await factory.setImplementation("PredictionLogicV2", await impl.getAddress());

      const deadline = BigInt(await time.latest()) + 3600n;
      const iface = new ethers.Interface(["function initialize(address,string,string[],uint256)"]);
      const initData = iface.encodeFunctionData("initialize", [
        ethers.ZeroAddress, "the demo league", ["A", "B"], deadline,
      ]);
      await expect(
        factory.cloneCampaign("PredictionLogicV2", initData, deployer.address)
      ).to.be.revertedWith("CampaignFactory: initialization failed");
    });
  });

  describe("submitPrediction (OPEN state)", function () {
    it("records a vote and increments the correct voteCount", async function () {
      const { clone, voter } = await deployClone();
      await clone.connect(voter).submitPrediction(voter.address, 0);
      const [, counts] = await clone.getResults();
      expect(counts[0]).to.equal(1n);
      expect(counts[1]).to.equal(0n);
    });

    it("emits PredictionSubmitted event", async function () {
      const { clone, voter } = await deployClone();
      await expect(clone.connect(voter).submitPrediction(voter.address, 1))
        .to.emit(clone, "PredictionSubmitted")
        .withArgs(voter.address, 1n);
    });

    it("reverts on double vote", async function () {
      const { clone, voter } = await deployClone();
      await clone.connect(voter).submitPrediction(voter.address, 0);
      await expect(
        clone.connect(voter).submitPrediction(voter.address, 0)
      ).to.be.revertedWithCustomError(clone, "AlreadyVoted");
    });

    it("reverts on invalid option", async function () {
      const { clone, voter } = await deployClone();
      await expect(
        clone.connect(voter).submitPrediction(voter.address, 99)
      ).to.be.revertedWithCustomError(clone, "InvalidOption");
    });

    it("reverts after deadline", async function () {
      const { clone, deadline, voter } = await deployClone();
      await time.increaseTo(deadline + 1n);
      await expect(
        clone.connect(voter).submitPrediction(voter.address, 0)
      ).to.be.revertedWithCustomError(clone, "DeadlinePassed");
    });
  });

  describe("closeCampaign (OPEN → CLOSED)", function () {
    it("transitions to CLOSED after deadline", async function () {
      const { clone, deadline, deployer } = await deployClone();
      await time.increaseTo(deadline + 1n);
      await clone.connect(deployer).closeCampaign();
      expect(await clone.getState()).to.equal(1n); // State.CLOSED = 1
    });

    it("emits CampaignClosed event", async function () {
      const { clone, deadline, deployer } = await deployClone();
      await time.increaseTo(deadline + 1n);
      await expect(clone.connect(deployer).closeCampaign())
        .to.emit(clone, "CampaignClosed");
    });

    it("reverts if called before deadline", async function () {
      const { clone, deployer } = await deployClone();
      await expect(
        clone.connect(deployer).closeCampaign()
      ).to.be.revertedWithCustomError(clone, "DeadlineNotPassed");
    });

    it("reverts if called by non-owner", async function () {
      const { clone, deadline, voter } = await deployClone();
      await time.increaseTo(deadline + 1n);
      await expect(
        clone.connect(voter).closeCampaign()
      ).to.be.revertedWithCustomError(clone, "NotOwner");
    });

    it("reverts if already CLOSED", async function () {
      const { clone, deadline, deployer } = await deployClone();
      await time.increaseTo(deadline + 1n);
      await clone.connect(deployer).closeCampaign();
      await expect(
        clone.connect(deployer).closeCampaign()
      ).to.be.revertedWithCustomError(clone, "WrongState");
    });

    it("prevents new submissions after closing", async function () {
      const { clone, deadline, deployer, voter } = await deployClone();
      await time.increaseTo(deadline + 1n);
      await clone.connect(deployer).closeCampaign();
      await expect(
        clone.connect(voter).submitPrediction(voter.address, 0)
      ).to.be.revertedWithCustomError(clone, "WrongState");
    });
  });

  describe("revealResult (CLOSED → REVEALED)", function () {
    async function closedClone() {
      const ctx = await deployClone();
      const { clone, deadline, deployer, voter, other } = ctx;
      await clone.connect(voter).submitPrediction(voter.address, 0);  // voter picks option 0
      await clone.connect(other).submitPrediction(other.address, 1);  // other picks option 1
      await time.increaseTo(deadline + 1n);
      await clone.connect(deployer).closeCampaign();
      return ctx;
    }

    it("transitions to REVEALED and stores winningOption", async function () {
      const { clone, deployer } = await closedClone();
      await clone.connect(deployer).revealResult(0);
      expect(await clone.getState()).to.equal(2n); // State.REVEALED = 2
      expect(await clone.winningOption()).to.equal(0n);
    });

    it("emits ResultRevealed event", async function () {
      const { clone, deployer } = await closedClone();
      await expect(clone.connect(deployer).revealResult(0))
        .to.emit(clone, "ResultRevealed")
        .withArgs(0n);
    });

    it("reverts if called by non-owner", async function () {
      const { clone, voter } = await closedClone();
      await expect(
        clone.connect(voter).revealResult(0)
      ).to.be.revertedWithCustomError(clone, "NotOwner");
    });

    it("reverts on invalid option index", async function () {
      const { clone, deployer } = await closedClone();
      await expect(
        clone.connect(deployer).revealResult(99)
      ).to.be.revertedWithCustomError(clone, "InvalidOption");
    });

    it("reverts if campaign is still OPEN", async function () {
      const { clone, deployer } = await deployClone();
      await expect(
        clone.connect(deployer).revealResult(0)
      ).to.be.revertedWithCustomError(clone, "WrongState");
    });

    it("reverts if already REVEALED", async function () {
      const { clone, deployer } = await closedClone();
      await clone.connect(deployer).revealResult(0);
      await expect(
        clone.connect(deployer).revealResult(0)
      ).to.be.revertedWithCustomError(clone, "WrongState");
    });
  });

  describe("isWinner / getWinner (REVEALED state)", function () {
    async function revealedClone(winnerIndex: number) {
      const ctx = await deployClone();
      const { clone, deadline, deployer, voter, other } = ctx;
      await clone.connect(voter).submitPrediction(voter.address, 0);
      await clone.connect(other).submitPrediction(other.address, 1);
      await time.increaseTo(deadline + 1n);
      await clone.connect(deployer).closeCampaign();
      await clone.connect(deployer).revealResult(winnerIndex);
      return ctx;
    }

    it("isWinner returns true for a user who picked the winning option", async function () {
      const { clone, voter } = await revealedClone(0); // option 0 wins
      expect(await clone.isWinner(voter.address)).to.be.true;
    });

    it("isWinner returns false for a user who picked the losing option", async function () {
      const { clone, other } = await revealedClone(0); // option 0 wins; other picked 1
      expect(await clone.isWinner(other.address)).to.be.false;
    });

    it("isWinner returns false for a user who did not vote", async function () {
      const { clone, deployer } = await revealedClone(0);
      expect(await clone.isWinner(deployer.address)).to.be.false;
    });

    it("getWinner returns the winning option label", async function () {
      const { clone } = await revealedClone(0);
      expect(await clone.getWinner()).to.equal("Northern Falcons");
    });

    it("isWinner reverts if state is not REVEALED", async function () {
      const { clone, voter } = await deployClone();
      await expect(
        clone.isWinner(voter.address)
      ).to.be.revertedWithCustomError(clone, "WrongState");
    });

    it("getWinner reverts if state is not REVEALED", async function () {
      const { clone } = await deployClone();
      await expect(clone.getWinner()).to.be.revertedWithCustomError(clone, "WrongState");
    });
  });
});
