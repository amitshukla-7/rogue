import rateLimit from 'express-rate-limit';

// Strict rate limiter for authentication routes (login, signup, OTP requests)
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100000, // Basically disabled (100,000) for campus launch to prevent blocking NAT IPs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many authentication attempts from this IP address. Please try again after 15 minutes.'
  }
});

// General API rate limiter for standard feed & room interactions
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200000, // Basically disabled (200,000) to allow 1000+ simultaneous active users on one IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests. Please slow down.'
  }
});
