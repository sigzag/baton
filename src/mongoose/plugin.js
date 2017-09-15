import { toNode, page, slice } from '../util';
import { Schema } from 'mongoose';
import { toGlobalId, fromGlobalId } from 'graphql-relay';
import toObjectId from './toObjectId';

async function resolveConnection({ before, after, first, last, ...args }, conditions = [], options = {}) {
	if (options.indexes)
		for (let name in options.indexes)
			if (args.hasOwnProperty(name) && options.indexes[name].kind === 'node')
				conditions.push({ [name]: fromGlobalId(args[name]).id });
			else if (args.hasOwnProperty(name))
				conditions.push({ [name]: args[name] });

	const index = options.index || '_id';
	const getIndexValue = options.getIndexValue || (index === '_id'
		? (cursor) => fromGlobalId(cursor).id
		: (cursor) => cursor);
	if (after)
		conditions.push({ [index]: { $gt: getIndexValue(after) } });
	if (before)
		conditions.push({ [index]: { $lt: getIndexValue(before) } });

	const nodes = (await this.find({ $and: conditions }, null, {
		skip: (first - last) || 0,
		limit: last || first,
		sort: '_id',
		...options
	})).map(toNode);

	return page(nodes, args, options.getCursor);
}
function resolveList(ids, conditions = [], options = {}) {
	if (ids != null) {
		conditions.push({ _id: { $in: ids.map(toObjectId) } });
	}

	return this
		.find({ $and: conditions }, null, { sort: '_id', ...options })
		.then(docs => ids
			? ids.map(id => docs.find(doc => String(doc._id) === String(id)))
			: docs)
		.then(docs => docs.map(toNode));
}
function resolveNode(id, conditions = [], options) {
	if (conditions.length) {
		if (id)
			conditions.push({ _id: id });
		return this
			.findOne({ $and: conditions }, options)
			.then(toNode);
	}

	return this
		.findById(toObjectId(id), options)
		.then(toNode);
}

export default function(schema, options = {}) {
	const { typename } = options;

	function getConditions(rootValue, args, query) {
		return [
			typeof options.query === 'function'
				? options.query(rootValue, args)
				: options.query || {},
			typeof query === 'function'
				? query(rootValue, args)
				: query || {}
		];
	}
	
	// Create model connection resolver
	schema.statics.connection = resolveConnection;
	schema.statics.list = resolveList;
	schema.statics.node = resolveNode;
	schema.statics.typename = typename;
	schema.virtual('id', function() { return toGlobalId(typename, this._id) });
	schema.methods.toNode = function() { return this.toObject({ node: true }); };

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
		const { node, list, connection, query } = (def.instance === 'Array'
			? def.caster.options || def.options
			: def.options) || {};

		if (connection) {
			Class.prototype[name] = async function(args, { db }) {
				const model = db.model(connection);
				const value = await this._get(name) || [];
				if (!model || !value.length)
					return page(slice(value.map(toNode), args), args);
				return model.connection(args, [{ _id: { $in: value } }, ...getConditions(this, args, query)]);
			};
		} else if (list) {
			Class.prototype[name] = async function(args, { db }) {
				const model = db.model(list);
				const value = await this._get(name) || [];
				if (!model || !value.length)
					return value;
				return model.list(value, getConditions(this, args, query));
			};
		} else if (node) {
			Class.prototype[name] = async function(args, { db }) {
				const model = db.model(node);
				const value = await this._get(name);
				if (!model || !value || value instanceof model)
					return toNode(value);
				return model.node(value);
			};
		} else
			Class.prototype[name] = function() { return this._get(name); };
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