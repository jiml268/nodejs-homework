const auth = (req, res, next) => {
  console.log(req.session);
  if (!req.session.userToken) {
    res.json({ message: 'You are not authorized. Please login' });
  // eslint-disable-next-line no-useless-return
  return;
  } else {
    next();
  }
};

module.exports = auth;