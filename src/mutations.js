import {
	fromGlobalId,
	toGlobalId
} from 'graphql-relay';
import {
	pathPairs
} from './util';

function getRelations(model, options) {
	const relations = {};
	for (let relatedModel of options.models)
		for (let [name, path] of pathPairs(relatedModel.schema.paths))
			if (path.options.ref === model.modelName || path.options.ref === model.baseModelName)
				for (let childPath of [].concat(path.options.childPath || []))
					if (model.schema.path(childPath)) {
						if (!relations[childPath])
							relations[childPath] = {};
						relations[childPath][relatedModel.modelName] = relatedModel;
					}
	for (let relation in relations)
		if (Object.keys(relations[relation]) === 1)
			relations[relation] = { __default: relations[relation][Object.keys(relations[relation])[0]] };
	return relations;
}
function createRelation(value, { __default, ...types } = {}) {
	if (value.id)
		return value;
	else if (__default)
		return __default.create(value);
	else if (types.hasOwnProperty(value.type))
		return types[value.type].create(value);
	else
		throw new Error(`Could not create relation for ${JSON.stringify(value)}`)
}

export function addMutation(model, options) {
	const relations = getRelations(model, options);
	return async function(input, context, info) {
		const doc = new model();
		for (let [field, value] of toPairs(input)) {
			const validModels = relations[field];
			if (value && validModels) {
				if (Array.instanceOf(value))
					value = (await Promise.all(value.map(value => createRelation(value, validModels))));
				else
					value = await createRelation(value, validModels);
			}
			
			doc.set(field, value);
		}
		return doc.save();
	}
}
export function updateMutation(model, options) {
	const relations = getRelations(model, options);
	return async function(input, context, info) {
		const { id } = fromGlobalId(input.id);
		const doc = new model({ _id: id });
		for (let [field, value] of toPairs(input)) {
			const validModels = relations[field.replace(/^add_/, '')];
			if (value && validModels) {
				if (Array.instanceOf(value))
					value = (await Promise.all(value.map(value => createRelation(value, validModels))));
				else
					value = await createRelation(value, validModels);
			}

			if (/^add_/.test(field))
				doc[field.slice(4)].addToSet(...value);
			else if (/^remove_/.test(field))
				doc[field.slice(7)].pull(...value);
			else
				doc.set(field, value);
		}
		await doc.save();
		return model.findById(id);
	}
}
export function removeMutation(model, options) {
	return async function(input, context, info) {
		const { id } = fromGlobalId(id)
		await model.removeById(id);
		return { id };
	}
}