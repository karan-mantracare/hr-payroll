const { handleRequest } = require('../server');

module.exports = (req, res) => {
  // If request was rewritten by Vercel, restore original path
  const vercelPath = req.headers['x-matched-path'] || req.headers['x-vercel-matched-path'];
  if (vercelPath) {
    req.url = vercelPath;
  } else if (req.query && req.query.path) {
    const queryPath = Array.isArray(req.query.path) ? req.query.path.join('/') : req.query.path;
    req.url = '/api/' + queryPath;
  }
  return handleRequest(req, res);
};
