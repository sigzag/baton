import { fromGlobalId } from 'graphql-relay';
export default function nodeFromId(db, globalId) {
	const { type, id } = fromGlobalId(globalId);
	return Object.values(db.models).find(model => model.typename === type).node(id);
}