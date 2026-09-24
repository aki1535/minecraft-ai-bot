const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals: { GoalNear } } = require('mineflayer-pathfinder');
const config = require('./config.json');

process.on('uncaughtException', (err) => {
    console.log('Xəta basdırıldı:', err.message);
});

process.on('unhandledRejection', (reason) => {
    console.log('Sözləşmə xətası:', reason);
});

function createBot() {
    const bot = mineflayer.createBot({
        host: config.server.host,
        port: config.server.port,
        version: config.server.version,
        username: config.bot.username
    });

    bot.loadPlugin(pathfinder);

    bot.on('spawn', () => {
        console.log(`${bot.username} serverə qoşuldu!`);
        const defaultMove = new Movements(bot);
        bot.pathfinder.setMovements(defaultMove);
    });

    bot._client.on('packet', (data, packet) => {
        try {
            if (packet.name === 'player_chat' || packet.name === 'system_chat') {
                if (data && data.unsignedChatContent) {
                    data.unsignedChatContent = '';
                }
            }
        } catch (e) {}
    });

    async function askGPT(prompt) {
        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.openai.apiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    messages: [
                        { role: 'system', content: 'Sən Minecraft oyununda yaşayan ağıllı bir botsan. Qısa, səmimi və oyunçu kimi cavab ver.' },
                        { role: 'user', content: prompt }
                    ],
                    max_tokens: 50
                })
            });
            const data = await response.json();
            if (!data || data.error || !data.choices || !data.choices[0]) {
                return 'Salam! Hazırda cavab verməkdə çətinlik çəkirəm.';
            }
            return data.choices[0].message.content;
        } catch (err) {
            return 'Salam! Bağlantı xətası baş verdi.';
        }
    }

    bot.on('chat', async (username, message) => {
        if (username === bot.username) return;

        const lowerMessage = message.toLowerCase().trim();
        if (!lowerMessage.startsWith('bot')) return;

        const args = message.slice(3).trim();
        const lowerArgs = args.toLowerCase();
        const isMaster = config.permissions.masters.includes(username);

        if (lowerArgs.startsWith('gəl') || lowerArgs.startsWith('gel')) {
            if (!isMaster) {
                bot.chat('Bunu yalnız sahibim edə bilər!');
                return;
            }
            const target = bot.players[username]?.entity;
            if (target) {
                const { x, y, z } = target.position;
                bot.pathfinder.setGoal(new GoalNear(x, y, z, 2));
                bot.chat('Yanına gəlirəm!');
            } else {
                bot.chat('Səni görmürəm!');
            }
            return;
        }

        if (lowerArgs.startsWith('dayandır') || lowerArgs.startsWith('dayandir')) {
            if (!isMaster) return;
            bot.pathfinder.setGoal(null);
            bot.chat('Dayandım.');
            return;
        }

        if (args.length > 0) {
            const aiAnswer = await askGPT(`${username}: ${args}`);
            bot.chat(aiAnswer);
        }
    });

    bot.on('end', (reason) => {
        console.log(`Bağlantı kəsildi (${reason}), 5 saniyə sonra yenidən qoşulur...`);
        setTimeout(createBot, 5000);
    });

    bot.on('error', (err) => {
        console.log('Bot xətası:', err.message);
    });
}

createBot();
