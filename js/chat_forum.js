const SUPABASE_URL      = 'https://hwmjqtydgkdifsdzvhjx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ZJ-LLQAbta2ePXScQdj9Mg_OnNGy51i';

// ── Reserved admin accounts ───────────────────────────────────────────────────
// tier: 'admin1' | 'admin2'
// hash: SHA-256 of the admin's password
const RESERVED = {
    'andrew': { tier: 'admin1', hash: 'be3658865d3240f4e793edce1f3ff6f5df56735405d0eb6e4028f7fa04159065' },
    'ethan': { tier: 'admin2', hash: '1ae28252b6a3f98dbae7c565f2d69ee17e0843f7c0c4a93b98f071aac5891070' },
};

// Usernames containing any of these substrings (case-insensitive) are rejected
const BANNED_TERMS = [
    'andrew', 'ethan', 'andy', 'stanish', 'miao', 'stanian',
    'admin', 'mod', 'moderator', 'system', 'andyscott',
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function isBanned(name) {
    const lower = name.toLowerCase();
    return BANNED_TERMS.some(term => lower.includes(term));
}

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

function linkify(text) {
    return text.replace(
        /https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]]/g,
        (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`
    );
}

function escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, (m) => map[m]);
}

// ── Supabase ──────────────────────────────────────────────────────────────────
const { createClient } = supabase;
const supabaseClient   = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── DOM ───────────────────────────────────────────────────────────────────────
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

// ── State ─────────────────────────────────────────────────────────────────────
let isLoading = false;
let currentUsername = null;
let currentUserId   = null;   // auth.uid() from anonymous session
const seenIds = new Set();

// ── Auth ──────────────────────────────────────────────────────────────────────
async function getOrCreateSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) return session;

    // No session — create an anonymous one
    const { data, error } = await supabaseClient.auth.signInAnonymously();
    if (error) throw new Error(`Auth failed: ${error.message}`);
    return data.session;
}

// ── Profile ───────────────────────────────────────────────────────────────────
async function loadProfile(userId) {
    const { data, error } = await supabaseClient
        .from('profiles')
        .select('username, tier')
        .eq('id', userId)
        .maybeSingle();

    if (error) throw new Error(`Profile load failed: ${error.message}`);
    return data; // null if no profile yet
}

async function createProfile(userId, username, tier) {
    const { error } = await supabaseClient
        .from('profiles')
        .insert([{ id: userId, username, tier }]);

    if (error) {
        // Unique constraint violation = username already taken
        if (error.code === '23505') throw new Error('USERNAME_TAKEN');
        throw new Error(`Profile create failed: ${error.message}`);
    }
}

// ── Username modal ────────────────────────────────────────────────────────────
function promptUsername() {
    return new Promise((resolve) => {
        nameModal.classList.add('visible');
        nameInput.focus();

        nameInput.addEventListener('input', () => {
            modalError.textContent = '';
            passwordRow.classList.toggle('visible', isReserved(nameInput.value.trim()));
        });

        async function submit() {
            const name = nameInput.value.trim();
            if (!name) return;

            // Validate
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
            } else if (isBanned(name)) {
                modalError.textContent = 'That username is not allowed.';
                nameInput.focus();
                return;
            }

            // Try to create the profile in Supabase
            const tier = getReservedTier(name);
            try {
                nameSubmit.disabled = true;
                await createProfile(currentUserId, name, tier);
            } catch (err) {
                nameSubmit.disabled = false;
                if (err.message === 'USERNAME_TAKEN') {
                    modalError.textContent = 'That username is already taken.';
                } else {
                    modalError.textContent = err.message;
                }
                return;
            }

            nameModal.classList.remove('visible');
            passwordRow.classList.remove('visible');
            passwordInput.value = '';
            nameSubmit.disabled = false;
            resolve(name);
        }

        nameSubmit.addEventListener('click', submit);
        nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
        passwordInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    });
}

// ── Messaging ─────────────────────────────────────────────────────────────────
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
                user_id:    currentUserId,
                username:   currentUsername,
                message:    messageText,
                created_at: new Date().toISOString(),
            }])
            .select();

        if (error) throw error;

        if (insertedData?.[0]?.id) seenIds.add(insertedData[0].id);
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

// ── UI ────────────────────────────────────────────────────────────────────────
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
        <div class="message-content">${linkify(escapeHtml(text))}</div>
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

function showError(message) {
    errorContainer.innerHTML = `<div class="error">${escapeHtml(message)}</div>`;
    setTimeout(() => { errorContainer.innerHTML = ''; }, 5000);
}

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
    try {
        // 1. Get or create anonymous auth session
        const session = await getOrCreateSession();
        currentUserId = session.user.id;

        // 2. Load profile for this session's uid
        const profile = await loadProfile(currentUserId);

        if (profile) {
            // Returning user — use their stored username
            currentUsername = profile.username;
        } else {
            // New user — prompt for a name, create profile in DB
            currentUsername = await promptUsername();
        }

        // 3. Load chat history and subscribe
        await loadMessages();
        subscribeToMessages();
        messageInput.focus();
    } catch (err) {
        showError(`Startup error: ${err.message}`);
    }
}

init();
