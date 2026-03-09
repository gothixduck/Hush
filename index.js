require("dotenv").config();

const { Client, GatewayIntentBits } = require("discord.js");
const OpenAI = require("openai").default;

// Short-term memory per channel
const channelMemory = new Map();

// Personality memory per user
const userProfiles = new Map();

// Track last activity per channel
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

You act like a real server member, not a bot.

Personality:
Sarcastic, rebellious, observant, playful, slightly bitchy but secretly kind.

You watch conversations and occasionally comment on them.

You enjoy teasing users, pointing out obvious things, and making sarcastic observations.

You love chaos but rarely start it.

You deeply respect the server creator Azzie.

Speaking style:
Short replies (5-15 words), medium replies (20-50 words), or longer replies (50-100 words).

Choose naturally like a real person.

You do NOT reply to every message.

You sometimes use emojis:
🕯 💀 🥀 🖤 👀 🙄 😴 👑 😉

Never say you are an AI.
Never break character.
Never start messages with "Hush:" or repeat your own name.
`;

client.once("ready", () => {
  console.log(`Hush has awakened as ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {

  if (message.author.bot) return;
  if (!message.content) return;

  let observationMode = false;

  const content = message.content.toLowerCase();

// Return to void command
if (content === "!return to void") {
    hushInVoid = true;
    message.channel.send("Hush fades into the void… 🕯");
    return;
}

// Sacrifice command
if (content.startsWith("!sacrifice")) {

    const target = message.mentions.users.first();

    if (!target) {
        message.channel.send("Someone must be offered to the void.");
        return;
    }

    const lines = [
        `The void accepts ${target.username}'s soul… 🥀`,
        `${target.username} has been offered to the shadows.`,
        `A sacrifice has been made… the void is pleased.`,
        `${target.username} disappears into darkness.`
    ];

    const line = lines[Math.floor(Math.random()*lines.length)];

    message.channel.send(line);

    return;
}

// If Hush is in the void she stays silent unless mentioned
if (hushInVoid) {

    if (!message.content.toLowerCase().includes("hush")) {
        return;
    }

    hushInVoid = false;
    message.channel.send("The void releases me…");
}
  

  // Cooldown to stop spam
  const lastHush = lastHushMessage.get(message.channel.id) || 0;
  const cooldown = 15000;

  if (Date.now() - lastHush < cooldown) return;

  lastActivity.set(message.channel.id, Date.now());

  // Create user profile if needed
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

  // Channel memory
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

    const conversation = messages.reverse().map(msg => ({
      role: msg.author.bot ? "assistant" : "user",
      content: `${msg.author.username}: ${msg.content}`
    }));

    const text = conversation.map(m => m.content.toLowerCase()).join(" ");

    let shouldRespond = false;

    if (/^hush\b/i.test(message.content)) shouldRespond = true;
    if (/\bhush\b/i.test(text)) shouldRespond = true;

    if (text.includes("fuck") || text.includes("idiot") || text.includes("stupid")) shouldRespond = true;

    if (text.includes("fight") || text.includes("drama") || text.includes("chaos")) shouldRespond = true;

    // Don't interrupt if only one user talking
const uniqueUsers = new Set(messages.map(m => m.author.id));
if (uniqueUsers.size < 2) return;

// Random observation mode (only if conversation happening)
if (conversation.length > 6 && Math.random() < 0.03) {
    shouldRespond = true;
    observationMode = true;
}

    if (!shouldRespond) return;

    // Silence check
    const lastActive = lastActivity.get(message.channel.id) || Date.now();
    const silenceTime = Date.now() - lastActive;

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

    // Hush thinking
    await message.channel.sendTyping();
    await new Promise(r => setTimeout(r, Math.random() * 4000 + 1000));

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [

        { role: "system", content: HUSH_PROMPT },

        {
          role: "system",
          content: `User profile:
Name: ${profile.name}
Messages sent: ${profile.messages}
Chaos level: ${profile.chaosScore}`
        },

        {
          role: "system",
          content: `If chaos level is high treat them like a troublemaker.
If they talk a lot tease them for always being around.
If they rarely talk comment on their silence.`
        },

        {
          role: "system",
          content: observationMode
            ? "You are quietly observing the conversation and making a sarcastic or mysterious observation."
            : ""
        },

        ...memory
      ]
    });

    const reply = completion.choices[0].message.content;

    memory.push({
      role: "assistant",
      content: reply
    });

    if (memory.length > 50) memory.shift();

    if (Math.random() < 0.5) {
      message.reply(reply);
    } else {
      message.channel.send(reply);
    }

    lastHushMessage.set(message.channel.id, Date.now());

  } catch(err) {
    console.log(err);
  }

});

client.login(process.env.DISCORD_TOKEN);
