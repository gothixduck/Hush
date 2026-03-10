require("dotenv").config();

const { Client, GatewayIntentBits } = require("discord.js");
const OpenAI = require("openai").default;

// Allowed channel
const ALLOWED_CHANNEL_ID = "1474464278349218088";

// Short-term memory per channel
const channelMemory = new Map();

// Personality memory per user
const userProfiles = new Map();

// Track last activity per channel
const lastActivity = new Map();

// Track last time Hush spoke
const lastHushMessage = new Map();

// Void state
let hushInVoid = false;

// Creator ID
const AZZIE_ID = "571125394250530833";

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

You enjoy teasing users and making sarcastic observations.

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

  // Only operate in one channel
  if (message.channel.id !== ALLOWED_CHANNEL_ID) return;

  let observationMode = false;

  const content = message.content.toLowerCase();

  // Return to void command
  if (content === "!return to void") {
    hushInVoid = true;
    await message.channel.send("Hush fades into the void… 🕯");
    return;
  }

  // Sacrifice command
  if (content.startsWith("!sacrifice")) {

    const target = message.mentions.users.first();

    if (!target) {
      await message.channel.send("Someone must be offered to the void.");
      return;
    }

    const lines = [
      `The void accepts ${target.username}'s soul… 🥀`,
      `${target.username} has been offered to the shadows.`,
      `A sacrifice has been made… the void is pleased.`,
      `${target.username} disappears into darkness.`
    ];

    const line = lines[Math.floor(Math.random()*lines.length)];

    await message.channel.send(line);

    return;
  }

  // Void silence behaviour
  if (hushInVoid) {

    if (!content.includes("hush")) {
      return;
    }

    hushInVoid = false;
    await message.channel.send("The void releases me…");
  }

  // Cooldown
  const lastHush = lastHushMessage.get(message.channel.id) || 0;
  const cooldown = 15000;

  if (Date.now() - lastHush < cooldown) return;

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

  const isAzzie = message.author.id === AZZIE_ID;

  profile.messages++;
  profile.lastSeen = Date.now();

  if (content.includes("fuck") || content.includes("idiot") || content.includes("stupid")) {
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

    const conversation = [...messages.values()].reverse().map(msg => ({
      role: msg.author.bot ? "assistant" : "user",
      content: `${msg.author.username}: ${msg.content}`
    }));

    const text = conversation.map(m => m.content.toLowerCase()).join(" ");

    let shouldRespond = false;

    if (/^hush\b/i.test(message.content)) shouldRespond = true;
    if (/\bhush\b/i.test(text)) shouldRespond = true;

    if (text.includes("fight") || text.includes("drama") || text.includes("chaos")) {
      shouldRespond = true;
    }

    if (text.includes("fuck") || text.includes("idiot") || text.includes("stupid")) {
      shouldRespond = true;
    }

    const uniqueUsers = new Set([...messages.values()].map(m => m.author.id));
    if (uniqueUsers.size < 2) return;

    if (conversation.length > 6 && Math.random() < 0.03) {
      shouldRespond = true;
      observationMode = true;
    }

    if (!shouldRespond) return;

    await message.channel.sendTyping();
    await new Promise(r => setTimeout(r, Math.random() * 4000 + 1000));

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [

        { role: "system", content: HUSH_PROMPT },

        {
          role: "system",
          content: isAzzie
            ? "The person speaking right now is Azzie, the creator of this server and the one who created you."
            : ""
        },

        {
          role: "system",
          content: `User profile:
Name: ${profile.name}
Messages sent: ${profile.messages}
Chaos level: ${profile.chaosScore}`
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
      await message.reply(reply);
    } else {
      await message.channel.send(reply);
    }

    lastHushMessage.set(message.channel.id, Date.now());

  } catch(err) {
    console.log(err);
  }

});

client.login(process.env.DISCORD_TOKEN);
