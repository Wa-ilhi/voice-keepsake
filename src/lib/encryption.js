import CryptoJS from 'crypto-js';

// Derive encryption key from PIN (client-side only)
export function deriveKeyFromPin(pin, salt) {
  // Use PBKDF2 to derive a strong key from the PIN
  return CryptoJS.PBKDF2(pin, salt, {
    keySize: 256/32,
    iterations: 100000 // High iteration count for security
  }).toString();
}

// Generate a random salt for each keepsake
export function generateSalt() {
  return CryptoJS.lib.WordArray.random(128/8).toString();
}

// Encrypt audio blob with PIN-derived key
export async function encryptAudioBlob(audioBlob, encryptionKey) {
  try {
    // Convert blob to base64
    const arrayBuffer = await audioBlob.arrayBuffer();
    const wordArray = CryptoJS.lib.WordArray.create(arrayBuffer);
    const base64 = CryptoJS.enc.Base64.stringify(wordArray);
    
    // Encrypt the base64 string with AES-256
    const encrypted = CryptoJS.AES.encrypt(base64, encryptionKey).toString();
    
    // Convert encrypted string back to blob
    const encryptedBlob = new Blob([encrypted], { type: 'application/octet-stream' });
    return encryptedBlob;
  } catch (error) {
    console.error('Encryption error:', error);
    throw error;
  }
}

// Decrypt audio blob with PIN-derived key
export async function decryptAudioBlob(encryptedBlob, encryptionKey) {
  try {
    // Read encrypted blob as text
    const encryptedText = await encryptedBlob.text();
    
    // Decrypt with AES-256
    const decrypted = CryptoJS.AES.decrypt(encryptedText, encryptionKey);
    const base64 = decrypted.toString(CryptoJS.enc.Utf8);
    
    if (!base64) {
      throw new Error('Decryption failed - incorrect PIN');
    }
    
    // Convert base64 back to blob
    const wordArray = CryptoJS.enc.Base64.parse(base64);
    const arrayBuffer = wordArrayToArrayBuffer(wordArray);
    const audioBlob = new Blob([arrayBuffer], { type: 'audio/webm' });
    
    return audioBlob;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt audio. Incorrect PIN?');
  }
}

// Helper function to convert WordArray to ArrayBuffer
function wordArrayToArrayBuffer(wordArray) {
  const arrayOfWords = wordArray.hasOwnProperty("words") ? wordArray.words : [];
  const length = wordArray.hasOwnProperty("sigBytes") ? wordArray.sigBytes : arrayOfWords.length * 4;
  const uInt8Array = new Uint8Array(length);
  let index = 0, word, i;
  
  for (i = 0; i < length; i++) {
    word = arrayOfWords[i];
    uInt8Array[index++] = word >> 24;
    uInt8Array[index++] = (word >> 16) & 0xff;
    uInt8Array[index++] = (word >> 8) & 0xff;
    uInt8Array[index++] = word & 0xff;
  }
  
  return uInt8Array.buffer;
}