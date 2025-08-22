// Firebase config (replace with your own project settings)
const firebaseConfig = {
    apiKey: "AIzaSyAPCH3LwCtz6b-rWaZfKLPh5hszP8CgbEs",
    authDomain: "pigeon-58e9a.firebaseapp.com",
    projectId: "pigeon-58e9a",
    storageBucket: "pigeon-58e9a.firebasestorage.app",
    messagingSenderId: "989902009513",
    appId: "1:989902009513:web:beb040de26acf54fee65b8"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let room = '';
let username = '';

function joinRoom() {
    room = document.getElementById('roomInput').value;
    const password = document.getElementById('passwordInput').value;
    username = prompt("Enter your name:");

    if (room && password && username) {
        const roomRef = db.ref(`rooms/${room}/meta`);

        roomRef.once('value', snapshot => {
            const data = snapshot.val();

            if (data === null) {
                // Room doesn't exist yet — create it
                roomRef.set({ password: password });
                startChat();
            } else {
                // Room exists — check password
                if (data.password === password) {
                    startChat();
                } else {
                    alert("Incorrect password.");
                }
            }
        });
    }
}

function startChat() {
    document.getElementById('joinUI').style.display = 'none';
    document.getElementById('chat').style.display = 'block';

    const messagesRef = db.ref(`rooms/${room}/messages`);
    let latestSeenKey = null;

    messagesRef.on('child_added', snapshot => {
        const msg = snapshot.val();
        const key = snapshot.key;

        // Mark as read if not already
        if (!msg.readBy || !msg.readBy.includes(username)) {
            db.ref(`rooms/${room}/messages/${key}/readBy`).set(
                [...(msg.readBy || []), username]
            );
        }

        // Determine if this is the latest seen message
        const others = (msg.readBy || []).filter(name => name !== msg.sender);
        if (others.length > 0 && msg.sender === username) {
            latestSeenKey = key;
        }

        addMessage(msg, key, key === latestSeenKey);
    });

    messagesRef.on('child_changed', snapshot => {
        const msg = snapshot.val();
        const key = snapshot.key;

        const others = (msg.readBy || []).filter(name => name !== msg.sender);
        if (others.length > 0 && msg.sender === username) {
            latestSeenKey = key;
        }

        updateMessageDisplay(key, msg, key === latestSeenKey);
    });

    setupTypingIndicator();
}






function sendMessage() {
    const input = document.getElementById('messageInput');
    const text = input.value.trim();

    if (text) {
        db.ref(`rooms/${room}/messages`).push({
            sender: username,
            text: text,
            time: new Date().toISOString(),
            readBy: [username]
        });

        input.value = '';
        db.ref(`rooms/${room}/typing/${username}`).set(false); // ✅ Reset typing

        input.addEventListener('blur', () => {
            db.ref(`rooms/${room}/typing/${username}`).set(false);
        });

    }
}


function setupTypingIndicator() {
    const typingRef = db.ref(`rooms/${room}/typing/${username}`);
    const input = document.getElementById('messageInput');

    input.addEventListener('input', () => {
        const text = input.value.trim();
        typingRef.set(text.length > 0);
    });

    db.ref(`rooms/${room}/typing`).on('value', snapshot => {
        const typingUsers = [];
        snapshot.forEach(child => {
            if (child.val() && child.key !== username) {
                typingUsers.push(child.key);
            }
        });

        const typingText = typingUsers.length
            ? `${typingUsers.join(', ')} is typing...`
            : '';
        document.getElementById('typingIndicator').innerText = typingText;
    });
}


function renderMessages() {
    const messages = document.getElementById('messages');
    messages.innerHTML = ''; // Clear previous

    messageCache.forEach(({ key, msg }) => {
        const wrapper = document.createElement('div');
        wrapper.style.marginBottom = '8px';

        const time = formatTimestamp(msg.time);
        const sender = msg.sender === username ? 'You' : msg.sender;

        const messageLine = document.createElement('div');
        messageLine.innerHTML = `<span style="color: gray;">[${time}]</span> <strong>${sender}:</strong> ${msg.text}`;
        wrapper.appendChild(messageLine);

        if (key === latestSeenKey && msg.readBy && msg.readBy.length > 0) {
            const readLine = document.createElement('div');
            readLine.style.fontSize = '0.8em';
            readLine.style.color = '#888';
            readLine.style.marginLeft = '20px';
            readLine.textContent = `Seen by: ${msg.readBy.join(', ')}`;
            wrapper.appendChild(readLine);
        }

        messages.appendChild(wrapper);
    });

    messages.scrollTop = messages.scrollHeight;
}


function addMessage(msgObj, key, showSeen) {
    const messages = document.getElementById('messages');

    const wrapper = document.createElement('div');
    wrapper.id = `msg-${key}`;
    wrapper.style.marginBottom = '8px';

    const time = formatTimestamp(msgObj.time);
    const sender = msgObj.sender === username ? 'You' : msgObj.sender;

    const messageLine = document.createElement('div');
    messageLine.innerHTML = `<span style="color: gray;">[${time}]</span> <strong>${sender}:</strong> ${msgObj.text}`;
    wrapper.appendChild(messageLine);

    if (showSeen && msgObj.sender === username) {
        const others = msgObj.readBy.filter(name => name !== username);
        if (others.length > 0) {
            const readLine = document.createElement('div');
            readLine.className = 'read-receipt';
            readLine.style.fontSize = '0.8em';
            readLine.style.color = '#888';
            readLine.style.marginLeft = '20px';
            readLine.textContent = `Seen by: ${others.join(', ')}`;
            wrapper.appendChild(readLine);
        }
    }

    messages.appendChild(wrapper);
    messages.scrollTop = messages.scrollHeight;
}


function updateMessageDisplay(key, msgObj, showSeen) {
    const wrapper = document.querySelector(`#msg-${key}`);
    if (!wrapper) return;

    const oldReceipt = wrapper.querySelector('.read-receipt');
    if (oldReceipt) wrapper.removeChild(oldReceipt);

    if (showSeen && msgObj.sender === username) {
        const others = msgObj.readBy.filter(name => name !== username);
        if (others.length > 0) {
            const readLine = document.createElement('div');
            readLine.className = 'read-receipt';
            readLine.style.fontSize = '0.8em';
            readLine.style.color = '#888';
            readLine.style.marginLeft = '20px';
            readLine.textContent = `Seen by: ${others.join(', ')}`;
            wrapper.appendChild(readLine);
        }
    }
}






function toggleColorPanel() {
    const panel = document.getElementById('colorPanel');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

function setColor(variable, value) {
    document.documentElement.style.setProperty(variable, value);
    localStorage.setItem(variable, value);
}

function formatTimestamp(isoString) {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}


// Load saved colors on startup
window.onload = () => {
    const savedBg = localStorage.getItem('--bg-color');
    if (savedBg) {
        document.documentElement.style.setProperty('--bg-color', savedBg);
    }

    const savedAccent = localStorage.getItem('--accent-color');
    if (savedAccent) {
        document.documentElement.style.setProperty('--accent-color', savedAccent);
    }

    const savedText = localStorage.getItem('--text-color');
    if (savedText) {
        document.documentElement.style.setProperty('--text-color', savedText);
    }
};

