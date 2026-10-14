const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const errorHandler = require('./middleware/error');
const { UPLOAD_DIR } = require('./config/paths');

const app = express();

const origins = (process.env.CLIENT_ORIGIN || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

app.use(helmet({
    crossOriginResourcePolicy: {
        policy: 'cross-origin'
    }
}));

app.use(cors({
    origin: origins.length ? origins : true
}));

app.use(express.json({
    limit: '1mb'
}));

app.use('/uploads', express.static(UPLOAD_DIR, {
    setHeaders(res, file) {
        if (/\.html?$/i.test(file)) {
            res.setHeader('Content-Disposition', 'attachment');
        }
    }
}));

app.get('/api/health', (req, res) => {
    res.json({ ok: true });
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/books', require('./routes/books'));
app.use('/api/reader', require('./routes/reader'));

app.use((req, res) => {
    res.status(404).json({
        message: 'Route not found'
    });
});

app.use(errorHandler);

module.exports = app;