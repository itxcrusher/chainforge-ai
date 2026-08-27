// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract CampaignFactory is Ownable {
    using Clones for address;

    // ─── Implementation Registry ──────────────────────────────────────────────
    mapping(string => address) public implementations;

    // ─── Campaign Registry ────────────────────────────────────────────────────
    address[] private _campaigns;

    // ─── Attribution (V2) ─────────────────────────────────────────────────────
    /// @notice Maps each clone address to the creator wallet that requested it
    mapping(address => address) public campaignCreator;
    /// @notice Maps each clone address to the template name used to create it
    mapping(address => string)  public campaignTemplate;
    /// @notice Maps each creator wallet to all their campaign clone addresses
    mapping(address => address[]) private _creatorCampaigns;

    // ─── Events ───────────────────────────────────────────────────────────────
    event CampaignCreated(
        address indexed clone,
        address indexed creator,
        string          templateName
    );
    event ImplementationSet(string name, address indexed implementation);

    constructor() Ownable(msg.sender) {}

    // ─── Admin ────────────────────────────────────────────────────────────────

    function setImplementation(string calldata name, address impl) external onlyOwner {
        require(impl != address(0), "CampaignFactory: zero address");
        implementations[name] = impl;
        emit ImplementationSet(name, impl);
    }

    // ─── Clone ────────────────────────────────────────────────────────────────

    /// @notice Deploy a clone of the given template, initialize it, and record attribution.
    /// @param templateName  Name of the registered implementation (e.g. "PredictionLogicV2")
    /// @param initData      ABI-encoded initialize() calldata
    /// @param creator       Wallet to attribute as campaign creator (pass msg.sender from API layer)
    function cloneCampaign(
        string calldata templateName,
        bytes  calldata initData,
        address         creator
    ) external returns (address clone) {
        address impl = implementations[templateName];
        require(impl != address(0), "CampaignFactory: implementation not set");
        require(creator != address(0), "CampaignFactory: zero creator");

        clone = impl.clone();

        (bool success, ) = clone.call(initData);
        require(success, "CampaignFactory: initialization failed");

        _campaigns.push(clone);
        campaignCreator[clone]   = creator;
        campaignTemplate[clone]  = templateName;
        _creatorCampaigns[creator].push(clone);

        emit CampaignCreated(clone, creator, templateName);
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    function getCampaigns() external view returns (address[] memory) {
        return _campaigns;
    }

    function getCampaignCount() external view returns (uint256) {
        return _campaigns.length;
    }

    /// @notice Return all campaign clones created by a specific wallet.
    function getCreatorCampaigns(address creator) external view returns (address[] memory) {
        return _creatorCampaigns[creator];
    }
}
