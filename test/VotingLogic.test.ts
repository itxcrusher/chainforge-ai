import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("VotingLogic", function () {
  async function deployClone(deadlineOffset: bigint = 86400n) {
    const [deployer, voter, other] = await ethers.getSigners();

    const VotingLogic = await ethers.getContractFactory("VotingLogic");
    const impl = await VotingLogic.deploy();
    await impl.waitForDeployment();

    const Factory = await ethers.getContractFactory("CampaignFactory");
    const factory = await Factory.deploy();
    await factory.waitForDeployment();
    await factory.setImplementation("VotingLogic", await impl.getAddress());

    const deadline =
      deadlineOffset === 0n ? 0n : BigInt(await time.latest()) + deadlineOffset;

    const iface = new ethers.Interface(["function initialize(string,string[],uint256)"]);
    const initData = iface.encodeFunctionData("initialize", [
      "the demo league Player of the Match",
      ["Babar Azam", "Shaheen Afridi"],
      deadline,
    ]);

    const tx = await factory.cloneCampaign("VotingLogic", initData, deployer.address);
    const receipt = await tx.wait();
    const parsed = receipt?.logs
      .map((log) => {
        try { return factory.interface.parseLog(log as Parameters<typeof factory.interface.parseLog>[0]); } catch { return null; }
      })
      .find((e) => e?.name === "CampaignCreated");
    const cloneAddress = parsed?.args.clone as string;

    const clone = await ethers.getContractAt("VotingLogic", cloneAddress);

    return { clone, cloneAddress, deadline, deployer, voter, other };
  }

  describe("Initialization", function () {
    it("sets title, options, and deadline correctly", async function () {
      const { clone, deadline } = await deployClone();
      expect(await clone.title()).to.equal("the demo league Player of the Match");
      expect(await clone.options(0)).to.equal("Babar Azam");
      expect(await clone.options(1)).to.equal("Shaheen Afridi");
      expect(await clone.getDeadline()).to.equal(deadline);
    });

    it("initializes with open deadline (0 = no cutoff)", async function () {
      const { clone } = await deployClone(0n);
      expect(await clone.getDeadline()).to.equal(0n);
    });

    it("starts with zero vote counts", async function () {
      const { clone } = await deployClone();
      const [, counts] = await clone.getResults();
      expect(counts[0]).to.equal(0n);
      expect(counts[1]).to.equal(0n);
    });

    it("reverts on empty title", async function () {
      const [deployer] = await ethers.getSigners();
      const VotingLogic = await ethers.getContractFactory("VotingLogic");
      const impl = await VotingLogic.deploy();
      await impl.waitForDeployment();
      const Factory = await ethers.getContractFactory("CampaignFactory");
      const factory = await Factory.deploy();
      await factory.waitForDeployment();
      await factory.setImplementation("VotingLogic", await impl.getAddress());

      const iface = new ethers.Interface(["function initialize(string,string[],uint256)"]);
      const initData = iface.encodeFunctionData("initialize", ["", ["A", "B"], 0n]);
      await expect(
        factory.cloneCampaign("VotingLogic", initData, deployer.address)
      ).to.be.revertedWith("CampaignFactory: initialization failed");
    });

    it("reverts with fewer than 2 options", async function () {
      const [deployer] = await ethers.getSigners();
      const VotingLogic = await ethers.getContractFactory("VotingLogic");
      const impl = await VotingLogic.deploy();
      await impl.waitForDeployment();
      const Factory = await ethers.getContractFactory("CampaignFactory");
      const factory = await Factory.deploy();
      await factory.waitForDeployment();
      await factory.setImplementation("VotingLogic", await impl.getAddress());

      const iface = new ethers.Interface(["function initialize(string,string[],uint256)"]);
      const initData = iface.encodeFunctionData("initialize", ["Poll", ["OnlyOne"], 0n]);
      await expect(
        factory.cloneCampaign("VotingLogic", initData, deployer.address)
      ).to.be.revertedWith("CampaignFactory: initialization failed");
    });

    it("reverts with past deadline (when deadline > 0)", async function () {
      const [deployer] = await ethers.getSigners();
      const VotingLogic = await ethers.getContractFactory("VotingLogic");
      const impl = await VotingLogic.deploy();
      await impl.waitForDeployment();
      const Factory = await ethers.getContractFactory("CampaignFactory");
      const factory = await Factory.deploy();
      await factory.waitForDeployment();
      await factory.setImplementation("VotingLogic", await impl.getAddress());

      const pastDeadline = BigInt(await time.latest()) - 1n;
      const iface = new ethers.Interface(["function initialize(string,string[],uint256)"]);
      const initData = iface.encodeFunctionData("initialize", ["Poll", ["A", "B"], pastDeadline]);
      await expect(
        factory.cloneCampaign("VotingLogic", initData, deployer.address)
      ).to.be.revertedWith("CampaignFactory: initialization failed");
    });

    it("cannot be initialized twice", async function () {
      const { clone } = await deployClone();
      await expect(
        clone.initialize("Another", ["A", "B"], 0n)
      ).to.be.reverted;
    });
  });

  describe("castVote", function () {
    it("records a vote and increments the correct voteCount", async function () {
      const { clone, voter } = await deployClone();
      await clone.connect(voter).castVote(0);
      const [, counts] = await clone.getResults();
      expect(counts[0]).to.equal(1n);
      expect(counts[1]).to.equal(0n);
    });

    it("records hasUserVoted and getUserChoice", async function () {
      const { clone, voter } = await deployClone();
      await clone.connect(voter).castVote(1);
      expect(await clone.hasUserVoted(voter.address)).to.be.true;
      expect(await clone.getUserChoice(voter.address)).to.equal(1n);
    });

    it("emits VoteCast event", async function () {
      const { clone, voter } = await deployClone();
      await expect(clone.connect(voter).castVote(0))
        .to.emit(clone, "VoteCast")
        .withArgs(voter.address, 0n);
    });

    it("reverts on double vote", async function () {
      const { clone, voter } = await deployClone();
      await clone.connect(voter).castVote(0);
      await expect(
        clone.connect(voter).castVote(0)
      ).to.be.revertedWith("VotingLogic: already voted");
    });

    it("reverts on invalid option index", async function () {
      const { clone, voter } = await deployClone();
      await expect(
        clone.connect(voter).castVote(99)
      ).to.be.revertedWith("VotingLogic: invalid option");
    });

    it("reverts after deadline when deadline > 0", async function () {
      const { clone, deadline, voter } = await deployClone(3600n);
      await time.increaseTo(deadline + 1n);
      await expect(
        clone.connect(voter).castVote(0)
      ).to.be.revertedWith("VotingLogic: voting closed");
    });

    it("allows voting after a long time when deadline is 0", async function () {
      const { clone, voter } = await deployClone(0n);
      await time.increase(365 * 24 * 3600);
      await expect(clone.connect(voter).castVote(0)).to.not.be.reverted;
      const [, counts] = await clone.getResults();
      expect(counts[0]).to.equal(1n);
    });
  });

  describe("getResults", function () {
    it("returns correct options and vote counts after multiple votes", async function () {
      const { clone, voter, other } = await deployClone();
      await clone.connect(voter).castVote(0);
      await clone.connect(other).castVote(1);

      const [options, counts] = await clone.getResults();
      expect(options[0]).to.equal("Babar Azam");
      expect(options[1]).to.equal("Shaheen Afridi");
      expect(counts[0]).to.equal(1n);
      expect(counts[1]).to.equal(1n);
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
      ).to.be.revertedWith("VotingLogic: user has not voted");
    });
  });
});
