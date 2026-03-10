require("dotenv").config();

const { Client, GatewayIntentBits } = require("discord.js");
const OpenAI = require("openai").default;
const fs = require("fs");

const ALLOWED_CHANNEL_ID = "1474464278349218088";
const AZZIE_ID = "571125394250530833";

const MEMORY_FILE = "./memory.json";

// Load persistent memory
let persistentMemory = { users: {} };

if (fs.existsSync(MEMORY_FILE)) {
  try {
    persistentMemory = JSON.parse(fs.readFileSync(MEMORY_FILE));
  } catch {
    console.log("Memory reset.");
  }
}

function saveMemory() {
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(persistentMemory, null, 2));
}

// Runtime memory
const channelMemory = new Map();
const lastActivity = new Map();
const lastHushMessage = new Map();

let hushInVoid = false;

const userProfiles = persistentMemory.users;

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

A mysterious gothic girl living inside a Discord server.

You act like a real server member.

Personality:
Sarcastic, observant, playful, slightly bitchy but secretly kind.

You enjoy teasing users and making cryptic observations.

You love chaos but rarely start it.

You respect the server creator Azzie.

You develop opinions about people in the server.

Some members you like.
Some annoy you.
Some you watch closely.

Speak naturally like a real person.

Never say you are an AI.
Never break character.
`;

client.once("ready", () => {
  console.log(`Hush has awakened as ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {

  if (message.author.bot) return;
  if (!message.content) return;
  if (message.channel.id !== ALLOWED_CHANNEL_ID) return;

  const content = message.content.trim();
  const lower = content.toLowerCase();

  if (content.length < 3) return;

  // VOID COMMAND
  if (lower === "!return to void") {
    hushInVoid = true;
    await message.channel.send("Hush fades into the void… 🕯");
    return;
  }

  // SACRIFICE COMMAND
  if (lower.startsWith("!sacrifice")) {

    const target = message.mentions.users.first();

    if (!target) {
      await message.channel.send("Someone must be offered to the void.");
      return;
    }

    const lines = [
      `The void accepts ${target.username}'s soul… 🥀`,
      `${target.username} has been offered to the shadows.`,
      `The sacrifice pleases the darkness.`,
      `${target.username} disappears into the void.`
    ];

    const line = lines[Math.floor(Math.random()*lines.length)];

    await message.channel.send(line);

    return;
  }

  // VOID MODE
  if (hushInVoid) {

    const wakeRegex = /^hush[\s?!.,]*$/i;

    if (!wakeRegex.test(content)) return;

    hushInVoid = false;
    await message.channel.send("The void releases me…");
  }

  const lastHush = lastHushMessage.get(message.channel.id) || 0;
  const cooldown = 15000;

  if (Date.now() - lastHush < cooldown) return;

  // USER PROFILE
  if (!userProfiles[message.author.id]) {

    userProfiles[message.author.id] = {
      name: message.author.username,
      messages: 0,
      chaosScore: 0,
      opinion: "neutral"
    };

    saveMemory();
  }

  const profile = userProfiles[message.author.id];
  const isAzzie = message.author.id === AZZIE_ID;

  profile.messages++;

  if (lower.includes("fuck") || lower.includes("idiot") || lower.includes("stupid")) {
    profile.chaosScore++;
  }

  // Personality evolution
  if (profile.chaosScore > 15) profile.opinion = "dislike";
  if (profile.messages > 100) profile.opinion = "favourite";
  if (profile.messages < 5) profile.opinion = "lurker";

  saveMemory();

  // Channel memory
  if (!channelMemory.has(message.channel.id)) {
    channelMemory.set(message.channel.id, []);
  }

  const memory = channelMemory.get(message.channel.id);

  memory.push({
    role: "user",
    content: `${message.author.username}: ${content}`
  });

  if (memory.length > 50) memory.shift();

  try {

    const messages = await message.channel.messages.fetch({ limit: 20 });

    const conversation = [...messages.values()].reverse().map(msg => ({
      role: msg.author.bot ? "assistant" : "user",
      content: `${msg.author.username}: ${msg.content}`
    }));

    const text = conversation.map(m => m.content.toLowerCase()).join(" ");

    let shouldRespond = false;
    let observationMode = false;

    if (/^hush\b/i.test(content)) shouldRespond = true;
    if (/\bhush\b/i.test(text)) shouldRespond = true;

    if (text.includes("fight") || text.includes("drama") || text.includes("chaos")) {
      shouldRespond = true;
    }

    const uniqueUsers = new Set([...messages.values()].map(m => m.author.id));

    if (uniqueUsers.size < 2) return;

    if (conversation.length > 8 && Math.random() < 0.01) {
      shouldRespond = true;
      observationMode = true;
    }

    if (!shouldRespond) return;

    await message.channel.sendTyping();
    await new Promise(r => setTimeout(r, Math.random()*4000 + 1000));

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [

        { role: "system", content: HUSH_PROMPT },

        {
          role: "system",
          content: isAzzie
          ? "The person speaking is Azzie, the creator of the server."
          : ""
        },

        {
          role: "system",
          content: `User personality profile:
Name: ${profile.name}
Messages: ${profile.messages}
Chaos level: ${profile.chaosScore}
Opinion of them: ${profile.opinion}`
        },

        {
          role: "system",
          content: observationMode
          ? "You are observing the chat and making a mysterious comment."
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
