import {
	Types
} from 'mongoose';
import {
	isPlainObject,
	mapValues
} from 'lodash';
import {
	fromGlobalId,
	toGlobalId
} from 'graphql-relay';
import {
	toNode,
	connection,
	fromBase64
} from '../../../util';

export function resolveProperty(name, transform) {
	return transform
		? async rootValue => transform(await rootValue[name], toGlobalId)
		: rootValue => rootValue[name];
}
export function resolveObject(model) {
	return async function(rootValue, args, context, info) {
		const model = context.db.model();
		return model.findById(await rootValue[name]).then(toNode);
	}
}
export function resolvePropertyObject(name, model) {
	return async function(rootValue, args, context, info) {
		return model.findById(await rootValue[name]).then(toNode);
	}
}
export function resolveList(name, model) {
	return async function(rootValue, args, context, info) {
		const value = await rootValue[name] || [];
		return model.find({ _id: { $in: value } })
			.then(objects => value.map(id => objects.find(node => String(node._id) === String(id))))
			.then(objects => objects.map(toNode));
	}
}
export function resolveConnection(model, indexes) {
	return async function(rootValue, args, context, info) {
		const { before, after, first, last, ids, ...query } = args;

		if (indexes)
			for (let name in indexes)
				if (query.hasOwnProperty(name) && indexes[name].kind === 'node')
					query[name] = fromGlobalId(query[name]).id;

		if (after)
			query._id = { ...(query._id || {}), $gt: after };
		if (before)
			query._id = { ...(query._id || {}), $lt: before };

		const nodes = (await model.find(query, null, {
			skip: (first - last) || 0,
			limit: last || first,
			sort: '_id'
		})).map(toNode);

		return connection(nodes, args, ({ _id }) => _id);
	}
}
export function resolvePropertyConnection(name, model, indexes) {
	const resolve = model && resolveConnection(model, indexes);
	return async function(rootValue, args, context, info) {
		const edges = await rootValue[name] || [];
		if (resolve)
			return resolve(rootValue, { ...args, _id: { $in: edges } });
		else
			return connection(edges, args, ({ _id }) => _id);
	}
}
export function resolveNode(models, viewer) {
	return function(rootValue, args, context, info) {
		const { id, type } = fromGlobalId(args.id);
		if (type === 'viewer')
			return viewer;
		else
			return models.find(({ name }) => name == type).source.findById(id).then(toNode);
	}
}

export function resolveType(objectTypes) {
	return function(value, context, info) {
		if (!value.__t)
			throw new Error(`no __t for ${value}`)
		return objectTypes[value.__t];
	}
}