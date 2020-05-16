const { createTwitchUserClient, createTokenReplicants } = require('./common');
const WebHookListener = require('twitch-webhooks').default;

module.exports = async function (nodecg) {
  const {
    host: hostName,
    port,
    hookValidity,
    reverseProxy: {
      pathPrefix: webhooksProxyPathPrefix = '/',
      port: webhooksProxyPort = 443,
      ssl: webhooksProxySsl = true,
    } = {},
  } = nodecg.bundleConfig.webhooks || {};

  const tokens = await createTokenReplicants(nodecg);

  const twitchUserClient = await createTwitchUserClient(nodecg, tokens.user);
  const { userId } = await twitchUserClient.getTokenInfo();

  const twitchAppClient = await createTwitchUserClient(nodecg, tokens.app);
  const hooksResult = await twitchAppClient.helix.webHooks.getSubscriptions();
  const hooks = await hooksResult.getAll();
  for (const hook of hooks) {
    nodecg.log.debug('existing subscription', hook._data);
  }

  const listener = await WebHookListener.create(twitchAppClient, {
    hostName,
    port,
    hookValidity,
    reverseProxy: {
      pathPrefix: webhooksProxyPathPrefix,
      port: webhooksProxyPort,
      ssl: webhooksProxySsl,
    },
  });
  listener.listen();

  const topicName = (name) => `twitch.${name}`;

  listener.subscribeToStreamChanges(userId, ({ _data }) =>
    nodecg.sendMessage(topicName('stream'), _data)
  );

  listener.subscribeToFollowsToUser(userId, ({ _data }) =>
    nodecg.sendMessage(topicName('following'), _data)
  );
};
