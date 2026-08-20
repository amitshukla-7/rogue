import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { query } from '../db/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-dev';

const parseCookies = (cookieString: string) => {
  const list: any = {};
  if (!cookieString) return list;
  cookieString.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    list[parts.shift()!.trim()] = decodeURI(parts.join('='));
  });
  return list;
};

export const initSockets = (io: Server) => {
  // Socket.IO middleware for authentication
  io.use((socket: Socket, next) => {
    const cookieHeader = socket.handshake.headers.cookie || '';
    const cookies = parseCookies(cookieHeader);
    const token = cookies.token;

    if (!token) {
      return next(new Error('Authentication error: Missing token'));
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string; college_verified: boolean; is_admin?: boolean };
      (socket as any).user = decoded;
      next();
    } catch (err) {
      return next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = (socket as any).user;
    console.log(`User connected to Socket.IO: ${user.name || user.email} (${socket.id})`);

    // Auto-join personal user room for targeted notifications/warnings
    if (user.id) {
      socket.join(`user:${user.id}`);
      console.log(`👤 User ${user.id} joined personal channel 'user:${user.id}'`);
    }

    // Auto-join admin room if user is admin
    if (user.is_admin || user.email === 'admin@campusconnect.com') {
      socket.join('admin');
      console.log(`🛡️ Admin user ${user.id} auto-joined 'admin' socket room`);
    }

    socket.on('admin:join', () => {
      if (user.is_admin || user.email === 'admin@campusconnect.com') {
        socket.join('admin');
        console.log(`🛡️ Admin user ${user.id} joined 'admin' room on request`);
      }
    });

    // 1. ROOMS EVENTS
    socket.on('room:join', async ({ roomId }) => {
      socket.join(roomId);
      console.log(`User ${user.id} joined room ${roomId}`);
      const onlineCount = io.sockets.adapter.rooms.get(roomId)?.size || 1;
      io.to(roomId).emit('room:presence:update', { roomId, onlineCount });
    });

    socket.on('room:leave', ({ roomId }) => {
      socket.leave(roomId);
      const onlineCount = io.sockets.adapter.rooms.get(roomId)?.size || 0;
      io.to(roomId).emit('room:presence:update', { roomId, onlineCount });
    });

    socket.on('room:close', ({ roomId }) => {
      io.to(roomId).emit('room:closed', { roomId, message: 'Room has been closed by host.' });
    });

    socket.on('room:typing', ({ roomId, isTyping }) => {
      socket.to(roomId).emit('room:typing', {
        roomId,
        userId: user.id,
        userName: user.name || user.email || 'Student',
        isTyping
      });
    });

    socket.on('room:reaction:add', async ({ roomId, messageId, emoji, isAdding }) => {
      if (process.env.DATABASE_URL) {
        try {
          if (isAdding) {
            await query(
              'INSERT INTO room_message_reactions (message_id, user_id, emoji) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
              [messageId, user.id, emoji]
            );
          } else {
            await query(
              'DELETE FROM room_message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3',
              [messageId, user.id, emoji]
            );
          }
        } catch (dbErr) {
          console.error('Database reaction error:', dbErr);
        }
      }
      io.to(roomId).emit('room:reaction:update', { roomId, messageId, emoji, userId: user.id, isAdding });
    });

    socket.on('room:message:send', async ({ roomId, content, tempId, replyToId, replyToName, replyToContent }) => {
      try {
        const result = await query(
          'INSERT INTO room_messages (room_id, sender_id, content) VALUES ($1, $2, $3) RETURNING *',
          [roomId, user.id, content]
        );
        const rawMessage = result.rows[0];
        
        // Enrich message with sender details
        const senderRes = await query('SELECT name, handle, photos FROM users WHERE id = $1', [user.id]);
        const sender = senderRes.rows[0];

        const message = {
          ...rawMessage,
          client_temp_id: tempId || null,
          sender_name: sender ? sender.name : (user.name || user.email || 'Student'),
          sender_handle: sender ? sender.handle || 'student' : 'student',
          sender_photo: sender && sender.photos ? sender.photos[0] : null,
          reply_to_id: replyToId || null,
          reply_to_name: replyToName || null,
          reply_to_content: replyToContent || null
        };
        
        // Broadcast the message to all members in the room
        io.to(roomId).emit('room:message:receive', { roomId, message });

        // Stream to admin live feed room
        const roomRes = await query('SELECT name FROM rooms WHERE id = $1', [roomId]);
        const roomName = roomRes.rows[0]?.name || 'General Chat';

        io.to('admin').emit('admin:new_content', {
          id: message.id,
          type: 'room_message',
          author_id: user.id,
          author_name: sender ? sender.name : (user.email || 'Student'),
          author_handle: sender ? sender.handle || 'student' : 'student',
          author_photo: sender && sender.photos ? sender.photos[0] : null,
          title: null,
          content: content,
          room_id: roomId,
          room_name: roomName,
          media_url: null,
          created_at: message.sent_at || new Date().toISOString()
        });
      } catch (err) {
        console.error('Socket room message error:', err);
      }
    });

    // 2. 1:1 CHAT EVENTS
    socket.on('chat:join', ({ matchId }) => {
      socket.join(matchId);
      console.log(`User ${user.id} joined match chat ${matchId}`);
    });

    socket.on('chat:message:send', async ({ matchId, content }) => {
      try {
        const result = await query(
          'INSERT INTO messages (match_id, sender_id, content) VALUES ($1, $2, $3)',
          [matchId, user.id, content]
        );
        const message = result.rows[0];

        // Deliver the message to the chat room
        io.to(matchId).emit('chat:message:receive', { matchId, message });

        // Fetch sender information for notifications
        const senderRes = await query('SELECT name, handle, photos FROM users WHERE id = $1', [user.id]);
        const sender = senderRes.rows[0];

        let recipientId: string | null = null;
        if (matchId.startsWith('dm-')) {
          recipientId = matchId.replace('dm-', '');
          if (recipientId === user.id) recipientId = null;
        } else {
          const matchRes = await query('SELECT user_a_id, user_b_id FROM matches WHERE id::text = $1', [matchId]);
          if (matchRes.rows.length > 0) {
            const m = matchRes.rows[0];
            recipientId = m.user_a_id === user.id ? m.user_b_id : m.user_a_id;
          }
        }

        if (recipientId) {
          io.to(`user:${recipientId}`).emit('notification:message', {
            matchId,
            messageId: message.id,
            senderId: user.id,
            senderName: sender ? sender.name : (user.name || user.email || 'Campus Student'),
            senderHandle: sender ? sender.handle || 'student' : 'student',
            senderPhoto: sender && sender.photos ? sender.photos[0] : null,
            content: content,
            sentAt: message.sent_at || new Date().toISOString()
          });
        }
      } catch (err) {
        console.error('Socket chat message error:', err);
      }
    });

    socket.on('chat:typing', ({ matchId, isTyping }) => {
      // Send typing status to the other user in the match chat room
      socket.to(matchId).emit('chat:typing', { matchId, isTyping, userId: user.id });
    });

    socket.on('disconnecting', () => {
      for (const roomId of socket.rooms) {
        if (roomId !== socket.id) {
          const roomObj = io.sockets.adapter.rooms.get(roomId);
          const currentSize = roomObj ? roomObj.size - 1 : 0;
          const onlineCount = Math.max(1, currentSize);
          io.to(roomId).emit('room:presence:update', { roomId, onlineCount });
        }
      }
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${user.id} (${socket.id})`);
    });
  });
};
