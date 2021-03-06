const mongoose = require('mongoose');
const Store = mongoose.model('Store');
const User = mongoose.model('User');
const multer = require('multer');
const jimp = require('jimp');
const uuid = require('uuid');

const multerOptions = {
  storage: multer.memoryStorage(),
  fileFilter(req, file, next) {
    const isPhoto = file.mimetype.startsWith('image/');
    if(isPhoto) {
      next(null, true);
    } else {
      next({ message: 'That filetype isn\'t allowed' }, false);
    }
  }
};

exports.homePage = (req, res) => {
  res.render('index');
};

exports.addStore = (req, res) => {
  res.render('editStore', { title: 'Add Store' });
};

exports.upload = multer(multerOptions).single('photo');

exports.resize = async (req, res, next) => {
  // check if there is no new file to resize
  if(!req.file) {
    next();
    return;
  } 
  const extension = req.file.mimetype.split('/')[1];
  req.body.photo = `${uuid.v4()}.${extension}`;
  const photo = await jimp.read(req.file.buffer);
  await photo.resize(800, jimp.AUTO);
  await photo.write(`./public/uploads/${req.body.photo}`);
  next();
};

exports.createStore = async (req, res) => {
  req.body.author = req.user._id;
  const store = await (new Store(req.body)).save();
  req.flash('success', `Successfully created ${store.name}. Care to leave a review?`);
  res.redirect(`/store/${store.slug}`);
};

exports.getStores = async (req, res) => {
  const page = req.params.page || 1;
  const limit = 4;
  const skip = (page * limit) - limit;
  const storesPromise = await Store
    .find()
    .skip(skip)
    .limit(4)
    .sort({ created: 'desc' });
  const countPromise = Store.count();
  const [stores, count] = await Promise.all([storesPromise, countPromise]);
  const pages = Math.ceil(count / limit);
  if(!stores.length && skip) {
    req.flash('info', `Hey! You asked for ${page} but that doesn't exist so I put you on page ${pages}.`);
    res.redirect(`/stores/page/${pages}`);
    return;
  }
  res.render('stores', { title: 'Stores', page, pages, count, stores });
};

exports.getStoreBySlug = async (req, res, next) => {
  const store = await Store.findOne({ slug: req.params.slug })
    .populate('author reviews');
  if(!store) return next();
  res.render('store', { title: store.name, store });
};

const confirmOwner = (store, user) => {
  if(!store.author.equals(user._id)) {
    
    throw new Error('You must own the store to edit it.');
  }
};

exports.editStore = async (req, res) => {
  const store = await Store.findById(req.params.id);
  confirmOwner(store, req.user);
  res.render('editStore', { title: 'Edit Store', store });
};

exports.updateStore = async (req, res) => {
  req.body.location.type = 'Point';
  const store = await Store.findOneAndUpdate({ _id: req.params.id }, req.body, {
    new: true, // returns new store instead of old one
    runValidators: true // force model to run required validators
  }).exec();
  req.flash('success', `Successfully updated <strong>${store.name}</strong> <a href="/store/${store.slug}">View store →</a>`);
  res.redirect(`/stores/${store.id}/edit`);
};

exports.getStoresByTag = async (req, res) => {
  const tag = req.params.tag;
  const tagQuery = tag || { $exists: true };
  const tagsPromise = Store.getTagsList();
  const storesPromise = Store.find({ tags: tagQuery });
  const [tags, stores] = await Promise.all([tagsPromise, storesPromise]);
  res.render('tags', { title: 'Tags', tags, tag, stores });
};

exports.searchStores = async (req, res) => {
  // Use MongoDB $text operator to search name and description
  // https://docs.mongodb.com/manual/reference/operator/query/text/
  // In the $search field, specify a string of words that the text operator parses and uses to query the text index.
  // We defined our text index in the Store model
  const stores = await Store
    .find({
      $text: {
        $search: req.query.q
      }
    }, {
      score: { $meta: 'textScore' }
    })
    .sort({
      score: { $meta: 'textScore' }
    });
    
  res.json(stores)
};

exports.mapStores = async (req, res) => {
  const coordinates = [+req.query.lng, +req.query.lat];
  // Query database using $near operator
  // https://docs.mongodb.com/manual/reference/operator/query/near/#op._S_near
  const q = {
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates
        },
        $maxDistance: 10000 // 10km
      }
    }
  };

  const stores = await Store.find(q).select('slug name description location photo').limit(10);
  res.json(stores);
};

exports.mapPage = (req, res) => {
  res.render('map', { title: 'Map' });
};

exports.heartStore = async (req, res) => {
  const hearts = req.user.hearts.map(obj => obj.toString());
  const operator = hearts.includes(req.params.id) ? '$pull' : '$addToSet'; // $addToSet will make sure it does not get added twice
  const user = await User.findByIdAndUpdate(req.user._id, 
    { [operator]: { hearts: req.params.id }},
    { new: true }
  );
  res.json(user)
};

exports.getHearts = async (req, res) => {
  const q = {
    '_id': {  $in: req.user.hearts }
  };
  const stores = await Store.find(q);
  res.render('stores', { title: 'Hearts', stores });
};

exports.getTopStores = async (req, res) => {
  const stores = await Store.getTopStores();
  res.render('topStores', { stores, title: '★ Top Stores!'});
};