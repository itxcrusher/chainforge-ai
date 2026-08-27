// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";

/// @title TournamentLogic
/// @notice Multi-round bracket prediction with cumulative on-chain scoring.
///         Creator adds rounds and finalizes each. Fans predict per round.
///         Scores accumulate across rounds — one season-level leaderboard.
///         State: ACTIVE (rounds open/finalized iteratively) → COMPLETED.
contract TournamentLogic is Initializable {
    // ─── State Machine ────────────────────────────────────────────────────────
    enum State { ACTIVE, COMPLETED }

    State   public state;
    address public owner;

    // ─── Tournament Data ─────────────────────────────────────────────────────
    string  public title;
    uint256 public currentRound; // 0-indexed; fans predict round `currentRound`

    // ─── Round Structure ──────────────────────────────────────────────────────
    struct Round {
        string   description;    // e.g. "the demo league Quarter Final — 14 April"
        string[] options;        // match outcomes fans can predict
        uint256  deadline;       // fans must predict before this
        bool     finalized;      // true after creator reveals correct option
        uint256  correctOption;  // set when finalized
        uint256[] voteCounts;
    }

    Round[] private _rounds;

    // ─── Per-user Scoring ─────────────────────────────────────────────────────
    /// @dev fan => round index => option predicted (only valid if _hasPredictedRound is true)
    mapping(address => mapping(uint256 => uint256)) private _roundPredictions;
    mapping(address => mapping(uint256 => bool))    private _hasPredictedRound;

    /// @dev Cumulative correct prediction count per fan across all finalized rounds
    mapping(address => uint256) public score;

    // ─── Events ───────────────────────────────────────────────────────────────
    event TournamentInitialized(string title);
    event RoundAdded(uint256 roundIndex, string description, uint256 deadline);
    event PredictionSubmitted(address indexed user, uint256 roundIndex, uint256 optionIndex);
    event RoundFinalized(uint256 roundIndex, uint256 correctOption);
    event TournamentCompleted();

    // ─── Errors ───────────────────────────────────────────────────────────────
    error NotOwner();
    error InvalidRound();
    error DeadlinePassed();
    error DeadlineNotPassed();
    error RoundAlreadyFinalized();
    error RoundNotFinalized();
    error AlreadyPredicted();
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

    function initialize(
        address _owner,
        string calldata _title
    ) external initializer {
        require(_owner != address(0), "TournamentLogic: zero owner");
        require(bytes(_title).length > 0, "TournamentLogic: empty title");

        owner = _owner;
        title = _title;
        state = State.ACTIVE;

        emit TournamentInitialized(_title);
    }

    // ─── Owner: Round Management ──────────────────────────────────────────────

    /// @notice Add a new round that fans can predict.
    function addRound(
        string calldata _description,
        string[] calldata _options,
        uint256 _deadline
    ) external onlyOwner inState(State.ACTIVE) {
        require(_options.length >= 2, "TournamentLogic: need at least 2 options");
        require(_deadline > block.timestamp, "TournamentLogic: deadline in past");

        uint256 roundIndex = _rounds.length;
        Round storage r = _rounds.push();
        r.description    = _description;
        r.deadline       = _deadline;
        r.finalized      = false;
        r.correctOption  = 0;

        for (uint256 i = 0; i < _options.length; i++) {
            r.options.push(_options[i]);
            r.voteCounts.push(0);
        }

        emit RoundAdded(roundIndex, _description, _deadline);
    }

    /// @notice Finalize a round — reveal the correct option and award scores.
    function finalizeRound(uint256 roundIndex, uint256 correctOption) external onlyOwner inState(State.ACTIVE) {
        if (roundIndex >= _rounds.length) revert InvalidRound();
        Round storage r = _rounds[roundIndex];
        if (r.finalized) revert RoundAlreadyFinalized();
        if (block.timestamp < r.deadline) revert DeadlineNotPassed();
        if (correctOption >= r.options.length) revert InvalidOption();

        r.finalized     = true;
        r.correctOption = correctOption;

        // Advance currentRound pointer if needed
        if (roundIndex == currentRound) {
            currentRound++;
        }

        emit RoundFinalized(roundIndex, correctOption);
    }

    /// @notice Mark the entire tournament as completed. No more rounds can be added.
    function completeTournament() external onlyOwner inState(State.ACTIVE) {
        state = State.COMPLETED;
        emit TournamentCompleted();
    }

    // ─── User Actions ─────────────────────────────────────────────────────────

    /// @notice Submit a prediction for the given round. Called by the relayer.
    function submitPrediction(
        address user,
        uint256 roundIndex,
        uint256 optionIndex
    ) external inState(State.ACTIVE) {
        if (roundIndex >= _rounds.length) revert InvalidRound();
        Round storage r = _rounds[roundIndex];
        if (r.finalized) revert RoundAlreadyFinalized();
        if (block.timestamp >= r.deadline) revert DeadlinePassed();
        if (_hasPredictedRound[user][roundIndex]) revert AlreadyPredicted();
        if (optionIndex >= r.options.length) revert InvalidOption();

        _hasPredictedRound[user][roundIndex] = true;
        _roundPredictions[user][roundIndex]  = optionIndex;
        r.voteCounts[optionIndex]++;

        emit PredictionSubmitted(user, roundIndex, optionIndex);
    }

    /// @notice Claim score credit for a finalized round. Anyone can call for any user.
    ///         Score is awarded only once per user per round.
    function claimRoundScore(address user, uint256 roundIndex) external {
        if (roundIndex >= _rounds.length) revert InvalidRound();
        Round storage r = _rounds[roundIndex];
        if (!r.finalized) revert RoundNotFinalized();
        if (!_hasPredictedRound[user][roundIndex]) return; // no prediction — nothing to claim

        // Only award if correct and not yet awarded (we mark with a sentinel)
        // We repurpose _hasPredictedRound as claimed-flag after finalization
        // by using a separate mapping below.
        // For gas efficiency: score is awarded only once.
        if (_roundPredictions[user][roundIndex] == r.correctOption) {
            // Check we haven't awarded already — use a high sentinel bit
            // We store whether the score was claimed by checking score delta.
            // Simpler: track claimed separately.
            score[user]++;
        }
        // Clear the prediction to prevent double-claim
        _hasPredictedRound[user][roundIndex] = false;
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    function getRoundCount() external view returns (uint256) {
        return _rounds.length;
    }

    function getRound(uint256 roundIndex)
        external
        view
        returns (
            string memory description,
            string[] memory options,
            uint256 deadline,
            bool finalized,
            uint256 correctOption,
            uint256[] memory voteCounts
        )
    {
        require(roundIndex < _rounds.length, "TournamentLogic: invalid round");
        Round storage r = _rounds[roundIndex];
        return (r.description, r.options, r.deadline, r.finalized, r.correctOption, r.voteCounts);
    }

    function getState() external view returns (State) { return state; }

    function hasPredictedRound(address user, uint256 roundIndex) external view returns (bool) {
        return _hasPredictedRound[user][roundIndex];
    }

    function getRoundPrediction(address user, uint256 roundIndex) external view returns (uint256) {
        require(_hasPredictedRound[user][roundIndex], "TournamentLogic: no prediction for this round");
        return _roundPredictions[user][roundIndex];
    }

    function getScore(address user) external view returns (uint256) {
        return score[user];
    }
}
