import {
	mapValues,
	toPairs,
	reduce,
	pick
} from 'lodash';
import {
	connection as _connection
} from '../util';

const TYPES = new WeakMap();

function cursorToId(a) { return a.split(':')[1]; }

export function connectionQuery(model, { before, after, first, last, order = 'id', ...indexes }, where = {}) {
	for (let [name, type] of toPairs(model.options.indexes))
		if (indexes.hasOwnProperty(name) && TYPES.has(model.associations[name].target))
			where[name] = fromGlobalId(indexes[name]).id;

	if (after)
		where.id = { ...(where.id || {}), $gt: cursorToId(after) };
	if (before)
		where.id = { ...(where.id || {}), $lt: cursorToId(before) };

	return {
		where,
		order,
		offset: (first - last) || 0,
		limit: last || first
	};
}
export function connection(records, args, getCursor) {
	return _connection(resolveRecord(records || []), args, getCursor);
}
function resolveRecord(record) {
	if (Array.isArray(record))
		return record.map(resolveRecord);
	else if (record && TYPES.has(record.Model))
		return new (TYPES.get(record.Model))(record);
	else
		return record;
}
function associationResolver(associations, prop) {
	const assoc = associations[prop]
	if (assoc.options.connection)
		return {
			value(rootValue, args) {
				return this[source][assoc.accessors.get](connectionQuery(assoc.target, args))
					.then(records => connection(records, args));
			}
		};
	else {
		return {
			get() {
				return this[source][prop] || this[source][assoc.accessors.get](assoc.options.defaultOptions)
					.then(record => record || this[source][assoc.accessors.create]({}))
					.then(resolveRecord)
					.then(result => this.setDataValue(prop, result));
			}
		};
	}
}

export const source = Symbol();
export class Node {
	static register(Model, ...names) {
		TYPES.set(Model, this);
		TYPES.set(this, Model);
		names.push(this.name);
		Model.testId = id => this.id === id || ~names.indexOf(id.split(':')[0]);
		Model.objectType = this;
	}

	static count(...args) {
		return TYPES.get(this).count(...args);
	}
	static find(...args) {
		return TYPES.get(this).findAll(...args).then(resolveRecord);
	}
	static findOne(...args) {
		return TYPES.get(this).find(...args).then(resolveRecord);
	}
	static connection(query, args) {
		return TYPES.get(this).findAll(connectionQuery(TYPES.get(this), args, query.where)).then(records => connection(records, args));
	}
	static findById(id, ...args) {
		if (this.id === id)
			return this;
		id = typeof id === 'string'
			? id.split(':').pop()
			: id;
		return TYPES.get(this).findById(id, ...args).then(resolveRecord);
	}
	static create(...args) {
		return TYPES.get(this).create(...args).then(resolveRecord);
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
					this[prop] = resolveRecord(data.getDataValue(prop));
				else
					Object.defineProperty(this, prop, associationResolver(model.associations, prop));
			}
		}
	}

	get __typename() { return this.constructor.typename || this.constructor.name; }
	get id() { return `${this.__typename}:${this[source].id}`; }
	get dbId() { return this[source].id; }
}