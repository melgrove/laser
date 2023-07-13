<script>
    import { isOnline, themeColor, nConnections } from "../stores/global.js";
</script>

<footer style={"background-color: " + $themeColor}>
    {#if $isOnline}
        <span>
            server online
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="white" viewBox="0 0 24 24"><path d="M20.285 2l-11.285 11.567-5.286-5.011-3.714 3.716 9 8.728 15-15.285z"/></svg>
            {`${$nConnections} connection${$nConnections === 1 ? "" : "s"}`}
        </span>
    {:else}
        <span>
            server offline
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="white" viewBox="0 0 24 24"><path d="M23 20.168l-8.185-8.187 8.185-8.174-2.832-2.807-8.182 8.179-8.176-8.179-2.81 2.81 8.186 8.196-8.186 8.184 2.81 2.81 8.203-8.192 8.18 8.192z"/></svg>
        </span>
    {/if}
    <a href="https://discord.gg/sB8sPMxTnV" target="_blank">
        join the discord
        <svg style="padding-top: 3px" width="12" height="12" fill="white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 127.14 96.36"><g id="Discord_Logos" data-name="Discord Logos"><g id="Discord_Logo_-_Large_-_White" data-name="Discord Logo - Large - White"><path class="cls-1" d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"/></g></g></svg>
    </a>
</footer>

<style>
    footer {
        min-height: 22px;
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        position: absolute;
        bottom: 0;
        width: 100%;
        align-items: center;
        padding: 0 4px;
    }

    footer span {
        font-size: 14px;
        color: white;
    }

    footer a {
        font-size: 14px;
        color: white;
    }
</style>