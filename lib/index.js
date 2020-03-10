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

const getImageSizeConfigs = ({ sizes = 'thumb:100x100', quality = 100 }) => {
    return sizes.split(",").map((sizeConfig) => sizeConfig.split(':'))
        .map(([suffix, size]) => {
            const [width, height] = size.split('x');
            return {
                suffix,
                width: parseInt(width),
                height: parseInt(height),
                quality: parseInt(quality)
            }
        })
}

const getResized = (buffer, resizeConfig, file) => {
    const { suffix, width, height, quality } = resizeConfig;

    let filExtensionFunction = 'jpeg'
    if (file.ext === '.png') filExtensionFunction = 'png'

    return sharp(buffer)
        .resize(
            width,
            height,
            {
                fit: sharp.fit.cover,
                withoutEnlargement: true
            }
        )[filExtensionFunction]({ quality })
        .toBuffer()
        .then(data => ({ buffer: data, mime: file.mime, ext: file.ext, suffix: `_${suffix}${file.ext}` }))
}

const createSizes = async (file, config) => {
    const buffer = new Buffer(file.buffer, 'binary');
    const imageSizeConfigs = getImageSizeConfigs(config)
    const imagesToCreate = imageSizeConfigs.map(async (sizeConfig) => {
        const image = await getResized(buffer, sizeConfig, file);
        return [image]
    })
    return Promise.all(imagesToCreate);
}

//
// S3 wrappers
//

const S3Upload = S3 => (file, imageConfig) => {
    const { buffer, mime, suffix } = imageConfig || { buffer: file.buffer, mime: file.mime };
    return new Promise((resolve, reject) => {
        const path = file.path ? `${file.path}/` : '';
        const Key = imageConfig ?
            `${path}${file.hash}${suffix}` :
            `${path}${file.hash}${file.ext}`

        S3.upload({
            Key,
            Body: new Buffer(buffer, 'binary'),
            ACL: 'public-read',
            ContentType: mime,
        },
            (err, data) => {
                if (err) {
                    strapi.log.error('S3upload.Error', err)
                    return reject(err);
                }
                if (!imageConfig) file.url = data.Location;
                //strapi.log.debug('S3upload.data.Location', data.Location)
                resolve();
            }
        );
    });
}

const S3Delete = S3 => (file, imageConfig) => {
    const { suffix } = imageConfig || {}
    return new Promise((resolve, reject) => {
        const path = file.path ? `${file.path}/` : '';
        const Key = imageConfig ?
            `${path}${file.hash}${suffix}` :
            `${path}${file.hash}${file.ext}`

        S3.deleteObject({
            Key: `${path}${file.hash}_${suffix}${file.ext}`,
        }, (err, data) => {
            if (err) {
                strapi.log.error('S3Delete.Error', err)
                return reject(err);
            }
            //strapi.log.debug('S3Delete.data', data)
            resolve();
        }
        );
    });
}

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
        bucket: {
            label: 'Bucket',
            type: 'text'
        },

        sizes: {
            label: 'Sizes with image suffixes(thumb:50x50,small:100x100,medium:200x200,large:500x500)',
            type: 'textarea'
        },
        quality: {
            label: 'Quality',
            type: 'number',
            min: 10,
            max: 100
        }
        /* webp: {
            label: 'Generate WebP',
            type: 'enum',
            values: [
                'true',
                'false'
            ],
        } */
    },
    init: (config) => {
        // configure AWS S3 bucket connection
        AWS.config.update({
            accessKeyId: config.public,
            secretAccessKey: config.private,
            //region: config.region
        });

        const S3 = new AWS.S3({
            apiVersion: '2006-03-01',
            params: {
                Bucket: config.bucket
            }
        });

        return {
            upload: async (file) => {
                const sizes = await createSizes(file, config);

                //upload generated sizes
                sizes.forEach(images => {
                    images.forEach(imageConfig => S3Upload(S3)(file, imageConfig))
                });

                //upload original
                return S3Upload(S3)(file);
            },

            delete: async file => {
                // Delete generated sizes 
                const sizes = getImageSizeConfigs(config);
                sizes.forEach(imageConfig => S3Delete(S3)(file, imageConfig));
                //delete original
                return S3Delete(S3)(file)
            }
        };
    }
};