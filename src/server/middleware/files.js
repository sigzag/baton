import multer from 'multer';
import { set } from 'lodash';

export default function(options) {
	const multerMiddleware = multer(options).any();
	return function(req, res, next) {
		return multerMiddleware(req, res, function() {
			if (req.body) {
				req.body.variables = JSON.parse(req.body.variables);
				if (req.files)
					for (let file of req.files)
						set(req.body.variables.input, file.fieldname, file);
			}
			// console.log(req.body.query);
			next();
		});
	}
}