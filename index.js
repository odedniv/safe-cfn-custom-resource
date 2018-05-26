'use strict';

const { promisify } = require('util');
const cfnCR = require('cfn-custom-resource');
const { configure, LOG_DEBUG, CREATE, UPDATE, DELETE } = cfnCR;

const sendSuccess = promisify(cfnCR.sendSuccess);
// cfn-custom-resource's callback is the third argument, a little harder to promisify
const sendFailure = (reason, event, context, physicalResourceId) => {
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
};

// Configuring debug if DEBUG env variable is set.
if (process.env.DEBUG) configure({ logLevel: LOG_DEBUG });

/*
 * A class to handle the handler's logic, holding on to the data relevant to it.
 */
class Handler {
  constructor(event, context, resource, initErr) {
    this.event = event;
    this.context = context;
    this.resource = resource;
    this.initErr = initErr;
    this.responseSent = false;
  }

  /*
   * Does the actual handler logic, returns a promise to be returned to AWS Lambda.
   */
  async promise() {
    try {
      if (this.initErr) throw this.initErr;
      return await Promise.race([
        this.handleTimeout(),
        this.handleResource(),
      ]);
    } catch (err) {
      return await this.sendFailure({ reason: err });
    }
  }

  /*
   * Ensures CloudFormation gets a response at least 3 seconds before the function times out.
   */
  handleTimeout() {
    return new Promise((resolve, reject) => {
      setTimeout(
        () => reject("Function timed out (3 seconds prior to actual timeout)"),
        this.context.getRemainingTimeInMillis() - 3000
      );
    });
  }

  async handleResource() {
    switch (this.event.RequestType) {
      case CREATE: return await sendSuccess(await this.resource.create(this.event));
      case UPDATE: return await sendSuccess(await this.resource.update(this.event));
      case DELETE: return await sendSuccess(await this.resource.delete(this.event));
    }
  }

  /*
   * Wrapper around cfn-custom-resource's sendSuccess, with the Handler's data.
   */
  async sendSuccess({ physicalResourceId, data }) {
    if (this.responseSent) return;
    this.responseSent = true;
    return await sendSuccess(physicalResourceId, data, this.event);
  }

  /*
   * Wrapper around cfn-custom-resource's sendFailure, with the Handler's data.
   */
  async sendFailure({ reason, physicalResourceId }) {
    if (this.responseSent) return;
    this.responseSent = true;
    await sendFailure(reason, this.event, this.context, physicalResourceId);
    throw reason;
  }
}

/*
 * Wrapper that creates a safe handler for a CloudFormation custom resource lambda.
 *
 * @param {Function} initialize  All the user's code is to be done in this function.
 *                               The user's function needs to return an object in this format:
 *                                 {
 *                                   create: Function(event) => { physicalResourceId, data? },
 *                                   update: Function(event) => { physicalResourceId?, data? },
 *                                   delete: Function(event),
 *                                 }
 * @return {Function}            The handler to be used for the custom resource's lambda:
 *                                 Function(event, context) => Promise
 */
function wrapper(initialize) {
  let resource;
  let initErr;
  try {
    resource = initialize();
  } catch (err) {
    initErr = err || "Unknown error during initialization (before the handler was invoked)";
  }

  return async (event, context) => {
    return await Handler(event, context, resource, initErr).promise();
  };
}

module.exports = wrapper;
