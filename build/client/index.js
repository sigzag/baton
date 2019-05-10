"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
var _exportNames = {
  createEnvironment: true,
  QueryContainer: true
};
Object.defineProperty(exports, "createEnvironment", {
  enumerable: true,
  get: function () {
    return _environment.default;
  }
});
Object.defineProperty(exports, "QueryContainer", {
  enumerable: true,
  get: function () {
    return _QueryContainer.default;
  }
});

var _environment = _interopRequireDefault(require("./environment"));

var _QueryContainer = _interopRequireDefault(require("./QueryContainer"));

var _createRootContainer = require("./createRootContainer");

Object.keys(_createRootContainer).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (Object.prototype.hasOwnProperty.call(_exportNames, key)) return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function () {
      return _createRootContainer[key];
    }
  });
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }