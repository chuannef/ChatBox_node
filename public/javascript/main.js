document.addEventListener('DOMContentLoaded', () => {
    // const msgInput = document.getElementById('msgInput');
    // const msgForm = document.getElementById('msgForm');
    // const messagesContainer = document.querySelector('.messages');
    // const contextMenu = document.getElementById('contextMenu');
    // const searchBoxChannel = document.getElementById('search-channel');
    // let searchTimeout;

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
        reconnection: true,
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

    let currentChannel = null;

    const modal = document.getElementById('createChannelModal');
    const addChannelBtn = document.querySelector('.add-channel-btn');
    const closeModal = document.querySelector('.close-modal');
    const cancelBtn = document.querySelector('.cancel-btn');
    const createChannelForm = document.getElementById('createChannelForm');
    const channelNameInput = document.getElementById('channelName');

    /**
     * ==================> BEGIN -SEARCH FOR CHANNELS- <==================
     */
    const searchInput = document.getElementById('search-channel');
    let searchTimeout = null;

    searchInput.addEventListener('input', (e) => {
        if (searchTimeout) {
            clearTimeout(searchTimeout);
        }

        searchTimeout = setTimeout(() => {
            const term = e.target.value.trim();
            searchChannel(term);
        }, 300);
    });

    function searchChannel(term) {
        // Send to the server
        socket.emit('search channels', term);
    }

    // SERVER: -> socket.emit('search channels results', channels);
    // Listen from server
    socket.on('search channels results', (channels) => {
        const channelsContainer = document.querySelector('.channel-list');
        channelsContainer.innerHTML = '';

        channels.forEach(channel => {
            // const channelElement = createChannelElement(channel);
            // channelsContainer.appendChild(channelElement);
            addChannelToList(channel);
        });

        if (channels.length <= 0 || channels.empty) {
            showErrorToast('Sorry, channel not found');
        }
        attachChannelClickListeners();
    });

    // Reattach eventListener for channel
    function attachChannelClickListeners() {
        document.querySelectorAll('.channel-link').forEach(link => {
            link.addEventListener('click', function (e) {
                e.preventDefault();

                const channelId = this.dataset.channelId;

                // remove active class from all channel
                document.querySelectorAll('.channel').forEach(ch =>
                    ch.classList.remove('active')
                );

                this.querySelector('.channel').classList.add('active');

                socket.emit('select channel', channelId, function (response) {
                    console.log(response);
                });
            });
        });
    }

    function createChannelElement(channel) {
        const channelLink = document.createElement('div');
        channelLink.className = 'channel-link';
        channelLink.style.textDecoration = 'none';
        channelLink.style.color = '#dcddde';
        channelLink.setAttribute('data-channel-id', channel._id);

        channelLink.innerHTML = `
        <div class="channel" channel-data-id="${channel._id}">
            <div class="channel-icon">#</div>
            <div class="channel-info">
                <h4>${channel.name}</h4>
                <p>${channel.latestMessage ? channel.latestMessage.content : 'No messages yet'}</p>
            </div>
            <div class="channel-meta">
                <span class="time">
                    ${channel.latestMessage ? new Date(channel.latestMessage.sentAt).toLocaleTimeString() : ''}
                </span>
                <span class="unread">${channel.messageCount}</span>
            </div>
        </div>
    `;

        // Attach click handler directly to the new element
        channelLink.addEventListener('click', () => {
            joinChannel(channel._id);
        });

        return channelLink;
    }

    /**
     * ==================> END -SEARCH FOR CHANNELS- <==================
     */

    addChannelBtn.addEventListener('click', (e) => {
        modal.style.display = 'block';
        channelNameInput.focus();
    });

    function hideModal() {
        modal.style.display = 'none';
        createChannelForm.reset();
    }

    closeModal.addEventListener('click', hideModal);
    cancelBtn.addEventListener('click', hideModal);
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            hideModal();
        }
    });

    function showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        
        const existingError = createChannelForm.querySelector('.error-message');
        if (existingError) {
            existingError.remove();
        }
        
        createChannelForm.insertBefore(errorDiv, createChannelForm.firstChild);
    }

    createChannelForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitButton = createChannelForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        try {
            const formData = {
                name: channelNameInput.value.trim(),
                description: document.getElementById('channelDescription').value.trim()
            };
            socket.emit('create channel', formData, (response) => {
                if (response.status === 'ok') {
                    hideModal();
                    showSuccessToast(response.message);
                } else {
                    hideModal();
                    showErrorToast(response.error);
                }
                submitButton.disabled = false;
            })
        } catch (e) {
            console.log(e);
        }
    });

    /**
     * Add a new channel to the left sidebar
     * @param {Object} channel - contains _id, name, description...
     */
    function addChannelToList(channel) {
        const channelList = document.querySelector('.channel-list');
        if (!channelList) {
            console.error('Channel list container not found');
            return;
        }

        // Create channel link container
        const channelLink = document.createElement('div');
        channelLink.className = 'channel-link';
        channelLink.style.textDecoration = 'none';
        channelLink.style.color = '#dcddde';
        channelLink.setAttribute('data-channel-id', channel._id);

        // Create channel element
        const channelElement = document.createElement('div');
        channelElement.className = 'channel';
        channelElement.setAttribute('channel-data-id', channel._id);

        // Create channel content
        channelElement.innerHTML = `
            <div class="channel-icon">#</div>
            <div class="channel-info">
                <h4>${channel.name}</h4>
                <p>Latest message here...</p>
            </div>
            <div class="channel-meta">
                <span class="time">Just now</span>
                <span class="unread">0</span>
            </div>
        `;

        channelLink.addEventListener('click', () => {
            // Remove active class from all channels
            document.querySelectorAll('.channel').forEach(ch => {
                ch.classList.remove('active');
            });

            // Add active class to clicked channel
            channelElement.classList.add('active');

            joinChannel(channel._id);
        });

        // Assemble and insert the new channel
        channelLink.appendChild(channelElement);
        channelList.insertAdjacentElement('afterbegin', channelLink);
    }

    socket.on('channel created', (data) => {
        addChannelToList(data);
    });

    // If server send errors. Listen to it
    socket.on('join-error', (msg) => {
        console.log(msg);
    });

    const joinedChannels = new Set();

    function joinCurrentChannel() {
        const currentChannelId = getCurrentChannel();
        if (currentChannelId && !joinedChannels.has(currentChannelId)) {
            joinChannel(currentChannelId);
        }
    }

    // Prevent socket io auto submit
    // msgForm?.removeEventListener('submit', handleSubmit);


    /**
     * Send message socket.emit('chat', messageData, (response) => {}
     */
    async function handleSubmit(e) {
        e.preventDefault();
        const channelId = getCurrentChannel();
        const content = msgInput.value;

        if (!content || !channelId) return;
        const messageData = {content, channelId};

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

    // msgForm.addEventListener('submit', handleSubmit);

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

    socket.on('disconnect', (_msg) => {
        joinedChannels.clear();
    });

    /**
     * Select channel from channel list
     */
    // socket.on('select channel', channelId, function(response) {
    // });
    document.querySelectorAll('.channel-link').forEach(link => {
        link.addEventListener('click', function (e) {
            console.log('channel selected from channel-link');
            e.preventDefault();

            const channelId = this.dataset.channelId;

            // remove active class from all channel
            document.querySelectorAll('.channel').forEach(ch =>
                ch.classList.remove('active')
            );

            this.querySelector('.channel').classList.add('active');

            socket.emit('select channel', channelId, function (response) {
                console.log(response);
            });
        });
    });

    socket.on('error', (msg) => {
        console.log(msg);
    });

    /**
     * Receive result from channel
     */
    socket.on('channel selected', (data) => {
        console.log(data);
        console.log('channel selected');
        const {messages, channel, memberCount} = data;
        currentChannel = channel;
        renderChatArea(messages, channel, memberCount);
    });

    function renderChatArea(messages, channel, memberCount) {
        const chatArea = document.querySelector('.chat-area');
        // Clear everything inside this chat area 
        chatArea.innerHTML = '';

        chatArea.appendChild(createHeader(channel, memberCount));
        chatArea.appendChild(createMessagesContainer(messages));
        chatArea.appendChild(createInputArea(channel));
        chatArea.appendChild(createContextMenu());

        setupEventListeners(channel);
    }

    function createContextMenu() {
        const contextMenu = document.createElement('div');
        contextMenu.id = 'contextMenu';
        contextMenu.className = 'context-menu';
        contextMenu.innerHTML = `
            <ul>
                <li data-action="delete">Delete Message</li>
            </ul>
        `;
        return contextMenu;
    }

    // this one from server
    // io.to(channelId).emit('new message', messageData);
    socket.on('new message', (data) => {
        appendNewMessage(data);
    });

    function appendNewMessage(messageData) {

        const messagesContainer = document.querySelector('.messages');

        // Check if we need to add a new date divider
        const messageDate = new Date(messageData.sentAt).toDateString();
        // const lastDateDivider = messagesContainer.querySelector('.date-divider:last-of-type span');
        // const lastMessageDate = lastDateDivider ? lastDateDivider.textContent : null;

        // If it's a new date, add a new date divider
        // if (messageDate !== lastMessageDate && messageDate !== 'Today') {
        //     const dateDivider = createDateDivider(messageDate);
        //     messagesContainer.appendChild(dateDivider);
        // }

        // Create and append the new message
        // const messageElement = createMessage(messageData);
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${messageData.sender._id === currentUserId ? 'own-message' : ''}`;
        messageDiv.dataset.messageId = messageData._id;
        messageDiv.dataset.senderId = messageData.sender._id;

        messageDiv.innerHTML = `
        <img src="https://api.dicebear.com/9.x/pixel-art/svg?seed=${messageData.sender.username}"
             alt="Avatar" class="message-avatar">
        <div class="message-content">
            <div class="message-header">
                <h4>${messageData.sender._id === currentUserId ? 'You' : messageData.sender.username}</h4>
                <span class="time">
                    ${new Date(messageData.sentAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        })}
                </span>
            </div>
            <p>${escapeHTML(messageData.content)}</p>
        </div>
    `;

        if (messageData.sender._id === currentUserId) {
            messageDiv.addEventListener('contextmenu', function(e) {
                e.preventDefault();
                const contextMenu = document.getElementById('contextMenu');
                console.log(contextMenu);

                if (contextMenu) {
                    contextMenu.style.display = 'block';
                    contextMenu.style.left = e.pageX + 'px';
                    contextMenu.style.top = e.pageY + 'px';
                    contextMenu.dataset.messageId = messageData._id;
                }
            });
        }

        messagesContainer.appendChild(messageDiv);

        // Scroll to the new message
        scrollToBottom(messagesContainer);
    }

    function createMessage(msg) {

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${msg.sender._id === currentUserId ? 'own-message' : ''}`;
        messageDiv.dataset.messageId = msg._id;
        messageDiv.dataset.senderId = msg.sender._id;

        messageDiv.innerHTML = `
        <img src="https://api.dicebear.com/9.x/pixel-art/svg?seed=${msg.sender.username}"
             alt="Avatar" class="message-avatar">
        <div class="message-content">
            <div class="message-header">
                <h4>${msg.sender._id === currentUserId ? 'You' : msg.sender.username}</h4>
                <span class="time">
                    ${new Date(msg.sentAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        })}
                </span>
            </div>
            <p>${escapeHTML(msg.content)}</p>
        </div>
    `;

        if (msg.sender._id === currentUserId) {
            messageDiv.addEventListener('contextmenu', function(e) {
                e.preventDefault();
                const contextMenu = document.getElementById('contextMenu');
                console.log(contextMenu);

                if (contextMenu) {
                    contextMenu.style.display = 'block';
                    contextMenu.style.left = e.pageX + 'px';
                    contextMenu.style.top = e.pageY + 'px';
                    contextMenu.dataset.messageId = msg._id;
                }
            });
        }

        // Add hover effect for own messages
        // if (msg.sender._id === currentUserId) {
        //     messageDiv.addEventListener('contextmenu', handleMessageContextMenu);
        // }

        return messageDiv;
    }

    function createDateDivider(date) {
        const divider = document.createElement('div');
        divider.className = 'date-divider';
        divider.innerHTML = `
        <span>${date === new Date().toDateString() ? 'Today' : date}</span>
    `;
        return divider;
    }

    function scrollToBottom(container) {
        container.scrollTop = container.scrollHeight;
    }

    // Utility function to escape HTML and prevent XSS
    function escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function showSuccessToast(message) {
        const toast = document.createElement('div');
        toast.className = 'success-toast';
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    function showErrorToast(message) {
        const toast = document.createElement('div');
        toast.className = 'error-toast';
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    function setupEventListeners(channel) {
        // Message form submission
        const msgForm = document.getElementById('msgForm');
        msgForm.addEventListener('submit', async function (e) {

            e.preventDefault();

            const input = document.getElementById('msgInput');
            const content = input.value.trim();

            const channelId = channel._id;
            let data = {content, channelId};

            if (content && channel) {
                try {
                    await new Promise((resolve, reject) => {
                        socket.emit('new message', data, function (response) {
                            if (response?.status === 'ok') {
                                resolve(response);
                            } else {
                                showErrorToast("There something went wrong");
                                reject(new Error(response?.message));
                            }
                        });
                    });
                    input.value = '';
                    input.focus();
                } catch (e) {
                    console.error(e);
                    input.value = '';
                    input.focus();
                }
            }
        });

        // Context menu
        setupContextMenu();

        // Scroll to bottom
        const messagesContainer = document.querySelector('.messages');
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function setupContextMenu() {
        const contextMenu = document.getElementById('contextMenu');
        const messages = document.querySelectorAll('.message');

        messages.forEach(message => {
            message.addEventListener('contextmenu', function (e) {
                e.preventDefault();
                const senderId = this.dataset.senderId;

                if (senderId === currentUserId) {
                    contextMenu.style.display = 'block';
                    contextMenu.style.left = e.pageX + 'px';
                    contextMenu.style.top = e.pageY + 'px';
                    contextMenu.dataset.messageId = this.dataset.messageId;
                }
            });
        });

        document.addEventListener('click', function (e) {
            if (!e.target.closest('.context-menu')) {
                contextMenu.style.display = 'none';
            }
        });

        const deleteOption = contextMenu.querySelector('[data-action="delete"]');

        deleteOption.addEventListener('click', async function() {
            const messageId = contextMenu.dataset.messageId;
            if (messageId) {
                socket.emit('delete message', messageId);
            }
            contextMenu.style.display = 'none';
        });
    }

    // socket.on('message deleted', (data) => {
    //     console.log(data);
    // });

    function createMessagesContainer(messages) {
        const container = document.createElement('div');
        container.className = 'messages';

        if (!messages || messages.length === 0) {
            container.innerHTML = `
            <div class="no-messages">
                <p>No messages in this channel yet. Be the first to say something!</p>
            </div>
        `;
            return container;
        }

        let lastMessageDate = null;
        messages.forEach(msg => {
            const messageDate = new Date(msg.sentAt).toDateString();

            if (lastMessageDate !== messageDate) {
                container.appendChild(createDateDivider(messageDate));
                lastMessageDate = messageDate;
            }
            container.appendChild(createMessage(msg));
        });

        container.append(createDateDivider('Today'));
        return container;
    }

    function createDateDivider(date) {
        const divider = document.createElement('div');
        divider.className = 'date-divider';
        divider.innerHTML = `
            <span>${date === new Date().toDateString() ? 'Today' : date}</span>
        `;
        return divider;
    }

    function createMessage(msg) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${msg.sender?._id === currentUserId ? 'own-message' : ''}`;
        messageDiv.dataset.messageId = msg._id;
        messageDiv.dataset.senderId = msg.sender?._id;

        if (msg.sender) {
            messageDiv.innerHTML = `
            <img src="https://api.dicebear.com/9.x/pixel-art/svg?seed=${msg.sender.username}"
                 alt="Avatar" class="message-avatar">
            <div class="message-content">
                <div class="message-header">
                    <h4>${msg.sender._id === currentUserId ? 'You' : msg.sender.username}</h4>
                    <span class="time">
                        ${new Date(msg.sentAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
            })}
                    </span>
                </div>
                <p>${msg.content}</p>
            </div>
        `;
        } else {
            messageDiv.innerHTML = `
            <img src="https://ui-avatars.com/api/?name=John"
                 alt="avatar"
                 class="message-avatar">
            <div class="message-content">
                <div class="message-header">
                    <h4>ERROR: Cannot read username</h4>
                    <span class="time">
                        ${new Date(msg.sentAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
            })}
                    </span>
                </div>
                <p>${msg.content}</p>
            </div>
        `;
        }

        return messageDiv;
    }

    function createInputArea(channel) {
        const inputArea = document.createElement('div');

        inputArea.className = 'input-area';

        inputArea.innerHTML = `

        <div class="attach-wrapper">
            <button class="attach-btn">
                <i class="fas fa-plus-circle"></i>
            </button>
            <div class="attach-options">
                <button type="button"><i class="far fa-smile"></i></button>
                <button type="button"><i class="fas fa-paperclip"></i></button>
            </div>
        </div>

        <form class="input-wrapper" id="msgForm">
            <input id="msgInput" type="text" placeholder="Message # ${channel.name}">
            <button class="send-btn" type="submit">
                <i class="fas fa-paper-plane"></i>
            </button>
        </form>
    `;
        return inputArea;
    }

    function createHeader(channel, memberCount) {
        const header = document.createElement('div');

        header.className = 'chat-header';

        header.innerHTML = `
            <div class="chat-header-info">
                <h2>#${channel.name}</h2>
                <p>${memberCount} members</p>
            </div>
            <div class="chat-header-actions">
                <button><i class="fas fa-user-plus"></i></button>
                <button><i class="fas fa-info-circle"></i></button>
            </div>
            `;
        return header;
    }

    socket.on('channel error', (response) => {
        if (response) {
            alert(response);
        }
    });

    socket.on('message deleted', (data) => {
        const { messageId } = data;

        try {
            const messageElement = document.querySelector(`.message[data-message-id="${messageId}"]`);

            const nextElement = messageElement.nextElementSibling;
            const prevElement = messageElement.previousElementSibling;

            messageElement.remove(); 

            if (nextElement?.classList.contains('date-divider') && 
                prevElement?.classList.contains('date-divider')) {
                nextElement.remove();
            }

        } catch (e) {
            console.log(e);
        }
    });

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

    socket.on('conversation history', ({conversation, messages}) => {
        console.log(conversation);
        console.log(messages);
    })

    async function startOrOpenConversation(receiverId) {
        console.log(receiverId);
        socket.emit('start conversation', receiverId, function (response) {
            console.log(response);
        });
    }

    document.querySelectorAll('.channel-link[data-user-id]').forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            const userId = this.dataset.userId;
            if (userId) {
                startOrOpenConversation(userId);
            }
        });
    });
    // socket.on('select channel', (channelId));
});

