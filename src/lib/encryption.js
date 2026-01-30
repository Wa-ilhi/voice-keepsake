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

// ==================== TEXT ENCRYPTION ====================

// Encrypt text (for title and message)
export function encryptText(text, encryptionKey) {
  if (!text) return null;
  
  try {
    const encrypted = CryptoJS.AES.encrypt(text, encryptionKey).toString();
    return encrypted;
  } catch (error) {
    console.error("Text encryption error:", error);
    throw error;
  }
}

// Decrypt text (for title and message)
export function decryptText(encryptedText, encryptionKey) {
  if (!encryptedText) return null;
  
  try {
    const decrypted = CryptoJS.AES.decrypt(encryptedText, encryptionKey);
    const plaintext = decrypted.toString(CryptoJS.enc.Utf8);
    
    if (!plaintext) {
      throw new Error("Invalid PIN or corrupted data");
    }
    
    return plaintext;
  } catch (error) {
    console.error("Text decryption error:", error);
    throw error;
  }
}

// ==================== BINARY ENCRYPTION ====================

// Encrypt audio blob with PIN-derived key
// Encrypt binary data with PIN-derived key (mobile-safe)
export async function encryptAudioBlob(input, encryptionKey) {
  try {
    let arrayBuffer;

    // ✅ Normalize input
    if (input instanceof ArrayBuffer) {
      arrayBuffer = input;
    } else if (input instanceof Blob) {
      arrayBuffer = await input.arrayBuffer();
    } else if (input?.buffer instanceof ArrayBuffer) {
      arrayBuffer = input.buffer; // Uint8Array
    } else {
      throw new Error("Unsupported data type for encryption");
    }

    // Convert ArrayBuffer → WordArray
    const wordArray = CryptoJS.lib.WordArray.create(
      new Uint8Array(arrayBuffer)
    );

    // Convert to Base64
    const base64 = CryptoJS.enc.Base64.stringify(wordArray);

    // Encrypt Base64 string
    const encrypted = CryptoJS.AES.encrypt(
      base64,
      encryptionKey
    ).toString();

    // Return encrypted data as Blob
    return new Blob(
      [encrypted],
      { type: "application/octet-stream" }
    );

  } catch (error) {
    console.error("Encryption error:", error);
    throw error;
  }
}


// Decrypt audio blob with PIN-derived key
export async function decryptAudioBlob(encryptedBlob, encryptionKey, mimeType = "audio/webm") {
  // Read encrypted file as text
  const encryptedText = await encryptedBlob.text();

  // AES decrypt
  const decryptedBase64 = CryptoJS.AES.decrypt(
    encryptedText,
    encryptionKey
  ).toString(CryptoJS.enc.Utf8);

  if (!decryptedBase64) {
    throw new Error("Invalid PIN or corrupted audio");
  }

  // Base64 → WordArray
  const wordArray = CryptoJS.enc.Base64.parse(decryptedBase64);

  // WordArray → Uint8Array
  const byteArray = new Uint8Array(wordArray.sigBytes);
  for (let i = 0; i < wordArray.sigBytes; i++) {
    byteArray[i] = (wordArray.words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
  }

  // ✅ Restore audio blob WITH MIME TYPE
  return new Blob([byteArray], { type: mimeType });
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