import { Observable, Subject, ReplaySubject } from 'rxjs';
import { filter, count } from 'rxjs/operators';
import WebSocket from 'reconnecting-websocket';

if (!window.navigator.userAgent)
	window.navigator.userAgent = 'ReactNative';

const send = (function() {
	const subscribers = {};

	return function send(query) {
		const { url } = query;
		const host = url.split('?')[0];

		if (host in subscribers)
			return subscribers[host](query);

		const socket = new WebSocket(url, [], { debug: false });
		const pending = new ReplaySubject();
		const complete = new Set();
		const filterComplete = filter(({ id }) => !complete.has(id));
		const messages = new Subject();
		
		let subscription = null;
		socket.onopen = () => subscription = pending.pipe(filterComplete).subscribe(subscribe);
		socket.onmessage = ({ data }) => messages.next(JSON.parse(data));
		// socket.onerror = (error) => console.log(error.status, error.message);
		socket.onclose = (event) => {
			// actual reconnecting happening here- thanks dumb half-recconecting-websocket
			if (!event.wasClean)
				socket._connect();
			if (subscription) {
				subscription.unsubscribe();
				subscription = null;
			}
			// messages.error({ status: 0, code: error.code, message: 'Socket closed' });
			// delete subscribers[host];
		};
		
		const subscribe = ({ id, variables, operation }) => socket.send(JSON.stringify({ type: 'subscribe', data: { id, variables, queryString: operation.text } }));
		const unsubscribe = ({ id }) => (socket.readyState === 1) && socket.send(JSON.stringify({ type: 'unsubscribe', data: { id } }));
		
		subscribers[host] = (query) => Observable.create((sink) => {
			pending.next(query);
			const subscription = messages.pipe(filter(({ id }) => query.id === id)).subscribe(sink);
			return () => {
				complete.add(query.id);
				subscription.unsubscribe();
				unsubscribe(query);
				const counter = pending.pipe(filterComplete, count());
				const counterSub = counter.subscribe((count) => {
					if (!count) {
						socket.close();
						delete subscribers[host];
					}
				});
				counter.complete();
				counterSub.unsubscribe();
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
		return subscribe({
			id: operation.name + (counter++),
			operation,
			variables,
			cacheConfig,
		}, send, store);
	}
}
