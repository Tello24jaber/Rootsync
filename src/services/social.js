'use strict';

const UPLOAD_POST_API_KEY = process.env.UPLOAD_POST_API_KEY;
const UPLOAD_POST_USER = 'talal';

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

  // Dynamic import required because upload-post is an ES module
  const { UploadPost } = await import('upload-post');

  const uploader = new UploadPost(UPLOAD_POST_API_KEY);

  const result = await uploader.upload(filePath, {
    title,
    user: UPLOAD_POST_USER,
    platforms,
  });

  return result;
}

module.exports = { uploadToSocial };
