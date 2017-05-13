import {
	values,
	toPairs
} from 'lodash';
import {
	toCollectionName
} from 'mongoose/lib/utils';
import {
	GraphQLObjectType,
	GraphQLInterfaceType
} from 'graphql/type';

function capitalize(str) { return str[0].toUpperCase() + str.slice(1); }

function add(type) {
	const types = toCollectionName(type);
	const Type = capitalize(type);
	return `
export class Add${Type} extends Mutation {
	static fragments = { viewer: () => Relay.QL\`fragment on viewer { id }\` };
	getMutation = () => Relay.QL\`mutation { Add${Type} }\`;
	getVariables = () => this.props.properties;
	getFatQuery = () => Relay.QL\`fragment on Add${Type}Payload { viewer { ${types} } edge }\`;
	getConfigs = () => [{
		type: 'RANGE_ADD',
		parentName: 'viewer',
		parentID: this.props.viewer.id,
		connectionName: '${types}',
		edgeName: 'edge',
		rangeBehaviors: {
			'': 'append'
		}
	}];
}`;
}
function update(type, idFields) {
	const Type = capitalize(type);
	return `
export class Update${Type} extends Mutation {
	static fragments = { node: () => Relay.QL\`fragment on ${type} { id }\` };
	getMutation = () => Relay.QL\`mutation { Update${Type} }\`;
	getVariables = () => ({ id: this.props.node.id, ...this.props.properties });
	getFatQuery = () => Relay.QL\`fragment on Update${Type}Payload { updatedNode }\`;
	getOptimisticResponse = () => ({ updatedNode: handleIdFields(this.getVariables(), ${JSON.stringify(idFields)}) })
	getConfigs = () => [{
		type: 'FIELDS_CHANGE',
		fieldIDs: {
			updatedNode: this.props.node.id
		}
	}];
}`;
}
function remove(type) {
	const types = toCollectionName(type);
	const Type = capitalize(type);
	return `
export class Remove${Type} extends Mutation {
	static fragments = { viewer: () => Relay.QL\`fragment on viewer { id }\`, node: () => Relay.QL\`fragment on ${type} { id }\` };
	getMutation = () => Relay.QL\`mutation { Remove${Type} }\`;
	getVariables = () => ({ id: this.props.node.id });
	getFatQuery = () => Relay.QL\` fragment on Remove${Type}Payload { viewer { ${types} } id }\`;
	getOptimisticResponse = () => ({ viewer: this.props.viewer, id: this.props.node.id });
	getConfigs = () => [{
		type: 'NODE_DELETE',
		parentName: 'viewer',
		parentID: this.props.viewer.id,
		connectionName: '${types}',
		deletedIDFieldName: 'id'
	}];
}`;
}

function addTo(type, parentType, connectionName) {
	const types = toCollectionName(type);
	const Types = capitalize(connectionName);
	const ParentType = capitalize(parentType);
	return `
export class Add${capitalize(connectionName)}To${ParentType} extends Mutation {
	static fragments = { parent: () => Relay.QL\`fragment on ${parentType} { id }\` };
	getMutation = () => Relay.QL\` mutation { Add${Types}To${ParentType} } \`;
	getVariables = () => this.props.id
		? { parent: this.props.parent.id, id: this.props.id }
		: { parent: this.props.parent.id, ...this.props.properties };
	getFatQuery = () => Relay.QL\`fragment on Add${Types}To${ParentType}Payload { parent { ${connectionName} } edge }\`;
	getConfigs = () => [{
		type: 'RANGE_ADD',
		parentName: 'parent',
		parentID: this.props.parent.id,
		connectionName: '${connectionName}',
		edgeName: 'edge',
		rangeBehaviors: {
			'': 'append'
		}
	}];
}`;
}
function updateIn(type, parentType, connectionName, idFields) {
	const Types = capitalize(connectionName);
	const ParentType = capitalize(parentType);
	return `
export class Update${Types}In${ParentType} extends Mutation {
	static fragments = { node: () => Relay.QL\`fragment on ${type} { id }\` };
	getMutation = () => Relay.QL\`mutation { Update${Types}In${ParentType} }\`;
	getVariables = () => ({ id: this.props.node.id, ...this.props.properties });
	getFatQuery = () => Relay.QL\`fragment on Update${Types}In${ParentType}Payload { updatedNode }\`;
	getOptimisticResponse = () => ({ updatedNode: handleIdFields(this.getVariables(), ${JSON.stringify(idFields)}) });
	getConfigs = () => [{
		type: 'FIELDS_CHANGE',
		fieldIDs: {
			updatedNode: this.props.node.id
		}
	}];
}`;
}
function removeFrom(type, parentType, connectionName) {
	const Types = capitalize(connectionName);
	const ParentType = capitalize(parentType);
	return `
export class Remove${capitalize(connectionName)}From${ParentType} extends Mutation {
	static fragments = { parent: () => Relay.QL\`fragment on ${parentType} { id }\`, node: () => Relay.QL\`fragment on ${type} { id }\` };
	getMutation = () => Relay.QL\`mutation { Remove${Types}From${ParentType} }\`;
	getVariables = () => ({ parent: this.props.parent.id, id: this.props.node.id });
	getFatQuery = () => Relay.QL\` fragment on Remove${Types}From${ParentType}Payload { parent { ${connectionName} } id }\`;
	getOptimisticResponse = () => ({ parent: this.props.parent, id: this.props.node.id });
	getConfigs = () => [{
		type: 'RANGE_DELETE',
		parentName: 'parent',
		parentID: this.props.parent.id,
		connectionName: '${connectionName}',
		deletedIDFieldName: 'id',
		pathToConnection: ['parent', '${connectionName}']
	}];
}`;
}
function deleteFrom(type, parentType, connectionName) {
	const Types = capitalize(connectionName);
	const ParentType = capitalize(parentType);
	return `
export class Remove${capitalize(connectionName)}From${ParentType} extends Mutation {
	static fragments = { parent: () => Relay.QL\`fragment on ${parentType} { id }\`, node: () => Relay.QL\`fragment on ${type} { id }\`  };
	getMutation = () => Relay.QL\`mutation { Remove${Types}From${ParentType} }\`;
	getVariables = () => ({ parent: this.props.parent.id, id: this.props.node.id });
	getFatQuery = () => Relay.QL\` fragment on Remove${Types}From${ParentType}Payload { parent { ${connectionName} } id }\`;
	getOptimisticResponse = () => ({ parent: this.props.parent, id: this.props.node.id });
	getConfigs = () => [{
		type: 'NODE_DELETE',
		parentName: 'parent',
		parentID: this.props.parent.id,
		connectionName: '${connectionName}',
		deletedIDFieldName: 'id'
	}];
}`;
}

export default function(schema) {
	let output = `
import Relay, { Mutation } from 'react-relay';
export function handleIdFields(response, fields) {
	fields.forEach(function(field) {
		if (response[field] && !response[field].id)
			response[field] = { id: response[field] };
	});
	return response;
}`;
	for (let objectType of values(schema.objectTypes)) {
		const idFields = toPairs(objectType._typeConfig.fields)
			.filter(([name, field]) => field.type instanceof GraphQLObjectType || field.type instanceof GraphQLInterfaceType)
			.map(([name]) => name);
		output += add(objectType.name);
		output += update(objectType.name, idFields);
		output += remove(objectType.name);
		for (let [fieldName, field] of toPairs(objectType._typeConfig.fields)) {
			const connection = Object.keys(schema.connectionDefinitions)
				.map(key => schema.connectionDefinitions[key])
				.find(({ connectionType }) => field.type === connectionType);
			if (connection) {
				const typeName = connection.edgeType._typeConfig.fields().node.type.name
				output += addTo(typeName, objectType.name, fieldName);
				if (field.array)
					output += updateIn(typeName, objectType.name, fieldName, idFields);
				if (field.owner)
					output += deleteFrom(typeName, objectType.name, fieldName);
				else
					output += removeFrom(typeName, objectType.name, fieldName);
			}
		}
	}
	return output;
}