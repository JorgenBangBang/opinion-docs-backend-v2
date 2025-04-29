const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const DocumentSchema = new Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  category: {
    type: Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  subcategory: {
    type: String,
    required: true
  },
  tags: [{
    type: String
  }],
  filePath: {
    type: String,
    required: true
  },
  fileName: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  fileType: {
    type: String,
    required: true
  },
  uploadedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastModifiedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reviewDate: {
    type: Date,
    default: () => new Date(+new Date() + 365*24*60*60*1000) // Default to 1 year from now
  },
  status: {
    type: String,
    enum: ['active', 'archived', 'deleted'],
    default: 'active'
  },
  version: {
    type: Number,
    default: 1
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field before saving
DocumentSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Add text index for search functionality
DocumentSchema.index({ 
  title: 'text', 
  description: 'text', 
  tags: 'text',
  subcategory: 'text'
});

module.exports = mongoose.model('Document', DocumentSchema);
