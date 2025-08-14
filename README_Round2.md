# TriX Arena - Blockchain Integration Challenge (Round 2)

This project integrates a complete blockchain economic layer into a real-time, two-player Tic-Tac-Toe game. It features live matchmaking, on-chain token staking via smart contracts, and automated winner payouts.

**Live Demo Link (Frontend Only):** [Your Vercel Link Here]

**Video Demo Link (Full End-to-End Flow):** [Link to your screen-recorded video]

---

## Architecture Overview

The system is composed of four main services that work together:

1.  **On-Chain Contracts (Solidity/Hardhat):** The authoritative source of truth for all value transfers (`GameToken`, `TokenStore`, `PlayGame`).
2.  **API Gateway (Node.js/Express):** A trusted, server-side wallet that is the only entity authorized to perform administrative actions like `createMatch` and `commitResult`. This prevents players from cheating the payout system.
3.  **Matchmaking & Game Server (Node.js/Socket.IO):** A real-time service that manages a queue of waiting players, pairs them based on their stake, manages the live game state (moves, turns), and calls the API Gateway to finalize results.
4.  **Game Frontend (HTML/JS/Ethers.js):** The user-facing client where players connect their wallets, find matches, and interact with the game.

## Key Integration Points & Logic

### 1. Game Source

*   **Game:** A simple, client-side Tic-Tac-Toe game.
*   **Source Reference:** [Provide the GitHub link to the original Tic-Tac-Toe game you used as a base].

### 2. Matchmaking Logic

*   Players connect to the Matchmaking Server via Socket.IO after connecting their wallet.
*   When a player clicks "Find Match", they send their address and desired stake to the server.
*   The server maintains an in-memory queue, grouping waiting players by stake amount (e.g., `waitingPlayers['50'] = [player1, ...]`).
*   If a player joins and another is already waiting at the same stake level, they are instantly paired.
*   The server then generates a unique `matchId` and calls the API Gateway's `/match/start` endpoint to create the match on-chain.

### 3. API & Smart Contract Flow

The integration follows a strict, sequential flow to ensure security and integrity:

1.  **`findMatch` (Frontend -> Matchmaking Server):** User signals intent to play.
2.  **`createMatch` (Matchmaking Server -> API Gateway -> PlayGame.sol):** The backend creates the official on-chain match record.
3.  **`matchFound` (Matchmaking Server -> Frontend):** The server notifies both players that a match is ready and they must stake.
4.  **`approve` (Frontend -> GameToken.sol):** Each player signs a transaction to approve the `PlayGame` contract to spend their GT.
5.  **`stake` (Frontend -> PlayGame.sol):** Each player signs a second transaction to send their stake to the escrow.
6.  **`gameStart` (Matchmaking Server -> Frontend):** Once both `stake` transactions are confirmed (tracked by the server), the game begins.
7.  **`commitResult` (Matchmaking Server -> API Gateway -> PlayGame.sol):** After the game ends, the server authoritatively determines the winner and calls the API to trigger the on-chain payout. The `PlayGame` contract then transfers the 2x stake to the winner.

---

## How to Run Locally

### Prerequisites
*   Node.js (v18+)
*   A web browser with the MetaMask extension.

### 1. Setup
Clone the repo and install dependencies for the root project, the API, and the matchmaking server.
```bash
# In root folder
npm install

# In api/ folder
cd api && npm install && cd ..

# In matchmaking-server/ folder
cd matchmaking-server && npm install && cd ..

# Running the System (Requires 4 Terminals)

## Terminal 1: Start Blockchain Node
```bash
npx hardhat node
```

## Terminal 2: Deploy Contracts
> Run this each time you restart the node to get new addresses and update the config files.
```bash
npx hardhat run scripts/deploy.js --network localhost
```
**After running, copy the new contract addresses and paste them into:**
- `api/.env`
- The config object in `round2-game-final/game.js`
- The config object in `web/index.html` (for buying tokens)

## Terminal 3: Start Backend API
```bash
cd api
node index.js
```

## Terminal 4: Start Matchmaking & Game Server
```bash
cd matchmaking-server
node server.js
```

## Terminal 5: Serve the Game Frontend
```bash
cd round2-game-final
npx serve -l 5000
```

---

# Playing the Game

1. Use the Round 1 UI (`web/index.html`, served separately) to buy **GT** for two different Hardhat accounts.
2. Open **[http://localhost:5000](http://localhost:5000)** in two different browsers (or browser profiles), each with one of the funded Hardhat accounts.
3. Follow the on-screen instructions to find a match and play.
