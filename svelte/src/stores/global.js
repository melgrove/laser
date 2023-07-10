import { readable, writable } from 'svelte/store';

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

// no need for store
export const defaultBrushes = {
    green: { key: 'g', color: '#15781B', opacity: 1, lineWidth: 10 },
    red: { key: 'r', color: '#882020', opacity: 1, lineWidth: 10 },
    blue: { key: 'b', color: '#003088', opacity: 1, lineWidth: 10 },
    yellow: { key: 'y', color: '#e68f00', opacity: 1, lineWidth: 10 },
    paleBlue: { key: 'pb', color: '#003088', opacity: 0.4, lineWidth: 15 },
    paleGreen: { key: 'pg', color: '#15781B', opacity: 0.4, lineWidth: 15 },
    paleRed: { key: 'pr', color: '#882020', opacity: 0.4, lineWidth: 15 },
    paleGrey: {
        key: 'pgr',
        color: '#4a4a4a',
        opacity: 0.35,
        lineWidth: 15,
    },
};

export const timeOfServerTimes = writable(null);