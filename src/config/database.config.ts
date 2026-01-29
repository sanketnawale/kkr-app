import { registerAs } from '@nestjs/config';

export default registerAs('database', () => {
  // ✅ FIXED: Use MONGODB_URI + NO LOCALHOST FALLBACK
  const uri = process.env.MONGODB_URI;
  
  if (!uri) {
    throw new Error('🚨 MONGODB_URI environment variable REQUIRED for production');
  }
  
  return {
    uri,
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    },
  };
});
