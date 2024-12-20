document.addEventListener('DOMContentLoaded', () => {

    const currentUsername = document.getElementById("username-hidden").value;
    const currentUserId = document.getElementById("userid-hidden").value;

    /**
     * ===========================  Socket Authentication ===========================
     */
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
     * ============================================================================
     */


    /**
     * Socket connecting
     */
    socket.on('connect', () => {
        console.log('Connected');
        joinCurrentChannel();
    });

    class UserInviteSystem {
        constructor() {
            this.modal = document.getElementById('inviteUserModal');
            this.searchInput = document.getElementById('userSearchInput');
            this.searchResults = document.getElementById('searchResults');
            this.selectedUsersList = document.getElementById('selectedUsersList');
            this.channelNameSpan = document.getElementById('channelNameInvite');
            this.sendInvitesBtn = document.getElementById('sendInvites');

            this.currentChannel = null;
            this.selectedUsers = new Map(); // Using Map to store selected users
            this.searchTimeout = null;
            this.initialize();
        } 

        displaySearchResults(users) {
            if (!users.length) {
                this.searchResults.innerHTML = '<div class="p-3">No users found</div>';
                this.searchResults.style.display = 'block';
                return;
            }

            this.searchResults.innerHTML = users
                .map(user => `
                <div class="search-result-item" data-user-id="${user._id}">
                    <div class="user-avatar">
                        ${user.username.charAt(0).toUpperCase()}
                    </div>
                    <span>${user.username}</span>
                </div>
            `)
                .join('');

            this.searchResults.style.display = 'block';

            // Add click handlers for results
            this.searchResults.querySelectorAll('.search-result-item').forEach(item => {
                item.addEventListener('click', () => {
                    const userId = item.dataset.userId;
                    const username = item.querySelector('span').textContent;
                    this.addSelectedUser(userId, username);
                });
            });
        }

        addSelectedUser(userId, username) {
            if (!this.selectedUsers.has(userId)) {
                this.selectedUsers.set(userId, username);
                this.updateSelectedUsersList();
            }
            this.searchInput.value = '';
            this.searchResults.style.display = 'none';
        }

        removeSelectedUser(userId) {
            this.selectedUsers.delete(userId);
            this.updateSelectedUsersList();
        }

        updateSelectedUsersList() {
            this.selectedUsersList.innerHTML = Array.from(this.selectedUsers.entries())
                .map(([id, username]) => `
                <div class="selected-user-tag">
                    <span style="color: #dcddde">${username}</span>
                    <span class="remove-user" data-user-id="${id}">&times;</span>
                </div>
            `)
                .join('');

            // Add remove handlers
            this.selectedUsersList.querySelectorAll('.remove-user').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    this.removeSelectedUser(e.target.dataset.userId);
                });
            });
        }

        initializeSocketListeners() {
            socket.on('search user results', (users) => {
                console.log(users);
                this.displaySearchResults(users);
            });

            socket.on('invite results', (result) => {
                if (result.status === 'ok') {
                    showSuccessToast('Invitations sent successfully');
                    this.hideModal();
                } else {
                    showErrorToast(result.error);
                }
            });

            socket.on('channel invite', (invite) => {
                showNotificationToast(invite);
            });
        }

        sendInvites() {
            if (this.selectedUsers.size === 0) {
                showErrorToast('Please select at least one user to invite');
                return;
            }

            socket.emit('invite users', {
                channelId: this.currentChannel._id,
                userIds: Array.from(this.selectedUsers.keys())
            }, (response) => {
                if (response.status !== 'ok') {
                    showErrorToast(response?.message);
                }
            });
        }

        hideModal() {
            this.modal.style.display = 'none';
            this.searchInput.value = '';
            this.searchResults.style.display = 'none';
            this.selectedUsers.clear();
            this.updateSelectedUsersList();
        }

        handleSearch() {
            clearTimeout(this.searchTimeout);

            const query = this.searchInput.value.trim();
            console.log(query);

            if (query.length < 2) {
                this.searchResults.style.display = 'none';
            }

            // Delays 300ms
            this.searchTimeout = setTimeout(() => {
                // Emit search event to server
                socket.emit('search users', {
                    query,
                    channelId: this.currentChannel._id
                }, (response) => {
                    if (response.status !== 'ok') {
                        showErrorToast(response.error);
                    }
                });
            }, 300);
        }

        showModal(channel) {
            this.currentChannel = channel;
            this.channelNameSpan.textContent = channel.name;
            this.modal.style.display = 'block';
            this.searchInput.focus();
        }

        initialize() {
            // Setup event listeners
            document.querySelectorAll('.close-modal').forEach(btn => {
                btn.addEventListener('click', () => this.hideModal());
            });

            this.searchInput.addEventListener('input', () => this.handleSearch());
            this.sendInvitesBtn.addEventListener('click', () => this.sendInvites());

            // Close modal when clicking outside
            this.modal.addEventListener('click', (e) => {
                if (e.target === this.modal) this.hideModal();
            });

            this.initializeSocketListeners();
        }
    }
    const userInviteSystem = new UserInviteSystem();

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
            addChannelToList(channel);
        });

        if (channels.length <= 0 || channels.empty) {
            showErrorToast('Sorry, channel not found');
        }
        // attachChannelClickListeners();
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
        const isChannelPrivate = document.getElementById('isChannelPrivate').checked;

        submitButton.disabled = true;

        try {
            const formData = {
                name: channelNameInput.value.trim(),
                description: document.getElementById('channelDescription').value.trim(),
                isPrivate: isChannelPrivate,
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


    function requestJoinChannel(channelId) {
        socket.emit('request join channel', channelId, (response) => {
            if (response.status === 'ok') {
                const joinButton = document.querySelector(
                    `.channel-link[data-channel-id="${channelId}"] .join-button`
                );
                if (joinButton) {
                    joinButton.outerHTML = '<span class="status-badge pending">Request Pending</span>';
                }
                showSuccessToast('Join request sent successfully');
            } else {
                showErrorToast(response.error || 'Failed to send join request');
            }
        })
    }

    socket.on('join request notification', (data) => {
        console.log(data);
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

        const privacyIcon = channel.isPrivate ? 
            '<i class="fas fa-lock" title="Private Channel"></i>' : 
            '<i class="fas fa-hashtag"></i>';


        // Create channel link container
        const channelLink = document.createElement('div');
        channelLink.className = 'channel-link';
        channelLink.style.textDecoration = 'none';
        channelLink.style.color = '#dcddde';
        channelLink.setAttribute('data-channel-id', channel._id);

        // Check if user is already a member or has pending request
        const membershipStatus = channel.userStatus || 'none';
        console.log(channel);

        let joinButtonHtml = '';
        switch(membershipStatus) {
            case 'accepted':
                joinButtonHtml = '<span class="status-badge member">Member</span>';
                break;
            case 'pending':
                joinButtonHtml = '<span class="status-badge pending">Request Pending</span>';
                break;
            case 'none':
                joinButtonHtml = '<button class="join-button">Join Channel</button>';
                break;
        }

        // Create channel element
        const channelElement = document.createElement('div');
        channelElement.className = 'channel';
        channelElement.setAttribute('channel-data-id', channel._id);


        channelElement.innerHTML = `
        <div class="channel" channel-data-id="${channel._id}">
            <div class="channel-icon">
              ${privacyIcon}
            </div>
            <div class="channel-info">
                <div class="channel-header">
                    <h4>${channel.name}</h4>
                    ${joinButtonHtml}
                </div>
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

        const joinBtn = channelElement.querySelector('.join-button');
        if (joinBtn) {
            joinBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                requestJoinChannel(channel._id);
            });
        }
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
        // console.log(data);
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
        // console.log(data);
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
             
    function declineInvite(channelId) {

    }

    function acceptInvite(channelId) {
        socket.emit('accept channel invite', { channelId }, (response) => {
            console.log(response);
            if (response.status === 'ok') {
                addChannelToList(response.channel);
                showSuccessToast(response?.message)
            } else {
                showErrorToast(response?.error || 'Something went wrong');
            }
        });
    }

    function showNotificationToast(invite) {
        const toast = document.createElement('div');
        toast.className = 'toast-notification';
        console.log(invite);

        toast.innerHTML = `
        <div class="toast-content">
            <div class="toast-header">
                <i class="fas fa-envelope"></i>
                <span>Channel Invitation</span>
            </div>
            <div class="toast-body">
                <p><strong>${invite.invitedBy}</strong> invited you to join <strong>#${invite.channelName}</strong></p>
                <div class="toast-actions">
                    <button class="accept-invite-btn">Accept</button>
                    <button class="decline-invite-btn">Decline</button>
                </div>
            </div>
        </div>
        `;

        const acceptBtn = toast.querySelector('.accept-invite-btn');
        const declineBtn = toast.querySelector('.decline-invite-btn');

        acceptBtn.addEventListener('click', () => {
            acceptInvite(invite.channelId);
            toast.remove();
        });

        declineBtn.addEventListener('click', () => {
            declineInvite(invite.channelId);
            toast.remove();
        });
        
        document.body.appendChild(toast);
        // Auto remove after 10 secs
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 20000);
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
                                showErrorToast(response?.error);
                                reject(new Error(response?.error));
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
                <button id="inviteButton"><i class="fas fa-user-plus"></i></button>
                <button><i class="fas fa-info-circle"></i></button>
            </div>
            `;
        header.querySelector('#inviteButton').addEventListener('click', () => {
            userInviteSystem.showModal(channel);
        })
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

    function getCurrentChannel() {
        const activeChannel = document.querySelector('.channel.active');
        return activeChannel?.getAttribute('channel-data-id') || null;
    }

    window.addEventListener('beforeunload', () => {
        if (socket) {
            socket.disconnect();
        }
    });

    // socket.on('conversation history', ({conversation, messages}) => {
    //     console.log(conversation);
    //     console.log(messages);
    // })

    // async function startOrOpenConversation(receiverId) {
    //     console.log(receiverId);
    //     socket.emit('start conversation', receiverId, function (response) {
    //         console.log(response);
    //     });
    // }

    // document.querySelectorAll('.channel-link[data-user-id]').forEach(link => {
    //     link.addEventListener('click', function (e) {
    //         e.preventDefault();
    //         const userId = this.dataset.userId;
    //         if (userId) {
    //             startOrOpenConversation(userId);
    //         }
    //     });
    // });
    // socket.on('select channel', (channelId));
});

