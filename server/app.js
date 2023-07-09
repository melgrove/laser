const { WebSocketServer } = require('ws');
const { nanoid }  = require("nanoid");
require('dotenv').config();
const colors = "wb";

/** 
 * Server data model
 */
const games = {}
/*
key: id
val: {
    fen: string,
    turn: "w" | "b",
    times: [number, number], // white ms, black ms
    increments: [number, number], // white ms, black ms
    lastMove: string | null,
    lastMoveTime: string | null,
    name: [string | null, string | null], // white, black
    key: [string | null, string | null], // white, black
    wsIDs: [string | null, string | null], // white, black
}
*/
const serverClock = {}
/*
key: id
val: Promise which tracks the running clock and ends the game on expiration
*/
const serverClockRejections = {}
/*
key: id
val: Promise rejector function for rejecting the previous running clock promise
*/

/** 
 * Web socket http server
 */
const wss = new WebSocketServer({ port: process.env.PORT ?? 4321 });
wss.on('connection', function connection(ws) {
    // Add unique ID to client
    ws.id = nanoid();

    ws.on('error', console.error);

    ws.on('message', makeMessageHandler(ws));
});

/** 
 * Socket message handler
 */
function makeMessageHandler(ws) {
    return (data) => {
        // Catch all errors and don't crash node
        try {
            const body = JSON.parse(data);
            switch (body.messageType) {
                case "create":
                    // Block scope
                    {
                        const nameValidationError = isNameInvalid(body.data.name);
                        if(nameValidationError) {
                            ws.send(makeMessage(nameValidationError));
                            break;
                        }
                        // Name validated
                        const gameID = nanoid();
                        const playerKey = nanoid();
                        const gameData = {
                            fen: body.data.fen,
                            turn: "b",
                            times: body.data.times,
                            increments: body.data.increments ?? [0, 0],
                            lastMove: null,
                            lastMoveTime: null,
                            name: [null, null],
                            key: [null, null],
                            wsIDs: [null, null]
                        };
                        const colorIndex = body.data.color === "w" ? 0 : 1;
                        gameData.name[colorIndex] = body.data.name;
                        gameData.key[colorIndex] = playerKey;
                        gameData.wsIDs[colorIndex] = ws.id;
                        games[gameID] = gameData;
                        // Send successful create response
                        ws.send(makeMessage("created", {
                            key: gameData.key[colorIndex],
                            id: gameID,
                        }));
                        // Send new game data to all clients
                        wss.clients.forEach(client => client.send(makeMessage("games", {
                            games: getGames(games),
                            nConnections: getNConnections(),
                        })));
                    }
                    break;
                case "join":
                    // Block scope
                    {
                        const nameValidationError = isNameInvalid(body.data.name);
                        if(nameValidationError) {
                            ws.send(makeMessage(nameValidationError));
                            break;
                        }
                        const game = games[body.data.id];
                        // Validity check
                        if(game && game.name.includes(null) && !game.name.includes(body.data.name)) {
                            const colorIndex = game.name.indexOf(null);
                            const creatorColorIndex = colorIndex === 0 ? 1 : 0;
                            // Now check if the game creator is still connected
                            if(!Array.from(wss.clients).map(c => c.id).includes(game.wsIDs[creatorColorIndex])) {
                                // Not found
                                ws.send(makeMessage("notFound"));
                                // Remove game
                                delete games[body.data.id];
                                // Send new game data to all clients (disconnected game has been removed)
                                wss.clients.forEach(client => client.send(makeMessage("games", {
                                    games: getGames(games),
                                    nConnections: getNConnections(),
                                })));
                                break;
                            }
                            game.name[colorIndex] = body.data.name;
                            game.key[colorIndex] = nanoid();
                            game.wsIDs[colorIndex] = ws.id;
                            
                            // Send to challenger
                            ws.send(makeMessage("joined", {
                                fen: game.fen,
                                key: game.key[colorIndex],
                                id: body.data.id,
                                names: game.name,
                                times: game.times,
                                index: colorIndex,
                                color: colors[colorIndex],
                            }));
                            // Send to game creator
                            let gameCreatorWsConnection = getOpponentConn(game, creatorColorIndex);
                            gameCreatorWsConnection.send(makeMessage("joined", {
                                fen: game.fen,
                                key: game.key[creatorColorIndex],
                                id: body.data.id,
                                names: game.name,
                                times: game.times,
                                index: creatorColorIndex,
                                color: colors[creatorColorIndex],
                            }));

                            // Start internal clock
                            game.lastMoveTime = Date.now();
                            startInternalClock(body.data.id, "w", ws, gameCreatorWsConnection) // white wins on initial expiration

                            // Send new game data to all clients (joined game is not longer present)
                            wss.clients.forEach(client => client.send(makeMessage("games", {
                                games: getGames(games),
                                nConnections: getNConnections(),
                            })));
                        } else {
                            ws.send(makeMessage("notFound"));
                        }
                    }
                    break;
                case "move":
                    // Block scope
                    {
                        // validate them
                        let { key, id, name, fen, move } = body.data
                        // Game must exist and the secret key must be correct
                        if(games[id] && games[id]?.key[games[id]?.name.indexOf(name)] === key) {
                            // validated
                            const colorIndex = games[id]?.name.indexOf(name);
                            const game = games[id];
                            const opponentColorIndex = colorIndex === 0 ? 1 : 0;
                            const opponentWsConnection = getOpponentConn(game, opponentColorIndex);
                            // make sure it's their turn 
                            if(game.turn === colors[colorIndex]) {
                                // Calculate the time spent on the move and update the time
                                game.times[colorIndex] = game.times[colorIndex] - (Date.now() - game.lastMoveTime) + game.increments[colorIndex];
                                game.lastMoveTime = Date.now();
                                // Set the internal clock for the newly moved player
                                // turn of the just-moved player wins if the next to move player runs out of time
                                startInternalClock(id, game.turn, ws, opponentWsConnection) 
                                
                                // Now the move will be made
                                game.fen = fen;
                                game.turn =  (game.turn === "w" ? "b" : "w");
                                game.lastMove = move;
                                
                                // Send to mover
                                ws.send(makeMessage("moved", {
                                    times: game.times,
                                    move
                                }));
                                // Send to other player
                                opponentWsConnection.send(makeMessage("moved", {
                                    times: game.times,
                                    move
                                }));
                            } else {
                                // Not the player's turn
                                ws.send(makeMessage("notYourMove"));
                            }
                        } else {
                            // either game doesn't exist, name key combination doesn't match, or it's over
                            ws.send(makeMessage("invalid"))         
                        }
                    }
                    break;
                case "games":
                    // Block scope
                    {
                        ws.send(makeMessage("games", {
                            games: getGames(games),
                            nConnections: getNConnections(),
                        }));
                    }
                    break;
                case "end":
                    // Block scope
                    {
                        let { key, id, name, isDraw = false } = body.data;
                        // Game must exist and the secret key must be correct
                        if(games[id] && games[id]?.key[games[id]?.name.indexOf(name)] === key) {
                            // validated
                            const game = games[id];
                            const colorIndex = games[id]?.name.indexOf(name);
                            // Implicit resign, draw if specified
                            const winner = isDraw ? "d" : (colorIndex === 0 ? "b" : "w")
                            // Send result
                            const opponentConn = getOpponentConn(game, colorIndex === 0 ? 1 : 0); // Undefined if ended game has not started
                            broadcastResult(winner, game.times, ws, opponentConn);
                            // Delete game
                            if(serverClockRejections[id]) {
                                serverClockRejections[id]();
                            }
                            delete serverClock[id];
                            delete serverClockRejections[id];
                            delete games[id];

                            // Send new game data to all clients (ended game has been removed)
                            wss.clients.forEach(client => client.send(makeMessage("games", {
                                games: getGames(games),
                                nConnections: getNConnections(),
                            })));
                        } else {
                            // either game doesn't exist or name key combination doesn't match
                            ws.send(makeMessage("invalid"));      
                        }
                    }
                    break;
            }
        } catch(err) {
            console.error(err);
            // pass on and don't crash the server!
        }
    };
}


/** 
 * Helper functions
 */

function makeMessage(status, data) {
    const responseObject = { status };
    if(data !== undefined) {
        responseObject.data = data;
    }
    return JSON.stringify(responseObject);
}

function getGames(games) {
    return Object.entries(games)
        .filter(g => (g[1].name[0] === null || g[1].name[1] === null))
        .map(game => {
            const gameID = game[0]
            // Prevent mutation
            const gameCopy = Object.assign({}, game[1]);
            delete gameCopy.key;
            delete gameCopy.wsIDs;
            gameCopy.id = gameID;
            return gameCopy;
        });
}

function getNConnections() {
    return wss.clients.size;
}

function isNameInvalid(name) {
    if(typeof name !== "string" || name.length < 1) {
        return "noName";
    }
    // Name cannot match a name in existing games that have not started
    if(Object.values(games)
    .filter(g => g.name.some(n => n === null))
    .reduce((acc, el) => [...acc, ...el.name], [])
    .includes(name)) {
        return "nameTaken";
    }
    return false;
}

function broadcastResult(winner, times, conn1, conn2) {
    // Send to winner
    conn1.send(makeMessage("gameOver", { winner, times }));
    // Send to loser
    if(conn2) {
        conn2.send(makeMessage("gameOver", { winner, times }));
    }
}

function getOpponentConn(game, opponentIndex) {
    return Array.from(wss.clients).filter(client => client.id === game.wsIDs[opponentIndex])[0];
}

function startInternalClock(id, winnerOnClockExpiration, playerConn, opponentConn) {
    // Reject the old promise clock if it exists
    if(id in serverClock) {
        serverClockRejections[id]();
    }
    const loserOnClockExpirationIndex = winnerOnClockExpiration === "b" ? 0 : 1;
    serverClock[id] = new Promise((resolve, reject) => {
        // Save rejection function for above
        serverClockRejections[id] = reject;
        // Resolve after time is out
        setTimeout(() => {
            resolve(winnerOnClockExpiration);
        }, games[id].times[loserOnClockExpirationIndex]) // Use time of who wouldn't win on expiration
    })
    // End game
    .then(winningColor => {
        games[id].times[loserOnClockExpirationIndex] = 0;
        broadcastResult(winningColor, games[id].times, playerConn, opponentConn);
        // Delete game
        delete serverClock[id];
        delete serverClockRejections[id];
        delete games[id];
    })
    // Catch old clock rejection
    .catch(() => {}); // Do nothing
}