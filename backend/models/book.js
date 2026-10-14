const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    author: { type: String, required: true, trim: true, index: true },
    genre: { type: String, trim: true, index: true },
    publisher: { type: String, trim: true },
    date: { type: Date },
    link: { type: String, required: true, trim: true }, 
    fileType: { type: String, enum: ['pdf', 'epub', 'txt', 'md', 'html', 'other'], default: 'pdf' },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

bookSchema.index({ name: 'text', author: 'text', genre: 'text' });

module.exports = mongoose.model('Book', bookSchema);
