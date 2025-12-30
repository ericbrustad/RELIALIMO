import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

// A list of your html files without the extension
const routes = [
    'my-office',
    'index-reservations',
    'confirmed-reservation',
    'reservation-form',
    'accounts',
    'calendar',
    'quotes',
    'reservations-list',
    'dispatch-grid',
    'network',
    'settle',
    'receivables',
    'payables',
    'memos',
    'files',
    'reports',
    'dashboard'
];

// Serve static files from the root directory
app.use(express.static(path.join(__dirname)));

// Dynamically create routes for each html file
routes.forEach(route => {
    app.get(`/${route}`, (req, res) => {
        res.sendFile(path.join(__dirname, `${route}.html`));
    });
});

// Fallback to index.html for any other request
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});

