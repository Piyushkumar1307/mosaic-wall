import { v2 as cloudinary } from "cloudinary";

function getConfig() {
  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
  const api_key = process.env.CLOUDINARY_API_KEY;
  const api_secret = process.env.CLOUDINARY_API_SECRET;

  if (!cloud_name || !api_key || !api_secret) {
    throw new Error(
      "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET."
    );
  }

  return { cloud_name, api_key, api_secret };
}

export async function uploadPhoto(dataUrl: string): Promise<string> {
  const config = getConfig();
  cloudinary.config(config);

  const result = await cloudinary.uploader.upload(dataUrl, {
    folder: "mosaicwall",
    resource_type: "image",
  });

  return result.secure_url;
}
