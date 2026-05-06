'use strict';

const UPLOAD_POST_API_KEY = process.env.UPLOAD_POST_API_KEY;
const UPLOAD_POST_USER = process.env.UPLOAD_POST_USER;
const SUPPORTED_SOCIAL_PLATFORMS = ['instagram', 'tiktok', 'facebook'];

function normalizePlatforms(platforms) {
  const requested = Array.isArray(platforms) ? platforms : ['instagram'];
  const normalized = [...new Set(
    requested
      .map(p => String(p || '').trim().toLowerCase())
      .filter(Boolean)
  )];

  const finalList = normalized.length ? normalized : ['instagram'];
  const unsupported = finalList.filter(p => !SUPPORTED_SOCIAL_PLATFORMS.includes(p));
  if (unsupported.length) {
    throw new Error(
      `Unsupported platform(s): ${unsupported.join(', ')}. Supported platforms: ${SUPPORTED_SOCIAL_PLATFORMS.join(', ')}`
    );
  }

  return finalList;
}

/**
 * Upload a video or image to one or more social platforms.
 *
 * @param {string} filePath   - Absolute or relative path to the media file
 * @param {object} options
 * @param {string} options.title       - Post caption / title
 * @param {string[]} [options.platforms] - e.g. ['instagram']. Defaults to ['instagram']
 * @returns {Promise<object>} Result from upload-post API
 */
async function uploadToSocial(filePath, { title, platforms = ['instagram'] } = {}) {
  if (!UPLOAD_POST_API_KEY) {
    throw new Error('UPLOAD_POST_API_KEY environment variable is not set');
  }
  if (!UPLOAD_POST_USER) {
    throw new Error('UPLOAD_POST_USER environment variable is not set');
  }

  const normalizedPlatforms = normalizePlatforms(platforms);

  // Dynamic import required because upload-post is an ES module
  const { UploadPost } = await import('upload-post');

  const uploader = new UploadPost(UPLOAD_POST_API_KEY);

  const result = await uploader.upload(filePath, {
    title,
    user: UPLOAD_POST_USER,
    platforms: normalizedPlatforms,
  });

  return result;
}

module.exports = { uploadToSocial, SUPPORTED_SOCIAL_PLATFORMS };
