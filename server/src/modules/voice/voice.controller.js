const voiceService = require('./voice.service');

async function chat(req, res, next) {
  try {
    const { messages, lat, lng, address, lensScanId } = req.body;
    const location = (lat != null && lng != null) ? { lat: Number(lat), lng: Number(lng) } : null;
    const result = await voiceService.converse({
      userId: req.auth.sub,
      messages,
      location,
      address: address || null,
      lensScanId: lensScanId || null,
    });
    res.json(result); // { reply, cards, actions, model }
  } catch (err) { next(err); }
}

module.exports = { chat };
