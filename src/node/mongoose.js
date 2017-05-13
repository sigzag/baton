import {
	mapValues,
	toPairs,
	reduce,
	pick
} from 'lodash';
import {
	connection as _connection
} from '../util';

function cursorToId(a) { return a.split(':')[1]; }

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
	}
}

export function connectionQueryArgs(model, { before, after, first, last, order = 'id', ...indexes }, query = {}) {
	for (let [name, type] of model.indexes)
		if (indexes.hasOwnProperty(name) && type === GraphQLID)
			query[name] = fromGlobalId(indexes[name]).id;

	if (after)
		query._id = { ...(query._id || {}), $gt: cursorToId(after) };
	if (before)
		query._id = { ...(query._id || {}), $lt: cursorToId(before) };

	return [query, null, {
		skip: (first - last) || 0,
		limit: last || first,
		sort: !order || order === 'id' ? '_id' : order
	}];
}
export function connection(records, args, getCursor) {
	return _connection(resolveDocument(records || []), args, getCursor);
}
function resolveDocument(doc) {
	if (Array.isArray(doc))
		return doc.map(resolveDocument);
	else if (doc && TYPES.has(doc.Model))
		return new (TYPES.get(doc.Model))(doc);
	else
		return doc;
}
function associationResolver(associations, prop) {
	const assoc = associations[prop];
	if (assoc.options.connection)
		return {
			value(rootValue, args) {
				return this[source][assoc.accessors.get](...connectionQueryArgs(assoc.target, args))
					.then(records => connection(records, args));
			}
		};
	else {
		return {
			get() {
				return this[source][prop] || this[source][assoc.accessors.get](assoc.options.defaultOptions)
					.then(record => record || this[source][assoc.accessors.create]({}))
					.then(resolveDocument)
					.then(result => this.setDataValue(prop, result));
			}
		};
	}
}

export const source = Symbol();
export const model = Symbol();
export class Node {
	static register(Model, ...names) {
		this[model] = Model;
		names.push(this.name);
		Model.testId = id => this.id === id || ~names.indexOf(id.split(':')[0]);
		Model.objectType = this;
	}

	static count(...args) {
		return this[model].count(...args);
	}
	static find(...args) {
		return this[model].find(...args).then(resolveDocument);
	}
	static findOne(...args) {
		return this[model].findOne(...args).then(resolveDocument);
	}
	static connection(query, args) {
		return this[model].find(connectionQuery(this[model], args, query.where)).then(records => connection(records, args));
	}
	static findById(id, ...args) {
		if (this.id === id)
			return this;
		id = typeof id === 'string'
			? id.split(':').pop()
			: id;
		return this[model].findById(id, ...args).then(resolveDocument);
	}
	static create(...args) {
		return this[model].create(...args).then(resolveDocument);
	}

	getDataValue(prop) {
		return this[source].getDataValue(prop);
	}
	setDataValue(prop, value) {
		return this[source][prop] = value;
	}
	set(prop, value) {
		if (Object.getOwnPropertyDescriptor(this, prop) && Object.getOwnPropertyDescriptor(this, prop).set)
			return this[prop] = value;
		else
			return this.setDataValue(prop, value);
	}
	save(...args) {
		return this[source].save(...args);
	}
	update(values, ...args) {
		for (let prop in values)
			this.set(prop, values[prop]);
		return this.save(...args);
	}
	destroy() {
		return this[source].destroy();
	}

	event(type) {
		return `${this.id}:${type}`;
	}

	constructor(data = {}) {
		this[source] = data;
		const model = TYPES.get(this.constructor);
		if (model) {
			const descriptors = {
				...Object.getOwnPropertyDescriptors(Node.prototype),
				...Object.getOwnPropertyDescriptors(this.constructor.prototype)
			};
			const skip = Object.keys(descriptors).filter(prop => descriptors[prop].get || descriptors[prop].value);

			for (let [name, field] in toPairs(model.fields)) {
				const type = getType(field);
				
			}

			for (let prop in model.attributes) {
				if (~skip.indexOf(prop))
					continue;
				else
					Object.defineProperty(this, prop, {
						get() {
							return data[prop];
						}
					});
			}
			for (let prop in model.associations) {
				if (~skip.indexOf(prop))
					continue;
				else if (data.dataValues.hasOwnProperty(prop))
					this[prop] = resolveDocument(data.getDataValue(prop));
				else
					Object.defineProperty(this, prop, associationResolver(model.associations, prop));
			}
		}
	}

	get __typename() { return this.constructor.typename || this.constructor.name; }
	get id() { return `${this.__typename}:${this[source].id}`; }
	get dbId() { return this[source].id; }
}