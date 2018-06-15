'use strict';

const Handler = require('./handler');

/*
 * Wrapper that creates a safe handler for a CloudFormation custom resource lambda.
 *
 * @param {Function} initializer  All the user's code is to be done in this function.
 *                                The user's function needs to return an object in this format:
 *                                  {
 *                                    create: Function(event, context) => { id, data? },
 *                                    update: Function(event, context) => { id?, data? },
 *                                    delete: Function(event, context),
 *                                  }
 * @return {Function}             The handler to be used for the custom resource's lambda:
 *                                  Function(event, context) => Promise
 */
function wrapper(initializer) {
  let resource;
  let initErr;
  try {
    resource = initializer();
  } catch (err) {
    initErr = err || "Unknown error during initialization (before the handler was invoked)";
  }

  let handler = async (event, context) => {
    let handlerLogic = new Handler(event, context, resource, initErr);
    return await handlerLogic.promise();
  };
  handler.resource = resource; // making the user's resource testable
  return handler;
}

module.exports = wrapper;
