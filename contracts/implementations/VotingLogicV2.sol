// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";

/// @title VotingLogicV2
/// @notice Fan vote campaign with lifecycle: OPEN → CLOSED.
///         Optional deadline (0 = no cutoff). Owner closes manually.
///         Votes are public — no winning option designation.
contract VotingLogicV2 is Initializable {
    // ─── State Machine ────────────────────────────────────────────────────────
    enum State { OPEN, CLOSED }

    State   public state;
    address public owner;

    // ─── Campaign Data ────────────────────────────────────────────────────────
    string    public title;
    string[]  public options;
    uint256   public deadline; // 0 = no cutoff
    uint256[] public voteCounts;

    // ─── Per-user ─────────────────────────────────────────────────────────────
    mapping(address => bool)    private _hasVoted;
    mapping(address => uint256) private _userChoice;

    // ─── Events ───────────────────────────────────────────────────────────────
    event VoteInitialized(string title, string[] options, uint256 deadline);
    event VoteCast(address indexed user, uint256 optionIndex);
    event CampaignClosed();

    // ─── Errors ───────────────────────────────────────────────────────────────
    error NotOwner();
    error VotingClosed();
    error AlreadyVoted();
    error InvalidOption();
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

    /// @param _owner    Server wallet that controls lifecycle
    /// @param _title    Campaign title
    /// @param _options  Vote options (min 2)
    /// @param _deadline Unix timestamp cutoff, or 0 for open-ended
    function initialize(
        address _owner,
        string calldata _title,
        string[] calldata _options,
        uint256 _deadline
    ) external initializer {
        require(_owner != address(0), "VotingLogicV2: zero owner");
        require(bytes(_title).length > 0, "VotingLogicV2: empty title");
        require(_options.length >= 2, "VotingLogicV2: need at least 2 options");
        if (_deadline > 0) {
            require(_deadline > block.timestamp, "VotingLogicV2: deadline in past");
        }

        owner    = _owner;
        title    = _title;
        deadline = _deadline;
        state    = State.OPEN;

        for (uint256 i = 0; i < _options.length; i++) {
            options.push(_options[i]);
            voteCounts.push(0);
        }

        emit VoteInitialized(_title, _options, _deadline);
    }

    // ─── User Actions ─────────────────────────────────────────────────────────

    /// @notice Cast a vote on behalf of `voter`.
    ///         Caller is the relayer (pays gas); voter is the end-user.
    ///         One vote per voter address.
    function castVote(address voter, uint256 optionIndex) external inState(State.OPEN) {
        if (deadline > 0 && block.timestamp >= deadline) revert VotingClosed();
        if (_hasVoted[voter]) revert AlreadyVoted();
        if (optionIndex >= options.length) revert InvalidOption();

        _hasVoted[voter]   = true;
        _userChoice[voter] = optionIndex;
        voteCounts[optionIndex]++;

        emit VoteCast(voter, optionIndex);
    }

    // ─── Owner Lifecycle ──────────────────────────────────────────────────────

    /// @notice Close the campaign — no more votes accepted.
    function closeCampaign() external onlyOwner inState(State.OPEN) {
        state = State.CLOSED;
        emit CampaignClosed();
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    function getResults() external view returns (string[] memory, uint256[] memory) {
        return (options, voteCounts);
    }

    function getDeadline() external view returns (uint256) {
        return deadline;
    }

    function getState() external view returns (State) {
        return state;
    }

    function hasUserVoted(address user) external view returns (bool) {
        return _hasVoted[user];
    }

    function getUserChoice(address user) external view returns (uint256) {
        require(_hasVoted[user], "VotingLogicV2: user has not voted");
        return _userChoice[user];
    }
}
