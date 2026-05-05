'use strict';

function _typeof(obj) { if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function _getRequireWildcardCache() { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

var UPLOAD_POST_API_KEY = process.env.UPLOAD_POST_API_KEY;
var UPLOAD_POST_USER = 'talal';
/**
 * Upload a video or image to one or more social platforms.
 *
 * @param {string} filePath   - Absolute or relative path to the media file
 * @param {object} options
 * @param {string} options.title       - Post caption / title
 * @param {string[]} [options.platforms] - e.g. ['instagram']. Defaults to ['instagram']
 * @returns {Promise<object>} Result from upload-post API
 */

function uploadToSocial(filePath) {
  var _ref,
      title,
      _ref$platforms,
      platforms,
      _ref2,
      UploadPost,
      uploader,
      result,
      _args = arguments;

  return regeneratorRuntime.async(function uploadToSocial$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          _ref = _args.length > 1 && _args[1] !== undefined ? _args[1] : {}, title = _ref.title, _ref$platforms = _ref.platforms, platforms = _ref$platforms === void 0 ? ['instagram'] : _ref$platforms;

          if (UPLOAD_POST_API_KEY) {
            _context.next = 3;
            break;
          }

          throw new Error('UPLOAD_POST_API_KEY environment variable is not set');

        case 3:
          _context.next = 5;
          return regeneratorRuntime.awrap(Promise.resolve().then(function () {
            return _interopRequireWildcard(require('upload-post'));
          }));

        case 5:
          _ref2 = _context.sent;
          UploadPost = _ref2.UploadPost;
          uploader = new UploadPost(UPLOAD_POST_API_KEY);
          _context.next = 10;
          return regeneratorRuntime.awrap(uploader.upload(filePath, {
            title: title,
            user: UPLOAD_POST_USER,
            platforms: platforms
          }));

        case 10:
          result = _context.sent;
          return _context.abrupt("return", result);

        case 12:
        case "end":
          return _context.stop();
      }
    }
  });
}

module.exports = {
  uploadToSocial: uploadToSocial
};