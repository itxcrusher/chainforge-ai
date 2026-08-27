import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("SurveyLogic", function () {
  async function deployClone() {
    const [deployer, respondent, other] = await ethers.getSigners();

    const Impl = await ethers.getContractFactory("SurveyLogic");
    const impl = await Impl.deploy();
    await impl.waitForDeployment();

    const Factory = await ethers.getContractFactory("CampaignFactory");
    const factory = await Factory.deploy();
    await factory.waitForDeployment();
    await factory.setImplementation("SurveyLogic", await impl.getAddress());

    const iface = new ethers.Interface([
      "function initialize(address,string,string[])",
    ]);
    const initData = iface.encodeFunctionData("initialize", [
      deployer.address,
      "Post-match the demo league sentiment",
      ["Excellent", "Good", "Average", "Poor"],
    ]);

    const tx = await factory.cloneCampaign("SurveyLogic", initData, deployer.address);
    const receipt = await tx.wait();
    const parsed = receipt?.logs
      .map((log) => {
        try { return factory.interface.parseLog(log as Parameters<typeof factory.interface.parseLog>[0]); } catch { return null; }
      })
      .find((e) => e?.name === "CampaignCreated");
    const cloneAddress = parsed?.args.clone as string;

    const clone = await ethers.getContractAt("SurveyLogic", cloneAddress);

    return { clone, cloneAddress, deployer, respondent, other };
  }

  describe("Initialization", function () {
    it("sets owner, title, and starts in OPEN state", async function () {
      const { clone, deployer } = await deployClone();
      expect(await clone.owner()).to.equal(deployer.address);
      expect(await clone.title()).to.equal("Post-match the demo league sentiment");
      expect(await clone.getState()).to.equal(0n); // State.OPEN = 0
    });

    it("getDeadline always returns 0 (no deadline)", async function () {
      const { clone } = await deployClone();
      expect(await clone.getDeadline()).to.equal(0n);
    });

    it("starts with zero vote counts", async function () {
      const { clone } = await deployClone();
      const [, counts] = await clone.getResults();
      expect(counts.every((c: bigint) => c === 0n)).to.be.true;
    });

    it("cannot be initialized twice", async function () {
      const { clone, deployer } = await deployClone();
      const iface = new ethers.Interface(["function initialize(address,string,string[])"]);
      const calldata = iface.encodeFunctionData("initialize", [
        deployer.address, "Again", ["A", "B"],
      ]);
      await expect(
        deployer.sendTransaction({ to: await clone.getAddress(), data: calldata })
      ).to.be.reverted;
    });

    it("reverts if owner is zero address", async function () {
      const [deployer] = await ethers.getSigners();
      const Impl = await ethers.getContractFactory("SurveyLogic");
      const impl = await Impl.deploy();
      await impl.waitForDeployment();
      const Factory = await ethers.getContractFactory("CampaignFactory");
      const factory = await Factory.deploy();
      await factory.waitForDeployment();
      await factory.setImplementation("SurveyLogic", await impl.getAddress());

      const iface = new ethers.Interface(["function initialize(address,string,string[])"]);
      const initData = iface.encodeFunctionData("initialize", [
        ethers.ZeroAddress, "Survey", ["A", "B"],
      ]);
      await expect(
        factory.cloneCampaign("SurveyLogic", initData, deployer.address)
      ).to.be.revertedWith("CampaignFactory: initialization failed");
    });
  });

  describe("submitResponse (OPEN state)", function () {
    it("records a response and increments the correct count", async function () {
      const { clone, respondent } = await deployClone();
      await clone.connect(respondent).submitResponse(respondent.address, 0);
      const [, counts] = await clone.getResults();
      expect(counts[0]).to.equal(1n);
    });

    it("emits ResponseSubmitted event", async function () {
      const { clone, respondent } = await deployClone();
      await expect(clone.connect(respondent).submitResponse(respondent.address, 2))
        .to.emit(clone, "ResponseSubmitted")
        .withArgs(respondent.address, 2n);
    });

    it("reverts on double response", async function () {
      const { clone, respondent } = await deployClone();
      await clone.connect(respondent).submitResponse(respondent.address, 0);
      await expect(
        clone.connect(respondent).submitResponse(respondent.address, 0)
      ).to.be.revertedWithCustomError(clone, "AlreadyResponded");
    });

    it("reverts on invalid option", async function () {
      const { clone, respondent } = await deployClone();
      await expect(
        clone.connect(respondent).submitResponse(respondent.address, 99)
      ).to.be.revertedWithCustomError(clone, "InvalidOption");
    });

    it("allows responding after a very long time (no deadline)", async function () {
      const { clone, respondent } = await deployClone();
      await time.increase(365 * 24 * 3600 * 5); // 5 years
      await expect(clone.connect(respondent).submitResponse(respondent.address, 1)).to.not.be.reverted;
    });
  });

  describe("closeSurvey (OPEN → CLOSED)", function () {
    it("owner closes the survey", async function () {
      const { clone, deployer } = await deployClone();
      await clone.connect(deployer).closeSurvey();
      expect(await clone.getState()).to.equal(1n); // State.CLOSED = 1
    });

    it("emits SurveyClosed event", async function () {
      const { clone, deployer } = await deployClone();
      await expect(clone.connect(deployer).closeSurvey())
        .to.emit(clone, "SurveyClosed");
    });

    it("reverts if called by non-owner", async function () {
      const { clone, respondent } = await deployClone();
      await expect(
        clone.connect(respondent).closeSurvey()
      ).to.be.revertedWithCustomError(clone, "NotOwner");
    });

    it("reverts if already CLOSED", async function () {
      const { clone, deployer } = await deployClone();
      await clone.connect(deployer).closeSurvey();
      await expect(
        clone.connect(deployer).closeSurvey()
      ).to.be.revertedWithCustomError(clone, "WrongState");
    });

    it("prevents new responses after closing", async function () {
      const { clone, deployer, respondent } = await deployClone();
      await clone.connect(deployer).closeSurvey();
      await expect(
        clone.connect(respondent).submitResponse(respondent.address, 0)
      ).to.be.revertedWithCustomError(clone, "WrongState");
    });
  });

  describe("getResults", function () {
    it("returns correct labels and counts after multiple responses", async function () {
      const { clone, respondent, other } = await deployClone();
      await clone.connect(respondent).submitResponse(respondent.address, 0); // Excellent
      await clone.connect(other).submitResponse(other.address, 2);      // Average

      const [options, counts] = await clone.getResults();
      expect(options[0]).to.equal("Excellent");
      expect(options[2]).to.equal("Average");
      expect(counts[0]).to.equal(1n);
      expect(counts[2]).to.equal(1n);
      expect(counts[1]).to.equal(0n);
    });
  });

  describe("hasUserResponded / getUserChoice", function () {
    it("hasUserResponded returns false before responding", async function () {
      const { clone, respondent } = await deployClone();
      expect(await clone.hasUserResponded(respondent.address)).to.be.false;
    });

    it("hasUserResponded returns true after responding", async function () {
      const { clone, respondent } = await deployClone();
      await clone.connect(respondent).submitResponse(respondent.address, 1);
      expect(await clone.hasUserResponded(respondent.address)).to.be.true;
    });

    it("getUserChoice reverts if user has not responded", async function () {
      const { clone, respondent } = await deployClone();
      await expect(
        clone.getUserChoice(respondent.address)
      ).to.be.revertedWith("SurveyLogic: user has not responded");
    });

    it("getUserChoice returns the submitted option index", async function () {
      const { clone, respondent } = await deployClone();
      await clone.connect(respondent).submitResponse(respondent.address, 3);
      expect(await clone.getUserChoice(respondent.address)).to.equal(3n);
    });
  });
});
