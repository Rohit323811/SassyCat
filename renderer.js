/* SassyCat renderer: chat, Zzz particles, click-through hit testing, and moods.
   Talks to the main process only through window.sassy (see preload.js). */
'use strict';

/* ---------- Sassy brain (swap this out for a real AI call later) ---------- */
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

const rules = [
  [/\b(hi|hello|hey|yo|sup|hiya)\b/, ["Oh, you're still here? I was hoping you'd left. What do you want?"]],
  [/how are you|how's it going|hows it going|you ok/, ["Magnificent, obviously. Unlike this conversation.", "I'm a cat on a screen. Living the dream."]],
  [/who are you|your name|what are you/, ["I'm SassyCat. You're the one who clicked me, so who's the stranger here?"]],
  [/thank|thx|appreciate/, ["Don't mention it. Seriously. Don't.", "You're welcome. Now go away. Kidding. Mostly."]],
  [/love|cute|pretty|beautiful|adorable|best cat/, ["I know. Keep going, though.", "Flattery will get you nowhere. Continue anyway."]],
  [/hungry|food|treat|fish|tuna|eat|snack/, ["Did you say tuna? Because if not, I'm not interested.", "Feed me or leave me alone. Preferably feed me."]],
  [/sleep|tired|nap|bed|zzz/, ["Finally, someone with sense. Naps are the only honest hobby.", "Shh. I was dreaming about knocking things off tables."]],
  [/bored|boring/, ["Bored? Wow. I'm the entertainment now?", "Go outside. Or stare at a wall. Walls are underrated."]],
  [/joke|funny|laugh/, ["You want a joke? Look in a mirror. Ba dum tss.", "My life is a joke. Your typing is the punchline."]],
  [/help|assist|advice/, ["Help? I'm a cat. My advice: nap more and ignore everyone.", "Sure, I'll help. Step one: stop asking me."]],
  [/\bdog|puppy/, ["Ugh, dogs. Needy, loud, and far too enthusiastic.", "Don't say that word in my house."]],
  [/bye|goodbye|see you|gtg|cya|later/, ["Finally. The door is right there.", "Bye. Try not to miss me too much."]],
  [/code|bug|program|javascript|html|css/, ["Fascinating. Does it work, or are we pretending?", "Have you tried turning it off and walking away?"]]
];

const fallbacks = [
  "Mm-hmm. Fascinating. I wasn't listening.",
  "Is that your best material? Bold of you.",
  "I've had better conversations with a houseplant.",
  "Wow. You typed that. On purpose.",
  "Interesting. Anyway, I'm going to stare at nothing now.",
  "You have my attention. For about two more seconds."
];

function getSassyResponse(userText) {
  const text = userText.toLowerCase().trim();
  for (const [pattern, replies] of rules) {
    if (pattern.test(text)) return pick(replies);
  }
  if (text.endsWith('?')) {
    return pick(["Ask someone who cares. I'll wait.", "A question? From you? Surprising.", "The answer is no. I didn't hear the question, but no."]);
  }
  return pick(fallbacks);
}

/* ---------- Elements & state ---------- */
const chat = document.getElementById('chat');
const cat = document.getElementById('cat');
const messages = document.getElementById('messages');
const composer = document.getElementById('composer');
const input = document.getElementById('input');
const zzz = document.getElementById('zzz');

let chatOpen = false;
let greeted = false;
let mood = null;         // null | 'angry' | 'happy'
let lastApp = null;

/* ---------- Click-through ----------
   The window ignores the mouse, but still forwards mouse-MOVE events to this page.
   When the pointer is over the cat or the open chat panel we ask the main process
   to start catching clicks; the moment it leaves, click-through comes back. */
let interactive = false;
function setInteractive(next) {
  if (next === interactive) return;
  interactive = next;
  window.sassy.setInteractive(next);
}
document.addEventListener('mousemove', (e) => {
  const el = document.elementFromPoint(e.clientX, e.clientY);
  setInteractive(Boolean(el && el.closest('#cat, #chat.open')));
});
document.documentElement.addEventListener('mouseleave', () => setInteractive(false));

/* ---------- Moods ---------- */
const MOODS = [
  { mood: 'angry', match: /\b(steam|discord)/ },
  { mood: 'happy', match: /\b(code|figma)\b/ },
];

function moodFor(appName) {
  const hit = MOODS.find((rule) => rule.match.test(appName));
  return hit ? hit.mood : null;
}

function setMood(next) {
  if (next === mood) return;
  mood = next;
  cat.classList.remove('angry', 'happy');
  if (next) cat.classList.add(next);   // e.g. cat.classList.add('angry')
  console.log(`[SassyCat] mood -> ${next ?? 'neutral'}`);
}

window.sassy.onActiveApp((appName) => {
  if (appName !== lastApp) {
    lastApp = appName;
    console.log('[SassyCat] active app:', appName);
  }
  setMood(moodFor(appName || ''));
});

window.__setMood = setMood;   // handy in DevTools: __setMood('angry'), __setMood(null)

/* ---------- Chat UI ---------- */
function scrollToBottom() { messages.scrollTop = messages.scrollHeight; }

function addMessage(text, who) {
  const el = document.createElement('div');
  el.className = 'msg ' + (who === 'user' ? 'user' : 'cat-msg');
  el.textContent = text;                       // textContent: no HTML injection
  messages.appendChild(el);
  scrollToBottom();
  return el;
}

function catReplies(text) {
  const typing = document.createElement('div');
  typing.className = 'msg cat-msg typing';
  typing.innerHTML = '<i></i><i></i><i></i>';
  messages.appendChild(typing);
  scrollToBottom();
  setTimeout(() => {
    typing.remove();
    addMessage(text, 'cat');
  }, 700 + Math.random() * 700);
}

// The window is only 300x300 while idle, so it grows before the panel slides in
// and shrinks after it has slid out. The cat stays exactly where she is.
function setChat(open) {
  chatOpen = open;
  cat.setAttribute('aria-expanded', String(open));
  if (open) {
    window.sassy.setChatOpen(true);
    setTimeout(() => {
      if (!chatOpen) return;
      chat.classList.add('open');
      chat.inert = false;
      if (!greeted) { greeted = true; addMessage('Well, well. You clicked me. Bold. Talk.', 'cat'); }
      setTimeout(() => input.focus({ preventScroll: true }), 350);
    }, 80);
  } else {
    chat.classList.remove('open');
    chat.inert = true;
    setTimeout(() => { if (!chatOpen) window.sassy.setChatOpen(false); }, 550);
  }
}

cat.addEventListener('click', () => setChat(!chatOpen));
cat.addEventListener('contextmenu', (e) => { e.preventDefault(); window.sassy.showMenu(); });
document.getElementById('close').addEventListener('click', () => setChat(false));
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && chatOpen) setChat(false);
});

composer.addEventListener('submit', (e) => {   // Enter submits the form
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  addMessage(text, 'user');
  input.value = '';
  catReplies(getSassyResponse(text));
});

/* ---------- Zzz particles (only while she is idle and calm) ---------- */
function spawnZzz() {
  if (chatOpen || mood || document.hidden) return;
  ['z', 'Z', 'Z'].forEach((letter, i) => {
    const s = document.createElement('span');
    s.textContent = letter;
    s.style.fontSize = (14 + i * 7) + 'px';
    s.style.setProperty('--d', (i * 0.7) + 's');
    s.addEventListener('animationend', () => s.remove());
    zzz.appendChild(s);
  });
}
setTimeout(spawnZzz, 800);
setInterval(spawnZzz, 5000);
