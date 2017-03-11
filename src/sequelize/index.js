import {
	mapValues,
	toPairs
} from 'lodash';
import {
	connection as _connection
} from '../util';

const TYPES = new WeakMap();

export function connectionQuery(model, { before, after, first, last, ...where }) {
	for (let [name, type] of toPairs(model.options.indexes))
		if (where.hasOwnProperty(name) && TYPES.has(model.associations[name].target))
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
export function connection(records, args, getCursor) {
	return _connection(records.map(resolveRecord), args, getCursor);
}
function resolveRecord(record) {
	if (record && TYPES.has(record.Model))
		return new TYPES.get(record.Model)(record);
	else
		return record;
}
function associationResolver(assoc) {
	if (assoc.options.connection)
		return (rootValue, args) => rootValue[assoc.accessors.get](connectionQuery(assoc.target, args))
			.then(records => connection(records, args));
	else
		return rootValue => rootValue[assoc.accessors.get]()
			.then(value => Array.isArray(value) ? value.map(resolveRecord) : resolveRecord(value));
}

// Node def
const defaultProperties = {
	get __typename() { return this.constructor.typename || this.constructor.name; },
	get id() { return `${this.__typename}:${this[factory.source].id}`; }
	get dbId() { return this[factory.source].id; }
};

export const source = Symbol();
export class Node {
	static register(Model) {
		TYPES.set(Model, this);
		TYPES.set(this, Model);
	}

	static find(...args) {
		return TYPES.get(this).find(...args).then(res => res.map(resolveRecord));
	}
	static findById(...args) {
		return TYPES.get(this).findById(...args).then(resolveRecord);
	}
	static create(...args) {
		return TYPES.get(this).create(...args).then(res => Array.isArray(res) ? res.map(resolveRecord) : resolveRecord(res));
	}

	destroy() {
		return this[source].destroy();
	}

	constructor(data = {}) {
		this[source] = data;
		if (this.constructor.model)
			Object.assign(this, data.toObject(), mapValues(this.constructor.model.associations, (assoc, key) => data[key]
				? resolveRecord(data[key])
				: associationResolver(assoc)
			), defaultProperties);
		else
			Object.assign(this, data, defaultProperties);
	}
}

