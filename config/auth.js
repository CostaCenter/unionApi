module.exports = {
    secret: process.env.AUTH_SECRET ||  "NEW",
    expires:  process.env.AUTH_EXPIRES || "365d",
    rounds:  process.env.AUTH_ROUNDS || 10
} 