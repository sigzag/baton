import {
	pickBy,
	values,
	toPairs,
	mapValues,
	omitBy
} from 'lodash';
import {
	GraphQLSchema,
	GraphQLString,
	GraphQLFloat,
	GraphQLBoolean,
	GraphQLID,
	GraphQLList,
	GraphQLObjectType,
	GraphQLNonNull,
	GraphQLEnumType,
	GraphQLInterfaceType,
	GraphQLInputObjectType,
	isInputType
} from 'graphql/type';
import {
	mutationWithClientMutationId,
	connectionArgs,
	connectionDefinitions,
	globalIdField,
	nodeDefinitions,
	fromGlobalId
} from 'graphql-relay';
import pluralize from 'pluralize';
import {
	pathPairs,
	pathType,
	isUnion,
	slice
} from '../util';
import GraphQLDate from '../scalars/Date';

import {
	addMutation,
	updateMutation,
	removeMutation,
	addToMutation,
	removeFromMutation,
	addToArrayMutation,
	removeFromArrayMutation
} from './mutations';

function capitalize(str) {
	return str.charAt(0).toUpperCase() + str.slice(1);
}
export function toNode(doc) {
	return doc && {
		...doc.toObject(),
		_type: doc.constructor.modelName
	};
}

// Constants
const { nodeInterface } = nodeDefinitions(null, obj => obj._type ? objectTypes[obj._type] : null);
export { nodeInterface };
const viewer = { _type: 'viewer', id: 'viewer' };
const idField = { name: 'id', type: new GraphQLNonNull(GraphQLID) };
const nullIdField = { name: 'id', type: GraphQLID };

// Object resolvers
function resolveObject(model, name) {
	return function(rootValue, args, context, info) {
		return model.findById(rootValue[name]).then(toNode);
	}
}
function resolveList(model, name) {
	return function(rootValue, args, context, info) {
		return model.find({ _id: { $in: rootValue[name] || [] } })
			.then(objects => objects.map(toNode))
			.then(objects => rootValue[name].map(id => objects.find(node => String(node._id) === String(id))));
	}
}
function resolveConnection(model, indexes) {
	return async function(rootValue, args, context, info) {
		const { before, after, first, last, ...query } = args;

		for (let [name, type] of indexes)
			if (query.hasOwnProperty(name) && type === GraphQLID)
				query[name] = fromGlobalId(query[name]).id;

		if (after)
			query._id = { ...(query._id || {}), $gt: cursorToId(after) };
		if (before)
			query._id = { ...(query._id || {}), $lt: cursorToId(before) };

		const nodes = (await model.find(query, null, {
			skip: (first - last) || 0,
			limit: last || first,
			sort: '_id'
		})).map(toNode);

		if (!nodes.length)
			return {
				edges: [],
				pageInfo: {
					startCursor: null,
					endCursor: null,
					hasPreviousPage: false,
					hasNextPage: false
				}
			};
		return {
			edges: nodes.map(node => ({
				cursor: idToCursor(node._id),
				node: node
			})),
			pageInfo: {
				startCursor: idToCursor(nodes[0]._id),
				endCursor: idToCursor(nodes[nodes.length - 1]._id),
				hasPreviousPage: !!(first - last),
				hasNextPage: !!(nodes.length === (last || first))
			}
		};
	}
}
function resolvePropertyConnection(model, name) {
	const resolve = resolveConnection(model, objectTypes[model.modelName].indexes);
	return function(rootValue, args, context, info) {
		return resolve(rootValue, { ...args, _id: { $in: rootValue[name] || [] } });
	}
}
function resolveNode({ models }) {
	return function(rootValue, args, context, info) {
		const { id, type } = fromGlobalId(args.id);
		if (type === 'viewer')
			return viewer;
		else {
			return models.find(({ modelName }) => modelName == type).findById(id).then(toNode);
		}
	}
}

// Union type resolver
export function resolveType(types) {
	return (value, context, info) => (!value.__t && console.log('no __t', value)) || ~types.indexOf(value.__t) && objectTypes[value.__t];
}

// Generate object type map
let objectTypes;
let connectionDefinition;
function generateObjectTypes(options) {
	objectTypes = {};
	connectionDefinition = {};

	const interfaceModels = options.models.filter(isUnion)
	const typeModels = options.models.filter(model => !isUnion(model));

	for (let model of interfaceModels)
		objectTypes[model.modelName] = new GraphQLInterfaceType({
			name: model.modelName,
			resolveType: resolveType(Object.keys(model.discriminators)),
			fields: { id: globalIdField(model.modelName, obj => obj._id) }
		});
	for (let model of typeModels)
		objectTypes[model.modelName] = new GraphQLObjectType({
			name: model.modelName,
			interfaces: model.baseModelName
				? [nodeInterface, objectTypes[model.baseModelName]]
				: [nodeInterface],
			fields: { id: globalIdField(model.modelName, obj => obj._id) }
		});
	for (let model of options.models) {
		connectionDefinition[model.modelName] = connectionDefinitions({ nodeType: objectTypes[model.modelName] });
		objectTypes[model.modelName].indexes = pathPairs(model.schema.paths, options)
			.filter(([name, { _index }]) => _index)
			.map(([name, path]) => [name, pathType(path) === 'id' ? GraphQLID : type(path)]);
	}
	for (let model of interfaceModels)
		objectTypes[model.modelName]._typeConfig.fields = {
			id: globalIdField(model.modelName, obj => obj._id),
			...fields(model.modelName, model.schema.paths, options)
		};
	for (let model of typeModels)
		objectTypes[model.modelName]._typeConfig.fields = {
			id: globalIdField(model.modelName, obj => obj._id),
			...fields(model.modelName, model.schema.paths, options),
			...(model.baseModelName
				? objectTypes[model.baseModelName]._typeConfig.fields
				: {})
		};
}
function schemaObjectType(name, paths, options, input) {
	name = `${name}Schema${input ? 'Input' : ''}`;
	if (!objectTypes[name]) {
		objectTypes[name] = new (input ? GraphQLInputObjectType : GraphQLObjectType)({
			name,
			fields: {
				id: input
					? idField
					: globalIdField(name),
				...fields(name, paths, options, input)
			}
		});
		objectTypes[name].indexes = pathPairs(paths, options)
			.filter(([name, { _index }]) => _index)
			.map(([name, path]) => [name, pathType(path) === 'id' ? GraphQLID : type(path)]);
	}
	return objectTypes[name];
}
function schemaConnectionType(name, paths, options) {
	const connectionName = `${name}SchemaConnection`;
	if (connectionDefinition[connectionName])
		return connectionDefinition[connectionName];
	const nodeType = schemaObjectType(name, paths, options);
	return connectionDefinition[connectionName] = connectionDefinitions({ nodeType });
}

// Fields
function getInputFields(config, options) {
	const fields = typeof config.fields === 'function'
		? config.fields()
		: config.fields;
	return pickBy(mapValues(config.fields, inputField), ({ type }) => type);
}
function inputField(field, name) {
	return { name, type: inputType(field.type) };
}
function inputType(type) {
	if (isInputType(type))
		return type;
	else if (type === nodeInterface || type instanceof GraphQLObjectType)
		return GraphQLID;
	else if (type instanceof GraphQLList)
		return new GraphQLList(inputType(type._typeConfig.type));
}
function fields(rootName, paths, options, input) {
	return pathPairs(paths, options)
		.reduce((fields, [name, path]) => {
			fields[name] = field(path, name, `${rootName}${name}`, options, input);
			return fields;
		}, {});
}
function field(path, fieldName, name, options, input) {
	const childModel = pathType(path) === 'ids' && options.models.find(({ modelName }) => modelName === path.caster.options.ref);
	return {
		name,
		type: type(path, name, options, input),
		args: !input && args(path, name, options),
		resolve: input ? null : resolve(path, fieldName, options),
		owner: !!(childModel && values(childModel.schema.paths).find(path => path.options && path.options.childPath === fieldName)),
		array: pathType(path) === 'objects'
	};
}
function type(path, name, options, input) {
	switch (pathType(path)) {
		case 'id':
			if (input)
				return GraphQLID;
			else
				return objectTypes[path.options.ref] || nodeInterface;
		case 'ids':
			if (input)
				return new GraphQLList(GraphQLID);
			else
				return connectionDefinition[path.caster.options.ref].connectionType;
		case 'array':
			return new GraphQLList(type(path.caster, name, options, input));
		case 'object':
			return schemaObjectType(path.schema && path.schema.options.name || name, path, options, input);
		case 'objects':
			if (input)
				return new GraphQLList(GraphQLID);
			else
				return schemaConnectionType(path.schema && path.schema.options.name || name, path.options.connection.paths, options, input).connectionType;
		case 'enum':
			return new GraphQLEnumType({
				name,
				values: path.enumValues.reduce((values, value) => ({ ...values, [value]: { value } }), {})
			});
		case 'number':
			return GraphQLFloat;
		case 'boolean':
			return GraphQLBoolean;
		case 'date':
			return GraphQLDate;
		default:
			return GraphQLString;
	}
}
function args(path, name, options, input) {
	switch (pathType(path)) {
		case 'ids': {
			const nodeType = objectTypes[path.caster.options.ref];
			return nodeType.indexes.reduce((args, [name, type]) => ({
				...args,
				[name]: { type }
			}), connectionArgs);
		} case 'objects': {
			const nodeType = schemaObjectType(path.schema && path.schema.options.name || name, path.options.connection.paths, options, input);
			return nodeType.indexes.reduce((args, [name, type]) => ({
				...args,
				[name]: { type }
			}), connectionArgs);
		} default:
			return {};
	}
}
function resolve(path, name, { models }) {
	switch (pathType(path)) {
		case 'id':
			{
				const model = models.find(({ modelName }) => modelName === path.options.ref);
				return resolveObject(model, name);
			}
		case 'ids':
			{
				const model = models.find(({ modelName }) => modelName === path.caster.options.ref);
				return resolvePropertyConnection(model, name);
			}
		case 'objects':
			return (rootValue, args) => slice(rootValue[name], args);
		case 'array':
			{
				if (path.caster.options && path.caster.options.list) {
					const model = models.find(({ modelName }) => modelName === path.caster.options.list);
					return resolveList(model, name);
				} else 
					return rootValue => rootValue[name];
			}
		default:
			return rootValue => rootValue[name];
	}
}

// Id <-> cursor
function idToCursor(id) {
	return new Buffer(String(id), 'ascii').toString('base64');
}
function cursorToId(cursor) {
	return new Buffer(String(cursor), 'base64').toString('ascii');
}

// Toplevel queries & mutations
function modelQueries(model, options) {
	const name = model.modelName;
	const nodeType = objectTypes[name];
	const { connectionType } = connectionDefinition[name];
	return {
		[name]: {
			type: nodeType,
			args: { id: idField },
			resolve: resolveObject(model, 'id')
		},
		[pluralize(name)]: {
			name,
			type: connectionType,
			args: nodeType.indexes.reduce((args, [name, type]) => ({
				...args,
				[name]: { type }
			}), connectionArgs),
			resolve: resolveConnection(model, nodeType.indexes, options)
		}
	};
}
function modelMutations(model, viewer, options) {
	const name = model.modelName;
	const nodeType = objectTypes[name];
	const { edgeType } = connectionDefinition[name];

	const addName = `Add${capitalize(name)}`;
	const updateName = `Update${capitalize(name)}`;
	const removeName = `Remove${capitalize(name)}`;

	const inputFields = fields(`${name}Input`, model.schema.paths, options, true);

	const mutations = {
		[addName]: mutationWithClientMutationId({
			name: addName,
			inputFields,
			outputFields: {
				viewer,
				edge: {
					type: edgeType,
					resolve: node => ({
						node: toNode(node),
						cursor: idToCursor(node._id)
					})
				}
			},
			mutateAndGetPayload: addMutation(model, options)
		}),
		[updateName]: mutationWithClientMutationId({
			name: updateName,
			inputFields: {
				id: idField,
				...inputFields
			},
			outputFields: {
				viewer,
				updatedNode: {
					type: nodeType,
					resolve: toNode
				}
			},
			mutateAndGetPayload: updateMutation(model, options)
		}),
		[removeName]: mutationWithClientMutationId({
			name: removeName,
			inputFields: {
				id: idField
			},
			outputFields: {
				viewer,
				id: idField
			},
			mutateAndGetPayload: removeMutation(model, options)
		})
	};

	for (let [fieldName, field] of toPairs(nodeType._typeConfig.fields)) {
		const connection = Object.keys(connectionDefinition)
			.map(key => connectionDefinition[key])
			.find(({ connectionType }) => field.type === connectionType);
		if (connection) {
			const typeName = connection.edgeType._typeConfig.fields().node.type.name;
			const childModel = options.models.find(({ modelName }) => modelName === typeName);
			const addName = `Add${capitalize(fieldName)}To${capitalize(name)}`;
			const removeName = `Remove${capitalize(fieldName)}From${capitalize(name)}`;
			mutations[addName] = mutationWithClientMutationId({
				name: addName,
				inputFields: {
					parent: idField,
					id: nullIdField,
					...(childModel
						? fields(`${connection.edgeType.name}Input`, childModel.schema.paths, options, true)
						: getInputFields(connection.edgeType._typeConfig.fields().node.type._typeConfig))
				},
				outputFields: {
					parent: {
						type: nodeType,
						resolve: ({ parent }) => toNode(parent)
					},
					edge: {
						type: connection.edgeType,
						resolve: ({ child }) => ({
							node: toNode(child),
							cursor: idToCursor(child._id)
						})
					}
				},
				mutateAndGetPayload: childModel
					? addToMutation(childModel, model, fieldName, options)
					: addToArrayMutation(model, fieldName, options)
			});
			mutations[removeName] = mutationWithClientMutationId({
				name: removeName,
				inputFields: {
					parent: idField,
					id: idField
				},
				outputFields: {
					parent: {
						type: nodeType,
						resolve: ({ parent }) => toNode(parent)
					},
					id: idField
				},
				mutateAndGetPayload: childModel
					? removeFromMutation(childModel, model, fieldName, options)
					: removeFromArrayMutation(model, fieldName, options)
			});
			if (!childModel) {
				const updateName = `Update${capitalize(fieldName)}In${capitalize(name)}`;
				mutations[updateName] = mutationWithClientMutationId({
					name: updateName,
					inputFields: getInputFields(connection.edgeType._typeConfig.fields().node.type._typeConfig),
					outputFields: {
						viewer,
						updatedNode: {
							type: connection.edgeType._typeConfig.fields().node.type,
							resolve: toNode
						}
					},
					mutateAndGetPayload: updateMutation(model, options)
				});
			}
		}
	}
	
	return mutations;
}

// Root fields & default
function rootFields(options) {
	const viewerField = {
		name: 'viewer',
		type: new GraphQLObjectType({
			name: 'viewer',
			interfaces: [nodeInterface],
			fields: options.models.reduce((fields, model) => ({
				id: globalIdField('viewer'),
				...fields,
				...modelQueries(model, options)
			}), {})
		}),
		resolve: () => viewer
	};
	return {
		query: new GraphQLObjectType({
			name: 'Query',
			fields: {
				viewer: viewerField,
				node: {
					name: 'node',
					type: nodeInterface,
					args: {
						id: idField
					},
					resolve: resolveNode(options)
				}
			}
		}),
		mutation: new GraphQLObjectType({
			name: 'Mutation',
			fields: options.models.reduce((fields, model) => ({
				...fields,
				...modelMutations(model, viewerField, options)
			}), mapValues(options.mutations, mutation => typeof mutation === 'function' ? mutation(objectTypes) : mutation))
		})
	};
}
export default function(models, options = {}) {
	options = {
		mutations: {},
		...options,
		models: models,
		skip: ['_id', '__v', '__t'].concat(options.skip || [])
	};
	generateObjectTypes(options);
	const schema = new GraphQLSchema(rootFields(options));
	schema.objectTypes = omitBy(objectTypes, (type, name) => /Schema(Input)?$/.test(name));
	schema.connectionDefinitions = connectionDefinition;
	return schema;
}