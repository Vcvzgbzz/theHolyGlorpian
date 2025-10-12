const fetch = require('node-fetch');

const BASE_URL = 'https://drippily-unskeptical-raymonde.ngrok-free.dev/api';

async function callApi(endpoint, channel, tags, extraParams = []) {
  const rawChannel = channel.startsWith('#') ? channel.slice(1) : channel;

  let url = `${BASE_URL}/${endpoint}` +
    `?username=${encodeURIComponent(tags.username)}` +
    `&userId=${encodeURIComponent(tags['user-id'])}` +
    `&channelId=${encodeURIComponent(rawChannel)}` +
    `&textMode=true`;

  if (Array.isArray(extraParams)) {
    extraParams.forEach((paramObj) => {
      for (const [key, value] of Object.entries(paramObj)) {
        url += `&${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
      }
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    return await response.text();
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

module.exports = { callApi };
