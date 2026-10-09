export type StatusClassKey = "1xx" | "2xx" | "3xx" | "4xx" | "5xx";

export interface StatusClass {
  key: StatusClassKey;
  name: string;
  color: string;
  bg: string;
  text: string;
  border: string;
}

export interface Status {
  code: number;
  name: string;
  description: string;
  official: boolean;
}

export const STATUS_CLASS_ORDER: StatusClassKey[] = ["1xx", "2xx", "3xx", "4xx", "5xx"];

export const STATUS_CLASSES: Record<StatusClassKey, StatusClass> = {
  "1xx": { key: "1xx", name: "Informational", color: "#0369a1", bg: "bg-sky-50", text: "text-sky-700", border: "border-sky-200" },
  "2xx": { key: "2xx", name: "Success", color: "#047857", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  "3xx": { key: "3xx", name: "Redirection", color: "#b45309", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  "4xx": { key: "4xx", name: "Client error", color: "#b91c1c", bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
  "5xx": { key: "5xx", name: "Server error", color: "#6d28d9", bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
};

export const STATUSES: Status[] = [
  { code: 100, name: "Continue", description: "The server has received the request headers and the client should proceed to send the body.", official: true },
  { code: 101, name: "Switching Protocols", description: "The requester has asked the server to switch protocols and the server confirms it will do so.", official: true },
  { code: 102, name: "Processing", description: "WebDAV: the server has received and is processing the request, but no response is available yet.", official: true },
  { code: 103, name: "Early Hints", description: "Used to send some response headers before the final HTTP message.", official: true },
  { code: 200, name: "OK", description: "The request has succeeded.", official: true },
  { code: 201, name: "Created", description: "The request has succeeded and a new resource has been created.", official: true },
  { code: 202, name: "Accepted", description: "The request has been accepted for processing, but it is not yet complete.", official: true },
  { code: 203, name: "Non-Authoritative Information", description: "The response is from a transforming proxy, so it may differ from the origin server's response.", official: true },
  { code: 204, name: "No Content", description: "The request succeeded but there is no content to return.", official: true },
  { code: 205, name: "Reset Content", description: "The server asks the client to reset the view that sent the request.", official: true },
  { code: 206, name: "Partial Content", description: "The server is sending only part of the resource (range requests).", official: true },
  { code: 207, name: "Multi-Status", description: "WebDAV: the message body carries multiple independent status codes.", official: true },
  { code: 208, name: "Already Reported", description: "WebDAV: the members of a DAV binding have already been listed in a previous reply.", official: true },
  { code: 226, name: "IM Used", description: "The server fulfilled the request and the response is a representation of the result of one or more instance manipulations.", official: true },
  { code: 300, name: "Multiple Choices", description: "The request has more than one possible response; the client must choose one.", official: true },
  { code: 301, name: "Moved Permanently", description: "This and all future requests should be directed to the given URI.", official: true },
  { code: 302, name: "Found", description: "The resource is temporarily under a different URI.", official: true },
  { code: 303, name: "See Other", description: "The response is at a different URI and should be fetched with GET.", official: true },
  { code: 304, name: "Not Modified", description: "The resource has not been modified since the last request (conditional request).", official: true },
  { code: 305, name: "Use Proxy", description: "The requested resource must be accessed through the proxy given by the Location field. Deprecated.", official: true },
  { code: 306, name: "Unused", description: "Reserved: an earlier draft defined it for a protocol switch that was never shipped.", official: true },
  { code: 307, name: "Temporary Redirect", description: "The resource is temporarily at another URI, but future requests should use the original URI.", official: true },
  { code: 308, name: "Permanent Redirect", description: "The resource is permanently at another URI, and the method must not change.", official: true },
  { code: 400, name: "Bad Request", description: "The request could not be understood by the server due to malformed syntax.", official: true },
  { code: 401, name: "Unauthorized", description: "Authentication is required and has failed or has not yet been provided.", official: true },
  { code: 402, name: "Payment Required", description: "Reserved for future use.", official: true },
  { code: 403, name: "Forbidden", description: "The request was valid, but the server refuses to respond to it.", official: true },
  { code: 404, name: "Not Found", description: "The requested resource could not be found on the server.", official: true },
  { code: 405, name: "Method Not Allowed", description: "The request method is not supported for the requested resource.", official: true },
  { code: 406, name: "Not Acceptable", description: "The server cannot produce a response matching the Accept headers.", official: true },
  { code: 407, name: "Proxy Authentication Required", description: "Authentication is required through a proxy before the request continues.", official: true },
  { code: 408, name: "Request Timeout", description: "The server timed out waiting for the request. The client may repeat the request.", official: true },
  { code: 409, name: "Conflict", description: "The request could not be processed due to a conflict with the current state.", official: true },
  { code: 410, name: "Gone", description: "The resource is no longer available and will not be available again.", official: true },
  { code: 411, name: "Length Required", description: "A Content-Length header is required but was not sent.", official: true },
  { code: 412, name: "Precondition Failed", description: "One or more preconditions in the request headers evaluated to false.", official: true },
  { code: 413, name: "Content Too Large", description: "The request is larger than the server is willing or able to process.", official: true },
  { code: 414, name: "URI Too Long", description: "The URI provided was too long for the server to process.", official: true },
  { code: 415, name: "Unsupported Media Type", description: "The media format of the requested data is not supported by the server.", official: true },
  { code: 416, name: "Range Not Satisfiable", description: "The Range header cannot be satisfied.", official: true },
  { code: 417, name: "Expectation Failed", description: "The expectation in the Expect header could not be met by the server.", official: true },
  { code: 418, name: "I'm a teapot", description: "The server refuses to brew coffee because it is a teapot (from the April Fools' RFC 2324).", official: true },
  { code: 421, name: "Misdirected Request", description: "The request was directed at a server that cannot produce a response for the target URI.", official: true },
  { code: 422, name: "Unprocessable Content", description: "The request was well-formed but contained semantic errors, such as failed validation.", official: true },
  { code: 423, name: "Locked", description: "WebDAV: the resource that is being accessed is locked.", official: true },
  { code: 424, name: "Failed Dependency", description: "WebDAV: the request failed because a previous request it depended on failed.", official: true },
  { code: 425, name: "Too Early", description: "The server is unwilling to risk processing a request that might be replayed.", official: true },
  { code: 426, name: "Upgrade Required", description: "The client should switch to a different protocol (for example, TLS).", official: true },
  { code: 428, name: "Precondition Required", description: "The origin server requires the request to be conditional.", official: true },
  { code: 429, name: "Too Many Requests", description: "The user has sent too many requests in a given amount of time.", official: true },
  { code: 431, name: "Request Header Fields Too Large", description: "The server is unwilling to process the request because header fields are too large.", official: true },
  { code: 451, name: "Unavailable For Legal Reasons", description: "The resource is unavailable for legal reasons.", official: true },
  { code: 500, name: "Internal Server Error", description: "The server encountered an unexpected condition.", official: true },
  { code: 501, name: "Not Implemented", description: "The server does not support the functionality required to fulfill the request.", official: true },
  { code: 502, name: "Bad Gateway", description: "The server, acting as a gateway, received an invalid response from upstream.", official: true },
  { code: 503, name: "Service Unavailable", description: "The server is currently unable to handle the request (overloaded or down).", official: true },
  { code: 504, name: "Gateway Timeout", description: "The server, acting as a gateway, did not get a response in time.", official: true },
  { code: 505, name: "HTTP Version Not Supported", description: "The server does not support the HTTP protocol version used in the request.", official: true },
  { code: 506, name: "Variant Also Negotiates", description: "The server has an internal configuration error: the chosen variant is misconfigured.", official: true },
  { code: 507, name: "Insufficient Storage", description: "WebDAV: the server is unable to store the representation needed to complete the request.", official: true },
  { code: 508, name: "Loop Detected", description: "WebDAV: the server detected an infinite loop while processing the request.", official: true },
  { code: 510, name: "Not Extended", description: "Further extensions to the request are required for the server to fulfill it.", official: true },
  { code: 511, name: "Network Authentication Required", description: "The client needs to authenticate to gain network access.", official: true },
  { code: 599, name: "Network Connect Timeout", description: "Some proxies return this when the network connection times out. Not an official code.", official: false },
];

export function classKeyOf(code: number): StatusClassKey {
  const n = Math.floor(code / 100);
  if (n <= 1) return "1xx";
  if (n >= 5) return "5xx";
  return `${n}xx` as StatusClassKey;
}

export function filterStatuses(query: string): Status[] {
  const q = query.trim().toLowerCase();
  if (!q) return STATUSES;
  return STATUSES.filter(
    (s) =>
      String(s.code).includes(q) ||
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q),
  );
}

export interface StatusGroup {
  key: StatusClassKey;
  meta: StatusClass;
  items: Status[];
}

export interface StatusQueryResult {
  groups: StatusGroup[];
  total: number;
  filter: StatusClassKey | "all";
}

export function queryStatuses(query: string, filter: StatusClassKey | "all" = "all"): StatusQueryResult {
  const matched = filterStatuses(query);
  const scoped = filter === "all" ? matched : matched.filter((s) => classKeyOf(s.code) === filter);
  const groups: StatusGroup[] = STATUS_CLASS_ORDER.map((key) => ({
    key,
    meta: STATUS_CLASSES[key],
    items: scoped.filter((s) => classKeyOf(s.code) === key),
  })).filter((g) => g.items.length > 0);
  return { groups, total: scoped.length, filter };
}
