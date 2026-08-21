import rateLimit from 'express-rate-limit';

// Strict rate limiter for authentication routes (login, signup, OTP requests)
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5000, // Significantly increased from 30 to 5000 to allow shared campus IPs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many authentication attempts from this IP address. Please try again after 15 minutes.'
  }
});

// General API rate limiter for standard feed & room interactions
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 3000, // Significantly increased from 120 to 3000 to allow shared campus IPs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests. Please slow down.'
  }
});
