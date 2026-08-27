// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";

/// @title RaffleLogic
/// @notice Prize draw / giveaway campaign. Fans enter once per wallet (gasless).
///         Creator closes after deadline, then selects winner on-chain using
///         block-hash entropy. OPEN → CLOSED → REVEALED lifecycle.
contract RaffleLogic is Initializable {
    // ─── State Machine ────────────────────────────────────────────────────────
    enum State { OPEN, CLOSED, REVEALED }

    State   public state;
    address public owner;

    // ─── Campaign Data ────────────────────────────────────────────────────────
    string  public title;
    string  public prizeDescription;
    uint256 public deadline;

    // ─── Participants ─────────────────────────────────────────────────────────
    address[] public participants;
    mapping(address => bool) private _hasEntered;

    // ─── Result ───────────────────────────────────────────────────────────────
    address public winner;

    // ─── Events ───────────────────────────────────────────────────────────────
    event RaffleInitialized(string title, string prizeDescription, uint256 deadline);
    event ParticipantEntered(address indexed participant);
    event RaffleClosed();
    event WinnerSelected(address indexed winner);

    // ─── Errors ───────────────────────────────────────────────────────────────
    error NotOwner();
    error DeadlinePassed();
    error DeadlineNotPassed();
    error AlreadyEntered();
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
        string calldata _prizeDescription,
        uint256 _deadline
    ) external initializer {
        require(_owner != address(0), "RaffleLogic: zero owner");
        require(bytes(_title).length > 0, "RaffleLogic: empty title");
        require(_deadline > block.timestamp, "RaffleLogic: deadline in past");

        owner            = _owner;
        title            = _title;
        prizeDescription = _prizeDescription;
        deadline         = _deadline;
        state            = State.OPEN;

        emit RaffleInitialized(_title, _prizeDescription, _deadline);
    }

    // ─── User Actions ─────────────────────────────────────────────────────────

    /// @notice Enter the raffle on behalf of `participant`. Called by the relayer.
    function enter(address participant) external inState(State.OPEN) {
        if (block.timestamp >= deadline) revert DeadlinePassed();
        if (_hasEntered[participant]) revert AlreadyEntered();

        _hasEntered[participant] = true;
        participants.push(participant);

        emit ParticipantEntered(participant);
    }

    // ─── Owner Lifecycle ──────────────────────────────────────────────────────

    function closeCampaign() external onlyOwner inState(State.OPEN) {
        if (block.timestamp < deadline) revert DeadlineNotPassed();
        state = State.CLOSED;
        emit RaffleClosed();
    }

    /// @notice Select a winner using block-hash entropy. Transitions to REVEALED.
    function selectWinner() external onlyOwner inState(State.CLOSED) {
        if (participants.length == 0) revert NoParticipants();

        uint256 seed = uint256(
            keccak256(
                abi.encodePacked(
                    blockhash(block.number - 1),
                    block.timestamp,
                    participants.length
                )
            )
        );
        uint256 winnerIndex = seed % participants.length;
        winner = participants[winnerIndex];
        state  = State.REVEALED;

        emit WinnerSelected(winner);
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    function getParticipants() external view returns (address[] memory) {
        return participants;
    }

    function getParticipantCount() external view returns (uint256) {
        return participants.length;
    }

    function hasEntered(address participant) external view returns (bool) {
        return _hasEntered[participant];
    }

    function getDeadline() external view returns (uint256) { return deadline; }
    function getState()    external view returns (State)   { return state; }

    function isWinner(address user) external view inState(State.REVEALED) returns (bool) {
        return user == winner;
    }
}
