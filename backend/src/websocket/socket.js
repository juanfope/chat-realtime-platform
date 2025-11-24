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
let channel;
const QUEUE = "chat_messages";

async function setupRabbitMQ() {
    const connection = await amqp.connect("amqp://admin:admin@localhost");
    const ch = await connection.createChannel();
    await ch.assertQueue(QUEUE, { durable: true });
    return ch;
}

async function initSocket(server) {

    io = new Server(server, {
        cors: { origin: "*" }
    });

    console.log("Inicializando RabbitMQ...");
    channel = await setupRabbitMQ();
    console.log("RabbitMQ listo, queue:", QUEUE);


    channel.consume(
        QUEUE,
        async (msg) => {
            if (!msg) return;
            try {
                const parsed = JSON.parse(msg.content.toString());
                console.log("RabbitMQ -> recibido:", parsed);

                io.to(parsed.room).emit("new_message", parsed);

                channel.ack(msg);
            } catch (err) {
                console.error("ERROR en consumer:", err);
                try { channel.ack(msg); } catch (e) { }
            }
        },
        { noAck: false }
    );


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
            next(new Error("Token inválido"));
        }
    });


    io.on("connection", (socket) => {
        console.log(`🟢 Conectado: ${socket.user.username}`);
        userConnected(socket.user, socket.id);
        io.emit("user_online", { id: socket.user.id, username: socket.user.username });


        socket.on("join_room", async ({ room, password }) => {
            try {
                console.log(`🔑 ${socket.user.username} intenta unirse a sala: ${room}`);

                const roomData = await Room.findOne({ where: { name: room } });

                if (!roomData) {
                    return socket.emit("system_message", `La sala "${room}" no existe.`);
                }

                const currentRooms = [...socket.rooms].filter(r => r !== socket.id);

                if (currentRooms.length > 0) {
                    currentRooms.forEach(r => {
                        socket.leave(r);
                        leaveRoom(socket.user.id, r);
                    });
                }

                if (roomData.type === "private") {
                    if (!password) {
                        return socket.emit("system_message", `Contraseña requerida para entrar a "${room}".`);
                    }

                    const validPass = await bcrypt.compare(password, roomData.password);
                    if (!validPass) {
                        return socket.emit("system_message", `Contraseña incorrecta para "${room}".`);
                    }
                }

                const history = await Message.findAll({
                    where: { room },
                    order: [["createdAt", "ASC"]],
                    limit: 50
                });

                socket.emit("message_history", history);

                // Ahora sí unir
                socket.join(room);
                joinRoom(socket.user.id, room);

                io.to(room).emit("room_users", getRoomUsers(room));
                io.to(room).emit("system_message", `${socket.user.username} se unió a "${room}"`);

                console.log(`✔️ ${socket.user.username} ahora está en: ${room}`);

            } catch (error) {
                console.error("Error join_room:", error);
                socket.emit("system_message", "Error al intentar acceder a la sala.");
            }
        });



        socket.on("leave_room", ({ room }) => {
            socket.leave(room);
            leaveRoom(socket.user.id, room);
            io.to(room).emit("system_message", `${socket.user.username} salió`);
            io.to(room).emit("room_users", getRoomUsers(room));
        });


        socket.on("send_message", async (data) => {
            try {
                const payload = {
                    room: data.room,
                    text: data.text,
                    from: socket.user.username,
                    timestamp: new Date().toISOString(),
                };

                await Message.create(payload);

                channel.sendToQueue(QUEUE, Buffer.from(JSON.stringify(payload)), {
                    persistent: true,
                });

                console.log("Mensaje enviado → RabbitMQ");
            } catch (err) {
                socket.emit("system_message", "No se pudo enviar el mensaje");
            }
        });


        socket.on("typing", ({ room }) => {
            socket.to(room).emit("user_typing", { username: socket.user.username });
        });

        socket.on("stop_typing", ({ room }) => {
            socket.to(room).emit("user_stop_typing", { username: socket.user.username });
        });

        socket.on("disconnect", () => {
            console.log(`🔴 ${socket.user.username} desconectado`);
            userDisconnected(socket.user.id);
            io.emit("user_offline", { id: socket.user.id });
        });
    });
}

module.exports = initSocket;
