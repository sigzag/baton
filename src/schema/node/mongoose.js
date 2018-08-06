import mongoose from 'mongoose';
import { page } from '../util';
import { toNode, resolveConnection } from '../provider/mongoose/resolve';
import { toGlobalId } from 'graphql-relay';

export default function(schema, options = {}) {
	const { typename, name, db } = options;
	const model = db.model(name);
	
	function getQuery(rootValue, args, query) {
		return {
			...(typeof options.query === 'function'
				? options.query(rootValue, args)
				: options.query || {}),
			...(typeof query === 'function'
				? query(rootValue, args)
				: query || {})
		};
	}
	function getArgs(rootValue, args, query) {
		return {
			...args,
			...getQuery(rootValue, args, query)
		};
	}

	const resolver = resolveConnection(model);
	schema.statics.resolve = function(args, query) {
		return resolver(null, getArgs(null, args, query));
	};
	schema.methods.toNode = function() {
		return transforms.reduce((node, path) => ({
			...node,
			path: transforms[path](this)
		}, {
			__typename: typename,
			id: toGlobalId(typename, this._id)
		}));
	};

	const transforms = Object.keys(schema.paths).reduce((transforms, path) => {
		const isArray = schema.paths[path].instance === 'Array';
		const {
			node,
			list,
			connection,
			query
		} = (isArray
			? schema.paths[path].caster.options || schema.paths[path].options
			: schema.paths[path].options) || {};

		const model = mongoose.model(connection || list || node);

		if (connection)
			transforms[path] = doc => async args => {
				const connection = await doc.get(path) || [];
				if (!model || !connection.length)
					return page(connection, args);
				return model.find(getQuery(doc, args, { _id: { $in: connection } })).then(docs => docs.map(toNode));
			};
		else if (list)
			transforms[path] = doc => async args => {
				const list = await doc.get(path) || [];
				if (!model || !list.length)
					return list;
				return model.find(getQuery(doc, args, { _id: { $in: list } })).then(docs => docs.map(toNode));
			};
		else if (node)
			transforms[path] = doc => async args => {
				const node = await doc.get(path);
				if (!node || node instanceof model)
					return toNode(node);
				return model.findById(node).then(toNode);
			};
		else
			transforms[path] = doc => doc.get(path);

		return transforms;
	}, {});
}