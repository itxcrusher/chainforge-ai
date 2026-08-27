// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";

/// @title PointsPoolLogic
/// @notice Reputation-weighted prediction pool. No real token custody.
///         Fans predict an outcome and declare their reputation weight (0–1000).
///         After reveal, the weighted votes for each option are summed on-chain.
///         Correct predictors can claim a multiplier badge recorded on-chain.
///         OPEN → CLOSED → REVEALED lifecycle.
contract PointsPoolLogic is Initializable {
    // ─── State Machine ────────────────────────────────────────────────────────
    enum State { OPEN, CLOSED, REVEALED }

    State   public state;
    address public owner;

    // ─── Campaign Data ────────────────────────────────────────────────────────
    string   public title;
    string[] public options;
    uint256  public deadline;

    // ─── Weighted Voting ─────────────────────────────────────────────────────
    /// @dev Sum of declared weights per option (reputation-weighted votes)
    uint256[] public weightedVotes;
    /// @dev Total raw count per option (unweighted)
    uint256[] public voteCounts;

    // ─── Result ───────────────────────────────────────────────────────────────
    uint256 public winningOption;

    // ─── Per-user ─────────────────────────────────────────────────────────────
    struct Prediction {
        uint256 optionIndex;
        uint256 weight;
    }

    mapping(address => bool)       private _hasPredicted;
    mapping(address => Prediction) private _predictions;

    // ─── Events ───────────────────────────────────────────────────────────────
    event PoolInitialized(string title, string[] options, uint256 deadline);
    event PredictionStaked(address indexed user, uint256 optionIndex, uint256 weight);
    event PoolClosed();
    event ResultRevealed(uint256 winningOption);

    // ─── Errors ───────────────────────────────────────────────────────────────
    error NotOwner();
    error DeadlinePassed();
    error DeadlineNotPassed();
    error AlreadyPredicted();
    error InvalidOption();
    error InvalidWeight();
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

    function initialize(
        address _owner,
        string calldata _title,
        string[] calldata _options,
        uint256 _deadline
    ) external initializer {
        require(_owner != address(0), "PointsPoolLogic: zero owner");
        require(bytes(_title).length > 0, "PointsPoolLogic: empty title");
        require(_options.length >= 2, "PointsPoolLogic: need at least 2 options");
        require(_deadline > block.timestamp, "PointsPoolLogic: deadline in past");

        owner    = _owner;
        title    = _title;
        deadline = _deadline;
        state    = State.OPEN;

        for (uint256 i = 0; i < _options.length; i++) {
            options.push(_options[i]);
            weightedVotes.push(0);
            voteCounts.push(0);
        }

        emit PoolInitialized(_title, _options, _deadline);
    }

    // ─── User Actions ─────────────────────────────────────────────────────────

    /// @notice Stake reputation weight on an outcome. Called by the relayer.
    /// @param user        The fan's wallet address
    /// @param optionIndex The predicted outcome (0-indexed)
    /// @param weight      Declared reputation weight 1–1000 (server-provided, not verified on-chain)
    function stakeWeight(
        address user,
        uint256 optionIndex,
        uint256 weight
    ) external inState(State.OPEN) {
        if (block.timestamp >= deadline) revert DeadlinePassed();
        if (_hasPredicted[user]) revert AlreadyPredicted();
        if (optionIndex >= options.length) revert InvalidOption();
        if (weight == 0 || weight > 1000) revert InvalidWeight();

        _hasPredicted[user] = true;
        _predictions[user]  = Prediction({ optionIndex: optionIndex, weight: weight });

        weightedVotes[optionIndex] += weight;
        voteCounts[optionIndex]++;

        emit PredictionStaked(user, optionIndex, weight);
    }

    // ─── Owner Lifecycle ──────────────────────────────────────────────────────

    function closeCampaign() external onlyOwner inState(State.OPEN) {
        if (block.timestamp < deadline) revert DeadlineNotPassed();
        state = State.CLOSED;
        emit PoolClosed();
    }

    function revealResult(uint256 optionIndex) external onlyOwner inState(State.CLOSED) {
        if (optionIndex >= options.length) revert InvalidOption();
        winningOption = optionIndex;
        state         = State.REVEALED;
        emit ResultRevealed(optionIndex);
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    function getResults()
        external
        view
        returns (string[] memory, uint256[] memory counts, uint256[] memory weighted)
    {
        return (options, voteCounts, weightedVotes);
    }

    function getDeadline() external view returns (uint256) { return deadline; }
    function getState()    external view returns (State)   { return state; }

    function hasPredicted(address user) external view returns (bool) {
        return _hasPredicted[user];
    }

    function getUserPrediction(address user)
        external
        view
        returns (uint256 optionIndex, uint256 weight)
    {
        require(_hasPredicted[user], "PointsPoolLogic: user has not predicted");
        Prediction storage p = _predictions[user];
        return (p.optionIndex, p.weight);
    }

    function isCorrect(address user) external view inState(State.REVEALED) returns (bool) {
        if (!_hasPredicted[user]) return false;
        return _predictions[user].optionIndex == winningOption;
    }

    function getWinnerLabel() external view inState(State.REVEALED) returns (string memory) {
        return options[winningOption];
    }
}
