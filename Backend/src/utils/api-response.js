function successResponse(data = null, message = 'Request successful') {
  return {
    success: true,
    message,
    data,
  };
}

function errorResponse(message, details = undefined) {
  const response = {
    success: false,
    message,
  };

  if (details !== undefined) {
    response.details = details;
  }

  return response;
}

module.exports = { successResponse, errorResponse };