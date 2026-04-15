
// SUPABASE CONFIGURATION
const SUPABASE_URL = 'https://hwmjqtydgkdifsdzvhjx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ZJ-LLQAbta2ePXScQdj9Mg_OnNGy51i';
const TABLE_NAME = 'items';

class SupabaseClient {
	constructor(url, key) {
		this.url = url;
		this.key = key;
	}

	async request(method, path, body = null) {
		const fullUrl = `${this.url}/rest/v1${path}`;
		const headers = {
			'Content-Type': 'application/json',
			'apikey': this.key,
			'Authorization': `Bearer ${this.key}`,
		};

		const options = { method, headers };
		if (body) options.body = JSON.stringify(body);

		try {
			const response = await fetch(fullUrl, options);
			const responseText = await response.text();

			if (!response.ok) {
				throw new Error(`Supabase Error (${response.status}): ${responseText}`);
			}

			return responseText ? JSON.parse(responseText) : null;
		} catch (error) {
			console.error('API Error:', error);
			throw error;
		}
	}

	async select(table, query = '*') {
		return this.request('GET', `/${table}?select=${query}&order=created_at.desc`);
	}

	async insert(table, data) {
		return this.request('POST', `/${table}`, data);
	}
}

const supabase = new SupabaseClient(SUPABASE_URL, SUPABASE_KEY);


const form = document.getElementById('signatureForm');
const nameInput = document.getElementById('name');
const emailInput = document.getElementById('email');
const messageInput = document.getElementById('message');
const submitStatus = document.getElementById('submitStatus');
const signaturesContainer = document.getElementById('signaturesContainer');
const signatureCount = document.getElementById('signatureCount');


function showStatus(message, type) {
	submitStatus.textContent = message;
	submitStatus.className = `status show ${type}`;
	
	if (type === 'success') {
		setTimeout(() => submitStatus.classList.remove('show'), 4000);
	}
}

function formatDate(dateString) {
	const date = new Date(dateString);
	return date.toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	});
}


async function loadSignatures() {
	try {
		const data = await supabase.select(TABLE_NAME);

		if (!data || data.length === 0) {
			signaturesContainer.innerHTML = '<div class="no-signatures">Be the first to sign!</div>';
			signatureCount.textContent = '0';
			return;
		}

		signatureCount.textContent = data.length;
		signaturesContainer.innerHTML = '';

		data.forEach((signature, index) => {
			const div = document.createElement('div');
			div.className = 'signature';
			div.style.animationDelay = `${index * 0.05}s`;

			const name = signature.title || signature.name || 'Anonymous';
			const email = signature.description || signature.email || '';
			const message = signature.status === 'active' && signature.message ? signature.message : '';
			const time = signature.created_at ? formatDate(signature.created_at) : '';

			let html = `<div class="signature-name">${escapeHtml(name)}</div>`;
			if (email) {
				html += `<div class="signature-email">${escapeHtml(email)}</div>`;
			}
			if (message) {
				html += `<div class="signature-message">"${escapeHtml(message)}"</div>`;
			}
			if (time) {
				html += `<div class="signature-time">${time}</div>`;
			}

			div.innerHTML = html;
			signaturesContainer.appendChild(div);
		});

	} catch (error) {
		console.error('Error loading signatures:', error);
		signaturesContainer.innerHTML = '<div class="no-signatures">Unable to load signatures</div>';
	}
}

function escapeHtml(text) {
	const div = document.createElement('div');
	div.textContent = text;
	return div.innerHTML;
}

form.addEventListener('submit', async (e) => {
	e.preventDefault();

	const name = nameInput.value.trim();
	if (!name) {
		showStatus('Please enter your name', 'error');
		return;
	}

	const email = emailInput.value.trim();
	const message = messageInput.value.trim();

	const submitBtn = form.querySelector('button');
	submitBtn.disabled = true;
	submitBtn.textContent = 'Signing...';

	try {
		await supabase.insert(TABLE_NAME, {
			title: name,
			description: email || null,
			message: message || null,
			status: 'active'
		});

		showStatus('Signature added! Thank you!', 'success');
		form.reset();

		await loadSignatures();

	} catch (error) {
		console.error('Error:', error);
		showStatus(`Error: ${error.message}`, 'error');
	} finally {
		submitBtn.disabled = false;
		submitBtn.textContent = 'Sign the Book';
	}
});


async function startAutoRefresh() {
	await loadSignatures();
	setInterval(loadSignatures, 3000);
}


startAutoRefresh();
