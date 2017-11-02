import buildSchema, { nodeInterface } from '../core';
import { isPlainObject, toPairs } from 'lodash';
import * as resolvers from './resolvers';
import * as mutators from './mutators';
import {
	VirtualType,
	Schema
} from 'mongoose';

const {
	resolveObject,
	resolveProperty,
	resolveJSON,
	resolveList,
	resolveConnection,
	resolvePropertyConnection,
	resolveType,
	toNode
} = resolvers;

export {
	toNode,
	nodeInterface,
	resolveType
};

function paths(schema) {
	return { ...schema.virtuals, ...schema.paths };
}
function pathPairs(paths, skip) {
	const result = [];
	const schemas = {};
	if (paths.constructor.name === 'EmbeddedDocument' || paths.constructor.name === 'SchemaType')
		paths = paths.schema.paths;
	for (let [name, path] of toPairs(paths)) {
		if (skip && ~skip.indexOf(name))
			continue;
		if (~name.indexOf('.')) {
			const [head, ...tail] = name.split('.');
			if (!schemas[head])
				result.push([head, schemas[head] = {}]);
			schemas[head][tail.join('.')] = path;
		} else
			result.push([name, path]);
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
	if (!name)
		throw new Error(`Missing name for ${source}`);

	const paths = isPlainObject(source)
		? Object.entries(source)
		: [...Object.entries(source.paths), ...Object.entries(source.virtuals)];
	
	return {
		name,
		source,
		paths,
		fields: fields(paths),
		interfaces: source.baseModelName
			? [source.baseModelName]
			: [],
		resolveType
	};
	return {
		name,
		fields: (isPlainObject(schema)
			? Object.entries(schema)
			: [...Object.entries(schema.paths), ...Object.entries(schema.virtuals)]),
	}
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
	if (isPlainObject(path))
		return 'object';
	else if (path.enumValues && path.enumValues.length)
		return 'enum';
	else switch (path.constructor.name) {
		case 'ObjectId':
			return 'node';
		case 'DocumentArray':
		case 'SchemaArray':
			if (path.caster.options && path.caster.options.connection)
				return 'connection';
			else
				return 'list';
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
	if (isPlainObject(path))
		return {
			name,
			type: {
				kind: 'object',
				model: generateModel(path, getModel, skip)
			},
			resolve: resolveProperty(name)
		};
	else if (path.enumValues && path.enumValues.length)
		return {
			name,
			type: {
				kind: 'enum',
				values: path.enumValues
			},
			resolve: resolveProperty(name)
		};
	else if (path.options && path.options.json)
		return {
			name,
			type: {
				kind: 'json'
			},
			diff: true,
			resolve: resolveProperty(name, path.options.transform)
		};
	else if (path.node || path.options && path.options.node)
		return {
			name,
			type: {
				kind: 'node',
				model: getModel(path.node || path.options.ref)
			},
			resolve: resolveObject(name, getModel(path.node && path.options.ref).source)
		};
	else if (path.list || path.caster && path.caster.options && path.caster.options.list)
		return {
			name,
			type: {
				kind: 'list',
				model: {
					kind: 'node',
					model: getModel(path.list && path.caster.options.ref)
				}
			},
			resolve: resolveList(name, getModel(path.list && path.caster.options.ref).source)
		};
	else if (path.connection || path.caster && path.caster.options && path.caster.options.connection) {
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
			if (Object.values(Schema.Types).find(type => path.caster instanceof type))
				return { name, type: { kind: 'list', model: getKind(path.caster) }, resolve: resolveProperty(name) };

			return {
				name,
				type: {
					kind: 'list',
					model: getKind(path.caster) === 'object'
						? generateModel(paths(path.caster.schema), getModel, skip)
						: { kind: getKind(path.caster), model: getModel(path.caster.options && path.caster.options.ref) }
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
			return { name, type: { kind: getKind(path) }, resolve: resolveProperty(name) };
	}
}

export default function(models, options = {}) {
	const skip = ['_id', '__v', '__t', 'id', ...(options.skip || [])];
	models = models.map(source => ({
		source,
		name: source.modelName,
		fields: [],
		indexes: pathPairs(paths(source.schema), skip)
			.filter(([, path]) => path && path.options && path.options.index)
			.reduce(
				(indexes, [name, path]) => ({ ...indexes, [name]: { kind: getKind(path) } }),
				{}
			),
		interfaces: source.baseModelName
			? [source.baseModelName]
			: [],
		resolveType: isUnion(source) && resolveType
	}));

	for (let { source, indexes } of models)
		source.resolve = resolveConnection(source, indexes);

	const getModel = name => {
		const res = models.find(model => model.name === name);
		if (!res)
			throw new Error(`Model ${name} not found`);
		return res;
	}
	for (let { source: { schema }, fields, indexes } of models)
		fields.push(...pathPairs(paths(schema), skip).map(([name, path]) => getField(name, path, getModel, skip)));

	return buildSchema(
		models,
		{
			resolvers,
			mutators,
			...options
		}
	);
}