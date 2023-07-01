export default function API(onMessage, onOpen) {

    const socket = new WebSocket("wss://laser-production.up.railway.app");

    socket.addEventListener("open", () => {
        // fetch games
        socket.send(JSON.stringify({
            messageType: "games",
        }));
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