const { createTwitchUserClient, createTokenReplicants } = require('./common');
const PubSubClient = require('twitch-pubsub-client').default;

module.exports = async function (nodecg) {
  const tokens = await createTokenReplicants(nodecg);

  const twitchClient = await createTwitchUserClient(nodecg, tokens.user);
  const { userId } = await twitchClient.getTokenInfo();

  const pubSubClient = new PubSubClient();
  await pubSubClient.registerUserListener(twitchClient, userId);

  await pubSubClient.onRedemption(userId, message => {
    nodecg.sendMessage('twitch.redemption', message._data.data);
  });
};
