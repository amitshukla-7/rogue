/**
 * Client-Side Image Upload & Compression Helper
 * Handles base64 conversion and Cloudinary / Supabase Storage uploads.
 */

export interface UploadOptions {
  maxWidth?: number;
  quality?: number;
}

/**
 * Reads a File object and compresses it to a Data URL (base64) string
 */
export const compressAndReadFile = (file: File, options: UploadOptions = {}): Promise<string> => {
  const { maxWidth = 1000, quality = 0.8 } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve(img.src);
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

/**
 * Uploads an image to Cloudinary (Free Tier) if CLOUDINARY_PRESET is configured,
 * otherwise falls back to local compressed base64 string.
 */
export const uploadImage = async (file: File): Promise<string> => {
  const compressedBase64 = await compressAndReadFile(file);
  
  const cloudinaryPreset = process.env.NEXT_PUBLIC_CLOUDINARY_PRESET;
  const cloudinaryCloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

  if (cloudinaryPreset && cloudinaryCloudName) {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', cloudinaryPreset);

      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/image/upload`, {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        return data.secure_url;
      }
    } catch (err) {
      console.warn('Cloudinary upload failed, falling back to compressed base64:', err);
    }
  }

  return compressedBase64;
};
