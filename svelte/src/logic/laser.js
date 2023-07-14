import { Chess } from 'chess.js'

const files = "abcdefgh";
const fileLookup = Object.fromEntries(files.split("").map((e, i) => [e, i + 1]));
const diagonalChangeCoords = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
const horizontalVerticalChangeCoords = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const knightChangeCoords = [[-2, -1], [-2, 1], [-1, 2], [1, 2], [2, 1], [2, -1], [1, -2], [-1, -2]];

export const whiteWinSquares = ["h8", "h7", "h6", "h5", "g8", "f8", "e8"];
export const blackWinSquares = ["a1", "a2", "a3", "a4", "b1", "c1", "d1"];

function squareTranslation(initial, XYChange) {
    const x = fileLookup[initial[0]];
    const y = parseInt(initial[1]);
    const newY = y + XYChange[1];
    const newX = files[x + XYChange[0] - 1];
    if(newY <= 8 && newY >= 1 && newX !== undefined) {
        return newX + newY;
    } else {
        return null;
    }
}

function addToMap(map, key, val) {
    if(map.get(key)) {
        map.set(key, [...map.get(key), val]);
    } else {
        map.set(key, [val]);
    }
}

export function getLegalMoves(fen) {
    const dests = new Map();
    // Invalid FENs allowed because this is fired right before end of game
    // and on premoves
    const position = new Chess(fen, true);
    const squareLookup = Object.fromEntries(position.board()
        .reduce((acc, el) => [...acc, ...el], [])
        .filter(e => e !== null)
        .map(e => [e.square, e]));

    for(let square in squareLookup) {
        const piece = squareLookup[square];
        // Only find for current player turn
        if(piece.color !== position.turn()) continue;
        switch (piece.type) {
            // Rook, Knight, and King have the same move mechanics as chess
            // Standard Rook
            case "r":
                for(let direction of horizontalVerticalChangeCoords) {
                    let currentPos = squareTranslation(square, direction);
                    while(currentPos !== null) {
                        if(currentPos in squareLookup) {
                            if(squareLookup[currentPos].color !== position.turn()) {
                                addToMap(dests, square, currentPos);
                            }
                            break;
                        }
                        addToMap(dests, square, currentPos);
                        currentPos = squareTranslation(currentPos, direction);
                    }
                }
                break;
            // Standard knight
            case "n":
                knightChangeCoords
                    .map(e => squareTranslation(square, e))
                    .filter(e => e !== null && (!(e in squareLookup) || squareLookup[e].color !== position.turn()))
                    .forEach(e => addToMap(dests, square, e));
                break;
            // Standard king allowing moving into check
            case "k":
                [...diagonalChangeCoords, ...horizontalVerticalChangeCoords]
                    .map(e => squareTranslation(square, e))
                    .filter(e => e !== null && (!(e in squareLookup) || squareLookup[e].color !== position.turn()))
                    .forEach(e => addToMap(dests, square, e));
                break;
            // Pawns have inverted moving / capturing
            case "p":
                // Diagonals
                diagonalChangeCoords
                    .map(e => squareTranslation(square, e))
                    .filter(e => e !== null && !(e in squareLookup))
                    .forEach(e => addToMap(dests, square, e));
                
                // Verticals and horizontals
                horizontalVerticalChangeCoords
                    .map(e => squareTranslation(square, e))
                    .filter(e => e !== null && e in squareLookup && squareLookup[e].color !== position.turn())
                    .forEach(e => addToMap(dests, square, e));
                
                break;
            // Laser moves like a rook but cannot take pieces, and shoots down the diagonal
            case "q":
                // Rook moves without taking
                for(let direction of horizontalVerticalChangeCoords) {
                    let currentPos = squareTranslation(square, direction);
                    while(currentPos !== null && !(currentPos in squareLookup)) {
                        addToMap(dests, square, currentPos);
                        currentPos = squareTranslation(currentPos, direction);
                    }
                }
                // Diagonal laser moves
                for(let direction of diagonalChangeCoords) {
                    let prevPos = square;
                    let currentPos = squareTranslation(square, direction);
                    let validDirection = false;
                    while(currentPos !== null && squareLookup[currentPos]?.type !== "r") {
                        validDirection = true;
                        prevPos = currentPos;
                        currentPos = squareTranslation(currentPos, direction);
                    }
                    if(validDirection) {
                        const squaresBetween = getSquaresBetween(square, prevPos)
                        addToMap(dests, square, prevPos);
                        // Add laser squares that all have the same effect
                        // TODO: make the piece go the full distance
                        //squaresBetween.forEach(e => {
                        //    addToMap(dests, square, e);
                        //})
                    }
                }
            break;

        }
    }
    return dests;
}

export function getResult(fen) {
    // Need to allow invalid fen for analysis board result
    const position = new Chess(fen, true);
    const squareLookup = Object.fromEntries(position.board()
        .reduce((acc, el) => [...acc, ...el], [])
        .filter(e => e !== null)
        .map(e => [e.square, e]));

    // Check for win condition
    let kings = new Set();
    for(let square in squareLookup) {
        if(squareLookup[square].type === "k") {
            kings.add(squareLookup[square].color);
        }
    }
    // both kings lasered at same time
    if(kings.size === 0) {
        return "d";
    }
    if(!kings.has("w")) {
        return "b";
    }
    if(!kings.has("b")) {
        return "w";
    }
    
    // Pawn reached other side
    for(let square of whiteWinSquares) {
        const piece = squareLookup[square];
        if(piece?.type === "p" && piece?.color === "w") {
            return "w";
        }
    }
    for(let square of blackWinSquares) {
        const piece = squareLookup[square];
        if(piece?.type === "p" && piece?.color === "b") {
            return "b";
        }
    }

    // Insufficient material check
    const squareValues = Object.values(squareLookup);
    if(squareValues.length <= 3) {
        // We know that there are two kings, so if a knight exists it's over
        if(squareValues.length === 2 || squareValues.map(piece => piece.type).includes("n")) {
            return "d";
        }
    }

    // No 3 fold check for internal board

    return null;
}

export function getSquaresBetween(orig, dest) {
    const squares = [];
    const origX = fileLookup[orig[0]];
    const origY = parseInt(orig[1]);
    const destX = fileLookup[dest[0]];
    const destY = parseInt(dest[1]);
    const signX = destX > origX ? 1 : -1;
    const signY = destY > origY ? 1 : -1;
    const direction = [signX, signY];
    let newSquare = squareTranslation(orig, direction);
    while(newSquare !== dest) {
        squares.push(newSquare);
        newSquare = squareTranslation(newSquare, direction);
    }
    return squares;
}