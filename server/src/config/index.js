require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const Joi = require('joi');

const schema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(4000),
  MONGO_URI: Joi.string().required(),
  REDIS_URL: Joi.string().required(),
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('7d'),
  GOOGLE_MAPS_KEY: Joi.string().required(),
  AWS_REGION: Joi.string().default('ap-south-1'),
  AWS_S3_BUCKET: Joi.string().required(),
  AWS_ACCESS_KEY_ID: Joi.string().required(),
  AWS_SECRET_ACCESS_KEY: Joi.string().required(),
  DISPATCH_RADIUS_KM: Joi.number().default(5),
  DISPATCH_MAX_CANDIDATES: Joi.number().default(20),
  DISPATCH_OFFER_TIMEOUT_MS: Joi.number().default(15000),
  BASE_FEE: Joi.number().default(40),
  PER_KM_FEE: Joi.number().default(12),
  PER_MIN_FEE: Joi.number().default(2),
  PLATFORM_FEE: Joi.number().default(10),
  MIN_FARE: Joi.number().default(60),
  // Razorpay
  RAZORPAY_KEY_ID: Joi.string().default(''),
  RAZORPAY_KEY_SECRET: Joi.string().default(''),
  RAZORPAY_WEBHOOK_SECRET: Joi.string().default(''),
}).unknown();

const { value: env, error } = schema.validate(process.env, { abortEarly: false });
if (error) {
  // eslint-disable-next-line no-console
  console.error('Invalid env config:', error.message);
  process.exit(1);
}

module.exports = {
  env: env.NODE_ENV,
  port: env.PORT,
  mongo: { uri: env.MONGO_URI },
  redis: { url: env.REDIS_URL },
  jwt: { secret: env.JWT_SECRET, expiresIn: env.JWT_EXPIRES_IN },
  googleMaps: { key: env.GOOGLE_MAPS_KEY },
  aws: {
    region: env.AWS_REGION,
    bucket: env.AWS_S3_BUCKET,
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
  dispatch: {
    radiusKm: env.DISPATCH_RADIUS_KM,
    maxCandidates: env.DISPATCH_MAX_CANDIDATES,
    offerTimeoutMs: env.DISPATCH_OFFER_TIMEOUT_MS,
  },
  pricing: {
    baseFee: env.BASE_FEE,
    perKmFee: env.PER_KM_FEE,
    perMinFee: env.PER_MIN_FEE,
    platformFee: env.PLATFORM_FEE,
    minFare: env.MIN_FARE,
  },
  razorpay: {
    keyId: env.RAZORPAY_KEY_ID,
    keySecret: env.RAZORPAY_KEY_SECRET,
    webhookSecret: env.RAZORPAY_WEBHOOK_SECRET,
  },
};
