if (!window.navigator.userAgent)
	window.navigator.userAgent = 'ReactNative';

import { Observable } from 'rxjs'
import 'rxjs/add/operator/do';
import 'rxjs/add/operator/filter';

const send = (function() {
	const sockets = {};

	function connect(url) {
		const host = url.split('?')[0];

		if (host in sockets) {
			return sockets[host];
		}

		const socket = new WebSocket(url);
		const subs = {};
	
		socket.onopen = () => Object.values(subs).forEach(subscribe);
		socket.onmessage = ({ data }) => {
			data = JSON.parse(data);
			if (data.id in subs)
				console.log('msg', data.id) || subs[data.id].sink.next(data);
		};
		socket.onclose = (error) => {
			delete sockets[host];
			for (let id in subs) {
				// console.log(id, subs[id].sink.error);
				subs[id].sink.error({ status: 0, message: 'Connection closed' });
			}
		};
	
		const subscribe = (query) => {
			subs[query.id] = query;
			if (socket.readyState === 1)
				socket.send(JSON.stringify({ type: 'subscribe', data: { id: query.id, variables: query.variables, queryString: query.operation.text } }))
		};
		const unsubscribe = (query) => {
			delete subs[query.id];
			if (socket.readyState === 1)
				socket.send(JSON.stringify({ type: 'unsubscribe', data: { id: query.id } }))
		};

		return sockets[host] = { subscribe, unsubscribe };
	}
	
	return function send(query) {
		return Observable.create((sink) => {
			const { subscribe, unsubscribe } = connect(query.url);
			subscribe({ ...query, sink });
			return () => unsubscribe(query);
		});
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