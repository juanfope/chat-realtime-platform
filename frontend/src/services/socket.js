import { io } from "socket.io-client";

let socket = null;

export function connectSocket(token) {
    if (socket) return socket; // Reutiliza si ya está conectado

    socket = io(import.meta.env.VITE_WS_URL, {
        auth: { token }
    });

    return socket;
}

export function getSocket() {
    return socket;
}
