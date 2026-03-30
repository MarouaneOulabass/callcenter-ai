(function() {
  'use strict';

  const script = document.currentScript;
  const TOKEN = script?.getAttribute('data-token');
  const COLOR = script?.getAttribute('data-color') || '#2563eb';
  const API_URL = script?.src ? new URL(script.src).origin : '';

  if (!TOKEN) {
    console.error('CallCenter AI Widget: data-token is required');
    return;
  }

  let isOpen = false;
  let conversationId = null;
  let config = { name: 'Support', primary_color: COLOR, language: 'fr' };

  // Fetch widget config
  fetch(`${API_URL}/api/widget?token=${TOKEN}`)
    .then(r => r.json())
    .then(c => { config = { ...config, ...c }; updateHeader(); })
    .catch(() => {});

  // Styles
  const style = document.createElement('style');
  style.textContent = `
    #ccai-widget-container * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    #ccai-bubble { position: fixed; bottom: 20px; right: 20px; width: 60px; height: 60px; border-radius: 50%; background: ${COLOR}; color: white; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 99999; transition: transform 0.2s; }
    #ccai-bubble:hover { transform: scale(1.1); }
    #ccai-panel { position: fixed; bottom: 90px; right: 20px; width: 380px; max-height: 520px; background: white; border-radius: 16px; box-shadow: 0 8px 30px rgba(0,0,0,0.12); z-index: 99999; display: none; flex-direction: column; overflow: hidden; }
    #ccai-panel.open { display: flex; }
    #ccai-header { padding: 16px; color: white; }
    #ccai-header h3 { font-size: 16px; font-weight: 600; }
    #ccai-header p { font-size: 12px; opacity: 0.9; margin-top: 2px; }
    #ccai-messages { flex: 1; overflow-y: auto; padding: 16px; min-height: 300px; max-height: 360px; }
    .ccai-msg { margin-bottom: 12px; display: flex; }
    .ccai-msg.user { justify-content: flex-end; }
    .ccai-msg-bubble { max-width: 80%; padding: 10px 14px; border-radius: 16px; font-size: 14px; line-height: 1.4; white-space: pre-wrap; word-wrap: break-word; }
    .ccai-msg.assistant .ccai-msg-bubble { background: #f1f5f9; color: #1e293b; border-bottom-left-radius: 4px; }
    .ccai-msg.user .ccai-msg-bubble { background: ${COLOR}; color: white; border-bottom-right-radius: 4px; }
    #ccai-input-area { padding: 12px; border-top: 1px solid #e2e8f0; display: flex; gap: 8px; }
    #ccai-input { flex: 1; border: 1px solid #e2e8f0; border-radius: 24px; padding: 10px 16px; font-size: 14px; outline: none; }
    #ccai-input:focus { border-color: ${COLOR}; }
    #ccai-send { background: ${COLOR}; color: white; border: none; border-radius: 50%; width: 38px; height: 38px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 16px; }
    #ccai-send:disabled { opacity: 0.5; cursor: not-allowed; }
    .ccai-typing { display: flex; gap: 4px; padding: 10px 14px; }
    .ccai-typing span { width: 6px; height: 6px; background: #94a3b8; border-radius: 50%; animation: ccai-bounce 1.4s infinite; }
    .ccai-typing span:nth-child(2) { animation-delay: 0.2s; }
    .ccai-typing span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes ccai-bounce { 0%,80%,100% { transform: translateY(0); } 40% { transform: translateY(-6px); } }
  `;
  document.head.appendChild(style);

  // Container
  const container = document.createElement('div');
  container.id = 'ccai-widget-container';

  // Chat panel
  const panel = document.createElement('div');
  panel.id = 'ccai-panel';
  panel.innerHTML = `
    <div id="ccai-header" style="background:${COLOR}">
      <h3 id="ccai-header-name">${config.name}</h3>
      <p>Agent IA en ligne</p>
    </div>
    <div id="ccai-messages">
      <div class="ccai-msg assistant">
        <div class="ccai-msg-bubble">Bonjour ! Comment puis-je vous aider ?</div>
      </div>
    </div>
    <div id="ccai-input-area">
      <input id="ccai-input" type="text" placeholder="Ecrivez votre message..." autocomplete="off" />
      <button id="ccai-send">&uarr;</button>
    </div>
  `;

  // Bubble
  const bubble = document.createElement('button');
  bubble.id = 'ccai-bubble';
  bubble.innerHTML = '&#x1F4AC;';
  bubble.onclick = function() {
    isOpen = !isOpen;
    panel.classList.toggle('open', isOpen);
    bubble.innerHTML = isOpen ? '&#x2715;' : '&#x1F4AC;';
    if (isOpen) {
      document.getElementById('ccai-input')?.focus();
    }
  };

  container.appendChild(panel);
  container.appendChild(bubble);
  document.body.appendChild(container);

  function updateHeader() {
    const h = document.getElementById('ccai-header-name');
    if (h) h.textContent = config.name;
    const header = document.getElementById('ccai-header');
    if (header) header.style.background = config.primary_color;
  }

  function addMessage(role, text) {
    const messages = document.getElementById('ccai-messages');
    if (!messages) return;
    const div = document.createElement('div');
    div.className = 'ccai-msg ' + role;
    div.innerHTML = '<div class="ccai-msg-bubble">' + escapeHtml(text) + '</div>';
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }

  function showTyping() {
    const messages = document.getElementById('ccai-messages');
    if (!messages) return;
    const div = document.createElement('div');
    div.className = 'ccai-msg assistant';
    div.id = 'ccai-typing';
    div.innerHTML = '<div class="ccai-msg-bubble"><div class="ccai-typing"><span></span><span></span><span></span></div></div>';
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }

  function hideTyping() {
    const el = document.getElementById('ccai-typing');
    if (el) el.remove();
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  async function sendMessage() {
    const input = document.getElementById('ccai-input');
    const sendBtn = document.getElementById('ccai-send');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    sendBtn.disabled = true;
    addMessage('user', text);
    showTyping();

    try {
      const res = await fetch(`${API_URL}/api/widget`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, conversation_id: conversationId, token: TOKEN }),
      });
      const data = await res.json();
      hideTyping();
      if (data.reply) {
        addMessage('assistant', data.reply);
        conversationId = data.conversation_id;
        if (data.escalated) {
          addMessage('assistant', 'Je vous transfère vers un agent humain. Veuillez patienter...');
        }
      }
    } catch (err) {
      hideTyping();
      addMessage('assistant', 'Désolé, une erreur est survenue. Veuillez réessayer.');
    }
    sendBtn.disabled = false;
  }

  // Event listeners
  document.addEventListener('keydown', function(e) {
    if (e.target && e.target.id === 'ccai-input' && e.key === 'Enter') {
      sendMessage();
    }
  });

  document.addEventListener('click', function(e) {
    if (e.target && e.target.id === 'ccai-send') {
      sendMessage();
    }
  });
})();
