// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./GameToken.sol";

contract PlayGame is ReentrancyGuard, Ownable {
    GameToken public gameToken;
    address public operator; // Backend address

    enum MatchStatus { Created, Staked, Settled, Refunded }

    struct Match {
        address p1;
        address p2;
        uint256 stake;
        MatchStatus status;
        bool p1_staked;
        bool p2_staked;
        uint256 startTime;
        uint256 settleTime;
    }

    mapping(bytes32 => Match) public matches;
    uint256 public constant REFUND_TIMEOUT = 24 hours;

    event MatchCreated(bytes32 indexed matchId, address p1, address p2, uint256 stake);
    event Staked(bytes32 indexed matchId, address player);
    event Settled(bytes32 indexed matchId, address winner, uint256 payout);
    event Refunded(bytes32 indexed matchId);

    constructor(address _gameToken, address _operator) Ownable(msg.sender) {
        gameToken = GameToken(_gameToken);
        operator = _operator;
    }

    function createMatch(bytes32 matchId, address p1, address p2, uint256 stake) external onlyOwner {
        require(matches[matchId].stake == 0, "Match already exists");
        require(p1 != address(0) && p2 != address(0) && p1 != p2, "Invalid players");
        require(stake > 0, "Stake must be positive");

        matches[matchId] = Match({
            p1: p1,
            p2: p2,
            stake: stake,
            status: MatchStatus.Created,
            p1_staked: false,
            p2_staked: false,
            startTime: 0,
            settleTime: 0
        });

        emit MatchCreated(matchId, p1, p2, stake);
    }

    function stake(bytes32 matchId) external nonReentrant {
        Match storage currentMatch = matches[matchId];
        require(currentMatch.status == MatchStatus.Created, "Match not in Created state");
        require(msg.sender == currentMatch.p1 || msg.sender == currentMatch.p2, "Not a player");

        if (msg.sender == currentMatch.p1) {
            require(!currentMatch.p1_staked, "Already staked");
            currentMatch.p1_staked = true;
        } else {
            require(!currentMatch.p2_staked, "Already staked");
            currentMatch.p2_staked = true;
        }
        
        // Pull GT from player
        gameToken.transferFrom(msg.sender, address(this), currentMatch.stake);
        emit Staked(matchId, msg.sender);

        if (currentMatch.p1_staked && currentMatch.p2_staked) {
            currentMatch.status = MatchStatus.Staked;
            currentMatch.startTime = block.timestamp;
        }
    }

    function commitResult(bytes32 matchId, address winner) external nonReentrant {
        require(msg.sender == operator, "Only operator can commit");
        Match storage currentMatch = matches[matchId];
        require(currentMatch.status == MatchStatus.Staked, "Match not Staked");
        require(winner == currentMatch.p1 || winner == currentMatch.p2, "Invalid winner");

        currentMatch.status = MatchStatus.Settled;
        currentMatch.settleTime = block.timestamp;

        uint256 payout = currentMatch.stake * 2;
        gameToken.transfer(winner, payout);
        
        emit Settled(matchId, winner, payout);
    }

    function refund(bytes32 matchId) external nonReentrant {
        Match storage currentMatch = matches[matchId];
        require(currentMatch.status == MatchStatus.Staked, "Match not in Staked state");
        require(block.timestamp >= currentMatch.startTime + REFUND_TIMEOUT, "Timeout not reached");

        currentMatch.status = MatchStatus.Refunded;
        
        if (currentMatch.p1_staked) {
            gameToken.transfer(currentMatch.p1, currentMatch.stake);
        }
        if (currentMatch.p2_staked) {
            gameToken.transfer(currentMatch.p2, currentMatch.stake);
        }
        
        emit Refunded(matchId);
    }
    
    function setOperator(address _newOperator) external onlyOwner {
        operator = _newOperator;
    }
}