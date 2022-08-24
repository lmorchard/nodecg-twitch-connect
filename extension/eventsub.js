const { ClientCredentialsAuthProvider } = require('@twurple/auth');
const { EventSubListener, ReverseProxyAdapter } = require('@twurple/eventsub');
const { createTokenReplicants, createTwitchClient } = require('./common');
const { ApiClient } = require('@twurple/api');

module.exports = async function (nodecg) {
  const { clientId, clientSecret } = nodecg.bundleConfig;
  const { hostName, port, secret, pathPrefix } =
    nodecg.bundleConfig.eventsub || {};

  const tokens = await createTokenReplicants(nodecg);

  const twitchOwnerClient = await createTwitchClient(nodecg, tokens.user);
  const { userId: ownerUserId } = await twitchOwnerClient.getTokenInfo();

  const apiClient = new ApiClient({
    authProvider: new ClientCredentialsAuthProvider(clientId, clientSecret),
    logger: { minLevel: nodecg.config.logging.console.level },
  });
  // TODO: make this configurable with DirectConnectionAdapter so I can port-forward with a local SSL cert?
  const adapter = new ReverseProxyAdapter({ port, hostName, pathPrefix });
  const listener = new EventSubListener({
    apiClient,
    secret,
    adapter,
    strictHostCheck: true,
  });

  await listener.listen();

  listener.subscribeToChannelFollowEvents(ownerUserId, (data) => {
    nodecg.sendMessage("twitch.following", data);
  });

  listener.subscribeToChannelRedemptionAddEventsForReward(
    ownerUserId,
    '',
    (data) => {
      // TODO: see also api.channelPoints.updateRedemptionStatusByIds to ack reward
      nodecg.sendMessage("twitch.reward", data);
    }
  );
};
