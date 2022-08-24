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
    logger: { minLevel: nodecg.config.logging.console.level },
  });

  nodecg.log.debug(
    `Chatbot connecting as ${userName} in channel ${ownerUserName}`
  );
  await chat.connect();
  nodecg.log.info(
    `Chatbot connected as ${userName} in channel ${ownerUserName}`
  );

  nodecg.listenFor('twitch.chat.say', ({ message }) => {
    chat.say(ownerUserName, message);
  });

  const sendMessage = (name, data = {}) => {
    const messageName = `twitch.chat.${name}`;
    nodecg.log.trace(messageName, data);
    nodecg.sendMessage(messageName, data);
  };

  chat.onDisconnect((manually, reason) => {
    nodecg.log.warn(`Chatbot disconnected because ${reason}`);
    sendMessage('Disconnect', { manually, reason });
    if (manually) return;
    chat.connect();
  });

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

  chat.onJoin((channel, user) => {
    if (user === userName) {
      chat.say(ownerUserName, `Chatbot reporting for duty at ${Date.now()} 👋`);
    }
    sendMessage('Join', { channel, user });
  });

  [
    ['Action', ['message', 'msg']],
    ['Announcement', ['announcementInfo', 'msg']],
    ['Ban', ['msg']],
    ['BitsBadgeUpgrade', ['upgradeInfo', 'msg']],
    ['CommunityPayForward', ['forwardInfo', 'msg']],
    ['CommunitySub', ['subInfo', 'msg']],
    ['GiftPaidUpgrade', ['subInfo', 'msg']],
    ['Message', ['message', 'msg']],
    ['Part'],
    ['PrimeCommunityGift', ['subInfo', 'msg']],
    ['PrimePaidUpgrade', ['subInfo', 'msg']],
    ['Raid', ['raidInfo', 'msg']],
    ['Resub', ['subInfo', 'msg']],
    ['RewardGift', ['rewardGiftInfo', 'msg']],
    ['Ritual', ['ritualInfo', 'msg']],
    ['StandardPayForward', ['forwardInfo', 'msg']],
    ['Sub', ['subInfo', 'msg']],
    ['SubExtend', ['subInfo', 'msg']],
    ['SubGift', ['subInfo', 'msg']],
    ['Timeout', ['duration', 'msg']],
  ].forEach(([name, paramNames = []]) => {
    chat[`on${name}`]((channel, user, ...params) => {
      const data = paramNames.reduce(
        (acc, name, idx) => ({
          ...acc,
          [name]: params[idx],
        }),
        { channel, user }
      );
      sendMessage(name, { ...data, params });
    });
  });

  [
    //['AnyMessage', ['msg']],
    ['AuthenticationFailure', ['message', 'retryCount']],
    ['ChatClear', ['channel', 'msg']],
    ['Connect'],
    ['Ctcp', ['target', 'user', 'command', 'ctcpParams', 'msg']],
    ['CtcpReply', ['target', 'user', 'command', 'params', 'msg']],
    ['EmoteOnly', ['channel', 'enabled']],
    ['FollowersOnly', ['channel', 'enabled', 'delay']],
    ['Host', ['channel', 'target', 'viewers']],
    ['Hosted', ['channel', 'byChannel', 'auto', 'viewers']],
    ['HostsRemaining', ['channel', 'numberOfHosts']],
    ['JoinFailure', ['channel', 'reason']],
    ['MessageFailed', ['channel', 'reason']],
    ['MessageRatelimit', ['channel', 'message']],
    ['MessageRemove', ['channel', 'messageId', 'msg']],
    ['NickChange', ['oldNick', 'newNick', 'msg']],
    ['NoPermission', ['channel', 'message']],
    ['Notice', ['target', 'user', 'message', 'msg']],
    ['PasswordError', ['error']],
    ['R9k', ['channel', 'enabled']],
    ['Raid', ['channel', 'user', 'raidInfo', 'msg']],
    ['RaidCancel', ['channel', 'msg']],
    ['Register'],
    ['Slow', ['channel', 'enabled', 'delay']],
    ['SubsOnly', ['channel', 'enabled']],
    ['Unhost', ['channel']],
    ['Whisper', ['user', 'message', 'msg']],
  ].forEach(([name, paramNames = []]) => {
    chat[`on${name}`]((...params) => {
      const data = paramNames.reduce(
        (acc, name, idx) => ({
          ...acc,
          [name]: params[idx],
        }),
        {}
      );
      sendMessage(name, { ...data, params });
    });
  });
};
