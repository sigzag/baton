"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;
Object.defineProperty(exports, "nodeInterface", {
  enumerable: true,
  get: function () {
    return _core.nodeInterface;
  }
});
exports.resolveType = exports.toNode = void 0;

var _core = _interopRequireWildcard(require("../core"));

var _lodash = require("lodash");

var resolvers = _interopRequireWildcard(require("./resolvers"));

var mutators = _interopRequireWildcard(require("./mutators"));

var _mongoose = require("mongoose");

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : {}; if (desc.get || desc.set) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } } newObj.default = obj; return newObj; } }

function _toArray(arr) { return _arrayWithHoles(arr) || _iterableToArray(arr) || _nonIterableRest(); }

function _iterableToArray(iter) { if (Symbol.iterator in Object(iter) || Object.prototype.toString.call(iter) === "[object Arguments]") return Array.from(iter); }

function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _nonIterableRest(); }

function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance"); }

function _iterableToArrayLimit(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; var ownKeys = Object.keys(source); if (typeof Object.getOwnPropertySymbols === 'function') { ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) { return Object.getOwnPropertyDescriptor(source, sym).enumerable; })); } ownKeys.forEach(function (key) { _defineProperty(target, key, source[key]); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

const resolveObject = resolvers.resolveObject,
      resolveProperty = resolvers.resolveProperty,
      resolveJSON = resolvers.resolveJSON,
      resolveList = resolvers.resolveList,
      resolveConnection = resolvers.resolveConnection,
      resolvePropertyConnection = resolvers.resolvePropertyConnection,
      resolveType = resolvers.resolveType,
      toNode = resolvers.toNode;
exports.toNode = toNode;
exports.resolveType = resolveType;

function paths(schema) {
  return _objectSpread({}, schema.virtuals, schema.paths);
}

function pathPairs(paths, skip) {
  const result = [];
  const schemas = {};
  if (paths.constructor.name === 'EmbeddedDocument' || paths.constructor.name === 'SchemaType') paths = paths.schema.paths;

  for (let _ref of (0, _lodash.toPairs)(paths)) {
    var _ref2 = _slicedToArray(_ref, 2);

    let name = _ref2[0];
    let path = _ref2[1];
    if (skip && ~skip.indexOf(name)) continue;

    if (~name.indexOf('.')) {
      const _name$split = name.split('.'),
            _name$split2 = _toArray(_name$split),
            head = _name$split2[0],
            tail = _name$split2.slice(1);

      if (!schemas[head]) result.push([head, schemas[head] = {}]);
      schemas[head][tail.join('.')] = path;
    } else result.push([name, path]);
  }

  return result;
}

function isUnion(model) {
  return model.schema.discriminatorMapping && model.schema.discriminatorMapping.isRoot;
}

function generateModel(paths, getModel, skip) {
  return {
    fields: pathPairs(paths, skip).map(([name, path]) => getField(name, path, getModel, skip))
  };
}

function generateNodeType(source, name = source.modelName) {
  if (!name) throw new Error(`Missing name for ${source}`);
  const paths = (0, _lodash.isPlainObject)(source) ? Object.entries(source) : [...Object.entries(source.paths), ...Object.entries(source.virtuals)];
  return {
    name,
    source,
    paths,
    fields: fields(paths),
    interfaces: source.baseModelName ? [source.baseModelName] : [],
    resolveType
  };
  return {
    name,
    fields: (0, _lodash.isPlainObject)(schema) ? Object.entries(schema) : [...Object.entries(schema.paths), ...Object.entries(schema.virtuals)]
  };
}
/*
ObjectId	=>	ObjectId							=>	.options.ref ? node : id
[ObjectId]	=>	SchemaArray							=>	.caster.options.ref ? [node] : [id]
			
{}			=>	{}	(paths basically)				=>	is schema => *node
Schema		=>	SchemaType							=>	.schema => *node

[{}]		=>	DocumentArray [EmbeddedDocument]	=>	.schema => [*node]
[Schema]	=>	DocumentArray [EmbeddedDocument]	=>	.schema => [*node]

Mixed		=>	Mixed								=>	JSON
[Mixed]		=>	SchemaArray [Mixed]					=>	JSON

*/


function getKind(path) {
  if ((0, _lodash.isPlainObject)(path)) return 'object';else if (path.enumValues && path.enumValues.length) return 'enum';else switch (path.constructor.name) {
    case 'ObjectId':
      return 'node';

    case 'DocumentArray':
    case 'SchemaArray':
      if (path.caster.options && path.caster.options.connection) return 'connection';else return 'list';

    case 'EmbeddedDocument':
    case 'SchemaType':
      return 'object';

    case 'SchemaNumber':
      return 'number';

    case 'SchemaBoolean':
      return 'boolean';

    case 'SchemaDate':
      return 'date';

    default:
      return 'string';
  }
}

function getField(name, path, getModel, skip) {
  console.log(path);
  if ((0, _lodash.isPlainObject)(path)) return {
    name,
    type: {
      kind: 'object',
      model: generateModel(path, getModel, skip)
    },
    resolve: resolveProperty(name)
  };else if (path.enumValues && path.enumValues.length) return {
    name,
    type: {
      kind: 'enum',
      values: path.enumValues
    },
    resolve: resolveProperty(name)
  };else if (path.options && path.options.json) return {
    name,
    type: {
      kind: 'json'
    },
    diff: true,
    resolve: resolveProperty(name, path.options.transform)
  };else if (path.node || path.options && path.options.node) return {
    name,
    type: {
      kind: 'node',
      model: getModel(path.node || path.options.ref)
    },
    resolve: resolveObject(name, getModel(path.node && path.options.ref).source)
  };else if (path.list || path.caster && path.caster.options && path.caster.options.list) return {
    name,
    type: {
      kind: 'list',
      model: {
        kind: 'node',
        model: getModel(path.list && path.caster.options.ref)
      }
    },
    resolve: resolveList(name, getModel(path.list && path.caster.options.ref).source)
  };else if (path.connection || path.caster && path.caster.options && path.caster.options.connection) {
    let model = getModel(path.connection);
    return {
      name,
      type: {
        kind: 'connection',
        model: model || generateModel(paths(path.caster.options.connection), getModel, skip)
      },
      resolve: resolvePropertyConnection(name, model && model.source, path.caster.options.args)
    };
  } else switch (path.constructor.name) {
    case 'ObjectId':
      return {
        name,
        type: {
          kind: 'node',
          model: getModel(path.options.ref)
        },
        resolve: resolveObject(name, getModel(path.options.ref).source)
      };

    case 'DocumentArray':
    case 'SchemaArray':
      if (Object.values(_mongoose.Schema.Types).find(type => path.caster instanceof type)) return {
        name,
        type: {
          kind: 'list',
          model: getKind(path.caster)
        },
        resolve: resolveProperty(name)
      };
      return {
        name,
        type: {
          kind: 'list',
          model: getKind(path.caster) === 'object' ? generateModel(paths(path.caster.schema), getModel, skip) : {
            kind: getKind(path.caster),
            model: getModel(path.caster.options && path.caster.options.ref)
          }
        },
        resolve: resolveProperty(name)
      };

    case 'EmbeddedDocument':
    case 'SchemaType':
      return {
        name,
        type: {
          kind: 'object',
          model: generateModel(paths(path.schema), getModel, skip)
        },
        resolve: resolveProperty(name)
      };

    default:
      return {
        name,
        type: {
          kind: getKind(path)
        },
        resolve: resolveProperty(name)
      };
  }
}

function _default(models, options = {}) {
  const skip = ['_id', '__v', '__t', 'id', ...(options.skip || [])];
  models = models.map(source => ({
    source,
    name: source.modelName,
    fields: [],
    indexes: pathPairs(paths(source.schema), skip).filter(([, path]) => path && path.options && path.options.index).reduce((indexes, [name, path]) => _objectSpread({}, indexes, {
      [name]: {
        kind: getKind(path)
      }
    }), {}),
    interfaces: source.baseModelName ? [source.baseModelName] : [],
    resolveType: isUnion(source) && resolveType
  }));

  for (let _ref3 of models) {
    let source = _ref3.source;
    let indexes = _ref3.indexes;
    source.resolve = resolveConnection(source, indexes);
  }

  const getModel = name => {
    const res = models.find(model => model.name === name);
    if (!res) throw new Error(`Model ${name} not found`);
    return res;
  };

  for (let _ref4 of models) {
    let schema = _ref4.source.schema;
    let fields = _ref4.fields;
    let indexes = _ref4.indexes;
    fields.push(...pathPairs(paths(schema), skip).map(([name, path]) => getField(name, path, getModel, skip)));
  }

  return (0, _core.default)(models, _objectSpread({
    resolvers,
    mutators
  }, options));
}