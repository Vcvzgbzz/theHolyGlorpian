const { callApi } = require('../utils/api');

module.exports = {
  execute: async (client, channel, tags) => {
    try {
      const text = await callApi('inventory', channel, tags);
      client.say(channel, `@${tags.username}, ${text}\u200B`);
    } catch (err) {
      console.error('❌ Error in inventory:', err.message);
      client.say(channel, `@${tags.username}, something went wrong trying to look at the inventory`);
    }
  }
};
