import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("AuctionLogic", function () {
  async function deployClone() {
    const [deployer, bidder1, bidder2] = await ethers.getSigners();

    const Impl = await ethers.getContractFactory("AuctionLogic");
    const impl = await Impl.deploy();
    await impl.waitForDeployment();

    const Factory = await ethers.getContractFactory("CampaignFactory");
    const factory = await Factory.deploy();
    await factory.waitForDeployment();
    await factory.setImplementation("AuctionLogic", await impl.getAddress());

    const deadline = BigInt(await time.latest()) + 3600n;
    const iface = new ethers.Interface([
      "function initialize(address,string,string,uint256)",
    ]);
    const initData = iface.encodeFunctionData("initialize", [
      deployer.address,
      "Meet Babar Azam Auction",
      "Win a private meet-and-greet with Babar Azam at the the demo league Final.",
      deadline,
    ]);

    const tx = await factory.cloneCampaign("AuctionLogic", initData, deployer.address);
    const receipt = await tx.wait();
    const parsed = receipt?.logs
      .map((log) => {
        try { return factory.interface.parseLog(log as Parameters<typeof factory.interface.parseLog>[0]); } catch { return null; }
      })
      .find((e) => e?.name === "CampaignCreated");
    const cloneAddress = parsed?.args.clone as string;
    const clone = await ethers.getContractAt("AuctionLogic", cloneAddress);

    return { clone, deadline, deployer, bidder1, bidder2 };
  }

  describe("Initialization", function () {
    it("sets owner, title, privilegeDescription, deadline, OPEN state", async function () {
      const { clone, deadline, deployer } = await deployClone();
      expect(await clone.owner()).to.equal(deployer.address);
      expect(await clone.title()).to.equal("Meet Babar Azam Auction");
      expect(await clone.getDeadline()).to.equal(deadline);
      expect(await clone.getState()).to.equal(0n); // OPEN
    });

    it("starts with no bidders", async function () {
      const { clone } = await deployClone();
      expect(await clone.getBidderCount()).to.equal(0n);
    });

    it("cannot be initialized twice", async function () {
      const { clone, deadline, deployer } = await deployClone();
      await expect(
        clone.initialize(deployer.address, "Again", "prize", deadline)
      ).to.be.reverted;
    });
  });

  describe("placeBid (OPEN state)", function () {
    it("records a new bid and adds bidder", async function () {
      const { clone, bidder1 } = await deployClone();
      await clone.connect(bidder1).placeBid(bidder1.address, 100n);
      expect(await clone.getBidderCount()).to.equal(1n);
      const [amount,] = await clone.getBid(bidder1.address);
      expect(amount).to.equal(100n);
    });

    it("emits BidPlaced event for first bid", async function () {
      const { clone, bidder1 } = await deployClone();
      await expect(clone.connect(bidder1).placeBid(bidder1.address, 200n))
        .to.emit(clone, "BidPlaced")
        .withArgs(bidder1.address, 200n);
    });

    it("allows updating a bid to a higher amount", async function () {
      const { clone, bidder1 } = await deployClone();
      await clone.connect(bidder1).placeBid(bidder1.address, 100n);
      await clone.connect(bidder1).placeBid(bidder1.address, 500n);
      const [amount,] = await clone.getBid(bidder1.address);
      expect(amount).to.equal(500n);
    });

    it("emits BidUpdated event on update", async function () {
      const { clone, bidder1 } = await deployClone();
      await clone.connect(bidder1).placeBid(bidder1.address, 100n);
      await expect(clone.connect(bidder1).placeBid(bidder1.address, 300n))
        .to.emit(clone, "BidUpdated")
        .withArgs(bidder1.address, 100n, 300n);
    });

    it("does not add duplicate to bidders array on update", async function () {
      const { clone, bidder1 } = await deployClone();
      await clone.connect(bidder1).placeBid(bidder1.address, 100n);
      await clone.connect(bidder1).placeBid(bidder1.address, 200n);
      expect(await clone.getBidderCount()).to.equal(1n);
    });

    it("reverts on bid amount of 0", async function () {
      const { clone, bidder1 } = await deployClone();
      await expect(
        clone.connect(bidder1).placeBid(bidder1.address, 0n)
      ).to.be.revertedWithCustomError(clone, "BidTooLow");
    });

    it("reverts if new bid is not higher than current bid", async function () {
      const { clone, bidder1 } = await deployClone();
      await clone.connect(bidder1).placeBid(bidder1.address, 500n);
      await expect(
        clone.connect(bidder1).placeBid(bidder1.address, 400n)
      ).to.be.revertedWithCustomError(clone, "BidTooLow");
    });

    it("reverts after deadline", async function () {
      const { clone, deadline, bidder1 } = await deployClone();
      await time.increaseTo(deadline + 1n);
      await expect(
        clone.connect(bidder1).placeBid(bidder1.address, 100n)
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
      const { clone, deadline, bidder1 } = await deployClone();
      await time.increaseTo(deadline + 1n);
      await expect(
        clone.connect(bidder1).closeCampaign()
      ).to.be.revertedWithCustomError(clone, "NotOwner");
    });
  });

  describe("selectWinner (CLOSED → FINALIZED)", function () {
    async function closedClone() {
      const ctx = await deployClone();
      const { clone, deadline, deployer, bidder1, bidder2 } = ctx;
      await clone.connect(bidder1).placeBid(bidder1.address, 100n);
      await clone.connect(bidder2).placeBid(bidder2.address, 200n);
      await time.increaseTo(deadline + 1n);
      await clone.connect(deployer).closeCampaign();
      return ctx;
    }

    it("transitions to FINALIZED and records winner", async function () {
      const { clone, deployer, bidder2 } = await closedClone();
      await clone.connect(deployer).selectWinner(bidder2.address);
      expect(await clone.getState()).to.equal(2n);
      expect(await clone.winner()).to.equal(bidder2.address);
      expect(await clone.winningBid()).to.equal(200n);
    });

    it("emits WinnerSelected event", async function () {
      const { clone, deployer, bidder2 } = await closedClone();
      await expect(clone.connect(deployer).selectWinner(bidder2.address))
        .to.emit(clone, "WinnerSelected")
        .withArgs(bidder2.address, 200n);
    });

    it("reverts for address that has not bid", async function () {
      const { clone, deployer } = await closedClone();
      await expect(
        clone.connect(deployer).selectWinner(deployer.address)
      ).to.be.revertedWith("AuctionLogic: address has not placed a bid");
    });

    it("reverts if no bidders", async function () {
      const { clone, deadline, deployer, bidder1 } = await deployClone();
      await time.increaseTo(deadline + 1n);
      await clone.connect(deployer).closeCampaign();
      await expect(
        clone.connect(deployer).selectWinner(bidder1.address)
      ).to.be.revertedWithCustomError(clone, "NoBidders");
    });

    it("reverts if called by non-owner", async function () {
      const { clone, bidder1, bidder2 } = await closedClone();
      await expect(
        clone.connect(bidder1).selectWinner(bidder2.address)
      ).to.be.revertedWithCustomError(clone, "NotOwner");
    });

    it("reverts if still OPEN", async function () {
      const { clone, deployer, bidder1 } = await deployClone();
      await clone.connect(bidder1).placeBid(bidder1.address, 100n);
      await expect(
        clone.connect(deployer).selectWinner(bidder1.address)
      ).to.be.revertedWithCustomError(clone, "WrongState");
    });
  });

  describe("getHighestBid", function () {
    it("returns the current top bidder and amount", async function () {
      const { clone, bidder1, bidder2 } = await deployClone();
      await clone.connect(bidder1).placeBid(bidder1.address, 100n);
      await clone.connect(bidder2).placeBid(bidder2.address, 500n);
      const [topBidder, topAmount] = await clone.getHighestBid();
      expect(topBidder).to.equal(bidder2.address);
      expect(topAmount).to.equal(500n);
    });
  });

  describe("isWinner (FINALIZED state)", function () {
    it("returns true for the selected winner", async function () {
      const { clone, deadline, deployer, bidder1 } = await deployClone();
      await clone.connect(bidder1).placeBid(bidder1.address, 100n);
      await time.increaseTo(deadline + 1n);
      await clone.connect(deployer).closeCampaign();
      await clone.connect(deployer).selectWinner(bidder1.address);
      expect(await clone.isWinner(bidder1.address)).to.be.true;
    });

    it("reverts if not FINALIZED", async function () {
      const { clone, bidder1 } = await deployClone();
      await expect(
        clone.isWinner(bidder1.address)
      ).to.be.revertedWithCustomError(clone, "WrongState");
    });
  });
});
