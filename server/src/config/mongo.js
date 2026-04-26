const mongoose = require('mongoose');
const config = require('./index');
const logger = require('../utils/logger');

async function connectMongo() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(config.mongo.uri, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    maxPoolSize: 50,
    minPoolSize: 5,
  });
  logger.info('MongoDB connected');

  mongoose.connection.on('error', (err) => logger.error({ err }, 'Mongo error'));
  mongoose.connection.on('disconnected', () => logger.warn('Mongo disconnected'));
}

module.exports = { connectMongo };
