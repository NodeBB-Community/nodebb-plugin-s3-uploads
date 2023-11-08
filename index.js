'use strict';


const AWS = require('aws-sdk');
const mime = require('mime');
const uuid = require('uuid').v4;
const fs = require('fs');
const request = require('request');
const path = require('path');

const winston = require.main.require('winston');
const nconf = require.main.require('nconf');
const gm = require('gm');

const im = gm.subClass({ imageMagick: true });
const meta = require.main.require('./src/meta');
const db = require.main.require('./src/database');
const routeHelpers = require.main.require('./src/routes/helpers');

const Package = require('./package.json');

const plugin = module.exports;

let S3Conn = null;
const settings = {
	accessKeyId: false,
	secretAccessKey: false,
	region: process.env.AWS_DEFAULT_REGION || 'us-east-1',
	bucket: process.env.S3_UPLOADS_BUCKET || undefined,
	host: process.env.S3_UPLOADS_HOST || 's3.amazonaws.com',
	path: process.env.S3_UPLOADS_PATH || undefined,
};

let accessKeyIdFromDb = false;
// eslint-disable-next-line no-unused-vars
let secretAccessKeyFromDb = false;

function fetchSettings(callback) {
	db.getObjectFields(Package.name, Object.keys(settings), (err, newSettings) => {
		if (err) {
			winston.error(err.message);
			if (typeof callback === 'function') {
				callback(err);
			}
			return;
		}

		accessKeyIdFromDb = false;
		secretAccessKeyFromDb = false;

		if (newSettings.accessKeyId) {
			settings.accessKeyId = newSettings.accessKeyId;
			accessKeyIdFromDb = true;
		} else {
			settings.accessKeyId = false;
		}

		if (newSettings.secretAccessKey) {
			settings.secretAccessKey = newSettings.secretAccessKey;
			secretAccessKeyFromDb = false;
		} else {
			settings.secretAccessKey = false;
		}

		if (!newSettings.bucket) {
			settings.bucket = process.env.S3_UPLOADS_BUCKET || '';
		} else {
			settings.bucket = newSettings.bucket;
		}

		if (!newSettings.host) {
			settings.host = process.env.S3_UPLOADS_HOST || '';
		} else {
			settings.host = newSettings.host;
		}

		if (!newSettings.path) {
			settings.path = process.env.S3_UPLOADS_PATH || '';
		} else {
			settings.path = newSettings.path;
		}

		if (!newSettings.region) {
			settings.region = process.env.AWS_DEFAULT_REGION || '';
		} else {
			settings.region = newSettings.region;
		}

		if (settings.accessKeyId && settings.secretAccessKey) {
			AWS.config.update({
				accessKeyId: settings.accessKeyId,
				secretAccessKey: settings.secretAccessKey,
			});
		}

		if (settings.region) {
			AWS.config.update({
				region: settings.region,
			});
		}

		AWS.config.update({
			signatureVersion: 'v4',
		});

		if (typeof callback === 'function') {
			callback();
		}
	});
}

function S3() {
	if (!S3Conn) {
		S3Conn = new AWS.S3();
	}

	return S3Conn;
}

function makeError(err) {
	if (err instanceof Error) {
		err.message = `${Package.name} :: ${err.message}`;
	} else {
		err = new Error(`${Package.name} :: ${err}`);
	}

	winston.error(err.message);
	return err;
}

plugin.activate = function (data) {
	if (data.id === 'nodebb-plugin-s3-uploads') {
		fetchSettings();
	}
};

plugin.deactivate = function (data) {
	if (data.id === 'nodebb-plugin-s3-uploads') {
		S3Conn = null;
	}
};

plugin.load = function (params, callback) {
	fetchSettings((err) => {
		if (err) {
			winston.error(err.message);
			return callback(err);
		}
		const adminRoute = '/admin/plugins/s3-uploads';
		const { router, middleware } = params;
		routeHelpers.setupAdminPageRoute(router, adminRoute, renderAdmin);

		params.router.post(`/api${adminRoute}/s3settings`, middleware.applyCSRF, s3settings);
		params.router.post(`/api${adminRoute}/credentials`, middleware.applyCSRF, credentials);

		callback();
	});
};

function renderAdmin(req, res) {
	let forumPath = nconf.get('url');
	if (forumPath.split('').reverse()[0] !== '/') {
		forumPath += '/';
	}
	const data = {
		title: 'S3 Uploads',
		bucket: settings.bucket,
		host: settings.host,
		path: settings.path,
		forumPath: forumPath,
		region: settings.region,
		accessKeyId: (accessKeyIdFromDb && settings.accessKeyId) || '',
		secretAccessKey: (accessKeyIdFromDb && settings.secretAccessKey) || '',
	};

	res.render('admin/plugins/s3-uploads', data);
}

function s3settings(req, res, next) {
	const data = req.body;
	const newSettings = {
		bucket: data.bucket || '',
		host: data.host || '',
		path: data.path || '',
		region: data.region || '',
	};

	saveSettings(newSettings, res, next);
}

function credentials(req, res, next) {
	const data = req.body;
	const newSettings = {
		accessKeyId: data.accessKeyId || '',
		secretAccessKey: data.secretAccessKey || '',
	};

	saveSettings(newSettings, res, next);
}

function saveSettings(settings, res, next) {
	db.setObject(Package.name, settings, (err) => {
		if (err) {
			return next(makeError(err));
		}

		fetchSettings();
		res.json('Saved!');
	});
}

plugin.uploadImage = function (data, callback) {
	const { image } = data;

	if (!image) {
		winston.error('invalid image');
		return callback(new Error('invalid image'));
	}

	// check filesize vs. settings
	if (image.size > parseInt(meta.config.maximumFileSize, 10) * 1024) {
		winston.error(`error:file-too-big, ${meta.config.maximumFileSize}`);
		return callback(new Error(`[[error:file-too-big, ${meta.config.maximumFileSize}]]`));
	}

	const type = image.url ? 'url' : 'file';
	const allowedMimeTypes = [
		'image/png', 'image/jpeg', 'image/gif', 'image/pjpeg', 'image/jpg', 'image/svg+xml',
	];

	if (type === 'file') {
		if (!image.path) {
			return callback(new Error('invalid image path'));
		}

		if (allowedMimeTypes.indexOf(mime.lookup(image.path)) === -1) {
			return callback(new Error('invalid mime type'));
		}

		fs.readFile(image.path, (err, buffer) => {
			uploadToS3(image.name, err, buffer, callback);
		});
	} else {
		if (allowedMimeTypes.indexOf(mime.lookup(image.url)) === -1) {
			return callback(new Error('invalid mime type'));
		}
		const filename = image.url.split('/').pop();

		const imageDimension = parseInt(meta.config.profileImageDimension, 10) || 128;

		// Resize image.
		im(request(image.url), filename)
			.resize(`${imageDimension}^`, `${imageDimension}^`)
			.stream((err, stdout) => {
				if (err) {
					return callback(makeError(err));
				}

				// This is sort of a hack - We"re going to stream the gm output to a buffer and then upload.
				// See https://github.com/aws/aws-sdk-js/issues/94
				let buf = Buffer.alloc(0);
				stdout.on('data', (d) => {
					buf = Buffer.concat([buf, d]);
				});
				stdout.on('end', () => {
					uploadToS3(filename, null, buf, callback);
				});
			});
	}
};

plugin.uploadFile = function (data, callback) {
	const { file } = data;

	if (!file) {
		return callback(new Error('invalid file'));
	}

	if (!file.path) {
		return callback(new Error('invalid file path'));
	}

	// check filesize vs. settings
	if (file.size > parseInt(meta.config.maximumFileSize, 10) * 1024) {
		winston.error(`error:file-too-big, ${meta.config.maximumFileSize}`);
		return callback(new Error(`[[error:file-too-big, ${meta.config.maximumFileSize}]]`));
	}

	fs.readFile(file.path, (err, buffer) => {
		uploadToS3(file.name, err, buffer, callback);
	});
};

function uploadToS3(filename, err, buffer, callback) {
	if (err) {
		return callback(makeError(err));
	}

	let s3Path;
	if (settings.path && settings.path.length > 0) {
		s3Path = settings.path;

		if (!s3Path.match(/\/$/)) {
			// Add trailing slash
			s3Path += '/';
		}
	} else {
		s3Path = '/';
	}

	const s3KeyPath = s3Path.replace(/^\//, ''); // S3 Key Path should not start with slash.

	const params = {
		Bucket: settings.bucket,
		ACL: 'public-read',
		Key: s3KeyPath + uuid() + path.extname(filename),
		Body: buffer,
		ContentLength: buffer.length,
		ContentType: mime.lookup(filename),
	};

	S3().putObject(params, (err) => {
		if (err) {
			return callback(makeError(err));
		}

		// amazon has https enabled, we use it by default
		let host = `https://${params.Bucket}.s3.amazonaws.com`;
		if (settings.host && settings.host.length > 0) {
			host = settings.host;
			// host must start with http or https
			if (!host.startsWith('http')) {
				host = `http://${host}`;
			}
		}

		callback(null, {
			name: filename,
			url: `${host}/${params.Key}`,
		});
	});
}

plugin.admin = {};

plugin.admin.menu = function (custom_header, callback) {
	custom_header.plugins.push({
		route: '/plugins/s3-uploads',
		icon: 'fa-envelope-o',
		name: 'S3 Uploads',
	});

	callback(null, custom_header);
};
