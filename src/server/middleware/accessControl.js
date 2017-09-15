export default function() {
	return function(req, res, next) {
		res.header('Access-Control-Allow-Origin', '*');
		res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
		if (req.method === 'OPTIONS') {
			res.header('Access-Control-Allow-Credentials', true);
			res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE');
			res.send();
		} else
			next();
	}
}