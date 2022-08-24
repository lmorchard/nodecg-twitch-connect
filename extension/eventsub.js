const { ClientCredentialsAuthProvider } = require('@twurple/auth');
const { EventSubListener, ReverseProxyAdapter } = require('@twurple/eventsub');
const { createTokenReplicants, createTwitchClient } = require('./common');
const { ApiClient } = require('@twurple/api');
const { rawDataSymbol } = require('@twurple/common');

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

  const eventToMessageHandler = (name) => (data) => {
    const messageName = `twitch.eventsub.${name}`;
    // HACK: accessing this raw data seems stinky
    const rawData = data[rawDataSymbol];
    nodecg.log.debug('eventsub', messageName, rawData);
    nodecg.sendMessage(messageName, rawData);
    nodecg.sendMessage(`${messageName}.Event`, data);
  };

  const subscriptions = [
    ...['StreamOffline', 'StreamOnline'].map((name) => [
      name,
      listener[`subscribeTo${name}Events`](
        ownerUserId,
        eventToMessageHandler(name)
      ),
    ]),
    ...[
      'Ban',
      'Cheer',
      'Follow',
      'GoalBegin',
      'GoalEnd',
      'GoalProgress',
      'HypeTrainBegin',
      'HypeTrainEnd',
      'HypeTrainProgress',
      'PollBegin',
      'PollEnd',
      'PollProgress',
      'RedemptionAdd',
      'RedemptionUpdate',
      'Subscription',
      'SubscriptionGift',
      'SubscriptionMessage',
      'Update',
    ].map((name) => [
      name,
      listener[`subscribeToChannel${name}Events`](
        ownerUserId,
        eventToMessageHandler(name)
      ),
    ]),
    [
      'Raid',
      listener.subscribeToChannelRaidEventsTo(
        ownerUserId,
        eventToMessageHandler('Raid')
      ),
    ],
  ];

  for (const [name, subscription] of subscriptions) {
    try {
      await subscription;
      nodecg.log.info(`eventsub subscription ${name} success`);
    } catch (e) {
      nodecg.log.warn(`eventsub subscription ${name} failure`, e);
    }
  }

  // TODO: need to unsubscribe on shutdown? or resubscribe periodically?
};
