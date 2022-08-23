const fetch = require('node-fetch');
const { TWITCH_SCOPES, html, htmlPage, createTokenReplicants } = require('./common');

module.exports = async function (nodecg) {
  const { host, port } = nodecg.config;
  const { clientId, clientSecret } = nodecg.bundleConfig;

  const tokens = await createTokenReplicants(nodecg);

  const moduleName = nodecg.bundleName;
  const urlpath = `/${moduleName}/auth`;

  const router = nodecg.Router();

  router.get('/', async (req, res) => {
    const { code, error } = req.query;
    if (error) {
      return res.send(htmlError(error));
    }
    if (code) {
      return handleCodeRedirect(req, res, code);
    }
    res.send(htmlIndex(tokens));
  });

  router.post('/', async (req, res) => {
    const tokenResp = await fetch(appTokenUrl(), { method: 'POST' });
    if (!tokenResp.ok) {
      return res.send(htmlError(await tokenResp.text()));
    }
    const tokenData = await tokenResp.json();
    tokens.app.value = {
      ...tokenData,
      expires_at: new Date(
        Date.now() + tokenData.expires_in * 1000
      ).toISOString(),
    };
    return res.redirect(urlpath);
  });

  const handleCodeRedirect = async (req, res, code) => {
    try {
      const chatbot = req.query.state === 'chatbot';
      const tokenResp = await fetch(userTokenUrl({ code, chatbot }), {
        method: 'POST',
      });
      if (!tokenResp.ok) {
        return res.send(htmlError(await tokenResp.text()));
      }
      const tokenData = await tokenResp.json();
      tokens[chatbot ? 'chatbot' : 'user'].value = {
        ...tokenData,
        expires_at: new Date(
          Date.now() + tokenData.expires_in * 1000
        ).toISOString(),
      };
      return res.redirect(urlpath);
    } catch (err) {
      return res.send(htmlError(err));
    }
  };

  const htmlIndex = ({ app, user, chatbot }) =>
    htmlPage(html`
      <h1>twitch-auth</h1>

      <section>
        <h2>App Access Token</h2>
        <p>Expires in: ${app.value.expires_in}</p>
        <form method="POST">
          <input type="hidden" name="appAccess" value="1" />
          <button type="submit">Authorize app</button>
        </form>
      </section>

      <section>
        <h2>User / Owner Access Token</h2>
        <p>Expires in: ${user.value.expires_in}</p>
        <a href="${authorizeUserUrl()}">Authorize user</a>
      </section>

      <section>
        <h2>Chatbot Access Token</h2>
        <p>Expires in: ${chatbot.value.expires_in}</p>
        <a href="${authorizeUserUrl({ chatbot: true })}">Authorize user</a>
      </section>
    `);

  const htmlError = (error) =>
    htmlPage(html`
      <h1>Error</h1>
      ${error.toString()}
      <p><a href="${urlpath}">Try again</a></p>
    `);

  const redirectUri = () => `http://${host}:${port}${urlpath}/`;

  const authorizeUserUrl = ({ chatbot = false } = {}) => {
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri(),
      response_type: 'code',
      scope: TWITCH_SCOPES.join(' '),
      state: chatbot ? 'chatbot' : 'user',
    });
    return `https://id.twitch.tv/oauth2/authorize?${params.toString()}`;
  };

  const userTokenUrl = ({ code, chatbot = false }) => {
    const params = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri(),
    });
    return `https://id.twitch.tv/oauth2/token?${params.toString()}`;
  };

  const appTokenUrl = () => {
    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
      scope: TWITCH_SCOPES.join(' '),
    });
    return `https://id.twitch.tv/oauth2/token?${params.toString()}`;
  };

  nodecg.mount(urlpath, router);
};
