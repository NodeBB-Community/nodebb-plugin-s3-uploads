<div class="acp-page-container">
	<div component="settings/main/header" class="row border-bottom py-2 m-0 sticky-top acp-page-main-header align-items-center">
		<div class="col-12 col-md-8 px-0 mb-1 mb-md-0">
			<h4 class="fw-bold tracking-tight mb-0">{title}</h4>
		</div>
	</div>

	<div class="row m-0">
		<div id="spy-container" class="col-12 px-0 mb-4" tabindex="0">
			<p>You can configure this plugin via a combination of the below, for instance, you can use <em>instance meta-data</em>
				and <em>environment variables</em> in combination. You can also specify values in the form below, and those will be
				stored in the database.</p>

			<h3>Environment Variables</h3>
<pre><code>export AWS_ACCESS_KEY_ID="xxxxx"
export AWS_SECRET_ACCESS_KEY="yyyyy"
export S3_UPLOADS_BUCKET="mybucket"
export S3_UPLOADS_ENDPOINT="https://youraccountid.customs3compatiable.com"
export S3_UPLOADS_HOST="https://customcdn.yourdomain.com"
export S3_UPLOADS_PATH="/assets"
</code></pre>

            <p>
				Endpoint is optional. You should only supply it while using a custom S3 compatible service. For example, if you are
				using Cloudflare R2, it should be put as https://${ACCOUNT_ID}.r2.cloudflarestorage.com/. Note this URL is for the
				API calls only, and an end user should not be able to access it.
			</p>

			<p>
				Asset host and asset path are optional. You can leave these blank to default to the standard asset url -
				http://mybucket.s3.amazonaws.com/uuid.jpg.<br/>
				Asset host can be set to a custom asset host. For example, if set to cdn.mywebsite.com then the asset url is
				http://cdn.mywebsite.com/uuid.jpg.<br/>
				Asset path can be set to a custom asset path. For example, if set to /assets, then the asset url is
				http://mybucket.s3.amazonaws.com/assets/uuid.jpg.<br/>
				If both are asset host and path are set, then the url will be http://cdn.mywebsite.com/assets/uuid.jpg.
			</p>

			<h3>Instance meta-data</h3>
			<p>This plugin is compatible with the instance meta-data API, you'll need to setup role delegation for this to work. See
				the following links:</p>
			<ul>
				<li><a href="http://docs.aws.amazon.com/AWSEC2/latest/UserGuide/AESDG-chapter-instancedata.html">EC2 Documentation:
					Instance Metadata and User Data</a></li>
				<li><a href="http://docs.aws.amazon.com/IAM/latest/UserGuide/roles-assume-role.html">IAM Documentation: Assuming a
					Role</a></li>
				<li><a href="http://docs.aws.amazon.com/IAM/latest/UserGuide/role-usecase-ec2app.html">IAM Documentation: EC2 Role
					Example</a></li>
				<li><a href="http://docs.aws.amazon.com/STS/latest/UsingSTS/sts_delegate.html">STS Documentation: Delegation</a>
				</li>
			</ul>
			<div class="alert alert-warning">
				If you need help, create an <a href="https://github.com/NodeBB-Community/nodebb-plugin-s3-uploads/issues">issue on Github</a>.
			</div>

			<h3>Database Stored configuration:</h3>
			<form id="s3-upload-bucket">
				<div class="mb-3">
					<label class="form-label" for="s3bucket">Bucket</label>
					<input type="text" id="s3bucket" name="bucket" value="{bucket}" title="S3 Bucket" class="form-control" placeholder="S3 Bucket">
				</div>
				<div class="mb-3">
					<label class="form-label" for="endpoint">Endpoint</label>
					<input type="text" id="endpoint" name="endpoint" value="{endpoint}" title="S3 Endpoint" class="form-control" placeholder="s3.amazonaws.com">
				</div>
				<div class="mb-3">
					<label class="form-label" for="s3host">Host</label>
					<input type="text" id="s3host" name="host" value="{host}" title="S3 Host" class="form-control" placeholder="website.com">
				</div>

				<div class="mb-3">
					<label class="form-label" for="s3path">Path</label>
					<input type="text" id="s3path" name="path" value="{path}" title="S3 Path" class="form-control" placeholder="/assets">
				</div>

				<div class="mb-3">
					<label class="form-label" for="aws-region">Region</label>
					<input type="text" id="aws-region" name="region" value="{region}" title="AWS Region" class="form-control" placeholder="us-east-1">
				</div>
				<button class="btn btn-primary" type="submit">Save</button>
			</form>

			<hr/>

			<form id="s3-upload-credentials">
				<label class="form-label mb-2" for="bucket">Credentials</label>
				<div class="alert alert-warning">
					Configuring this plugin using the fields below is <strong>NOT recommended</strong>, as it can be a potential
					security issue. We highly recommend that you investigate using either <strong>Environment Variables</strong> or
					<strong>Instance Meta-data</strong>
				</div>
				<input type="text" name="accessKeyId" value="{accessKeyId}" title="Access Key ID" class="form-control mb-3" placeholder="Access Key ID">
				<input type="text" name="secretAccessKey" value="{secretAccessKey}" title="Secret Access Key" class="form-control mb-3" placeholder="Secret Access Key">
				<button class="btn btn-primary" type="submit">Save</button>
			</form>
		</div>

		<!-- IMPORT admin/partials/settings/toc.tpl -->
	</div>
</div>
