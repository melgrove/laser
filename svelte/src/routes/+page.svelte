<script>
    import Chessground from "../components/chessground.svelte"
    let winner = null;
    let reset;
</script>

<header>
    <span>LASER</span>
    <svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" height="50px" enable-background="new 0 0 612.35 226.771" xml:space="preserve" width="1006.175px" viewBox="0 0 6012.35 250.771">
        <polygon fill="#000dff" points="8012.35,108.29 151.556,108.29 186.289,98.983 186.718,98.869 184.176,89.386 148.318,98.994   214.222,60.944 209.314,52.441 143.41,90.49 169.346,64.555 169.658,64.242 162.716,57.3 136.468,83.548 174.517,17.645   166.015,12.736 127.965,78.64 137.458,43.21 137.572,42.782 128.09,40.24 118.481,76.099 118.481,0 108.663,0 108.663,76.099   99.055,40.24 89.571,42.782 99.178,78.636 61.352,13.119 61.13,12.736 52.628,17.645 90.678,83.55 64.741,57.612 64.428,57.3   57.485,64.241 83.735,90.491 17.832,52.441 12.922,60.943 78.826,98.993 43.397,89.5 42.969,89.386 40.427,98.869 75.587,108.29   0,108.29 0,118.48 75.588,118.48 40.855,127.788 40.428,127.902 42.969,137.386 78.828,127.777 13.306,165.605 12.923,165.828   17.832,174.33 83.733,136.282 57.485,162.528 64.428,169.471 90.678,143.222 52.849,208.743 52.628,209.127 61.131,214.034   99.181,148.131 89.572,183.988 99.056,186.53 108.663,150.676 108.663,226.771 118.481,226.771 118.481,150.677 127.974,186.102   128.088,186.529 137.572,183.988 127.964,148.129 166.015,214.035 174.517,209.125 136.47,143.226 162.402,169.159 162.716,169.471   169.658,162.528 143.41,136.281 209.312,174.33 214.222,165.828 148.317,127.778 183.748,137.271 184.176,137.386 186.718,127.902   151.558,118.48 8012.35,118.48 "/>
        </svg>
</header>
<div class={(winner ? "game-over " : "") + "game-container"}>
    <div class="chessground-wrapper">
        <p>
            Loading...
        </p>
        <Chessground bind:winner bind:reset/>
    </div>
</div>
{#if winner !== null}
    <div>Game over, {winner} wins</div>
    <button on:click={reset}>Reset</button>
{/if}

<style>
    .game-over {
        
    }

    .chessground-wrapper {
        padding: 5px 1px 1px 5px;
        background-color: black;
        position: relative;
    }

    .game-container {
        justify-content: center;
        display: flex;
    }

    header {
        display: flex;
        flex-direction: row;
        overflow: hidden;
        margin-bottom: 50px;
    }

    span {
        flex-shrink: 0;
        font-size: 40px;
        padding: 0 5px;
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
</style>