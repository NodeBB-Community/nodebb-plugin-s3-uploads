'use strict';

const S3 = require('@aws-sdk/client-s3');
const mime = require('mime');
const uuid = require('uuid').v4;
const fs = require('fs');
const path = require('path');

const winston = require.main.require('winston');
const nconf = require.main.require('nconf');
const sharp = require.main.require('sharp');
const meta = require.main.require('./src/meta');
const db = require.main.require('./src/database');
const routeHelpers = require.main.require('./src/routes/helpers');
const fileModule = require.main.require('./src/file');

const Package = require('./package.json');

const plugin = module.exports;

const settings = {
	accessKeyId: process.env.AWS_ACCESS_KEY_ID || false,
	secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || false,
	region: process.env.AWS_DEFAULT_REGION || 'us-east-1',
	acl: process.env.S3_UPLOADS_ACL || '',
	bucket: process.env.S3_UPLOADS_BUCKET || undefined,
	endpoint: process.env.S3_UPLOADS_ENDPOINT || 's3.amazonaws.com',
	host: process.env.S3_UPLOADS_HOST || 's3.amazonaws.com',
	path: process.env.S3_UPLOADS_PATH || undefined,
};

let accessKeyIdFromDb = false;
let secretAccessKeyFromDb = false;


plugin.load = async function (params) {
	await fetchSettings();

	const adminRoute = '/admin/plugins/s3-uploads';
	const { router, middleware } = params;
	routeHelpers.setupAdminPageRoute(router, adminRoute, renderAdmin);

	router.post(`/api${adminRoute}/s3settings`, middleware.applyCSRF, routeHelpers.tryRoute(s3settings));
	router.post(`/api${adminRoute}/credentials`, middleware.applyCSRF, routeHelpers.tryRoute(credentials));
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
		endpoint: settings.endpoint,
		path: settings.path,
		forumPath: forumPath,
		region: settings.region,
		acl: settings.acl,
		accessKeyId: (accessKeyIdFromDb && settings.accessKeyId) || '',
		secretAccessKey: (secretAccessKeyFromDb && settings.secretAccessKey) || '',
	};

	res.render('admin/plugins/s3-uploads', data);
}

async function fetchSettings() {
	const newSettings = await db.getObjectFields(Package.name, Object.keys(settings));
	accessKeyIdFromDb = !!newSettings.accessKeyId;
	secretAccessKeyFromDb = !!newSettings.secretAccessKey;

	settings.accessKeyId = newSettings.accessKeyId || process.env.AWS_ACCESS_KEY_ID || false;
	settings.secretAccessKey = newSettings.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || false;
	settings.bucket = newSettings.bucket || process.env.S3_UPLOADS_BUCKET || '';
	settings.host = newSettings.host || process.env.S3_UPLOADS_HOST || '';
	settings.endpoint = newSettings.endpoint || process.env.S3_UPLOADS_ENDPOINT || '';
	settings.path = newSettings.path || process.env.S3_UPLOADS_PATH || '';
	settings.region = newSettings.region || process.env.AWS_DEFAULT_REGION || '';
	settings.acl = newSettings.acl || process.env.S3_UPLOADS_ACL || '';
}

function constructS3() {
	return new S3.S3Client({
		region: settings.region,
		endpoint: settings.endpoint,
		credentials: {
			accessKeyId: settings.accessKeyId,
			secretAccessKey: settings.secretAccessKey,
		},
	});
}

plugin.activate = async function (data) {
	if (data.id === 'nodebb-plugin-s3-uploads') {
		await fetchSettings();
	}
};

async function s3settings(req, res) {
	const data = req.body;
	const newSettings = {
		bucket: (data.bucket || '').trim(),
		endpoint: (data.endpoint || '').trim(),
		host: (data.host || '').trim(),
		path: (data.path || '').trim(),
		region: (data.region || '').trim(),
		acl: (data.acl || '').trim(),
	};

	await saveSettings(newSettings, res);
	res.json('Saved!');
}

async function credentials(req, res) {
	const data = req.body;
	const newSettings = {
		accessKeyId: (data.accessKeyId || '').trim(),
		secretAccessKey: (data.secretAccessKey || '').trim(),
	};

	await saveSettings(newSettings, res);
	res.json('Saved!');
}

async function saveSettings(settings) {
	await db.setObject(Package.name, settings);
	await fetchSettings();
}

function isExtensionAllowed(filename, allowed) {
	const extension = path.extname(filename).toLowerCase();
	return !(allowed.length > 0 && (!extension || extension === '.' || !allowed.includes(extension)));
}

plugin.uploadImage = async function (data) {
	const { image } = data;

	if (!image) {
		winston.error('invalid image');
		throw new Error('invalid image');
	}

	// check filesize vs. settings
	if (image.size > parseInt(meta.config.maximumFileSize, 10) * 1024) {
		winston.error(`error:file-too-big, ${meta.config.maximumFileSize}`);
		throw new Error(`[[error:file-too-big, ${meta.config.maximumFileSize}]]`);
	}

	const type = image.url ? 'url' : 'file';

	// uploading from a url
	if (type === 'url') {
		return await uploadFromUrl(image);
	}

	// regular file upload
	if (!image.path) {
		throw new Error('invalid image path');
	}
	const allowed = fileModule.allowedExtensions();
	if (!isExtensionAllowed(image.name, allowed)) {
		throw new Error(`[[error:invalid-file-type, ${allowed.join('&#44; ')}]]`);
	}

	const buffer = await fs.promises.readFile(image.path);
	return await uploadToS3(image.name, buffer);
};

async function uploadFromUrl(image) {
	const allowed = fileModule.allowedExtensions();
	if (!isExtensionAllowed(image.url, allowed)) {
		throw new Error(`[[error:invalid-file-type, ${allowed.join('&#44; ')}]]`);
	}
	const response = await fetch(image.url);
	if (!response.ok) throw new Error(`Failed to fetch image from URL: ${response.statusText}`);

	const arrayBuffer = await response.arrayBuffer();
	const inputBuffer = Buffer.from(arrayBuffer);

	const filename = image.url.split('/').pop();
	const imageDimension = parseInt(meta.config.profileImageDimension, 10) || 128;

	const resizedBuffer = await sharp(inputBuffer)
		.resize(imageDimension, imageDimension, { fit: 'cover' });

	return await uploadToS3(filename, resizedBuffer);
}

plugin.uploadFile = async function (data) {
	const { file } = data;

	if (!file) {
		throw new Error('invalid file');
	}

	if (!file.path) {
		throw new Error('invalid file path');
	}

	// check filesize vs. settings
	if (file.size > parseInt(meta.config.maximumFileSize, 10) * 1024) {
		winston.error(`error:file-too-big, ${meta.config.maximumFileSize}`);
		throw new Error(`[[error:file-too-big, ${meta.config.maximumFileSize}]]`);
	}

	const allowed = fileModule.allowedExtensions();
	if (!isExtensionAllowed(file.name, allowed)) {
		throw new Error(`[[error:invalid-file-type, ${allowed.join('&#44; ')}]]`);
	}

	const buffer = await fs.promises.readFile(file.path);
	return await uploadToS3(file.name, buffer);
};

async function uploadToS3(filename, buffer) {
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
		Key: s3KeyPath + uuid() + path.extname(filename),
		Body: buffer,
		ContentLength: buffer.length,
		ContentType: mime.getType(filename),
	};
	if (settings.ACL) {
		params.ACL = settings.ACL;
	}

	const s3Client = constructS3();
	await s3Client.send(new S3.PutObjectCommand(params));

	// amazon has https enabled, we use it by default
	let host = `https://${params.Bucket}.s3.amazonaws.com`;
	if (settings.host && settings.host.length > 0) {
		host = settings.host;
		// host must start with http or https
		if (!host.startsWith('http')) {
			host = `http://${host}`;
		}
	}

	return {
		name: filename,
		url: `${host}/${params.Key}`,
	};
}

plugin.admin = {};

plugin.admin.menu = function (custom_header) {
	custom_header.plugins.push({
		route: '/plugins/s3-uploads',
		icon: 'fa-envelope-o',
		name: 'S3 Uploads',
	});

	return custom_header;
};
