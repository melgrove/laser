<script>
    import { onMount } from "svelte";
    import { isGameCreated, isOnline, nConnections, themeColor, playerName, gameSettings, opponentName, opponentTime, playerTime } from "../stores/global.js";
    import { TextInput, NumberInput, ContentSwitcher, Switch, Button, Checkbox, RadioButtonGroup, RadioButton  } from "carbon-components-svelte";
    import "carbon-components-svelte/css/white.css";
    import Chessground from "../components/chessground.svelte";
    import wsAPI from "../logic/ws.js";
    let API;
    let sendMessage = {};
    let moveHook;
    let onMove;
    let games = [];
    let reset;
    let colorPickerElement;
    let cg;
    let fen;
    let initialFen;
    let newGameSettings = {
        color: "b",
        wTime: 3,
        bTime: 3,
    }
    let invalidTextInput = false;
    let invalidTextMessage = "";
    let gameOver = () => {}
    let colorMap = {"w": "white", "b": "black"}
    
    function decrementClock(isPlayer, color) {
        setTimeout(() => {
            if($gameSettings.turnColor === color && $gameSettings.winner === null && $gameSettings.isPlaying) {
                if(isPlayer) {
                    if($playerTime - 1000 < 0) {
                        gameOver(color, true);
                        return;
                    }
                    $playerTime -= 1000;
                } else {
                    $opponentTime = ($opponentTime - 1000 <= 0) ? 0 : ($opponentTime - 1000);
                }
                decrementClock(isPlayer, color);
            }
        }, 1000)
    }
    function msToTime(s) {
        const ms = s % 1000;
        s = (s - ms) / 1000;
        const secs = s % 60;
        s = (s - secs) / 60;
        const mins = s % 60;
        const hrs = (s - mins) / 60;

        return (hrs === 0 ? '' : hrs + ':') + mins + ':' + (secs < 10 ? "0" + secs : secs);
    }
    function addBrush() {
        if(cg?.state) {
            // Clear previous brushes and add new brush
            cg.state.drawable.brushes = {
                [$themeColor]: {key: $themeColor, color: $themeColor, opacity: 1, lineWidth: 10}
            };
        }
    }
    function onMessage(data) {
        // console.log(data)
        switch (data.status) {
            case "moved":
                // If other persons move then update the board
                if($gameSettings.turnColor !== $gameSettings.color) {
                    cg.move(data.data.move[0], data.data.move[1]);
                    // For some reason the move hook doesn't get fired on programmatic moves
                    moveHook(data.data.move[0], data.data.move[1]);
                    // update color
                    $gameSettings.turnColor = $gameSettings.turnColor === "b" ? "w" : "b"; 
                    // Update opponent clock
                    $opponentTime = data.data.times;
                    // Start new decrement
                    decrementClock(true, $gameSettings.turnColor)
                } else {
                    // update color
                    $gameSettings.turnColor = $gameSettings.turnColor === "b" ? "w" : "b"; 
                    // Update self clock
                    $playerTime = data.data.times;
                    // Start new decrement
                    decrementClock(false, $gameSettings.turnColor)
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
                if($gameSettings.color === "b") {
                    decrementClock(true, "b")
                } else {
                    decrementClock(false, "b")
                }
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
                gameOver(data.data.winner);
                break;
            case "nameTaken":
                invalidTextInput = true;
                invalidTextMessage = "Name already taken";
                break;
            case "noName":
                invalidTextInput = true;
                invalidTextMessage = "Choose a name to play as";
                break;
        }
    }

    onMount(() => {
        API = wsAPI(onMessage);

        sendMessage.newGame = () => {
            API.send("create", {
                fen: initialFen,
                turn: "b",
                time: [newGameSettings.wTime * 60000, newGameSettings.bTime * 60000],
                color: newGameSettings.color,
                name: $playerName,
            })
        }

        sendMessage.joinGame = (gameID) => {
            API.send("join", {
                id: gameID,
                name: $playerName,
            })
        }

        sendMessage.getGames = () => {
            API.send("games");
        }

        sendMessage.resign = () => {
            API.send("resign", {
                name: $playerName,
                id: $gameSettings.id,
                key: $gameSettings.key
            });
            API.send("games");
        }

        onMove = (move) => {
            // send moves if playing, game isn't over, and it's player's move
            if($gameSettings.isPlaying && $gameSettings.winner === null && $gameSettings.color === $gameSettings.turnColor) {
                API.send("move", {
                    key: $gameSettings.key,
                    id: $gameSettings.id,
                    name: $playerName,
                    fen,
                    move 
                });
            }   
        }

        gameOver = (winner, sendToOpponent = false) => {
            API.send("games");
            $gameSettings.winner = colorMap[winner];
            $isGameCreated = false;
            cg.stop()
            if(sendToOpponent) {
                sendMessage.resign();
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
        <!-- Lobby -->
        <div class="side">
            {#if !$gameSettings.isPlaying || !$isGameCreated}
                <TextInput disabled={$isGameCreated} invalid={invalidTextInput} invalidText={invalidTextMessage} bind:value={$playerName} hideLabel labelText="name" placeholder="Enter name..." />
                <div class="side-section" style="margin-top: 10px">
                    <span>CREATE GAME</span>
                    {#if $isGameCreated}
                        <Button on:click={sendMessage.resign} kind="secondary" style="width: 100%; max-width: none; font-weight: 600; margin-top: 10px" size="field">Remove</Button>
                    {:else}
                        <RadioButtonGroup
                        orientation="vertical"
                        style="margin-top: 10px; width: 100%"
                        bind:selected={newGameSettings.color}
                        tool
                        >
                        <div style="display: flex; width: 100%">
                            <RadioButton value="b" style="margin-top: 30px"/> <NumberInput bind:value={newGameSettings.bTime} size="sm" label={`Black mins (${newGameSettings.color === "b" ? "you" : "opponent"})`} />
                        </div>
                        <div style="display: flex; width: 100%">
                            <RadioButton value="w" style="margin-top: 30px"/> <NumberInput bind:value={newGameSettings.wTime} size="sm" label={`White mins (${newGameSettings.color === "b" ? "opponent" : "you"})`} />
                        </div>
                        </RadioButtonGroup>
                        <Button on:click={() => {invalidTextInput = false; sendMessage.newGame()}} kind="tertiary" style="width: 100%; max-width: none; font-weight: 600; margin-top: 10px" size="field" > Create</Button>
                    {/if}
                </div>
                <div class="side-section">
                    <span>LOBBY</span>
                    <div class="lobby">
                        {#each games as game}
                            <div class="game-tile-wrapper">
                                <div style={game.name.filter(n => n !== null)[0] === $playerName ? "border: 3px solid black" : ""} class="game-tile">
                                    <span class={game.name.indexOf(null) === 0 ? "white-dot" : "black-dot"}></span>
                                    <span >{game.time[game.name.indexOf(null)] / 60000} mins</span>
                                    <span style="font-style: italic">&nbsp;vs&nbsp;</span>
                                    <span class={game.name.indexOf(null) === 0 ? "black-dot" : "white-dot"}></span>
                                    <span style="font-weight: 500; text-decoration: underline">{game.name.filter(e => e !== null)[0]}</span>
                                    <span>{game.time[game.name.indexOf(null) === 0 ? 1 : 0] / 60000} mins</span>
                                </div>
                                {#if game.name.filter(n => n !== null)[0] !== $playerName}
                                    <Button style="font-weight: 600; width: 80px" kind="tertiary" size="small" on:click={() => {invalidTextInput = false; sendMessage.joinGame(game.id)}}>&nbsp;&nbsp;&nbsp;Join</Button>
                                {/if}
                            </div>
                        {/each}
                    </div>
                </div>
            {/if}
        </div>
        <!-- Chessboard -->
        <div>
            <div class="chessground-wrapper">
                <p>
                    Loading...
                </p>
                <Chessground bind:reset bind:cg bind:fen bind:initialFen bind:onMove bind:moveHook bind:gameOver {colorMap}/>
            </div>
            {#if !$gameSettings.isPlaying}
                <div style="display: flex; justify-content: space-between;">
                    <span style="font-weight: 600; font-size: 16px;">ANALYSIS BOARD</span>
                    <span style="font-size: 16px; cursor: pointer" on:click={() => reset(true)}>RESET</span>
                </div>
            {/if}
            {#if $gameSettings.isPlaying && $gameSettings.winner !== null}
                <div style="display: flex; justify-content: space-between;">
                    <span style="font-weight: 600; font-size: 16px;">GAME OVER {$gameSettings.winner.toUpperCase()} WINS</span>
                    <span style="font-size: 16px; cursor: pointer" on:click={() => reset(true)}>RESET BOARD</span>
                </div>
            {/if}
        </div>
    
        <!-- Rules -->
        <div class="side">
            {#if !$gameSettings.isPlaying}
            <div class="side-section">
                <span>RULES</span>
                <div>
                    No one knows the rules, but they're provocative. They get the people going.
                </div>
            </div>
            {:else}
            <div class="clock-container">
                <div>
                    <div class="clock" style="margin-bottom: 10px">{msToTime($opponentTime)}</div>
                    <span class="player-name" >{$opponentName}</span>
                </div>
                <div>
                    <span class="player-name">{$playerName}</span>
                    <div style="font-size: 16px; cursor: pointer; margin-top: 10px" on:click={sendMessage.resign} >RESIGN</div>
                    <div class="clock" style="margin-top: 10px">{msToTime($playerTime)}</div>
                </div>
            </div>
            {/if}
        </div>
    </div>
    
    <!-- Footer -->
    <footer style={"background-color: " + $themeColor}>
        <span>server {$isOnline ? `online ✓ ${$nConnections} connection${$nConnections === 1 ? "" : "s"}` : "offline ✖"}</span>
        <span>laser rules: oliver & tate, website: oliver</span>
    </footer>
</div>


<style>
    .clock-container {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        height: 100%;
        padding-left: 20px;
    }

    .clock {
        font-size: 40px
    }

    .player-name {
        text-decoration: underline;
        font-weight: 600;
    }

    .page-container {
        min-height: 100vh;
        position: relative;
    }
    .lobby {
        margin-top: 10px;
        max-height: 400px;
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
        border: solid 1px black;
        border-right: 0;
    }

    .game-tile-wrapper {
        display: flex;
        margin: 5px 0;
    }

    /* Hack to get the time inputs to be full width */
    :global(.bx--radio-button-group) {
        border: none;
        width: 100%;
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

    footer {
        height: 20px;
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        position: absolute;
        bottom: 0;
        width: 100%;
    }

    footer span {
        font-size: 14px;
        color: white;
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

    .game-over {
        
    }

    .chessground-wrapper {
        padding: 5px 1px 1px 5px;
        background-color: black;
        position: relative;
    }

    .game-container {
        justify-content: space-around;
        display: flex;
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
        cursor: pointer;
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
</style>