// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";

/// @title SurveyLogic
/// @notice Open-ended fan survey — no deadline enforced in contract.
///         Creator closes manually. Lifecycle: OPEN → CLOSED.
///         Use for post-match sentiment, preference surveys, open fan votes.
contract SurveyLogic is Initializable {
    // ─── State Machine ────────────────────────────────────────────────────────
    enum State { OPEN, CLOSED }

    State   public state;
    address public owner;

    // ─── Campaign Data ────────────────────────────────────────────────────────
    string    public title;
    string[]  public options;
    uint256[] public voteCounts;

    // ─── Per-user ─────────────────────────────────────────────────────────────
    mapping(address => bool)    private _hasResponded;
    mapping(address => uint256) private _userChoice;

    // ─── Events ───────────────────────────────────────────────────────────────
    event SurveyInitialized(string title, string[] options);
    event ResponseSubmitted(address indexed user, uint256 optionIndex);
    event SurveyClosed();

    // ─── Errors ───────────────────────────────────────────────────────────────
    error NotOwner();
    error SurveyIsNotOpen();
    error AlreadyResponded();
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
    /// @param _title    Survey title
    /// @param _options  Response options (min 2)
    /// @notice No deadline parameter — surveys are always-open until closed by owner
    function initialize(
        address _owner,
        string calldata _title,
        string[] calldata _options
    ) external initializer {
        require(_owner != address(0), "SurveyLogic: zero owner");
        require(bytes(_title).length > 0, "SurveyLogic: empty title");
        require(_options.length >= 2, "SurveyLogic: need at least 2 options");

        owner = _owner;
        title = _title;
        state = State.OPEN;

        for (uint256 i = 0; i < _options.length; i++) {
            options.push(_options[i]);
            voteCounts.push(0);
        }

        emit SurveyInitialized(_title, _options);
    }

    // ─── User Actions ─────────────────────────────────────────────────────────

    /// @notice Submit a survey response on behalf of `voter`.
    ///         Caller is the relayer (pays gas); voter is the end-user.
    ///         One response per voter address.
    function submitResponse(address voter, uint256 optionIndex) external inState(State.OPEN) {
        if (_hasResponded[voter]) revert AlreadyResponded();
        if (optionIndex >= options.length) revert InvalidOption();

        _hasResponded[voter] = true;
        _userChoice[voter]   = optionIndex;
        voteCounts[optionIndex]++;

        emit ResponseSubmitted(voter, optionIndex);
    }

    // ─── Owner Lifecycle ──────────────────────────────────────────────────────

    /// @notice Close the survey — no more responses accepted.
    function closeSurvey() external onlyOwner inState(State.OPEN) {
        state = State.CLOSED;
        emit SurveyClosed();
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    function getResults() external view returns (string[] memory, uint256[] memory) {
        return (options, voteCounts);
    }

    function getState() external view returns (State) {
        return state;
    }

    /// @notice Returns 0 — surveys have no deadline. Present for API consistency.
    function getDeadline() external pure returns (uint256) {
        return 0;
    }

    function hasUserResponded(address user) external view returns (bool) {
        return _hasResponded[user];
    }

    function getUserChoice(address user) external view returns (uint256) {
        require(_hasResponded[user], "SurveyLogic: user has not responded");
        return _userChoice[user];
    }
}
