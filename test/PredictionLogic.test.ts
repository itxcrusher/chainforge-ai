import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("PredictionLogic", function () {
  async function deployClone() {
    const [deployer, voter, other] = await ethers.getSigners();

    const PredictionLogic = await ethers.getContractFactory("PredictionLogic");
    const impl = await PredictionLogic.deploy();
    await impl.waitForDeployment();

    const Factory = await ethers.getContractFactory("CampaignFactory");
    const factory = await Factory.deploy();
    await factory.waitForDeployment();
    await factory.setImplementation("PredictionLogic", await impl.getAddress());

    const deadline = BigInt(await time.latest()) + 86400n;
    const iface = new ethers.Interface(["function initialize(string,string[],uint256)"]);
    const initData = iface.encodeFunctionData("initialize", [
      "the demo league Final",
      ["Northern Falcons", "Desert Sultans"],
      deadline,
    ]);

    const tx = await factory.cloneCampaign("PredictionLogic", initData, deployer.address);
    const receipt = await tx.wait();
    const parsed = receipt?.logs
      .map((log) => {
        try { return factory.interface.parseLog(log as Parameters<typeof factory.interface.parseLog>[0]); } catch { return null; }
      })
      .find((e) => e?.name === "CampaignCreated");
    const cloneAddress = parsed?.args.clone as string;

    const clone = await ethers.getContractAt("PredictionLogic", cloneAddress);

    return { clone, cloneAddress, deadline, deployer, voter, other };
  }

  describe("Initialization", function () {
    it("sets title, options, and deadline correctly", async function () {
      const { clone, deadline } = await deployClone();
      expect(await clone.title()).to.equal("the demo league Final");
      expect(await clone.options(0)).to.equal("Northern Falcons");
      expect(await clone.options(1)).to.equal("Desert Sultans");
      expect(await clone.getDeadline()).to.equal(deadline);
    });

    it("starts with zero vote counts", async function () {
      const { clone } = await deployClone();
      const [, counts] = await clone.getResults();
      expect(counts[0]).to.equal(0n);
      expect(counts[1]).to.equal(0n);
    });

    it("reverts on empty title", async function () {
      const [deployer] = await ethers.getSigners();
      const PredictionLogic = await ethers.getContractFactory("PredictionLogic");
      const impl = await PredictionLogic.deploy();
      await impl.waitForDeployment();
      const Factory = await ethers.getContractFactory("CampaignFactory");
      const factory = await Factory.deploy();
      await factory.waitForDeployment();
      await factory.setImplementation("PredictionLogic", await impl.getAddress());

      const deadline = BigInt(await time.latest()) + 86400n;
      const iface = new ethers.Interface(["function initialize(string,string[],uint256)"]);
      const initData = iface.encodeFunctionData("initialize", ["", ["A", "B"], deadline]);
      await expect(
        factory.cloneCampaign("PredictionLogic", initData, deployer.address)
      ).to.be.revertedWith("CampaignFactory: initialization failed");
    });

    it("reverts with fewer than 2 options", async function () {
      const [deployer] = await ethers.getSigners();
      const PredictionLogic = await ethers.getContractFactory("PredictionLogic");
      const impl = await PredictionLogic.deploy();
      await impl.waitForDeployment();
      const Factory = await ethers.getContractFactory("CampaignFactory");
      const factory = await Factory.deploy();
      await factory.waitForDeployment();
      await factory.setImplementation("PredictionLogic", await impl.getAddress());

      const deadline = BigInt(await time.latest()) + 86400n;
      const iface = new ethers.Interface(["function initialize(string,string[],uint256)"]);
      const initData = iface.encodeFunctionData("initialize", ["the demo league Final", ["OnlyOne"], deadline]);
      await expect(
        factory.cloneCampaign("PredictionLogic", initData, deployer.address)
      ).to.be.revertedWith("CampaignFactory: initialization failed");
    });

    it("reverts with past deadline", async function () {
      const [deployer] = await ethers.getSigners();
      const PredictionLogic = await ethers.getContractFactory("PredictionLogic");
      const impl = await PredictionLogic.deploy();
      await impl.waitForDeployment();
      const Factory = await ethers.getContractFactory("CampaignFactory");
      const factory = await Factory.deploy();
      await factory.waitForDeployment();
      await factory.setImplementation("PredictionLogic", await impl.getAddress());

      const pastDeadline = BigInt(await time.latest()) - 1n;
      const iface = new ethers.Interface(["function initialize(string,string[],uint256)"]);
      const initData = iface.encodeFunctionData("initialize", ["the demo league Final", ["A", "B"], pastDeadline]);
      await expect(
        factory.cloneCampaign("PredictionLogic", initData, deployer.address)
      ).to.be.revertedWith("CampaignFactory: initialization failed");
    });

    it("cannot be initialized twice", async function () {
      const { clone, deadline } = await deployClone();
      await expect(
        clone.initialize("Another", ["A", "B"], deadline)
      ).to.be.reverted;
    });
  });

  describe("submitPrediction", function () {
    it("records a vote and increments the correct voteCount", async function () {
      const { clone, voter } = await deployClone();
      await clone.connect(voter).submitPrediction(0);
      const [, counts] = await clone.getResults();
      expect(counts[0]).to.equal(1n);
      expect(counts[1]).to.equal(0n);
    });

    it("records hasUserVoted and getUserChoice", async function () {
      const { clone, voter } = await deployClone();
      await clone.connect(voter).submitPrediction(1);
      expect(await clone.hasUserVoted(voter.address)).to.be.true;
      expect(await clone.getUserChoice(voter.address)).to.equal(1n);
    });

    it("emits PredictionSubmitted event", async function () {
      const { clone, voter } = await deployClone();
      await expect(clone.connect(voter).submitPrediction(0))
        .to.emit(clone, "PredictionSubmitted")
        .withArgs(voter.address, 0n);
    });

    it("reverts on double vote", async function () {
      const { clone, voter } = await deployClone();
      await clone.connect(voter).submitPrediction(0);
      await expect(
        clone.connect(voter).submitPrediction(0)
      ).to.be.revertedWith("PredictionLogic: already voted");
    });

    it("reverts on invalid option index", async function () {
      const { clone, voter } = await deployClone();
      await expect(
        clone.connect(voter).submitPrediction(99)
      ).to.be.revertedWith("PredictionLogic: invalid option");
    });

    it("reverts after deadline has passed", async function () {
      const { clone, deadline, voter } = await deployClone();
      await time.increaseTo(deadline + 1n);
      await expect(
        clone.connect(voter).submitPrediction(0)
      ).to.be.revertedWith("PredictionLogic: deadline passed");
    });
  });

  describe("getResults", function () {
    it("returns correct options and vote counts after multiple votes", async function () {
      const { clone, voter, other } = await deployClone();
      await clone.connect(voter).submitPrediction(0);
      await clone.connect(other).submitPrediction(0);

      const [options, counts] = await clone.getResults();
      expect(options[0]).to.equal("Northern Falcons");
      expect(options[1]).to.equal("Desert Sultans");
      expect(counts[0]).to.equal(2n);
      expect(counts[1]).to.equal(0n);
    });
  });

  describe("hasUserVoted / getUserChoice", function () {
    it("hasUserVoted returns false before voting", async function () {
      const { clone, voter } = await deployClone();
      expect(await clone.hasUserVoted(voter.address)).to.be.false;
    });

    it("getUserChoice reverts if user has not voted", async function () {
      const { clone, voter } = await deployClone();
      await expect(
        clone.getUserChoice(voter.address)
      ).to.be.revertedWith("PredictionLogic: user has not voted");
    });
  });
});
