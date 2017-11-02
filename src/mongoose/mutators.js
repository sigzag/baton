import {
	fromGlobalId
} from 'graphql-relay';
import {
	values,
	mapValues,
	mapKeys,
	omit,
	chain
} from 'lodash';

function resolveIdFields(input, idFields, transforms = {}) {
	return chain(input)
		.mapValues((value, field) => value && ~idFields.indexOf(field)
			? (Array.isArray(value)
				? value.map(({ id }) => id && fromGlobalId(id).id).filter(x => x)
				: value.id && fromGlobalId(value.id).id)
			: value
		)
		.mapValues((value, field) => value && transforms[field]
			? transforms[field](value, fromGlobalId)
			: value
		)
		.omit(['id', 'clientMutationId', 'parent', 'connectionName'])
		.value();
}

export function addMutation(model, options) {
	const idFields = values(model.schema.paths)
		.filter(path => path.options && path.options.ref)
		.map(field => field.path);
	return async function(input, context, info) {
		const node = await (input.id
			? model.findById(fromGlobalId(input.id).id)
			: model.create(resolveIdFields(input, idFields)));

		if (input.parent) {
			const { id, type } = fromGlobalId(input.parent);
			const parent = await options.findModel(type).findById(id);
			parent[input.connectionName].addToSet(node);
			await parent.save();

			return {
				parent,
				node
			};
		}
		
		return {
			node	
		};
	}
}
export function updateMutation(model, options) {
	const idFields = values(model.schema.paths)
		.filter(path => path.options && path.options.ref || path.caster && path.caster.options && path.caster.options.ref)
		.map(field => field.path);
	const transforms = values(model.schema.paths)
		.filter(field => field.options && field.options.inverseTransform)
		.reduce((transforms, field) => ({
			...transforms,
			[field.path]: field.options.inverseTransform
		}), {});
	return async function(input, context, info) {
		const node = await model.findById(fromGlobalId(input.id).id);

		node.set(resolveIdFields(input, idFields, transforms));
		await node.save();

		return node;
	}
}
export function removeMutation(model, options) {
	return async function(input, context, info) {
		const node = await model.findById(fromGlobalId(input.id).id);

		if (input.parent) {
			const { id, type } = fromGlobalId(input.parent);
			const parent = await options.findModel(type).findById(id);
			parent[input.connectionName].pull(node);
			
			const owner = values(model.schema.paths)
				.find(path => path.options && path.options.childPath === input.connectionName);

			await Promise.all([
				parent.save(),
				owner && node.remove()
			]);

			return {
				parent,
				id: input.id
			}
		} else {
			await node.remove();
			return {
				id: input.id
			};
		}
	}
}

export function updateGraphMutation(model, field, options) {
	return async function(input, context, info) {
		const node = await model.findById(fromGlobalId(input.id).id);

		await node.update(mapKeys(JSON.parse(input.diff), (val, key) => `${field.name}.${key}`));

		return node;
	}
}

// not really used I believeth
export function updateInArrayMutation(parentModel, connectionName, options) {
	// const idFields = values(childModel.schema.paths)
	// 	.filter(path => path.options && path.options.ref)
	// 	.map(field => field.path); // not correct, issit
	return async function(input, context, info) {
		const { id } = fromGlobalId(input.id);
		
		const parent = await model.find({ [`${connectionName}._id`]: id });
		const child = parent[connectionName].id(id);

		child.set(resolveIdFields(input, idFields));
		parent.markModified(connectionName);
		await parent.save();

		return child;
	}
}
export function addToArrayMutation(parentModel, connectionName, options) {
	// const idFields = values(childModel.schema.paths)
	// 	.filter(path => path.options && path.options.ref)
	// 	.map(field => field.path); // ditto
	return async function(input, context, info) {
		const { id: parentId } = fromGlobalId(input.parent);

		const parent = await parentModel.findById(parentId);
		const child = parent[connectionName].create(resolveIdFields(input, idFields));
		parent[connectionName].addToSet(child);
		await parent.save();

		return {
			parent,
			child
		};
	}
}
export function removeFromArrayMutation(schema, parentModel, connectionName, options) {
	return async function(input, context, info) {
		const { id: parentId } = fromGlobalId(input.parent);
		const { id: childId } = fromGlobalId(input.id);

		const parent = await parentModel.findById(parentId);
		const child = parent[connectionName].id(childId);
		parent[connectionName].pull(child);
		await parent.save();

		return {
			parent,
			id: input.id
		};
	}
}