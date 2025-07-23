import { Server } from "socket.io";

let io;

export default function handler(req, res) {
    if (!res.socket.server.io) {
        console.log("Starting socket.io server...");
        io = new Server(res.socket.server, {
            path: '/api/socketio',
            addTrailingSlash: false,
        });
        res.socket.server.io = io;

        const emailMap = new Map();
        const socketMap = new Map(); 
        const roomUsers = new Map(); 

        io.on("connection", (socket) => {
            console.log("User connected", socket.id);

            socket.on('join-room', ({ roomId, email }) => {
                try {
                    if (!roomId || !email || typeof roomId !== 'string' || typeof email !== 'string') {
                        socket.emit('error', { message: 'Invalid room ID or email' });
                        return;
                    }

                    const trimmedEmail = email.trim();
                    const trimmedRoomId = roomId.trim();

                    if (!trimmedEmail || !trimmedRoomId) {
                        socket.emit('error', { message: 'Email and room ID cannot be empty' });
                        return;
                    }

                    if (emailMap.has(trimmedEmail)) {
                        const existingSocketId = emailMap.get(trimmedEmail);
                        const existingSocket = io.sockets.sockets.get(existingSocketId);
                        
                        if (existingSocket && existingSocket.connected) {
                            socket.emit('error', { message: 'Email already in use' });
                            return;
                        } else {
                            emailMap.delete(trimmedEmail);
                            if (socketMap.has(existingSocketId)) {
                                const oldData = socketMap.get(existingSocketId);
                                socketMap.delete(existingSocketId);
                                if (roomUsers.has(oldData.roomId)) {
                                    roomUsers.get(oldData.roomId).delete(trimmedEmail);
                                }
                            }
                        }
                    }

                    emailMap.set(trimmedEmail, socket.id);
                    socketMap.set(socket.id, { email: trimmedEmail, roomId: trimmedRoomId });
                    
                    if (!roomUsers.has(trimmedRoomId)) {
                        roomUsers.set(trimmedRoomId, new Set());
                    }

                    const existingUsers = Array.from(roomUsers.get(trimmedRoomId));
                    console.log(`User ${trimmedEmail} joining room ${trimmedRoomId}. Existing users:`, existingUsers);
                    
                    roomUsers.get(trimmedRoomId).add(trimmedEmail);
                    socket.join(trimmedRoomId);

                    socket.emit("joined-room", { 
                        roomId: trimmedRoomId, 
                        existingUsers: existingUsers 
                    });

                    socket.broadcast.to(trimmedRoomId).emit("user-joined", { email: trimmedEmail });
                    
                    console.log(`Room ${trimmedRoomId} now has users:`, Array.from(roomUsers.get(trimmedRoomId)));
                    
                } catch (error) {
                    console.error('Error in join-room:', error);
                    socket.emit('error', { message: 'Failed to join room' });
                }
            });

            socket.on('call-user', (data) => {
                try {
                    const { email, offer } = data;
                    
                    if (!email || !offer) {
                        socket.emit('error', { message: 'Invalid call data' });
                        return;
                    }

                    const fromUser = socketMap.get(socket.id);
                    if (!fromUser) {
                        socket.emit('error', { message: 'User not found in room' });
                        return;
                    }

                    const targetSocketId = emailMap.get(email);
                    if (!targetSocketId) {
                        console.log(`User ${email} not found or offline`);
                        return;
                    }

                    const targetSocket = io.sockets.sockets.get(targetSocketId);
                    if (!targetSocket || !targetSocket.connected) {
                        console.log(`User ${email} is no longer connected`);
                        return;
                    }
                    
                    console.log(`Call from ${fromUser.email} to ${email}`);
                    targetSocket.emit('incoming-call', { from: fromUser.email, offer });
                    
                } catch (error) {
                    console.error('Error in call-user:', error);
                    socket.emit('error', { message: 'Failed to initiate call' });
                }
            });

            socket.on('call-accepted', (data) => {
                try {
                    const { email, ans } = data;
                    
                    if (!email || !ans) {
                        socket.emit('error', { message: 'Invalid call acceptance data' });
                        return;
                    }

                    const targetSocketId = emailMap.get(email);
                    if (!targetSocketId) {
                        console.log(`User ${email} not found for call acceptance`);
                        return;
                    }

                    const fromUser = socketMap.get(socket.id);
                    console.log(`Call accepted by ${fromUser?.email} to ${email}`);
                    
                    const targetSocket = io.sockets.sockets.get(targetSocketId);
                    if (targetSocket && targetSocket.connected) {
                        targetSocket.emit('call-accepted', { ans, from: fromUser?.email });
                    }
                } catch (error) {
                    console.error('Error in call-accepted:', error);
                    socket.emit('error', { message: 'Failed to accept call' });
                }
            });

            socket.on('call-rejected', (data) => {
                try {
                    const { email, reason } = data;
                    
                    if (!email) {
                        return;
                    }

                    const targetSocketId = emailMap.get(email);
                    if (targetSocketId) {
                        const fromUser = socketMap.get(socket.id);
                        const targetSocket = io.sockets.sockets.get(targetSocketId);
                        if (targetSocket && targetSocket.connected) {
                            targetSocket.emit('call-rejected', { 
                                reason: reason || 'Call rejected',
                                from: fromUser?.email 
                            });
                        }
                    }
                } catch (error) {
                    console.error('Error in call-rejected:', error);
                }
            });

            socket.on('ice-candidate', (data) => {
                try {
                    const { email, candidate } = data;
                    
                    if (!email || !candidate) {
                        console.log('Invalid ICE candidate data');
                        return;
                    }

                    const fromUser = socketMap.get(socket.id);
                    if (!fromUser) {
                        console.log('ICE candidate: User not found in room');
                        return;
                    }

                    const targetSocketId = emailMap.get(email);
                    if (!targetSocketId) {
                        console.log(`ICE candidate: Target user ${email} not found`);
                        return;
                    }

                    const targetSocket = io.sockets.sockets.get(targetSocketId);
                    if (targetSocket && targetSocket.connected) {
                        console.log(`Forwarding ICE candidate from ${fromUser.email} to ${email}`);
                        targetSocket.emit('ice-candidate', { 
                            from: fromUser.email, 
                            candidate 
                        });
                    }
                } catch (error) {
                    console.error('Error handling ICE candidate:', error);
                }
            });

            socket.on('get-room-users', () => {
                try {
                    const userData = socketMap.get(socket.id);
                    if (userData) {
                        const { roomId } = userData;
                        const roomParticipants = roomUsers.has(roomId) 
                            ? Array.from(roomUsers.get(roomId)) 
                            : [];
                        
                        socket.emit('room-users', { users: roomParticipants });
                    }
                } catch (error) {
                    console.error('Error getting room users:', error);
                }
            });

            socket.on('broadcast-to-room', (data) => {
                try {
                    const userData = socketMap.get(socket.id);
                    if (userData) {
                        const { email, roomId } = userData;
                        console.log(`Broadcasting message from ${email} to room ${roomId}`);
                        
                        socket.broadcast.to(roomId).emit('room-broadcast', {
                            from: email,
                            message: data.message,
                            timestamp: Date.now()
                        });
                    }
                } catch (error) {
                    console.error('Error in room broadcast:', error);
                }
            });

            socket.on("disconnect", () => {
                try {
                    console.log("User disconnected", socket.id);
                    
                    const userData = socketMap.get(socket.id);
                    if (userData) {
                        const { email, roomId } = userData;
                        
                        emailMap.delete(email);
                        socketMap.delete(socket.id);
                        
                        if (roomUsers.has(roomId)) {
                            roomUsers.get(roomId).delete(email);
                            if (roomUsers.get(roomId).size === 0) {
                                roomUsers.delete(roomId);
                                console.log(`Room ${roomId} deleted - no users left`);
                            } else {
                                socket.broadcast.to(roomId).emit("user-left", { email });
                                console.log(`Notified room ${roomId} that ${email} left`);
                            }
                        }
                        
                        console.log(`${email} disconnected from room ${roomId}`);
                    }
                } catch (error) {
                    console.error('Error in disconnect:', error);
                }
            });

            socket.on('leave-room', () => {
                try {
                    const userData = socketMap.get(socket.id);
                    if (userData) {
                        const { email, roomId } = userData;
                        
                        socket.leave(roomId);
                        
                        emailMap.delete(email);
                        socketMap.delete(socket.id);
                        
                        if (roomUsers.has(roomId)) {
                            roomUsers.get(roomId).delete(email);
                            if (roomUsers.get(roomId).size === 0) {
                                roomUsers.delete(roomId);
                                console.log(`Room ${roomId} deleted - no users left`);
                            } else {
                                socket.broadcast.to(roomId).emit("user-left", { email });
                            }
                        }
                        
                        socket.emit('left-room');
                        console.log(`${email} manually left room ${roomId}`);
                    }
                } catch (error) {
                    console.error('Error in leave-room:', error);
                    socket.emit('error', { message: 'Failed to leave room' });
                }
            });

            socket.on('get-room-info', () => {
                try {
                    const userData = socketMap.get(socket.id);
                    if (userData) {
                        const { roomId } = userData;
                        const participantCount = roomUsers.has(roomId) ? roomUsers.get(roomId).size : 0;
                        const participants = roomUsers.has(roomId) ? Array.from(roomUsers.get(roomId)) : [];
                        
                        socket.emit('room-info', {
                            roomId,
                            participantCount,
                            participants
                        });
                    }
                } catch (error) {
                    console.error('Error getting room info:', error);
                }
            });

            socket.on('ping', () => {
                socket.emit('pong');
            });
        });

        console.log('Socket.IO server initialized with multi-user support');
        console.log('Supported events: join-room, call-user, call-accepted, call-rejected, ice-candidate, leave-room, get-room-users, get-room-info, broadcast-to-room');
    }
    res.end();
}