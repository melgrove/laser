import { isMuted } from "../stores/global.js";
import { get } from "svelte/store";

const urls = {
    laser: "Laser2.mp3",
    notify: "GenericNotify.mp3",
    move: "Move.mp3",
    capture: "Capture.mp3",
};

export function playSound(type) {
    if(!get(isMuted)) {
        const el = new Audio(urls[type]);
        el.play().finally(() => {
            el.remove();
        });
    }
}