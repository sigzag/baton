"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

var _mongoose = _interopRequireDefault(require("mongoose"));

var _util = require("../util");

var _resolve = require("../provider/mongoose/resolve");

var _graphqlRelay = require("graphql-relay");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; var ownKeys = Object.keys(source); if (typeof Object.getOwnPropertySymbols === 'function') { ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) { return Object.getOwnPropertyDescriptor(source, sym).enumerable; })); } ownKeys.forEach(function (key) { _defineProperty(target, key, source[key]); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _default(schema, options = {}) {
  const typename = options.typename,
        name = options.name,
        db = options.db;
  const model = db.model(name);

  function getQuery(rootValue, args, query) {
    return _objectSpread({}, typeof options.query === 'function' ? options.query(rootValue, args) : options.query || {}, typeof query === 'function' ? query(rootValue, args) : query || {});
  }

  function getArgs(rootValue, args, query) {
    return _objectSpread({}, args, getQuery(rootValue, args, query));
  }

  const resolver = (0, _resolve.resolveConnection)(model);

  schema.statics.resolve = function (args, query) {
    return resolver(null, getArgs(null, args, query));
  };

  schema.methods.toNode = function () {
    return transforms.reduce((node, path) => (_objectSpread({}, node, {
      path: transforms[path](this)
    }), {
      __typename: typename,
      id: (0, _graphqlRelay.toGlobalId)(typename, this._id)
    }));
  };

  const transforms = Object.keys(schema.paths).reduce((transforms, path) => {
    const isArray = schema.paths[path].instance === 'Array';

    const _ref = (isArray ? schema.paths[path].caster.options || schema.paths[path].options : schema.paths[path].options) || {},
          node = _ref.node,
          list = _ref.list,
          connection = _ref.connection,
          query = _ref.query;

    const model = _mongoose.default.model(connection || list || node);

    if (connection) transforms[path] = doc => async args => {
      const connection = (await doc.get(path)) || [];
      if (!model || !connection.length) return (0, _util.page)(connection, args);
      return model.find(getQuery(doc, args, {
        _id: {
          $in: connection
        }
      })).then(docs => docs.map(_resolve.toNode));
    };else if (list) transforms[path] = doc => async args => {
      const list = (await doc.get(path)) || [];
      if (!model || !list.length) return list;
      return model.find(getQuery(doc, args, {
        _id: {
          $in: list
        }
      })).then(docs => docs.map(_resolve.toNode));
    };else if (node) transforms[path] = doc => async args => {
      const node = await doc.get(path);
      if (!node || node instanceof model) return (0, _resolve.toNode)(node);
      return model.findById(node).then(_resolve.toNode);
    };else transforms[path] = doc => doc.get(path);
    return transforms;
  }, {});
}