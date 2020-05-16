module.exports = function (nodecg) {
  Promise.all(
    [
      require('./auth'),
      require('./chatbot'),
      require('./pubsub'),
      require('./webhooks'),
    ].map((fn) => fn(nodecg))
  )
    .then(() => nodecg.log.debug(`${nodecg.bundleName} started up`))
    .catch(err => nodecg.log.error(err));
};
