const User = require('./user.model');
const SavedCard = require('../payment/saved-card.model');

async function getMe(req, res, next) {
  try {
    const user = await User.findById(req.auth.sub).lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) { next(err); }
}

async function updateMe(req, res, next) {
  try {
    const user = await User.findByIdAndUpdate(req.auth.sub, req.body, { new: true });
    res.json({ user });
  } catch (err) { next(err); }
}

async function getAddresses(req, res, next) {
  try {
    const user = await User.findById(req.auth.sub).select('savedAddresses recentLocations').lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({
      addresses: user.savedAddresses || [],
      recentLocations: (user.recentLocations || [])
        .sort((a, b) => new Date(b.usedAt) - new Date(a.usedAt))
        .slice(0, 5),
    });
  } catch (err) { next(err); }
}

async function addAddress(req, res, next) {
  try {
    const user = await User.findByIdAndUpdate(
      req.auth.sub,
      {
        $push: {
          savedAddresses: {
            label: req.body.label,
            address: req.body.address,
            location: { type: 'Point', coordinates: [req.body.lng, req.body.lat] },
            landmark: req.body.landmark,
            flatNumber: req.body.flatNumber,
            notes: req.body.notes,
            tag: req.body.tag || 'other',
          },
        },
      },
      { new: true }
    );
    res.json({ addresses: user.savedAddresses });
  } catch (err) { next(err); }
}

async function deleteAddress(req, res, next) {
  try {
    const user = await User.findByIdAndUpdate(
      req.auth.sub,
      { $pull: { savedAddresses: { _id: req.params.addrId } } },
      { new: true }
    );
    res.json({ addresses: user.savedAddresses });
  } catch (err) { next(err); }
}

async function editAddress(req, res, next) {
  try {
    const { addrId } = req.params;
    const update = {};
    const textFields = ['label', 'address', 'tag', 'landmark', 'flatNumber', 'notes'];
    for (const key of textFields) {
      if (req.body[key] !== undefined) update[`savedAddresses.$.${key}`] = req.body[key];
    }
    if (req.body.lat !== undefined && req.body.lng !== undefined) {
      update['savedAddresses.$.location'] = {
        type: 'Point',
        coordinates: [parseFloat(req.body.lng), parseFloat(req.body.lat)],
      };
    }
    if (!Object.keys(update).length) return res.status(400).json({ error: 'No fields to update' });
    const user = await User.findOneAndUpdate(
      { _id: req.auth.sub, 'savedAddresses._id': addrId },
      { $set: update },
      { new: true }
    );
    if (!user) return res.status(404).json({ error: 'Address not found' });
    res.json({ addresses: user.savedAddresses });
  } catch (err) { next(err); }
}

async function setDefaultAddress(req, res, next) {
  try {
    const { addrId } = req.params;
    await User.updateOne({ _id: req.auth.sub }, { $set: { 'savedAddresses.$[].isDefault': false } });
    const user = await User.findOneAndUpdate(
      { _id: req.auth.sub, 'savedAddresses._id': addrId },
      { $set: { 'savedAddresses.$.isDefault': true } },
      { new: true }
    );
    if (!user) return res.status(404).json({ error: 'Address not found' });
    res.json({ addresses: user.savedAddresses });
  } catch (err) { next(err); }
}

async function listPaymentMethods(req, res, next) {
  try {
    const methods = await SavedCard.find({ userId: req.auth.sub }).sort({ isDefault: -1, createdAt: -1 }).lean();
    res.json({ methods });
  } catch (err) { next(err); }
}

async function addPaymentMethod(req, res, next) {
  try {
    const { type, last4, network, cardName, expiryMM, expiryYY, upiId, upiProvider } = req.body;
    const method = await SavedCard.create({
      userId: req.auth.sub, type, last4, network, cardName, expiryMM, expiryYY, upiId, upiProvider,
    });
    res.status(201).json({ method });
  } catch (err) { next(err); }
}

async function deletePaymentMethod(req, res, next) {
  try {
    const result = await SavedCard.deleteOne({ _id: req.params.methodId, userId: req.auth.sub });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Payment method not found' });
    res.json({ ok: true });
  } catch (err) { next(err); }
}

async function setDefaultPaymentMethod(req, res, next) {
  try {
    await SavedCard.updateMany({ userId: req.auth.sub }, { $set: { isDefault: false } });
    const method = await SavedCard.findOneAndUpdate(
      { _id: req.params.methodId, userId: req.auth.sub },
      { $set: { isDefault: true } },
      { new: true }
    );
    if (!method) return res.status(404).json({ error: 'Payment method not found' });
    res.json({ method });
  } catch (err) { next(err); }
}

async function saveRecentLocation(req, res, next) {
  try {
    const { address, lat, lng } = req.body;
    // Remove duplicate, unshift new entry, keep most recent 10
    await User.updateOne({ _id: req.auth.sub }, { $pull: { recentLocations: { address } } });
    await User.updateOne({ _id: req.auth.sub }, {
      $push: {
        recentLocations: {
          $each: [{ address, lat, lng, usedAt: new Date() }],
          $position: 0,
          $slice: 10,
        },
      },
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
}

async function registerDeviceToken(req, res, next) {
  try {
    await User.updateOne(
      { _id: req.auth.sub },
      { $addToSet: { deviceTokens: req.body.token } }
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
}

module.exports = {
  getMe, updateMe,
  getAddresses, addAddress, deleteAddress, editAddress, setDefaultAddress,
  listPaymentMethods, addPaymentMethod, deletePaymentMethod, setDefaultPaymentMethod,
  saveRecentLocation, registerDeviceToken,
};
