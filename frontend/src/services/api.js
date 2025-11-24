const API_URL = import.meta.env.VITE_API_URL;

export async function login(username, password) {
    const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
    });

    if (!res.ok) throw new Error("Credenciales inválidas");
    return await res.json();
}

// Función para obtener mensajes por sala y página
export async function fetchMessages(room, page = 1, token) {
    const limit = 20; // opcional, igual que backend
    const res = await fetch(`${API_URL}/messages/${room}?page=${page}&limit=${limit}`, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });

    if (!res.ok) throw new Error("Error obteniendo mensajes");

    return { messages: await res.json() };
}
