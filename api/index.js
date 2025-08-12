const express = require('express');
const { ethers } = require('ethers');
require('dotenv').config();

const app = express();
app.use(express.json());

// --- Setup Ethers ---
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.BACKEND_PRIVATE_KEY, provider);

// --- Contract ABIs (Application Binary Interfaces) ---
// After compiling, you can find these in 'artifacts/contracts/...'
const playGameABI = require('../artifacts/contracts/PlayGame.sol/PlayGame.json').abi;

// --- Contract Instances ---
const playGameContract = new ethers.Contract(process.env.PLAYGAME_ADDRESS, playGameABI, wallet);

// --- API Endpoints ---
app.get('/', (req, res) => {
    res.send('Backend API is running!');
});

app.post('/match/start', async (req, res) => {
    const { matchId, p1, p2, stake } = req.body;
    if (!matchId || !p1 || !p2 || !stake) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        // Hardhat/Ethers v6 uses formatBytes32String
        const matchIdBytes32 = ethers.encodeBytes32String(matchId);
        const stakeAmount = ethers.parseUnits(stake.toString(), 18); // GT has 18 decimals

        const tx = await playGameContract.createMatch(matchIdBytes32, p1, p2, stakeAmount);
        console.log(`Creating match ${matchId}... TX hash: ${tx.hash}`);
        await tx.wait();
        console.log(`Match ${matchId} created successfully.`);

        res.status(201).json({ message: 'Match created successfully', matchId: matchId, txHash: tx.hash });
    } catch (error) {
        console.error("Error creating match:", error);
        res.status(500).json({ error: 'Failed to create match', details: error.message });
    }
});

app.post('/match/result', async (req, res) => {
    const { matchId, winner } = req.body;
    if (!matchId || !winner) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const matchIdBytes32 = ethers.encodeBytes32String(matchId);
        
        const tx = await playGameContract.commitResult(matchIdBytes32, winner);
        console.log(`Committing result for ${matchId}... TX hash: ${tx.hash}`);
        await tx.wait();
        console.log(`Result for ${matchId} committed successfully.`);
        
        res.status(200).json({ message: 'Result committed successfully', winner: winner, txHash: tx.hash });
    } catch (error) {
        console.error("Error committing result:", error);
        res.status(500).json({ error: 'Failed to commit result', details: error.message });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`API server running on port ${PORT}`);
    console.log(`Backend operator address: ${wallet.address}`);
});