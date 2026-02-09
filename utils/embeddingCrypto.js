// Utility for encrypting/decrypting face embeddings
const crypto = require('crypto');

// Use environment variable for encryption key (32 bytes for AES-256)
// Convert hex string to buffer (64 hex chars = 32 bytes)
const ENCRYPTION_KEY = process.env.EMBEDDING_ENCRYPTION_KEY 
  ? Buffer.from(process.env.EMBEDDING_ENCRYPTION_KEY, 'hex')
  : crypto.randomBytes(32);
const IV_LENGTH = 16; // AES block size

/**
 * Encrypt face embedding array
 * @param {Array<number>} embedding - Face embedding array
 * @returns {string} Encrypted embedding as base64 string
 */
function encryptEmbedding(embedding) {
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    
    // Convert embedding array to JSON string
    const embeddingStr = JSON.stringify(embedding);
    
    let encrypted = cipher.update(embeddingStr, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Combine IV and encrypted data
    const combined = iv.toString('hex') + ':' + encrypted;
    
    return combined;
  } catch (error) {
    console.error('❌ Encryption error:', error);
    throw new Error('Failed to encrypt embedding');
  }
}

/**
 * Decrypt face embedding
 * @param {string} encryptedData - Encrypted embedding string
 * @returns {Array<number>} Decrypted face embedding array
 */
function decryptEmbedding(encryptedData) {
  try {
    const parts = encryptedData.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    // Parse JSON back to array
    return JSON.parse(decrypted);
  } catch (error) {
    console.error('❌ Decryption error:', error);
    throw new Error('Failed to decrypt embedding');
  }
}

/**
 * Hash embedding for additional security layer (one-way)
 * This can be used for quick duplicate detection
 * @param {Array<number>} embedding - Face embedding array
 * @returns {string} SHA-256 hash of embedding
 */
function hashEmbedding(embedding) {
  const embeddingStr = JSON.stringify(embedding);
  return crypto.createHash('sha256').update(embeddingStr).digest('hex');
}

module.exports = {
  encryptEmbedding,
  decryptEmbedding,
  hashEmbedding
};
