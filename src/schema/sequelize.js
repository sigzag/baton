import { toBase64, connection } from '../util';
import { QueryTypes } from 'sequelize';

export const ID = (object) => object && (
	object._id ||
	object.id ||
	object
);

export class Node {
	static table = null;
	static cursor = 'id';
	
	static async query(query) {
		const records = await this.table.sequelize.query(`SELECT * FROM ${this.table.getTableName()} ${query}`, {
			model: this.table,
			type: QueryTypes.SELECT,
			raw: false,
		});
		return records.map((record) => new this(record));
	}
	static async node(query, rest = {}) {
		if (typeof query === 'string') {
			const [node] = await this.query(`WHERE ${query} LIMIT 1`);
			return node;
		} else {
			return this.findOne(query, rest);
		}
	}
	static async connection(args, query) {
		const { before, after, first, last } = args;

		const reverse = (before || last) != null;

		const offset = (before || after) && `AND ${this.cursor} ${reverse ? '<' : '>'} ${JSON.stringify(before || after)}`;
		const limit = !isNaN(first || last) && `LIMIT ${first || last}`;
		const order = `ORDER BY ${this.cursor} ${reverse ? 'DESC' : 'ASC'}`;
		
		const nodes = await this.query(`WHERE (${query}) ${offset || ''} ${order || ''} ${limit || ''}`);
		if (reverse) nodes.reverse();
		return connection(nodes, args);
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

	get __typename() {
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
	Type.table = table;
	for (const prop of Object.keys(table.attributes))
		if (!(prop in Type.prototype))
			Type.prototype[prop] = function() { return this._record.get(prop); };
	return Type;
}
