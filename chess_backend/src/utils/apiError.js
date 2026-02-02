class ApiError extends Error {
  /**
   * Create a typed API error.
   * @param {number} statusCode HTTP status code.
   * @param {string} code Machine-readable error code.
   * @param {string} message Human-readable error message.
   * @param {object=} details Optional additional details.
   */
  constructor(statusCode, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details || undefined;
  }
}

module.exports = { ApiError };
