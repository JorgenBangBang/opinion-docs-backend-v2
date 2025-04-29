const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Document = require('../models/Document');
const Revision = require('../models/Revision');
const Category = require('../models/Category');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');

// Configure multer for file uploads
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

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

// @route   GET api/documents
// @desc    Get all documents with optional filtering
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { category, subcategory, search, status, sort, page = 1, limit = 10 } = req.query;
    
    // Build query
    const query = {};
    
    // Filter by category
    if (category) {
      query.category = category;
    }
    
    // Filter by subcategory
    if (subcategory) {
      query.subcategory = subcategory;
    }
    
    // Filter by status
    if (status) {
      query.status = status;
    } else {
      // By default, only show active documents
      query.status = 'active';
    }
    
    // Search functionality
    if (search) {
      query.$text = { $search: search };
    }
    
    // Build sort options
    let sortOptions = {};
    if (sort) {
      const [field, order] = sort.split(':');
      sortOptions[field] = order === 'desc' ? -1 : 1;
    } else {
      // Default sort by updatedAt desc
      sortOptions = { updatedAt: -1 };
    }
    
    // Pagination
    const skip = (page - 1) * limit;
    
    // Execute query with pagination
    const documents = await Document.find(query)
      .populate('category', 'name')
      .populate('uploadedBy', 'name')
      .populate('lastModifiedBy', 'name')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));
    
    // Get total count for pagination
    const total = await Document.countDocuments(query);
    
    res.json({
      documents,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('Get documents error:', err);
    res.status(500).json({ message: 'Serverfeil ved henting av dokumenter' });
  }
});

// @route   GET api/documents/:id
// @desc    Get document by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const document = await Document.findById(req.params.id)
      .populate('category', 'name subcategories')
      .populate('uploadedBy', 'name')
      .populate('lastModifiedBy', 'name');
    
    if (!document) {
      return res.status(404).json({ message: 'Dokument ikke funnet' });
    }
    
    res.json(document);
  } catch (err) {
    console.error('Get document error:', err);
    res.status(500).json({ message: 'Serverfeil ved henting av dokument' });
  }
});

// @route   POST api/documents
// @desc    Create a new document
// @access  Private
router.post('/', auth, upload.single('file'), async (req, res) => {
  try {
    const { title, description, category, subcategory, tags, reviewDate } = req.body;
    
    // Validate input
    if (!title || !category || !subcategory || !req.file) {
      // Remove uploaded file if validation fails
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ message: 'Vennligst fyll ut alle påkrevde felt' });
    }
    
    // Check if category exists
    const categoryObj = await Category.findById(category);
    if (!categoryObj) {
      // Remove uploaded file if category doesn't exist
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: 'Ugyldig kategori' });
    }
    
    // Check if subcategory exists in category
    const subcategoryExists = categoryObj.subcategories.some(sub => sub.name === subcategory);
    if (!subcategoryExists) {
      // Remove uploaded file if subcategory doesn't exist
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: 'Ugyldig underkategori' });
    }
    
    // Parse tags
    let parsedTags = [];
    if (tags) {
      parsedTags = Array.isArray(tags) ? tags : JSON.parse(tags);
    }
    
    // Create new document
    const newDocument = new Document({
      title,
      description: description || '',
      category,
      subcategory,
      tags: parsedTags,
      filePath: req.file.path,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      fileType: req.file.mimetype,
      uploadedBy: req.user.id,
      lastModifiedBy: req.user.id,
      reviewDate: reviewDate || new Date(+new Date() + 365*24*60*60*1000) // Default to 1 year from now
    });
    
    // Save document
    const savedDocument = await newDocument.save();
    
    res.status(201).json(savedDocument);
  } catch (err) {
    console.error('Create document error:', err);
    // Remove uploaded file if error occurs
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ message: 'Serverfeil ved oppretting av dokument' });
  }
});

// @route   PUT api/documents/:id
// @desc    Update a document
// @access  Private
router.put('/:id', auth, async (req, res) => {
  try {
    const { title, description, category, subcategory, tags, reviewDate, status } = req.body;
    
    // Find document
    let document = await Document.findById(req.params.id);
    if (!document) {
      return res.status(404).json({ message: 'Dokument ikke funnet' });
    }
    
    // Check if category exists if provided
    if (category) {
      const categoryObj = await Category.findById(category);
      if (!categoryObj) {
        return res.status(400).json({ message: 'Ugyldig kategori' });
      }
      
      // Check if subcategory exists in category if both category and subcategory are provided
      if (subcategory) {
        const subcategoryExists = categoryObj.subcategories.some(sub => sub.name === subcategory);
        if (!subcategoryExists) {
          return res.status(400).json({ message: 'Ugyldig underkategori' });
        }
      }
    } else if (subcategory) {
      // If only subcategory is provided, check if it exists in the current category
      const categoryObj = await Category.findById(document.category);
      const subcategoryExists = categoryObj.subcategories.some(sub => sub.name === subcategory);
      if (!subcategoryExists) {
        return res.status(400).json({ message: 'Ugyldig underkategori' });
      }
    }
    
    // Parse tags if provided
    let parsedTags = document.tags;
    if (tags) {
      parsedTags = Array.isArray(tags) ? tags : JSON.parse(tags);
    }
    
    // Update document
    document.title = title || document.title;
    document.description = description !== undefined ? description : document.description;
    document.category = category || document.category;
    document.subcategory = subcategory || document.subcategory;
    document.tags = parsedTags;
    document.reviewDate = reviewDate || document.reviewDate;
    document.status = status || document.status;
    document.lastModifiedBy = req.user.id;
    document.updatedAt = Date.now();
    
    // Save document
    const updatedDocument = await document.save();
    
    res.json(updatedDocument);
  } catch (err) {
    console.error('Update document error:', err);
    res.status(500).json({ message: 'Serverfeil ved oppdatering av dokument' });
  }
});

// @route   DELETE api/documents/:id
// @desc    Delete a document (soft delete)
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    // Find document
    let document = await Document.findById(req.params.id);
    if (!document) {
      return res.status(404).json({ message: 'Dokument ikke funnet' });
    }
    
    // Soft delete (change status to deleted)
    document.status = 'deleted';
    document.lastModifiedBy = req.user.id;
    document.updatedAt = Date.now();
    
    // Save document
    await document.save();
    
    res.json({ message: 'Dokument slettet' });
  } catch (err) {
    console.error('Delete document error:', err);
    res.status(500).json({ message: 'Serverfeil ved sletting av dokument' });
  }
});

// @route   GET api/documents/:id/download
// @desc    Download a document
// @access  Private
router.get('/:id/download', auth, async (req, res) => {
  try {
    // Find document
    const document = await Document.findById(req.params.id);
    if (!document) {
      return res.status(404).json({ message: 'Dokument ikke funnet' });
    }
    
    // Check if file exists
    if (!fs.existsSync(document.filePath)) {
      return res.status(404).json({ message: 'Filen ble ikke funnet' });
    }
    
    // Set headers
    res.setHeader('Content-Type', document.fileType);
    res.setHeader('Content-Disposition', `attachment; filename="${document.fileName}"`);
    
    // Stream file
    const fileStream = fs.createReadStream(document.filePath);
    fileStream.pipe(res);
  } catch (err) {
    console.error('Download document error:', err);
    res.status(500).json({ message: 'Serverfeil ved nedlasting av dokument' });
  }
});

// @route   POST api/documents/:id/revisions
// @desc    Upload a new revision of a document
// @access  Private
router.post('/:id/revisions', auth, upload.single('file'), async (req, res) => {
  try {
    const { changes } = req.body;
    
    // Find document
    let document = await Document.findById(req.params.id);
    if (!document) {
      // Remove uploaded file if document doesn't exist
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).json({ message: 'Dokument ikke funnet' });
    }
    
    // Validate input
    if (!req.file) {
      return res.status(400).json({ message: 'Ingen fil lastet opp' });
    }
    
    // Create new revision
    const newRevision = new Revision({
      document: document._id,
      version: document.version,
      filePath: document.filePath,
      fileName: document.fileName,
      fileSize: document.fileSize,
      fileType: document.fileType,
      changes: changes || '',
      createdBy: req.user.id
    });
    
    // Save revision
    await newRevision.save();
    
    // Update document with new file
    document.filePath = req.file.path;
    document.fileName = req.file.originalname;
    document.fileSize = req.file.size;
    document.fileType = req.file.mimetype;
    document.version += 1;
    document.lastModifiedBy = req.user.id;
    document.updatedAt = Date.now();
    
    // Save document
    const updatedDocument = await document.save();
    
    res.json(updatedDocument);
  } catch (err) {
    console.error('Upload revision error:', err);
    // Remove uploaded file if error occurs
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ message: 'Serverfeil ved opplasting av ny versjon' });
  }
});

// @route   GET api/documents/:id/revisions
// @desc    Get all revisions of a document
// @access  Private
router.get('/:id/revisions', auth, async (req, res) => {
  try {
    // Find document
    const document = await Document.findById(req.params.id);
    if (!document) {
      return res.status(404).json({ message: 'Dokument ikke funnet' });
    }
    
    // Get revisions
    const revisions = await Revision.find({ document: req.params.id })
      .populate('createdBy', 'name')
      .sort({ version: -1 });
    
    res.json(revisions);
  } catch (err) {
    console.error('Get revisions error:', err);
    res.status(500).json({ message: 'Serverfeil ved henting av revisjoner' });
  }
});

// @route   GET api/documents/:id/revisions/:version/download
// @desc    Download a specific revision of a document
// @access  Private
router.get('/:id/revisions/:version/download', auth, async (req, res) => {
  try {
    // Find revision
    const revision = await Revision.findOne({
      document: req.params.id,
      version: req.params.version
    });
    
    if (!revision) {
      return res.status(404).json({ message: 'Revisjon ikke funnet' });
    }
    
    // Check if file exists
    if (!fs.existsSync(revision.filePath)) {
      return res.status(404).json({ message: 'Filen ble ikke funnet' });
    }
    
    // Set headers
    res.setHeader('Content-Type', revision.fileType);
    res.setHeader('Content-Disposition', `attachment; filename="${revision.fileName}"`);
    
    // Stream file
    const fileStream = fs.createReadStream(revision.filePath);
    fileStream.pipe(res);
  } catch (err) {
    console.error('Download revision error:', err);
    res.status(500).json({ message: 'Serverfeil ved nedlasting av revisjon' });
  }
});

module.exports = router;
