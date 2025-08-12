// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./GameToken.sol";
import "./USDT.sol";

contract TokenStore is ReentrancyGuard, Ownable {
    USDT public usdt;
    GameToken public gameToken;
    uint256 public gtPerUsdt;

    event Purchase(address indexed buyer, uint256 usdtAmount, uint256 gtOut);

    constructor(address _usdt, address _gameToken, uint256 _gtPerUsdt) Ownable(msg.sender) {
        usdt = USDT(_usdt);
        gameToken = GameToken(_gameToken);
        gtPerUsdt = _gtPerUsdt;
    }

    function buy(uint256 usdtAmount) external nonReentrant {
        require(usdtAmount > 0, "Must provide USDT");

        // Calculate GT to mint
        // Note: USDT has 6 decimals, GT has 18.
        // gtOut = usdtAmount * 1e18 / 1e6
        uint256 gtOut = (usdtAmount * gtPerUsdt) / (10**usdt.decimals());

        // Pull USDT (Checks-Effects-Interactions Pattern)
        // This will fail if the user hasn't approved the TokenStore to spend their USDT
        usdt.transferFrom(msg.sender, address(this), usdtAmount);

        // Mint GT to the buyer
        gameToken.mint(msg.sender, gtOut);

        emit Purchase(msg.sender, usdtAmount, gtOut);
    }

    function withdrawUSDT(address to, uint256 amount) external onlyOwner {
        require(usdt.balanceOf(address(this)) >= amount, "Insufficient USDT balance");
        usdt.transfer(to, amount);
    }

    function setRate(uint256 _newRate) external onlyOwner {
        gtPerUsdt = _newRate;
    }
}