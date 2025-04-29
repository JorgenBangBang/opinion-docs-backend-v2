const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');

// @route   POST api/auth/register
// @desc    Register a user
// @access  Public
router.post('/register', async (req, res) => {
  try {
    const { email, name, password, department, role } = req.body;

    // Validate input
    if (!email || !name || !password) {
      return res.status(400).json({ message: 'Vennligst fyll ut alle påkrevde felt' });
    }

    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: 'Bruker med denne e-postadressen finnes allerede' });
    }

    // Create new user
    user = new User({
      email,
      name,
      password,
      department: department || '',
      role: role || 'ansatt',
      isActive: true,
      authProvider: 'local'
    });

    // Hash password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    // Save user
    await user.save();

    // Create JWT token
    const payload = {
      user: {
        id: user.id,
        role: user.role
      }
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET || 'your_jwt_secret_key',
      { expiresIn: '24h' },
      (err, token) => {
        if (err) throw err;
        res.json({
          token,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role
          }
        });
      }
    );
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'Serverfeil ved registrering' });
  }
});

// @route   POST api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ message: 'Vennligst fyll ut alle påkrevde felt' });
    }

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Ugyldig e-post eller passord' });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(400).json({ message: 'Denne brukerkontoen er deaktivert' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Ugyldig e-post eller passord' });
    }

    // Update last login
    user.lastLogin = Date.now();
    await user.save();

    // Create JWT token
    const payload = {
      user: {
        id: user.id,
        role: user.role
      }
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET || 'your_jwt_secret_key',
      { expiresIn: '24h' },
      (err, token) => {
        if (err) throw err;
        res.json({
          token,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role
          }
        });
      }
    );
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Serverfeil ved innlogging' });
  }
});

// @route   GET api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'Bruker ikke funnet' });
    }
    res.json(user);
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ message: 'Serverfeil ved henting av bruker' });
  }
});

// @route   POST api/auth/logout
// @desc    Logout user (client-side only)
// @access  Public
router.post('/logout', (req, res) => {
  // JWT is stateless, so logout is handled client-side
  // This endpoint is just for consistency
  res.json({ message: 'Logget ut' });
});

// @route   PUT api/auth/change-password
// @desc    Change user password
// @access  Private
router.put('/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Vennligst fyll ut alle påkrevde felt' });
    }

    // Get user
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Bruker ikke funnet' });
    }

    // Check current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Nåværende passord er feil' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);

    // Save user
    await user.save();

    res.json({ message: 'Passord endret' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ message: 'Serverfeil ved endring av passord' });
  }
});

module.exports = router;
