import { QueryRenderer } from 'react-relay';

export default class extends QueryRenderer {
	_fetch(operation, cacheConfig = {}) {
		const { environment } = this._relayContext;

		const snapshot = environment.lookup(operation.fragment);
		environment.retain(operation.root);

		// if (environment.check(operation.root))
		// 	return { props: snapshot.data, error: null, retry: null };

		const props = snapshot.data && Object.values(snapshot.data).find((x) => x) && snapshot.data;
		return super._fetch(operation, cacheConfig) || (props ? { props, error: null, retry: null } : null);
	}

	shouldComponentUpdate(nextProps, nextState) {
		return (
			super.shouldComponentUpdate(nextProps, nextState)
		);
	}
}