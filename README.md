# safe-cfn-custom-resource

CloudFormation is awesome! Custom resources are awesome! But... \
Tired of having your CloudFormation stack for **1 whole hour** because of a bug during development? Want to use `async/await`?

This package lets you have the safest implementation of your custom resource, if you use it properly your stack will never get stuck.

Special thanks to [zippadd/cfn-custom-resource](https://github.com/zippadd/cfn-custom-resource),
this is basically a wrapper around it.

## Install

```bash
npm install --save safe-cfn-custom-resource
```

## Requirements

* **Lambda Runtime:** NodeJS 8.10+ (the handler will return a promise)
* **Lambda Timeout:** 3+ seconds (the function will timeout 2 seconds before Lambda's timeout)

**Note:** 3 seconds timeout means you have less than 1 second to finish your work,
          you should probably set it to more.

## Usage

Your main JavaScript module should look like this:

```javascript
// Yes, even your initialization can be async!
module.exports.handler = require('safe-cfn-custom-resource')(/*async*/ () => {
  // Don't do ANYTHING outside this function!
  // All your requires go here.

  // event & context are the original ones the handler was invoked with.
  return {
    create: /*async*/ (event, context) => {
      return {
        // required
        id: "the physical resource id (Ref)",
        // optional
        // can also supply a non-object which would be retrieved using !GetAtt: [ResourceLogicalId, Data]
        data: { Key: "value", For: "GetAtt" }
      };
    },
    update: /*async*/ (event, context) => {
      return {
        // optional, original physical resource id will be used if not supplied
        id: "the physical resource id (Ref)",
        // optional
        // can also supply a non-object which would be retrieved using !GetAtt: [ResourceLogicalId, Data]
        data: { Key: "value", For: "GetAtt" }
      };
    },
    delete: /*async*/ (event, context) => {
      // doesn't need to return anything
    },
  };
});
```

See the [official documentation for the custom resource's event structure](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/template-custom-resources.html).

* **Tip 1:** Remember that if the update requires re-creation, return the new physical resource id and don't delete the old one,
             CloudFormation will automatically call this function again for deletion of the old physical resource id.
* **Tip 2:** Use [Webpack](https://webpack.js.org/) to save some artifact size when using dependencies (like this one).

## Debugging

Setting an environment variable called `DEBUG` on your Lambda function will give you debug logging in CloudWatch.
Note that your lambda needs to be able to access the function's CloudWatch log stream.
