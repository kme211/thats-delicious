const mongoose = require('mongoose');
const Review = mongoose.model('Review');

exports.addReview = async (req, res) => {
  Object.assign(req.body, { author: req.user._id, store: req.params.id });
  const review = await (new Review(req.body)).save();
  req.flash('success', 'Review saved!');
  res.redirect('back');
};