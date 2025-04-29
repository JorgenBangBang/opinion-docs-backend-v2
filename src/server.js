const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const morgan = require('morgan');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

// Import models
const User = require('./models/User');
const Document = require('./models/Document');
const Revision = require('./models/Revision');
const Category = require('./models/Category');
const Notification = require('./models/Notification');

// Import routes
const authRoutes = require('./routes/auth');
const documentRoutes = require('./routes/document');
const categoryRoutes = require('./routes/category');

// Import middleware
const auth = require('./middleware/auth');

// Initialize Express app
const app = express();

// Environment variables
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/opiniondocs';
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Connect to MongoDB
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected'))
.catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(morgan('dev'));
app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later'
});
app.use('/api/', limiter);

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Accept common document types
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'text/csv',
      'image/jpeg',
      'image/png',
      'image/gif'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only documents, images, and text files are allowed.'));
    }
  }
});

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/categories', categoryRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// Initialize default admin user and categories if they don't exist
const initializeDatabase = async () => {
  try {
    // Check if admin user exists
    const adminExists = await User.findOne({ email: 'admin@opinion.no' });
    
    if (!adminExists) {
      // Create admin user
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('password', salt);
      
      const admin = new User({
        email: 'admin@opinion.no',
        name: 'Administrator',
        password: hashedPassword,
        role: 'admin',
        department: 'IT',
        isActive: true
      });
      
      await admin.save();
      console.log('Default admin user created');
    }
    
    // Check if categories exist
    const categoriesCount = await Category.countDocuments();
    
    if (categoriesCount === 0) {
      // Create default categories
      const defaultCategories = [
        {
          name: "Styrende dokumentasjon",
          description: "Overordnede dokumenter som definerer retningslinjer og policyer",
          subcategories: [
            { name: "Informasjonssikkerhetspolicy", description: "Overordnede retningslinjer for informasjonssikkerhet" },
            { name: "Risikostyringspolicy", description: "Retningslinjer for risikostyring" },
            { name: "Roller og ansvar", description: "Definisjon av roller og ansvar innen sikkerhet og personvern" },
            { name: "Ledelsens gjennomgang", description: "Dokumentasjon av ledelsens gjennomgang" }
          ]
        },
        {
          name: "Gjennomførende dokumentasjon",
          description: "Dokumenter som beskriver hvordan policyer implementeres",
          subcategories: [
            { name: "Risikovurderinger", description: "Gjennomførte risikovurderinger" },
            { name: "Rutiner for behandling av personopplysninger", description: "Rutiner for behandling av personopplysninger" },
            { name: "Databehandleravtaler", description: "Avtaler med databehandlere" },
            { name: "Tekniske tiltak", description: "Dokumentasjon av tekniske sikkerhetstiltak" }
          ]
        },
        {
          name: "Kontrollerende dokumentasjon",
          description: "Dokumenter som verifiserer etterlevelse",
          subcategories: [
            { name: "Avvikshåndtering", description: "Dokumentasjon av avvik og håndtering" },
            { name: "Internrevisjoner", description: "Rapporter fra internrevisjoner" },
            { name: "Sikkerhetsmål og tiltak", description: "Definerte sikkerhetsmål og tiltak" }
          ]
        },
        {
          name: "ISO 27001-spesifikke krav",
          description: "Dokumenter spesifikt for ISO 27001-etterlevelse",
          subcategories: [
            { name: "Erklæring om anvendelse (SoA)", description: "Statement of Applicability" },
            { name: "Tiltaksplan (Annex A)", description: "Implementering av kontroller fra Annex A" },
            { name: "Beredskapsplan", description: "Plan for håndtering av sikkerhetshendelser" }
          ]
        },
        {
          name: "Spesifikke krav fra Datatilsynet",
          description: "Dokumenter for etterlevelse av Datatilsynets krav",
          subcategories: [
            { name: "Personvernerklæring", description: "Personvernerklæring for interne og eksterne parter" },
            { name: "Oversikt over behandlingsaktiviteter", description: "Protokoll over behandlingsaktiviteter" },
            { name: "Samtykkehåndtering", description: "Rutiner og dokumentasjon for samtykkehåndtering" }
          ]
        }
      ];
      
      await Category.insertMany(defaultCategories);
      console.log('Default categories created');
    }
  } catch (err) {
    console.error('Database initialization error:', err);
  }
};

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} in ${NODE_ENV} mode`);
  initializeDatabase();
});

module.exports = app;
