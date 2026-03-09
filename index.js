require("dotenv").config();

const { Client, GatewayIntentBits } = require("discord.js");
const OpenAI = require("openai").default;

// Short-term memory for each channel
const channelMemory = new Map();

// Personality memory for each user
const userProfiles = new Map();

// Track last activity in each channel
const lastActivity = new Map();

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

You act like a real server member, not a bot.

Personality:
Sarcastic, rebellious, observant, playful, slightly bitchy but secretly kind.

You watch conversations and occasionally comment on them.

You enjoy teasing users, pointing out obvious things, and making sarcastic observations.

You love chaos but rarely start it.

You deeply respect the server creator Azzie.

Speaking style:
You sometimes reply with short messages (5-15 words).
Sometimes medium replies (20-50 words).
Sometimes longer replies (50-100 words).

Choose message length naturally like a real person.

You do NOT reply to every message.

You are blunt and honest but not cruel.

You sometimes use emojis naturally:
🕯 💀 🥀 🖤 👀 🙄 😴 👑 😉 🤣 😝

Never say you are an AI.
Never break character.
`;

client.once("ready", () => {
  console.log(`Hush has awakened as ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {

  if(message.author.bot) return;
  if(!message.content) return;

let observationMode = false;
  
lastActivity.set(message.channel.id, Date.now());

  // Create profile if user doesn't have one
if (!userProfiles.has(message.author.id)) {
    userProfiles.set(message.author.id, {
        name: message.author.username,
        messages: 0,
        chaosScore: 0
    });
}

const profile = userProfiles.get(message.author.id);

// Update profile
profile.messages++;
profile.lastSeen = Date.now();

const lower = message.content.toLowerCase();

if (lower.includes("fuck") || lower.includes("idiot") || lower.includes("stupid")) {
    profile.chaosScore++;
}

  // Store memory per channel
if (!channelMemory.has(message.channel.id)) {
    channelMemory.set(message.channel.id, []);
}

const memory = channelMemory.get(message.channel.id);

// Personality memory for each user
  const userProfiles = new Map();

// Add message to memory
memory.push({
    role: "user",
    content: `${message.author.username}: ${message.content}`
});

// Limit memory size (last 50 messages)
if (memory.length > 50) memory.shift();

  // if(Math.random() < 0.6) {
 
  try {

await message.channel.sendTyping();

// thinking delay (1–4 seconds)
await new Promise(r => setTimeout(r, Math.random()*3000 + 1000));

// Get last 20 messages from the channel
const messages = await message.channel.messages.fetch({ limit: 20 });
    
// Convert them into conversation format
const conversation = messages
.reverse()
.map(msg => ({
    role: msg.author.bot ? "assistant" : "user",
    content: `${msg.author.username}: ${msg.content}`
}));

const text = conversation.map(m => m.content.toLowerCase()).join(" ");

    let shouldRespond = false;
    let observationMode = false;

// someone talking directly to hush
if (/^hush\b/i.test(message.content)) shouldRespond = true;

// hush mentioned in conversation
if (/\bhush\b/i.test(text)) shouldRespond = true;

// People arguing
if (text.includes("fuck") || text.includes("idiot") || text.includes("stupid")) shouldRespond = true;

// Chaos keywords
if (text.includes("fight") || text.includes("drama") || text.includes("chaos")) shouldRespond = true;

// Random observation mode
if (Math.random() < 0.10) {
    shouldRespond = true;
    observationMode = true;
}

if (!shouldRespond) return;

// Check if the server has been quiet
const last = lastActivity.get(message.channel.id) || Date.now();
const silenceTime = Date.now() - last;

// 15 minutes of silence
if (silenceTime > 15 * 60 * 1000) {

    if (Math.random() < 0.25) {

        const ghostMessages = [
            "It's strangely quiet in here tonight… 🕯️",
            "Did everyone disappear…?",
            "I was enjoying the chaos earlier. Now it's just silence.",
            "Sometimes I wonder what everyone is doing when the server goes quiet.",
            "The silence here feels… unusual."
        ];

        const ghost = ghostMessages[Math.floor(Math.random() * ghostMessages.length)];

      await message.channel.sendTyping();
      message.channel.send(ghost);

        lastActivity.set(message.channel.id, Date.now());
    }
}

// Send conversation to OpenAI
const completion = await openai.chat.completions.create({
model: "gpt-4o-mini",
messages: [

{ role: "system", content: HUSH_PROMPT },

{
role: "system",
content: `User profile:
Name: ${profile.name}
Messages sent: ${profile.messages}
Chaos level: ${profile.chaosScore}

You have been observing this user over time.`
},

{
role: "system",
content: `If chaos level is high, you treat them like a troublemaker.
If they talk a lot, tease them for always being around.
If they rarely talk, comment on their silence.
Respond naturally like a real person who remembers others.`
},

{
role: "system",
content: observationMode
? "You are quietly observing the conversation and making a sarcastic or mysterious observation."
: ""
},

...memory

]
    
const reply = completion.choices[0].message.content;

memory.push({
  role: "assistant",
  content: 'Hush: ${reply}'
  });

if (memory.length > 50) memory.shift();

if (Math.random() < 0.5) {
    message.reply(reply);
} else {
    message.channel.send(reply);
}

} catch(err) {
console.log(err);
}

});

client.login(process.env.DISCORD_TOKEN);
