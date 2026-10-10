/**
 * CloudFront Function (viewer request) for the SPA behaviour only: any path without a file
 * extension is a client-side route and is served `index.html`. Using a function instead of
 * distribution-wide error responses keeps API 403/404 answers intact.
 */
export const SPA_REWRITE_FUNCTION_CODE = `function handler(event) {
  var request = event.request;
  var lastSegment = request.uri.substring(request.uri.lastIndexOf('/') + 1);
  if (lastSegment.indexOf('.') === -1) {
    request.uri = '/index.html';
  }
  return request;
}`;
