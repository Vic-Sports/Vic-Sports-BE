import Chat from '../models/chat.js';
import Message from '../models/message.js';
import User from '../models/user.js';

// Store user socket connections
const userSockets = new Map();

export const initializeChatSocket = (io) => {
  // Authentication middleware for socket
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error'));
      }

      // Verify token and get user
      // You'll need to implement JWT verification here
      // For now, we'll use a simple approach
      const userId = socket.handshake.auth.userId;
      if (!userId) {
        return next(new Error('User ID required'));
      }

      const user = await User.findById(userId);
      if (!user) {
        return next(new Error('User not found'));
      }

      socket.userId = userId;
      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User ${socket.user.fullName} connected with socket ${socket.id}`);
    
    // Store user socket connection
    userSockets.set(socket.userId, socket.id);
    
    // Update user online status
    User.findByIdAndUpdate(socket.userId, { 
      isOnline: true, 
      lastSeen: new Date() 
    }).exec();

    // Join user to their chat rooms
    socket.on('join_chats', async () => {
      try {
        const userChats = await Chat.find({
          participants: socket.userId,
          isActive: true
        }).select('_id');

        userChats.forEach(chat => {
          socket.join(`chat_${chat._id}`);
        });

        console.log(`User ${socket.user.fullName} joined ${userChats.length} chat rooms`);
      } catch (error) {
        console.error('Error joining chats:', error);
      }
    });

    // Join specific chat room
    socket.on('join_chat', async (chatId) => {
      try {
        const chat = await Chat.findById(chatId);
        if (!chat || !chat.participants.includes(socket.userId)) {
          socket.emit('error', { message: 'Chat not found or access denied' });
          return;
        }

        socket.join(`chat_${chatId}`);
        console.log(`User ${socket.user.fullName} joined chat ${chatId}`);
        
        // Mark messages as read when joining chat
        await Message.markAsRead(chatId, socket.userId);
        
        // Notify others that user is typing
        socket.to(`chat_${chatId}`).emit('user_joined_chat', {
          userId: socket.userId,
          userName: socket.user.fullName,
          chatId
        });
      } catch (error) {
        console.error('Error joining chat:', error);
        socket.emit('error', { message: 'Failed to join chat' });
      }
    });

    // Leave chat room
    socket.on('leave_chat', (chatId) => {
      socket.leave(`chat_${chatId}`);
      console.log(`User ${socket.user.fullName} left chat ${chatId}`);
      
      // Notify others that user left
      socket.to(`chat_${chatId}`).emit('user_left_chat', {
        userId: socket.userId,
        userName: socket.user.fullName,
        chatId
      });
    });

    // Send message
    socket.on('send_message', async (data) => {
      try {
        const { chatId, content, type = 'text', replyTo, attachments } = data;

        if (!chatId || !content) {
          socket.emit('error', { message: 'Chat ID and content are required' });
          return;
        }

        // Verify user is participant
        const chat = await Chat.findById(chatId);
        if (!chat || !chat.participants.includes(socket.userId)) {
          socket.emit('error', { message: 'Chat not found or access denied' });
          return;
        }

        // Create message
        const messageData = {
          chatId,
          senderId: socket.userId,
          content,
          type,
          attachments: attachments || []
        };

        if (replyTo) {
          messageData.replyTo = replyTo;
        }

        const message = await Message.create(messageData);
        await message.populate('senderId', 'fullName avatar');
        
        if (replyTo) {
          await message.populate('replyTo', 'content senderId type');
          await message.populate('replyTo.senderId', 'fullName');
        }

        // Update chat last message
        chat.updateLastMessage(message);
        await chat.save();

        // Mark as delivered to all participants except sender
        const otherParticipants = chat.participants.filter(id => !id.equals(socket.userId));
        message.deliveredTo = otherParticipants.map(participantId => ({
          userId: participantId,
          deliveredAt: new Date()
        }));
        await message.save();

        // Emit message to all participants in the chat
        io.to(`chat_${chatId}`).emit('new_message', {
          message,
          chatId
        });

        // Update chat list for all participants
        const chatWithParticipants = await Chat.findById(chatId)
          .populate('participants', 'fullName avatar isOnline lastSeen')
          .populate('lastMessage.senderId', 'fullName avatar');

        chat.participants.forEach(participantId => {
          const participantSocketId = userSockets.get(participantId.toString());
          if (participantSocketId) {
            io.to(participantSocketId).emit('chat_updated', {
              chat: chatWithParticipants
            });
          }
        });

      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Typing indicators
    socket.on('typing_start', (data) => {
      const { chatId } = data;
      socket.to(`chat_${chatId}`).emit('user_typing', {
        userId: socket.userId,
        userName: socket.user.fullName,
        chatId,
        isTyping: true
      });
    });

    socket.on('typing_stop', (data) => {
      const { chatId } = data;
      socket.to(`chat_${chatId}`).emit('user_typing', {
        userId: socket.userId,
        userName: socket.user.fullName,
        chatId,
        isTyping: false
      });
    });

    // Message reactions
    socket.on('add_reaction', async (data) => {
      try {
        const { messageId, emoji } = data;

        const message = await Message.findById(messageId);
        if (!message) {
          socket.emit('error', { message: 'Message not found' });
          return;
        }

        // Check if user is participant in chat
        const chat = await Chat.findById(message.chatId);
        if (!chat.participants.includes(socket.userId)) {
          socket.emit('error', { message: 'Access denied' });
          return;
        }

        await message.addReaction(socket.userId, emoji);
        await message.populate('senderId', 'fullName avatar');

        // Emit reaction update to all participants
        io.to(`chat_${message.chatId}`).emit('reaction_added', {
          messageId,
          message,
          userId: socket.userId,
          userName: socket.user.fullName,
          emoji
        });

      } catch (error) {
        console.error('Error adding reaction:', error);
        socket.emit('error', { message: 'Failed to add reaction' });
      }
    });

    socket.on('remove_reaction', async (data) => {
      try {
        const { messageId } = data;

        const message = await Message.findById(messageId);
        if (!message) {
          socket.emit('error', { message: 'Message not found' });
          return;
        }

        // Check if user is participant in chat
        const chat = await Chat.findById(message.chatId);
        if (!chat.participants.includes(socket.userId)) {
          socket.emit('error', { message: 'Access denied' });
          return;
        }

        await message.removeReaction(socket.userId);
        await message.populate('senderId', 'fullName avatar');

        // Emit reaction update to all participants
        io.to(`chat_${message.chatId}`).emit('reaction_removed', {
          messageId,
          message,
          userId: socket.userId,
          userName: socket.user.fullName
        });

      } catch (error) {
        console.error('Error removing reaction:', error);
        socket.emit('error', { message: 'Failed to remove reaction' });
      }
    });

    // Mark messages as read
    socket.on('mark_read', async (data) => {
      try {
        const { chatId } = data;

        const chat = await Chat.findById(chatId);
        if (!chat || !chat.participants.includes(socket.userId)) {
          socket.emit('error', { message: 'Chat not found or access denied' });
          return;
        }

        await Message.markAsRead(chatId, socket.userId);

        // Notify sender that message was read
        socket.to(`chat_${chatId}`).emit('messages_read', {
          chatId,
          userId: socket.userId,
          userName: socket.user.fullName
        });

      } catch (error) {
        console.error('Error marking messages as read:', error);
        socket.emit('error', { message: 'Failed to mark messages as read' });
      }
    });

    // Handle disconnection
    socket.on('disconnect', async () => {
      console.log(`User ${socket.user.fullName} disconnected`);
      
      // Remove user socket connection
      userSockets.delete(socket.userId);
      
      // Update user offline status
      await User.findByIdAndUpdate(socket.userId, { 
        isOnline: false, 
        lastSeen: new Date() 
      }).exec();

      // Notify all chat rooms that user went offline
      const userChats = await Chat.find({
        participants: socket.userId,
        isActive: true
      }).select('_id');

      userChats.forEach(chat => {
        socket.to(`chat_${chat._id}`).emit('user_offline', {
          userId: socket.userId,
          userName: socket.user.fullName,
          chatId: chat._id
        });
      });
    });
  });

  return io;
};

export { userSockets };
