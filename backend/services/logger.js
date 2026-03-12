const fs = require('fs');
const path = require('path');

const LOGS_DIR = path.join(__dirname, '../logs');

// Ensure logs directory exists
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

/**
 * Write a message to a specific log file.
 * @param {string} fileName 
 * @param {string} message 
 */
function writeLog(fileName, message) {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${message}\n`;
  const filePath = path.join(LOGS_DIR, fileName);
  
  fs.appendFile(filePath, logLine, (err) => {
    if (err) {
      console.error(`Failed to write to log file: ${filePath}`, err);
    }
  });
}

/**
 * Logs an access request.
 * @param {import('express').Request} req 
 */
function logAccess(req) {
  const { method, originalUrl, ip } = req;
  const userAgent = req.get('User-Agent') || 'unknown';
  const message = `${method} ${originalUrl} - IP: ${ip} - UA: ${userAgent}`;
  writeLog('access.log', message);
}

/**
 * Logs a post edit or delete action.
 * @param {string} action - 'EDIT' or 'DELETE'
 * @param {string} target - e.g. 'post', 'blog', 'news'
 * @param {string|number} id - The ID of the item
 * @param {object} details - Additional info
 */
function logAction(action, target, id, details = {}) {
  const detailStr = Object.keys(details).length ? ` - Details: ${JSON.stringify(details)}` : '';
  const message = `${action} - Target: ${target} - ID: ${id}${detailStr}`;
  writeLog('post_actions.log', message);
}

module.exports = {
  logAccess,
  logAction
};
