const { askGPT } = require('../utils/gpt');
const { getErrorMessage } = require('../utils/errors');

module.exports = {
  execute: async (client, channel, tags, extraParams) => {
    try {
      const question = extraParams.map(p => Object.values(p)[0]).join(' ');

      if (!question || question.length < 2) {
        client.say(channel, `@${tags.username}, ask me something interesting!`);
        return;
      }
      console.log('Asking gpt: ', question)

      const response = await askGPT(question, tags.username);
      client.say(channel, `@${tags.username}, ${response}\u200B`);
    } catch (err) {
      const code = err.message || 'UNKNOWN';
      const errorMessage = getErrorMessage(code, tags.username);
      console.error(`❌ Error in ask command:`, code);
      client.say(channel, errorMessage);
    }
  }
};
