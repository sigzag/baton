import {
	pickBy,
	values,
	toPairs,
	mapValues,
	omitBy,
	isPlainObject
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
import {
	toCollectionName
} from 'mongoose/lib/utils';
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

import { connection as _connection } from '../util';

export function connection(nodes, args, getCursor) {
	return _connection(nodes.map(toNode), args, getCursor || (({ id }) => idToCursor(id)));
}

function capitalize(str) {
	return str.charAt(0).toUpperCase() + str.slice(1);
}
export function toNode(doc, key, source) {
	if (typeof doc === 'function')
		return async (rootValue, args, ctx) => toNode(await doc.call(source, rootValue, args, ctx));
	if (doc instanceof Sequelize.Instance)
		return {
			...mapValues(doc.toJSON(), (value, key) => toNode(value, key, doc)),
			...mapValues(doc.Model.associations, resolveAssociation),
			...mapValues(doc.Model.options.virtuals || {}, toNode),
			id: toBase64(`${doc.Model.options.__typename}:${doc.id}`),
			__typename: doc.Model.options.__typename
		};
	else if (isPlainObject(doc) || doc[Symbol.iterator])
		return mapValues(doc, toNode);
	else if (Array.isArray(doc))
		return doc.map(toNode);
	else
		return doc;
}
export function resolveAssociation(assoc, resolve) {
	if (assoc.options.connection)
		return resolveConnection(assoc);
	else
		return rootValue => rootValue[assoc.accessors.get]().then(value => Array.isArray(value) ? value.map(resolve) : resolve(value));
}

// Constants
export const { nodeInterface } = nodeDefinitions(null, obj => obj._type ? objectTypes[obj._type] : null);
const viewer = { _type: 'viewer', id: 'viewer' };
const idField = { name: 'id', type: new GraphQLNonNull(GraphQLID) };
const nullIdField = { name: 'id', type: GraphQLID };

// Object resolvers
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
export function resolveType(types) {
	return (value, context, info) => (!value.__t && console.log('no __t', value)) || ~types.indexOf(value.__t) && objectTypes[value.__t];
}

// Generate object type map
let objectTypes;
let connectionDefinition;
function generateObjectTypes(options) {
	objectTypes = {};
	connectionDefinition = {};

	const nodeModels = options.models.filter(({ options: { nodeType } }) => nodeType);
	const typeModels = options.models.filter(({ options: { objectType } }) => objectType);

	for (let model of nodeModels)
		objectTypes[model.options.nodeType] = new GraphQLObjectType({
			name: model.options.nodeType,
			interfaces: [nodeInterface],
			fields: { id: globalIdField(model.modelName, obj => obj.id) }
		});
	for (let model of typeModels)
		objectTypes[model.options.objectType] = new GraphQLObjectType({
			name: model.options.objectType,
			fields: { id: globalIdField(model.modelName, obj => obj.id) }
		});
	for (let model of nodeModels) {
		const nodeType = objectTypes[model.options.nodeType];
		connectionDefinition[model.options.nodeType] = connectionDefinitions({ nodeType });
		nodeType.indexes = model.options.indexes;
		nodeType._typeConfig.fields = {
			id: globalIdField(model.options.nodeType, obj => obj.id),
			...fields(model.options.nodeType, model, options)
		};
	}
	for (let model of typeModels) {
		const objectType = objectTypes[model.options.objectType];
		objectType._typeConfig.fields = fields(model.options.objectType, model, options);
	}
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

function attributeFields(rootName, model, options, input) {
	return toPairs(model.attributes)
		.reduce((fields, [name, attr]) => {
			fields[name] = attributeField(attr, name, `${rootName}${name}`, options, input);
			return fields;
		}, {});
}
function attributeField(attr, fieldName, name, options, input) {
	const childModel = pathType(path) === 'ids' && options.models.find(({ modelName }) => modelName === path.caster.options.ref);
	return {
		name,
		type: attributeType(attr, name, options, input),
		resolve: input ? null : rootValue => rootValue[name]
	};
}
function attributeType(attr, name, options, input) {
	switch (true) {
		case attr.options.array:
			return new GraphQLList(attributeType(attr.options.array, name, options, input));
		case attr.type instanceof Sequelize.ENUM:
			return new GraphQLEnumType({
				name,
				values: attr.type.values.reduce((values, value) => ({ ...values, [value]: { value } }), {})
			});
		case attr.type === Sequelize.INTEGER:
			return GraphQLInt;
		case attr.type === Sequelize.FLOAT:
			return GraphQLFloat;
		case attr.type === Sequelize.BOOLEAN:
			return GraphQLBoolean;
		case attr.type === Sequelize.DATE:
			return GraphQLDate;
		default:
			return GraphQLString;
	}
}
function associationFields(rootName, model, options, input) {
	return toPairs(model.associations)
		.reduce((fields, [name, assoc]) => {
			fields[name] = associationField(assoc, name, `${rootName}${name}`, options, input);
			return fields;
		}, {});
}
function associationField(assoc, fieldName, name, options, input) {
	const childModel = pathType(path) === 'ids' && options.models.find(({ modelName }) => modelName === path.caster.options.ref);
	return {
		name,
		type: associationType(assoc, name, options, input),
		resolve: input ? null : resolveAssociation(assoc, name, options)
	};
}
function associationType(assoc, name, options, input) {
	switch (true) {
		case assoc.options.connection:
			return connectionDefinition[assoc.target.options.nodeType];
		case assoc instanceof Sequelize.BelongsTo:
		case assoc instanceof Sequelize.HasOne:
			return objectTypes[assoc.target.options.nodeType || assoc.target.options.objectType];
		case assoc instanceof Sequelize.BelongsToMany:
		case assoc instanceof Sequelize.HasMany:
			return new GraphQLList(objectTypes[assoc.target.options.nodeType || assoc.target.options.objectType]);
	}
}
function resolveAssociation(assoc, name, options, input) {
	if (assoc.options.connection)
		return resolveConnection(assoc);
	else
		return rootValue => rootValue[assoc.accessors.get]();
}
export function connectionQuery(model, { before, after, first, last, ...where }) {
	for (let [name, type] of toPairs(model.options.indexes))
		if (where.hasOwnProperty(name) && model.attributes[name].options.nodeType)
			where[name] = fromGlobalId(where[name]).id;

	if (after)
		where.id = { ...(where.id || {}), $gt: cursorToId(after) };
	if (before)
		where.id = { ...(where.id || {}), $lt: cursorToId(before) };

	return {
		where,
		order: 'id',
		offset: (first - last) || 0,
		limit: last || first
	};
}
export function resolveConnection(assoc) {
	return async function(rootValue, args, context, info) {
		const nodes = await rootValue[assoc.accessors.get](connectionQuery(assoc.target, args));
		return connection(nodes, args);
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
		[toCollectionName(name)]: {
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
						cursor: idToCursor(node.id)
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
							cursor: idToCursor(child.id)
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
export default function(sequelize, options = {}) {
	options = {
		mutations: {},
		...options,
		models: sequelize.models
	};
	generateObjectTypes(options);
	const schema = new GraphQLSchema(rootFields(options));
	schema.objectTypes = objectTypes;
	schema.connectionDefinitions = connectionDefinition;
	return schema;
}