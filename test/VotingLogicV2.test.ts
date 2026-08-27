import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("VotingLogicV2", function () {
  async function deployClone(deadlineOffset: bigint = 3600n) {
    const [deployer, voter, other] = await ethers.getSigners();

    const Impl = await ethers.getContractFactory("VotingLogicV2");
    const impl = await Impl.deploy();
    await impl.waitForDeployment();

    const Factory = await ethers.getContractFactory("CampaignFactory");
    const factory = await Factory.deploy();
    await factory.waitForDeployment();
    await factory.setImplementation("VotingLogicV2", await impl.getAddress());

    const deadline =
      deadlineOffset === 0n ? 0n : BigInt(await time.latest()) + deadlineOffset;

    const iface = new ethers.Interface([
      "function initialize(address,string,string[],uint256)",
    ]);
    const initData = iface.encodeFunctionData("initialize", [
      deployer.address,
      "the demo league Best Bowler",
      ["Shaheen Afridi", "Naseem Shah"],
      deadline,
    ]);

    const tx = await factory.cloneCampaign("VotingLogicV2", initData, deployer.address);
    const receipt = await tx.wait();
    const parsed = receipt?.logs
      .map((log) => {
        try { return factory.interface.parseLog(log as Parameters<typeof factory.interface.parseLog>[0]); } catch { return null; }
      })
      .find((e) => e?.name === "CampaignCreated");
    const cloneAddress = parsed?.args.clone as string;

    const clone = await ethers.getContractAt("VotingLogicV2", cloneAddress);

    return { clone, cloneAddress, deadline, deployer, voter, other };
  }

  describe("Initialization", function () {
    it("sets owner, title, and starts in OPEN state", async function () {
      const { clone, deployer } = await deployClone();
      expect(await clone.owner()).to.equal(deployer.address);
      expect(await clone.title()).to.equal("the demo league Best Bowler");
      expect(await clone.getState()).to.equal(0n); // State.OPEN = 0
    });

    it("accepts zero deadline (open-ended)", async function () {
      const { clone } = await deployClone(0n);
      expect(await clone.getDeadline()).to.equal(0n);
    });

    it("starts with zero vote counts", async function () {
      const { clone } = await deployClone();
      const [, counts] = await clone.getResults();
      expect(counts[0]).to.equal(0n);
      expect(counts[1]).to.equal(0n);
    });

    it("cannot be initialized twice", async function () {
      const { clone, deployer } = await deployClone();
      await expect(
        clone.initialize(deployer.address, "Another", ["A", "B"], 0n)
      ).to.be.reverted;
    });
  });

  describe("castVote (OPEN state)", function () {
    it("records a vote and increments voteCount", async function () {
      const { clone, voter } = await deployClone();
      await clone.connect(voter).castVote(voter.address, 0);
      const [, counts] = await clone.getResults();
      expect(counts[0]).to.equal(1n);
      expect(counts[1]).to.equal(0n);
    });

    it("emits VoteCast event", async function () {
      const { clone, voter } = await deployClone();
      await expect(clone.connect(voter).castVote(voter.address, 1))
        .to.emit(clone, "VoteCast")
        .withArgs(voter.address, 1n);
    });

    it("reverts on double vote", async function () {
      const { clone, voter } = await deployClone();
      await clone.connect(voter).castVote(voter.address, 0);
      await expect(
        clone.connect(voter).castVote(voter.address, 0)
      ).to.be.revertedWithCustomError(clone, "AlreadyVoted");
    });

    it("reverts on invalid option", async function () {
      const { clone, voter } = await deployClone();
      await expect(
        clone.connect(voter).castVote(voter.address, 99)
      ).to.be.revertedWithCustomError(clone, "InvalidOption");
    });

    it("reverts after deadline when deadline > 0", async function () {
      const { clone, deadline, voter } = await deployClone(3600n);
      await time.increaseTo(deadline + 1n);
      await expect(
        clone.connect(voter).castVote(voter.address, 0)
      ).to.be.revertedWithCustomError(clone, "VotingClosed");
    });

    it("allows voting indefinitely when deadline is 0", async function () {
      const { clone, voter } = await deployClone(0n);
      await time.increase(365 * 24 * 3600);
      await expect(clone.connect(voter).castVote(voter.address, 0)).to.not.be.reverted;
    });
  });

  describe("closeCampaign (OPEN → CLOSED)", function () {
    it("owner can close at any time", async function () {
      const { clone, deployer } = await deployClone();
      await clone.connect(deployer).closeCampaign();
      expect(await clone.getState()).to.equal(1n); // State.CLOSED = 1
    });

    it("emits CampaignClosed event", async function () {
      const { clone, deployer } = await deployClone();
      await expect(clone.connect(deployer).closeCampaign())
        .to.emit(clone, "CampaignClosed");
    });

    it("reverts if called by non-owner", async function () {
      const { clone, voter } = await deployClone();
      await expect(
        clone.connect(voter).closeCampaign()
      ).to.be.revertedWithCustomError(clone, "NotOwner");
    });

    it("reverts if already CLOSED", async function () {
      const { clone, deployer } = await deployClone();
      await clone.connect(deployer).closeCampaign();
      await expect(
        clone.connect(deployer).closeCampaign()
      ).to.be.revertedWithCustomError(clone, "WrongState");
    });

    it("prevents new votes after closing", async function () {
      const { clone, deployer, voter } = await deployClone();
      await clone.connect(deployer).closeCampaign();
      await expect(
        clone.connect(voter).castVote(voter.address, 0)
      ).to.be.revertedWithCustomError(clone, "WrongState");
    });
  });

  describe("getResults", function () {
    it("returns correct labels and counts after multiple votes", async function () {
      const { clone, voter, other } = await deployClone();
      await clone.connect(voter).castVote(voter.address, 0);
      await clone.connect(other).castVote(other.address, 1);

      const [options, counts] = await clone.getResults();
      expect(options[0]).to.equal("Shaheen Afridi");
      expect(options[1]).to.equal("Naseem Shah");
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
      ).to.be.revertedWith("VotingLogicV2: user has not voted");
    });
  });
});
