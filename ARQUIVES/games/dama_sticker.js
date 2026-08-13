const fs = require('fs');
const path = require('path');

const DB_PATH = './DADOS DO corvo/games/dama_sticker/';

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
    const board = Array.from({ length: 8 }, () => Array(8).fill('dark'));
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if ((r + c) % 2 !== 0) {
                if (r < 3) board[r][c] = 'red_piece';
                if (r > 4) board[r][c] = 'white_piece';
            }
        }
    }
    return board;
}

function renderBoardAsImage(board) {
    // Retorna o tabuleiro como texto (já que canvas pode não estar instalado)
    return renderBoardText(board);
}

function renderBoardText(board) {
    let text = '╔════════════════════════════════╗\n';
    const rowEmojis = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣'];
    
    text += '   A  B  C  D  E  F  G  H\n';
    
    for (let r = 0; r < 8; r++) {
        const row = [];
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            switch (piece) {
                case 'white_piece': row.push('⚪'); break;
                case 'red_piece': row.push('🔴'); break;
                case 'white_king': row.push('⬜'); break;
                case 'red_king': row.push('🟥'); break;
                case 'dark': row.push('⬛'); break;
                default: row.push('⬛');
            }
        }
        text += rowEmojis[r] + '  ' + row.join('  ') + '\n';
    }
    text += '╚════════════════════════════════╝';
    return text;
}

// Converte notação tipo "1a" ou "1 a" para coordenadas [linha, coluna]
function parseNotation(notation) {
    notation = notation.toLowerCase().trim().replace(/\s+/g, '');
    if (notation.length < 2) return null;

    const alphaFirst = notation[0].match(/[a-h]/);
    const alphaLast = notation[notation.length - 1].match(/[a-h]/);
    let row, col;

    if (alphaFirst) {
        col = notation[0].charCodeAt(0) - 'a'.charCodeAt(0);
        row = parseInt(notation.slice(1), 10);
    } else if (alphaLast) {
        col = notation[notation.length - 1].charCodeAt(0) - 'a'.charCodeAt(0);
        row = parseInt(notation.slice(0, -1), 10);
    } else {
        return null;
    }

    if (Number.isNaN(row) || row < 0 || row > 7 || col < 0 || col > 7) return null;
    return [row, col];
}

function initGame(id, player1, player2) {
    const game = {
        id,
        players: [player1, player2],
        turn: 0,
        board: createBoard(),
        status: 'playing',
        lastMove: null,
        capturedPieces: [0, 0]
    };
    saveGame(id, game);
    return game;
}

function move(id, player, fromR, fromC, toR, toC) {
    const game = loadGame(id);
    if (!game) return { error: 'Jogo não encontrado.' };
    if (game.status !== 'playing') return { error: 'O jogo já terminou.' };
    if (game.players[game.turn] !== player) return { error: 'Não é sua vez!' };

    // Validar coordenadas
    if (fromR < 0 || fromR > 7 || fromC < 0 || fromC > 7 || toR < 0 || toR > 7 || toC < 0 || toC > 7) {
        return { error: 'Coordenadas fora do tabuleiro!' };
    }

    const piece = game.board[fromR][fromC];
    const playerPiece = game.turn === 0 ? 'white_piece' : 'red_piece';
    const playerKing = game.turn === 0 ? 'white_king' : 'red_king';

    if (piece !== playerPiece && piece !== playerKing) return { error: 'Essa peça não é sua!' };

    const dr = toR - fromR;
    const dc = Math.abs(toC - fromC);

    // Movimento simples (1 casa)
    if (Math.abs(dr) === 1 && dc === 1 && game.board[toR][toC] === 'dark') {
        // Apenas reis podem se mover para trás
        if (piece === 'white_piece' && dr > 0) return { error: 'Peças comuns brancas só movem para frente!' };
        if (piece === 'red_piece' && dr < 0) return { error: 'Peças comuns vermelhas só movem para frente!' };

        game.board[toR][toC] = piece;
        game.board[fromR][fromC] = 'dark';
        
        // Promoção a Dama
        if (toR === 0 && piece === 'white_piece') game.board[toR][toC] = 'white_king';
        if (toR === 7 && piece === 'red_piece') game.board[toR][toC] = 'red_king';

        game.turn = 1 - game.turn;
        saveGame(id, game);
        return { game };
    }

    // Movimento de captura (2 casas)
    if (Math.abs(dr) === 2 && dc === 2 && game.board[toR][toC] === 'dark') {
        const midR = (fromR + toR) / 2;
        const midC = (fromC + toC) / 2;
        const midPiece = game.board[midR][midC];
        const opponentPieces = game.turn === 0 ? ['red_piece', 'red_king'] : ['white_piece', 'white_king'];

        if (opponentPieces.includes(midPiece)) {
            game.board[toR][toC] = piece;
            game.board[fromR][fromC] = 'dark';
            game.board[midR][midC] = 'dark';

            game.capturedPieces[game.turn]++;

            // Promoção a Dama
            if (toR === 0 && piece === 'white_piece') game.board[toR][toC] = 'white_king';
            if (toR === 7 && piece === 'red_piece') game.board[toR][toC] = 'red_king';

            game.turn = 1 - game.turn;
            saveGame(id, game);
            return { game };
        }
    }

    return { error: 'Movimento inválido.' };
}

module.exports = { 
    initGame, 
    loadGame, 
    move, 
    renderBoardAsImage,
    renderBoardText,
    parseNotation,
    saveGame, 
    deleteGame 
};