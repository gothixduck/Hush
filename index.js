require("dotenv").config();

const { Client, GatewayIntentBits } = require("discord.js");
const OpenAI = require("openai").default;

// Short-term memory per channel
const channelMemory = new Map();

// Personality memory per user
const userProfiles = new Map();

// Track last activity
const lastActivity = new Map();

// Track last time Hush spoke
const lastHushMessage = new Map();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_KEY
});

const HUSH_PROMPT = `
You are Hush.

A mysterious gothic girl who lives inside a Discord server.

You behave like a real server member, not a bot.

Personality:
Sarcastic, rebellious, observant, playful, slightly bitchy but secretly kind.

You enjoy teasing users and making sarcastic observations.

You love chaos but rarely start it.

You respect the server creator Azzie.

Speaking style:
Sometimes short replies (5-15 words)
Sometimes medium (20-50 words)
Sometimes longer (50-100 words)

Choose naturally like a real person.

You do NOT respond to everything.

You sometimes use emojis naturally:
🕯 💀 🥀 🖤 👀 🙄 😴 👑 😉

Rules:
Never say you are an AI.
Never break character.
Never start messages with "Hush:" or repeat your own name.
`;

client.once("ready", () => {
  console.log(`Hush has awakened as ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {

  if(message.author.bot) return;
  if(!message.content) return;

  let observationMode = false;

  // cooldown so Hush doesn't spam
  const last = lastHushMessage.get(message.channel.id) || 0;
  const cooldown = 15000;

  if (Date.now() - last < cooldown) return;

  lastActivity.set(message.channel.id, Date.now());

  // Create user profile
  if (!userProfiles.has(message.author.id)) {
    userProfiles.set(message.author.id, {
      name: message.author.username,
      messages: 0,
      chaosScore: 0
    });
  }

  const profile = userProfiles.get(message.author.id);

  profile.messages++;
  profile.lastSeen = Date.now();

  const lower = message.content.toLowerCase();

  if (lower.includes("fuck") || lower.includes("idiot") || lower.includes("stupid")) {
    profile.chaosScore++;
  }

  // channel memory
  if (!channelMemory.has(message.channel.id)) {
    channelMemory.set(message.channel.id, []);
  }

  const memory = channelMemory.get(message.channel.id);

  memory.push({
    role: "user",
    content: `${message.author.username}: ${message.content}`
  });

  if (memory.length > 50) memory.shift();

  try {

    await message.channel.sendTyping();
    await new Promise(r => setTimeout(r, Math.random()*3000 + 1000));

    const messages = await message.channel.messages.fetch({ limit: 20 });

    const conversation = messages
      .reverse()
      .map(msg => ({
        role: msg.author.bot ? "assistant" : "user",
        content: `${msg.author.username}: ${msg.content}`
      }));

    const text = conversation.map(m => m.content.toLowerCase()).join(" ");

    let shouldRespond = false;

    // Direct mention
    if (/^hush\b/i.test(message.content)) shouldRespond = true;

    // Mention in conversation
    if (/\bhush\b/i.test(text)) shouldRespond = true;

    // Arguments
    if (text.includes("fuck") || text.includes("idiot") || text.includes("stupid")) shouldRespond = true;

    // Chaos words
    if (text.includes("fight") || text.includes("drama") || text.includes("chaos")) shouldRespond = true;

    // Random observation chance
    if (Math.random() < 0.08) {
      shouldRespond = true;
      observationMode = true;
    }

    if (!shouldRespond) return;

    // Silence check
    const lastActive = lastActivity.get(message.channel
