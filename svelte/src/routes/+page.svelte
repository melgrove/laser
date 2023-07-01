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
                <div class="side-section" style="margin: 20px 0">
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
        <div class="chessground-wrapper-wrapper">
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
                <div style="margin-top: 6px"></div>
                <span style={`font-style: italic; color: ${$themeColor}; margin-top: 20px;`}>Movement</span><br>
                <div class="rule-piece">
                    <div class="queen rule-piece-icon"></div><span style="font-weight: 600 !important">Laser&nbsp;&nbsp;</span><span style="font-size: 14px; margin-top: 16px">Moves horizontal and vertical, shoots laser diagonally until the edge of the board or a Wall, destroying all pieces in its path. Cannot capture pieces.</span>
                </div>
                <div class="rule-piece">
                    <div class="rook rule-piece-icon"></div><span style="font-weight: 600 !important">Wall&nbsp;&nbsp;</span><span style="font-size: 14px; margin-top: 16px">Same movement as a rook in chess, stops the Laser and cannot be destroyed by it</span>
                </div>
                <div class="rule-piece">
                    <div class="king rule-piece-icon"></div><span style="font-weight: 600 !important">King&nbsp;&nbsp;</span><span style="font-size: 14px; margin-top: 16px">Same movement as chess</span>
                </div>
                <div class="rule-piece">
                    <div class="knight rule-piece-icon"></div><span style="font-weight: 600 !important">Kight&nbsp;&nbsp;</span><span style="font-size: 14px; margin-top: 16px">Same movement as chess</span>
                </div>
                <div class="rule-piece" style="margin-bottom: 10px">
                    <div class="pawn rule-piece-icon"></div><span style="font-weight: 600 !important">Pawn&nbsp;&nbsp;</span><span style="font-size: 14px; margin-top: 16px">Moves diagonally, takes horizontally and vertically</span>
                </div>
                <span style={`font-style: italic; color: ${$themeColor}`}>Winning</span><br>
                <div class="winning-rules" style="margin-top: 6px; margin-bottom: 10px;">
                    <span>Take your opponent's King</span> or <span>move one of your pawns to the three squares in the opposite corner</span>, for black that's a1, a2, b1 and for white that's h8, h7, g8.
                </div>
                <span style={`font-style: italic; color: ${$themeColor}`}>Gameplay</span><br>
                <div class="winning-rules" style="margin-top: 6px">
                    No checks or checkmates, the game continues until one of the win conditions. Black moves first.
                </div>
            </div>
            {:else}
            <div class="clock-container">
                <div >
                    <div class="clock" style="margin-bottom: 10px">{msToTime($opponentTime)}</div>
                    <span class="player-name" >{$opponentName}</span>
                </div>
                <div class="reverse-clock-on-mobile">
                    <span class="player-name">{$playerName}</span>
                    <div style="font-size: 16px; cursor: pointer; margin-top: 10px" on:click={sendMessage.resign} >RESIGN</div>
                    <div class="clock clock-self">{msToTime($playerTime)}</div>
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
    .rule-piece {
        display: flex;
    }

    .rule-piece span {
        margin-top: 15px;
        font-weight: 400 !important;
    }

    .rule-piece-icon {
        flex-shrink: 0;
        width: 45px;
        height: 45px;
        transform: scale(0.7);
    }

    .queen {
        background-image: url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0NSIgaGVpZ2h0PSI0NSI+PGcgZmlsbC1ydWxlPSJldmVub2RkIiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iMS41IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxnIHN0cm9rZT0ibm9uZSI+PGNpcmNsZSBjeD0iNiIgY3k9IjEyIiByPSIyLjc1Ii8+PGNpcmNsZSBjeD0iMTQiIGN5PSI5IiByPSIyLjc1Ii8+PGNpcmNsZSBjeD0iMjIuNSIgY3k9IjgiIHI9IjIuNzUiLz48Y2lyY2xlIGN4PSIzMSIgY3k9IjkiIHI9IjIuNzUiLz48Y2lyY2xlIGN4PSIzOSIgY3k9IjEyIiByPSIyLjc1Ii8+PC9nPjxwYXRoIGQ9Ik05IDI2YzguNS0xLjUgMjEtMS41IDI3IDBsMi41LTEyLjVMMzEgMjVsLS4zLTE0LjEtNS4yIDEzLjYtMy0xNC41LTMgMTQuNS01LjItMTMuNkwxNCAyNSA2LjUgMTMuNSA5IDI2eiIgc3Ryb2tlLWxpbmVjYXA9ImJ1dHQiLz48cGF0aCBkPSJNOSAyNmMwIDIgMS41IDIgMi41IDQgMSAxLjUgMSAxIC41IDMuNS0xLjUgMS0xLjUgMi41LTEuNSAyLjUtMS41IDEuNS41IDIuNS41IDIuNSA2LjUgMSAxNi41IDEgMjMgMCAwIDAgMS41LTEgMC0yLjUgMCAwIC41LTEuNS0xLTIuNS0uNS0yLjUtLjUtMiAuNS0zLjUgMS0yIDIuNS0yIDIuNS00LTguNS0xLjUtMTguNS0xLjUtMjcgMHoiIHN0cm9rZS1saW5lY2FwPSJidXR0Ii8+PHBhdGggZD0iTTExIDM4LjVhMzUgMzUgMSAwIDAgMjMgMCIgZmlsbD0ibm9uZSIgc3Ryb2tlLWxpbmVjYXA9ImJ1dHQiLz48cGF0aCBkPSJNMTEgMjlhMzUgMzUgMSAwIDEgMjMgMG0tMjEuNSAyLjVoMjBtLTIxIDNhMzUgMzUgMSAwIDAgMjIgMG0tMjMgM2EzNSAzNSAxIDAgMCAyNCAwIiBmaWxsPSJub25lIiBzdHJva2U9IiNlY2VjZWMiLz48L2c+PC9zdmc+');
    }

    .rook {
        background-image: url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0NSIgaGVpZ2h0PSI0NSI+PGcgZmlsbC1ydWxlPSJldmVub2RkIiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iMS41IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwYXRoIGQ9Ik05IDM5aDI3di0zSDl2M3ptMy41LTdsMS41LTIuNWgxN2wxLjUgMi41aC0yMHptLS41IDR2LTRoMjF2NEgxMnoiIHN0cm9rZS1saW5lY2FwPSJidXR0Ii8+PHBhdGggZD0iTTE0IDI5LjV2LTEzaDE3djEzSDE0eiIgc3Ryb2tlLWxpbmVjYXA9ImJ1dHQiIHN0cm9rZS1saW5lam9pbj0ibWl0ZXIiLz48cGF0aCBkPSJNMTQgMTYuNUwxMSAxNGgyM2wtMyAyLjVIMTR6TTExIDE0VjloNHYyaDVWOWg1djJoNVY5aDR2NUgxMXoiIHN0cm9rZS1saW5lY2FwPSJidXR0Ii8+PHBhdGggZD0iTTEyIDM1LjVoMjFtLTIwLTRoMTltLTE4LTJoMTdtLTE3LTEzaDE3TTExIDE0aDIzIiBmaWxsPSJub25lIiBzdHJva2U9IiNlY2VjZWMiIHN0cm9rZS13aWR0aD0iMSIgc3Ryb2tlLWxpbmVqb2luPSJtaXRlciIvPjwvZz48L3N2Zz4=');
    }

    .king {
        background-image: url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0NSIgaGVpZ2h0PSI0NSI+PGcgZmlsbD0ibm9uZSIgZmlsbC1ydWxlPSJldmVub2RkIiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iMS41IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwYXRoIGQ9Ik0yMi41IDExLjYzVjYiIHN0cm9rZS1saW5lam9pbj0ibWl0ZXIiLz48cGF0aCBkPSJNMjIuNSAyNXM0LjUtNy41IDMtMTAuNWMwIDAtMS0yLjUtMy0yLjVzLTMgMi41LTMgMi41Yy0xLjUgMyAzIDEwLjUgMyAxMC41IiBmaWxsPSIjMDAwIiBzdHJva2UtbGluZWNhcD0iYnV0dCIgc3Ryb2tlLWxpbmVqb2luPSJtaXRlciIvPjxwYXRoIGQ9Ik0xMS41IDM3YzUuNSAzLjUgMTUuNSAzLjUgMjEgMHYtN3M5LTQuNSA2LTEwLjVjLTQtNi41LTEzLjUtMy41LTE2IDRWMjd2LTMuNWMtMy41LTcuNS0xMy0xMC41LTE2LTQtMyA2IDUgMTAgNSAxMFYzN3oiIGZpbGw9IiMwMDAiLz48cGF0aCBkPSJNMjAgOGg1IiBzdHJva2UtbGluZWpvaW49Im1pdGVyIi8+PHBhdGggZD0iTTMyIDI5LjVzOC41LTQgNi4wMy05LjY1QzM0LjE1IDE0IDI1IDE4IDIyLjUgMjQuNWwuMDEgMi4xLS4wMS0yLjFDMjAgMTggOS45MDYgMTQgNi45OTcgMTkuODVjLTIuNDk3IDUuNjUgNC44NTMgOSA0Ljg1MyA5IiBzdHJva2U9IiNlY2VjZWMiLz48cGF0aCBkPSJNMTEuNSAzMGM1LjUtMyAxNS41LTMgMjEgMG0tMjEgMy41YzUuNS0zIDE1LjUtMyAyMSAwbS0yMSAzLjVjNS41LTMgMTUuNS0zIDIxIDAiIHN0cm9rZT0iI2VjZWNlYyIvPjwvZz48L3N2Zz4=');
    }

    .knight {
        background-image: url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0NSIgaGVpZ2h0PSI0NSI+PGcgZmlsbD0ibm9uZSIgZmlsbC1ydWxlPSJldmVub2RkIiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iMS41IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwYXRoIGQ9Ik0yMiAxMGMxMC41IDEgMTYuNSA4IDE2IDI5SDE1YzAtOSAxMC02LjUgOC0yMSIgZmlsbD0iIzAwMCIvPjxwYXRoIGQ9Ik0yNCAxOGMuMzggMi45MS01LjU1IDcuMzctOCA5LTMgMi0yLjgyIDQuMzQtNSA0LTEuMDQyLS45NCAxLjQxLTMuMDQgMC0zLTEgMCAuMTkgMS4yMy0xIDItMSAwLTQuMDAzIDEtNC00IDAtMiA2LTEyIDYtMTJzMS44OS0xLjkgMi0zLjVjLS43My0uOTk0LS41LTItLjUtMyAxLTEgMyAyLjUgMyAyLjVoMnMuNzgtMS45OTIgMi41LTNjMSAwIDEgMyAxIDMiIGZpbGw9IiMwMDAiLz48cGF0aCBkPSJNOS41IDI1LjVhLjUuNSAwIDEgMS0xIDAgLjUuNSAwIDEgMSAxIDB6bTUuNDMzLTkuNzVhLjUgMS41IDMwIDEgMS0uODY2LS41LjUgMS41IDMwIDEgMSAuODY2LjV6IiBmaWxsPSIjZWNlY2VjIiBzdHJva2U9IiNlY2VjZWMiLz48cGF0aCBkPSJNMjQuNTUgMTAuNGwtLjQ1IDEuNDUuNS4xNWMzLjE1IDEgNS42NSAyLjQ5IDcuOSA2Ljc1UzM1Ljc1IDI5LjA2IDM1LjI1IDM5bC0uMDUuNWgyLjI1bC4wNS0uNWMuNS0xMC4wNi0uODgtMTYuODUtMy4yNS0yMS4zNC0yLjM3LTQuNDktNS43OS02LjY0LTkuMTktNy4xNmwtLjUxLS4xeiIgZmlsbD0iI2VjZWNlYyIgc3Ryb2tlPSJub25lIi8+PC9nPjwvc3ZnPg==');
    }

    .pawn {
        background-image: url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0NSIgaGVpZ2h0PSI0NSI+PHBhdGggZD0iTTIyLjUgOWMtMi4yMSAwLTQgMS43OS00IDQgMCAuODkuMjkgMS43MS43OCAyLjM4QzE3LjMzIDE2LjUgMTYgMTguNTkgMTYgMjFjMCAyLjAzLjk0IDMuODQgMi40MSA1LjAzLTMgMS4wNi03LjQxIDUuNTUtNy40MSAxMy40N2gyM2MwLTcuOTItNC40MS0xMi40MS03LjQxLTEzLjQ3IDEuNDctMS4xOSAyLjQxLTMgMi40MS01LjAzIDAtMi40MS0xLjMzLTQuNS0zLjI4LTUuNjIuNDktLjY3Ljc4LTEuNDkuNzgtMi4zOCAwLTIuMjEtMS43OS00LTQtNHoiIHN0cm9rZT0iIzAwMCIgc3Ryb2tlLXdpZHRoPSIxLjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjwvc3ZnPg==');
    }

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

    .clock-self {
        margin-top: 10px;
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
        min-height: 20px;
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

    .winning-rules span {
        font-size: 14px;
        font-weight: 400;
    }

    @media only screen and (max-width: 950px) {
        .game-container {
            justify-content: space-around;
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        .side {
            width: 80%;
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
        }

        .reverse-clock-on-mobile {
            display: flex;
            flex-direction: column-reverse;
        }

        .clock-self {
            margin-top: 0px;
        }
    }
</style>