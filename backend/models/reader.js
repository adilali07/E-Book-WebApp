const mongoose = require('mongoose');

const bookmarkSchema = new mongoose.Schema(
  {
    page: { type: Number, required: true, min: 0 },
    note: { type: String, trim: true, maxlength: 300 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

// One reading record per user per book
const readerSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
    page: { type: Number, default: 0, min: 0 }, // last page read
    bookmarks: { type: [bookmarkSchema], default: [] },
  },
  { timestamps: true }
);

readerSchema.index({ userId: 1, bookId: 1 }, { unique: true });

module.exports = mongoose.model('Reader', readerSchema);
