require("dotenv").config();

const { Client, GatewayIntentBits } = require("discord.js");
const OpenAI = require("openai").default;

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

  // if(Math.random() < 0.6) {
 
  try {

await message.channel.sendTyping()

// Get last 20 messages from the channel
const messages = await message.channel.messages.fetch({ limit: 20 });

// Convert them into conversation format
const conversation = messages
.reverse()
.map(msg => ({
    role: msg.author.bot ? "assistant" : "user",
    content: `${msg.author.username}: ${msg.content}`
}));

// Send conversation to OpenAI
const completion = await openai.chat.completions.create({
model: "gpt-4o-mini",
messages: [
{ role: "system", content: HUSH_PROMPT },
...conversation
]
});

const reply = completion.choices[0].message.content;

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
