document.addEventListener('DOMContentLoaded', () => {
    const msgInput = document.getElementById('msgInput');
    const msgForm = document.getElementById('msgForm');
    const messagesContainer = document.querySelector('.messages');
    const contextMenu = document.getElementById('contextMenu');
    const searchBoxChannel = document.getElementById('search-channel');
    let searchTimeout;

    messagesContainer.scrollTop = messagesContainer.scrollHeight;


    // const CURRENT_USER = '<%= username %>';
    const currentUsername = document.getElementById("username-hidden").value;
    const currentUserId = document.getElementById("userid-hidden").value;

    // const USER_ID = '<%= user_id %>';

    function getWSToken() {
        const cookies = document.cookie.split(';')
            .map(cookie => cookie.trim())
            .reduce((acc, curr) => {
                const [key, value] = curr.split('=');
                acc[key] = value;
                return acc;
            }, {});

        return cookies['wsToken'];
    }

    const token = getWSToken();
    if (!token) {
        console.error('No authentication token found');
        return;
    }

    // let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 3;

    const socket = io({
        ackTimeout: 10000,
        retries: MAX_RECONNECT_ATTEMPTS,
        transports: ['websocket'],
        upgrade: false,
        auth: {token}
    });

    /**
     * Socket connecting
     */
    socket.on('connect', () => {
        console.log('Connected');
        joinCurrentChannel();
    });

    // If server send errors. Listen to it
    socket.on('join-error', (msg) => {
        console.log(msg);
    });

    /**
     * Search for channels
     */
    searchBoxChannel.addEventListener('input', (e) => {
        if (searchTimeout) {
            clearTimeout(searchTimeout);
        }

        searchTimeout = setTimeout(() => {
            const term = e.target.value.trim();
            if (term.length >= 0) {
                if (socket.connected) {
                    console.log(term);
                    socket.emit('search channel', term, function(response) {
                        if (response === 'ok') {
                            console.log('ok');
                        }
                    });
                } else {
                    console.log('socket is not connected');
                }
            }
        }, 300);
    });

    /**
     * Receive results (channels list after search) from server
     */
    socket.on('search channels results', (channels) => {
        const channelList = document.querySelector('.channel-list');

        channelList.innerHTML = '';
        channels.forEach((channel) => {
            const channelElement = document.createElement('div');

            channelElement.className = 'channel';
            channelElement.innerHTML = `
               <a style="text-decoration: none; color: #dcddde" href="/channel/${channel._id}" 
                   class="channel-link" data-channel-id="${channel._id}">
                   <div class="channel" 
                       channel-data-id="${channel._id}">
                       <div class="channel-icon">#</div>
                       <div class="channel-info">
                           <h4> ${channel.name} </h4>
                            <p>Lastest message here...</p>
                       </div>
                       <div class="channel-meta">
                           <span class="time">12:30</span>
                            <span class="unread"> ${channel.messageCount} </span>
                       </div>
                   </div>
               </a>
            `;
            channelList.appendChild(channelElement);
        })
    })

    const joinedChannels = new Set();

    function joinCurrentChannel() {
        const currentChannelId = getCurrentChannel();
        if (currentChannelId && !joinedChannels.has(currentChannelId)) {
            joinChannel(currentChannelId);
        }
    }

    // Prevent socket io auto submit
    msgForm?.removeEventListener('submit', handleSubmit);


    /**
     * Send message socket.emit('chat', messageData, (response) => {}
     */
    async function handleSubmit(e) {
        e.preventDefault();
        const channelId = getCurrentChannel();
        const content = msgInput.value;

        if (!content || !channelId) return;
        const messageData = { content, channelId };

        msgInput.disabled = true;

        try {
            await new Promise((resolve, reject) => {
                socket.emit('chat', messageData, (response) => {
                    if (response?.status === 'ok') {
                        resolve(response);
                    } else {
                        reject(new Error(response?.message));
                    }
                });
            });
            // await socket.emit('chat', { content, channelId }, (response) => {
            //     console.log(response);
            // });
            msgInput.value = '';
        } catch (e) {
            console.error('Failed to send message: ');
            // console.log(e.message);

            msgInput.disabled = false;
            msgInput.focus();
            msgInput.value = '';
            // alert('Failed to send message. Please try again.');
        } finally {
            msgInput.disabled = false;
            msgInput.focus();
            msgInput.value = '';
        }
    }

    msgForm.addEventListener('submit', handleSubmit);

    /**
     * Join channel socket.emit('join channel')
     */
    async function joinChannel(channelId) {
        if (!channelId) return;

        await socket.emit('join channel', channelId, (response) => {
            // joinedChannels.add(channelId);
            if (!response) {
                // joinedChannels.add(channelId);
                console.error(`No response received`);
                return;
            }
            if (response?.status === 'ok') {
                joinedChannels.add(channelId);
                console.log(`Joined channel: ${channelId}`);
            } else {
                console.log(`Failed to join: ${channelId}`);
            }
        });
    }

    // Handle incomming message. Here is how msg contains
    socket.on('message', (msg) => {
        try {
            if (!msg || !msg.sender || !msg.content) {
                console.log('Invalid message data');
                return;
            }
            appendToChatMessages(msg);
        } catch (e) {
            console.log(e);
        }
    });

    socket.on('disconnect', (_msg) => {
        joinedChannels.clear();
    });

    socket.on('message deleted', (data) => {
        const { messageId } = data;
        const messageElement = document.querySelector(`.message[data-message-id="${messageId}"]`);
        if (messageElement) {
            messageElement.remove();
        }
    })

    function appendToChatMessages(msg) {
        if (!msg || !msg.content) return;

        const msgDate = new Date(msg.sentAt);
        const today = new Date();

        if (!document.querySelector('.date-divider')) {
            const dateDivider = document.createElement('div');
            dateDivider.className = 'date-divider';
            dateDivider.innerHTML = `<span>${isToday(msgDate) ? 'Today' : msgDate.toLocaleString()}</span>`
            messagesContainer.appendChild(dateDivider);
        }

        const isOwnMsg = msg.sender.username === currentUsername;
        console.log(currentUsername);
        console.log(msg.sender.username);

        const msgDiv = document.createElement('div');
        msgDiv.className = 'message';

        // <div class="message <%= msg.sender._id.toString() === user_id ? 'own-message' : '' %>"
        //      data-message-id="<%= msg._id %>" data-sender-id="<%= msg.sender._id %>">
        msgDiv.className = `message ${isOwnMsg ? 'own-message' : ''}`;
        msgDiv.setAttribute('data-message-id', msg._id);
        msgDiv.setAttribute('data-sender-id', msg.sender._id);

        msgDiv.innerHTML = `
                <img src="https://api.dicebear.com/9.x/pixel-art/svg?seed=${encodeURIComponent(msg.sender.username)}" alt="Avatar" class="message-avatar">
                <div class="message-content">
                    <div class="message-header">
                        <h4>${isOwnMsg ? 'You' : msg.sender.username}</h4>
                        <span class="time">${msgDate.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</span>
                    </div>
                    <p>${msg.content}</p>
                </div>
            `;

        messagesContainer.appendChild(msgDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function isToday(date) {
        const today = new Date();
            return date.getDate() === today.getDate()
            && date.getMonth() === today.getMonth()
            && date.getFullYear() === today.getFullYear();
    }

    function getCurrentChannel() {
        const activeChannel = document.querySelector('.channel.active');
        return activeChannel?.getAttribute('channel-data-id') || null;
    }

    window.addEventListener('beforeunload', () => {
        if (socket) {
            socket.disconnect();
        }
    });

    messagesContainer.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        // Find the closest div that near messages, that is message
        const messageElement = e.target.closest('.message');
        if (!messageElement) return;

        const messageId = messageElement.dataset.messageId;
        const senderId = messageElement.dataset.senderId;

        if (currentUserId !== senderId) {
            return;
        }

        contextMenu.style.display = 'block';
        contextMenu.style.left = `${e.pageX}px`;
        contextMenu.style.top = `${e.pageY}px`;

        // Set dataset for later use
        contextMenu.dataset.messageId = messageId;
    });


    contextMenu.addEventListener('click', (e) => {
        const action = e.target.dataset.action;
        const messageId = contextMenu.dataset.messageId;

        if (action === 'delete' && messageId) {
            socket.emit('delete message',  { messageId });
        }
        contextMenu.style.display = 'none';
    });

    socket.on('conversation history', ({ conversation, messages }) => {
        console.log(conversation);
        console.log(messages);
    })

    async function startOrOpenConversation(receiverId) {
        console.log(receiverId);
        socket.emit('start conversation', receiverId, function(response) {
            console.log(response);
            // if (response?.message = 'ok') {
            //     console.log('ok');
            // }
        });
    }

    document.querySelectorAll('.channel-link[data-user-id]').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const userId = this.dataset.userId;
            if (userId) {
                startOrOpenConversation(userId);
            }
        });
    });
    // socket.on('select channel', (channelId));
});

