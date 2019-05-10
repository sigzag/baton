"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;
exports.nodeInputType = exports.nodeInterface = void 0;

var _lodash = require("lodash");

var _type = require("graphql/type");

var _graphqlRelay = require("graphql-relay");

var _pluralize = _interopRequireDefault(require("pluralize"));

var _util = require("../../util");

var _Date = _interopRequireDefault(require("../scalars/Date"));

var _JSON = _interopRequireDefault(require("../scalars/JSON"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; var ownKeys = Object.keys(source); if (typeof Object.getOwnPropertySymbols === 'function') { ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) { return Object.getOwnPropertyDescriptor(source, sym).enumerable; })); } ownKeys.forEach(function (key) { _defineProperty(target, key, source[key]); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

// Constants
const viewer = {
  _type: 'Viewer',
  id: 'viewer'
};
const idField = {
  name: 'id',
  type: new _type.GraphQLNonNull(_type.GraphQLID)
};
const nullIdField = {
  name: 'id',
  type: _type.GraphQLID
};
const connectionNameField = {
  name: 'connectionName',
  type: _type.GraphQLString
};

const _nodeDefinitions = (0, _graphqlRelay.nodeDefinitions)(null, obj => obj._type ? objectTypes[obj._type] : null),
      nodeInterface = _nodeDefinitions.nodeInterface;

exports.nodeInterface = nodeInterface;
const nodeInputType = new _type.GraphQLInputObjectType({
  name: 'NodeInput',
  fields: {
    id: nullIdField
  }
});
exports.nodeInputType = nodeInputType;
const INDEX = Symbol(); // Generate object type map

let objectTypes;
let connectionDefinition;

function generateObjectTypes(models, options) {
  objectTypes = {};
  connectionDefinition = {};
  const interfaceModels = models.filter(({
    resolveType
  }) => resolveType);
  const typeModels = models.filter(({
    resolveType
  }) => !resolveType);

  for (let _ref of interfaceModels) {
    let name = _ref.name;
    let resolveType = _ref.resolveType;
    objectTypes[name] = new _type.GraphQLInterfaceType({
      name: name,
      resolveType: resolveType(objectTypes),
      fields: {
        id: (0, _graphqlRelay.globalIdField)(name, ({
          id
        }) => id)
      }
    });
  }

  for (let _ref2 of typeModels) {
    let name = _ref2.name;
    let interfaces = _ref2.interfaces;
    objectTypes[name] = new _type.GraphQLObjectType({
      name: name,
      interfaces: [nodeInterface, ...interfaces.map(name => objectTypes[name])],
      fields: {
        id: (0, _graphqlRelay.globalIdField)(name, ({
          id
        }) => id)
      }
    });
  }

  for (let _ref3 of models) {
    let name = _ref3.name;
    let fields = _ref3.fields;
    connectionDefinition[name] = (0, _graphqlRelay.connectionDefinitions)({
      nodeType: objectTypes[name]
    });
  }

  for (let _ref4 of interfaceModels) {
    let name = _ref4.name;
    let fields = _ref4.fields;
    objectTypes[name]._typeConfig.fields = _objectSpread({}, getGraphQLFields(name, fields), {
      id: (0, _graphqlRelay.globalIdField)(name, obj => obj._id)
    });
  }

  for (let _ref5 of typeModels) {
    let name = _ref5.name;
    let fields = _ref5.fields;
    let interfaces = _ref5.interfaces;
    objectTypes[name]._typeConfig.fields = interfaces.map(name => models.find(model => model.name === name)).reduce((fields, model) => _objectSpread({}, fields, getGraphQLFields(name, model.fields)), _objectSpread({}, getGraphQLFields(name, fields), {
      id: (0, _graphqlRelay.globalIdField)(name, obj => obj._id)
    }));
  }
}

function getNodeType(name, resolveType) {
  if (!objectTypes[name]) {
    const nodeType = resolveType ? new _type.GraphQLInterfaceType({
      name,
      resolveType: resolveType(getNodeType)
    }) : new _type.GraphQLObjectType({
      name,
      interfaces: [],
      fields: {}
    });
    objectTypes[name] = nodeType;
    connectionDefinition[name] = (0, _graphqlRelay.connectionDefinitions)({
      nodeType
    });
  }

  return objectTypes[name];
}

function generateObjectType(model) {
  const nodeType = getNodeType(model.name, model.resolveType);

  nodeType._typeConfig.interfaces.push(...model.interfaces.map(getNodeType));

  model.interfaces.forEach(itf => Object.assign(objectType._typeConfig.fields, getGraphQLFields(model.name, itf.fields)));
  Object.assign(objectType._typeConfig.fields, getGraphQLFields(model.name, model.fields));
  return nodeType;
} // Generate/get sub-object types


function getObjectType(name, {
  fields
}) {
  name = `${name}Schema`;
  if (!objectTypes[name]) objectTypes[name] = new _type.GraphQLObjectType({
    name,
    fields: getGraphQLFields(name, fields)
  });
  return objectTypes[name];
}

function getObjectInputType(name, {
  fields
}) {
  name = `${name}InputSchema`;
  if (!objectTypes[name]) objectTypes[name] = new _type.GraphQLInputObjectType({
    name,
    fields: getGraphQLInputFields(name, fields)
  });
  return objectTypes[name];
} // Generate/get connection types


function getConnectionType(name, model) {
  if (connectionDefinition[model.name]) return connectionDefinition[model.name].connectionType;
  const connectionName = `${name}SchemaConnection`;

  if (!connectionDefinition[connectionName]) {
    const nodeType = getObjectType(name, model);
    connectionDefinition[connectionName] = (0, _graphqlRelay.connectionDefinitions)({
      nodeType
    });
  }

  return connectionDefinition[connectionName].connectionType;
} // Fields


function getGraphQLFields(rootName, fields) {
  return fields.reduce((fields, field) => {
    const fieldName = `${rootName}${(0, _util.capitalize)(field.name)}`;
    fields[field.name] = {
      name: fieldName,
      type: getGraphQLType(fieldName, field.type),
      args: getGraphQLArgs(fieldName, field.type),
      resolve: field.resolve,
      source: field
    };
    return fields;
  }, {});
}

function getGraphQLInputFields(rootName, fields) {
  return fields.reduce((fields, {
    name,
    type
  }) => {
    const fieldName = `${rootName}${(0, _util.capitalize)(name)}`;
    if (type.kind !== 'connection') fields[name] = {
      name: fieldName,
      type: getGraphQLInputType(fieldName, type)
    };
    return fields;
  }, {});
}

function getGraphQLType(name, {
  kind,
  model,
  values
}) {
  switch (kind) {
    case 'list':
      return new _type.GraphQLList(getGraphQLType(name, model));

    case 'connection':
      return getConnectionType(model.name || name, model);

    case 'node':
      return objectTypes[model.name] || nodeInterface;

    case 'object':
      return getObjectType(model.name || name, model);

    case 'enum':
      return new _type.GraphQLEnumType({
        name,
        values: values.reduce((values, value) => _objectSpread({}, values, {
          [value]: {
            value
          }
        }), {})
      });

    default:
      return getGraphQLScalarType({
        kind
      });
  }
}

function getGraphQLInputType(name, {
  kind,
  model,
  values
}) {
  switch (kind) {
    case 'list':
      return new _type.GraphQLList(getGraphQLInputType(name, model));

    case 'node':
      if (name === INDEX) return _type.GraphQLID;else return nodeInputType;

    case 'object':
      return getObjectInputType(model.name || name, model);

    case 'enum':
      return new _type.GraphQLEnumType({
        name,
        values: values.reduce((values, value) => _objectSpread({}, values, {
          [value]: {
            value
          }
        }), {})
      });

    default:
      return getGraphQLScalarType({
        kind
      });
  }
}

function getGraphQLScalarType({
  kind
}) {
  switch (kind) {
    case 'number':
      return _type.GraphQLFloat;

    case 'boolean':
      return _type.GraphQLBoolean;

    case 'date':
      return _Date.default;

    case 'json':
      return _JSON.default;

    default:
      return _type.GraphQLString;
  }
}

function getGraphQLArgs(name, {
  kind,
  model
}) {
  if (kind !== 'connection') return {};
  return _objectSpread({}, (0, _lodash.mapValues)(model.indexes, type => ({
    type: getGraphQLInputType(INDEX, type)
  })), _graphqlRelay.connectionArgs);
} // Toplevel queries & mutations


function modelQueries({
  source,
  name,
  indexes
}, options) {
  const nodeType = objectTypes[name];
  const connectionType = connectionDefinition[name].connectionType;
  const _options$resolvers = options.resolvers,
        resolveObject = _options$resolvers.resolveObject,
        resolveConnection = _options$resolvers.resolveConnection;
  return {
    [name]: {
      type: nodeType,
      args: {
        id: idField
      },
      resolve: resolveObject('id', source)
    },
    [(0, _pluralize.default)(name)]: {
      name,
      type: connectionType,
      args: _objectSpread({}, (0, _lodash.mapValues)(indexes, type => ({
        type: getGraphQLInputType(INDEX, type)
      })), _graphqlRelay.connectionArgs),
      resolve: resolveConnection(source, indexes)
    }
  };
}

function modelMutations({
  source,
  name,
  fields
}, viewer, options) {
  const nodeType = objectTypes[name];
  const edgeType = connectionDefinition[name].edgeType;
  const _options$mutators = options.mutators,
        addMutation = _options$mutators.addMutation,
        updateMutation = _options$mutators.updateMutation,
        removeMutation = _options$mutators.removeMutation,
        updateGraphMutation = _options$mutators.updateGraphMutation;
  const toNode = options.resolvers.toNode;
  const addName = `Add${(0, _util.capitalize)(name)}`;
  const updateName = `Update${(0, _util.capitalize)(name)}`;
  const removeName = `Remove${(0, _util.capitalize)(name)}`;
  const inputFields = getGraphQLInputFields(`${name}Input`, fields);
  return {
    [addName]: (0, _graphqlRelay.mutationWithClientMutationId)({
      name: addName,
      inputFields: _objectSpread({
        id: nullIdField,
        parent: nullIdField,
        connectionName: connectionNameField
      }, inputFields),
      outputFields: {
        parent: {
          type: nodeType,
          resolve: ({
            parent
          }) => parent ? toNode(parent) : viewer
        },
        edge: {
          type: edgeType,
          resolve: ({
            node
          }) => ({
            node: toNode(node),
            cursor: node._id
          })
        }
      },
      mutateAndGetPayload: addMutation(source, options)
    }),
    [updateName]: (0, _graphqlRelay.mutationWithClientMutationId)({
      name: updateName,
      inputFields: _objectSpread({
        id: idField
      }, inputFields),
      outputFields: {
        node: {
          type: nodeType,
          resolve: toNode
        }
      },
      mutateAndGetPayload: updateMutation(source, options)
    }),
    [removeName]: (0, _graphqlRelay.mutationWithClientMutationId)({
      name: removeName,
      inputFields: {
        id: idField,
        parent: nullIdField,
        connectionName: connectionNameField
      },
      outputFields: {
        parent: {
          type: nodeType,
          resolve: ({
            parent
          }) => parent ? toNode(parent) : viewer
        },
        id: idField
      },
      mutateAndGetPayload: removeMutation(source, options)
    })
  };
} // Root fields & default


function rootFields(models, options) {
  const resolveNode = options.resolvers.resolveNode(models, viewer);
  const viewerField = {
    name: 'Viewer',
    type: new _type.GraphQLObjectType({
      name: 'Viewer',
      interfaces: [nodeInterface],
      fields: models.reduce((fields, model) => _objectSpread({}, fields, modelQueries(model, options), {
        nodes: {
          name: 'nodes',
          type: new _type.GraphQLList(nodeInterface),
          args: {
            ids: {
              name: 'ids',
              type: new _type.GraphQLNonNull(new _type.GraphQLList(new _type.GraphQLNonNull(_type.GraphQLID)))
            }
          },
          resolve: function (rootValue, {
            ids
          }, ctx, info) {
            return Promise.all(ids.map(id => resolveNode(rootValue, {
              id
            }, ctx, info)));
          }
        }
      }, (0, _lodash.mapValues)(options.viewer, field => typeof field === 'function' ? field(objectTypes) : field)), {
        id: (0, _graphqlRelay.globalIdField)('Viewer')
      })
    }),
    resolve: () => viewer
  };
  return {
    query: new _type.GraphQLObjectType({
      name: 'Query',
      fields: _objectSpread({
        viewer: viewerField,
        node: {
          name: 'node',
          type: nodeInterface,
          args: {
            id: idField
          },
          resolve: resolveNode
        }
      }, (0, _lodash.mapValues)(options.queries, query => typeof query === 'function' ? query(objectTypes) : query))
    }),
    mutation: new _type.GraphQLObjectType({
      name: 'Mutation',
      fields: models.reduce((fields, model) => _objectSpread({}, fields, modelMutations(model, viewerField, options)), (0, _lodash.mapValues)(options.mutations, mutation => typeof mutation === 'function' ? mutation(objectTypes) : mutation))
    })
  };
}

function _default(models, options = {}) {
  options = _objectSpread({
    mutations: {},
    mutators: {},
    resolvers: {}
  }, options, {
    findModel: name => models.find(model => model.name === name).source
  });
  generateObjectTypes(models, options);
  const schema = new _type.GraphQLSchema(rootFields(models, options));
  schema.objectTypes = (0, _lodash.omitBy)(objectTypes, (type, name) => /Schema(Input)?$/.test(name));
  schema.connectionDefinitions = connectionDefinition;
  return schema;
}