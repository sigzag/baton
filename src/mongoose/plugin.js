import { toNode, page, slice } from '../util';
import { Schema } from 'mongoose';
import { toGlobalId, fromGlobalId } from 'graphql-relay';
import toObjectId from './toObjectId';
import _buildSchema from '../schema/provider/core';

function idFromCursor(cursor) { return fromGlobalId(cursor).id; }
function plainFromCursor(cursor) { return cursor; }
function idToCursor(node) { return node.id; }

export default function(schema, options = {}) {
	const {
		typename,
		index = '_id',
		fromCursor,
		toCursor,
	} = options;

	function queryCondition(query, rootValue, args) {
		return {
			...(typeof options.query === 'function'
				? options.query(rootValue, args)
				: options.query || {}),
			...(typeof query === 'function'
				? query(rootValue, args)
				: query || {}),
		};
	}

	schema.statics.typename = typename;
	schema.virtual('id').get(function() { return toGlobalId(typename, this._id); });
	schema.methods.toNode = function() { return this.toObject({ node: true }); };
	schema.methods.toEdge = function() { return edge(this.toNode(), getToCursor()); }

	function plainToCursor(node) { return node[index]; };
	function getFromCursor(options) {
		return (
			options.fromCursor ||
			fromCursor ||
			index === '_id' && idFromCursor ||
			plainFromCursor
		);
	}
	function getToCursor(options) {
		return (
			options.toCursor ||
			toCursor ||
			index === '_id' && idToCursor ||
			plainToCursor
		);
	}

	const interfaces = [];
	const indexes = schema.statics.indexes = schema.indexes().map(([index]) => ({
		name: Object.keys(index)[0],
		id: schema.path(Object.keys(index)[0]).instance === 'ObjectID',
	}));

	schema.statics.connection = schema.statics.resolve = async function connection(args, condition, options = {}) {
		const conditions = [];
		if (condition)
			conditions.push(condition);

		if (args) {
			for (let { name, id } of indexes) {
				if (Object.hasOwnProperty.call(args, name)) {
					if (Array.isArray(args[name]))
						conditions.push({ [name]: { $in: id ? args[name].map(id => fromGlobalId(id).id) : args[name] } });
					else
						conditions.push({ [name]: id ? fromGlobalId(args[name]).id : args[name] });
				}
			}
		}

		const { before, after, first, last } = args;
		const fromCursor = getFromCursor(options);
		if (after)
			conditions.push({ [index]: { $gt: fromCursor(after) } });
		if (before)
			conditions.push({ [index]: { $lt: fromCursor(before) } });
	
		const nodes = (await this.find({ $and: conditions }, null, {
			sort: index,
			...options,
			skip: (first - last) || 0,
			limit: last || first,
		})).map(toNode);
	
		const toCursor = getToCursor(options);
		return page(nodes, args, toCursor);
	};
	schema.statics.list = function list(ids, condition, options = {}) {
		const conditions = [];
		if (condition)
			conditions.push(condition);
	
		if (ids != null)
			conditions.push({ _id: { $in: ids.map(toObjectId) } });
	
		return this
			.find({ $and: conditions }, null, { sort: index, ...options })
			.then(docs => ids
				? ids.map(id => docs.find(doc => String(doc._id) === String(id)))
				: docs)
			.then(docs => docs.map(toNode));
	};
	schema.statics.node = function node(id, condition, options = {}) {
		const conditions = [];
		if (condition)
			conditions.push(condition);
	
		if (id) {
			conditions.push({ _id: toObjectId(id) });
		}
	
		return this
			.findOne({ $and: conditions }, null, { sort: index, ...options })
			.then(toNode);
	};

	// Create class for toObject({ node: true }) transform
	function Class(doc) {
		this._doc = doc;
		this._id = doc._id;
		this.__typename = typename;
		this.id = toGlobalId(typename, doc._id);
		this._get = function(name) {
			return doc.get(name);
		};
		return this;
	}
	for (let [name, def] of Object.entries(schema.paths)) {
		if (name === '_id')
			continue;

		const { node, list, connection, query, transform } = (def.instance === 'Array'
			? def.caster.options || def.options
			: def.options) || {};

		if (connection) {
			Class.prototype[name] = async function(args, { db }) {
				const model = db.model(connection);
				const value = await this._get(name) || [];
				if (!model || !value.length)
					return page(slice(value.map(toNode), args), args);
				return model.connection(args, { ...queryCondition(query, this, args), _id: { $in: value } });
			};
		} else if (list) {
			Class.prototype[name] = async function(args, { db }) {
				const model = db.model(list);
				const value = await this._get(name) || [];
				if (!model || !value.length)
					return value;
				return model.list(value.map(toObjectId), queryCondition(query, this, args));
			};
		} else if (node) {
			Class.prototype[name] = async function(args, { db }) {
				const model = db.model(node);
				const value = await this._get(name);
				if (!model || !value || value instanceof model)
					return toNode(value);
				return model.node(value, queryCondition(query, this, args));
			};
		} else
			Object.defineProperty(Class.prototype, name, { get() {
				return this._get(name).then(value => typeof transform === 'function' ? transform(value) : value);
			} });
	}
	for (let [name, def] of Object.entries(schema.virtuals)) {
		if (name === 'id')
			continue;
		const get = def.getters.length && def.getters[0];
		if (get) {
			Class.prototype[name] = function(args, ctx, info) {
				return get.call(this._doc, args, ctx, info);
			}
		}
	}
	Object.defineProperty(Class, 'name', { value: typename, writable: false });

	// Set the transform
	if (!schema.options.toObject)
		schema.options.toObject = {};
	const originalTransform = schema.options.toObject.transform;
	schema.options.toObject.transform = function(doc, object, options) {
		if (originalTransform)
			object = originalTransform(object);
		
		if (options && options.node)
			return new Class(doc, object);

		return object;
	};
}

import getTypeDef from './getTypeDef';
import * as resolvers from '../schema/provider/mongoose/resolvers';
import * as mutators from '../schema/provider/mongoose/mutators';

export function buildSchema(db, options) {
	const models = Object.values(db.models).filter(model => model.typename).map(model => getTypeDef(
		model.schema,
		model.typename,
		model.baseModelName ? [model.baseModelName] : [],
		model.indexes
	));

	return _buildSchema(
		models,
		{
			resolvers,
			mutators,
			...options
		}
	);
}