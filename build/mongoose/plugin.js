"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;
exports.buildSchema = buildSchema;

var _util = require("../util");

var _mongoose = require("mongoose");

var _graphqlRelay = require("graphql-relay");

var _toObjectId = _interopRequireDefault(require("./toObjectId"));

var _core = _interopRequireDefault(require("../schema/provider/core"));

var _getTypeDef = _interopRequireDefault(require("./getTypeDef"));

var resolvers = _interopRequireWildcard(require("../schema/provider/mongoose/resolvers"));

var mutators = _interopRequireWildcard(require("../schema/provider/mongoose/mutators"));

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : {}; if (desc.get || desc.set) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _nonIterableRest(); }

function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance"); }

function _iterableToArrayLimit(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; var ownKeys = Object.keys(source); if (typeof Object.getOwnPropertySymbols === 'function') { ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) { return Object.getOwnPropertyDescriptor(source, sym).enumerable; })); } ownKeys.forEach(function (key) { _defineProperty(target, key, source[key]); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function idFromCursor(cursor) {
  return (0, _graphqlRelay.fromGlobalId)(cursor).id;
}

function plainFromCursor(cursor) {
  return cursor;
}

function idToCursor(node) {
  return node.id;
}

function _default(schema, options = {}) {
  const typename = options.typename,
        _options$index = options.index,
        index = _options$index === void 0 ? '_id' : _options$index,
        fromCursor = options.fromCursor,
        toCursor = options.toCursor;

  function queryCondition(query, rootValue, args) {
    return _objectSpread({}, typeof options.query === 'function' ? options.query(rootValue, args) : options.query || {}, typeof query === 'function' ? query(rootValue, args) : query || {});
  }

  schema.statics.typename = typename;
  schema.virtual('id').get(function () {
    return (0, _graphqlRelay.toGlobalId)(typename, this._id);
  });

  schema.methods.toNode = function () {
    return this.toObject({
      node: true
    });
  };

  schema.methods.toEdge = function () {
    return edge(this.toNode(), getToCursor());
  };

  function plainToCursor(node) {
    return node[index];
  }

  ;

  function getFromCursor(options) {
    return options.fromCursor || fromCursor || index === '_id' && idFromCursor || plainFromCursor;
  }

  function getToCursor(options) {
    return options.toCursor || toCursor || index === '_id' && idToCursor || plainToCursor;
  }

  const interfaces = [];
  const indexes = schema.statics.indexes = schema.indexes().map(([index]) => ({
    name: Object.keys(index)[0],
    id: schema.path(Object.keys(index)[0]).instance === 'ObjectID'
  }));

  schema.statics.connection = schema.statics.resolve = async function connection(args, condition, options = {}) {
    const conditions = [];
    if (condition) conditions.push(condition);

    if (args) {
      for (let _ref of indexes) {
        let name = _ref.name;
        let id = _ref.id;

        if (Object.hasOwnProperty.call(args, name)) {
          if (Array.isArray(args[name])) conditions.push({
            [name]: {
              $in: id ? args[name].map(id => (0, _graphqlRelay.fromGlobalId)(id).id) : args[name]
            }
          });else conditions.push({
            [name]: id ? (0, _graphqlRelay.fromGlobalId)(args[name]).id : args[name]
          });
        }
      }
    }

    const before = args.before,
          after = args.after,
          first = args.first,
          last = args.last;
    const fromCursor = getFromCursor(options);
    if (after) conditions.push({
      [index]: {
        $gt: fromCursor(after)
      }
    });
    if (before) conditions.push({
      [index]: {
        $lt: fromCursor(before)
      }
    });
    const nodes = (await this.find({
      $and: conditions
    }, null, _objectSpread({
      sort: index
    }, options, {
      skip: first - last || 0,
      limit: last || first
    }))).map(_util.toNode);
    const toCursor = getToCursor(options);
    return (0, _util.page)(nodes, args, toCursor);
  };

  schema.statics.list = function list(ids, condition, options = {}) {
    const conditions = [];
    if (condition) conditions.push(condition);
    if (ids != null) conditions.push({
      _id: {
        $in: ids.map(_toObjectId.default)
      }
    });
    return this.find({
      $and: conditions
    }, null, _objectSpread({
      sort: index
    }, options)).then(docs => ids ? ids.map(id => docs.find(doc => String(doc._id) === String(id))) : docs).then(docs => docs.map(_util.toNode));
  };

  schema.statics.node = function node(id, condition, options = {}) {
    const conditions = [];
    if (condition) conditions.push(condition);

    if (id) {
      conditions.push({
        _id: (0, _toObjectId.default)(id)
      });
    }

    return this.findOne({
      $and: conditions
    }, null, _objectSpread({
      sort: index
    }, options)).then(_util.toNode);
  }; // Create class for toObject({ node: true }) transform


  function Class(doc) {
    this._doc = doc;
    this._id = doc._id;
    this.__typename = typename;
    this.id = (0, _graphqlRelay.toGlobalId)(typename, doc._id);

    this._get = function (name) {
      return doc.get(name);
    };

    return this;
  }

  for (let _ref2 of Object.entries(schema.paths)) {
    var _ref3 = _slicedToArray(_ref2, 2);

    let name = _ref3[0];
    let def = _ref3[1];
    if (name === '_id') continue;

    const _ref4 = (def.instance === 'Array' ? def.caster.options || def.options : def.options) || {},
          node = _ref4.node,
          list = _ref4.list,
          connection = _ref4.connection,
          query = _ref4.query,
          transform = _ref4.transform;

    if (connection) {
      Class.prototype[name] = async function (args, {
        db
      }) {
        const model = db.model(connection);
        const value = (await this._get(name)) || [];
        if (!model || !value.length) return (0, _util.page)((0, _util.slice)(value.map(_util.toNode), args), args);
        return model.connection(args, _objectSpread({}, queryCondition(query, this, args), {
          _id: {
            $in: value
          }
        }));
      };
    } else if (list) {
      Class.prototype[name] = async function (args, {
        db
      }) {
        const model = db.model(list);
        const value = (await this._get(name)) || [];
        if (!model || !value.length) return value;
        return model.list(value.map(_toObjectId.default), queryCondition(query, this, args));
      };
    } else if (node) {
      Class.prototype[name] = async function (args, {
        db
      }) {
        const model = db.model(node);
        const value = await this._get(name);
        if (!model || !value || value instanceof model) return (0, _util.toNode)(value);
        return model.node(value, queryCondition(query, this, args));
      };
    } else Object.defineProperty(Class.prototype, name, {
      get() {
        return Promise.resolve(this._get(name)).then(value => typeof transform === 'function' ? transform(value) : value);
      }

    });
  }

  for (let _ref5 of Object.entries(schema.virtuals)) {
    var _ref6 = _slicedToArray(_ref5, 2);

    let name = _ref6[0];
    let def = _ref6[1];
    if (name === 'id') continue;
    const get = def.getters.length && def.getters[0];

    if (get) {
      Class.prototype[name] = function (args, ctx, info) {
        return get.call(this._doc, args, ctx, info);
      };
    }
  }

  Object.defineProperty(Class, 'name', {
    value: typename,
    writable: false
  }); // Set the transform

  if (!schema.options.toObject) schema.options.toObject = {};
  const originalTransform = schema.options.toObject.transform;

  schema.options.toObject.transform = function (doc, object, options) {
    if (originalTransform) object = originalTransform(object);
    if (options && options.node) return new Class(doc, object);
    return object;
  };
}

function buildSchema(db, options) {
  const models = Object.values(db.models).filter(model => model.typename).map(model => (0, _getTypeDef.default)(model.schema, model.typename, model.baseModelName ? [model.baseModelName] : [], model.indexes));
  return (0, _core.default)(models, _objectSpread({
    resolvers,
    mutators
  }, options));
}