import { expect } from "chai";
import { ethers } from "hardhat";

describe("FanPassLogic", function () {
  async function deployClone() {
    const [deployer, fan1, fan2, fan3] = await ethers.getSigners();

    const Impl = await ethers.getContractFactory("FanPassLogic");
    const impl = await Impl.deploy();
    await impl.waitForDeployment();

    const Factory = await ethers.getContractFactory("CampaignFactory");
    const factory = await Factory.deploy();
    await factory.waitForDeployment();
    await factory.setImplementation("FanPassLogic", await impl.getAddress());

    const iface = new ethers.Interface([
      "function initialize(address,string,string[],uint256[])",
    ]);
    const initData = iface.encodeFunctionData("initialize", [
      deployer.address,
      "the demo league Fan Pass 2026",
      ["General", "VIP", "Creators Circle"],
      [1000n, 100n, 10n],
    ]);

    const tx = await factory.cloneCampaign("FanPassLogic", initData, deployer.address);
    const receipt = await tx.wait();
    const parsed = receipt?.logs
      .map((log) => {
        try { return factory.interface.parseLog(log as Parameters<typeof factory.interface.parseLog>[0]); } catch { return null; }
      })
      .find((e) => e?.name === "CampaignCreated");
    const cloneAddress = parsed?.args.clone as string;
    const clone = await ethers.getContractAt("FanPassLogic", cloneAddress);

    return { clone, deployer, fan1, fan2, fan3 };
  }

  describe("Initialization", function () {
    it("sets owner, title, 3 tiers, OPEN state", async function () {
      const { clone, deployer } = await deployClone();
      expect(await clone.owner()).to.equal(deployer.address);
      expect(await clone.title()).to.equal("the demo league Fan Pass 2026");
      expect(await clone.getTierCount()).to.equal(3n);
      expect(await clone.getState()).to.equal(0n); // OPEN
    });

    it("stores tier names and supply caps correctly", async function () {
      const { clone } = await deployClone();
      const [name0, max0, issued0] = await clone.getTier(0);
      expect(name0).to.equal("General");
      expect(max0).to.equal(1000n);
      expect(issued0).to.equal(0n);

      const [name2, max2, issued2] = await clone.getTier(2);
      expect(name2).to.equal("Creators Circle");
      expect(max2).to.equal(10n);
      expect(issued2).to.equal(0n);
    });

    it("cannot be initialized twice", async function () {
      const { clone, deployer } = await deployClone();
      await expect(
        clone.initialize(deployer.address, "Again", ["A"], [100n])
      ).to.be.reverted;
    });

    it("reverts if owner is zero", async function () {
      const [deployer] = await ethers.getSigners();
      const Impl = await ethers.getContractFactory("FanPassLogic");
      const impl = await Impl.deploy();
      await impl.waitForDeployment();
      const Factory = await ethers.getContractFactory("CampaignFactory");
      const factory = await Factory.deploy();
      await factory.waitForDeployment();
      await factory.setImplementation("FanPassLogic", await impl.getAddress());
      const iface = new ethers.Interface(["function initialize(address,string,string[],uint256[])"]);
      const initData = iface.encodeFunctionData("initialize", [
        ethers.ZeroAddress, "Pass", ["G"], [100n],
      ]);
      await expect(
        factory.cloneCampaign("FanPassLogic", initData, deployer.address)
      ).to.be.revertedWith("CampaignFactory: initialization failed");
    });
  });

  describe("claimPass (OPEN state)", function () {
    it("claims General tier (tier 0) successfully", async function () {
      const { clone, fan1 } = await deployClone();
      await clone.connect(fan1).claimPass(fan1.address, 0);
      expect(await clone.hasClaimed(fan1.address, 0)).to.be.true;
      const [,, issued] = await clone.getTier(0);
      expect(issued).to.equal(1n);
    });

    it("emits PassClaimed event", async function () {
      const { clone, fan1 } = await deployClone();
      await expect(clone.connect(fan1).claimPass(fan1.address, 1))
        .to.emit(clone, "PassClaimed")
        .withArgs(fan1.address, 1n, "VIP");
    });

    it("reverts on double claim of same tier", async function () {
      const { clone, fan1 } = await deployClone();
      await clone.connect(fan1).claimPass(fan1.address, 0);
      await expect(
        clone.connect(fan1).claimPass(fan1.address, 0)
      ).to.be.revertedWithCustomError(clone, "AlreadyClaimed");
    });

    it("allows claiming different tiers independently", async function () {
      const { clone, fan1 } = await deployClone();
      await clone.connect(fan1).claimPass(fan1.address, 0);
      await clone.connect(fan1).claimPass(fan1.address, 1);
      expect(await clone.hasClaimed(fan1.address, 0)).to.be.true;
      expect(await clone.hasClaimed(fan1.address, 1)).to.be.true;
    });

    it("reverts on invalid tier", async function () {
      const { clone, fan1 } = await deployClone();
      await expect(
        clone.connect(fan1).claimPass(fan1.address, 99)
      ).to.be.revertedWithCustomError(clone, "InvalidTier");
    });

    it("reverts when tier is sold out", async function () {
      // Deploy with supply cap of 1 for Creators Circle (tier 2)
      const { clone, fan1, fan2 } = await deployClone();
      // Creators Circle has supply 10; test soldOut with a fresh contract with cap=1
      const [deployer] = await ethers.getSigners();
      const Impl = await ethers.getContractFactory("FanPassLogic");
      const impl2 = await Impl.deploy();
      await impl2.waitForDeployment();
      const Factory = await ethers.getContractFactory("CampaignFactory");
      const factory2 = await Factory.deploy();
      await factory2.waitForDeployment();
      await factory2.setImplementation("FanPassLogic", await impl2.getAddress());
      const iface = new ethers.Interface(["function initialize(address,string,string[],uint256[])"]);
      const initData = iface.encodeFunctionData("initialize", [
        deployer.address, "Limited Pass", ["Solo"], [1n], // cap = 1
      ]);
      const tx = await factory2.cloneCampaign("FanPassLogic", initData, deployer.address);
      const receipt = await tx.wait();
      const ev = receipt?.logs
        .map((l) => { try { return factory2.interface.parseLog(l as Parameters<typeof factory2.interface.parseLog>[0]); } catch { return null; } })
        .find((e) => e?.name === "CampaignCreated");
      const clone2 = await ethers.getContractAt("FanPassLogic", ev?.args.clone as string);

      await clone2.connect(fan1).claimPass(fan1.address, 0); // claims the 1 slot
      await expect(
        clone2.connect(fan2).claimPass(fan2.address, 0)
      ).to.be.revertedWithCustomError(clone2, "TierSoldOut");
    });

    it("reverts if event is CLOSED", async function () {
      const { clone, deployer, fan1 } = await deployClone();
      await clone.connect(deployer).closeEvent();
      await expect(
        clone.connect(fan1).claimPass(fan1.address, 0)
      ).to.be.revertedWithCustomError(clone, "WrongState");
    });
  });

  describe("closeEvent (OPEN → CLOSED)", function () {
    it("transitions to CLOSED", async function () {
      const { clone, deployer } = await deployClone();
      await clone.connect(deployer).closeEvent();
      expect(await clone.getState()).to.equal(1n);
    });

    it("emits EventClosed", async function () {
      const { clone, deployer } = await deployClone();
      await expect(clone.connect(deployer).closeEvent())
        .to.emit(clone, "EventClosed");
    });

    it("reverts if called by non-owner", async function () {
      const { clone, fan1 } = await deployClone();
      await expect(
        clone.connect(fan1).closeEvent()
      ).to.be.revertedWithCustomError(clone, "NotOwner");
    });
  });

  describe("getHolderPasses", function () {
    it("returns correct tier indices for a holder", async function () {
      const { clone, fan1 } = await deployClone();
      await clone.connect(fan1).claimPass(fan1.address, 0);
      await clone.connect(fan1).claimPass(fan1.address, 2);
      const passes = await clone.getHolderPasses(fan1.address);
      expect(passes.map(Number)).to.deep.equal([0, 2]);
    });

    it("returns empty array for a holder with no passes", async function () {
      const { clone, fan1 } = await deployClone();
      const passes = await clone.getHolderPasses(fan1.address);
      expect(passes.length).to.equal(0);
    });
  });

  describe("getTierHolders", function () {
    it("returns all holders for a given tier", async function () {
      const { clone, fan1, fan2 } = await deployClone();
      await clone.connect(fan1).claimPass(fan1.address, 0);
      await clone.connect(fan2).claimPass(fan2.address, 0);
      const holders = await clone.getTierHolders(0);
      expect(holders).to.include(fan1.address);
      expect(holders).to.include(fan2.address);
    });
  });
});
