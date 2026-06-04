const SUPABASE_URL = 'https://hwmjqtydgkdifsdzvhjx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ZJ-LLQAbta2ePXScQdj9Mg_OnNGy51i';

const RESERVED = {
    'andrew':  { tier: 'admin1', hash: 'be3658865d3240f4e793edce1f3ff6f5df56735405d0eb6e4028f7fa04159065' },
    'ethan': { tier: 'admin2', hash: 'e17b5e96b69f64d593b6f659dd026d7fbf32b7a6805a6cce51e762d5feeb4248' },
};

async function sha256(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
 
async function verifyAdminPassword(name, password) {
    const entry = RESERVED[name.toLowerCase()];
    if (!entry) return false;
    return (await sha256(password)) === entry.hash;
}
 
function getReservedTier(name) {
    return RESERVED[name.toLowerCase()]?.tier || null;
}
 
function isReserved(name) {
    return Object.prototype.hasOwnProperty.call(RESERVED, name.toLowerCase());
}
 
const { createClient } = supabase;
const supabaseClient   = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
 
const messagesContainer = document.getElementById('messagesContainer');
const messageInput      = document.getElementById('messageInput');
const sendBtn           = document.getElementById('sendBtn');
const errorContainer    = document.getElementById('errorContainer');
const nameModal         = document.getElementById('nameModal');
const nameInput         = document.getElementById('nameInput');
const nameSubmit        = document.getElementById('nameSubmit');
const modalError        = document.getElementById('modalError');
const passwordRow       = document.getElementById('passwordRow');
const passwordInput     = document.getElementById('passwordInput');
 
let isLoading = false;
let currentUsername = null;
const seenIds = new Set();
 
function getUsername() {
    return localStorage.getItem('webchat_username');
}
 
function saveUsername(name) {
    localStorage.setItem('webchat_username', name);
    currentUsername = name;
}
 
function promptUsername() {
    nameModal.classList.add('visible');
    nameInput.focus();
 
    // Show/hide password field depending on whether the typed name is reserved
    nameInput.addEventListener('input', () => {
        modalError.textContent = '';
        const reserved = isReserved(nameInput.value.trim());
        passwordRow.classList.toggle('visible', reserved);
    });
 
    async function submit() {
        const name = nameInput.value.trim();
        if (!name) return;
 
        if (isReserved(name)) {
            const password = passwordInput.value;
            if (!password) {
                modalError.textContent = 'Enter the password for this username.';
                passwordInput.focus();
                return;
            }
            const ok = await verifyAdminPassword(name, password);
            if (!ok) {
                modalError.textContent = 'Incorrect password.';
                passwordInput.value = '';
                passwordInput.focus();
                return;
            }
        }
 
        saveUsername(name);
        nameModal.classList.remove('visible');
        passwordRow.classList.remove('visible');
        passwordInput.value = '';
        messageInput.focus();
    }
 
    nameSubmit.addEventListener('click', submit);
    nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    passwordInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
}
 
messageInput.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 120) + 'px';
});
 
messageInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});
 
sendBtn.addEventListener('click', sendMessage);
 
async function sendMessage() {
    const messageText = messageInput.value.trim();
    if (!messageText || isLoading) return;
 
    isLoading = true;
    sendBtn.disabled = true;
 
    try {
        const { data: insertedData, error } = await supabaseClient
            .from('messages')
            .insert([{
                username:   currentUsername,
                message:    messageText,
                created_at: new Date().toISOString(),
            }])
            .select();
 
        if (error) throw error;
 
        // Track the new row's id so the realtime subscription skips it
        if (insertedData?.[0]?.id) seenIds.add(insertedData[0].id);
 
        // Optimistically render immediately for the sender
        addMessageToUI(currentUsername, messageText, new Date().toISOString());
 
        messageInput.value = '';
        messageInput.style.height = 'auto';
    } catch (err) {
        showError(`Failed to post: ${err.message}`);
    } finally {
        isLoading = false;
        sendBtn.disabled = false;
        messageInput.focus();
    }
}
 
function addMessageToUI(username, text, timestamp) {
    const el = document.createElement('div');
    const tier = getReservedTier(username);
    el.className = 'message' + (tier ? ` message-${tier}` : '');
 
    const time = timestamp
        ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
 
    el.innerHTML = `
        <div class="message-meta">
            <span class="message-username">${escapeHtml(username)}</span>
            <span class="message-timestamp">${time}</span>
        </div>
        <div class="message-content">${escapeHtml(text)}</div>
    `;
 
    messagesContainer.appendChild(el);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}
 
async function loadMessages() {
    try {
        const { data, error } = await supabaseClient
            .from('messages')
            .select('*')
            .order('created_at', { ascending: true })
            .limit(50);
 
        if (error) throw error;
 
        messagesContainer.innerHTML = '';
        data?.forEach((msg) => addMessageToUI(msg.username, msg.message, msg.created_at));
    } catch (err) {
        showError(`Failed to load messages: ${err.message}`);
    }
}
 
function subscribeToMessages() {
    supabaseClient
        .channel('messages')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
            const msg = payload.new;
            if (seenIds.has(msg.id)) { seenIds.delete(msg.id); return; }
            addMessageToUI(msg.username, msg.message, msg.created_at);
        })
        .subscribe();
}
 
function escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, (m) => map[m]);
}
 
function showError(message) {
    errorContainer.innerHTML = `<div class="error">${escapeHtml(message)}</div>`;
    setTimeout(() => { errorContainer.innerHTML = ''; }, 5000);
}
 
async function init() {
    const saved = getUsername();
    if (saved) {
        currentUsername = saved;
    } else {
        promptUsername();
    }
 
    await loadMessages();
    subscribeToMessages();
    messageInput.focus();
}
 
init();
