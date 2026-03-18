const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const bucketName = process.env.SUPABASE_BUCKET || 'retro-site-uploads';

let supabase = null;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

const UPLOAD_DIR = path.join(__dirname, '../frontend/uploads');
if (!supabase && !fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/**
 * Upload a file to storage.
 * @param {string} fileName 
 * @param {Buffer} buffer 
 * @param {string} mimetype 
 * @returns {Promise<string>} - The public URL of the uploaded file
 */
async function uploadFile(fileName, buffer, mimetype) {
  if (supabase) {
    // --- Supabase Storage ---
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(fileName, buffer, {
        contentType: mimetype,
        upsert: true
      });

    if (error) {
      console.error('Supabase upload error:', error);
      throw new Error('Failed to upload to Supabase');
    }

    const { data: { publicUrl } } = supabase.storage
      .from(bucketName)
      .getPublicUrl(fileName);

    return publicUrl;
  } else {
    // --- Local Storage ---
    const filePath = path.join(UPLOAD_DIR, fileName);
    fs.writeFileSync(filePath, buffer);
    return `/uploads/${fileName}`;
  }
}

module.exports = {
  uploadFile,
  isCloud: !!supabase
};
