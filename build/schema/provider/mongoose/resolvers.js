"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.resolveProperty = resolveProperty;
exports.resolveObject = resolveObject;
exports.resolvePropertyObject = resolvePropertyObject;
exports.resolveList = resolveList;
exports.resolveConnection = resolveConnection;
exports.resolvePropertyConnection = resolvePropertyConnection;
exports.resolveNode = resolveNode;
exports.resolveType = resolveType;

var _mongoose = require("mongoose");

var _lodash = require("lodash");

var _graphqlRelay = require("graphql-relay");

var _util = require("../../../util");

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; var ownKeys = Object.keys(source); if (typeof Object.getOwnPropertySymbols === 'function') { ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) { return Object.getOwnPropertyDescriptor(source, sym).enumerable; })); } ownKeys.forEach(function (key) { _defineProperty(target, key, source[key]); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _objectWithoutProperties(source, excluded) { if (source == null) return {}; var target = _objectWithoutPropertiesLoose(source, excluded); var key, i; if (Object.getOwnPropertySymbols) { var sourceSymbolKeys = Object.getOwnPropertySymbols(source); for (i = 0; i < sourceSymbolKeys.length; i++) { key = sourceSymbolKeys[i]; if (excluded.indexOf(key) >= 0) continue; if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue; target[key] = source[key]; } } return target; }

function _objectWithoutPropertiesLoose(source, excluded) { if (source == null) return {}; var target = {}; var sourceKeys = Object.keys(source); var key, i; for (i = 0; i < sourceKeys.length; i++) { key = sourceKeys[i]; if (excluded.indexOf(key) >= 0) continue; target[key] = source[key]; } return target; }

function resolveProperty(name, transform) {
  return transform ? async rootValue => transform((await rootValue[name]), _graphqlRelay.toGlobalId) : rootValue => rootValue[name];
}

function resolveObject(model) {
  return async function (rootValue, args, context, info) {
    return model.findById((await rootValue[name])).then(_util.toNode);
  };
}

function resolvePropertyObject(name, model) {
  return async function (rootValue, args, context, info) {
    return model.findById((await rootValue[name])).then(_util.toNode);
  };
}

function resolveList(name, model) {
  return async function (rootValue, args, context, info) {
    const value = (await rootValue[name]) || [];
    return model.find({
      _id: {
        $in: value
      }
    }).then(objects => value.map(id => objects.find(node => String(node._id) === String(id)))).then(objects => objects.map(_util.toNode));
  };
}

function resolveConnection(model, indexes) {
  return async function (rootValue, args, context, info) {
    const before = args.before,
          after = args.after,
          first = args.first,
          last = args.last,
          ids = args.ids,
          query = _objectWithoutProperties(args, ["before", "after", "first", "last", "ids"]);

    if (indexes) for (let name in indexes) if (query.hasOwnProperty(name) && indexes[name].kind === 'node') query[name] = (0, _graphqlRelay.fromGlobalId)(query[name]).id;
    if (after) query._id = _objectSpread({}, query._id || {}, {
      $gt: after
    });
    if (before) query._id = _objectSpread({}, query._id || {}, {
      $lt: before
    });
    const nodes = (await model.find(query, null, {
      skip: first - last || 0,
      limit: last || first,
      sort: '_id'
    })).map(_util.toNode);
    return (0, _util.connection)(nodes, args, ({
      _id
    }) => _id);
  };
}

function resolvePropertyConnection(name, model, indexes) {
  const resolve = model && resolveConnection(model, indexes);
  return async function (rootValue, args, context, info) {
    const edges = (await rootValue[name]) || [];
    if (resolve) return resolve(rootValue, _objectSpread({}, args, {
      _id: {
        $in: edges
      }
    }));else return (0, _util.connection)(edges, args, ({
      _id
    }) => _id);
  };
}

function resolveNode(models, viewer) {
  return function (rootValue, args, context, info) {
    const _fromGlobalId = (0, _graphqlRelay.fromGlobalId)(args.id),
          id = _fromGlobalId.id,
          type = _fromGlobalId.type;

    if (type === 'viewer') return viewer;else return models.find(({
      name
    }) => name == type).source.findById(id).then(_util.toNode);
  };
}

function resolveType(objectTypes) {
  return function (value, context, info) {
    if (!value.__t) throw new Error(`no __t for ${value}`);
    return objectTypes[value.__t];
  };
}