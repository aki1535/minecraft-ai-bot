const mineflayer = require('mineflayer');
const config = require('./config.json');

function createBot() {
    const bot = mineflayer.createBot({
        host: config.server.host,
        port: config.server.port,
        version: config.server.version,
        username: config.bot.username
    });

    bot.on('spawn', () => {
        console.log(`${bot.username} serverə qoşuldu!`);
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
            return data.choices[0].message.content;
        } catch (err) {
            console.log('GPT Xətası:', err);
            return 'Ağlım qarışdı, səni başa düşmədim.';
        }
    }

    bot.on('chat', async (username, message) => {
        if (username === bot.username) return;

        const isMaster = config.permissions.masters.includes(username);

        if (message.startsWith('!')) {
            if (!isMaster) return;
            if (message === '!test') bot.chat('Salam sahibim, hər şey qaydasındadır!');
            return;
        }

        const player = bot.players[username];
        if (!player || !player.entity) return;

        const distance = bot.entity.position.distanceTo(player.entity.position);
        if (distance > config.settings.chatRadius) return;

        const dx = player.entity.position.x - bot.entity.position.x;
        const dz = player.entity.position.z - bot.entity.position.z;
        let yawDiff = Math.abs(bot.entity.yaw - Math.atan2(-dx, -dz));
        while (yawDiff > Math.PI) yawDiff -= 2 * Math.PI;

        if (Math.abs(yawDiff) <= Math.PI / 2) {
            const aiAnswer = await askGPT(`${username}: ${message}`);
            bot.chat(aiAnswer);
        }
    });

    bot.on('end', () => {
        console.log('Bağlantı kəsildi, 5 saniyə sonra yenidən qoşulur...');
        setTimeout(createBot, 5000);
    });

    bot.on('error', (err) => console.log('Xəta:', err));
}

createBot();
