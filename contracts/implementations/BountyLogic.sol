// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";

/// @title BountyLogic
/// @notice Creator-curated challenge. Fans register intent to participate (one per wallet).
///         Creator reviews off-chain and finalizes winner(s) on-chain.
///         OPEN → CLOSED → FINALIZED lifecycle.
///         Deadline is optional — pass 0 for creator-controlled close.
contract BountyLogic is Initializable {
    // ─── State Machine ────────────────────────────────────────────────────────
    enum State { OPEN, CLOSED, FINALIZED }

    State   public state;
    address public owner;

    // ─── Campaign Data ────────────────────────────────────────────────────────
    string  public title;
    string  public challengeDescription;
    uint256 public deadline; // 0 = no deadline, creator closes manually

    // ─── Participants ─────────────────────────────────────────────────────────
    address[] public participants;
    mapping(address => bool) private _hasRegistered;

    // ─── Winners ──────────────────────────────────────────────────────────────
    address[] public winners;
    mapping(address => bool) private _isWinner;

    // ─── Events ───────────────────────────────────────────────────────────────
    event BountyInitialized(string title, string challengeDescription, uint256 deadline);
    event ParticipantRegistered(address indexed participant);
    event BountyClosed();
    event WinnersFinalized(address[] winners);

    // ─── Errors ───────────────────────────────────────────────────────────────
    error NotOwner();
    error DeadlinePassed();
    error AlreadyRegistered();
    error NoParticipants();
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
        string calldata _challengeDescription,
        uint256 _deadline
    ) external initializer {
        require(_owner != address(0), "BountyLogic: zero owner");
        require(bytes(_title).length > 0, "BountyLogic: empty title");

        owner                = _owner;
        title                = _title;
        challengeDescription = _challengeDescription;
        deadline             = _deadline;
        state                = State.OPEN;

        emit BountyInitialized(_title, _challengeDescription, _deadline);
    }

    // ─── User Actions ─────────────────────────────────────────────────────────

    /// @notice Register participation intent on behalf of `participant`. Called by relayer.
    function register(address participant) external inState(State.OPEN) {
        if (deadline > 0 && block.timestamp >= deadline) revert DeadlinePassed();
        if (_hasRegistered[participant]) revert AlreadyRegistered();

        _hasRegistered[participant] = true;
        participants.push(participant);

        emit ParticipantRegistered(participant);
    }

    // ─── Owner Lifecycle ──────────────────────────────────────────────────────

    /// @notice Creator closes the challenge. Can be called at any time.
    function closeCampaign() external onlyOwner inState(State.OPEN) {
        state = State.CLOSED;
        emit BountyClosed();
    }

    /// @notice Creator finalizes winner(s) on-chain. Transitions to FINALIZED.
    function finalizeWinners(address[] calldata _winners) external onlyOwner inState(State.CLOSED) {
        if (participants.length == 0) revert NoParticipants();

        for (uint256 i = 0; i < _winners.length; i++) {
            address w = _winners[i];
            if (!_isWinner[w]) {
                _isWinner[w] = true;
                winners.push(w);
            }
        }

        state = State.FINALIZED;
        emit WinnersFinalized(_winners);
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    function getParticipants() external view returns (address[] memory) {
        return participants;
    }

    function getParticipantCount() external view returns (uint256) {
        return participants.length;
    }

    function hasRegistered(address participant) external view returns (bool) {
        return _hasRegistered[participant];
    }

    function getWinners()  external view returns (address[] memory) { return winners; }
    function getDeadline() external view returns (uint256) { return deadline; }
    function getState()    external view returns (State)   { return state; }

    function isWinner(address user) external view returns (bool) {
        return _isWinner[user];
    }
}
