// Firebase config (replace with your own project settings)
const firebaseConfig = {
    apiKey: "AIzaSyAPCH3LwCtz6b-rWaZfKLPh5hszP8CgbEs",
    authDomain: "pigeon-58e9a.firebaseapp.com",
    projectId: "pigeon-58e9a",
  storageBucket: "pigeon-58e9a.appspot.com",
    messagingSenderId: "989902009513",
    appId: "1:989902009513:web:beb040de26acf54fee65b8"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const storage = firebase.storage(); // ✅ Add this line here

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

function sendPhoto(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const dataUrl = e.target.result; // Base64 string
        db.ref(`rooms/${room}/messages`).push({
            sender: username,
            photoBase64: dataUrl,
            time: new Date().toISOString(),
            readBy: [username]
        });
    };
    reader.readAsDataURL(file);
}


function openCamera() {
    const video = document.getElementById('cameraStream');
    const captureBtn = document.getElementById('captureBtn');

    navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
            video.srcObject = stream;
            video.style.display = 'block';
            captureBtn.style.display = 'inline-block';

            // Show cancel button too
            const cancelBtn = document.getElementById('cancelBtn');
            cancelBtn.style.display = 'inline-block';
        })
        .catch(err => alert("Camera access denied: " + err));
}

function capturePhoto() {
    const video = document.getElementById('cameraStream');
    const canvas = document.getElementById('cameraCanvas');
    const context = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Show the canvas preview
    canvas.style.display = 'block';

    // Hide capture, show send
    document.getElementById('captureBtn').style.display = 'none';
    document.getElementById('sendBtnPhoto').style.display = 'inline-block';
}

function sendCapturedPhoto() {
    const canvas = document.getElementById('cameraCanvas');
    const dataUrl = canvas.toDataURL('image/jpeg'); // Base64 string

    db.ref(`rooms/${room}/messages`).push({
        sender: username,
        photoBase64: dataUrl,   // ✅ store Base64 directly
        time: new Date().toISOString(),
        readBy: [username]
    });

    closeCamera();
}




function closeCamera() {
    const video = document.getElementById('cameraStream');
    const stream = video.srcObject;
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
    video.srcObject = null;
    video.style.display = 'none';

    // Hide all buttons and canvas
    document.getElementById('captureBtn').style.display = 'none';
    document.getElementById('sendBtnPhoto').style.display = 'none';
    document.getElementById('cancelBtn').style.display = 'none';
    document.getElementById('cameraCanvas').style.display = 'none';
}


function closeCamera() {
    const video = document.getElementById('cameraStream');
    const stream = video.srcObject;
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
    video.srcObject = null;
    video.style.display = 'none';

    document.getElementById('captureBtn').style.display = 'none';
    document.getElementById('cancelBtn').style.display = 'none';
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
    messageLine.innerHTML = `<span style="color: gray;">[${time}]</span> <strong>${sender}:</strong>`;
    wrapper.appendChild(messageLine);

    // ✅ Show text or photo
    if (msgObj.text) {
        const textNode = document.createElement('span');
        textNode.textContent = " " + msgObj.text;
        messageLine.appendChild(textNode);
    }
    if (msgObj.photoBase64) {
        const img = document.createElement('img');
        img.src = msgObj.photoBase64;
        img.style.maxWidth = '200px';
        img.style.display = 'block';
        img.style.marginTop = '5px';
        img.style.borderRadius = '8px';
        wrapper.appendChild(img);
    }


    // ✅ Seen receipts
    if (showSeen && msgObj.sender === username) {
        const others = (msgObj.readBy || []).filter(name => name !== username);
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

    // Clear existing content
    wrapper.innerHTML = '';

    const time = formatTimestamp(msgObj.time);
    const sender = msgObj.sender === username ? 'You' : msgObj.sender;

    // Header line with timestamp + sender
    const messageLine = document.createElement('div');
    messageLine.innerHTML = `<span style="color: gray;">[${time}]</span> <strong>${sender}:</strong>`;
    wrapper.appendChild(messageLine);

    // ✅ Show text if present
    if (msgObj.text) {
        const textNode = document.createElement('span');
        textNode.textContent = " " + msgObj.text;
        messageLine.appendChild(textNode);
    }

    // ✅ Show photo if present
    if (msgObj.photoBase64) {
        const img = document.createElement('img');
        img.src = msgObj.photoBase64;
        img.style.maxWidth = '200px';
        img.style.display = 'block';
        img.style.marginTop = '5px';
        img.style.borderRadius = '8px';
        wrapper.appendChild(img);
    }


    // ✅ Seen receipts
    if (showSeen && msgObj.sender === username) {
        const others = (msgObj.readBy || []).filter(name => name !== username);
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

