import {
	capitalize,
	camelCase
} from 'lodash';

function getArgs(type) {
	if (type.connection)
		return ' (first: Int after: Cursor last: Int before: Cursor)';
	if (type.list)
		return ' (start: Int end: Int)';
	else
		return '';
}
function getType(type) {
	if (type.enum)
		return type.enum;
	if (type.objectType)
		return type.objectType;
	if (type.connection)
		return `Connection(${type.connection})`;
	if (type.list)
		return `[${getType(type.list)}]`;
	return type;
}
function getInputType(type) {
	if (type.enum)
		return type.enum;
	if (type.objectType)
		return 'ID';
	if (type.list)
		return `[${getInputType(type.list)}]`;
	return type;
}
function getInterfaces(interfaces = []) {
	interfaces = interfaces.filter(x => x);
	return interfaces.length
		? ` implements ${interfaces.join(' ')}`
		: '';
}

class ObjectType {
	constructor(model) {
		Object.assign(this, model);
	}

	inputName = `${this.name}Input`;
	edgeName = `${this.name}Edge`;
	mutations = [Add, Update, Remove].map(Mutation => new Mutation(this));

	definition = `
		type ${this.name}${getInterfaces(this.interfaces)} {
			${this.fields
				.map(({ name, type }) => `${name}${getArgs(type)}: ${getType(type)}`)
				.join('\n')}
		}
	`;
	inputDefinition = `
		input ${this.inputName} {
			__parent: ID
			__id: ID
			${this.fields
				.filter(({ type }) => !type.connection)
				.map(({ name, type }) => `${name}: ${getInputType(type)}`)
				.join('\n')}
		}
	`;
}
class Enum {
	constructor(model) {
		Object.assign(this, model);
	}
	definition = `enum ${this.name} { ${this.values.join(' ')} }`;
}

// Mutations
class Mutation {
	inputName = `${this.name}Input`;
	field = `${name}(input: ${this.inputName}): ${name}Payload`;
	definition = `${this.input} ${this.payload}`;
}
class Add extends Mutation {
	name = `Add${this.type.name}`;
	inputName = this.type.inputName;
	input = this.type.inputDefinition;
	payload = `type ${this.name}Payload { parent: Node edge: ${this.type.edgeName} }`;
}
class Update extends Add {
	name = `Update${this.type.name}`;
	payload = `type ${this.name}Payload { parent: Node node: ${this.type.name} }`;
}
class Remove extends Mutation {
	name = `Remove${this.type.typeName}`;
	input = `input ${this.name}Input { __parent: ID __id: ID! }`;
	payload = `type ${this.name}Payload { parent: Node id: ID }`;
}

export default function(models) {
	const objectTypes = [];
	const enumTypes = [];
	for (let model of models) {
		objectTypes.push(model);
		for (let field of model.fields)
			if (field.enum)
				enumTypes.push(new Enum(field));
	}
	
	return `
${enumTypes.map(({ definition }) => definition).join('\n')}
${objectTypes.map(({ definition }) => definition).join('\n')}
${objectTypes.map(({ mutations }) => mutations.map(({ definition }) => definition).join('\n')).join('\n')}

type Query {
	node(id: ID!): Node!
	viewer: Viewer!
}
type Mutation {
	${objectTypes.map(({ mutations }) => mutations.map(({ field }) => field).join('\n')).join('\n')}
}
type Subscription {}
	`;
}