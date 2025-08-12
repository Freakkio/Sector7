# Blockchain Gaming Platform - Technical Assessment

This project is a full-stack decentralized application for a gaming platform. It was built for the Sector Seven technical assessment and includes smart contracts for a game token (GT) and match escrow, a backend API, a modern web frontend, and an event-driven leaderboard.

---

## Features

-   **Smart Contracts (Solidity/Hardhat)**:
    -   `GameToken.sol`: ERC-20 token (GT) with 18 decimals.
    -   `TokenStore.sol`: On-ramp to buy GT with a mock USDT (6 decimals).
    -   `PlayGame.sol`: Escrow and payout logic for 1v1 matches.
    -   Security: Implements Reentrancy Guard and Owner-only access controls.
-   **Backend API (Node.js/Express/Ethers.js)**:
    -   Provides admin endpoints to `createMatch` and `commitResult`.
    -   Connects to the blockchain using a `.env` file for configuration.
-   **Frontend (HTML/JS/Ethers.js)**:
    -   Modern, responsive UI with light/dark mode.
    -   Connects to MetaMask to act as different users.
    -   Allows users to buy GT and stake in matches.
    -   Allows an admin to manage matches through the backend API.
-   **Leaderboard (Node.js/SQLite)**:
    -   A standalone service that listens for `Settled` events on the `PlayGame` contract.
    -   Maintains an in-memory SQLite database of player stats.
    -   Serves the top 10 players via a `/leaderboard` API endpoint.

---

## How to Run Locally

### Prerequisites

-   Node.js (v18+)
-   A web browser with the MetaMask extension installed.

### 1. Initial Setup

Clone the repository and install the root dependencies.

```bash
# In the root project folder (Sector7-Assessment/)
npm install