const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals: { GoalNear } } = require('mineflayer-pathfinder');
const config = require('./config.json');

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
        if (packet.name === 'player_chat' || packet.name === 'system_chat') {
            data.formatted = '{"text": ""}';
        }
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
                        { role: 'system', content: 'Sən Minecraft-da hərəkət edə bilən, oyunçu ilə danışan və əmrləri yerinə yetirən botsan. Qısa cavab ver.' },
                        { role: 'user', content: prompt }
                    ],
                    max_tokens: 50
                })
            });
            const data = await response.json();
            return data.choices[0].message.content;
        } catch (err) {
            console.log('GPT Xətası:', err);
            return 'Xəta baş verdi.';
        }
    }

    bot.on('chat', async (username, message) => {
        if (username === bot.username) return;

        const isMaster = config.permissions.masters.includes(username);

        if (message.startsWith('!')) {
            if (!isMaster) return;

            if (message === '!test') {
                bot.chat('Hər şey işləyir!');
            } else if (message === '!gel') {
                const target = bot.players[username]?.entity;
                if (target) {
                    const { x, y, z } = target.position;
                    bot.pathfinder.setGoal(new GoalNear(x, y, z, 2));
                    bot.chat('Yanına gəlirəm!');
                } else {
                    bot.chat('Səni görmürəm!');
                }
            } else if (message === '!dayandir') {
                bot.pathfinder.setGoal(null);
                bot.chat('Dayandım.');
            }
            return;
        }

        const aiAnswer = await askGPT(`${username}: ${message}`);
        bot.chat(aiAnswer);
    });

    bot.on('end', () => {
        setTimeout(createBot, 5000);
    });

    bot.on('error', (err) => {
        console.log('Xəta:', err.message);
    });
}

createBot();
