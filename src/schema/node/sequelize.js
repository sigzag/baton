import {
	toPairs,
	omit,
	mapValues,
	chain,
	shallowEqual,
	memoize
} from 'lodash';
import {
	collection
} from 'relay-baton/util';

const reservedKeywords = [
	// actions
	'destroy',
	'update',
	// db fields
	'__id',
	// graphql fields
	'__typename',
	'id'
];
function checkReservedKeywords(Node) {
	let err;
	for (let name of Object.keys(Node.relations))
		if (~reservedKeywords.indexOf(name)) {
			err = true;
			console.warn(`Nodetype ${Node.typename} may not have a relation called '${name}'`);
		}
	for (let name of Object.keys(Node.properties))
		if (~reservedKeywords.indexOf(name)) {
			err = true;
			console.warn(`Nodetype ${Node.typename} may not have a property called '${name}'`);
		}
	if (err)
		throw new Error('Relation/property names clash with reserved keywords');
}

function update(object, nextData) {
	object[dataSymbol] = { ...object[dataSymbol], ...nextData };
	object[fetchedSymbol] = { ...object[fetchedSymbol], ...mapValues(nextData, () => true) };
	return nextData;
}
async function fetch(object, names) {
	if (!names)
		return;
	let singular;
	if (!Array.isArray(names)) {
		singular = true;
		names = [names];
	}

	const data = names
		.filter(name => object[fetchedSymbol][name])
		.reduce((data, name) => ({ ...data, [name]: object[dataSymbol][name] }), {});
	
	const fetch = names.filter(name => !object[fetchedSymbol][name]);
	if (fetch.length) {
		const Node = object.constructor;
		Object.assign(
			data,
			await Node.table
				.select(columnsFromNames(Node, fetch))
				.where('id', dbID(object))
		);
	}

	update(object, data);
	if (singular)
		return data[names[0]];
	else
		return data;
}

function nodeRelationGetter(name, def) {
	if (def.query)
		return async function(args, ctx, info) {
			const node = await def.type.findOne(query(this), info);
			update(this, { [name]: node });
			if (args === false)
				return node.__id;
			return node;
		}
	if (def.localField)
		return async function(args, ctx, info) {
			const nodeOrId = await fetch(this, name);
			
			if (!nodeOrId)
				return null;
			if (args === false)
				return nodeOrId instanceof Node
					? nodeOrId.__id
					: nodeOrId;
			if (nodeOrId instanceof Node)
				return nodeOrId;
	
			const node = await def.type.findById(nodeOrId, info);
			update(this, { [name]: node });
			return node;
		}
	else
		return async function(args, ctx, info) {
			const node = await def.type.findOne({ [def.field]: this.__id }, info);
			update(this, { [name]: node });
			if (args === false)
				return node.__id;
			return node;
		}
}
function listRelationGetter(name, def) {
	return memoize(async function(args, ctx, info) {
		return await def.type.findByRelation({ def, id: this.__id, ...args }, info);
	});
}
function connectionRelationGetter(name, def) {
	return memoize(async function(args, ctx, info) {
		return connection(
			await def.type.findByRelation({ def, id: this.__id, ...args }, info),
			args,
			def.cursor || def.type.cursor
		);
	});
}

function getRelationDefinition(name, def) {
	return {
		value: def.connection
			? connectionRelationGetter(name, def)
			: (def.list
				? listRelationGetter(name, def)
				: nodeRelationGetter(name, def)),
		writable: false
	};
}
function getPropertyDefinition(name, def) {
	return {
		async value() {
			const value = await fetch(this, name);
			if (def.get)
				return def.get(value);
			return value;
		},
		writable: false
	};
}

function hasRelation(Node, name) {
	return Node.relations[name] && !Node.relations[name].list && !Node.relations[name].connection;
}
function hasLocalRelation(Node, name) {
	return Node.relations[name] && Node.relations[name].localField;
}
function hasForeignRelation(Node, name) {
	return Node.relations[name] && !Node.relations[name].localField;
}

function columnAlias(Node, name) {
	const def = Node.properties[name] || Node.relations[name] || {};
	const field = def.field || def.localField;
	return field
		? `${field} as ${name}`
		: name;
}
function columnName(Node, name) {
	const def = Node.properties[name] || Node.relations[name] || {};
	return def.field || def.localField || name;
}

function columnsFromNames(Node, names) {
	return [
		'id',
		...names.map(name => `${columnName(Node, name)} as ${name}`),
		...toPairs(Node.properties)
			.filter(([name, def]) => def.required)
			.map(([name]) => columnAlias(Node, name))
	];
}
function columnsFromInfo(Node, info) {
	if (info)
		return [
			'id',
			...info.fieldNodes[0].selectionSet.selections
				.map(({ name: { value: name } }) => columnAlias(Node, name)),
			...toPairs(Node.properties)
				.filter(([name, def]) => def.required)
				.map(([name]) => columnAlias(Node, name))
		];

	return [
		'id',
		...toPairs(Node.properties)
			.map(([name]) => columnAlias(Node, name)),
		...toPairs(Node.relations)
			.filter(([name, def]) => !def.list && !def.connection && hasLocalRelation(Node, name))
			.map(([name]) => columnAlias(Node, name))
	];
}

function dbValue(Node, name, value) {
	if (Node.relations[name] && Node.relations[name].set)
		return Node.relations[name].set(value);
	else if (Node.relations[name] || name === 'id')
		return dbID(value);
	else if (Node.properties[name].set)
		return Node.propeties[name].set(value);
	else
		return value;
}
function dbID(id) {
	if (!id)
		return null;
	id = id.__id || id.id || id;
	return String(id).split(':').pop();
}
function gqlID(node) {
	return `${node.__typename}:${node.__id}`;
}

const dataSymbol = Symbol();
const fetchedSymbol = Symbol();

function mapQuery(Node, query) {
	if (typeof query === 'function')
		return query;
	return chain(query)
		.mapValues((value, name) => dbValue(this, name, value))
		.mapKeys((value, name) => columnName(this, name))
		.value();
}

export default class Node {
	static on() {}
	static trigger() {}

	static indexes = {};
	static properties = {};
	static relations = {};

	static typename = null; // Defaults to class.name
	static table = null; // Should be implemented
	
	static cursor(node) { return node.__id; }

	// Queries
	static find(query, info) {
		return this.table
			.select(columnsFromInfo(this, info))
			.where(mapQuery(this, query))
			.then(records => records.map(record => new this(record)));
	}
	static findOne(query, info) {
		return this.table
			.select(columnsFromInfo(this, info))
			.where(mapQuery(this, query))
			.limit(1)
			.then(([record]) => new this(record));
	}
	static findById(id, info) {
		return this.table
			.select(columnsFromInfo(this, info))
			.where('id', dbID(id))
			.then(([record]) => new this(record));
	}
	static findByRelation({ def, id, before, after, first, last, ...indexes }, info) {
		const query = toPairs(this.indexes)
			.filter(([name]) => indexes.hasOwnProperty(name))
			.reduce((where, [name, def]) => ({ ...where, [name]: indexes[name] }), { [def.field]: id });

		if (first || last) {
			if (after)
				query.id = { ...(query.id || {}), $gt: cursorToId(after) };
			if (before)
				query.id = { ...(query.id || {}), $lt: cursorToId(before) };
	
			return this.table
				.select(columnsFromInfo(this, info))
				.where(mapQuery(this, query))
				.orderBy('id')
				.offset((first - last) || 0)
				.limit(last || first)
				.then(records => records.map(record => new this(record)));
		} else {
			return this.table
				.select(columnsFromInfo(this, info))
				.where(mapQuery(this, query))
				.orderBy('id')
				.then(records => records.map(record => new this(record)));
		}
	}

	// Static actions
	static async destroy(query) {
		const localRelations = chain(this.relations)
			.pickBy((def, name) => hasLocalRelation(this, name) && def.destroy)
			.value();

		const foreignRelations = chain(this.relations)
			.pickBy((def, name) => hasForeignRelation(this, name) && def.destroy)
			.value();

		const records = this.table
			.select(columnsFromNames(this, Object.keys(localRelations)))
			.where(mapQuery(this, query));

		return Promise.all([
			this.table.where(query).del(),
			...records.reduce((all, { id, ...relations }) => [
				...all,
				...map(relations, (name, id) => this.relations[name].type.destroy({ id })),
				...map(foreignRelations, (name, def) => def.type.destroy({ [def.field]: id }))
			], [])
		]);
	}
	static async update(id, values) {
		id = dbID(id)

		const properties = chain(values)
			.pickBy((value, name) => this.properties[name])
			.mapValues((value, name) => dbValue(this, name, value))
			.mapKeys((value, name) => columnName(this, name))
			.value();

		// Get local relation ids
		const relations = chain(values)
			.pickBy((value, name) => hasRelation(this, name))
			.value();

		const localRelations = chain(relations)
			.pickBy((value, name) => hasRelation(this, name))
			.mapKeys((value, name) => this.relations[name].localField)
			.value();
		
		const foreignRelations = chain(relations)
			.pickBy((value, name) => hasForeignRelation(this, name))
			.value();

		await Promise.all([
			(Object.keys(properties).length + Object.keys(localRelations).length) &&
				this.table
					.where('id', dbID(id))
					.update({ ...properties, ...localRelations }),
			...toPairs(foreignRelations)
				.map(([name, foreignId]) => this.relations[name].type.update(foreignId, { [this.relations[name].field]: id }))
		]);

		return {
			...values,
			...relations
		};
	}

	// Creation
	static async create(values) {
		const properties = chain(values)
			.pickBy((value, name) => this.properties[name])
			.mapValues((value, name) => dbValue(this, name, value))
			.mapKeys((value, name) => columnName(this, name))
			.value();

		const relations = chain(values)
			.pickBy((value, name) => hasRelation(this, name))
			.value();

		const localRelations = chain(relations)
			.pickBy((value, name) => hasLocalRelation(this, name))
			.mapValues(dbID)
			.mapKeys((value, name) => this.relations[name].localField)
			.value();

		const foreignRelations = chain(relations)
			.pickBy((value, name) => hasForeignRelation(this, name))
			.value();

		// Create local relations
		await Promise.all(toPairs(Node.relations)
			.filter(([name, def]) => def.create && !relations[name] && hasLocalRelation(this, name))
			.map(async ([name, def]) => {
				relations[name] = await def.type.create();
				localRelations[def.localField] = relations[name].__id;
			}));

		return this.table
			.returning(['id', ...columnsFromNames(Object.keys(properties))])
			.insert({ ...properties, ...localRelations })
			.then(record => new this(record))
			.then(async node => {
				await Promise.all([
					// Update foreign relations
					...toPairs(foreignRelations)
						.map(([name, id]) => this.relations[name].type.update(id, { [this.relations[name].field]: node.__id })),
					// Create foreign relations
					...toPairs(Node.relations)
						.filter(([name, def]) => def.create && !values[name] && hasForeignRelation(this, name))
						.map(async ([name, def]) => relations[name] = await def.type.create({ [def.field]: node.__id }))
				]);

				update(node, { ...values, ...relations });
				return node;
			});
	}
	static findOrCreate(query, properties) {
		return this.findOne(query)
			.then(node => node || this.create(properties || query));
	}

	constructor(data) {
		checkReservedKeywords(this.constructor);

		for (let [name, def] of toPairs(this.constructor.relations))
			Object.defineProperty(this, name, getRelationDefinition(name, def));
		for (let [name, def] of toPairs(this.constructor.properties))
			Object.defineProperty(this, name, getPropertyDefinition(name, def));

		update(this, data);
	}

	[dataSymbol] = {};
	[fetchedSymbol] = {};
	
	// Actions
	async update(values) {
		for (let name in values) {
			const def = Object.getPropertyDefinition(this, name);
			if (def && def.set)
				def.set.call(this, name, values);
		}
		update(this, await this.constructor.update(this, values));
		return this;
	}
	async destroy() {
		return this.constructor.destroy({ id: this.__id });
	}

	// DB id
	get __id() { return this[dataSymbol].id; }

	// GraphQL props
	get __typename() { return this.constructor.typename; }
	get id() { return gqlID(this); }
}