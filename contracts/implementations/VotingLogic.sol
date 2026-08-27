// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";

contract VotingLogic is Initializable {
    string public title;
    string[] public options;
    uint256 public deadline; // 0 = no cutoff (open voting)
    uint256[] public voteCounts;

    mapping(address => bool) private _hasVoted;
    mapping(address => uint256) private _userChoice;

    event VoteInitialized(string title, string[] options, uint256 deadline);
    event VoteCast(address indexed user, uint256 optionIndex);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        string calldata _title,
        string[] calldata _options,
        uint256 _deadline
    ) external initializer {
        require(bytes(_title).length > 0, "VotingLogic: empty title");
        require(_options.length >= 2, "VotingLogic: need at least 2 options");
        if (_deadline > 0) {
            require(_deadline > block.timestamp, "VotingLogic: deadline in past");
        }

        title = _title;
        deadline = _deadline;

        for (uint256 i = 0; i < _options.length; i++) {
            options.push(_options[i]);
            voteCounts.push(0);
        }

        emit VoteInitialized(_title, _options, _deadline);
    }

    function castVote(uint256 optionIndex) external {
        if (deadline > 0) {
            require(block.timestamp < deadline, "VotingLogic: voting closed");
        }
        require(!_hasVoted[msg.sender], "VotingLogic: already voted");
        require(optionIndex < options.length, "VotingLogic: invalid option");

        _hasVoted[msg.sender] = true;
        _userChoice[msg.sender] = optionIndex;
        voteCounts[optionIndex]++;

        emit VoteCast(msg.sender, optionIndex);
    }

    function getResults() external view returns (string[] memory, uint256[] memory) {
        return (options, voteCounts);
    }

    function getDeadline() external view returns (uint256) {
        return deadline;
    }

    function hasUserVoted(address user) external view returns (bool) {
        return _hasVoted[user];
    }

    function getUserChoice(address user) external view returns (uint256) {
        require(_hasVoted[user], "VotingLogic: user has not voted");
        return _userChoice[user];
    }
}
