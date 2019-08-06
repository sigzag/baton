"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.errorHandler = errorHandler;
exports.ServiceUnavailable = exports.NotReady = exports.NotFound = exports.ExpiredAccessToken = exports.Unauthorized = exports.HTTPError = exports.ExtendableError = void 0;

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

const ExtendableError = function ExtendableError(message) {
  Error.captureStackTrace(this, this.constructor);
  this.name = this.constructor.name;
  this.message = message;
};

exports.ExtendableError = ExtendableError;
ExtendableError.prototype = Object.create(Error.prototype);

class HTTPError extends ExtendableError {
  toJSON() {
    return {
      status: this.status,
      message: this.message
    };
  }

}

exports.HTTPError = HTTPError;

class Unauthorized extends HTTPError {
  constructor(...args) {
    super(...args);

    _defineProperty(this, "message", 'Unauthorized');

    _defineProperty(this, "status", 401);
  }

}

exports.Unauthorized = Unauthorized;

class ExpiredAccessToken extends HTTPError {
  constructor(...args) {
    super(...args);

    _defineProperty(this, "message", 'Invalid access token');

    _defineProperty(this, "status", 467);
  }

}

exports.ExpiredAccessToken = ExpiredAccessToken;

class NotFound extends HTTPError {
  constructor(...args) {
    super(...args);

    _defineProperty(this, "message", 'Not found');

    _defineProperty(this, "status", 404);
  }

}

exports.NotFound = NotFound;

class NotReady extends HTTPError {
  constructor(...args) {
    super(...args);

    _defineProperty(this, "message", 'Not ready');

    _defineProperty(this, "status", 503);
  }

}

exports.NotReady = NotReady;

class ServiceUnavailable extends HTTPError {
  constructor(...args) {
    super(...args);

    _defineProperty(this, "message", 'Service unavailable');

    _defineProperty(this, "status", 503);
  }

}

exports.ServiceUnavailable = ServiceUnavailable;

function errorHandler(captureException) {
  return function errorHandler(err, req, res) {
    if (err instanceof HTTPError) {
      res.status(err.status).send(err.message);
    } else {
      if (captureException) captureException(err);
      res.status(500).send(err.message);
    }
  };
}