<script>
    import { onMount } from "svelte";
    import { defaultBrushes, isGameCreated, isOnline, nConnections, themeColor, playerName, gameSettings, opponentName, opponentTime, playerTime, timeOfServerTimes, initialFen } from "../stores/global.js";
    import { TextInput, NumberInput, Button, TileGroup, RadioTile  } from "carbon-components-svelte";
    import "carbon-components-svelte/css/white.css";
    import Chessground from "../components/chessground.svelte";
    import Rules from "../components/rules.svelte";
    import Footer from "../components/footer.svelte";
    import wsAPI from "../logic/ws.js";
    import { blackWinSquares, whiteWinSquares } from "../logic/laser.js";
    let API;
    let sendMessage = {};
    let updateBoard;
    let games = [];
    let reset;
    let colorPickerElement;
    let cg;
    let newGameSettings = {
        color: "b",
        wTime: 3,
        bTime: 3,
        wIncrement: 0,
        bIncrement: 0,
    }
    let tabColorIndex = 0;
    $: {
        newGameSettings.color = tabColorIndex === 0 ? "b" : "w"
    }
    let invalidTextInput = false;
    let invalidTextMessage = "";
    let gameOverStopBoard = () => {}
    let colorMap = {"w": "white", "b": "black", "d": false}
    let addIncrement = false;
    $: {
        addIncrement;
        newGameSettings.wIncrement = 0;
        newGameSettings.bIncrement = 0;
    }
    let clockIntervalID = null;
    let clockPlayerTime = null;
    let clockOpponentTime = null;
    $: {
        clockPlayerTime = $playerTime;
        clockOpponentTime = $opponentTime;
    }
    let removingGame = false;
    let showRulesDuringGame = false;

    function tickDownClocks() {
        if($gameSettings.turnColor == $gameSettings.color) {
            clockPlayerTime = Math.max($playerTime - (Date.now() - $timeOfServerTimes), 0);
        } else {
            clockOpponentTime = Math.max($opponentTime - (Date.now() - $timeOfServerTimes), 0);
        }
    }
    
    function msToTime(s) {
        const origMs = s;
        const ms = s % 1000;
        s = (s - ms) / 1000;
        const secs = s % 60;
        s = (s - secs) / 60;
        const mins = s % 60;
        const hrs = (s - mins) / 60;

        return (hrs === 0 ? '' : hrs + ':') + mins + ':' + (secs < 10 ? "0" + secs : secs) + (origMs < 10000 ? "." + Math.floor(ms / 100) : "");
    }
    function addBrush() {
        if(cg?.set) {
            // Clear previous brushes and add new brush
            cg.set({
                drawable: {
                    brushes: {
                        ...defaultBrushes,
                        [$themeColor]: {key: $themeColor, color: $themeColor, opacity: 1, lineWidth: 10}
                    }
                }
            });
        }
    }
    function highlightWinSquares(squares = null, winningSquare = null) {
        if(squares !== null) {
            const highlightSquares = new Map();
            squares.forEach(square => {
                highlightSquares.set(square, "win-squares");
            })
            if(winningSquare !== null) {
                highlightSquares.set(winningSquare, "win-square");
            }
            cg.set({
                highlight: {
                    custom: highlightSquares,
                },
            });
        } else {
            // clear
            cg.set({
                highlight: {
                    custom: undefined,
                },
            });
        }
    }
    function shouldHighlightWinSquares(result, dest) {
        const winSquaresToCheck = result === "b" ? blackWinSquares : whiteWinSquares;
        return (
            winSquaresToCheck.includes(dest) && 
            cg?.state?.pieces?.get(dest)?.role === "pawn" &&
            cg?.state?.pieces?.get(dest)?.color?.[0] === result
        );
    }
    function onMessage(data) {
        switch (data.status) {
            case "moved":
                // Update clocks
                $opponentTime = data.data.times[$gameSettings.color === "b" ? 0 : 1];
                $playerTime = data.data.times[$gameSettings.color === "b" ? 1 : 0];
                $timeOfServerTimes = Date.now();
                // If other persons move then update the board
                if($gameSettings.turnColor !== $gameSettings.color) {
                    // Server data response for opponent move 

                    cg.move(data.data.move[0], data.data.move[1]);
                    // For some reason the move hook doesn't get fired on programmatic moves
                    updateBoard(data.data.move[0], data.data.move[1]);

                    // check for a winner
                    if(data.data.winner !== null) {
                        // Game over
                        
                        // highlight the win squares if a pawn win
                        if(shouldHighlightWinSquares(data.data.winner, data.data.move[1])) {
                            const winSquaresToCheck = data.data.winner === "b" ? blackWinSquares : whiteWinSquares;
                            highlightWinSquares(winSquaresToCheck, data.data.move[1]);
                        }
                        // freeze the board
                        gameOverStopBoard(data.data.winner);
                    } else {
                        // Game continues
                        
                        // update color
                        $gameSettings.turnColor = $gameSettings.turnColor === "b" ? "w" : "b"; 
                        // Play a premove, which does fire the move hook automatically
                        cg.playPremove();
                    }
                    
                } else {
                    // Server data response for player move
                    
                    // update color
                    $gameSettings.turnColor = $gameSettings.turnColor === "b" ? "w" : "b"; 

                    // check for a winner
                    if(data.data.winner !== null) {
                        // highlight the win squares if a pawn win
                        if(shouldHighlightWinSquares(data.data.winner, data.data.move[1])) {
                            const winSquaresToCheck = data.data.winner === "b" ? blackWinSquares : whiteWinSquares;
                            highlightWinSquares(winSquaresToCheck, data.data.move[1]);
                        }
                        gameOverStopBoard(data.data.winner);
                    }
                }
                break;
            case "games":
                games = data.data.games;
                $isOnline = true;
                $nConnections = data.data.nConnections;
                break;
            case "joined":
                // Populate state
                $gameSettings = {
                    isPlaying: true,
                    color: data.data.color,
                    fen: data.data.fen,
                    key: data.data.key,
                    id: data.data.id,
                    winner: null,
                    turnColor: "b",
                };
                $opponentName = data.data.names[data.data.index === 0 ? 1 : 0];
                $opponentTime = data.data.times[data.data.index === 0 ? 1 : 0];
                $playerTime = data.data.times[data.data.index];
                $isGameCreated = true;
                $timeOfServerTimes = Date.now();
                // Clock update repeater
                clockIntervalID = setInterval(tickDownClocks, 100);
                reset();
                break;
            // Refresh the list
            case "created":
                $gameSettings.isPlaying = false;
                $isGameCreated = true;
                $gameSettings.key = data.data.key;
                $gameSettings.id = data.data.id;
                $gameSettings.winner = null;
                break;
            case "gameOver":
                $opponentTime = data.data.times[$gameSettings.color === "b" ? 0 : 1];
                $playerTime = data.data.times[$gameSettings.color === "b" ? 1 : 0];
                gameOverStopBoard(data.data.winner);
                break;
            case "nameTaken":
                invalidTextInput = true;
                invalidTextMessage = "Name already taken";
                break;
            case "noName":
                invalidTextInput = true;
                invalidTextMessage = "Choose a name to play as";
                break;
            case "nameTooLong":
                invalidTextInput = true;
                invalidTextMessage = "Name too long, maximum 60 characters";
                break;
            case "notFound":
                sendMessage.getGames();
                break;
        }
    }

    onMount(() => {
        API = wsAPI(onMessage);

        sendMessage.newGame = () => {
            API.send("create", {
                fen: $initialFen,
                turn: "b",
                times: [newGameSettings.wTime * 60000, newGameSettings.bTime * 60000],
                increments: [newGameSettings.wIncrement * 1000, newGameSettings.bIncrement * 1000],
                color: newGameSettings.color,
                name: $playerName,
            })
        }

        sendMessage.joinGame = (gameID) => {
            // First remove self created game if exists
            if($isGameCreated) {
                sendMessage.endGame();
            }
            API.send("join", {
                id: gameID,
                name: $playerName,
            })
        }

        sendMessage.getGames = () => {
            API.send("games");
        }

        sendMessage.endGame = () => {
            API.send("end", {
                name: $playerName,
                id: $gameSettings.id,
                key: $gameSettings.key,
            });
        }

        sendMessage.syncMoves = (move) => {
            // send moves if playing, game isn't over, and it's player's move
            if($gameSettings.isPlaying && $gameSettings.winner === null && $gameSettings.color === $gameSettings.turnColor) {
                API.send("move", {
                    key: $gameSettings.key,
                    id: $gameSettings.id,
                    name: $playerName,
                    fen: $gameSettings.fen,
                    move 
                });
            }   
        }

        gameOverStopBoard = (winner) => {
            API.send("games");
            if(!removingGame) {
                $gameSettings.winner = colorMap[winner];
                cg.stop()
                // End clock updater
                clearInterval(clockIntervalID);

                if($gameSettings.isPlaying) {
                    $isGameCreated = false;
                }
            } else {
                removingGame = false;
                $isGameCreated = false;
            }
        }
    })

</script>

<input bind:this={colorPickerElement} bind:value={$themeColor} on:change={addBrush} type="color" hidden />


<div class="page-container">
    <header>
        <span>LASER</span>
        <div on:click={() => colorPickerElement.click()} class="svg-container">
            <div class="gradient"></div>
            <svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" height="50px" enable-background="new 0 0 612.35 226.771" xml:space="preserve" width="1006.175px" viewBox="0 0 6012.35 250.771">
                <polygon fill={$themeColor} points="8012.35,108.29 151.556,108.29 186.289,98.983 186.718,98.869 184.176,89.386 148.318,98.994   214.222,60.944 209.314,52.441 143.41,90.49 169.346,64.555 169.658,64.242 162.716,57.3 136.468,83.548 174.517,17.645   166.015,12.736 127.965,78.64 137.458,43.21 137.572,42.782 128.09,40.24 118.481,76.099 118.481,0 108.663,0 108.663,76.099   99.055,40.24 89.571,42.782 99.178,78.636 61.352,13.119 61.13,12.736 52.628,17.645 90.678,83.55 64.741,57.612 64.428,57.3   57.485,64.241 83.735,90.491 17.832,52.441 12.922,60.943 78.826,98.993 43.397,89.5 42.969,89.386 40.427,98.869 75.587,108.29   0,108.29 0,118.48 75.588,118.48 40.855,127.788 40.428,127.902 42.969,137.386 78.828,127.777 13.306,165.605 12.923,165.828   17.832,174.33 83.733,136.282 57.485,162.528 64.428,169.471 90.678,143.222 52.849,208.743 52.628,209.127 61.131,214.034   99.181,148.131 89.572,183.988 99.056,186.53 108.663,150.676 108.663,226.771 118.481,226.771 118.481,150.677 127.974,186.102   128.088,186.529 137.572,183.988 127.964,148.129 166.015,214.035 174.517,209.125 136.47,143.226 162.402,169.159 162.716,169.471   169.658,162.528 143.41,136.281 209.312,174.33 214.222,165.828 148.317,127.778 183.748,137.271 184.176,137.386 186.718,127.902   151.558,118.48 8012.35,118.48 "/>
            </svg>
        </div>
    </header>
    
    <div class="game-container">
        <div class="side">
            {#if !$gameSettings.isPlaying || !$isGameCreated}
                <TextInput disabled={$isGameCreated} invalid={invalidTextInput} invalidText={invalidTextMessage} bind:value={$playerName} hideLabel labelText="name" placeholder="Enter name..." />
                <!-- Create Game -->
                <div class="side-section" style="margin: 20px 0">
                    <span>CREATE GAME</span>
                    {#if $isGameCreated}
                        <Button on:click={() => {removingGame = true; sendMessage.endGame()}} kind="secondary" style="width: 100%; max-width: none; font-weight: 600; margin-top: 10px" size="field">Remove</Button>
                    {:else}
                        <div class="number-input">
                            <TileGroup bind:selected={tabColorIndex} id="tile-group" style="position: relative; min-height: 3rem; margin-top: 6px;">
                                <RadioTile style="left: 0px; position: absolute; width: 50%; min-height: 2rem; user-select: none;" value={0}>Black</RadioTile>
                                <RadioTile style="right: 0px; position: absolute; width: 50%; min-height: 2rem; user-select: none;" value={1}>White</RadioTile>
                            </TileGroup>
                        </div>
                        <div class="number-input">
                            <NumberInput min={0.5} step={0.5} bind:value={newGameSettings.bTime} size="sm" label={`Black minutes (${newGameSettings.color === "b" ? "you" : "opponent"})`} />
                        </div>
                        {#if addIncrement}
                            <div class="number-input">
                                <NumberInput min={0} step={1} bind:value={newGameSettings.bIncrement} size="sm" label={`Black seconds increment (${newGameSettings.color === "b" ? "you" : "opponent"})`} />
                            </div>
                        {/if}
                        <div class="number-input">
                            <NumberInput min={0.5} step={0.5} bind:value={newGameSettings.wTime} size="sm" label={`White minutes (${newGameSettings.color === "b" ? "opponent" : "you"})`} />
                        </div>
                        {#if addIncrement}
                            <div class="number-input">
                                <NumberInput min={0} step={1} bind:value={newGameSettings.wIncrement} size="sm" label={`White seconds increment (${newGameSettings.color === "b" ? "opponent" : "you"})`} />
                            </div>
                        {/if}

                        <Button on:click={() => addIncrement = !addIncrement} kind="ghost" size="sm" style="width: 100%; max-width: none; margin-top: 10px; color: #525252">{addIncrement ? "Remove" : "Add"} Increment</Button>
                        <Button on:click={() => {invalidTextInput = false; sendMessage.newGame()}} kind="tertiary" style="width: 100%; max-width: none; font-weight: 600; margin-top: 10px" size="field" > Create</Button>
                    {/if}
                </div>
                <!-- Lobby -->
                <div class="side-section">
                    <span>LOBBY</span>
                    <div class="lobby">
                        {#each games as game}
                            <div class="game-tile-wrapper">
                                <div style={game.name.filter(n => n !== null)[0] === $playerName && $isGameCreated ? "border: 1px solid black" : ""} class="game-tile">
                                    <span class={game.name.indexOf(null) === 0 ? "white-dot" : "black-dot"}></span>
                                    <span >{game.times[game.name.indexOf(null)] / 60000} mins{game.increments[game.name.indexOf(null)] !== 0 ? " + " + game.increments[game.name.indexOf(null)] / 1000 + "": ""}</span>
                                    <span style="font-style: italic">&nbsp;vs&nbsp;</span>
                                    <!-- Get local if own game to prevent flash -->
                                    <span class={game.name.indexOf(null) === 0 ? "black-dot" : "white-dot"}></span>
                                    <span style="font-weight: 500; text-decoration: underline; word-wrap: anywhere">{game.name.filter(n => n !== null)[0] === $playerName && $isGameCreated ? $playerName : game.name.filter(e => e !== null)[0]}</span>
                                    <span>{game.times[game.name.indexOf(null) === 0 ? 1 : 0] / 60000} mins{game.increments[game.name.indexOf(null) === 0 ? 1 : 0] !== 0 ? " + " + game.increments[game.name.indexOf(null) === 0 ? 1 : 0] / 1000 + "": ""}</span>
                                </div>
                                {#if game.name.filter(n => n !== null)[0] !== $playerName || !$isGameCreated}
                                    <Button style="font-weight: 600; width: 80px" kind="tertiary" size="small" on:click={() => {invalidTextInput = false; sendMessage.joinGame(game.id)}}>&nbsp;&nbsp;&nbsp;Join</Button>
                                {/if}
                            </div>
                        {/each}
                    </div>
                </div>
            {:else if showRulesDuringGame}
                <div class="side-section">
                    <Rules {highlightWinSquares} />
                </div>
            {/if}
        </div>
        <!-- Chessboard -->
        <div class="chessground-wrapper-wrapper">
            <div class="chessground-wrapper">
                <p>
                    Loading...
                </p>
                <Chessground bind:reset bind:cg bind:updateBoard bind:gameOverStopBoard {colorMap} {sendMessage} {highlightWinSquares} {shouldHighlightWinSquares}/>
            </div>
            {#if !$gameSettings.isPlaying}
                <div style="display: flex; justify-content: space-between;">
                    <span style="font-weight: 600; font-size: 16px;">ANALYSIS BOARD{$gameSettings.winner !== null ? ` • GAME OVER ${$gameSettings.winner === false ? "DRAW" : `${$gameSettings.winner.toUpperCase()} WINS`}` : ""}</span>
                    <span style="font-size: 16px; cursor: pointer" on:click={() => {reset(false); $gameSettings.winner = null}}>RESET</span>
                </div>
            {/if}
            {#if $gameSettings.isPlaying && $gameSettings.winner !== null}
                <div style="display: flex; justify-content: space-between;">
                    <span style="font-weight: 600; font-size: 16px;">GAME OVER {$gameSettings.winner === false ? "DRAW" : `${$gameSettings.winner.toUpperCase()} WINS`}</span>
                    <span style="font-size: 16px; cursor: pointer" on:click={() => reset(true)}>RESET BOARD</span>
                </div>
            {/if}
        </div>
    
        <!-- Rules -->
        <div class="side">
            {#if !$gameSettings.isPlaying}
                <div class="side-section">
                    <Rules {highlightWinSquares} />
                </div>
            {:else}
                <!-- Clocks -->
                <div class="clock-container">
                    <div>
                        <div class="clock" style="margin-bottom: 10px">{msToTime(clockOpponentTime)}</div>
                        <span class="player-name opponent-name" >{$opponentName}</span>
                    </div>
                    <div class="reverse-clock-on-mobile" style="position: relative">
                        <span class="player-name">{$playerName}</span>
                        <Button disabled={!$isGameCreated} on:click={() => showRulesDuringGame = !showRulesDuringGame} kind="ghost" size="sm" class="resign-button rules-button" >{showRulesDuringGame ? "Hide" : "Show"} rules</Button>
                        <Button disabled={!$isGameCreated} on:click={() => sendMessage.endGame()} kind="ghost" size="sm" class="resign-button" >Resign</Button>
                        <div class="clock clock-self">{msToTime(clockPlayerTime)}</div>
                    </div>
                </div>
            {/if}
        </div>
    </div>
    
    <Footer />
</div>


<style>
    .hidden-button {
        width: 100%;
        max-width: none;
        margin-top: 10px;
        color: #525252;
        left: 5px;
        bottom: 5px;
        position: absolute;
    }
    .number-input {
        display: flex;
        width: 100%;
        margin-top: 6px
    }

    .clock-container {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        height: 506px;
        padding-left: 20px;
    }

    .clock {
        font-family: IBM Plex Mono;
        font-size: 40px
    }

    .clock-self {
        margin-top: 10px;
    }

    .player-name {
        text-decoration: underline;
        font-weight: 600;
        max-width: 10vw;
        word-wrap: break-word;
        display: inline-block;
    }

    .page-container {
        min-height: 100vh;
        position: relative;
    }
    .lobby {
        margin-top: 10px;
        max-height: 300px;
        overflow-y: auto;
    }

    .white-dot {
        display: inline-block;
        height: 10px;
        width: 10px;
        border-radius: 50%;
        border: solid 1px black;
    }

    .black-dot {
        display: inline-block;
        height: 10px;
        width: 10px;
        border-radius: 50%;
        border: solid 1px black;
        background-color: black;
    }

    .game-tile {
        width: 100%;
        min-height: 2rem;
        padding: 6px 10px;
        border-right: 0;
    }

    .game-tile-wrapper {
        display: flex;
        margin: 5px 0;
    }

    .side {
        width: 24%;
    }

    .side-section {
        border-top: solid black 5px;
        margin-bottom: 10px;
    }

    .side-section span {
        font-weight: 600;
        font-size: 16px;
    }

    .controls {
        margin-top: 20px;
        display: flex;
        flex-direction: column;
        align-items: center;
    }

    .controls-inner {
        width: 500px;
        display: flex;
        flex-direction: column;
    }

    .chessground-wrapper {
        padding: 5px 1px 1px 5px;
        background-color: black;
        position: relative;
    }

    .game-container {
        justify-content: space-around;
        display: flex;
        padding-bottom: 80px;
    }

    header {
        display: flex;
        flex-direction: row;
        overflow: hidden;
        margin-bottom: 50px;
    }

    header span {
        flex-shrink: 0;
        font-size: 40px;
        padding: 0 5px;
        cursor: default;
    }

    header span:hover {
        text-decoration: underline
    }

    .svg-container {
        position: relative;
        display: inline-block;
    }

    .gradient {
        position: absolute;
        display: inline-block;
        background: -moz-linear-gradient(90deg, rgb(255, 255, 255) 27%, rgb(255, 255, 255) 79%);
        background: -webkit-linear-gradient(90deg, rgba(255,255,255,1) 27%, rgba(255,255,255,1) 79%);
        background: linear-gradient(90deg, rgba(255, 255, 255, 0) 5%, rgb(255, 255, 255) 25%);
        width: 100%;
        height: 100%;
    }

    svg {
        flex-shrink: 0;
    }

    p {
        position: absolute;
        color: #949494;
        text-align: center;
        width: 100%;
        font-size: 20px;
        margin-top: 220px;
    }

    .game-tile span {
        font-weight: 400;
    }

    .reverse-clock-on-mobile {
        display: flex;
        flex-direction: column;
    }

    .reverse-clock-on-mobile :global(.resign-button) {
        max-width: none;
        margin-top: 10px;
        color: #525252;
        right: 5px;
        bottom: 5px;
        position: absolute;
    }

    .reverse-clock-on-mobile :global(.rules-button) {
        bottom: 45px;
    }

    .number-input :global(#tile-group) {
        width: 24vw;
    }

    @media only screen and (max-width: 1082px) {

        .number-input :global(#tile-group) {
            width: 64vw;
        }

        .game-container {
            justify-content: space-around;
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        .side {
            width: 65%;
            margin-bottom: 30px;
        }

        header {
            display: flex;
            flex-direction: row;
            overflow: hidden;
            margin-bottom: 20px;
        }

        .chessground-wrapper {
            padding: 0;
            background-color: transparent;
            position: relative;
        }

        .chessground-wrapper-wrapper {
            margin-bottom: 30px;
        }

        .clock-container {
            flex-direction: row-reverse;
            padding-left: 0;
            height: 140px;
        }

        .reverse-clock-on-mobile {
            display: flex;
            flex-direction: column-reverse;
            justify-content: start;
        }

        .reverse-clock-on-mobile :global(.resign-button) {
            bottom: -20px;
            left: 0px;
            right: unset;
        }

        .reverse-clock-on-mobile :global(.rules-button) {
            bottom: -60px;
            width: 150px;
        }

        .clock {
            text-align: right;
        }

        .clock-self {
            margin-top: 0px;
            margin-bottom: 10px;
            text-align: left;
        }

        .player-name {
            max-width: 25vw;
        }

        .opponent-name {
            float: right;
        }
    }

    @media only screen and (max-width: 650px) {
        .side {
            width: 80%;
            margin-bottom: 30px;
        }

        .number-input :global(#tile-group) {
            width: 80vw;
        }
    }
</style>