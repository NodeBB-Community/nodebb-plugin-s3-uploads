'use strict';

import * as alerts from 'alerts';

export function init() {
	$('#s3-upload-bucket').on('submit', function (e) {
		e.preventDefault();
		save('s3settings', this);
	});

	$('#s3-upload-credentials').on('submit', function (e) {
		e.preventDefault();
		const form = this;
		bootbox.confirm('Are you sure you wish to store your credentials for accessing S3 in the database?', function (confirm) {
			if (confirm) {
				save('credentials', form);
			}
		});
	});

	function save(type, form) {
		const data = {
			_csrf: config.csrf_token,
		};

		const values = $(form).serializeArray();
		for (let i = 0, l = values.length; i < l; i++) {
			data[values[i].name] = values[i].value;
		}

		$.post(`/api/admin/plugins/s3-uploads/${type}`, data).done(function (response) {
			if (response) {
				ajaxify.refresh();
				alerts.success(response);
			}
		}).fail(function (jqXHR) {
			ajaxify.refresh();
			alerts.error(jqXHR.responseJSON ? jqXHR.responseJSON.error : 'Error saving!');
		});
	}
}
