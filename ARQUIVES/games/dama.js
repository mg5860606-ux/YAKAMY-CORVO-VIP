const fs = require('fs');
const path = require('path');

const DB_PATH = './DADOS DO corvo/games/dama/';

if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(DB_PATH, { recursive: true });
}

function saveGame(id, data) {
    fs.writeFileSync(path.join(DB_PATH, `${id}.json`), JSON.stringify(data, null, 2));
}

function loadGame(id) {
    const file = path.join(DB_PATH, `${id}.json`);
    if (fs.existsSync(file)) {
        return JSON.parse(fs.readFileSync(file));
    }
    return null;
}

function deleteGame(id) {
    const file = path.join(DB_PATH, `${id}.json`);
    if (fs.existsSync(file)) fs.unlinkSync(file);
}

function createBoard() {
    // Use a full black board theme for the checkerboard.
    const board = Array(8).fill(null).map(() => Array(8).fill('⬛'));
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if ((r + c) % 2 !== 0) {
                if (r < 3) board[r][c] = '🔴';
                if (r > 4) board[r][c] = '⚪';
            }
        }
    }
    return board;
}

function renderBoard(board, game = null) {
    let text = '';
    
    // Cabeçalho com informações dos jogadores
    if (game) {
        const p1Name = game.players[0].split('@')[0] || 'Jogador 1';
        const p2Name = game.players[1].split('@')[0] || 'Jogador 2';
        const currentPlayer = game.turn === 0 ? '⚪' : '🔴';
        const p1Indicator = game.turn === 0 ? '▶️' : '  ';
        const p2Indicator = game.turn === 1 ? '▶️' : '  ';
        
        text += `⚪ ${p1Indicator} @${p1Name}\n`;
        text += `🔴 ${p2Indicator} @${p2Name}\n\n`;
    }
    
    text += '   A  B  C  D  E  F  G  H\n';
    const rowEmojis = ['0', '1', '2', '3', '4', '5', '6', '7'];
    for (let r = 0; r < 8; r++) {
        text += rowEmojis[r] + '  ' + board[r].join('  ') + '\n';
    }
    return text;
}

function initGame(id, player1, player2) {
    const game = {
        id,
        players: [player1, player2],
        turn: 0, // 0 for player1 (White), 1 for player2 (Red)
        board: createBoard(),
        status: 'playing',
        lastMove: null
    };
    saveGame(id, game);
    return game;
}

// Simple move logic (v1 - basic validation)
function move(id, player, fromR, fromC, toR, toC) {
    const game = loadGame(id);
    if (!game) return { error: 'Jogo não encontrado.' };
    if (game.status !== 'playing') return { error: 'O jogo já terminou.' };
    if (game.players[game.turn] !== player) return { error: 'Não é sua vez!' };

    const piece = game.board[fromR][fromC];
    const playerPiece = game.turn === 0 ? '⚪' : '🔴';
    const playerKing = game.turn === 0 ? '⬜' : '🟥'; // Kings

    if (piece !== playerPiece && piece !== playerKing) return { error: 'Essa peça não é sua!' };

    // Basic move validation
    const dr = toR - fromR;
    const dc = Math.abs(toC - fromC);

    // Simple move
    if (Math.abs(dr) === 1 && dc === 1 && game.board[toR][toC] === '⬛') {
        // Only forward for non-kings
        if (piece === '⚪' && dr > 0) return { error: 'Peças comuns só movem para frente!' };
        if (piece === '🔴' && dr < 0) return { error: 'Peças comuns só movem para frente!' };

        game.board[toR][toC] = piece;
        game.board[fromR][fromC] = '⬛';
        
        // Promotion
        if (toR === 0 && piece === '⚪') game.board[toR][toC] = '⬜';
        if (toR === 7 && piece === '🔴') game.board[toR][toC] = '🟥';

        game.turn = 1 - game.turn;
        saveGame(id, game);
        return { game };
    }

    // Capture move
    if (Math.abs(dr) === 2 && dc === 2 && game.board[toR][toC] === '⬛') {
        const midR = (fromR + toR) / 2;
        const midC = (fromC + toC) / 2;
        const midPiece = game.board[midR][midC];
        const opponentPieces = game.turn === 0 ? ['🔴', '🟥'] : ['⚪', '⬜'];

        if (opponentPieces.includes(midPiece)) {
            game.board[toR][toC] = piece;
            game.board[fromR][fromC] = '⬛';
            game.board[midR][midC] = '⬛';

            // Promotion
            if (toR === 0 && piece === '⚪') game.board[toR][toC] = '⬜';
            if (toR === 7 && piece === '🔴') game.board[toR][toC] = '🟥';

            // Check if can jump again (simplified: just change turn for now)
            game.turn = 1 - game.turn;
            saveGame(id, game);
            return { game };
        }
    }

    return { error: 'Movimento inválido.' };
}

module.exports = { initGame, loadGame, move, renderBoard, saveGame, deleteGame };