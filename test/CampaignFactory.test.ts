import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("CampaignFactory", function () {
  async function deployFixture() {
    const [owner, creator, other] = await ethers.getSigners();

    const PredictionLogic = await ethers.getContractFactory("PredictionLogic");
    const predImpl = await PredictionLogic.deploy();
    await predImpl.waitForDeployment();

    const Factory = await ethers.getContractFactory("CampaignFactory");
    const factory = await Factory.deploy();
    await factory.waitForDeployment();

    return { factory, predImpl, owner, creator, other };
  }

  function encodeInitialize(title: string, options: string[], deadline: bigint): string {
    const iface = new ethers.Interface([
      "function initialize(string,string[],uint256)",
    ]);
    return iface.encodeFunctionData("initialize", [title, options, deadline]);
  }

  describe("Deployment", function () {
    it("deploys with owner set", async function () {
      const { factory, owner } = await deployFixture();
      expect(await factory.owner()).to.equal(owner.address);
    });

    it("starts with zero campaigns", async function () {
      const { factory } = await deployFixture();
      expect(await factory.getCampaignCount()).to.equal(0n);
      expect(await factory.getCampaigns()).to.deep.equal([]);
    });
  });

  describe("setImplementation", function () {
    it("registers an implementation address", async function () {
      const { factory, predImpl } = await deployFixture();
      await factory.setImplementation("PredictionLogic", await predImpl.getAddress());
      expect(await factory.implementations("PredictionLogic")).to.equal(
        await predImpl.getAddress()
      );
    });

    it("emits ImplementationSet event", async function () {
      const { factory, predImpl } = await deployFixture();
      await expect(
        factory.setImplementation("PredictionLogic", await predImpl.getAddress())
      )
        .to.emit(factory, "ImplementationSet")
        .withArgs("PredictionLogic", await predImpl.getAddress());
    });

    it("reverts if called by non-owner", async function () {
      const { factory, predImpl, other } = await deployFixture();
      await expect(
        factory.connect(other).setImplementation("PredictionLogic", await predImpl.getAddress())
      ).to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");
    });

    it("reverts if address is zero", async function () {
      const { factory } = await deployFixture();
      await expect(
        factory.setImplementation("PredictionLogic", ethers.ZeroAddress)
      ).to.be.revertedWith("CampaignFactory: zero address");
    });
  });

  describe("cloneCampaign", function () {
    it("creates a clone and stores its address", async function () {
      const { factory, predImpl, creator } = await deployFixture();
      await factory.setImplementation("PredictionLogic", await predImpl.getAddress());

      const deadline = BigInt(await time.latest()) + 86400n;
      const initData = encodeInitialize("the demo league Final", ["Northern Falcons", "Desert Sultans"], deadline);

      await factory.cloneCampaign("PredictionLogic", initData, creator.address);
      expect(await factory.getCampaignCount()).to.equal(1n);
    });

    it("emits CampaignCreated with clone, creator, and templateName", async function () {
      const { factory, predImpl, creator } = await deployFixture();
      await factory.setImplementation("PredictionLogic", await predImpl.getAddress());

      const deadline = BigInt(await time.latest()) + 86400n;
      const initData = encodeInitialize("the demo league Final", ["Northern Falcons", "Desert Sultans"], deadline);

      const tx = await factory.cloneCampaign("PredictionLogic", initData, creator.address);
      const receipt = await tx.wait();
      const log = receipt?.logs.find(
        (l) => factory.interface.parseLog(l as Parameters<typeof factory.interface.parseLog>[0])?.name === "CampaignCreated"
      );
      const parsed = factory.interface.parseLog(log as Parameters<typeof factory.interface.parseLog>[0]);
      expect(parsed?.args.creator).to.equal(creator.address);
      expect(parsed?.args.templateName).to.equal("PredictionLogic");
    });

    it("getCampaigns returns all clones", async function () {
      const { factory, predImpl, creator } = await deployFixture();
      await factory.setImplementation("PredictionLogic", await predImpl.getAddress());

      const deadline = BigInt(await time.latest()) + 86400n;
      const initData = encodeInitialize("the demo league Final", ["Northern Falcons", "Desert Sultans"], deadline);

      await factory.cloneCampaign("PredictionLogic", initData, creator.address);
      await factory.cloneCampaign("PredictionLogic", initData, creator.address);

      const campaigns = await factory.getCampaigns();
      expect(campaigns.length).to.equal(2);
      expect(campaigns[0]).to.not.equal(campaigns[1]);
    });

    it("records campaignCreator mapping", async function () {
      const { factory, predImpl, creator } = await deployFixture();
      await factory.setImplementation("PredictionLogic", await predImpl.getAddress());

      const deadline = BigInt(await time.latest()) + 86400n;
      const initData = encodeInitialize("the demo league Final", ["A", "B"], deadline);

      const tx = await factory.cloneCampaign("PredictionLogic", initData, creator.address);
      const receipt = await tx.wait();
      const log = receipt?.logs.find(
        (l) => factory.interface.parseLog(l as Parameters<typeof factory.interface.parseLog>[0])?.name === "CampaignCreated"
      );
      const parsed = factory.interface.parseLog(log as Parameters<typeof factory.interface.parseLog>[0]);
      const cloneAddress = parsed?.args.clone as string;

      expect(await factory.campaignCreator(cloneAddress)).to.equal(creator.address);
    });

    it("records campaignTemplate mapping", async function () {
      const { factory, predImpl, creator } = await deployFixture();
      await factory.setImplementation("PredictionLogic", await predImpl.getAddress());

      const deadline = BigInt(await time.latest()) + 86400n;
      const initData = encodeInitialize("the demo league Final", ["A", "B"], deadline);

      const tx = await factory.cloneCampaign("PredictionLogic", initData, creator.address);
      const receipt = await tx.wait();
      const log = receipt?.logs.find(
        (l) => factory.interface.parseLog(l as Parameters<typeof factory.interface.parseLog>[0])?.name === "CampaignCreated"
      );
      const parsed = factory.interface.parseLog(log as Parameters<typeof factory.interface.parseLog>[0]);
      const cloneAddress = parsed?.args.clone as string;

      expect(await factory.campaignTemplate(cloneAddress)).to.equal("PredictionLogic");
    });

    it("getCreatorCampaigns returns only that creator's campaigns", async function () {
      const { factory, predImpl, creator, other } = await deployFixture();
      await factory.setImplementation("PredictionLogic", await predImpl.getAddress());

      const deadline = BigInt(await time.latest()) + 86400n;
      const initData = encodeInitialize("the demo league Final", ["A", "B"], deadline);

      await factory.cloneCampaign("PredictionLogic", initData, creator.address);
      await factory.cloneCampaign("PredictionLogic", initData, other.address);
      await factory.cloneCampaign("PredictionLogic", initData, creator.address);

      const creatorCampaigns = await factory.getCreatorCampaigns(creator.address);
      const otherCampaigns   = await factory.getCreatorCampaigns(other.address);

      expect(creatorCampaigns.length).to.equal(2);
      expect(otherCampaigns.length).to.equal(1);
    });

    it("reverts if implementation not registered", async function () {
      const { factory, creator } = await deployFixture();
      const initData = encodeInitialize("Test", ["A", "B"], BigInt(await time.latest()) + 86400n);
      await expect(
        factory.cloneCampaign("PredictionLogic", initData, creator.address)
      ).to.be.revertedWith("CampaignFactory: implementation not set");
    });

    it("reverts if creator is zero address", async function () {
      const { factory, predImpl } = await deployFixture();
      await factory.setImplementation("PredictionLogic", await predImpl.getAddress());
      const initData = encodeInitialize("Test", ["A", "B"], BigInt(await time.latest()) + 86400n);
      await expect(
        factory.cloneCampaign("PredictionLogic", initData, ethers.ZeroAddress)
      ).to.be.revertedWith("CampaignFactory: zero creator");
    });

    it("reverts if initData causes initialize to fail", async function () {
      const { factory, predImpl, creator } = await deployFixture();
      await factory.setImplementation("PredictionLogic", await predImpl.getAddress());
      const badDeadline = BigInt(await time.latest()) - 1n;
      const initData = encodeInitialize("the demo league Final", ["A", "B"], badDeadline);
      await expect(
        factory.cloneCampaign("PredictionLogic", initData, creator.address)
      ).to.be.revertedWith("CampaignFactory: initialization failed");
    });
  });
});
