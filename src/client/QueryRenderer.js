import { QueryRenderer } from 'react-relay';

export default class extends QueryRenderer {
	_fetch(operation, cacheConfig = {}) {
		const { environment } = this._relayContext;

		// if (cacheConfig.forceRetain)
		// 	environment.retain(operation.root);

		// const snapshot = environment.lookup(operation.fragment);
		// console.log(snapshot);
		// if (environment.check(operation.root))
		// 	return { error: null, props: snapshot.data, retry: null };
	
		const result = super._fetch(operation, cacheConfig);
		// if (!snapshot || !snapshot.data)
			return result;


		return { error: null, props: snapshot.data, retry: null };
	}
}