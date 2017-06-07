const mongoose = require('mongoose');
mongoose.Promise = global.Promise;
const slug = require('slugs');
const xssFilters = require('xss-filters');

const storeSchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true,
    required: 'Please enter a store name!'
  },
  slug: String,
  description: {
    type: String,
    trim: true
  },
  tags: [String],
  created: {
    type: Date,
    default: Date.now
  },
  location: {
    type: {
      type: String,
      default: 'Point'
    },
    coordinates: [{
      type: Number,
      required: 'You Must supply coordinates!'
    }],
    address: {
      type: String,
      required: 'You must supply an address!'
    }
  },
  photo: String,
  author: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: 'You must supply an author'
  }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Define our indexes
// so that we can search faster
storeSchema.index({
  name: 'text',
  description: 'text'
});

storeSchema.index({ location: '2dsphere' });

storeSchema.pre('save', function(next) {
  this.name = xssFilters.inHTMLData(this.name);
  this.description = xssFilters.inHTMLData(this.description);
  this.location.address = xssFilters.inHTMLData(this.location.address);
  next();
});

storeSchema.pre('save', async function(next) {
  if (!this.isModified('name')) {
    return next();
  }
  this.slug = slug(this.name);

  const slugRegEx = new RegExp(`^(${this.slug})((-[0-9]*$)?)$`, 'i')
  const storesWithSlug = await this.constructor.find({ slug: slugRegEx });
  if(storesWithSlug.length) {
    this.slug = `${this.slug}-${storesWithSlug.length + 1}`;
  }
  next();
});

storeSchema.statics.getTagsList = function() {
  return this.aggregate([
    { $unwind: '$tags' },
    { $group: { _id: '$tags', count: { $sum: 1 }}},
    { $sort: { count: -1 }}
  ]);
};

storeSchema.statics.getTopStores = function() {
  return this.aggregate([
    // lookup stores and populate their reviews
    // https://docs.mongodb.com/manual/reference/operator/aggregation/lookup/
    { $lookup: { from: 'reviews', localField: '_id', foreignField: 'store', as: 'reviews' } },
    // filter for only items that have 2 or more reviews
    // reviews.1 -> the 1 refers to the index. same as saying 'where the second item in reviews exists'
    { $match : { 'reviews.1': { $exists: true }}},
    // add the average reviews field
    // In MongoDB, you can use $addField instead of $project which won't remove all the other fields from the doc
    // https://docs.mongodb.com/manual/reference/operator/aggregation/project/#pipe._S_project
    { $project: {
      photo: '$$ROOT.photo', // $$ROOT means the original document
      name: '$$ROOT.name',
      slug: '$$ROOT.slug',
      reviews: '$$ROOT.reviews',
      averageRating: { $avg: '$reviews.rating' }
    } },
    // sort it by our new field, highest reviews first
    // https://docs.mongodb.com/manual/reference/operator/aggregation/sort/
    { $sort: { averageRating: -1 } },
    // limit to at most 10
    // https://docs.mongodb.com/manual/reference/operator/aggregation/limit/
    { $limit: 10 }
  ]);
};

// find reviews where the stores _id property === reviews store property
storeSchema.virtual('reviews', {
  ref: 'Review', // what model to link?
  localField: '_id', // which field on the store? 
  foreignField: 'store' // which field on the review? 
});

function autopopulate(next) {
  this.populate('reviews');
  next();
}

storeSchema.pre('find', autopopulate);
storeSchema.pre('findOne', autopopulate);

module.exports = mongoose.model('Store', storeSchema);