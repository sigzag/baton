import {
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
	nodeDefinitions
} from 'graphql-relay';
import pluralize from 'pluralize';
import {
	capitalize
} from '../../util';
import GraphQLDate from '../scalars/Date';
import GraphQLJSON from '../scalars/JSON';

// Constants
const viewer = { _type: 'Viewer', id: 'viewer' };
const idField = { name: 'id', type: new GraphQLNonNull(GraphQLID) };
const nullIdField = { name: 'id', type: GraphQLID };
const connectionNameField = { name: 'connectionName', type: GraphQLString };
const { nodeInterface } = nodeDefinitions(null, obj => obj._type ? objectTypes[obj._type] : null);
const nodeInputType = new GraphQLInputObjectType({
	name: 'NodeInput',
	fields: {
		id: nullIdField
	}
});
export { nodeInterface, nodeInputType };

const INDEX = Symbol();

// Generate object type map
let objectTypes;
let connectionDefinition;
function generateObjectTypes(models, options) {
	objectTypes = {};
	connectionDefinition = {};

	const interfaceModels = models.filter(({ resolveType }) => resolveType);
	const typeModels = models.filter(({ resolveType }) => !resolveType);

	for (let { name, resolveType } of interfaceModels)
		objectTypes[name] = new GraphQLInterfaceType({
			name: name,
			resolveType: resolveType(objectTypes),
			fields: { id: globalIdField(name, ({ id }) => id) }
		});
	for (let { name, interfaces } of typeModels)
		objectTypes[name] = new GraphQLObjectType({
			name: name,
			interfaces: [nodeInterface, ...interfaces.map(name => objectTypes[name])],
			fields: { id: globalIdField(name, ({ id }) => id) }
		});
	for (let { name, fields } of models)
		connectionDefinition[name] = connectionDefinitions({ nodeType: objectTypes[name] });
	for (let { name, fields } of interfaceModels)
		objectTypes[name]._typeConfig.fields = {
			...getGraphQLFields(name, fields),
			id: globalIdField(name, obj => obj._id)
		};
	for (let { name, fields, interfaces } of typeModels)
		objectTypes[name]._typeConfig.fields = interfaces
			.map(name => models.find(model => model.name === name))
			.reduce(
				(fields, model) => ({ ...fields, ...getGraphQLFields(name, model.fields) }),
				{
					...getGraphQLFields(name, fields),
					id: globalIdField(name, obj => obj._id)
				}
			);
}

// Generate/get sub-object types
function getObjectType(name, { fields }) {
	name = `${name}Schema`;
	if (!objectTypes[name])
		objectTypes[name] = new GraphQLObjectType({ name, fields: getGraphQLFields(name, fields) });
	return objectTypes[name];
}
function getObjectInputType(name, { fields }) {
	name = `${name}InputSchema`;
	if (!objectTypes[name])
		objectTypes[name] = new GraphQLInputObjectType({ name, fields: getGraphQLInputFields(name, fields) });
	return objectTypes[name];
}

// Generate/get connection types
function getConnectionType(name, model) {
	if (connectionDefinition[model.name])
		return connectionDefinition[model.name].connectionType;

	const connectionName = `${name}SchemaConnection`;
	if (!connectionDefinition[connectionName]) {
		const nodeType = getObjectType(name, model);
		connectionDefinition[connectionName] = connectionDefinitions({ nodeType });
	}
	return connectionDefinition[connectionName].connectionType;
}

// Fields
function getGraphQLFields(rootName, fields) {
	return fields.reduce((fields, field) => {
		const fieldName = `${rootName}${capitalize(field.name)}`;
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
	return fields.reduce((fields, { name, type }) => {
		const fieldName = `${rootName}${capitalize(name)}`;
		if (type.kind !== 'connection')
			fields[name] = {
				name: fieldName,
				type: getGraphQLInputType(fieldName, type)
			};
		return fields;
	}, {});
}
function getGraphQLType(name, { kind, model, values }) {
	switch (kind) {
		case 'list':
			return new GraphQLList(getGraphQLType(name, model));
		case 'connection':
			return getConnectionType(model.name || name, model);
		case 'node':
			return objectTypes[model.name] || nodeInterface;
		case 'object':
			return getObjectType(model.name || name, model);
		case 'enum':
			return new GraphQLEnumType({
				name,
				values: values.reduce((values, value) => ({ ...values, [value]: { value } }), {})
			});
		default:
			return getGraphQLScalarType({ kind });
	}
}
function getGraphQLInputType(name, { kind, model, values }) {
	switch (kind) {
		case 'list':
			return new GraphQLList(getGraphQLInputType(name, model));
		case 'node':
			if (name === INDEX)
				return GraphQLID;
			else
				return nodeInputType;
		case 'object':
			return getObjectInputType(model.name || name, model);
		case 'enum':
			return new GraphQLEnumType({
				name,
				values: values.reduce((values, value) => ({ ...values, [value]: { value } }), {})
			});
		default:
			return getGraphQLScalarType({ kind });
	}
}
function getGraphQLScalarType({ kind }) {
	switch (kind) {
		case 'number':
			return GraphQLFloat;
		case 'boolean':
			return GraphQLBoolean;
		case 'date':
			return GraphQLDate;
		case 'json':
			return GraphQLJSON;
		default:
			return GraphQLString;
	}
}
function getGraphQLArgs(name, { kind, model }) {
	if (kind !== 'connection')
		return {};

	return {
		...mapValues(model.indexes, type => ({ type: getGraphQLInputType(INDEX, type) })),
		...connectionArgs
	};
}

// Toplevel queries & mutations
function modelQueries({ source, name, indexes }, options) {
	const nodeType = objectTypes[name];
	const { connectionType } = connectionDefinition[name];

	const {
		resolveObject,
		resolveConnection
	} = options.resolvers;
	
	return {
		[name]: {
			type: nodeType,
			args: { id: idField },
			resolve: resolveObject('id', source)
		},
		[pluralize(name)]: {
			name,
			type: connectionType,
			args: {
				...mapValues(indexes, type => ({ type: getGraphQLInputType(INDEX, type) })),
				...connectionArgs
			},
			resolve: resolveConnection(source, indexes)
		}
	};
}
function modelMutations({ source, name, fields }, viewer, options) {
	const nodeType = objectTypes[name];
	const { edgeType } = connectionDefinition[name];

	const {
		addMutation,
		updateMutation,
		removeMutation,
		updateGraphMutation
	} = options.mutators;
	const {
		toNode
	} = options.resolvers;

	const addName = `Add${capitalize(name)}`;
	const updateName = `Update${capitalize(name)}`;
	const removeName = `Remove${capitalize(name)}`;

	const inputFields = getGraphQLInputFields(`${name}Input`, fields);

	return {
		[addName]: mutationWithClientMutationId({
			name: addName,
			inputFields: {
				id: nullIdField,
				parent: nullIdField,
				connectionName: connectionNameField,
				...inputFields
			},
			outputFields: {
				parent: {
					type: nodeType,
					resolve: ({ parent }) => parent
						? toNode(parent)
						: viewer
				},
				edge: {
					type: edgeType,
					resolve: ({ node }) => ({
						node: toNode(node),
						cursor: node._id
					})
				}
			},
			mutateAndGetPayload: addMutation(source, options)
		}),
		[updateName]: mutationWithClientMutationId({
			name: updateName,
			inputFields: {
				id: idField,
				...inputFields
			},
			outputFields: {
				node: {
					type: nodeType,
					resolve: toNode
				}
			},
			mutateAndGetPayload: updateMutation(source, options)
		}),
		[removeName]: mutationWithClientMutationId({
			name: removeName,
			inputFields: {
				id: idField,
				parent: nullIdField,
				connectionName: connectionNameField
			},
			outputFields: {
				parent: {
					type: nodeType,
					resolve: ({ parent }) => parent
						? toNode(parent)
						: viewer
				},
				id: idField
			},
			mutateAndGetPayload: removeMutation(source, options)
		})
	};
}

// Root fields & default
function rootFields(models, options) {
	const resolveNode = options.resolvers.resolveNode(models, viewer);

	const viewerField = {
		name: 'Viewer',
		type: new GraphQLObjectType({
			name: 'Viewer',
			interfaces: [nodeInterface],
			fields: models.reduce((fields, model) => ({
				...fields,
				...modelQueries(model, options),
				nodes: {
					name: 'nodes',
					type: new GraphQLList(nodeInterface),
					args: {
						ids: {
							name: 'ids',
							type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(GraphQLID)))
						}
					},
					resolve: function(rootValue, { ids }, ctx, info) {
						return Promise.all(ids.map(id => resolveNode(rootValue, { id }, ctx, info)));
					}
				},
				...mapValues(options.viewer, field => typeof field === 'function' ? field(objectTypes) : field),
			}), {
				id: globalIdField('Viewer')
			})
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
					resolve: resolveNode
				},
				...mapValues(options.queries, query => typeof query === 'function' ? query(objectTypes) : query)
			}
		}),
		mutation: new GraphQLObjectType({
			name: 'Mutation',
			fields: models.reduce((fields, model) => ({
				...fields,
				...modelMutations(model, viewerField, options)
			}), mapValues(options.mutations, mutation => typeof mutation === 'function' ? mutation(objectTypes) : mutation))
		})
	};
}

/*
	models [{
		name,
		fields [{
			name
			type {
				kind
				model (node, connection, list)
				values (enum)
			}
			resolve
		}]
		indexes { name: type, ... }
		interfaces [model, ...]
		resolveType(objectTypes) => objectType
	}]
	options {
		resolvers {
			resolveObject
			resolveConnection
		}
	}
*/

export default function(models, options = {}) {
	options = {
		mutations: {},
		mutators: {},
		resolvers: {},
		...options,
		findModel: name => models.find(model => model.name === name).source
	};

	generateObjectTypes(models, options);
	const schema = new GraphQLSchema(rootFields(models, options));
	schema.objectTypes = omitBy(objectTypes, (type, name) => /Schema(Input)?$/.test(name));
	schema.connectionDefinitions = connectionDefinition;
	return schema;
}