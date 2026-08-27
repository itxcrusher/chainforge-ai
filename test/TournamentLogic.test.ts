import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("TournamentLogic", function () {
  async function deployClone() {
    const [deployer, fan1, fan2] = await ethers.getSigners();

    const Impl = await ethers.getContractFactory("TournamentLogic");
    const impl = await Impl.deploy();
    await impl.waitForDeployment();

    const Factory = await ethers.getContractFactory("CampaignFactory");
    const factory = await Factory.deploy();
    await factory.waitForDeployment();
    await factory.setImplementation("TournamentLogic", await impl.getAddress());

    const iface = new ethers.Interface([
      "function initialize(address,string)",
    ]);
    const initData = iface.encodeFunctionData("initialize", [
      deployer.address,
      "the demo league 2026 Season Bracket",
    ]);

    const tx = await factory.cloneCampaign("TournamentLogic", initData, deployer.address);
    const receipt = await tx.wait();
    const parsed = receipt?.logs
      .map((log) => {
        try { return factory.interface.parseLog(log as Parameters<typeof factory.interface.parseLog>[0]); } catch { return null; }
      })
      .find((e) => e?.name === "CampaignCreated");
    const cloneAddress = parsed?.args.clone as string;
    const clone = await ethers.getContractAt("TournamentLogic", cloneAddress);

    return { clone, deployer, fan1, fan2 };
  }

  describe("Initialization", function () {
    it("sets owner, title, ACTIVE state, zero rounds", async function () {
      const { clone, deployer } = await deployClone();
      expect(await clone.owner()).to.equal(deployer.address);
      expect(await clone.title()).to.equal("the demo league 2026 Season Bracket");
      expect(await clone.getState()).to.equal(0n); // ACTIVE
      expect(await clone.getRoundCount()).to.equal(0n);
    });

    it("cannot be initialized twice", async function () {
      const { clone, deployer } = await deployClone();
      await expect(
        clone.initialize(deployer.address, "Again")
      ).to.be.reverted;
    });
  });

  describe("addRound", function () {
    it("adds a round with correct fields", async function () {
      const { clone, deployer } = await deployClone();
      const dl = BigInt(await time.latest()) + 3600n;
      await clone.connect(deployer).addRound("QF1", ["Team A", "Team B"], dl);
      expect(await clone.getRoundCount()).to.equal(1n);
      const [desc,, deadline,, ,] = await clone.getRound(0);
      expect(desc).to.equal("QF1");
      expect(deadline).to.equal(dl);
    });

    it("emits RoundAdded event", async function () {
      const { clone, deployer } = await deployClone();
      const dl = BigInt(await time.latest()) + 3600n;
      await expect(clone.connect(deployer).addRound("QF1", ["A", "B"], dl))
        .to.emit(clone, "RoundAdded")
        .withArgs(0n, "QF1", dl);
    });

    it("reverts if called by non-owner", async function () {
      const { clone, fan1 } = await deployClone();
      const dl = BigInt(await time.latest()) + 3600n;
      await expect(
        clone.connect(fan1).addRound("QF1", ["A", "B"], dl)
      ).to.be.revertedWithCustomError(clone, "NotOwner");
    });

    it("reverts if deadline is in the past", async function () {
      const { clone, deployer } = await deployClone();
      const pastDl = BigInt(await time.latest()) - 1n;
      await expect(
        clone.connect(deployer).addRound("QF1", ["A", "B"], pastDl)
      ).to.be.revertedWith("TournamentLogic: deadline in past");
    });

    it("reverts if fewer than 2 options", async function () {
      const { clone, deployer } = await deployClone();
      const dl = BigInt(await time.latest()) + 3600n;
      await expect(
        clone.connect(deployer).addRound("QF1", ["Only One"], dl)
      ).to.be.revertedWith("TournamentLogic: need at least 2 options");
    });
  });

  describe("submitPrediction", function () {
    async function cloneWithRound() {
      const ctx = await deployClone();
      const { clone, deployer } = ctx;
      const dl = BigInt(await time.latest()) + 3600n;
      await clone.connect(deployer).addRound("QF1", ["Northern Falcons", "Riverside Rangers"], dl);
      return { ...ctx, dl };
    }

    it("records prediction for a round", async function () {
      const { clone, fan1 } = await cloneWithRound();
      await clone.connect(fan1).submitPrediction(fan1.address, 0, 1);
      expect(await clone.hasPredictedRound(fan1.address, 0)).to.be.true;
    });

    it("emits PredictionSubmitted event", async function () {
      const { clone, fan1 } = await cloneWithRound();
      await expect(clone.connect(fan1).submitPrediction(fan1.address, 0, 0))
        .to.emit(clone, "PredictionSubmitted")
        .withArgs(fan1.address, 0n, 0n);
    });

    it("reverts on double prediction for same round", async function () {
      const { clone, fan1 } = await cloneWithRound();
      await clone.connect(fan1).submitPrediction(fan1.address, 0, 0);
      await expect(
        clone.connect(fan1).submitPrediction(fan1.address, 0, 1)
      ).to.be.revertedWithCustomError(clone, "AlreadyPredicted");
    });

    it("reverts on invalid option", async function () {
      const { clone, fan1 } = await cloneWithRound();
      await expect(
        clone.connect(fan1).submitPrediction(fan1.address, 0, 99)
      ).to.be.revertedWithCustomError(clone, "InvalidOption");
    });

    it("reverts on invalid round", async function () {
      const { clone, fan1 } = await cloneWithRound();
      await expect(
        clone.connect(fan1).submitPrediction(fan1.address, 99, 0)
      ).to.be.revertedWithCustomError(clone, "InvalidRound");
    });

    it("reverts after round deadline", async function () {
      const { clone, fan1, dl } = await cloneWithRound();
      await time.increaseTo(dl + 1n);
      await expect(
        clone.connect(fan1).submitPrediction(fan1.address, 0, 0)
      ).to.be.revertedWithCustomError(clone, "DeadlinePassed");
    });
  });

  describe("finalizeRound", function () {
    async function cloneWithPredictions() {
      const ctx = await deployClone();
      const { clone, deployer, fan1, fan2 } = ctx;
      const dl = BigInt(await time.latest()) + 3600n;
      await clone.connect(deployer).addRound("QF1", ["Northern Falcons", "Riverside Rangers"], dl);
      await clone.connect(fan1).submitPrediction(fan1.address, 0, 0); // picks option 0
      await clone.connect(fan2).submitPrediction(fan2.address, 0, 1); // picks option 1
      return { ...ctx, dl };
    }

    it("finalizes round with correct option", async function () {
      const { clone, deployer, dl } = await cloneWithPredictions();
      await time.increaseTo(dl + 1n);
      await clone.connect(deployer).finalizeRound(0, 0);
      const [,,,finalized, correctOption,] = await clone.getRound(0);
      expect(finalized).to.be.true;
      expect(correctOption).to.equal(0n);
    });

    it("emits RoundFinalized event", async function () {
      const { clone, deployer, dl } = await cloneWithPredictions();
      await time.increaseTo(dl + 1n);
      await expect(clone.connect(deployer).finalizeRound(0, 0))
        .to.emit(clone, "RoundFinalized")
        .withArgs(0n, 0n);
    });

    it("reverts before deadline", async function () {
      const { clone, deployer } = await cloneWithPredictions();
      await expect(
        clone.connect(deployer).finalizeRound(0, 0)
      ).to.be.revertedWithCustomError(clone, "DeadlineNotPassed");
    });

    it("reverts if already finalized", async function () {
      const { clone, deployer, dl } = await cloneWithPredictions();
      await time.increaseTo(dl + 1n);
      await clone.connect(deployer).finalizeRound(0, 0);
      await expect(
        clone.connect(deployer).finalizeRound(0, 0)
      ).to.be.revertedWithCustomError(clone, "RoundAlreadyFinalized");
    });

    it("reverts if called by non-owner", async function () {
      const { clone, fan1, dl } = await cloneWithPredictions();
      await time.increaseTo(dl + 1n);
      await expect(
        clone.connect(fan1).finalizeRound(0, 0)
      ).to.be.revertedWithCustomError(clone, "NotOwner");
    });
  });

  describe("claimRoundScore", function () {
    async function finalizedRoundCtx() {
      const ctx = await deployClone();
      const { clone, deployer, fan1, fan2 } = ctx;
      const dl = BigInt(await time.latest()) + 3600n;
      await clone.connect(deployer).addRound("QF1", ["NF", "RR"], dl);
      await clone.connect(fan1).submitPrediction(fan1.address, 0, 0); // correct
      await clone.connect(fan2).submitPrediction(fan2.address, 0, 1); // wrong
      await time.increaseTo(dl + 1n);
      await clone.connect(deployer).finalizeRound(0, 0); // option 0 correct
      return ctx;
    }

    it("awards score to correct predictor", async function () {
      const { clone, fan1 } = await finalizedRoundCtx();
      await clone.claimRoundScore(fan1.address, 0);
      expect(await clone.getScore(fan1.address)).to.equal(1n);
    });

    it("does not award score to wrong predictor", async function () {
      const { clone, fan2 } = await finalizedRoundCtx();
      await clone.claimRoundScore(fan2.address, 0);
      expect(await clone.getScore(fan2.address)).to.equal(0n);
    });

    it("does not award score twice (double-claim prevention)", async function () {
      const { clone, fan1 } = await finalizedRoundCtx();
      await clone.claimRoundScore(fan1.address, 0);
      await clone.claimRoundScore(fan1.address, 0); // second call — should not increase
      expect(await clone.getScore(fan1.address)).to.equal(1n);
    });

    it("accumulates score across multiple rounds", async function () {
      const { clone, deployer, fan1 } = await deployClone();
      // Round 0
      const dl0 = BigInt(await time.latest()) + 3600n;
      await clone.connect(deployer).addRound("R1", ["A", "B"], dl0);
      await clone.connect(fan1).submitPrediction(fan1.address, 0, 0);
      await time.increaseTo(dl0 + 1n);
      await clone.connect(deployer).finalizeRound(0, 0);
      await clone.claimRoundScore(fan1.address, 0);

      // Round 1
      const dl1 = BigInt(await time.latest()) + 3600n;
      await clone.connect(deployer).addRound("R2", ["C", "D"], dl1);
      await clone.connect(fan1).submitPrediction(fan1.address, 1, 1);
      await time.increaseTo(dl1 + 1n);
      await clone.connect(deployer).finalizeRound(1, 1);
      await clone.claimRoundScore(fan1.address, 1);

      expect(await clone.getScore(fan1.address)).to.equal(2n);
    });

    it("reverts if round is not finalized", async function () {
      const { clone, deployer, fan1 } = await deployClone();
      const dl = BigInt(await time.latest()) + 3600n;
      await clone.connect(deployer).addRound("R1", ["A", "B"], dl);
      await clone.connect(fan1).submitPrediction(fan1.address, 0, 0);
      await expect(
        clone.claimRoundScore(fan1.address, 0)
      ).to.be.revertedWithCustomError(clone, "RoundNotFinalized");
    });
  });

  describe("completeTournament", function () {
    it("transitions to COMPLETED", async function () {
      const { clone, deployer } = await deployClone();
      await clone.connect(deployer).completeTournament();
      expect(await clone.getState()).to.equal(1n); // COMPLETED
    });

    it("emits TournamentCompleted", async function () {
      const { clone, deployer } = await deployClone();
      await expect(clone.connect(deployer).completeTournament())
        .to.emit(clone, "TournamentCompleted");
    });

    it("prevents adding rounds after completion", async function () {
      const { clone, deployer } = await deployClone();
      await clone.connect(deployer).completeTournament();
      const dl = BigInt(await time.latest()) + 3600n;
      await expect(
        clone.connect(deployer).addRound("Late", ["A", "B"], dl)
      ).to.be.revertedWithCustomError(clone, "WrongState");
    });

    it("reverts if called by non-owner", async function () {
      const { clone, fan1 } = await deployClone();
      await expect(
        clone.connect(fan1).completeTournament()
      ).to.be.revertedWithCustomError(clone, "NotOwner");
    });
  });
});
