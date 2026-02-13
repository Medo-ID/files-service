# Files Service

A production-ready microservice for managing file uploads, downloads, and storage using AWS S3. Built with Bun, TypeScript, and Drizzle ORM.

> **Project Status**: Learning project designed with production-ready principles. This service demonstrates best practices in authentication, error handling, file management, and database design while remaining approachable for learning.

## Features

- 🔐 **JWT Authentication** - Secure token-based access control
- 📁 **File & Folder Management** - Create, rename, move, and delete operations
- ⬆️ **Multipart Uploads** - Efficient large file uploads with resumable support
- ⬇️ **Downloads** - Direct file downloads and folder archiving as ZIP
- 📊 **Progress Tracking** - Real-time upload status and progress monitoring
- 🛡️ **Size Limits** - 100MB max file size (portfolio-friendly, $0 cost)
- ⚡ **Fast** - Built with Bun for superior performance

## Quick Start

### Installation

```bash
bun install
```

### Environment Variables

Create a `.env` file in the root directory:

```env
# Server
PORT=3001
ENV=development

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/files_db

# AWS S3
AWS_REGION=us-east-1
AWS_BUCKET=your-bucket-name
AWS_ACCESS_ID=your-access-key
AWS_ACCESS_SECRET=your-secret-key

# JWT
ACCESS_SECRET=your-super-secret-key
```

### Run the Service

```bash
bun run src/index.ts
```

The service will start on `http://localhost:3001`

## API Endpoints

All endpoints require `Authorization: Bearer <JWT_TOKEN>` header (except `GET /`)

### Files Management

| Method   | Endpoint              | Description                                |
| -------- | --------------------- | ------------------------------------------ |
| `GET`    | `/files/:folder`      | List files in folder (use `null` for root) |
| `GET`    | `/files/:id`          | Get file metadata and signed URL           |
| `PATCH`  | `/files/:id/rename`   | Rename file or folder                      |
| `PATCH`  | `/files/:id/move`     | Move file to another folder                |
| `DELETE` | `/files/:id`          | Soft delete file or folder recursively     |
| `GET`    | `/files/:id/download` | Download file or folder as ZIP             |

### Upload Management

| Method | Endpoint                | Description                 |
| ------ | ----------------------- | --------------------------- |
| `POST` | `/uploads/initiate`     | Initiate multipart upload   |
| `POST` | `/uploads/:id/complete` | Complete upload with parts  |
| `POST` | `/uploads/:id/abort`    | Cancel upload and cleanup   |
| `GET`  | `/uploads/:id/status`   | Get current upload progress |

## Request/Response Examples

### Initiate Upload

```bash
curl -X POST http://localhost:3001/uploads/initiate \
  -H "Authorization: Bearer your_token" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "document.pdf",
    "size": 5242880,
    "type": "file",
    "mimeType": "application/pdf"
  }'
```

**Response:**

```json
{
  "fileId": "uuid",
  "dbUploadId": "uuid",
  "s3UploadId": "multipart-upload-id",
  "presignedURLs": ["url1", "url2", ...]
}
```

### List Files

```bash
curl http://localhost:3001/files/folder-id \
  -H "Authorization: Bearer your_token"
```

## Constraints & Limits

| Limit                | Value      | Reason                                        |
| -------------------- | ---------- | --------------------------------------------- |
| Max File Size        | 100MB      | Free S3 tier ($0 cost) + server memory safety |
| Max Parts            | 10,000     | AWS S3 multipart upload limit                 |
| Presigned URL Expiry | 1 hour     | Security best practice                        |
| View URL Expiry      | 15 minutes | Safer for inline viewing                      |

## Database Schema

### Files Table

- `id` (UUID) - Primary key
- `ownerId` (UUID) - File owner
- `parentId` (UUID) - Parent folder (self-referential)
- `name` (Text) - File/folder name
- `type` (Enum) - "file" or "folder"
- `size` (BigInt) - File size in bytes
- `storageKey` (Text) - AWS S3 key
- `status` (Enum) - "pending" or "completed"
- `isDeleted` (Boolean) - Soft delete flag
- `createdAt`, `updatedAt` - Timestamps

### Uploads Table

- `id` (UUID) - Primary key
- `fileId` (UUID) - Reference to files
- `multipartUploadId` (Text) - AWS multipart ID
- `status` (Enum) - "initiated", "uploading", "completed", "aborted"
- `totalSize` (BigInt) - Expected file size
- `uploadedSize` (BigInt) - Current progress

## Extending the Service

### Adding Premium Features

1. **Storage Tiers**: Modify `MAX_FILE_SIZE` per user role

   ```typescript
   const maxSize =
     user.tier === "premium" ? 500 * 1024 * 1024 : 100 * 1024 * 1024;
   ```

2. **Bandwidth Limits**: Add rate limiting to download routes

   ```typescript
   import rateLimit from "express-rate-limit";
   ```

3. **File Encryption**: Encrypt data before uploading to S3

   ```typescript
   const encrypted = await encryptFile(buffer);
   ```

4. **Version Control**: Track file history with soft deletes

   ```typescript
   // Add versionId column to files table
   ```

5. **Sharing**: Allow users to share files with public/private links

   ```typescript
   // Add shares table and routes
   ```

6. **Analytics**: Track usage with database events
   ```typescript
   // Log file operations in analytics table
   ```

### Adding Custom Middleware

```typescript
// src/middlewares/rateLimit.ts
export function rateLimit(handler: RouteHandler): RouteHandler {
  const limits = new Map<string, number>();

  return async (req) => {
    const ip = server.requestIP(req)?.address;
    // Implement rate limiting logic
    return handler(req);
  };
}
```

### Custom Error Types

```typescript
// src/utils/error.ts
export class FileTooLargeError extends Error {
  constructor(size: number, limit: number) {
    super(`File ${size}MB exceeds limit of ${limit}MB`);
  }
}
```

## Error Handling

The service returns structured error responses:

```json
{
  "error": "File size exceeds limit. Maximum allowed: 100MB, Your file: 156.25MB"
}
```

| Status | Meaning                                    |
| ------ | ------------------------------------------ |
| 400    | Bad request (validation, size limit, etc.) |
| 401    | Unauthorized (missing/invalid token)       |
| 403    | Forbidden (permission denied)              |
| 404    | Not found                                  |
| 500    | Server error                               |

## Project Structure

```
src/
├── config.ts              # AWS & environment config
├── index.ts               # Server setup & routing
├── database/
│   ├── db.ts             # Drizzle ORM connection
│   ├── schema.ts         # Database tables & types
│   └── queries/          # Database operations
├── routes/               # API endpoint handlers
├── middlewares/          # Auth & error handling
└── utils/                # Helpers (JWT, AWS, errors, JSON)
```

## Development

```bash
# Install dependencies
bun install

# Run migrations
bunx drizzle-kit migrate:dev

# View database UI
bunx drizzle-kit studio

# Start server
bun run src/index.ts
```

## Production Considerations

- ✅ Input validation on all endpoints
- ✅ JWT token verification
- ✅ Recursive soft deletes (no orphaned data)
- ✅ Transaction safety for upload completion
- ✅ Async error handling with `.catch()` fallbacks
- ✅ Size limits to prevent abuse
- ⚠️ Add request logging for monitoring
- ⚠️ Add CORS configuration for client apps
- ⚠️ Implement rate limiting
- ⚠️ Set environment-based database pool sizes

## Learning Resources

This project demonstrates:

- Microservice architecture patterns
- JWT authentication & authorization
- Drizzle ORM with PostgreSQL
- AWS S3 multipart uploads
- Recursive SQL queries (CTEs)
- Error handling strategies
- TypeScript best practices
- Bun runtime capabilities

## Stack

- **Runtime**: [Bun](https://bun.com)
- **Language**: TypeScript
- **Database**: PostgreSQL + Drizzle ORM
- **Storage**: AWS S3
- **Auth**: JWT (jose library)
- **Upload**: AWS Multipart Upload API

## License

MIT
