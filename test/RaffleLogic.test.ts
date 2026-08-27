import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("RaffleLogic", function () {
  async function deployClone() {
    const [deployer, user, other] = await ethers.getSigners();

    const Impl = await ethers.getContractFactory("RaffleLogic");
    const impl = await Impl.deploy();
    await impl.waitForDeployment();

    const Factory = await ethers.getContractFactory("CampaignFactory");
    const factory = await Factory.deploy();
    await factory.waitForDeployment();
    await factory.setImplementation("RaffleLogic", await impl.getAddress());

    const deadline = BigInt(await time.latest()) + 3600n;
    const iface = new ethers.Interface([
      "function initialize(address,string,string,uint256)",
    ]);
    const initData = iface.encodeFunctionData("initialize", [
      deployer.address,
      "the demo league Fan Giveaway",
      "Signed bat from Babar Azam",
      deadline,
    ]);

    const tx = await factory.cloneCampaign("RaffleLogic", initData, deployer.address);
    const receipt = await tx.wait();
    const parsed = receipt?.logs
      .map((log) => {
        try { return factory.interface.parseLog(log as Parameters<typeof factory.interface.parseLog>[0]); } catch { return null; }
      })
      .find((e) => e?.name === "CampaignCreated");
    const cloneAddress = parsed?.args.clone as string;
    const clone = await ethers.getContractAt("RaffleLogic", cloneAddress);

    return { clone, deadline, deployer, user, other };
  }

  describe("Initialization", function () {
    it("sets owner, title, prizeDescription, deadline, OPEN state", async function () {
      const { clone, deadline, deployer } = await deployClone();
      expect(await clone.owner()).to.equal(deployer.address);
      expect(await clone.title()).to.equal("the demo league Fan Giveaway");
      expect(await clone.prizeDescription()).to.equal("Signed bat from Babar Azam");
      expect(await clone.getDeadline()).to.equal(deadline);
      expect(await clone.getState()).to.equal(0n);
    });

    it("starts with no participants", async function () {
      const { clone } = await deployClone();
      expect(await clone.getParticipantCount()).to.equal(0n);
    });

    it("cannot be initialized twice", async function () {
      const { clone, deadline, deployer } = await deployClone();
      await expect(
        clone.initialize(deployer.address, "Again", "prize", deadline)
      ).to.be.reverted;
    });
  });

  describe("enter (OPEN state)", function () {
    it("registers participant and increments count", async function () {
      const { clone, user } = await deployClone();
      await clone.connect(user).enter(user.address);
      expect(await clone.getParticipantCount()).to.equal(1n);
      expect(await clone.hasEntered(user.address)).to.be.true;
    });

    it("emits ParticipantEntered event", async function () {
      const { clone, user } = await deployClone();
      await expect(clone.connect(user).enter(user.address))
        .to.emit(clone, "ParticipantEntered")
        .withArgs(user.address);
    });

    it("reverts on double entry", async function () {
      const { clone, user } = await deployClone();
      await clone.connect(user).enter(user.address);
      await expect(
        clone.connect(user).enter(user.address)
      ).to.be.revertedWithCustomError(clone, "AlreadyEntered");
    });

    it("reverts after deadline", async function () {
      const { clone, deadline, user } = await deployClone();
      await time.increaseTo(deadline + 1n);
      await expect(
        clone.connect(user).enter(user.address)
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

  describe("selectWinner (CLOSED → REVEALED)", function () {
    async function closedClone() {
      const ctx = await deployClone();
      const { clone, deadline, deployer, user, other } = ctx;
      await clone.connect(user).enter(user.address);
      await clone.connect(other).enter(other.address);
      await time.increaseTo(deadline + 1n);
      await clone.connect(deployer).closeCampaign();
      return ctx;
    }

    it("transitions to REVEALED and sets a winner from participants", async function () {
      const { clone, deployer, user, other } = await closedClone();
      await clone.connect(deployer).selectWinner();
      expect(await clone.getState()).to.equal(2n);
      const winner = await clone.winner();
      expect([user.address, other.address]).to.include(winner);
    });

    it("emits WinnerSelected event", async function () {
      const { clone, deployer } = await closedClone();
      await expect(clone.connect(deployer).selectWinner())
        .to.emit(clone, "WinnerSelected");
    });

    it("reverts if no participants", async function () {
      const { clone, deadline, deployer } = await deployClone();
      await time.increaseTo(deadline + 1n);
      await clone.connect(deployer).closeCampaign();
      await expect(
        clone.connect(deployer).selectWinner()
      ).to.be.revertedWithCustomError(clone, "NoParticipants");
    });

    it("reverts if called by non-owner", async function () {
      const { clone, user } = await closedClone();
      await expect(
        clone.connect(user).selectWinner()
      ).to.be.revertedWithCustomError(clone, "NotOwner");
    });

    it("reverts if still OPEN", async function () {
      const { clone, deployer } = await deployClone();
      await expect(
        clone.connect(deployer).selectWinner()
      ).to.be.revertedWithCustomError(clone, "WrongState");
    });
  });

  describe("isWinner (REVEALED state)", function () {
    it("isWinner returns true for the selected winner", async function () {
      const { clone, deadline, deployer, user } = await deployClone();
      await clone.connect(user).enter(user.address);
      await time.increaseTo(deadline + 1n);
      await clone.connect(deployer).closeCampaign();
      await clone.connect(deployer).selectWinner();
      const winner = await clone.winner();
      expect(await clone.isWinner(winner)).to.be.true;
    });

    it("isWinner reverts if not REVEALED", async function () {
      const { clone, user } = await deployClone();
      await expect(
        clone.isWinner(user.address)
      ).to.be.revertedWithCustomError(clone, "WrongState");
    });
  });
});
