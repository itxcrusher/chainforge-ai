// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";

/// @title PredictionLogicV2
/// @notice Prediction campaign with full lifecycle: OPEN → CLOSED → REVEALED.
///         Owner (server wallet) controls state transitions.
///         One submission per wallet. Deadline enforced on-chain.
contract PredictionLogicV2 is Initializable {
    // ─── State Machine ────────────────────────────────────────────────────────
    enum State { OPEN, CLOSED, REVEALED }

    State   public state;
    address public owner;

    // ─── Campaign Data ────────────────────────────────────────────────────────
    string   public title;
    string[] public options;
    uint256  public deadline;
    uint256[] public voteCounts;

    // ─── Result ───────────────────────────────────────────────────────────────
    uint256 public winningOption;

    // ─── Per-user ─────────────────────────────────────────────────────────────
    mapping(address => bool)    private _hasVoted;
    mapping(address => uint256) private _userChoice;

    // ─── Events ───────────────────────────────────────────────────────────────
    event CampaignInitialized(string title, string[] options, uint256 deadline);
    event PredictionSubmitted(address indexed user, uint256 optionIndex);
    event CampaignClosed();
    event ResultRevealed(uint256 winningOption);

    // ─── Errors ───────────────────────────────────────────────────────────────
    error NotOwner();
    error DeadlinePassed();
    error DeadlineNotPassed();
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

    /// @param _owner     Server wallet that controls lifecycle transitions
    /// @param _title     Campaign title
    /// @param _options   Prediction options (min 2)
    /// @param _deadline  Unix timestamp — must be in the future
    function initialize(
        address _owner,
        string calldata _title,
        string[] calldata _options,
        uint256 _deadline
    ) external initializer {
        require(_owner != address(0), "PredictionLogicV2: zero owner");
        require(bytes(_title).length > 0, "PredictionLogicV2: empty title");
        require(_options.length >= 2, "PredictionLogicV2: need at least 2 options");
        require(_deadline > block.timestamp, "PredictionLogicV2: deadline in past");

        owner    = _owner;
        title    = _title;
        deadline = _deadline;
        state    = State.OPEN;

        for (uint256 i = 0; i < _options.length; i++) {
            options.push(_options[i]);
            voteCounts.push(0);
        }

        emit CampaignInitialized(_title, _options, _deadline);
    }

    // ─── User Actions ─────────────────────────────────────────────────────────

    /// @notice Submit a prediction on behalf of `voter`.
    ///         Caller is the relayer (pays gas); voter is the end-user.
    ///         One submission per voter address.
    function submitPrediction(address voter, uint256 optionIndex) external inState(State.OPEN) {
        if (block.timestamp >= deadline) revert DeadlinePassed();
        if (_hasVoted[voter]) revert AlreadyVoted();
        if (optionIndex >= options.length) revert InvalidOption();

        _hasVoted[voter]    = true;
        _userChoice[voter]  = optionIndex;
        voteCounts[optionIndex]++;

        emit PredictionSubmitted(voter, optionIndex);
    }

    // ─── Owner Lifecycle ──────────────────────────────────────────────────────

    /// @notice Lock the campaign — no more submissions accepted.
    ///         Can only be called after the deadline has passed.
    function closeCampaign() external onlyOwner inState(State.OPEN) {
        if (block.timestamp < deadline) revert DeadlineNotPassed();
        state = State.CLOSED;
        emit CampaignClosed();
    }

    /// @notice Reveal the winning option index. Transitions to REVEALED.
    function revealResult(uint256 optionIndex) external onlyOwner inState(State.CLOSED) {
        if (optionIndex >= options.length) revert InvalidOption();
        winningOption = optionIndex;
        state         = State.REVEALED;
        emit ResultRevealed(optionIndex);
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
        require(_hasVoted[user], "PredictionLogicV2: user has not voted");
        return _userChoice[user];
    }

    /// @notice Returns true if the user picked the winning option.
    ///         Reverts unless state is REVEALED.
    function isWinner(address user) external view inState(State.REVEALED) returns (bool) {
        if (!_hasVoted[user]) return false;
        return _userChoice[user] == winningOption;
    }

    /// @notice Returns the winning option label.
    ///         Reverts unless state is REVEALED.
    function getWinner() external view inState(State.REVEALED) returns (string memory) {
        return options[winningOption];
    }
}
