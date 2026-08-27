// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";

/// @title AuctionLogic
/// @notice Fan privilege auction with pledge-based on-chain bid intents.
///         No real token custody — fans record bid amounts on-chain as commitments.
///         Creator closes and selects the winner. Full bid history is on-chain.
///         OPEN → CLOSED → FINALIZED lifecycle.
contract AuctionLogic is Initializable {
    // ─── State Machine ────────────────────────────────────────────────────────
    enum State { OPEN, CLOSED, FINALIZED }

    State   public state;
    address public owner;

    // ─── Auction Data ─────────────────────────────────────────────────────────
    string  public title;
    string  public privilegeDescription; // what is being auctioned
    uint256 public deadline;

    // ─── Bids ─────────────────────────────────────────────────────────────────
    struct Bid {
        uint256 amount;    // declared bid (no real token transferred)
        uint256 timestamp;
    }

    address[] public bidders;
    mapping(address => Bid) private _bids;

    // ─── Result ───────────────────────────────────────────────────────────────
    address public winner;
    uint256 public winningBid;

    // ─── Events ───────────────────────────────────────────────────────────────
    event AuctionInitialized(string title, string privilegeDescription, uint256 deadline);
    event BidPlaced(address indexed bidder, uint256 amount);
    event BidUpdated(address indexed bidder, uint256 oldAmount, uint256 newAmount);
    event AuctionClosed();
    event WinnerSelected(address indexed winner, uint256 winningBid);

    // ─── Errors ───────────────────────────────────────────────────────────────
    error NotOwner();
    error DeadlinePassed();
    error DeadlineNotPassed();
    error BidTooLow();
    error NoBidders();
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
        string calldata _privilegeDescription,
        uint256 _deadline
    ) external initializer {
        require(_owner != address(0), "AuctionLogic: zero owner");
        require(bytes(_title).length > 0, "AuctionLogic: empty title");
        require(_deadline > block.timestamp, "AuctionLogic: deadline in past");

        owner                 = _owner;
        title                 = _title;
        privilegeDescription  = _privilegeDescription;
        deadline              = _deadline;
        state                 = State.OPEN;

        emit AuctionInitialized(_title, _privilegeDescription, _deadline);
    }

    // ─── User Actions ─────────────────────────────────────────────────────────

    /// @notice Place or update a bid pledge on behalf of `bidder`. Called by relayer.
    ///         New bid must be strictly greater than the previous bid.
    /// @param bidder The fan's wallet address
    /// @param amount Declared bid amount (no token transfer — commitment record only)
    function placeBid(address bidder, uint256 amount) external inState(State.OPEN) {
        if (block.timestamp >= deadline) revert DeadlinePassed();
        if (amount == 0) revert BidTooLow();

        Bid storage existing = _bids[bidder];

        if (existing.amount == 0) {
            // First bid from this address
            bidders.push(bidder);
            _bids[bidder] = Bid({ amount: amount, timestamp: block.timestamp });
            emit BidPlaced(bidder, amount);
        } else {
            // Update: must be higher
            if (amount <= existing.amount) revert BidTooLow();
            uint256 old = existing.amount;
            existing.amount    = amount;
            existing.timestamp = block.timestamp;
            emit BidUpdated(bidder, old, amount);
        }
    }

    // ─── Owner Lifecycle ──────────────────────────────────────────────────────

    function closeCampaign() external onlyOwner inState(State.OPEN) {
        if (block.timestamp < deadline) revert DeadlineNotPassed();
        state = State.CLOSED;
        emit AuctionClosed();
    }

    /// @notice Creator selects the winner. Typically the highest bidder,
    ///         but creator can choose any registered bidder for creator-judged auctions.
    function selectWinner(address _winner) external onlyOwner inState(State.CLOSED) {
        if (bidders.length == 0) revert NoBidders();
        require(_bids[_winner].amount > 0, "AuctionLogic: address has not placed a bid");

        winner     = _winner;
        winningBid = _bids[_winner].amount;
        state      = State.FINALIZED;

        emit WinnerSelected(_winner, winningBid);
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    function getBidders() external view returns (address[] memory) {
        return bidders;
    }

    function getBidderCount() external view returns (uint256) {
        return bidders.length;
    }

    function getBid(address bidder) external view returns (uint256 amount, uint256 timestamp) {
        Bid storage b = _bids[bidder];
        return (b.amount, b.timestamp);
    }

    function getDeadline() external view returns (uint256) { return deadline; }
    function getState()    external view returns (State)   { return state; }

    function isWinner(address user) external view inState(State.FINALIZED) returns (bool) {
        return user == winner;
    }

    /// @notice Returns the current highest bidder and their amount (live during OPEN state).
    function getHighestBid() external view returns (address topBidder, uint256 topAmount) {
        for (uint256 i = 0; i < bidders.length; i++) {
            if (_bids[bidders[i]].amount > topAmount) {
                topAmount = _bids[bidders[i]].amount;
                topBidder = bidders[i];
            }
        }
    }
}
