const { WebSocketServer } = require('ws');
const { nanoid }  = require("nanoid");

const colors = "wb";
// Server data model
const games = {}
/*
key: id
val: {
    fen: string,
    turn: "w" | "b",
    time: [number, number], // white ms, black ms
    lastMove: string | null,
    lastMoveTime: string | null,
    name: [string | null, string | null], // white, black
    key: [string | null, string | null], // white, black
    winner: "w" | "b" | null,
    wsIDs: [string | null, string | null], // white, black
}
*/

const timeoutPromise = {}
/*
TODO: doing this client side for now
key: id
val: Promise
*/

const wss = new WebSocketServer({ port: 4321 });

function sanitizeAndFilterGames(games) {
    return JSON.stringify({
        status: "games",
        data: {
            // Remove keys before sending!
            games: Object.entries(games)
                .map(game => {
                    const gameID = game[0]
                    const gameCopy = Object.assign({}, game[1]);
                    delete gameCopy.key;
                    delete gameCopy.wsIDs;
                    gameCopy.id = gameID;
                    return gameCopy;
                })
                .filter(g => (g.name[0] === null || g.name[1] === null) && g.winner === null),
            nConnections: wss.clients.size,
        }
    })
}

function broadcastResult(winnerColor, conn1, conn2) {
    // Send to winner
    conn1.send(JSON.stringify({
        status: "gameOver",
        data: {
            winner: winnerColor,
        }
    }));
    // Send to loser
    if(conn2) {
        conn2.send(JSON.stringify({
            status: "gameOver",
            data: {
                winner: winnerColor
            }
        }));
    }
}

function getOpponentConn(game, opponentIndex) {
    return Array.from(wss.clients).filter(client => client.id === game.wsIDs[opponentIndex])[0];
}

function makeMessageHandler(ws) {
    return (data) => {
        // Monster try / catch
        try {
            const body = JSON.parse(data);
            switch (body.messageType) {
                case "create":
                    if(body.data.name.length < 1) {
                        ws.send(JSON.stringify({
                            status: "noName"
                        }));
                        break;
                    }
                    if(Object.values(games).filter(g => g.winner === null && g.name.some(n => n === null)).reduce((acc, el) => [...acc, ...el.name], []).includes(body.data.name)) {
                        ws.send(JSON.stringify({
                            status: "nameTaken"
                        }));
                        break;
                    }
                    const gameID = nanoid();
                    const playerKey = nanoid();
                    const gameData = {
                        // no validation
                        fen: body.data.fen,
                        turn: "b",
                        time: body.data.time,
                        lastMove: null,
                        lastMoveTime: null,
                        name: [null, null],
                        key: [null, null],
                        winner: null,
                        wsIDs: [null, null]
                    };
                    const colorIndex = body.data.color === "w" ? 0 : 1;
                    gameData.name[colorIndex] = body.data.name;
                    gameData.key[colorIndex] = playerKey;
                    gameData.wsIDs[colorIndex] = ws.id;
                    games[gameID] = gameData;
                    // Send successful create response
                    ws.send(JSON.stringify({
                        status: "created",
                        // Client data model:
                        data: { 
                            key: gameData.key[colorIndex],
                            id: gameID,
                        },
                    }));
                    // Send new game data to all clients
                    wss.clients.forEach(client => client.send(sanitizeAndFilterGames(games)))
                    break;
                case "join":
                    if(body.data.name.length < 1) {
                        ws.send(JSON.stringify({
                            status: "noName"
                        }));
                        break;
                    }
                    if(Object.values(games).filter(g => g.winner === null && g.name.some(n => n === null)).reduce((acc, el) => [...acc, ...el.name], []).includes(body.data.name)) {
                        ws.send(JSON.stringify({
                            status: "nameTaken"
                        }));
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
                            ws.send(JSON.stringify({
                                status: "notFound",
                                data: {
                                    message: "Game not found or already started",
                                }
                            }))
                            // Remove game
                            delete games[body.data.id];
                            // Send the new games list
                            ws.send(sanitizeAndFilterGames(games));
                            break;
                        }
                        game.name[colorIndex] = body.data.name;
                        game.key[colorIndex] = nanoid();
                        game.wsIDs[colorIndex] = ws.id;
                        game.lastMoveTime = Date.now()
                        // Send to challenger
                        ws.send(JSON.stringify({
                            status: "joined",
                            data: {
                                fen: game.fen,
                                key: game.key[colorIndex],
                                id: body.data.id,
                                names: game.name,
                                times: game.time,
                                index: colorIndex,
                                color: colors[colorIndex],
                            },
                        }));
                        // Send to game creator
                        let gameCreatorWsConnection = getOpponentConn(game, creatorColorIndex);
                        gameCreatorWsConnection.send(JSON.stringify({
                            status: "joined",
                            data: {
                                fen: game.fen,
                                key: game.key[creatorColorIndex],
                                id: body.data.id,
                                names: game.name,
                                times: game.time,
                                index: creatorColorIndex,
                                color: colors[creatorColorIndex],
                            }
                        }));
                    } else {
                        ws.send(JSON.stringify({
                            status: "notFound",
                            data: {
                                message: "Game not found or already started",
                            }
                        }))
                    }
                    break;
                case "move":
                    // validate them
                    let {key, id, name, fen, move} = body.data
                    if(games[id] && games[id]?.key[games[id]?.name.indexOf(name)] === key) {
                        // validated
                        const colorIndex = games[id]?.name.indexOf(name);
                        const otherPlayerColorIndex = colorIndex === 0 ? 1 : 0;
                        const game = games[id];
                        // make sure it's their turn 
                        if(game.turn === colors[colorIndex]) {
                            // Now the move will be made
                            game.fen = fen;
                            game.turn =  (game.turn === "w" ? "b" : "w");
                            game.lastMove = move;
                            // Calculate the time spent on the move and update the time
                            game.time[colorIndex] = game.time[colorIndex] - (Date.now() - game.lastMoveTime)
                            /*
                            // TODO: doing this client side for now
                            // Set the timer which ends the game due to timeout
    
                            const timestamp = Date.now()
                            timeoutPromise[id] = timestamp;
                            const tp = new Promise((resolve, reject) => {
                                setTimeout(() => {
                                    console.log("timeout fired: " + colors[colorIndex === 0 ? 1 : 0]);
                                    console.log(timestamp, timeoutPromise[id])
                                    if(timeoutPromise[id] === timestamp) {
                                        resolve(colors[colorIndex === 0 ? 1 : 0]);
                                    }
                                }, game.time[colorIndex]);
                            });
                            tp.then((winner) => {
                                console.log(winner)
                                const opponentConn = getOpponentConn(game, colorIndex === 0 ? 1 : 0)
                                broadcastResult(winner, ws, opponentConn);
                            })
                            */
                            game.lastMoveTime = Date.now();
                            if(game.time < 0) {
                                // Game over loss
                                game.winner = colors[colorIndex];
                                // Broadcast result
                                const otherPlayerWsConnection = getOpponentConn(game, otherPlayerColorIndex);
                                broadcastResult(game.winner, ws, otherPlayerWsConnection);
                            } else {
                                // Send to mover
                                ws.send(JSON.stringify({
                                    status: "moved",
                                    data: {
                                        times: game.time[colorIndex],
                                        move
                                    }
                                }));
                                // Send to other player
                                const otherPlayerWsConnection = Array.from(wss.clients).filter(client => client.id === game.wsIDs[otherPlayerColorIndex])[0];
                                otherPlayerWsConnection.send(JSON.stringify({
                                    status: "moved",
                                    data: {
                                        times: game.time[colorIndex],
                                        move
                                    }
                                }));
                            }
                        } else {
                            // Not the player's turn
                            ws.send(JSON.stringify({
                                status: "notYourMove",
                                data: {
                                    message: "Not your move"
                                }
                            }))
                        }
    
                    } else {
                        // either game doesn't exist or name key combination doesn't match
                        ws.send(JSON.stringify({
                            status: "invalid",
                            data: {
                                message: "Invalid"
                            }
                        }))         
                    }
                    break;
                case "games":
                    ws.send(sanitizeAndFilterGames(games));
                    break;
                case "resign":
                    // validate them
                    {
                        let {key, id, name} = body.data;
                        if(games[id] && games[id]?.key[games[id]?.name.indexOf(name)] === key) {
                            // validated
                            const game = games[id];
                            const colorIndex = games[id]?.name.indexOf(name);
                            game.winner = (colorIndex === 0 ? "b" : "w")
                            const opponentConn = getOpponentConn(game, colorIndex === 0 ? 1 : 0);
                            broadcastResult(game.winner, ws, opponentConn);
                        } else {
                            // either game doesn't exist or name key combination doesn't match
                            ws.send(JSON.stringify({
                                status: "invalid",
                                data: {
                                    message: "Invalid"
                                }
                            }))      
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

wss.on('connection', function connection(ws) {
    // Add unique ID to client
    ws.id = nanoid();

    ws.on('error', console.error);

    ws.on('message', makeMessageHandler(ws));
});