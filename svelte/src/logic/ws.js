export default function API(onMessage, onOpen) {

    const WS_URL = "wss://api.playlaser.xyz";
    //const WS_URL = "ws://localhost:4321";

    const socket = new WebSocket(WS_URL);

    socket.addEventListener("open", () => {
        // fetch games
        socket.send(JSON.stringify({
            messageType: "games",
        }));

        // ping every nine seconds to keep the connection alive (unclear how important this is)
        setInterval(() => {
            socket.send(JSON.stringify({
                messageType: "ping",
            }));
        }, 9_000);
    });
      
    // receive a message from the server
    socket.addEventListener("message", ({ data }) => {
        const parsed = JSON.parse(data);
        onMessage(parsed);
    });

    function send(type, data = null) {
        const obj = {
            messageType: type,
        };
        if(data) {
            obj.data = data;
        }
        socket.send(JSON.stringify(obj))
    }

    return {
        send,
    }

}