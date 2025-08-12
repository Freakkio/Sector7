const express = require('express');
const ethers = require('ethers');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../api/.env') }); // Find .env in the api folder

const app = express();
// In-memory database is fine for this assessment
const db = new sqlite3.Database(':memory:');

console.log("Setting up leaderboard database...");
// --- Database Setup ---
db.serialize(() => {
    db.run("CREATE TABLE leaderboard (address TEXT PRIMARY KEY, wins INTEGER NOT NULL, totalGTWon TEXT NOT NULL, matchesPlayed INTEGER NOT NULL)");
    console.log("Database table created.");
});

// --- Ethers Setup ---
if (!process.env.RPC_URL || !process.env.PLAYGAME_ADDRESS) {
    console.error("Missing RPC_URL or PLAYGAME_ADDRESS in the .env file. Make sure the path is correct.");
    process.exit(1);
}

const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
const playGameABI = [
    "event Settled(bytes32 indexed matchId, address indexed winner, uint256 payout)"
];
const playGameContract = new ethers.Contract(process.env.PLAYGAME_ADDRESS, playGameABI, provider);

// --- Event Listener ---
console.log(`Listening for 'Settled' events on contract: ${process.env.PLAYGAME_ADDRESS}`);
playGameContract.on("Settled", (matchId, winner, payout, event) => {
    const gtWon = ethers.utils.formatUnits(payout, 18);
    console.log(`EVENT DETECTED: Winner ${winner} won ${gtWon} GT`);

    db.serialize(() => {
        // Use INSERT OR IGNORE and UPDATE to handle both new and existing players
        db.run(`INSERT OR IGNORE INTO leaderboard (address, wins, totalGTWon, matchesPlayed) VALUES (?, 0, '0', 0)`, [winner], (err) => {
            if(err) return console.error("DB Insert Error:", err);
            
            // Get current total winnings, add new winnings, then update
            db.get(`SELECT totalGTWon FROM leaderboard WHERE address = ?`, [winner], (err, row) => {
                 if(err) return console.error("DB Select Error:", err);

                 const currentWinnings = ethers.BigNumber.from(ethers.utils.parseUnits(row.totalGTWon, 18));
                 const newTotalWinnings = currentWinnings.add(payout);

                 db.run(
                    `UPDATE leaderboard SET wins = wins + 1, totalGTWon = ?, matchesPlayed = matchesPlayed + 1 WHERE address = ?`,
                    [ethers.utils.formatUnits(newTotalWinnings, 18), winner],
                    (updateErr) => {
                        if (updateErr) return console.error("DB Update Error:", updateErr.message);
                        console.log(`Leaderboard updated for ${winner}.`);
                    }
                );
            });
        });
    });
});

// --- API Endpoint ---
app.get('/leaderboard', (req, res) => {
    // We order by casting totalGTWon to a number for correct sorting
    db.all("SELECT address, wins, totalGTWon, matchesPlayed FROM leaderboard ORDER BY CAST(totalGTWon AS REAL) DESC LIMIT 10", [], (err, rows) => {
        if (err) {
            res.status(500).json({ "error": err.message });
            return;
        }
        res.json({
            leaderboard: rows
        });
    });
});

const PORT = 4000;
app.listen(PORT, () => {
    console.log(`Leaderboard API server running on http://localhost:${PORT}`);
});