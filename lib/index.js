/*eslint-disable*/
'use strict';
/**
 * Module dependencies
 */

/* eslint-disable import/no-unresolved */
/* eslint-disable no-unused-vars */
// Public node modules.
const _ = require('lodash');
const AWS = require('aws-sdk');
const sharp = require('sharp');

//HELPERS

const decodeBase64Image = (dataString) => {
    const matches = dataString.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
    if (matches.length !== 3) return new Error('Invalid input string');
    return {
        type: matches[1],
        data: Buffer.from(matches[2], 'base64'),
    };
};

const resize = async (buffer) => {
    const resizedImageBuf = await sharp(buffer)
        .rotate()
        .resize(100)
        .toBuffer();
    return decodeBase64Image(`data:image/jpeg;base64,${resizedImageBuf.toString('base64')}`);
};

const S3upload = S3 => (file, thumb = false) =>
    new Promise(async (resolve, reject) => {
        const {
            mime,
            hash,
            path: filePath,
            buffer,
            ext,
        } = file;
        const path = filePath ? `${filePath}/` : '';

        if (thumb) {
            const resizedBuffer = await resize(buffer);
            S3.upload({
                Key: `${path}${hash}_thumb${ext}`,
                Body: resizedBuffer.data,
                ACL: 'public-read',
                ContentType: mime,
            }, (err, data) => {
                if (err) strapi.log.info('S3upload.THUMB.err', err);
            });
        }
        S3.upload({
            Key: `${path}${hash}${ext}`,
            Body: buffer,
            ACL: 'public-read',
            ContentType: mime,
        }, (err, data) => {
            if (err) return reject(err);
            return resolve(data.Location);
        });
    })

const S3delete = S3 => (file, thumb = false) =>
    new Promise((resolve, reject) => {
        const path = file.path ? `${file.path}/` : '';
        strapi.log.info('S3delete',`${path}${file.hash}_thumb${file.ext}`)
        if (thumb) {
            S3.deleteObject({
                Key: `${path}${file.hash}_thumb${file.ext}`
            }, (err, data) => {
                if (err) strapi.log.error('S3delete.THUMB.err', err);
            });
        }

        S3.deleteObject({
            Key: `${path}${file.hash}${file.ext}`
        }, (err, data) => {
            if (err) {
                return reject(err);
            }
            resolve();
        });
    })

module.exports = {
    provider: 'aws-s3-resizer',
    name: 'Amazon Web Service S3 Resizer',
    auth: {
        public: {
            label: 'Access API Token',
            type: 'text'
        },
        private: {
            label: 'Secret Access Token',
            type: 'text'
        },
        region: {
            label: 'Region',
            type: 'enum',
            values: [
                'us-east-1',
                'us-east-2',
                'us-west-1',
                'us-west-2',
                'ca-central-1',
                'ap-south-1',
                'ap-northeast-1',
                'ap-northeast-2',
                'ap-northeast-3',
                'ap-southeast-1',
                'ap-southeast-2',
                'cn-north-1',
                'cn-northwest-1',
                'eu-central-1',
                'eu-north-1',
                'eu-west-1',
                'eu-west-2',
                'eu-west-3',
                'sa-east-1'
            ]
        },
        bucket: {
            label: 'Bucket',
            type: 'text'
        }
    },
    init: (config) => {
        // configure AWS S3 bucket connection
        AWS.config.update({
            accessKeyId: config.public,
            secretAccessKey: config.private,
            region: config.region
        });

        const S3 = new AWS.S3({
            apiVersion: '2006-03-01',
            params: {
                Bucket: config.bucket
            }
        });

        return {
            upload: (file) => {
                return new Promise((resolve, reject) => {
                    // upload file on S3 bucket
                    S3upload(S3)(file, (file.ext === '.jpg'))
                        .then(url => {
                            file.url = url;
                            resolve();
                        })
                        .catch(err => reject(err))
                });
            },
            delete: (file) => {
                // delete file on S3 bucket
                return S3delete(S3)(file, (file.ext === '.jpg'))
            }
        };
    }
};