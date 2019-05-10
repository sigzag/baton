"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.addMutation = addMutation;
exports.updateMutation = updateMutation;
exports.removeMutation = removeMutation;
exports.updateGraphMutation = updateGraphMutation;
exports.updateInArrayMutation = updateInArrayMutation;
exports.addToArrayMutation = addToArrayMutation;
exports.removeFromArrayMutation = removeFromArrayMutation;

var _graphqlRelay = require("graphql-relay");

var _lodash = require("lodash");

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; var ownKeys = Object.keys(source); if (typeof Object.getOwnPropertySymbols === 'function') { ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) { return Object.getOwnPropertyDescriptor(source, sym).enumerable; })); } ownKeys.forEach(function (key) { _defineProperty(target, key, source[key]); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function resolveIdFields(input, idFields, transforms = {}) {
  return (0, _lodash.chain)(input).mapValues((value, field) => value && ~idFields.indexOf(field) ? Array.isArray(value) ? value.map(({
    id
  }) => id && (0, _graphqlRelay.fromGlobalId)(id).id).filter(x => x) : value.id && (0, _graphqlRelay.fromGlobalId)(value.id).id : value).mapValues((value, field) => value && transforms[field] ? transforms[field](value, _graphqlRelay.fromGlobalId) : value).omit(['id', 'clientMutationId', 'parent', 'connectionName']).value();
}

function addMutation(model, options) {
  const idFields = (0, _lodash.values)(model.schema.paths).filter(path => path.options && path.options.ref).map(field => field.path);
  return async function (input, context, info) {
    const node = await (input.id ? model.findById((0, _graphqlRelay.fromGlobalId)(input.id).id) : model.create(resolveIdFields(input, idFields)));

    if (input.parent) {
      const _fromGlobalId = (0, _graphqlRelay.fromGlobalId)(input.parent),
            id = _fromGlobalId.id,
            type = _fromGlobalId.type;

      const parent = await options.findModel(type).findById(id);
      parent[input.connectionName].addToSet(node);
      await parent.save();
      return {
        parent,
        node
      };
    }

    return {
      node
    };
  };
}

function updateMutation(model, options) {
  const idFields = (0, _lodash.values)(model.schema.paths).filter(path => path.options && path.options.ref || path.caster && path.caster.options && path.caster.options.ref).map(field => field.path);
  const transforms = (0, _lodash.values)(model.schema.paths).filter(field => field.options && field.options.inverseTransform).reduce((transforms, field) => _objectSpread({}, transforms, {
    [field.path]: field.options.inverseTransform
  }), {});
  return async function (input, context, info) {
    const node = await model.findById((0, _graphqlRelay.fromGlobalId)(input.id).id);
    node.set(resolveIdFields(input, idFields, transforms));
    await node.save();
    return node;
  };
}

function removeMutation(model, options) {
  return async function (input, context, info) {
    const node = await model.findById((0, _graphqlRelay.fromGlobalId)(input.id).id);

    if (input.parent) {
      const _fromGlobalId2 = (0, _graphqlRelay.fromGlobalId)(input.parent),
            id = _fromGlobalId2.id,
            type = _fromGlobalId2.type;

      const parent = await options.findModel(type).findById(id);
      parent[input.connectionName].pull(node);
      const owner = (0, _lodash.values)(model.schema.paths).find(path => path.options && path.options.childPath === input.connectionName);
      await Promise.all([parent.save(), owner && node.remove()]);
      return {
        parent,
        id: input.id
      };
    } else {
      await node.remove();
      return {
        id: input.id
      };
    }
  };
}

function updateGraphMutation(model, field, options) {
  return async function (input, context, info) {
    const node = await model.findById((0, _graphqlRelay.fromGlobalId)(input.id).id);
    await node.update((0, _lodash.mapKeys)(JSON.parse(input.diff), (val, key) => `${field.name}.${key}`));
    return node;
  };
} // not really used I believeth


function updateInArrayMutation(parentModel, connectionName, options) {
  // const idFields = values(childModel.schema.paths)
  // 	.filter(path => path.options && path.options.ref)
  // 	.map(field => field.path); // not correct, issit
  return async function (input, context, info) {
    const _fromGlobalId3 = (0, _graphqlRelay.fromGlobalId)(input.id),
          id = _fromGlobalId3.id;

    const parent = await model.find({
      [`${connectionName}._id`]: id
    });
    const child = parent[connectionName].id(id);
    child.set(resolveIdFields(input, idFields));
    parent.markModified(connectionName);
    await parent.save();
    return child;
  };
}

function addToArrayMutation(parentModel, connectionName, options) {
  // const idFields = values(childModel.schema.paths)
  // 	.filter(path => path.options && path.options.ref)
  // 	.map(field => field.path); // ditto
  return async function (input, context, info) {
    const _fromGlobalId4 = (0, _graphqlRelay.fromGlobalId)(input.parent),
          parentId = _fromGlobalId4.id;

    const parent = await parentModel.findById(parentId);
    const child = parent[connectionName].create(resolveIdFields(input, idFields));
    parent[connectionName].addToSet(child);
    await parent.save();
    return {
      parent,
      child
    };
  };
}

function removeFromArrayMutation(schema, parentModel, connectionName, options) {
  return async function (input, context, info) {
    const _fromGlobalId5 = (0, _graphqlRelay.fromGlobalId)(input.parent),
          parentId = _fromGlobalId5.id;

    const _fromGlobalId6 = (0, _graphqlRelay.fromGlobalId)(input.id),
          childId = _fromGlobalId6.id;

    const parent = await parentModel.findById(parentId);
    const child = parent[connectionName].id(childId);
    parent[connectionName].pull(child);
    await parent.save();
    return {
      parent,
      id: input.id
    };
  };
}