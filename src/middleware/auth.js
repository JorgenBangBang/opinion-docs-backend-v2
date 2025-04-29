const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to authenticate JWT token
module.exports = async function(req, res, next) {
  // Get token from header
  const token = req.header('x-auth-token');

  // Check if no token
  if (!token) {
    return res.status(401).json({ message: 'Ingen token, tilgang nektet' });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key');
    
    // Add user from payload to request
    req.user = decoded.user;
    
    // Check if user still exists and is active
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(401).json({ message: 'Ugyldig token, bruker finnes ikke' });
    }
    
    if (!user.isActive) {
      return res.status(401).json({ message: 'Brukerkonto er deaktivert' });
    }
    
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.status(401).json({ message: 'Token er ugyldig' });
  }
};
