const activeUsers = new Map();
const roomMembers = new Map();

function userConnected(user, socketId) {
    activeUsers.set(user.id, { username: user.username, socketId });
}

function userDisconnected(userId) {
    activeUsers.delete(userId);

    for (const [room, users] of roomMembers) {
        users.delete(userId);
        if (users.size === 0) roomMembers.delete(room);
    }
}

function joinRoom(userId, room) {
    if (!roomMembers.has(room)) {
        roomMembers.set(room, new Set());
    }
    roomMembers.get(room).add(userId);
}

function leaveRoom(userId, room) {
    if (roomMembers.has(room)) {
        roomMembers.get(room).delete(userId);
        if (roomMembers.get(room).size === 0) {
            roomMembers.delete(room);
        }
    }
}

function getRoomUsers(room) {
    const ids = roomMembers.get(room) || new Set();
    return [...ids].map(id => activeUsers.get(id));
}

module.exports = {
    userConnected,
    userDisconnected,
    joinRoom,
    leaveRoom,
    getRoomUsers
};