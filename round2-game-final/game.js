// --- CONFIGURATION & SETUP ---

// These addresses are copied from your .env file and Round 1 setup.
// They must match the addresses from your `npx hardhat run scripts/deploy.js` output.
const config = {
    USDT_ADDRESS: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    GAMETOKEN_ADDRESS: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
    TOKENSTORE_ADDRESS: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
    PLAYGAME_ADDRESS: "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9"
};
const gameTokenABI = [ "function approve(address spender, uint256 amount) returns (bool)", "function balanceOf(address account) view returns (uint256)" ];
const playGameABI = [ "function stake(bytes32 matchId)" ];

const MATCHMAKING_SERVER_URL = "http://localhost:8000";

// --- GLOBAL STATE VARIABLES ---
let provider, signer, userAddress, socket;
let gameTokenContract, playGameContract;
let currentMatch = {
    matchId: null,
    isMyTurn: false,
    mySymbol: ''
};

// --- DOM ELEMENT REFERENCES ---
const connectWalletBtn = document.getElementById('connect-wallet-btn');
const findMatchBtn = document.getElementById('find-match-btn');
const walletStatusEl = document.getElementById('wallet-status');
const walletAddressEl = document.getElementById('wallet-address');
const gtBalanceEl = document.getElementById('gt-balance');
const gameStatusEl = document.getElementById('game-status');
const proofEl = document.getElementById('proof');
const connectionPanel = document.getElementById('connection-panel');
const matchmakingPanel = document.getElementById('matchmaking-panel');
const gamePanel = document.getElementById('game-panel');
const boardCells = document.querySelectorAll('.cell');

// --- HELPER FUNCTIONS ---

function updateUI(state, message) {
    connectionPanel.classList.add('hidden');
    matchmakingPanel.classList.add('hidden');
    gamePanel.classList.add('hidden');

    if (state === 'connected') {
        matchmakingPanel.classList.remove('hidden');
        connectionPanel.classList.remove('hidden');
        gameStatusEl.textContent = message || "Ready to find a match.";
    } else if (state === 'matchmaking') {
        connectionPanel.classList.remove('hidden');
        matchmakingPanel.classList.remove('hidden');
        findMatchBtn.disabled = true;
        gameStatusEl.textContent = message;
    } else if (state === 'staking') {
        connectionPanel.classList.remove('hidden');
        gamePanel.classList.remove('hidden');
        gameStatusEl.textContent = message;
    } else if (state === 'playing') {
        connectionPanel.classList.remove('hidden');
        gamePanel.classList.remove('hidden');
        gameStatusEl.textContent = message;
    }
}

async function updateBalance() {
    if (!gameTokenContract || !userAddress) return;
    try {
        const balance = await gameTokenContract.balanceOf(userAddress);
        gtBalanceEl.textContent = parseFloat(ethers.utils.formatUnits(balance, 18)).toFixed(2);
    } catch (error) {
        console.error("Could not fetch balance:", error);
    }
}

function drawBoard(boardState) {
    boardState.forEach((symbol, index) => {
        const cell = boardCells[index];
        cell.textContent = symbol;
        cell.className = 'cell'; // Reset classes
        if (symbol === 'X') cell.classList.add('x');
        if (symbol === 'O') cell.classList.add('o');
    });
}

// --- WEB3 & CONTRACT INTERACTIONS ---

async function connectWallet() {
    if (typeof window.ethereum === 'undefined') {
        alert('MetaMask is not installed!');
        return;
    }
    
    try {
        provider = new ethers.providers.Web3Provider(window.ethereum);
        await provider.send("eth_requestAccounts", []);
        signer = provider.getSigner();
        userAddress = await signer.getAddress();

        // Instantiate contracts
        gameTokenContract = new ethers.Contract(config.GAMETOKEN_ADDRESS, gameTokenABI, signer);
        playGameContract = new ethers.Contract(config.PLAYGAME_ADDRESS, playGameABI, signer);

        // Update UI
        walletStatusEl.textContent = 'Connected';
        walletAddressEl.textContent = `${userAddress.substring(0, 6)}...${userAddress.substring(userAddress.length - 4)}`;
        connectWalletBtn.textContent = 'Wallet Connected';
        connectWalletBtn.disabled = true;
        updateUI('connected');
        
        await updateBalance();

        // Connect to matchmaking server AFTER wallet is connected
        connectToSocketServer();

    } catch (error) {
        console.error("Error connecting wallet:", error);
        alert("Failed to connect wallet.");
    }
}

async function handleStake(matchId, stake) {
    try {
        updateUI('staking', 'Please approve the stake amount in MetaMask...');
        const stakeAmount = ethers.utils.parseUnits(stake.toString(), 18);
        const approveTx = await gameTokenContract.approve(config.PLAYGAME_ADDRESS, stakeAmount);
        await approveTx.wait();

        updateUI('staking', 'Approval successful! Please confirm the stake transaction...');
        const matchIdBytes32 = ethers.utils.formatBytes32String(matchId);
        const stakeTx = await playGameContract.stake(matchIdBytes32);
        await stakeTx.wait();
        
        updateUI('staking', 'Stake confirmed! Waiting for opponent...');
        socket.emit('playerStaked', { matchId, playerAddress: userAddress });

    } catch (error) {
        console.error("Staking failed:", error);
        updateUI('connected', `Staking failed: ${error.reason || error.message}. Please try again.`);
    }
}

// --- SOCKET.IO (REAL-TIME) LOGIC ---

function connectToSocketServer() {
    socket = io(MATCHMAKING_SERVER_URL);

    socket.on('connect', () => {
        console.log(`Connected to matchmaking server with ID: ${socket.id}`);
    });

    socket.on('statusUpdate', (message) => {
        gameStatusEl.textContent = message;
    });

    socket.on('matchFound', (data) => {
        console.log("Match found!", data);
        currentMatch.matchId = data.matchId;
        // The first player in the array is always 'X'
        currentMatch.mySymbol = (data.players[0] === userAddress) ? 'X' : 'O';
        handleStake(data.matchId, data.stake);
    });

    socket.on('gameStart', (data) => {
        updateUI('playing');
        drawBoard(Array(9).fill(null)); // Clear board
        currentMatch.isMyTurn = (data.startingPlayer === userAddress);
        gameStatusEl.textContent = currentMatch.isMyTurn ? "Your turn!" : "Opponent's turn.";
    });
    
    socket.on('updateBoard', (data) => {
        drawBoard(data.board);
        // A simple way to check whose turn it is now
        const xMoves = data.board.filter(s => s === 'X').length;
        const oMoves = data.board.filter(s => s === 'O').length;
        
        if (currentMatch.mySymbol === 'X') {
            currentMatch.isMyTurn = xMoves === oMoves;
        } else {
            currentMatch.isMyTurn = xMoves > oMoves;
        }
        gameStatusEl.textContent = currentMatch.isMyTurn ? "Your turn!" : "Opponent's turn.";
    });
    
    socket.on('gameOver', (data) => {
    currentMatch.isMyTurn = false;
    if (data.winner) {
        const message = data.winner === userAddress ? "You won!" : "You lost.";
        gameStatusEl.textContent = message; // Show win/loss message immediately

        // Check if the txHash exists before creating the link
        if (data.txHash) {
            proofEl.innerHTML = `Blockchain Proof: <a href="https://sepolia.etherscan.io/tx/${data.txHash}" target="_blank" style="color: #00ffdd;">View Transaction</a>`;
        } else {
            proofEl.textContent = "Payout processed. Hash not available.";
        }

    } else {
        gameStatusEl.textContent = data.message;
    }
    // Update the balance at the end to show the new total
    setTimeout(updateBalance, 1000); // Small delay to let blockchain update
});
}

// --- EVENT LISTENERS ---

connectWalletBtn.addEventListener('click', connectWallet);

findMatchBtn.addEventListener('click', () => {
    if (!signer) {
        alert("Please connect your wallet first.");
        return;
    }
    const stake = document.getElementById('stake-amount').value;
    if (!stake || stake <= 0) {
        alert("Please enter a valid stake amount.");
        return;
    }
    updateUI('matchmaking', "Searching for an opponent...");
    socket.emit('findMatch', { address: userAddress, stake });
});

boardCells.forEach(cell => {
    cell.addEventListener('click', () => {
        if (cell.textContent !== '' || !currentMatch.isMyTurn || !currentMatch.matchId) {
            return; // Cell is taken or not your turn
        }
        const index = cell.getAttribute('data-index');
        socket.emit('gameMove', { matchId: currentMatch.matchId, index });
        currentMatch.isMyTurn = false; // Prevent double-clicking
        gameStatusEl.textContent = "Opponent's turn.";
    });
});