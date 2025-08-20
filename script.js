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
    username = document.getElementById('usernameInput').value;
    if (room && username) {
        document.getElementById('chat').style.display = 'block';
        db.ref(`rooms/${room}`).on('child_added', snapshot => {
            const msg = snapshot.val();
            const sender = msg.sender === username ? 'You' : msg.sender;
            addMessage(`${sender}: ${msg.text}`);
        });
    }
}


function sendMessage() {
    const input = document.getElementById('messageInput');
    const text = input.value;
    if (text) {
        db.ref(`rooms/${room}`).push({
            sender: username,
            text: text
        });
        input.value = '';
    }
}


function addMessage(msg) {
    const messages = document.getElementById('messages');
    const div = document.createElement('div');
    div.textContent = msg;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
}
