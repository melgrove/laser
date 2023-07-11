<script>
import { onMount } from "svelte";
import { Chessground } from 'chessground';
import { getLegalMoves, getSquaresBetween } from "../logic/laser.js";
import { isGameCreated, gameSettings, themeColor, defaultBrushes } from "../stores/global.js";
export let reset;
export let cg = {set: () => {}, move: () => {}};
export let syncMoves = () => {};
export let updateBoard = () => {};
export let initialFen = "7q/4pnk1/4prn1/5pp1/1PP5/1NRP4/1KNP4/Q7 b - - 0 1";
export let gameOver;
export let colorMap;
export let sendMessage;

let initialFenPremove = "7q/4pnk1/4prn1/5pp1/1PP5/1NRP4/1KNP4/Q7 w - - 0 1";
let chessgroundColor = colorMap[$gameSettings.color];
let fen = initialFen;
let legalMoves = getLegalMoves(fen);
let legalPremoves = getLegalMoves(initialFenPremove);

const initialConfig = {
    fen,
    turnColor: "black",
    orientation: chessgroundColor,
    coordinates: false,
    movable: {
        free: false,
        color: "both",
        dests: legalMoves,
        showDests: true,
    },
    premovable: {
        enabled: false,
        showDests: true,
        customDests: legalPremoves,
    },
};
let chessgroundElement;

onMount(() => {
    updateBoard = (orig, dest) => {
        // On move hook for API
        syncMoves([orig, dest]);
        // Move laser back if it has shot
        if(cg.state.pieces.get(dest).role === "queen" && orig[0] !== dest[0] && orig[1] !== dest[1]) {
            cg.set({animation: {enabled: false}})
            cg.move(dest, orig)
            cg.set({animation: {enabled: true}})
            // Remove pieces laser has shot
            const removalSquares = new Map();
            getSquaresBetween(orig, dest).forEach(square => removalSquares.set(square, undefined))
            cg.setPieces(removalSquares);
            // Laser arrow
            cg.setShapes([{
                orig,
                dest,
                brush: $themeColor
            }])
        }

        // Check for win condition
        // King taken
        let kings = new Set();
        cg.state.pieces.forEach(val => {
            if(val.role === "king") {
                kings.add(val.color);
            }
        });
        if(kings.size === 0) {
            // Broadcast draw
            sendMessage.endGame(true);
            return;
        }
        if(!kings.has("white")) {
            $gameSettings.color === "b" ? gameOver("b") : sendMessage.endGame(false);
            return;
        }
        if(!kings.has("black")) {
            $gameSettings.color === "w" ? gameOver("w") : sendMessage.endGame(false);
            return;
        }
        // Pawn reached other side
        const whiteWinSquares = ["h8", "h7", "h6", "h5", "g8", "f8", "e8"];
        const blackWinSquares = ["a1", "a2", "a3", "a4", "b1", "c1", "d1"];
        for(let square of whiteWinSquares) {
            const val = cg.state.pieces.get(square);
            if(val?.role === "pawn" && val?.color === "white") {
                $gameSettings.color === "w" ? gameOver("w") : sendMessage.endGame(false);
                return;
            }
        }
        for(let square of blackWinSquares) {
            const val = cg.state.pieces.get(square);
            if(val?.role === "pawn" && val?.color === "black") {
                $gameSettings.color === "b" ? gameOver("b") : sendMessage.endGame(false);
                return;
            }
        }


        // Calculate new legal moves
        const fen = `${cg.getFen()} ${$gameSettings.isPlaying ? ($gameSettings.turnColor === "b" ? "w" : "b") : cg.state.turnColor[0]} - - 0 1`;
        const premoveFen = `${cg.getFen()} ${$gameSettings.isPlaying ? ($gameSettings.turnColor) : cg.state.turnColor[0]} - - 0 1`
        $gameSettings.fen = fen
        const legalMoves = getLegalMoves(fen);
        const legalPremoves = getLegalMoves(premoveFen);
        cg.set({
            movable: {
                free: false,
                dests: legalMoves,
                showDests: true,
                events: {
                    after: updateBoard,
                },
            },
            premovable: {
                enabled: true,
                showDests: true,
                customDests: legalPremoves,
            },
            turnColor: colorMap[$gameSettings.isPlaying ? ($gameSettings.turnColor === "b" ? "w" : "b") : cg.state.turnColor[0]]
        });
    };
    reset = (resetGameState = false) => {
        // Reset game state
        if(resetGameState) {
            $gameSettings = {
                isPlaying: false,
                color: "b",
                fen: null,
                key: null,
                id: null,
                winner: null,
                turnColor: "b",
            };
        }
        // Prevent mutation
        const currentConfig = Object.assign({}, initialConfig);
        currentConfig.movable = Object.assign({}, initialConfig.movable);
        currentConfig.premovable = Object.assign({}, initialConfig.premovable);
        // Update color
        let chessgroundColor = colorMap[$gameSettings.color];
        currentConfig.orientation = chessgroundColor;
        currentConfig.movable.color = $gameSettings.isPlaying ? chessgroundColor : "both";
        currentConfig.premovable.enabled = true;

        // New chessground instance
        cg = Chessground(chessgroundElement, currentConfig);
        // Set function to fire after move
        cg.set({
            movable: {
                events: {
                    after: updateBoard
                }
            },
            // Add current color as brush
            drawable: {
                brushes: {
                    // Default brushes
                    ...defaultBrushes,
                    // New custom brush
                    [$themeColor]: {key: $themeColor, color: $themeColor, opacity: 1, lineWidth: 10}
                }
            }
        });
    }
    // Initial configuration
    reset(true);
})


</script>

<div class="cg-wrap cg-default-style" id="chessground" bind:this={chessgroundElement}></div>

<style>
#chessground {
    width: 500px;
    height: 500px;
}

@media only screen and (max-width: 1082px) {
    #chessground {
        width: 65vw;
        height: 65vw;
    }
}

@media only screen and (max-width: 650px) {
    #chessground {
        width: 95vw;
        height: 95vw;
    }
}

.cg-wrap {
width:100%;
aspect-ratio:1;
}

/*
* Board styling.
*
* As there is no bundler-agnostic way of including CSS files (please
* correct me if I'm wrong), the default Chessground styles are
* included here.
*/

/*
* chessground.base.css 
*/


.cg-default-style.cg-wrap {
box-sizing: content-box;
position: relative;
display: block;
}

.cg-default-style :global(cg-container) {
position: absolute;
width: 100%;
height: 100%;
display: block;
top: 0;
}

.cg-default-style :global(cg-board) {
position: absolute;
top: 0;
left: 0;
width: 100%;
height: 100%;
-webkit-user-select: none;
-moz-user-select: none;
-ms-user-select: none;
user-select: none;
line-height: 0;
background-size: cover;
}

.cg-default-style.cg-wrap.manipulable :global(cg-board) {
cursor: pointer;
}

.cg-default-style :global(cg-board square) {
position: absolute;
top: 0;
left: 0;
width: 12.5%;
height: 12.5%;
pointer-events: none;
}

.cg-default-style :global(cg-board square.move-dest) {
pointer-events: auto;
}

.cg-default-style :global(cg-board square.last-move) {
will-change: transform;
}

.cg-default-style.cg-wrap :global(piece) {
position: absolute;
top: 0;
left: 0;
width: 12.5%;
height: 12.5%;
background-size: cover;
z-index: 2;
will-change: transform;
pointer-events: none;
}

.cg-default-style :global(cg-board piece.dragging) {
cursor: move;
/* !important to override z-index from 3D piece inline style */
z-index: 11 !important;
}

.cg-default-style :global(piece.anim) {
z-index: 8;
}

.cg-default-style :global(piece.fading) {
z-index: 1;
opacity: 0.5;
}

.cg-default-style.cg-wrap :global(piece.ghost) {
opacity: 0.3;
}

.cg-default-style.cg-wrap :global(piece svg) {
overflow: hidden;
position: relative;
top: 0px;
left: 0px;
width: 100%;
height: 100%;
pointer-events: none;
z-index: 2;
opacity: 0.6;
}

.cg-default-style.cg-wrap :global(cg-auto-pieces),
.cg-default-style.cg-wrap :global(.cg-shapes),
.cg-default-style.cg-wrap :global(.cg-custom-svgs) {
overflow: visible;
position: absolute;
top: 0px;
left: 0px;
width: 100%;
height: 100%;
pointer-events: none;
}

.cg-default-style.cg-wrap :global(cg-auto-pieces) {
z-index: 2;
}

.cg-default-style.cg-wrap :global(cg-auto-pieces piece) {
opacity: 0.3;
}

.cg-default-style.cg-wrap :global(.cg-shapes) {
overflow: hidden;
opacity: 0.6;
z-index: 2;
}

.cg-default-style.cg-wrap :global(.cg-custom-svgs) {
/* over piece.anim = 8, but under piece.dragging = 11 */
z-index: 9;
}

.cg-default-style.cg-wrap :global(.cg-custom-svgs svg) {
overflow: visible;
}

.cg-default-style.cg-wrap :global(coords) {
position: absolute;
display: flex;
pointer-events: none;
opacity: 0.8;
font-family: sans-serif;
font-size: 9px;
}

.cg-default-style.cg-wrap :global(coords.ranks) {
left: 4px;
top: -20px;
flex-flow: column-reverse;
height: 100%;
width: 12px;
}

.cg-default-style.cg-wrap :global(coords.ranks.black) {
flex-flow: column;
}

.cg-default-style.cg-wrap :global(coords.ranks.left) {
left: -15px;
align-items: flex-end;
}

.cg-default-style.cg-wrap :global(coords.files) {
bottom: -4px;
left: 24px;
flex-flow: row;
width: 100%;
height: 16px;
text-transform: uppercase;
text-align: center;
}

.cg-default-style.cg-wrap :global(coords.files.black) {
flex-flow: row-reverse;
}

.cg-default-style.cg-wrap :global(coords coord) {
flex: 1 1 auto;
}

.cg-default-style.cg-wrap :global(coords.ranks coord) {
transform: translateY(39%);
}


/*
* chessground.cbrown.css - board appearence
*/

/** Colored board squares as an embedded SVG */
.cg-default-style :global(cg-board) {
background-color: #f0d9b5;
background-image: url('data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjxzdmcgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczp4PSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIgogICAgIHZpZXdCb3g9IjAgMCA4IDgiIHNoYXBlLXJlbmRlcmluZz0iY3Jpc3BFZGdlcyI+CjxnIGlkPSJhIj4KICA8ZyBpZD0iYiI+CiAgICA8ZyBpZD0iYyI+CiAgICAgIDxnIGlkPSJkIj4KICAgICAgICA8cmVjdCB3aWR0aD0iMSIgaGVpZ2h0PSIxIiBmaWxsPSIjZGVlM2U2IiBpZD0iZSIvPgogICAgICAgIDx1c2UgeD0iMSIgeT0iMSIgaHJlZj0iI2UiIHg6aHJlZj0iI2UiLz4KICAgICAgICA8cmVjdCB5PSIxIiB3aWR0aD0iMSIgaGVpZ2h0PSIxIiBmaWxsPSIjOGNhMmFkIiBpZD0iZiIvPgogICAgICAgIDx1c2UgeD0iMSIgeT0iLTEiIGhyZWY9IiNmIiB4OmhyZWY9IiNmIi8+CiAgICAgIDwvZz4KICAgICAgPHVzZSB4PSIyIiBocmVmPSIjZCIgeDpocmVmPSIjZCIvPgogICAgPC9nPgogICAgPHVzZSB4PSI0IiBocmVmPSIjYyIgeDpocmVmPSIjYyIvPgogIDwvZz4KICA8dXNlIHk9IjIiIGhyZWY9IiNiIiB4OmhyZWY9IiNiIi8+CjwvZz4KPHVzZSB5PSI0IiBocmVmPSIjYSIgeDpocmVmPSIjYSIvPgo8L3N2Zz4K');
}

/** Interactive board square colors */
.cg-default-style :global(square.move-dest) {
background: radial-gradient(rgba(20, 85, 30, 0.5) 22%, #208530 0, rgba(0, 0, 0, 0.3) 0, rgba(0, 0, 0, 0) 0);
}
.cg-default-style :global(square.premove-dest) {
background: radial-gradient(rgba(20, 30, 85, 0.5) 22%, #203085 0, rgba(0, 0, 0, 0.3) 0, rgba(0, 0, 0, 0) 0);
}
.cg-default-style :global(square.oc.move-dest) {
background: radial-gradient(transparent 0%, transparent 80%, rgba(20, 85, 0, 0.3) 80%);
}
.cg-default-style :global(square.oc.premove-dest) {
background: radial-gradient(transparent 0%, transparent 80%, rgba(20, 30, 85, 0.2) 80%);
}
.cg-default-style :global(square.move-dest:hover) {
background: rgba(20, 85, 30, 0.3);
}
.cg-default-style :global(square.premove-dest:hover) {
background: rgba(20, 30, 85, 0.2);
}
.cg-default-style :global(square.last-move) {
background-color: rgba(155, 199, 0, 0.41);
}
.cg-default-style :global(square.selected) {
background-color: rgba(20, 85, 30, 0.5);
}
.cg-default-style :global(square.check) {
background: radial-gradient(
ellipse at center,
rgba(255, 0, 0, 1) 0%,
rgba(231, 0, 0, 1) 25%,
rgba(169, 0, 0, 0) 89%,
rgba(158, 0, 0, 0) 100%
);
}
.cg-default-style :global(square.current-premove) {
background-color: rgba(20, 30, 85, 0.5);
}

/** Alternating colors in rank/file labels */
.cg-default-style.cg-wrap.orientation-white :global(coords.ranks coord:nth-child(2n)),
.cg-default-style.cg-wrap.orientation-white :global(coords.files coord:nth-child(2n)),
.cg-default-style.cg-wrap.orientation-black :global(coords.ranks coord:nth-child(2n + 1)),
.cg-default-style.cg-wrap.orientation-black :global(coords.files coord:nth-child(2n + 1)) {
color: rgba(72, 72, 72, 0.8);
}

.cg-default-style.cg-wrap.orientation-black :global(coords.ranks coord:nth-child(2n)),
.cg-default-style.cg-wrap.orientation-black :global(coords.files coord:nth-child(2n)),
.cg-default-style.cg-wrap.orientation-white :global(coords.ranks coord:nth-child(2n + 1)),
.cg-default-style.cg-wrap.orientation-white :global(coords.files coord:nth-child(2n + 1)) {
color: rgba(255, 255, 255, 0.8);
}


/*
* chessground.cburnett.css - embedded SVGs for all chess pieces
*/

.cg-default-style.cg-wrap :global(piece.pawn.white) {
background-image: url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0NSIgaGVpZ2h0PSI0NSI+PHBhdGggZD0iTTIyLjUgOWMtMi4yMSAwLTQgMS43OS00IDQgMCAuODkuMjkgMS43MS43OCAyLjM4QzE3LjMzIDE2LjUgMTYgMTguNTkgMTYgMjFjMCAyLjAzLjk0IDMuODQgMi40MSA1LjAzLTMgMS4wNi03LjQxIDUuNTUtNy40MSAxMy40N2gyM2MwLTcuOTItNC40MS0xMi40MS03LjQxLTEzLjQ3IDEuNDctMS4xOSAyLjQxLTMgMi40MS01LjAzIDAtMi40MS0xLjMzLTQuNS0zLjI4LTUuNjIuNDktLjY3Ljc4LTEuNDkuNzgtMi4zOCAwLTIuMjEtMS43OS00LTQtNHoiIGZpbGw9IiNmZmYiIHN0cm9rZT0iIzAwMCIgc3Ryb2tlLXdpZHRoPSIxLjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjwvc3ZnPg==');
}
.cg-default-style.cg-wrap :global(piece.bishop.white) {
background-image: url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0NSIgaGVpZ2h0PSI0NSI+PGcgZmlsbD0ibm9uZSIgZmlsbC1ydWxlPSJldmVub2RkIiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iMS41IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxnIGZpbGw9IiNmZmYiIHN0cm9rZS1saW5lY2FwPSJidXR0Ij48cGF0aCBkPSJNOSAzNmMzLjM5LS45NyAxMC4xMS40MyAxMy41LTIgMy4zOSAyLjQzIDEwLjExIDEuMDMgMTMuNSAyIDAgMCAxLjY1LjU0IDMgMi0uNjguOTctMS42NS45OS0zIC41LTMuMzktLjk3LTEwLjExLjQ2LTEzLjUtMS0zLjM5IDEuNDYtMTAuMTEuMDMtMTMuNSAxLTEuMzU0LjQ5LTIuMzIzLjQ3LTMtLjUgMS4zNTQtMS45NCAzLTIgMy0yeiIvPjxwYXRoIGQ9Ik0xNSAzMmMyLjUgMi41IDEyLjUgMi41IDE1IDAgLjUtMS41IDAtMiAwLTIgMC0yLjUtMi41LTQtMi41LTQgNS41LTEuNSA2LTExLjUtNS0xNS41LTExIDQtMTAuNSAxNC01IDE1LjUgMCAwLTIuNSAxLjUtMi41IDQgMCAwLS41LjUgMCAyeiIvPjxwYXRoIGQ9Ik0yNSA4YTIuNSAyLjUgMCAxIDEtNSAwIDIuNSAyLjUgMCAxIDEgNSAweiIvPjwvZz48cGF0aCBkPSJNMTcuNSAyNmgxME0xNSAzMGgxNW0tNy41LTE0LjV2NU0yMCAxOGg1IiBzdHJva2UtbGluZWpvaW49Im1pdGVyIi8+PC9nPjwvc3ZnPg==');
}
.cg-default-style.cg-wrap :global(piece.knight.white) {
background-image: url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0NSIgaGVpZ2h0PSI0NSI+PGcgZmlsbD0ibm9uZSIgZmlsbC1ydWxlPSJldmVub2RkIiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iMS41IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwYXRoIGQ9Ik0yMiAxMGMxMC41IDEgMTYuNSA4IDE2IDI5SDE1YzAtOSAxMC02LjUgOC0yMSIgZmlsbD0iI2ZmZiIvPjxwYXRoIGQ9Ik0yNCAxOGMuMzggMi45MS01LjU1IDcuMzctOCA5LTMgMi0yLjgyIDQuMzQtNSA0LTEuMDQyLS45NCAxLjQxLTMuMDQgMC0zLTEgMCAuMTkgMS4yMy0xIDItMSAwLTQuMDAzIDEtNC00IDAtMiA2LTEyIDYtMTJzMS44OS0xLjkgMi0zLjVjLS43My0uOTk0LS41LTItLjUtMyAxLTEgMyAyLjUgMyAyLjVoMnMuNzgtMS45OTIgMi41LTNjMSAwIDEgMyAxIDMiIGZpbGw9IiNmZmYiLz48cGF0aCBkPSJNOS41IDI1LjVhLjUuNSAwIDEgMS0xIDAgLjUuNSAwIDEgMSAxIDB6bTUuNDMzLTkuNzVhLjUgMS41IDMwIDEgMS0uODY2LS41LjUgMS41IDMwIDEgMSAuODY2LjV6IiBmaWxsPSIjMDAwIi8+PC9nPjwvc3ZnPg==');
}
.cg-default-style.cg-wrap :global(piece.rook.white) {
background-image: url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0NSIgaGVpZ2h0PSI0NSI+PGcgZmlsbD0iI2ZmZiIgZmlsbC1ydWxlPSJldmVub2RkIiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iMS41IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwYXRoIGQ9Ik05IDM5aDI3di0zSDl2M3ptMy0zdi00aDIxdjRIMTJ6bS0xLTIyVjloNHYyaDVWOWg1djJoNVY5aDR2NSIgc3Ryb2tlLWxpbmVjYXA9ImJ1dHQiLz48cGF0aCBkPSJNMzQgMTRsLTMgM0gxNGwtMy0zIi8+PHBhdGggZD0iTTMxIDE3djEyLjVIMTRWMTciIHN0cm9rZS1saW5lY2FwPSJidXR0IiBzdHJva2UtbGluZWpvaW49Im1pdGVyIi8+PHBhdGggZD0iTTMxIDI5LjVsMS41IDIuNWgtMjBsMS41LTIuNSIvPjxwYXRoIGQ9Ik0xMSAxNGgyMyIgZmlsbD0ibm9uZSIgc3Ryb2tlLWxpbmVqb2luPSJtaXRlciIvPjwvZz48L3N2Zz4=');
}
.cg-default-style.cg-wrap :global(piece.queen.white) {
background-image: url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0NSIgaGVpZ2h0PSI0NSI+PGcgZmlsbD0iI2ZmZiIgZmlsbC1ydWxlPSJldmVub2RkIiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iMS41IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwYXRoIGQ9Ik04IDEyYTIgMiAwIDEgMS00IDAgMiAyIDAgMSAxIDQgMHptMTYuNS00LjVhMiAyIDAgMSAxLTQgMCAyIDIgMCAxIDEgNCAwek00MSAxMmEyIDIgMCAxIDEtNCAwIDIgMiAwIDEgMSA0IDB6TTE2IDguNWEyIDIgMCAxIDEtNCAwIDIgMiAwIDEgMSA0IDB6TTMzIDlhMiAyIDAgMSAxLTQgMCAyIDIgMCAxIDEgNCAweiIvPjxwYXRoIGQ9Ik05IDI2YzguNS0xLjUgMjEtMS41IDI3IDBsMi0xMi03IDExVjExbC01LjUgMTMuNS0zLTE1LTMgMTUtNS41LTE0VjI1TDcgMTRsMiAxMnoiIHN0cm9rZS1saW5lY2FwPSJidXR0Ii8+PHBhdGggZD0iTTkgMjZjMCAyIDEuNSAyIDIuNSA0IDEgMS41IDEgMSAuNSAzLjUtMS41IDEtMS41IDIuNS0xLjUgMi41LTEuNSAxLjUuNSAyLjUuNSAyLjUgNi41IDEgMTYuNSAxIDIzIDAgMCAwIDEuNS0xIDAtMi41IDAgMCAuNS0xLjUtMS0yLjUtLjUtMi41LS41LTIgLjUtMy41IDEtMiAyLjUtMiAyLjUtNC04LjUtMS41LTE4LjUtMS41LTI3IDB6IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPjxwYXRoIGQ9Ik0xMS41IDMwYzMuNS0xIDE4LjUtMSAyMiAwTTEyIDMzLjVjNi0xIDE1LTEgMjEgMCIgZmlsbD0ibm9uZSIvPjwvZz48L3N2Zz4=');
}
.cg-default-style.cg-wrap :global(piece.king.white) {
background-image: url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0NSIgaGVpZ2h0PSI0NSI+PGcgZmlsbD0ibm9uZSIgZmlsbC1ydWxlPSJldmVub2RkIiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iMS41IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwYXRoIGQ9Ik0yMi41IDExLjYzVjZNMjAgOGg1IiBzdHJva2UtbGluZWpvaW49Im1pdGVyIi8+PHBhdGggZD0iTTIyLjUgMjVzNC41LTcuNSAzLTEwLjVjMCAwLTEtMi41LTMtMi41cy0zIDIuNS0zIDIuNWMtMS41IDMgMyAxMC41IDMgMTAuNSIgZmlsbD0iI2ZmZiIgc3Ryb2tlLWxpbmVjYXA9ImJ1dHQiIHN0cm9rZS1saW5lam9pbj0ibWl0ZXIiLz48cGF0aCBkPSJNMTEuNSAzN2M1LjUgMy41IDE1LjUgMy41IDIxIDB2LTdzOS00LjUgNi0xMC41Yy00LTYuNS0xMy41LTMuNS0xNiA0VjI3di0zLjVjLTMuNS03LjUtMTMtMTAuNS0xNi00LTMgNiA1IDEwIDUgMTBWMzd6IiBmaWxsPSIjZmZmIi8+PHBhdGggZD0iTTExLjUgMzBjNS41LTMgMTUuNS0zIDIxIDBtLTIxIDMuNWM1LjUtMyAxNS41LTMgMjEgMG0tMjEgMy41YzUuNS0zIDE1LjUtMyAyMSAwIi8+PC9nPjwvc3ZnPg==');
}
.cg-default-style.cg-wrap :global(piece.pawn.black) {
background-image: url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0NSIgaGVpZ2h0PSI0NSI+PHBhdGggZD0iTTIyLjUgOWMtMi4yMSAwLTQgMS43OS00IDQgMCAuODkuMjkgMS43MS43OCAyLjM4QzE3LjMzIDE2LjUgMTYgMTguNTkgMTYgMjFjMCAyLjAzLjk0IDMuODQgMi40MSA1LjAzLTMgMS4wNi03LjQxIDUuNTUtNy40MSAxMy40N2gyM2MwLTcuOTItNC40MS0xMi40MS03LjQxLTEzLjQ3IDEuNDctMS4xOSAyLjQxLTMgMi40MS01LjAzIDAtMi40MS0xLjMzLTQuNS0zLjI4LTUuNjIuNDktLjY3Ljc4LTEuNDkuNzgtMi4zOCAwLTIuMjEtMS43OS00LTQtNHoiIHN0cm9rZT0iIzAwMCIgc3Ryb2tlLXdpZHRoPSIxLjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjwvc3ZnPg==');
}
.cg-default-style.cg-wrap :global(piece.bishop.black) {
background-image: url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0NSIgaGVpZ2h0PSI0NSI+PGcgZmlsbD0ibm9uZSIgZmlsbC1ydWxlPSJldmVub2RkIiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iMS41IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxnIGZpbGw9IiMwMDAiIHN0cm9rZS1saW5lY2FwPSJidXR0Ij48cGF0aCBkPSJNOSAzNmMzLjM5LS45NyAxMC4xMS40MyAxMy41LTIgMy4zOSAyLjQzIDEwLjExIDEuMDMgMTMuNSAyIDAgMCAxLjY1LjU0IDMgMi0uNjguOTctMS42NS45OS0zIC41LTMuMzktLjk3LTEwLjExLjQ2LTEzLjUtMS0zLjM5IDEuNDYtMTAuMTEuMDMtMTMuNSAxLTEuMzU0LjQ5LTIuMzIzLjQ3LTMtLjUgMS4zNTQtMS45NCAzLTIgMy0yeiIvPjxwYXRoIGQ9Ik0xNSAzMmMyLjUgMi41IDEyLjUgMi41IDE1IDAgLjUtMS41IDAtMiAwLTIgMC0yLjUtMi41LTQtMi41LTQgNS41LTEuNSA2LTExLjUtNS0xNS41LTExIDQtMTAuNSAxNC01IDE1LjUgMCAwLTIuNSAxLjUtMi41IDQgMCAwLS41LjUgMCAyeiIvPjxwYXRoIGQ9Ik0yNSA4YTIuNSAyLjUgMCAxIDEtNSAwIDIuNSAyLjUgMCAxIDEgNSAweiIvPjwvZz48cGF0aCBkPSJNMTcuNSAyNmgxME0xNSAzMGgxNW0tNy41LTE0LjV2NU0yMCAxOGg1IiBzdHJva2U9IiNlY2VjZWMiIHN0cm9rZS1saW5lam9pbj0ibWl0ZXIiLz48L2c+PC9zdmc+');
}
.cg-default-style.cg-wrap :global(piece.knight.black) {
background-image: url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0NSIgaGVpZ2h0PSI0NSI+PGcgZmlsbD0ibm9uZSIgZmlsbC1ydWxlPSJldmVub2RkIiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iMS41IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwYXRoIGQ9Ik0yMiAxMGMxMC41IDEgMTYuNSA4IDE2IDI5SDE1YzAtOSAxMC02LjUgOC0yMSIgZmlsbD0iIzAwMCIvPjxwYXRoIGQ9Ik0yNCAxOGMuMzggMi45MS01LjU1IDcuMzctOCA5LTMgMi0yLjgyIDQuMzQtNSA0LTEuMDQyLS45NCAxLjQxLTMuMDQgMC0zLTEgMCAuMTkgMS4yMy0xIDItMSAwLTQuMDAzIDEtNC00IDAtMiA2LTEyIDYtMTJzMS44OS0xLjkgMi0zLjVjLS43My0uOTk0LS41LTItLjUtMyAxLTEgMyAyLjUgMyAyLjVoMnMuNzgtMS45OTIgMi41LTNjMSAwIDEgMyAxIDMiIGZpbGw9IiMwMDAiLz48cGF0aCBkPSJNOS41IDI1LjVhLjUuNSAwIDEgMS0xIDAgLjUuNSAwIDEgMSAxIDB6bTUuNDMzLTkuNzVhLjUgMS41IDMwIDEgMS0uODY2LS41LjUgMS41IDMwIDEgMSAuODY2LjV6IiBmaWxsPSIjZWNlY2VjIiBzdHJva2U9IiNlY2VjZWMiLz48cGF0aCBkPSJNMjQuNTUgMTAuNGwtLjQ1IDEuNDUuNS4xNWMzLjE1IDEgNS42NSAyLjQ5IDcuOSA2Ljc1UzM1Ljc1IDI5LjA2IDM1LjI1IDM5bC0uMDUuNWgyLjI1bC4wNS0uNWMuNS0xMC4wNi0uODgtMTYuODUtMy4yNS0yMS4zNC0yLjM3LTQuNDktNS43OS02LjY0LTkuMTktNy4xNmwtLjUxLS4xeiIgZmlsbD0iI2VjZWNlYyIgc3Ryb2tlPSJub25lIi8+PC9nPjwvc3ZnPg==');
}
.cg-default-style.cg-wrap :global(piece.rook.black) {
background-image: url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0NSIgaGVpZ2h0PSI0NSI+PGcgZmlsbC1ydWxlPSJldmVub2RkIiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iMS41IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwYXRoIGQ9Ik05IDM5aDI3di0zSDl2M3ptMy41LTdsMS41LTIuNWgxN2wxLjUgMi41aC0yMHptLS41IDR2LTRoMjF2NEgxMnoiIHN0cm9rZS1saW5lY2FwPSJidXR0Ii8+PHBhdGggZD0iTTE0IDI5LjV2LTEzaDE3djEzSDE0eiIgc3Ryb2tlLWxpbmVjYXA9ImJ1dHQiIHN0cm9rZS1saW5lam9pbj0ibWl0ZXIiLz48cGF0aCBkPSJNMTQgMTYuNUwxMSAxNGgyM2wtMyAyLjVIMTR6TTExIDE0VjloNHYyaDVWOWg1djJoNVY5aDR2NUgxMXoiIHN0cm9rZS1saW5lY2FwPSJidXR0Ii8+PHBhdGggZD0iTTEyIDM1LjVoMjFtLTIwLTRoMTltLTE4LTJoMTdtLTE3LTEzaDE3TTExIDE0aDIzIiBmaWxsPSJub25lIiBzdHJva2U9IiNlY2VjZWMiIHN0cm9rZS13aWR0aD0iMSIgc3Ryb2tlLWxpbmVqb2luPSJtaXRlciIvPjwvZz48L3N2Zz4=');
}
.cg-default-style.cg-wrap :global(piece.queen.black) {
background-image: url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0NSIgaGVpZ2h0PSI0NSI+PGcgZmlsbC1ydWxlPSJldmVub2RkIiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iMS41IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxnIHN0cm9rZT0ibm9uZSI+PGNpcmNsZSBjeD0iNiIgY3k9IjEyIiByPSIyLjc1Ii8+PGNpcmNsZSBjeD0iMTQiIGN5PSI5IiByPSIyLjc1Ii8+PGNpcmNsZSBjeD0iMjIuNSIgY3k9IjgiIHI9IjIuNzUiLz48Y2lyY2xlIGN4PSIzMSIgY3k9IjkiIHI9IjIuNzUiLz48Y2lyY2xlIGN4PSIzOSIgY3k9IjEyIiByPSIyLjc1Ii8+PC9nPjxwYXRoIGQ9Ik05IDI2YzguNS0xLjUgMjEtMS41IDI3IDBsMi41LTEyLjVMMzEgMjVsLS4zLTE0LjEtNS4yIDEzLjYtMy0xNC41LTMgMTQuNS01LjItMTMuNkwxNCAyNSA2LjUgMTMuNSA5IDI2eiIgc3Ryb2tlLWxpbmVjYXA9ImJ1dHQiLz48cGF0aCBkPSJNOSAyNmMwIDIgMS41IDIgMi41IDQgMSAxLjUgMSAxIC41IDMuNS0xLjUgMS0xLjUgMi41LTEuNSAyLjUtMS41IDEuNS41IDIuNS41IDIuNSA2LjUgMSAxNi41IDEgMjMgMCAwIDAgMS41LTEgMC0yLjUgMCAwIC41LTEuNS0xLTIuNS0uNS0yLjUtLjUtMiAuNS0zLjUgMS0yIDIuNS0yIDIuNS00LTguNS0xLjUtMTguNS0xLjUtMjcgMHoiIHN0cm9rZS1saW5lY2FwPSJidXR0Ii8+PHBhdGggZD0iTTExIDM4LjVhMzUgMzUgMSAwIDAgMjMgMCIgZmlsbD0ibm9uZSIgc3Ryb2tlLWxpbmVjYXA9ImJ1dHQiLz48cGF0aCBkPSJNMTEgMjlhMzUgMzUgMSAwIDEgMjMgMG0tMjEuNSAyLjVoMjBtLTIxIDNhMzUgMzUgMSAwIDAgMjIgMG0tMjMgM2EzNSAzNSAxIDAgMCAyNCAwIiBmaWxsPSJub25lIiBzdHJva2U9IiNlY2VjZWMiLz48L2c+PC9zdmc+');
}
.cg-default-style.cg-wrap :global(piece.king.black) {
background-image: url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0NSIgaGVpZ2h0PSI0NSI+PGcgZmlsbD0ibm9uZSIgZmlsbC1ydWxlPSJldmVub2RkIiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iMS41IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwYXRoIGQ9Ik0yMi41IDExLjYzVjYiIHN0cm9rZS1saW5lam9pbj0ibWl0ZXIiLz48cGF0aCBkPSJNMjIuNSAyNXM0LjUtNy41IDMtMTAuNWMwIDAtMS0yLjUtMy0yLjVzLTMgMi41LTMgMi41Yy0xLjUgMyAzIDEwLjUgMyAxMC41IiBmaWxsPSIjMDAwIiBzdHJva2UtbGluZWNhcD0iYnV0dCIgc3Ryb2tlLWxpbmVqb2luPSJtaXRlciIvPjxwYXRoIGQ9Ik0xMS41IDM3YzUuNSAzLjUgMTUuNSAzLjUgMjEgMHYtN3M5LTQuNSA2LTEwLjVjLTQtNi41LTEzLjUtMy41LTE2IDRWMjd2LTMuNWMtMy41LTcuNS0xMy0xMC41LTE2LTQtMyA2IDUgMTAgNSAxMFYzN3oiIGZpbGw9IiMwMDAiLz48cGF0aCBkPSJNMjAgOGg1IiBzdHJva2UtbGluZWpvaW49Im1pdGVyIi8+PHBhdGggZD0iTTMyIDI5LjVzOC41LTQgNi4wMy05LjY1QzM0LjE1IDE0IDI1IDE4IDIyLjUgMjQuNWwuMDEgMi4xLS4wMS0yLjFDMjAgMTggOS45MDYgMTQgNi45OTcgMTkuODVjLTIuNDk3IDUuNjUgNC44NTMgOSA0Ljg1MyA5IiBzdHJva2U9IiNlY2VjZWMiLz48cGF0aCBkPSJNMTEuNSAzMGM1LjUtMyAxNS41LTMgMjEgMG0tMjEgMy41YzUuNS0zIDE1LjUtMyAyMSAwbS0yMSAzLjVjNS41LTMgMTUuNS0zIDIxIDAiIHN0cm9rZT0iI2VjZWNlYyIvPjwvZz48L3N2Zz4=');
}
</style>