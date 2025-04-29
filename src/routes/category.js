const express = require('express');
const router = express.Router();
const Category = require('../models/Category');
const Document = require('../models/Document');
const auth = require('../middleware/auth');

// @route   GET api/categories
// @desc    Get all categories
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const categories = await Category.find().sort({ name: 1 });
    res.json(categories);
  } catch (err) {
    console.error('Get categories error:', err);
    res.status(500).json({ message: 'Serverfeil ved henting av kategorier' });
  }
});

// @route   GET api/categories/:id
// @desc    Get category by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    
    if (!category) {
      return res.status(404).json({ message: 'Kategori ikke funnet' });
    }
    
    res.json(category);
  } catch (err) {
    console.error('Get category error:', err);
    res.status(500).json({ message: 'Serverfeil ved henting av kategori' });
  }
});

// @route   POST api/categories
// @desc    Create a new category
// @access  Private (admin only)
router.post('/', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin' && req.user.role !== 'it_ansvarlig') {
      return res.status(403).json({ message: 'Ikke tilgang til å opprette kategorier' });
    }
    
    const { name, description, subcategories } = req.body;
    
    // Validate input
    if (!name) {
      return res.status(400).json({ message: 'Kategorinavn er påkrevd' });
    }
    
    // Check if category already exists
    const existingCategory = await Category.findOne({ name });
    if (existingCategory) {
      return res.status(400).json({ message: 'Kategori med dette navnet finnes allerede' });
    }
    
    // Create new category
    const newCategory = new Category({
      name,
      description: description || '',
      subcategories: subcategories || []
    });
    
    // Save category
    const savedCategory = await newCategory.save();
    
    res.status(201).json(savedCategory);
  } catch (err) {
    console.error('Create category error:', err);
    res.status(500).json({ message: 'Serverfeil ved oppretting av kategori' });
  }
});

// @route   PUT api/categories/:id
// @desc    Update a category
// @access  Private (admin only)
router.put('/:id', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin' && req.user.role !== 'it_ansvarlig') {
      return res.status(403).json({ message: 'Ikke tilgang til å oppdatere kategorier' });
    }
    
    const { name, description } = req.body;
    
    // Find category
    let category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Kategori ikke funnet' });
    }
    
    // Check if new name already exists (if name is being changed)
    if (name && name !== category.name) {
      const existingCategory = await Category.findOne({ name });
      if (existingCategory) {
        return res.status(400).json({ message: 'Kategori med dette navnet finnes allerede' });
      }
    }
    
    // Update category
    category.name = name || category.name;
    category.description = description !== undefined ? description : category.description;
    category.updatedAt = Date.now();
    
    // Save category
    const updatedCategory = await category.save();
    
    res.json(updatedCategory);
  } catch (err) {
    console.error('Update category error:', err);
    res.status(500).json({ message: 'Serverfeil ved oppdatering av kategori' });
  }
});

// @route   DELETE api/categories/:id
// @desc    Delete a category
// @access  Private (admin only)
router.delete('/:id', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin' && req.user.role !== 'it_ansvarlig') {
      return res.status(403).json({ message: 'Ikke tilgang til å slette kategorier' });
    }
    
    // Check if category has documents
    const documentsCount = await Document.countDocuments({ category: req.params.id });
    if (documentsCount > 0) {
      return res.status(400).json({ 
        message: 'Kan ikke slette kategori som inneholder dokumenter. Flytt eller slett dokumentene først.' 
      });
    }
    
    // Find and delete category
    const category = await Category.findByIdAndDelete(req.params.id);
    
    if (!category) {
      return res.status(404).json({ message: 'Kategori ikke funnet' });
    }
    
    res.json({ message: 'Kategori slettet' });
  } catch (err) {
    console.error('Delete category error:', err);
    res.status(500).json({ message: 'Serverfeil ved sletting av kategori' });
  }
});

// @route   POST api/categories/:id/subcategories
// @desc    Add a subcategory to a category
// @access  Private (admin only)
router.post('/:id/subcategories', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin' && req.user.role !== 'it_ansvarlig') {
      return res.status(403).json({ message: 'Ikke tilgang til å legge til underkategorier' });
    }
    
    const { name, description } = req.body;
    
    // Validate input
    if (!name) {
      return res.status(400).json({ message: 'Underkategorinavn er påkrevd' });
    }
    
    // Find category
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Kategori ikke funnet' });
    }
    
    // Check if subcategory already exists
    const subcategoryExists = category.subcategories.some(sub => sub.name === name);
    if (subcategoryExists) {
      return res.status(400).json({ message: 'Underkategori med dette navnet finnes allerede' });
    }
    
    // Add subcategory
    category.subcategories.push({
      name,
      description: description || ''
    });
    category.updatedAt = Date.now();
    
    // Save category
    const updatedCategory = await category.save();
    
    res.json(updatedCategory);
  } catch (err) {
    console.error('Add subcategory error:', err);
    res.status(500).json({ message: 'Serverfeil ved tillegging av underkategori' });
  }
});

// @route   PUT api/categories/:id/subcategories/:name
// @desc    Update a subcategory
// @access  Private (admin only)
router.put('/:id/subcategories/:name', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin' && req.user.role !== 'it_ansvarlig') {
      return res.status(403).json({ message: 'Ikke tilgang til å oppdatere underkategorier' });
    }
    
    const { newName, description } = req.body;
    const { name } = req.params;
    
    // Find category
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Kategori ikke funnet' });
    }
    
    // Find subcategory
    const subcategoryIndex = category.subcategories.findIndex(sub => sub.name === name);
    if (subcategoryIndex === -1) {
      return res.status(404).json({ message: 'Underkategori ikke funnet' });
    }
    
    // Check if new name already exists (if name is being changed)
    if (newName && newName !== name) {
      const subcategoryExists = category.subcategories.some(sub => sub.name === newName);
      if (subcategoryExists) {
        return res.status(400).json({ message: 'Underkategori med dette navnet finnes allerede' });
      }
      
      // Check if subcategory is used in documents
      const documentsCount = await Document.countDocuments({ 
        category: req.params.id, 
        subcategory: name 
      });
      
      if (documentsCount > 0) {
        // Update all documents with the new subcategory name
        await Document.updateMany(
          { category: req.params.id, subcategory: name },
          { subcategory: newName }
        );
      }
    }
    
    // Update subcategory
    if (newName) {
      category.subcategories[subcategoryIndex].name = newName;
    }
    
    if (description !== undefined) {
      category.subcategories[subcategoryIndex].description = description;
    }
    
    category.updatedAt = Date.now();
    
    // Save category
    const updatedCategory = await category.save();
    
    res.json(updatedCategory);
  } catch (err) {
    console.error('Update subcategory error:', err);
    res.status(500).json({ message: 'Serverfeil ved oppdatering av underkategori' });
  }
});

// @route   DELETE api/categories/:id/subcategories/:name
// @desc    Delete a subcategory
// @access  Private (admin only)
router.delete('/:id/subcategories/:name', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin' && req.user.role !== 'it_ansvarlig') {
      return res.status(403).json({ message: 'Ikke tilgang til å slette underkategorier' });
    }
    
    const { name } = req.params;
    
    // Check if subcategory has documents
    const documentsCount = await Document.countDocuments({ 
      category: req.params.id, 
      subcategory: name 
    });
    
    if (documentsCount > 0) {
      return res.status(400).json({ 
        message: 'Kan ikke slette underkategori som inneholder dokumenter. Flytt eller slett dokumentene først.' 
      });
    }
    
    // Find category
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Kategori ikke funnet' });
    }
    
    // Find subcategory
    const subcategoryIndex = category.subcategories.findIndex(sub => sub.name === name);
    if (subcategoryIndex === -1) {
      return res.status(404).json({ message: 'Underkategori ikke funnet' });
    }
    
    // Remove subcategory
    category.subcategories.splice(subcategoryIndex, 1);
    category.updatedAt = Date.now();
    
    // Save category
    const updatedCategory = await category.save();
    
    res.json(updatedCategory);
  } catch (err) {
    console.error('Delete subcategory error:', err);
    res.status(500).json({ message: 'Serverfeil ved sletting av underkategori' });
  }
});

module.exports = router;
