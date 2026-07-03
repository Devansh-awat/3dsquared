const { isAuthed } = require('./_auth');

module.exports = (req, res) => {
  res.status(200).json({ authed: isAuthed(req) });
};
