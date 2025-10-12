const { callApi } = require('../utils/api');

module.exports = {
  execute: async (client, channel, tags, extraParams) => {
    try {
      const balance = extraParams[0]?.param0;

      const text = await callApi('slots', channel, tags, [
        { balance }
      ]);

      client.say(channel, `@${tags.username}, ${text}\u200B`);
    } catch (err) {
      console.error('❌ Error in slots:', err.message);
      client.say(channel, `@${tags.username}, something went wrong with your slots game.`);
    }
  }
};
