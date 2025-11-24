const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");

const http = require("http");
const initSocket = require("./websocket/socket");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json())

const authRoutes = require("./api/auth.routes");
app.use("/auth", authRoutes);

const roomRoutes = require("./api/rooms.routes");
app.use("/rooms", roomRoutes);

const messagesRoutes = require("./api/messages.routes");
app.use("/messages", messagesRoutes);

const server = http.createServer(app);
initSocket(server);

app.get("/", (req, res) => {
    res.send("API Chat Real-Time funcionando");
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
    console.log(`Servidor con WebSocket escuchando en http://localhost:${PORT}`);
});
