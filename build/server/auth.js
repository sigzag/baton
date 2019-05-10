"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.auth = auth;

var _url = require("url");

var _crypto = require("crypto");

var _errors = require("../errors");

function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _nonIterableRest(); }

function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance"); }

function _iterableToArrayLimit(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

const defaultAlgorithm = 'aes-256';
const defaultInitVectorLength = 16; // for aes at least...

function keyFromSecret(secret) {
  const hash = (0, _crypto.createHash)('md5');
  hash.update('', 'hex');
  hash.update(secret);
  return hash.digest('hex').slice(0, 32);
}

function encrypt(data, algorithm, key, initVectorLength) {
  const initVector = (0, _crypto.randomBytes)(initVectorLength);
  const cipher = (0, _crypto.createCipheriv)(algorithm, key, initVector);
  return `${initVector.toString('hex')}:${cipher.update(JSON.stringify(data), 'utf8', 'hex') + cipher.final('hex')}`;
}

function decrypt(text, algorithm, key) {
  try {
    const _text$split = text.split(':'),
          _text$split2 = _slicedToArray(_text$split, 2),
          initVector = _text$split2[0],
          data = _text$split2[1];

    const decipher = (0, _crypto.createDecipheriv)(algorithm, key, new Buffer(initVector, 'hex'));
    return JSON.parse(decipher.update(data, 'hex', 'utf8') + decipher.final('utf8'));
  } catch (e) {
    throw new _errors.Unauthorized('Invalid token');
  }
}

function getToken(req) {
  let token;

  if (req.headers.authorization) {
    if (!req.headers.authorization.startsWith('Bearer ')) throw new _errors.Unauthorized('Format is authorization: Bearer [token]');
    token = req.headers.authorization.slice(7);
  } else {
    token = (0, _url.parse)(req.url, true).query['token'];
  }

  if (!token) throw new _errors.Unauthorized('Authorization header missing');
  return token;
} // Middleware


function auth({
  secret,
  algorithm = defaultAlgorithm,
  initVectorLength = defaultInitVectorLength
}) {
  const key = keyFromSecret(secret);
  return {
    authenticate(req, res, next) {
      req.token = decrypt(getToken(req), algorithm, key);
      if (req.token.expired) throw new _errors.ExpiredAccessToken();
      if (next) next();
      return req;
    },

    encryptToken(data) {
      return encrypt(data, algorithm, key, initVectorLength);
    }

  };
}