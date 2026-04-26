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

module.exports = { getMe, updateMe, addAddress, deleteAddress };
