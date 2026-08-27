// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";

/// @title QuizLogic
/// @notice Trivia / knowledge-test campaign. Fans submit one answer per wallet.
///         Creator reveals the correct option after deadline. Scores recorded on-chain.
///         OPEN → CLOSED → REVEALED lifecycle.
contract QuizLogic is Initializable {
    // ─── State Machine ────────────────────────────────────────────────────────
    enum State { OPEN, CLOSED, REVEALED }

    State   public state;
    address public owner;

    // ─── Campaign Data ────────────────────────────────────────────────────────
    string   public title;
    string[] public options;
    uint256  public deadline;
    uint256[] public answerCounts;

    // ─── Result ───────────────────────────────────────────────────────────────
    uint256 public correctOption;

    // ─── Per-user ─────────────────────────────────────────────────────────────
    mapping(address => bool)    private _hasAnswered;
    mapping(address => uint256) private _userAnswer;

    // ─── Events ───────────────────────────────────────────────────────────────
    event QuizInitialized(string title, string[] options, uint256 deadline);
    event AnswerSubmitted(address indexed user, uint256 optionIndex);
    event QuizClosed();
    event AnswerRevealed(uint256 correctOption);

    // ─── Errors ───────────────────────────────────────────────────────────────
    error NotOwner();
    error DeadlinePassed();
    error DeadlineNotPassed();
    error AlreadyAnswered();
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
        string calldata _title,
        string[] calldata _options,
        uint256 _deadline
    ) external initializer {
        require(_owner != address(0), "QuizLogic: zero owner");
        require(bytes(_title).length > 0, "QuizLogic: empty title");
        require(_options.length >= 2, "QuizLogic: need at least 2 options");
        require(_deadline > block.timestamp, "QuizLogic: deadline in past");

        owner    = _owner;
        title    = _title;
        deadline = _deadline;
        state    = State.OPEN;

        for (uint256 i = 0; i < _options.length; i++) {
            options.push(_options[i]);
            answerCounts.push(0);
        }

        emit QuizInitialized(_title, _options, _deadline);
    }

    // ─── User Actions ─────────────────────────────────────────────────────────

    /// @notice Submit an answer on behalf of `user`. Called by the relayer.
    function submitAnswer(address user, uint256 optionIndex) external inState(State.OPEN) {
        if (block.timestamp >= deadline) revert DeadlinePassed();
        if (_hasAnswered[user]) revert AlreadyAnswered();
        if (optionIndex >= options.length) revert InvalidOption();

        _hasAnswered[user]          = true;
        _userAnswer[user]           = optionIndex;
        answerCounts[optionIndex]++;

        emit AnswerSubmitted(user, optionIndex);
    }

    // ─── Owner Lifecycle ──────────────────────────────────────────────────────

    function closeCampaign() external onlyOwner inState(State.OPEN) {
        if (block.timestamp < deadline) revert DeadlineNotPassed();
        state = State.CLOSED;
        emit QuizClosed();
    }

    /// @notice Reveal the correct answer index. Transitions to REVEALED.
    function revealAnswer(uint256 optionIndex) external onlyOwner inState(State.CLOSED) {
        if (optionIndex >= options.length) revert InvalidOption();
        correctOption = optionIndex;
        state         = State.REVEALED;
        emit AnswerRevealed(optionIndex);
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    function getResults() external view returns (string[] memory, uint256[] memory) {
        return (options, answerCounts);
    }

    function getDeadline() external view returns (uint256) { return deadline; }
    function getState()    external view returns (State)   { return state; }

    function hasUserAnswered(address user) external view returns (bool) {
        return _hasAnswered[user];
    }

    function getUserAnswer(address user) external view returns (uint256) {
        require(_hasAnswered[user], "QuizLogic: user has not answered");
        return _userAnswer[user];
    }

    /// @notice Returns true if the user answered correctly.
    ///         Reverts unless state is REVEALED.
    function isCorrect(address user) external view inState(State.REVEALED) returns (bool) {
        if (!_hasAnswered[user]) return false;
        return _userAnswer[user] == correctOption;
    }

    function getCorrectOptionLabel() external view inState(State.REVEALED) returns (string memory) {
        return options[correctOption];
    }
}
