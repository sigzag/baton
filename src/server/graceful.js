import { ServiceUnavailable } from '../errors';

let shuttingDown = false;
export function graceful(server, isReady, down) {
	process.on('SIGTERM', shutDown);
	process.on('SIGINT', shutDown);

	const connections = new Set();
	server.on('connection', (socket) => {
		connections.add(socket);
		socket.on('close', () => connections.delete(socket));
	});

	function shutDown() {
		shuttingDown = true;
	
		connections.forEach((socket) => socket.end());
		setTimeout(() => connections.forEach((socket) => socket.destroy()), 5000);
	
		Promise.all([
			down(),
			new Promise((resolve) => server.close(resolve)),
		]).then(() => {
			console.log('Closed out remaining connections');
			process.exit(0);
		}).catch((err) => {
			console.log('Could not close remaining connections, ', err);;
			process.exit(1);
		});
	
		setTimeout(() => {
			console.error('Could not close connections in time, forcefully shutting down');
			process.exit(1);
		}, 10000);
	}

	function graceful(req, res, next) {
		if (shuttingDown || !isReady())
			throw new ServiceUnavailable();
	
		next();
	}

	return graceful;
}
