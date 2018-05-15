import { toBase64, connection } from '../util';

export const ID = (object) => object && (
	object._id ||
	object.id ||
	object
);

export class Node {
	static table = null;
	static cursor = 'id';
	
	static async query(query) {
		const records = await db.query(`SELECT * FROM ${this.table.name} ${query}`, {
			model: this.table,
			type: Sequelize.QueryTypes.SELECT,
			raw: false,
		});
		return records.map((record) => new this(record));
	}
	static async node(where, rest = {}) {
		if (typeof where === 'string') {
			const [node] = await this.query(`${where} LIMIT 1`);
			return node;
		} else {
			return this.findOne(where, rest);
		}
	}
	static async connection({ before, after, first, last }, query) {
		const offset = (before || after) && `AND ${this.cursor} ${before ? '<' : '>'} ${before || after}`;
		const limit = !isNaN(first || after) && `LIMIT ${first || after}`;
		const order = `ORDER BY ${this.cursor} ${before ? 'DESC' : 'ASC'}`;
		
		const nodes = await this.query(`WHERE (${query}) ${offset || ''} ${limit || ''} ${order || ''}`);
		if (before) nodes.reverse();
		return connection(nodes, args)
	}

	static async create(data) {
		const record = await this.table.create(data);
		return new this(record);
	}
	static async findAll(where, rest = {}) {
		const records = await this.table.findAll({ where, ...rest });
		return records.map((record) => new this(record));
	}
	static async findOne(where, rest = {}) {
		const record = await this.table.findOne({ where, ...rest });
		return record && new this(record);
	}
	static async findById(id) {
		const record = await this.table.findById(ID(id));
		return record && new this(record);
	}
	static async findOrCreate(where, defaults) {
		const [record] = await this.table.findOrCreate({ where, defaults });
		return new this(record);
	}

	constructor(record) {
		this._record = record;
		this._id = record.id;
	}

	update(...args) {
		return this._record.update(...args);
	}
	destroy() {
		return this._record.destroy();
	}

	__typename() {
		return this.constructor.name;
	}
	id() {
		return toBase64(`${this.__typename}:${this._id}`);
	}
	equals(other) {
		return other && (this === other || this._id === ID(other));
	}
}

export default function(table) {
	class Type extends Node {}
	for (const prop of Object.keys(table.properties))
		Type.prototype[prop] = function() { return this._record.get(prop); }
	return Type;
}
