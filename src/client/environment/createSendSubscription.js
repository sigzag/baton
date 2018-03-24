if (!window.navigator.userAgent)
	window.navigator.userAgent = 'ReactNative';

import { Observable, Subject } from 'rxjs';
// import { ReplaySubject } from 'rxjs/ReplaySubject';
import { ReplaySubject } from 'rxjs/ReplaySubject';
import 'rxjs/add/operator/filter';

const send = (function() {
	const subscribers = {};

	return function send(query) {
		const { url } = query;
		const host = url.split('?')[0];

		if (host in subscribers)
			return subscribers[host](query);

		const socket = new WebSocket(url);
		const pending = new ReplaySubject();
		const messages = new Subject();
	
		socket.onopen = () => pending.subscribe(subscribe);
		socket.onmessage = ({ data }) => messages.next(JSON.parse(data));
		socket.onerror = (error) => console.log(error.status, error.message);
		socket.onclose = (error) => {
			messages.error({ status: 0, code: error.code, message: 'Socket closed' });
			delete subscribers[host];
		};
		
		const subscribe = ({ id, variables, operation }) => socket.send(JSON.stringify({ type: 'subscribe', data: { id, variables, queryString: operation.text } }));
		const unsubscribe = ({ id }) => (socket.readyState === 1) && socket.send(JSON.stringify({ type: 'unsubscribe', data: { id } }));
		
		subscribers[host] = (query) => Observable.create((sink) => {
			pending.next(query);
			const subscription = messages.filter(({ id }) => query.id === id).subscribe(sink);
			return () => {
				unsubscribe(query);
				subscription.unsubscribe();
			};
		});

		return subscribers[host](query);
	};
}());

let counter = 0;
export default function(subscribe, store) {
	return function sendSubscription(
		operation,
		variables,
		cacheConfig = {},
		observer
	) {
		if (variables.hasOwnProperty('input')) {
			variables.input.clientSubscriptionId = `clientSubscriptionId:${counter++}`;
		}

		const operationConfig = {
			id: operation.name + counter,
			operation,
			variables,
			cacheConfig,
		}
		
		return subscribe(operationConfig, send, store);
	}
}