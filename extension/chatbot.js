const ChatClient = require('twitch-chat-client').default;
const LogLevel = require('@d-fischer/logger/lib/LogLevel').default;

const node = require('json-schema-lib');
const { createTokenReplicants, createTwitchUserClient } = require('./common');

module.exports = async function (nodecg) {
  const tokens = await createTokenReplicants(nodecg);

  const twitchOwnerClient = await createTwitchUserClient(nodecg, tokens.user);
  const { userName: ownerUserName } = await twitchOwnerClient.getTokenInfo();

  const twitchChatClient = await createTwitchUserClient(nodecg, tokens.chatbot);
  const { userId, userName } = await twitchChatClient.getTokenInfo();
  
  const chat = await ChatClient.forTwitchClient(twitchChatClient, {
    channels: [ownerUserName],
    requestMembershipEvents: true,
    logLevel: LogLevel.DEBUG,
  });
  nodecg.log.debug(`Chatbot connecting as ${userName} in channel ${ownerUserName}`);
  await chat.connect();
  nodecg.log.info(`Chatbot connected as ${userName} in channel ${ownerUserName}`);

  chat.say(ownerUserName, "Chatbot reporting for duty 👋");

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

  chat.onJoin((channel, user) =>
    nodecg.sendMessage('twitch.join', { channel, user })
  );

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
