'use strict';

const { promisify } = require('util');
const cfnCR = require('cfn-custom-resource');

const sendSuccess = promisify(cfnCR.sendSuccess);
// cfn-custom-resource's callback is the third argument, a little harder to promisify
function sendFailure (reason, event, context, physicalResourceId) {
  return new Promise((resolve, reject) => {
    cfnCR.sendFailure(
      reason, event,
      (err, data) => {
        if (!err) resolve(data);
        else reject(err);
      },
      context, physicalResourceId
    );
  });
}

module.exports = {
  sendSuccess,
  sendFailure,
};
