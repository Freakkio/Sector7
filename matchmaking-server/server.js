const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// The API Gateway from Round 1
const API_GATEWAY_URL = 'http://localhost:3000'; 

// In-memory store for players waiting for a match
const waitingPlayers = {}; // e.g., { "50": [{ id: "socketId", address: "0x..." }] }
// In-memory store for active games
const activeGames = {}; // e.g., { "matchId-123": { p1, p2, turn, board } }

io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    socket.on('findMatch', async (data) => {
        const { address, stake } = data;
        console.log(`Player ${address} is looking for a match with stake ${stake}`);

        if (!waitingPlayers[stake] || waitingPlayers[stake].length === 0) {
            waitingPlayers[stake] = [{ id: socket.id, address }];
            socket.emit('statusUpdate', 'Waiting for an opponent...');
            return;
        }

        const p1 = waitingPlayers[stake].pop();
        const p2 = { id: socket.id, address };
        const matchId = uuidv4().substring(0, 31);

        try {
            const response = await fetch(`${API_GATEWAY_URL}/match/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ matchId, p1: p1.address, p2: p2.address, stake })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'API request failed');
            
            console.log(`Match ${matchId} created on-chain. TX: ${result.txHash}`);

            const p1Socket = io.sockets.sockets.get(p1.id);
            if (p1Socket) p1Socket.join(matchId);
            socket.join(matchId);

            activeGames[matchId] = {
                players: [p1, p2],
                board: Array(9).fill(null),
                turn: p1.id,
                p1_staked: false,
                p2_staked: false,
            };
            
            io.to(matchId).emit('matchFound', { matchId, players: [p1.address, p2.address], stake });
        } catch (error) {
            console.error("Error creating match on-chain:", error);
            if (waitingPlayers[stake]) {
              waitingPlayers[stake].push(p1);
            } else {
              waitingPlayers[stake] = [p1];
            }
            socket.emit('statusUpdate', 'Error creating match. Please try again.');
        }
    });

    socket.on('playerStaked', ({ matchId, playerAddress }) => {
        const game = activeGames[matchId];
        if (!game) return;
        
        if (game.players[0].address === playerAddress) game.p1_staked = true;
        if (game.players[1].address === playerAddress) game.p2_staked = true;

        if (game.p1_staked && game.p2_staked) {
            console.log(`Both players staked for match ${matchId}. Starting game.`);
            io.to(matchId).emit('gameStart', { startingPlayer: game.players[0].address });
        }
    });

    socket.on('gameMove', ({ matchId, index }) => {
        const game = activeGames[matchId];
        if (!game || game.turn !== socket.id) return;

        const symbol = game.players[0].id === socket.id ? 'X' : 'O';
        game.board[index] = symbol;
        game.turn = game.players.find(p => p.id !== socket.id).id;
        
        io.to(matchId).emit('updateBoard', { board: game.board });
        
        const winnerSymbol = checkWinner(game.board);
        if (winnerSymbol) {
            const winnerPlayer = game.players.find(p => (game.players[0].id === p.id ? 'X' : 'O') === winnerSymbol);
            handleGameOver(matchId, winnerPlayer.address);
        } else if (game.board.every(cell => cell)) {
            handleGameOver(matchId, null);
        }
    });

    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        for (const stake in waitingPlayers) {
            waitingPlayers[stake] = waitingPlayers[stake].filter(p => p.id !== socket.id);
        }
    });
});

function checkWinner(board) {
    const lines = [ [0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6] ];
    for (let line of lines) {
        const [a, b, c] = line;
        if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
    }
    return null;
}

async function handleGameOver(matchId, winnerAddress) {
    if (!winnerAddress) {
        io.to(matchId).emit('gameOver', { winner: null, message: "It's a draw! Stakes will be refunded." });
        // Here you would call an API endpoint to trigger the refund function on-chain
        return;
    }

    console.log(`Game over for ${matchId}. Winner: ${winnerAddress}`);

    try {
        const response = await fetch(`${API_GATEWAY_URL}/match/result`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ matchId, winner: winnerAddress })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'API request failed');

        io.to(matchId).emit('gameOver', { winner: winnerAddress, txHash: result.txHash });
        console.log(`Payout successful for ${matchId}. TX: ${result.txHash}`);
    } catch (error) {
        console.error("Error committing result:", error);
        io.to(matchId).emit('gameOver', { winner: null, message: "Error processing payout." });
    }
    delete activeGames[matchId];
}

const PORT = 8000;
server.listen(PORT, () => console.log(`Matchmaking & Game server running on port ${PORT}`));