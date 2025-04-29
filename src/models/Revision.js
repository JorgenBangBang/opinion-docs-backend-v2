const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const RevisionSchema = new Schema({
  document: {
    type: Schema.Types.ObjectId,
    ref: 'Document',
    required: true
  },
  version: {
    type: Number,
    required: true
  },
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
  changes: {
    type: String,
    default: ''
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Revision', RevisionSchema);
