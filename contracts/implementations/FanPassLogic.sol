// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";

/// @title FanPassLogic
/// @notice Tiered soulbound access pass system. Fans claim passes gaslessly.
///         Passes are non-transferable (soulbound) — prevents scalping.
///         Creator defines tiers with individual supply caps.
///         OPEN → CLOSED lifecycle.
contract FanPassLogic is Initializable {
    // ─── State Machine ────────────────────────────────────────────────────────
    enum State { OPEN, CLOSED }

    State   public state;
    address public owner;

    // ─── Campaign Data ────────────────────────────────────────────────────────
    string public title;

    // ─── Tier System ──────────────────────────────────────────────────────────
    struct Tier {
        string  name;
        uint256 maxSupply; // 0 = unlimited
        uint256 issued;
    }

    Tier[] private _tiers;

    // holder => tier index => has claimed
    mapping(address => mapping(uint256 => bool)) private _hasClaimed;

    // tier index => ordered list of holders
    mapping(uint256 => address[]) private _tierHolders;

    // ─── Events ───────────────────────────────────────────────────────────────
    event FanPassInitialized(string title, uint256 tierCount);
    event PassClaimed(address indexed holder, uint256 indexed tierIndex, string tierName);
    event EventClosed();

    // ─── Errors ───────────────────────────────────────────────────────────────
    error NotOwner();
    error AlreadyClaimed();
    error TierSoldOut();
    error InvalidTier();
    error WrongState(State current, State required);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier inState(State required) {
        if (state != required) revert WrongState(state, required);
        _;
    }

    // ─── Initialization ───────────────────────────────────────────────────────

    /// @param _tierNames      Names for each tier (e.g. ["General", "VIP", "Creators Circle"])
    /// @param _tierMaxSupplies Supply cap per tier (0 = unlimited)
    function initialize(
        address _owner,
        string calldata _title,
        string[] calldata _tierNames,
        uint256[] calldata _tierMaxSupplies
    ) external initializer {
        require(_owner != address(0), "FanPassLogic: zero owner");
        require(bytes(_title).length > 0, "FanPassLogic: empty title");
        require(_tierNames.length >= 1, "FanPassLogic: need at least 1 tier");
        require(
            _tierNames.length == _tierMaxSupplies.length,
            "FanPassLogic: tier arrays length mismatch"
        );

        owner = _owner;
        title = _title;
        state = State.OPEN;

        for (uint256 i = 0; i < _tierNames.length; i++) {
            _tiers.push(Tier({
                name:      _tierNames[i],
                maxSupply: _tierMaxSupplies[i],
                issued:    0
            }));
        }

        emit FanPassInitialized(_title, _tierNames.length);
    }

    // ─── User Actions ─────────────────────────────────────────────────────────

    /// @notice Claim a pass for `holder` in `tierIndex`. Called by the relayer.
    ///         One claim per wallet per tier.
    function claimPass(address holder, uint256 tierIndex) external inState(State.OPEN) {
        if (tierIndex >= _tiers.length) revert InvalidTier();
        if (_hasClaimed[holder][tierIndex]) revert AlreadyClaimed();

        Tier storage tier = _tiers[tierIndex];
        if (tier.maxSupply > 0 && tier.issued >= tier.maxSupply) revert TierSoldOut();

        _hasClaimed[holder][tierIndex] = true;
        tier.issued++;
        _tierHolders[tierIndex].push(holder);

        emit PassClaimed(holder, tierIndex, tier.name);
    }

    // ─── Owner Lifecycle ──────────────────────────────────────────────────────

    function closeEvent() external onlyOwner inState(State.OPEN) {
        state = State.CLOSED;
        emit EventClosed();
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    function getTierCount() external view returns (uint256) {
        return _tiers.length;
    }

    function getTier(uint256 tierIndex)
        external
        view
        returns (string memory name, uint256 maxSupply, uint256 issued)
    {
        require(tierIndex < _tiers.length, "FanPassLogic: invalid tier");
        Tier storage t = _tiers[tierIndex];
        return (t.name, t.maxSupply, t.issued);
    }

    function getState() external view returns (State) { return state; }

    function hasClaimed(address holder, uint256 tierIndex) external view returns (bool) {
        return _hasClaimed[holder][tierIndex];
    }

    function getTierHolders(uint256 tierIndex) external view returns (address[] memory) {
        require(tierIndex < _tiers.length, "FanPassLogic: invalid tier");
        return _tierHolders[tierIndex];
    }

    function getTierHolderCount(uint256 tierIndex) external view returns (uint256) {
        require(tierIndex < _tiers.length, "FanPassLogic: invalid tier");
        return _tierHolders[tierIndex].length;
    }

    /// @notice Returns all tier indices where `holder` holds a pass.
    function getHolderPasses(address holder) external view returns (uint256[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < _tiers.length; i++) {
            if (_hasClaimed[holder][i]) count++;
        }
        uint256[] memory passes = new uint256[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < _tiers.length; i++) {
            if (_hasClaimed[holder][i]) passes[idx++] = i;
        }
        return passes;
    }
}
