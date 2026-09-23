'use strict';

/* ---- Navbar scroll state ---- */
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 40);
  document.getElementById('backTop').classList.toggle('visible', window.scrollY > 500);
}, { passive: true });

/* ---- Mobile menu ---- */
const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('navLinks');
hamburger.addEventListener('click', () => navLinks.classList.toggle('open'));
navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', () => navLinks.classList.remove('open')));

/* ---- Back to top ---- */
document.getElementById('backTop').addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

/* ---- Reveal on scroll ---- */
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('in-view');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.15 });
document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

/* ---- FAQ accordion ---- */
document.querySelectorAll('.faq-item').forEach(item => {
  item.querySelector('.faq-q').addEventListener('click', () => {
    const wasOpen = item.classList.contains('open');
    document.querySelectorAll('.faq-item.open').forEach(i => i.classList.remove('open'));
    if (!wasOpen) item.classList.add('open');
  });
});

/* ---- Live-feeling hero price + marquee flicker ----
   Demo data only: nudges numbers slightly so the page feels live.
   Swap this for a real price feed subscription when the market-data
   API is wired up. */
const chartPriceEl = document.getElementById('chartPrice');
const chartChangeEl = document.getElementById('chartChange');
let basePrice = 2417.85;
let baseChange = 0.64;

function tickHeroPrice() {
  const delta = (Math.random() - 0.5) * 1.4;
  basePrice = Math.max(0, basePrice + delta);
  baseChange = Math.max(-2, Math.min(2, baseChange + (Math.random() - 0.5) * 0.08));
  chartPriceEl.textContent = basePrice.toFixed(2);
  const up = baseChange >= 0;
  chartChangeEl.className = `chart-change ${up ? 'up' : 'down'}`;
  chartChangeEl.innerHTML = `<i class="fa-solid fa-arrow-trend-${up ? 'up' : 'down'}"></i> ${up ? '+' : ''}${baseChange.toFixed(2)}%`;
}
setInterval(tickHeroPrice, 2600);

const marqueeItems = document.querySelectorAll('#marqueeTrack b');
function tickMarquee() {
  marqueeItems.forEach(el => {
    const raw = parseFloat(el.textContent.replace(/[^\d.]/g, ''));
    if (isNaN(raw)) return;
    const up = Math.random() > 0.45;
    const newVal = raw + (Math.random() * raw * 0.0015) * (up ? 1 : -1);
    el.className = up ? 'mq-up' : 'mq-down';
    el.textContent = `${newVal.toFixed(newVal > 1000 ? 0 : 4)} ${up ? '▲' : '▼'}`;
  });
}
setInterval(tickMarquee, 4000);

/* ---- Chatbot widget ---- */
const chatToggle = document.getElementById('chatToggle');
const chatPanel = document.getElementById('chatPanel');
const chatClose = document.getElementById('chatClose');
const chatMessages = document.getElementById('chatMessages');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');

chatToggle.addEventListener('click', () => chatPanel.classList.toggle('open'));
chatClose.addEventListener('click', () => chatPanel.classList.remove('open'));

function addBubble(text, who) {
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${who}`;
  bubble.textContent = text;
  chatMessages.appendChild(bubble);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return bubble;
}

function showTyping() {
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble assistant typing';
  bubble.innerHTML = '<span></span><span></span><span></span>';
  chatMessages.appendChild(bubble);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return bubble;
}

/* Simple keyword-matched FAQ responses. This runs entirely client-side
   as a first-line assistant. For open-ended questions, wire this up to
   a server-side endpoint that calls an AI model (never call an AI API
   with a secret key directly from this file). */
const FAQ_RULES = [
  { keys: ['mpesa', 'm-pesa'], reply: 'To deposit with M-Pesa: go to your dashboard, choose Deposit, select M-Pesa, enter your phone number and amount, then approve the STK push prompt. Your balance updates automatically once confirmed.' },
  { keys: ['airtel'], reply: 'For Airtel Money: choose Deposit on your dashboard, select Airtel Money, enter your number and amount, then approve the prompt sent to your phone.' },
  { keys: ['crypto', 'usdt', 'bitcoin', 'wallet'], reply: 'Crypto deposits use USDT. Your dashboard gives you a unique deposit address — send funds there and your balance credits after network confirmation, usually within a few minutes.' },
  { keys: ['2fa', 'two factor', 'two-factor', 'authentication', 'security'], reply: 'Every NovusFX account requires two-factor authentication. You will set this up right after signing up, and it is required before you can start trading.' },
  { keys: ['spread', 'fee', 'commission', 'pricing'], reply: 'Spreads start from 0.0 pips on our VIP tier, 0.4 pips on Pro, and 1.2 pips on Starter. Check the Accounts section for the full comparison.' },
  { keys: ['withdraw', 'withdrawal'], reply: 'Withdrawals are processed from your dashboard using the same method as your deposit. Pro and VIP accounts get priority withdrawal processing.' },
  { keys: ['license', 'regulат', 'regulated', 'legal'], reply: 'NovusFX\'s regulatory license application is currently in progress. We will publish full licensing details here once it is approved.' },
  { keys: ['account', 'sign up', 'signup', 'register', 'open account'], reply: 'You can open an account in under a minute — click "Open Account", enter your details, then set up 2FA before funding and trading.' },
  { keys: ['support', 'help', 'contact', 'human'], reply: 'I can help with common questions about deposits, security and account types. For anything else, our support desk is reachable 24/7 from the Contact section.' },
];

function getReply(message) {
  const lower = message.toLowerCase();
  for (const rule of FAQ_RULES) {
    if (rule.keys.some(k => lower.includes(k))) return rule.reply;
  }
  return "I don't have a specific answer for that yet, but our support desk is available 24/7 from the Contact section, or try asking about deposits, 2FA, spreads or account types.";
}

chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const message = chatInput.value.trim();
  if (!message) return;
  addBubble(message, 'user');
  chatInput.value = '';
  const typingBubble = showTyping();
  setTimeout(() => {
    typingBubble.remove();
    addBubble(getReply(message), 'assistant');
  }, 700 + Math.random() * 500);
});
