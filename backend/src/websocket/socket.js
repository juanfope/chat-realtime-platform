const { Server } = require("socket.io");
const amqp = require("amqplib");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { Message, Room, User } = require("../../models");
const {
    userConnected,
    userDisconnected,
    joinRoom,
    leaveRoom,
    getRoomUsers
} = require("../services/presence.service");

let io;

async function setupRabbitMQ() {
    const connection = await amqp.connect("amqp://admin:admin@localhost");
    const channel = await connection.createChannel();
    await channel.assertQueue("chat_messages");
    return channel;
}

async function initSocket(server) {

    io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"],
            allowedHeaders: ["Authorization"],
            credentials: false,
        }
    });

    const channel = await setupRabbitMQ();

    // middleware auth
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth?.token;
            if (!token) return next(new Error("Token requerido"));

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findByPk(decoded.id);

            if (!user) return next(new Error("Usuario no existe"));

            socket.user = user;
            next();
        } catch (err) {
            console.error("Error auth:", err);
            next(new Error("Token inválido"));
        }
    });

    // conexión
    io.on("connection", (socket) => {
        userConnected(socket.user, socket.id);
        io.emit("user_online", { id: socket.user.id, username: socket.user.username });

        console.log(`🟢 Usuario conectado: ${socket.user.username}`);

        // --- JOIN ROOM ---
        socket.on("join_room", async ({ room, password }) => {
            try {
                const roomData = await Room.findOne({ where: { name: room } });

                if (!roomData) return socket.emit("system_message", `La sala "${room}" no existe.`);

                if (roomData.type === "private") {
                    if (!password) return socket.emit("system_message", `Contraseña requerida.`);

                    const validPass = await bcrypt.compare(password, roomData.password);
                    if (!validPass) return socket.emit("system_message", `Contraseña incorrecta.`);
                }

                // 🔥 FIX — Primero cargamos mensajes, luego join
                const history = await Message.findAll({
                    where: { room },
                    order: [["createdAt", "ASC"]],
                    limit: 50
                });

                // 👇 Esto asegura que el usuario reciba también mensajes enviados justo antes de entrar
                socket.emit("message_history", history);

                // Ahora sí entra
                socket.join(room);
                joinRoom(socket.user.id, room);

                io.to(room).emit("room_users", getRoomUsers(room));
                io.to(room).emit("system_message", `${socket.user.username} entró a "${room}"`);

            } catch (error) {
                console.error(error);
                socket.emit("system_message", "Error al intentar acceder a la sala.");
            }
        });

        // --- SEND MESSAGE ---
        socket.on("send_message", async (data) => {
            const payload = {
                room: data.room,
                text: data.text,
                from: socket.user.username,
                timestamp: new Date().toISOString()
            };

            await channel.sendToQueue("chat_messages", Buffer.from(JSON.stringify(payload)));

            await Message.create({
                room: payload.room,
                from: payload.from,
                text: payload.text
            });
        });

        // typing events
        socket.on("typing", ({ room }) => {
            socket.to(room).emit("user_typing", {
                id: socket.user.id,
                username: socket.user.username
            });
        });

        socket.on("stop_typing", ({ room }) => {
            socket.to(room).emit("user_stop_typing", {
                id: socket.user.id
            });
        });

        socket.on("disconnect", () => {
            userDisconnected(socket.user.id);
            io.emit("user_offline", { id: socket.user.id });
            console.log(`🔴 Usuario desconectado: ${socket.user.username}`);
        });
    });

    // RabbitMQ -> enviar mensajes a sala
    channel.consume("chat_messages", (msg) => {
        const message = JSON.parse(msg.content.toString());
        io.to(message.room).emit("new_message", message);
    });
}

module.exports = initSocket;
