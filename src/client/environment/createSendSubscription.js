import { executeStack } from './middleware';

if (!window.navigator.userAgent)
	window.navigator.userAgent = 'ReactNative';

let counter = 0;
export default function(stack) {
	return function sendSubscription(
		operation,
		variables,
		cacheConfig,
		observer
	) {
		const id = `clientSubscriptionId:${counter++}`;
		if (variables.hasOwnProperty('input'))
			variables.input.clientSubscriptionId = id;
		
		return executeStack(stack, {
			id,
			operation,
			variables,
			cacheConfig,
			host: '', // expects to be set,
		});
	}
}