const passport = require('passport');

exports.login = passport.authenticate('local', {
  failure: '/login',
  failureFlash: 'Failed login!',
  successRedirect: '/',
  successFlash: 'You have logged in!'
});