const NodeCG = require('../../../lib/api');
const TwitchClient = require('twitch').default;
const LogLevel = require('@d-fischer/logger/lib/LogLevel').default;

const tokenTypes = ['app', 'user', 'chatbot'];

const TWITCH_SCOPES = [
  'bits:read',
  'channel_read',
  'channel_editor',
  'channel_check_subscription',
  'channel_commercial',
  'channel_subscriptions',
  'channel:moderate',
  'channel:read:subscriptions',
  'channel:read:redemptions',
  'clips:edit',
  'user:edit',
  'user:edit:broadcast',
  'user:read:email',
  'channel:moderate',
  'moderation:read',
  'chat:edit',
  'chat:read',
  'whispers:read',
  'whispers:edit',
];

// Simple html tagged template utility
const html = (strings, ...values) =>
  strings.reduce(
    (result, string, i) =>
      result +
      string +
      (values[i]
        ? Array.isArray(values[i])
          ? values[i].join("")
          : values[i]
        : ""),
    ""
  );

const htmlPage = (...args) => {
  const body = args.pop() || '';
  const head = args.pop() || '';
  return html`
    <!DOCTYPE html>
    <html>
      <head>
        ${head}
      </head>
      <body>
        ${body}
      </body>
    </html>
  `;
};

async function createTokenReplicants(nodecg) {
  const tokens = {};
  for (const tokenType of tokenTypes) {
    tokens[tokenType] = nodecg.Replicant(`twitch-token-${tokenType}`, {
      defaultValue: {},
    });
  }
  await NodeCG.waitForReplicants(...Object.values(tokens));
  return tokens;
}

async function createTwitchUserClient(nodecg, token) {
  const { clientId, clientSecret } = nodecg.bundleConfig;
  const tokenData = token.value;
  const { access_token: accessToken, refresh_token: refreshToken } = tokenData;
  return TwitchClient.withCredentials(
    clientId,
    accessToken,
    undefined,
    {
      clientSecret,
      refreshToken,
      onRefresh: (newToken) => {
        token.value = {
          ...tokenData,
          access_token: newToken.accessToken,
          refresh_token: newToken.refreshToken,
        };
      },
    },
    {
      logLevel: LogLevel.TRACE,
    }
  );
}

module.exports = {
  TWITCH_SCOPES,
  tokenTypes,
  html,
  htmlPage,
  createTokenReplicants,
  createTwitchUserClient,
};
