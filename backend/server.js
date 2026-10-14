require('dotenv').config();

const mongoose = require('mongoose');
const app = require('./app');

if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET is missing');
    process.exit(1);
}

if (!process.env.MONGO_URI) {
    console.error('MONGO_URI is missing');
    process.exit(1);
}

const PORT = process.env.PORT || 5000;

async function startServer() {
    try {
        await mongoose.connect(process.env.MONGO_URI);

        console.log('MongoDB connected successfully');

        app.listen(PORT, '0.0.0.0', () => {
            console.log(`API running on port ${PORT}`);
        });
    } catch (err) {
        console.error('Startup failed:', err.message);
        process.exit(1);
    }
}

startServer();