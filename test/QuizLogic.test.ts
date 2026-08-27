import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("QuizLogic", function () {
  async function deployClone() {
    const [deployer, user, other] = await ethers.getSigners();

    const Impl = await ethers.getContractFactory("QuizLogic");
    const impl = await Impl.deploy();
    await impl.waitForDeployment();

    const Factory = await ethers.getContractFactory("CampaignFactory");
    const factory = await Factory.deploy();
    await factory.waitForDeployment();
    await factory.setImplementation("QuizLogic", await impl.getAddress());

    const deadline = BigInt(await time.latest()) + 3600n;
    const iface = new ethers.Interface([
      "function initialize(address,string,string[],uint256)",
    ]);
    const initData = iface.encodeFunctionData("initialize", [
      deployer.address,
      "the demo league Cricket Trivia",
      ["Riverside Rangers", "Northern Falcons", "Desert Sultans"],
      deadline,
    ]);

    const tx = await factory.cloneCampaign("QuizLogic", initData, deployer.address);
    const receipt = await tx.wait();
    const parsed = receipt?.logs
      .map((log) => {
        try { return factory.interface.parseLog(log as Parameters<typeof factory.interface.parseLog>[0]); } catch { return null; }
      })
      .find((e) => e?.name === "CampaignCreated");
    const cloneAddress = parsed?.args.clone as string;
    const clone = await ethers.getContractAt("QuizLogic", cloneAddress);

    return { clone, deadline, deployer, user, other };
  }

  describe("Initialization", function () {
    it("sets owner, title, deadline, starts in OPEN state", async function () {
      const { clone, deadline, deployer } = await deployClone();
      expect(await clone.owner()).to.equal(deployer.address);
      expect(await clone.title()).to.equal("the demo league Cricket Trivia");
      expect(await clone.getDeadline()).to.equal(deadline);
      expect(await clone.getState()).to.equal(0n); // OPEN
    });

    it("starts with zero answer counts", async function () {
      const { clone } = await deployClone();
      const [, counts] = await clone.getResults();
      expect(counts[0]).to.equal(0n);
      expect(counts[1]).to.equal(0n);
    });

    it("cannot be initialized twice", async function () {
      const { clone, deadline, deployer } = await deployClone();
      await expect(
        clone.initialize(deployer.address, "Again", ["A", "B"], deadline)
      ).to.be.reverted;
    });

    it("reverts if owner is zero address", async function () {
      const [deployer] = await ethers.getSigners();
      const Impl = await ethers.getContractFactory("QuizLogic");
      const impl = await Impl.deploy();
      await impl.waitForDeployment();
      const Factory = await ethers.getContractFactory("CampaignFactory");
      const factory = await Factory.deploy();
      await factory.waitForDeployment();
      await factory.setImplementation("QuizLogic", await impl.getAddress());
      const deadline = BigInt(await time.latest()) + 3600n;
      const iface = new ethers.Interface(["function initialize(address,string,string[],uint256)"]);
      const initData = iface.encodeFunctionData("initialize", [
        ethers.ZeroAddress, "Quiz", ["A", "B"], deadline,
      ]);
      await expect(
        factory.cloneCampaign("QuizLogic", initData, deployer.address)
      ).to.be.revertedWith("CampaignFactory: initialization failed");
    });
  });

  describe("submitAnswer (OPEN state)", function () {
    it("records answer and increments count", async function () {
      const { clone, user } = await deployClone();
      await clone.connect(user).submitAnswer(user.address, 1);
      const [, counts] = await clone.getResults();
      expect(counts[1]).to.equal(1n);
    });

    it("emits AnswerSubmitted event", async function () {
      const { clone, user } = await deployClone();
      await expect(clone.connect(user).submitAnswer(user.address, 0))
        .to.emit(clone, "AnswerSubmitted")
        .withArgs(user.address, 0n);
    });

    it("reverts on double answer", async function () {
      const { clone, user } = await deployClone();
      await clone.connect(user).submitAnswer(user.address, 0);
      await expect(
        clone.connect(user).submitAnswer(user.address, 1)
      ).to.be.revertedWithCustomError(clone, "AlreadyAnswered");
    });

    it("reverts on invalid option", async function () {
      const { clone, user } = await deployClone();
      await expect(
        clone.connect(user).submitAnswer(user.address, 99)
      ).to.be.revertedWithCustomError(clone, "InvalidOption");
    });

    it("reverts after deadline", async function () {
      const { clone, deadline, user } = await deployClone();
      await time.increaseTo(deadline + 1n);
      await expect(
        clone.connect(user).submitAnswer(user.address, 0)
      ).to.be.revertedWithCustomError(clone, "DeadlinePassed");
    });
  });

  describe("closeCampaign (OPEN → CLOSED)", function () {
    it("transitions to CLOSED after deadline", async function () {
      const { clone, deadline, deployer } = await deployClone();
      await time.increaseTo(deadline + 1n);
      await clone.connect(deployer).closeCampaign();
      expect(await clone.getState()).to.equal(1n); // CLOSED
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

    it("reverts if already CLOSED", async function () {
      const { clone, deadline, deployer } = await deployClone();
      await time.increaseTo(deadline + 1n);
      await clone.connect(deployer).closeCampaign();
      await expect(
        clone.connect(deployer).closeCampaign()
      ).to.be.revertedWithCustomError(clone, "WrongState");
    });
  });

  describe("revealAnswer (CLOSED → REVEALED)", function () {
    async function closedClone() {
      const ctx = await deployClone();
      const { clone, deadline, deployer, user, other } = ctx;
      await clone.connect(user).submitAnswer(user.address, 0);  // correct
      await clone.connect(other).submitAnswer(other.address, 1); // wrong
      await time.increaseTo(deadline + 1n);
      await clone.connect(deployer).closeCampaign();
      return ctx;
    }

    it("transitions to REVEALED and stores correctOption", async function () {
      const { clone, deployer } = await closedClone();
      await clone.connect(deployer).revealAnswer(0);
      expect(await clone.getState()).to.equal(2n); // REVEALED
      expect(await clone.correctOption()).to.equal(0n);
    });

    it("emits AnswerRevealed event", async function () {
      const { clone, deployer } = await closedClone();
      await expect(clone.connect(deployer).revealAnswer(0))
        .to.emit(clone, "AnswerRevealed")
        .withArgs(0n);
    });

    it("reverts on invalid option", async function () {
      const { clone, deployer } = await closedClone();
      await expect(
        clone.connect(deployer).revealAnswer(99)
      ).to.be.revertedWithCustomError(clone, "InvalidOption");
    });

    it("reverts if called by non-owner", async function () {
      const { clone, user } = await closedClone();
      await expect(
        clone.connect(user).revealAnswer(0)
      ).to.be.revertedWithCustomError(clone, "NotOwner");
    });

    it("reverts if still OPEN", async function () {
      const { clone, deployer } = await deployClone();
      await expect(
        clone.connect(deployer).revealAnswer(0)
      ).to.be.revertedWithCustomError(clone, "WrongState");
    });

    it("reverts if already REVEALED", async function () {
      const { clone, deployer } = await closedClone();
      await clone.connect(deployer).revealAnswer(0);
      await expect(
        clone.connect(deployer).revealAnswer(0)
      ).to.be.revertedWithCustomError(clone, "WrongState");
    });
  });

  describe("isCorrect / getCorrectOptionLabel (REVEALED state)", function () {
    async function revealedClone() {
      const ctx = await deployClone();
      const { clone, deadline, deployer, user, other } = ctx;
      await clone.connect(user).submitAnswer(user.address, 0);   // correct
      await clone.connect(other).submitAnswer(other.address, 2); // wrong
      await time.increaseTo(deadline + 1n);
      await clone.connect(deployer).closeCampaign();
      await clone.connect(deployer).revealAnswer(0); // option 0 is correct
      return ctx;
    }

    it("isCorrect returns true for user who answered correctly", async function () {
      const { clone, user } = await revealedClone();
      expect(await clone.isCorrect(user.address)).to.be.true;
    });

    it("isCorrect returns false for user who answered wrong", async function () {
      const { clone, other } = await revealedClone();
      expect(await clone.isCorrect(other.address)).to.be.false;
    });

    it("isCorrect returns false for user who did not answer", async function () {
      const { clone, deployer } = await revealedClone();
      expect(await clone.isCorrect(deployer.address)).to.be.false;
    });

    it("getCorrectOptionLabel returns the label", async function () {
      const { clone } = await revealedClone();
      expect(await clone.getCorrectOptionLabel()).to.equal("Riverside Rangers");
    });

    it("isCorrect reverts if not REVEALED", async function () {
      const { clone, user } = await deployClone();
      await expect(
        clone.isCorrect(user.address)
      ).to.be.revertedWithCustomError(clone, "WrongState");
    });
  });
});
