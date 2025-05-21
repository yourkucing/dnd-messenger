const d = new Date();
document.getElementById("date").innerHTML = d.getHours().toString().padStart(2, "0") + ":" + d.getMinutes().toString().padStart(2, "0");

const chatBox = document.getElementById("chat-box");
chatBox.scrollTop = chatBox.scrollHeight;

document.getElementById('toggle-chat-access').addEventListener('change', function () {
  const input = document.getElementById('enter-text');
  const sendBtn = document.getElementById('send-button');
  const enabled = this.checked;

  input.disabled = enabled;
  sendBtn.disabled = enabled;
});

function sendBroadcast() {
  const broadcastInput = document.getElementById('broadcast-input');
  const message = broadcastInput.value.trim().toUpperCase();
  if (!message) return;

  const chatOutput = document.getElementById('chat-box');
  const broadcastEl = document.createElement('div');
  broadcastEl.className = 'broadcast';
  broadcastEl.textContent = `[BROADCAST] ${message}`;
  chatOutput.appendChild(broadcastEl);

  broadcastInput.value = '';
}