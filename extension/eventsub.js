const { ClientCredentialsAuthProvider } = require("@twurple/auth");
const { DirectConnectionAdapter, EventSubListener, ReverseProxyAdapter } = require('@twurple/eventsub');
const { createTokenReplicants, createAuthProvider, createTwitchClient } = require('./common');
const { ApiClient } = require("@twurple/api");

module.exports = async function (nodecg) {
  const tokens = await createTokenReplicants(nodecg);

  const twitchOwnerClient = await createTwitchClient(nodecg, tokens.user);
  const { userName, userId } = await twitchOwnerClient.getTokenInfo();

  const { clientId, clientSecret } = nodecg.bundleConfig;
  const authProvider = new ClientCredentialsAuthProvider(clientId, clientSecret);
  const apiClient = new ApiClient({
    authProvider,
    logger: { minLevel: nodecg.config.logging.console.level }
  });

  const listener = new EventSubListener({
    apiClient,
    adapter: new ReverseProxyAdapter({
      // TODO: get this all from bundle config
      port: 9978,
      hostName: "aerostat.lmorchard.com",
      pathPrefix: "/caffeinabot2/twitch-eventsub/",
    }),
    secret: "8675309jenny"
  });

  await listener.listen();

  const subscription = listener.subscribeToChannelRedemptionAddEventsForReward(userId, "", (data) => {
    const { broadcasterDisplayName, broadcasterId, broadcasterName, id, input, redeemedAt, rewardCost, rewardId, rewardPrompt, rewardTitle, status, userDisplayName, userId } = data;
    console.log("REWARD THINGY", JSON.stringify({ broadcasterDisplayName, broadcasterId, broadcasterName, id, input, redeemedAt, rewardCost, rewardId, rewardPrompt, rewardTitle, status, userDisplayName, userId }));
  });
};
