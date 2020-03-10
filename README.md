
# strapi-provider-upload-aws-s3-resizer

**Non-Official** S3 Provider for Strapi Upload, supports multiple sizes with suffixes

## Installation

Install the package from your app root directory

```
cd /path/to/strapi/
npm install strapi-provider-upload-aws-s3-resizer --save
```

## Configuration examples
```javascript
//1
sizes: 'thumb:100x100'
//2
sizes: 'thumb:50x50,small:100x100,medium:200x200,large:500x500'
```

## Usage
Install and configure: http://localhost:1337/admin/plugins/upload/configurations/development