const express = require("express");
const bcrypt = require("bcryptjs");
const { Room } = require("../../models");
const router = express.Router();

router.post("/", async (req, res) => {
    try {
        const { name, type, password, ownerId } = req.body;

        let hashedPassword = null;
        if (type === "private") {
            hashedPassword = await bcrypt.hash(password, 10);
        }

        const room = await Room.create({
            name,
            type,
            password: hashedPassword,
            ownerId
        });

        res.json({ message: "Sala creada", room });
    } catch (error) {
        res.status(500).json({ error: "Error creando la sala" });
    }
});

router.get("/", async (req, res) => {
    const rooms = await Room.findAll();
    res.json(rooms);
});

router.delete("/:id", async (req, res) => {
    try {
        const room = await Room.findByPk(req.params.id);
        if (!room) return res.status(404).json({ error: "Sala no encontrada" });

        // Validar dueño
        const userId = parseInt(req.headers["x-user-id"]);
        if (room.ownerId !== userId) {
            return res.status(403).json({ error: "Solo el dueño puede eliminar la sala" });
        }

        await room.destroy();
        res.json({ message: "Sala eliminada" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error eliminando la sala" });
    }
});

module.exports = router;
