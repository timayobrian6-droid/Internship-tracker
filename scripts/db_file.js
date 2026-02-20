const path = require('path');

const root = path.resolve(__dirname, '..');
const configured = (process.env.DB_FILE || 'internship_final.db').toString().trim();

const dbFile = path.isAbsolute(configured)
  ? configured
  : path.join(root, configured);

module.exports = { dbFile };
