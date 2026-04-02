/* eslint-disable prettier/prettier */
export default () => ({
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT,
  },
});
