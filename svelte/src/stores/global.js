import { writable } from 'svelte/store';

export const isOnline = writable(false);
export const isGameCreated = writable(false);
export const themeColor = writable("#0000FF");
export const playerName = writable("");
export const nConnections = writable(null);

export const gameSettings = writable({
    isPlaying: false,
    color: "b",
    fen: null,
    key: null,
    id: null,
    turnColor: "b",
    winner: null,
})

export const opponentName = writable("");
export const opponentTime = writable(null);
export const playerTime = writable(null);