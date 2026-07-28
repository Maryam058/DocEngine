# API Reference

## Introduction

The DocEngine API provides a RESTful interface for creating, retrieving, updating, and managing documentation resources. All requests are sent over HTTPS and return JSON responses for successful operations.

### Base URL

```text
https://api.docengine.example.com/v1
```

## Authentication

All requests must include a valid API key in the `Authorization` header.

```http
Authorization: Bearer <your-api-key>
```

### Authentication Guidelines

- Send the API key with every request.
- Use a valid, active key for all environments.
- Store keys securely in a secrets manager or environment variable.
- Never commit API keys to source control or expose them in client-side code.

## Endpoints

### GET /documents

Retrieve a paginated list of documentation resources.

#### Query Parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `page` | integer | No | The page number to return. Default is `1`. |
| `limit` | integer | No | The number of results to return per page. Default is `20`. |
| `filter` | string | No | Optional filter for document type or status. |

#### Example Request

```http
GET /v1/documents?page=1&limit=10 HTTP/1.1
Host: api.docengine.example.com
Authorization: Bearer <your-api-key>
Accept: application/json
```

#### Example Response

```json
{
  "data": [
    {
      "id": "doc_123",
      "title": "Getting Started",
      "status": "published",
      "updated_at": "2026-07-28T10:00:00Z"
    }
  ],
  "page": 1,
  "limit": 10,
  "total": 1
}
```

### POST /documents

Create a new documentation resource.

#### Request Body

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `title` | string | Yes | The document title. |
| `content` | string | Yes | The Markdown content for the document. |
| `category` | string | No | Optional content category. |

#### Example Request

```http
POST /v1/documents HTTP/1.1
Host: api.docengine.example.com
Authorization: Bearer <your-api-key>
Content-Type: application/json
Accept: application/json

{
  "title": "Release Notes",
  "content": "# Release Notes\n\nUpdated onboarding guide.",
  "category": "product"
}
```

#### Example Response

```json
{
  "id": "doc_456",
  "title": "Release Notes",
  "status": "draft",
  "created_at": "2026-07-28T10:05:00Z"
}
```

### GET /documents/{documentId}

Retrieve a single document by its identifier.

#### Path Parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `documentId` | string | Yes | The unique identifier of the document. |

#### Example Request

```http
GET /v1/documents/doc_123 HTTP/1.1
Host: api.docengine.example.com
Authorization: Bearer <your-api-key>
Accept: application/json
```

#### Example Response

```json
{
  "id": "doc_123",
  "title": "Getting Started",
  "content": "# Getting Started\n\nWelcome to DocEngine.",
  "status": "published"
}
```

## Status Codes

| Status Code | Meaning |
| --- | --- |
| `200 OK` | The request succeeded. |
| `201 Created` | The resource was created successfully. |
| `400 Bad Request` | The request payload or parameters are invalid. |
| `401 Unauthorized` | Authentication failed or the API key is missing. |
| `403 Forbidden` | The authenticated client does not have permission to access the resource. |
| `404 Not Found` | The requested resource does not exist. |
| `429 Too Many Requests` | The rate limit has been exceeded. |
| `500 Internal Server Error` | An unexpected server error occurred. |

## Error Messages

The API returns errors as JSON objects with an error code and a human-readable message.

```json
{
  "error": {
    "code": "invalid_request",
    "message": "The request payload is invalid."
  }
}
```

### Common Error Codes

- `invalid_request`: The request body or parameters are malformed.
- `unauthorized`: The API key is missing or invalid.
Write User Guide 1 (Installation).
Write User Guide 2 (Usage).
Add screenshot placeholders and annotation notes.- `forbidden`: The client does not have access to the requested resource.
- `not_found`: The requested resource could not be found.
- `rate_limited`: Too many requests were sent in a short period.

## Rate Limits

The API enforces rate limits to protect system stability and prevent abuse.

- Default limit: 100 requests per minute per API key
- Limits reset every minute
- Exceeding the limit returns `429 Too Many Requests`

## Best Practices

- Use HTTPS for all requests.
- Store API keys in environment variables or a secrets manager.
- Retry transient failures with exponential backoff.
- Validate request payloads before sending them.
- Use pagination for large result sets.
- Review response metadata carefully before processing results.

## Editorial Notes

This revision improves the page in the following ways:

- Clarified the purpose of the API and the scope of the documentation.
- Standardized terminology, section headings, and parameter labels for consistency.
- Improved grammar, sentence structure, and tone for a more professional developer audience.
- Reworked examples so they are easier to read, copy, and apply.
- Strengthened formatting through consistent tables, headings, and code block usage.
- Added clearer guidance for authentication, errors, and rate limiting to improve developer usability.
