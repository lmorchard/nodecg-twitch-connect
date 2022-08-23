const { ChatClient } = require('@twurple/chat');
const { createTokenReplicants, createTwitchClient } = require('./common');

module.exports = async function (nodecg) {
  const tokens = await createTokenReplicants(nodecg);

  const twitchOwnerClient = await createTwitchClient(nodecg, tokens.user);
  const { userName: ownerUserName } = await twitchOwnerClient.getTokenInfo();

  const twitchChatClient = await createTwitchClient(nodecg, tokens.chatbot);
  const { userId, userName } = await twitchChatClient.getTokenInfo();

  const chat = new ChatClient({
    authProvider: twitchChatClient._authProvider,
    channels: [ownerUserName],
    requestMembershipEvents: true,
    logger: { minLevel: nodecg.config.logging.console.level }
  });

  nodecg.log.debug(`Chatbot connecting as ${userName} in channel ${ownerUserName}`);
  await chat.connect();
  nodecg.log.info(`Chatbot connected as ${userName} in channel ${ownerUserName}`);

  nodecg.listenFor('twitch.chat.say', ({ message }) => {
    chat.say(ownerUserName, message);
  });

  chat.onDisconnect((manually, reason) => {
    nodecg.log.warn(`Chatbot disconnected because ${reason}`);
    if (manually) return;
    chat.connect();
  })

  chat.onPrivmsg((channel, user, message, meta) => {
    const self = meta.userInfo.userId === userId;
    nodecg.sendMessage('twitch.chat.message', {
      channel,
      user,
      message,
      meta,
      self,
    });
    if (!self && message.startsWith('!')) {
      const [command, ...commandArgs] = message.substring(1).split(' ');
      nodecg.sendMessage('twitch.chat.command', { command, commandArgs });
    }
  });

  chat.onRaid((channel, user, raidInfo, msg) => {
    const { displayName, viewerCount } = raidInfo;
    nodecg.sendMessage('twitch.raid', { displayName, viewerCount });
  });

  chat.onHosted((channel, byChannel, auto, viewers) =>
    nodecg.sendMessage('twitch.hosted', { channel, byChannel, auto, viewers })
  );

  chat.onJoin((channel, user) => {
    if (user === userName) {
      chat.say(ownerUserName, `Chatbot reporting for duty at ${Date.now()} 👋`);
    }
    nodecg.sendMessage('twitch.join', { channel, user })
  });

  chat.onPart((channel, user) =>
    nodecg.sendMessage('twitch.part', { channel, user })
  );

  chat.onSub((channel, user, subInfo, msg) =>
    nodecg.sendMessage('twitch.subscribed', subInfo)
  );

  chat.onResub((channel, user, subInfo, msg) =>
    nodecg.sendMessage('twitch.resubscribed', subInfo)
  );

  // TODO: relay the rest of the ChatClient events?
};
