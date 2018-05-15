export const ExtendableError = function ExtendableError(message) {
	Error.captureStackTrace(this, this.constructor);
	this.name = this.constructor.name;
	this.message = message;
};
ExtendableError.prototype = Object.create(Error.prototype);

export class HTTPError extends ExtendableError {
	toJSON() {
		return { status: this.status, message: this.message };
	}
}

export class Unauthorized extends HTTPError {
	message = 'Unauthorized';
	status = 401;
}
export class ExpiredAccessToken extends HTTPError {
	message = 'Invalid access token';
	status = 467;
}
export class NotFound extends HTTPError {
	message = 'Not found';
	status = 404;
}
export class NotReady extends HTTPError {
	message = 'Not ready';
	status = 503;
}

export function errorHandler(captureException) {
	return function errorHandler(err, req, res, next) {
		if (err instanceof HTTPError) {
			res.status(err.status).send(err.message);
		} else {
			if (captureException)
				captureException(err);
			console.log(err);
			res.status(500).send(err.message);
		}
	}
}
