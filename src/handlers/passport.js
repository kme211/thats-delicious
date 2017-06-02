const passport = require('passport');
const mongoose = require('mongoose');
const User = mongoose.model('User');

passport.use(User.createStrategy()); 
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// We can use these methods on User because of this package: 
// https://www.npmjs.com/package/passport-local-mongoose
// which was added as a plugin in the User model