# 🍴 _This is a fork_

This package is published on npm as [@nodebb-community/nodebb-plugin-s3-uploads](https://www.npmjs.com/package/@nodebb-community/nodebb-plugin-s3-uploads-updated)

This repository is a further fork of the fork by [LouiseMcMahon](//github.com/LouiseMcMahon), with the following changes:

1. Compatibility with v3.x of NodeBB
1. Implemented [eslint-config-nodebb](https://github.com/NodeBB/eslint-config-nodebb/)
1. [feat: update allowMimeTypes to match latest NodeBB](https://github.com/LouiseMcMahon/nodebb-plugin-s3-uploads/pull/28)
1. [fix: outdated module require statements](https://github.com/LouiseMcMahon/nodebb-plugin-s3-uploads/pull/27)
1. [Fix for "Please use AWS4-HMAC-SHA256" error"](https://github.com/LouiseMcMahon/nodebb-plugin-s3-uploads/pull/26)

# NodeBB S3 Uploads Plugin

[![Dependency Status](https://david-dm.org/LouiseMcMahon/nodebb-plugin-s3-uploads.svg)](https://david-dm.org/LewisMcMahon/nodebb-plugin-s3-uploads)

This plugin is a fork of [nodebb-plugin-s3-uploads](https://github.com/earthsenze/nodebb-plugin-s3-uploads) as it was no longer being maintained

`npm install nodebb-plugin-s3-uploads-updated`

| Plugin Version | Dependency     | Version Requirement     |
| ---------------| -------------- |:-----------------------:|
| 0.2.x          | NodeBB         | <= 0.5.3 and >= 0.3.2 |
| 0.3.3          | NodeBB         | >= 0.6.0 |
| 0.3.4          | NodeBB         | >= 1.0.0 |

A plugin for NodeBB to take file uploads and store them on S3, uses the `filter:uploadImage` hook in NodeBB.


## S3 Uploads Configuration


You can configure this plugin via a combination of the below, for instance, you can use **instance meta-data** and **environment variables** in combination. You can also configure via the NodeBB Admin panel, which will result in the Bucket and Credentials being stored in the NodeBB Database.

If you decide to use the Database storage for Credentials, then they will take precedence over both Environment Variables and Instance Meta-data, the full load order is:

1. Database
2. Environment Variables
3. Instance Meta-data

For instance, for [talk.kano.me](http://talk.kano.me), we store the Bucket name in an Environment Variable, and the Credentials are discovered automatically with the Security Token Service.

### Environment Variables

```
export AWS_ACCESS_KEY_ID="xxxxx"
export AWS_SECRET_ACCESS_KEY="yyyyy"
export S3_UPLOADS_BUCKET="zzzz"
export S3_UPLOADS_HOST="host"
export S3_UPLOADS_PATH="path"
```

**NOTE:** Asset host is optional - If you do not specify an asset host, then the default asset host is `<bucket>.s3.amazonaws.com`.
**NOTE:** Asset path is optional - If you do not specify an asset path, then the default asset path is `/`.

### Instance Meta-data

To use Instance Meta-data, you'll need to setup role delegation, see the following links for more information:

* [EC2 Documentation: Instance Metadata and User Data](http://docs.aws.amazon.com/AWSEC2/latest/UserGuide/AESDG-chapter-instancedata.html)
* [IAM Documentation: Assuming a Role](http://docs.aws.amazon.com/IAM/latest/UserGuide/roles-assume-role.html)
* [IAM Documentation: EC2 Role Example](http://docs.aws.amazon.com/IAM/latest/UserGuide/role-usecase-ec2app.html)
* [STS Documentation: Delegation](http://docs.aws.amazon.com/STS/latest/UsingSTS/sts_delegate.html)

**NOTE:** You'll need to pass in the `Bucket` as either an **Environment Variable** or as a **Database Backed Variable**.

### Database Backed Variables

From the NodeBB Admin panel, you can configure the following settings to be stored in the Database:

* `bucket` — The S3 bucket to upload into
* `host` - The base URL for the asset.  **Typcially http://\<bucket\>.s3.amazonaws.com**
* `path` - The asset path (optional)
* `accessKeyId` — The AWS Access Key Id
* `secretAccessKey` — The AWS Secret Access Key

**NOTE: Storing your AWS Credentials in the database is bad practice, and you really shouldn't do it.**

We highly recommend using either **Environment Variables** or **Instance Meta-data** instead.

## Caveats

* Currently all uploads are stored in S3 keyed by a UUID and file extension, as such, if a user uploads multiple avatars, all versions will still exist in S3. This is a known issue and may require some sort of cron job to scan for old uploads that are no longer referenced in order for those objects to be deleted from S3.

## Contributing
[Before contributing please check the contribution guidelines](https://github.com/LouiseMcMahon/nodebb-plugin-s3-uploads/blob/master/.github/CONTRIBUTING.md)
