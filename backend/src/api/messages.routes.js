const express = require("express");
const { Message } = require("../../models");
const router = express.Router();

router.get("/:room", async (req, res) => {
    const { room } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const offset = (page - 1) * limit;

    const messages = await Message.findAll({
        where: { room },
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [["createdAt", "ASC"]]
    });

    res.json(messages);
});

module.exports = router;
