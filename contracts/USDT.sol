// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract USDT is ERC20 {
    constructor() ERC20("Mock USDT", "USDT") {
        _mint(msg.sender, 1_000_000 * 10**6); // Mint 1M USDT to deployer
    }

    // USDT has 6 decimals
    function decimals() public view virtual override returns (uint8) {
        return 6;
    }
}