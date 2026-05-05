const User = require('./user.model');

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

module.exports = { getMe, updateMe, getAddresses, addAddress, deleteAddress, saveRecentLocation, registerDeviceToken };
