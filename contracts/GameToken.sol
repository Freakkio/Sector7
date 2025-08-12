// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract GameToken is ERC20, Ownable {
    address public tokenStore;

    event Minted(address to, uint256 amount);

    constructor() ERC20("Game Token", "GT") Ownable(msg.sender) {}

    function setTokenStore(address _tokenStore) public onlyOwner {
        tokenStore = _tokenStore;
    }

    function mint(address to, uint256 amount) public {
        require(msg.sender == tokenStore, "Caller is not the TokenStore");
        _mint(to, amount);
        emit Minted(to, amount);
    }
}