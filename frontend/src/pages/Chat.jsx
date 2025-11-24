import { useEffect, useState, useRef } from "react";
import { connectSocket, getSocket } from "../services/socket";
import { fetchMessages } from "../services/api";

export default function Chat() {
    const [message, setMessage] = useState("");
    const [messages, setMessages] = useState([]);
    const [typingUsers, setTypingUsers] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [currentRoom, setCurrentRoom] = useState(null);
    const [page, setPage] = useState(1);
    const token = localStorage.getItem("token");
    const userId = parseInt(localStorage.getItem("userId"));
    const messagesEndRef = useRef(null);
    const passwordRef = useRef("");
    const TYPING_TIMEOUT = 1500;
    const typingTimeoutRef = useRef(null);

    const socket = getSocket() || connectSocket(token);

    const scrollToBottom = () => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    };

    useEffect(() => {
        socket.on("connect", () => {
            if (currentRoom) {
                socket.emit("join_room", { room: currentRoom, password: passwordRef.current });
            }
        });

        socket.on("new_message", (msg) => {
            if (msg.room === currentRoom) {
                setMessages(prev => [...prev, msg]);
            }
        });

        socket.on("system_message", (msgObj) => {
            setMessages(prev => [...prev, { from: "Sistema", text: msgObj.text || msgObj }]);
        });

        socket.on("message_history", (history) => {
            const sorted = [...history].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            setMessages(sorted);
        });

        socket.on("user_typing", ({ username }) => {
            setTypingUsers(prev => prev.includes(username) ? prev : [...prev, username]);
        });

        socket.on("user_stop_typing", ({ username }) => {
            setTypingUsers(prev => prev.filter(u => u !== username));
        });

        return () => {
            socket.off("connect");
            socket.off("new_message");
            socket.off("system_message");
            socket.off("user_typing");
            socket.off("user_stop_typing");
        };
    }, [currentRoom]);


    useEffect(() => {
        const loadRooms = async () => {
            try {
                const res = await fetch(`${import.meta.env.VITE_API_URL}/rooms`, {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                const data = await res.json();
                setRooms(data);
            } catch (err) {
                console.error("Error cargando salas:", err);
            }
        };
        loadRooms();
    }, []);

    useEffect(() => scrollToBottom(), [messages]);


    const handleTyping = (text) => {
        setMessage(text);
        if (!currentRoom) return;
        socket.emit("typing", { room: currentRoom });

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => socket.emit("stop_typing", { room: currentRoom }), TYPING_TIMEOUT);
    };

    const sendMessage = () => {
        if (!message.trim() || !currentRoom) return;
        socket.emit("send_message", { room: currentRoom, text: message });
        socket.emit("stop_typing", { room: currentRoom });
        setMessage("");
    };

    const joinRoom = (roomName, password = "") => {
        if (currentRoom) {
            socket.emit("leave_room", { room: currentRoom });
        }

        passwordRef.current = password || ""; // guardar la contraseña para reintentos

        socket.emit("join_room", {
            room: roomName,
            password: passwordRef.current.trim()
        });

        setCurrentRoom(roomName);
        setMessages([]);
        setTypingUsers([]);
    };

    const createRoom = async (name, type, password) => {
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/rooms`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ name, type, password, ownerId: userId })
            });
            const data = await res.json();
            setRooms(prev => [...prev, data.room]);
        } catch (err) {
            console.error("Error creando sala:", err);
        }
    };

    const deleteRoom = async (roomId) => {
        try {
            await fetch(`${import.meta.env.VITE_API_URL}/rooms/${roomId}`, {
                method: "DELETE",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "x-user-id": userId
                }
            });

            setRooms(prev => prev.filter(r => r.id !== roomId));

            if (rooms.find(r => r.id === roomId)?.name === currentRoom) {
                setCurrentRoom(null);
                setMessages([]);
            }
        } catch (err) {
            console.error("Error eliminando sala:", err);
        }
    };

    return (
        <div style={{ padding: 20 }}>
            <h2>Chat</h2>

            {/* LISTA DE SALAS */}
            <div style={{ marginBottom: 15 }}>
                <h4>Salas disponibles</h4>
                <ul style={{ listStyle: "none", padding: 0 }}>
                    {rooms.map(r => (
                        <li key={r.id} style={{ marginBottom: 8 }}>
                            <strong>{r.name}</strong> ({r.type}){" "}
                            {r.type === "private" ? (
                                <button onClick={() => {
                                    const pass = prompt(`Contraseña para ${r.name}:`) || "";
                                    joinRoom(r.name, pass);
                                }}>Entrar</button>
                            ) : (
                                <button onClick={() => joinRoom(r.name)}>Entrar</button>
                            )}
                            {r.ownerId === userId && (
                                <button
                                    onClick={() => deleteRoom(r.id)}
                                    style={{ marginLeft: 5, backgroundColor: "red", color: "white", cursor: "pointer" }}
                                >
                                    Eliminar
                                </button>
                            )}
                        </li>
                    ))}
                </ul>

                {/* CREAR SALA */}
                <h4>Crear sala</h4>
                <input placeholder="Nombre" id="newRoomName" />
                <select id="newRoomType">
                    <option value="public">Pública</option>
                    <option value="private">Privada</option>
                </select>
                <input placeholder="Contraseña (si privada)" id="newRoomPassword" />
                <button onClick={() => createRoom(
                    document.getElementById("newRoomName").value,
                    document.getElementById("newRoomType").value,
                    document.getElementById("newRoomPassword").value
                )}>Crear</button>
            </div>

            {/* CHAT */}
            {currentRoom && (
                <>
                    <h3>Sala: {currentRoom}</h3>
                    <div style={{ border: "1px solid", height: 300, overflowY: "auto", padding: 5 }}>
                        {messages.map((msg, i) => (
                            <div key={i}><strong>{msg.from}:</strong> {msg.text}</div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>

                    {typingUsers.length > 0 && (
                        <p style={{ fontStyle: "italic" }}>
                            {typingUsers.join(", ")} está escribiendo...
                        </p>
                    )}

                    <input value={message} onChange={e => handleTyping(e.target.value)}
                        style={{ width: "75%" }}
                        onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                        placeholder="Escribe tu mensaje..." />

                    <button onClick={sendMessage}>Enviar</button>
                </>
            )}
        </div>
    );
}
